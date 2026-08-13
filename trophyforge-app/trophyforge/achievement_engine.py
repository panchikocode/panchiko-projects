"""
achievement_engine.py — the Steamworks bridge.

Deliberate scope, by design, not by oversight:

  * Only games built against a *modern* Steamworks SDK (one that exports
    SteamAPI_InitFlat) are supported. Older SDKs only expose achievements
    through ISteamClient with a hand-guessed interface-version string —
    that path produced a corrupt interface pointer on a real title during
    development (GetNumAchievements came back as garbage) and is not
    included here. Such games are reported as unsupported, not attempted.

  * Only 64-bit game builds are supported in this version. A handful of
    older 32-bit titles exist in most libraries; loading a 32-bit DLL from
    a 64-bit interpreter needs a separate process bridge, which is future
    work, not a silent fallback.

  * VAC-secured games and games with any online/PvP/co-op category are
    never eligible for unlock, full stop — no "attempt anyway" mode. Games
    whose category data can't be determined (offline, API error) are
    treated as unsupported rather than assumed safe.

These are safety boundaries, not missing features — see README.
"""
from __future__ import annotations

import ctypes
import json
import os
import struct
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests

CACHE_DIR = Path.home() / ".trophyforge" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# The Steamworks flat API's bootstrap state (SteamAppId/SteamGameId env vars,
# which appid a freshly-loaded steam_api64.dll instance is "for") is process-
# global, not thread-local — the SDK was never designed for two sessions to
# be live at once in the same process. This app can have a background
# library scan and a foreground game screen both wanting a live session, so
# every SteamworksBridge lifetime (not just init) is serialized through this
# lock. Without it, two threads racing InitFlat/env-var writes is a real
# crash, not a theoretical one — it reproduced as an access violation during
# development the first time the library scan and a game screen overlapped.
_STEAM_LOCK = threading.Lock()

BLOCKED_CATEGORIES = {
    "Multi-player", "PvP", "Online PvP", "Co-op", "Online Co-op",
    "MMO", "Shared/Split Screen PvP", "Shared/Split Screen Co-op",
}


class SteamworksError(RuntimeError):
    pass


class UnsupportedGame(SteamworksError):
    """Raised when a game fails the safety gate. .reason explains why."""
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


# ---------------------------------------------------------------------------
# App metadata / safety gate
# ---------------------------------------------------------------------------

@dataclass
class GameSafety:
    appid: int
    has_achievements: bool | None = None
    vac_secured: bool | None = None
    is_online: bool | None = None
    checked_at: float = 0.0

    @property
    def known(self) -> bool:
        return self.vac_secured is not None and self.is_online is not None

    @property
    def unlock_allowed(self) -> bool:
        """Fail-safe: anything not positively confirmed clean is blocked."""
        if not self.known:
            return False
        if self.vac_secured:
            return False
        if self.is_online:
            return False
        if self.has_achievements is False:
            return False
        return True

    @property
    def reason(self) -> str:
        if not self.known:
            return "could not verify category data (offline?) — blocked to be safe"
        if self.vac_secured:
            return "VAC-secured — server-validated, unlock not supported"
        if self.is_online:
            return "has an online PvP/co-op mode — unlock not supported"
        if self.has_achievements is False:
            return "this game has no Steam achievements"
        return "supported"


def _safety_cache_path(appid: int) -> Path:
    return CACHE_DIR / f"safety_{appid}.json"


def fetch_game_safety(appid: int, use_cache: bool = True, max_age: float = 7 * 86400) -> GameSafety:
    """Classify a game as safe/unsafe to touch. Cached for a week; network
    failures fall back to a stale cache rather than to an optimistic guess."""
    cache_path = _safety_cache_path(appid)
    if use_cache and cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            if time.time() - data.get("checked_at", 0) < max_age:
                return GameSafety(**data)
        except Exception:
            pass

    gs = GameSafety(appid=appid)
    try:
        r = requests.get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": appid, "l": "english"},
            timeout=8,
        )
        r.raise_for_status()
        payload = r.json().get(str(appid), {})
        if payload.get("success"):
            cats = {c["description"] for c in payload["data"].get("categories", [])}
            gs.has_achievements = "Steam Achievements" in cats
            gs.vac_secured = "Valve Anti-Cheat enabled" in cats
            gs.is_online = bool(cats & BLOCKED_CATEGORIES)
            gs.checked_at = time.time()
            cache_path.write_text(json.dumps(gs.__dict__), encoding="utf-8")
            return gs
    except Exception:
        pass

    # network failed — fall back to a stale cache if we have one, else unknown
    if cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            return GameSafety(**data)
        except Exception:
            pass
    return gs  # unknown -> unlock_allowed is False


# ---------------------------------------------------------------------------
# DLL discovery / SDK generation check
# ---------------------------------------------------------------------------

def find_steam_api_dll(install_path: Path) -> Path | None:
    for p in install_path.rglob("steam_api64.dll"):
        return p
    return None


def is_modern_sdk(dll_path: Path) -> bool:
    """A modern Steamworks SDK exports the flat SteamAPI_InitFlat helper.
    Older SDKs only expose the C++-only SteamAPI_Init and route achievements
    through ISteamClient with an interface-version string that has to be
    guessed — unsupported here, see module docstring."""
    try:
        data = dll_path.read_bytes()
    except OSError:
        return False
    return b"SteamAPI_InitFlat\x00" in data or b"SteamAPI_InitFlat" in data


def is_pe64(dll_path: Path) -> bool:
    """True for a 64-bit PE image (IMAGE_FILE_MACHINE_AMD64 = 0x8664)."""
    try:
        with open(dll_path, "rb") as f:
            f.seek(0x3C)
            pe_offset = struct.unpack("<I", f.read(4))[0]
            f.seek(pe_offset + 4)
            machine = struct.unpack("<H", f.read(2))[0]
            return machine == 0x8664
    except (OSError, struct.error):
        return False


# ---------------------------------------------------------------------------
# The live Steamworks bridge
# ---------------------------------------------------------------------------

@dataclass
class AchievementInfo:
    api_name: str
    display_name: str
    description: str
    hidden: bool
    unlocked: bool
    global_percent: float | None = None


class SteamworksBridge:
    """One instance == one initialised connection to one game's stats.
    Always use as a context manager so SteamAPI_Shutdown is guaranteed."""

    def __init__(self, appid: int, dll_path: Path, work_dir: Path | None = None):
        self.appid = str(appid)
        self.dll_path = str(dll_path)
        self.work_dir = work_dir or (CACHE_DIR / "steamwork" / self.appid)
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self._api: ctypes.CDLL | None = None
        self._stats: int = 0
        self._utils: int = 0
        self._locked = False
        self._fn_request_stats = self._fn_get_num = self._fn_get_name = None
        self._fn_get_ach = self._fn_set_ach = self._fn_clear_ach = self._fn_store = None
        self._fn_attr = self._fn_get_stat_i = self._fn_set_stat_i = None
        self._fn_get_stat_f = self._fn_set_stat_f = None
        self._fn_get_icon = self._fn_img_size = self._fn_img_rgba = None

    def __enter__(self) -> "SteamworksBridge":
        self._init()
        return self

    def __exit__(self, *exc):
        self.shutdown()

    # -- lifecycle ----------------------------------------------------------

    def _init(self):
        if not is_modern_sdk(Path(self.dll_path)):
            raise UnsupportedGame("legacy Steamworks SDK — unlock not supported")
        if not is_pe64(Path(self.dll_path)):
            raise UnsupportedGame("32-bit game build — unlock not supported yet")

        # Held for the whole session, released in shutdown() — see the
        # _STEAM_LOCK docstring above for why this can't be scoped tighter.
        _STEAM_LOCK.acquire()
        self._locked = True
        try:
            self._init_locked()
        except BaseException:
            # guarantee the lock is never leaked, even on a ctypes-level
            # surprise or a Ctrl-C mid-init
            if self._api is not None:
                try:
                    self._api.SteamAPI_Shutdown()
                except Exception:
                    pass
                self._api = None
            self._release_lock()
            raise

    def _init_locked(self):
        # steam_appid.txt is written defensively; SteamAppId/SteamGameId env
        # vars are what the SDK actually checks first and are sufficient on
        # their own, so the process's cwd is never touched.
        (self.work_dir / "steam_appid.txt").write_text(self.appid, encoding="utf-8")
        os.environ["SteamAppId"] = self.appid
        os.environ["SteamGameId"] = self.appid

        api = ctypes.CDLL(self.dll_path)
        api.SteamAPI_InitFlat.restype = ctypes.c_int
        api.SteamAPI_InitFlat.argtypes = [ctypes.c_char_p]
        err = ctypes.create_string_buffer(1024)
        rc = api.SteamAPI_InitFlat(err)
        if rc != 0:
            raise SteamworksError(f"SteamAPI_InitFlat failed (rc={rc}): {err.value.decode(errors='replace')}")

        stats_ptr = self._resolve_interface(api, "SteamAPI_SteamUserStats_v")
        if stats_ptr is None:
            api.SteamAPI_Shutdown()
            raise SteamworksError("could not obtain ISteamUserStats")
        utils_ptr = self._resolve_interface(api, "SteamAPI_SteamUtils_v")

        self._bind(api)
        self._api = api
        self._stats = stats_ptr
        self._utils = utils_ptr

        # Present on most, but not all, SDK builds — some newer builds
        # populate stats automatically on InitFlat and drop this export.
        if self._fn_request_stats:
            self._fn_request_stats(self._stats)
        for _ in range(80):
            self._api.SteamAPI_RunCallbacks()
            time.sleep(0.05)

    def _resolve_interface(self, api: ctypes.CDLL, prefix: str) -> int | None:
        """Flat accessors are version-suffixed (e.g. ...v013); newest wins."""
        for v in range(20, 0, -1):
            fn = getattr(api, f"{prefix}{v:03d}", None)
            if fn is None:
                continue
            fn.restype = ctypes.c_void_p
            ptr = fn()
            if ptr:
                return ptr
        return None

    def _opt(self, api: ctypes.CDLL, name: str, restype, argtypes):
        """Bind an export if present; return None (not a crash) if this
        particular SDK build doesn't ship it."""
        fn = getattr(api, name, None)
        if fn is None:
            return None
        fn.restype = restype
        fn.argtypes = argtypes
        return fn

    def _bind(self, api: ctypes.CDLL):
        V = ctypes.c_void_p
        O = self._opt
        self._fn_request_stats = O(api, "SteamAPI_ISteamUserStats_RequestCurrentStats", ctypes.c_bool, [V])
        self._fn_get_num = O(api, "SteamAPI_ISteamUserStats_GetNumAchievements", ctypes.c_uint, [V])
        self._fn_get_name = O(api, "SteamAPI_ISteamUserStats_GetAchievementName", ctypes.c_char_p, [V, ctypes.c_uint])
        self._fn_get_ach = O(api, "SteamAPI_ISteamUserStats_GetAchievement", ctypes.c_bool,
                              [V, ctypes.c_char_p, ctypes.POINTER(ctypes.c_bool)])
        self._fn_set_ach = O(api, "SteamAPI_ISteamUserStats_SetAchievement", ctypes.c_bool, [V, ctypes.c_char_p])
        self._fn_clear_ach = O(api, "SteamAPI_ISteamUserStats_ClearAchievement", ctypes.c_bool, [V, ctypes.c_char_p])
        self._fn_store = O(api, "SteamAPI_ISteamUserStats_StoreStats", ctypes.c_bool, [V])
        self._fn_attr = O(api, "SteamAPI_ISteamUserStats_GetAchievementDisplayAttribute", ctypes.c_char_p,
                           [V, ctypes.c_char_p, ctypes.c_char_p])
        self._fn_get_stat_i = O(api, "SteamAPI_ISteamUserStats_GetStatInt32", ctypes.c_bool,
                                 [V, ctypes.c_char_p, ctypes.POINTER(ctypes.c_int32)])
        self._fn_set_stat_i = O(api, "SteamAPI_ISteamUserStats_SetStatInt32", ctypes.c_bool,
                                 [V, ctypes.c_char_p, ctypes.c_int32])
        self._fn_get_stat_f = O(api, "SteamAPI_ISteamUserStats_GetStatFloat", ctypes.c_bool,
                                 [V, ctypes.c_char_p, ctypes.POINTER(ctypes.c_float)])
        self._fn_set_stat_f = O(api, "SteamAPI_ISteamUserStats_SetStatFloat", ctypes.c_bool,
                                 [V, ctypes.c_char_p, ctypes.c_float])
        self._fn_get_icon = O(api, "SteamAPI_ISteamUserStats_GetAchievementIcon", ctypes.c_int, [V, ctypes.c_char_p])
        self._fn_img_size = O(api, "SteamAPI_ISteamUtils_GetImageSize", ctypes.c_bool,
                               [V, ctypes.c_int, ctypes.POINTER(ctypes.c_uint32), ctypes.POINTER(ctypes.c_uint32)])
        self._fn_img_rgba = O(api, "SteamAPI_ISteamUtils_GetImageRGBA", ctypes.c_bool,
                               [V, ctypes.c_int, ctypes.POINTER(ctypes.c_uint8), ctypes.c_int])
        api.SteamAPI_RunCallbacks.restype = None
        api.SteamAPI_RunCallbacks.argtypes = []
        api.SteamAPI_Shutdown.restype = None
        api.SteamAPI_Shutdown.argtypes = []

    def shutdown(self):
        if self._api is not None:
            try:
                self._api.SteamAPI_Shutdown()
            except Exception:
                pass
            self._api = None
        self._release_lock()

    def _release_lock(self):
        if self._locked:
            self._locked = False
            _STEAM_LOCK.release()

    def pump(self, seconds: float = 0.3):
        n = max(1, int(seconds / 0.05))
        for _ in range(n):
            self._api.SteamAPI_RunCallbacks()
            time.sleep(0.05)

    # -- read -----------------------------------------------------------

    def list_achievements(self) -> list[AchievementInfo]:
        if not (self._fn_get_num and self._fn_get_name and self._fn_get_ach):
            raise SteamworksError("this SDK build doesn't expose achievement enumeration")
        n = self._fn_get_num(self._stats)
        out = []
        for i in range(n):
            raw = self._fn_get_name(self._stats, i)
            if not raw:
                continue
            name = raw.decode(errors="replace")
            out.append(self._describe(name))
        return out

    def _attr(self, name: str, key: str) -> str:
        if not self._fn_attr:
            return ""
        raw = self._fn_attr(self._stats, name.encode(), key.encode())
        return raw.decode(errors="replace") if raw else ""

    def _describe(self, name: str) -> AchievementInfo:
        got = ctypes.c_bool(False)
        self._fn_get_ach(self._stats, name.encode(), ctypes.byref(got))
        return AchievementInfo(
            api_name=name,
            display_name=self._attr(name, "name") or name,
            description=self._attr(name, "desc"),
            hidden=self._attr(name, "hidden") == "1",
            unlocked=got.value,
        )

    def get_achievement_icon_rgba(self, api_name: str, wait: float = 1.2) -> tuple[int, int, bytes] | None:
        """Raw RGBA bytes for an achievement's current (locked/unlocked) icon,
        straight from the game's own Steamworks image cache. Returns None if
        this build doesn't expose the interfaces or the icon isn't cached yet."""
        if not (self._utils and self._fn_get_icon and self._fn_img_size and self._fn_img_rgba):
            return None

        handle = self._fn_get_icon(self._stats, api_name.encode())
        if handle <= 0:
            # not cached client-side yet — give the async fetch a moment
            self.pump(wait)
            handle = self._fn_get_icon(self._stats, api_name.encode())
        if handle <= 0:
            return None

        w, h = ctypes.c_uint32(0), ctypes.c_uint32(0)
        if not self._fn_img_size(self._utils, handle, ctypes.byref(w), ctypes.byref(h)):
            return None
        if w.value == 0 or h.value == 0 or w.value > 2048 or h.value > 2048:
            return None

        buf_len = w.value * h.value * 4
        buf = (ctypes.c_uint8 * buf_len)()
        if not self._fn_img_rgba(self._utils, handle, buf, buf_len):
            return None
        return w.value, h.value, bytes(buf)

    def get_stat_int(self, name: str) -> int | None:
        if not self._fn_get_stat_i:
            return None
        v = ctypes.c_int32(0)
        ok = self._fn_get_stat_i(self._stats, name.encode(), ctypes.byref(v))
        return v.value if ok else None

    # -- write ------------------------------------------------------------

    def unlock(self, api_name: str) -> bool:
        if not self._fn_set_ach:
            raise SteamworksError("this SDK build doesn't expose SetAchievement")
        return bool(self._fn_set_ach(self._stats, api_name.encode()))

    def lock(self, api_name: str) -> bool:
        if not self._fn_clear_ach:
            raise SteamworksError("this SDK build doesn't expose ClearAchievement")
        return bool(self._fn_clear_ach(self._stats, api_name.encode()))

    def set_stat_int(self, name: str, value: int) -> bool:
        if not self._fn_set_stat_i:
            raise SteamworksError("this SDK build doesn't expose SetStatInt32")
        return bool(self._fn_set_stat_i(self._stats, name.encode(), value))

    def set_stat_float(self, name: str, value: float) -> bool:
        if not self._fn_set_stat_f:
            raise SteamworksError("this SDK build doesn't expose SetStatFloat")
        return bool(self._fn_set_stat_f(self._stats, name.encode(), ctypes.c_float(value)))

    def commit(self) -> bool:
        if not self._fn_store:
            raise SteamworksError("this SDK build doesn't expose StoreStats")
        ok = bool(self._fn_store(self._stats))
        self.pump(0.3)
        return ok


# ---------------------------------------------------------------------------
# Global achievement rarity (%), no API key required
# ---------------------------------------------------------------------------

def fetch_global_percentages(appid: int, use_cache: bool = True, max_age: float = 86400) -> dict[str, float]:
    cache_path = CACHE_DIR / f"percent_{appid}.json"
    if use_cache and cache_path.exists():
        try:
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            if time.time() - data.get("_checked_at", 0) < max_age:
                data.pop("_checked_at", None)
                return data
        except Exception:
            pass
    out: dict[str, float] = {}
    try:
        r = requests.get(
            "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/",
            params={"gameid": appid}, timeout=8,
        )
        r.raise_for_status()
        for a in r.json().get("achievementpercentages", {}).get("achievements", []):
            out[a["name"]] = float(a["percent"])
        cache_path.write_text(json.dumps({**out, "_checked_at": time.time()}), encoding="utf-8")
    except Exception:
        pass
    return out
