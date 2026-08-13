"""
steam_finder.py — locates the Steam installation, its library folders,
and every installed app manifest across all of them.
"""
from __future__ import annotations

import os
import sys
import platform
from dataclasses import dataclass, field
from pathlib import Path

import vdf


@dataclass
class InstalledGame:
    appid: int
    name: str
    installdir: str
    library_path: Path
    size_on_disk: int = 0
    last_updated: int = 0
    state_flags: int = 0

    @property
    def install_path(self) -> Path:
        return self.library_path / "steamapps" / "common" / self.installdir

    @property
    def acf_path(self) -> Path:
        return self.library_path / "steamapps" / f"appmanifest_{self.appid}.acf"

    @property
    def fully_installed(self) -> bool:
        # StateFlags 4 = "fully installed" in Valve's appmanifest bitfield
        return bool(self.state_flags & 4)


def _candidate_steam_paths() -> list[Path]:
    system = platform.system()
    out: list[Path] = []

    if system == "Windows":
        # the registry is authoritative; these are just sane fallbacks
        out += [
            Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")) / "Steam",
            Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Steam",
            Path("C:/Steam"),
        ]
        try:
            import winreg
            for hive, key in (
                (winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam"),
            ):
                try:
                    with winreg.OpenKey(hive, key) as k:
                        for value_name in ("SteamPath", "InstallPath"):
                            try:
                                path, _ = winreg.QueryValueEx(k, value_name)
                                out.insert(0, Path(path))
                            except FileNotFoundError:
                                pass
                except FileNotFoundError:
                    pass
        except ImportError:
            pass

    elif system == "Darwin":
        out += [Path.home() / "Library/Application Support/Steam"]

    else:  # Linux and friends
        out += [
            Path.home() / ".local/share/Steam",
            Path.home() / ".steam/steam",
            Path.home() / ".steam/root",
            Path.home() / ".var/app/com.valvesoftware.Steam/.local/share/Steam",  # Flatpak
        ]

    return out


def find_steam_root() -> Path | None:
    """Return the Steam install directory, or None if it can't be located."""
    for p in _candidate_steam_paths():
        if p and p.exists() and (p / "steamapps").exists():
            return p
    return None


def find_library_folders(steam_root: Path) -> list[Path]:
    """Every Steam library on this machine, including the main one."""
    libs = [steam_root]
    vdf_path = steam_root / "steamapps" / "libraryfolders.vdf"
    if not vdf_path.exists():
        return libs

    try:
        data = vdf.load(open(vdf_path, encoding="utf-8", errors="replace"))
    except Exception:
        return libs

    root = data.get("libraryfolders", data)
    for key, entry in root.items():
        if not isinstance(entry, dict):
            continue
        path = entry.get("path")
        if path:
            p = Path(path)
            if p.exists() and p not in libs:
                libs.append(p)
    return libs


def _read_acf(acf_path: Path, library_path: Path) -> InstalledGame | None:
    try:
        data = vdf.load(open(acf_path, encoding="utf-8", errors="replace"))
    except Exception:
        return None

    app = data.get("AppState")
    if not app:
        return None

    try:
        appid = int(app.get("appid", 0))
    except (TypeError, ValueError):
        return None
    if not appid:
        return None

    return InstalledGame(
        appid=appid,
        name=app.get("name", f"App {appid}"),
        installdir=app.get("installdir", ""),
        library_path=library_path,
        size_on_disk=int(app.get("SizeOnDisk", 0) or 0),
        last_updated=int(app.get("LastUpdated", 0) or 0),
        state_flags=int(app.get("StateFlags", 0) or 0),
    )


def scan_installed_games(steam_root: Path | None = None) -> list[InstalledGame]:
    """Every game manifest across every library folder, deduplicated by appid."""
    if steam_root is None:
        steam_root = find_steam_root()
    if steam_root is None:
        return []

    games: dict[int, InstalledGame] = {}
    for lib in find_library_folders(steam_root):
        apps_dir = lib / "steamapps"
        if not apps_dir.exists():
            continue
        for acf in apps_dir.glob("appmanifest_*.acf"):
            game = _read_acf(acf, lib)
            if game and game.appid not in games:
                games[game.appid] = game

    # Steamworks Common Redistributables (228980) isn't a real game
    games.pop(228980, None)
    return sorted(games.values(), key=lambda g: g.name.lower())


if __name__ == "__main__":
    root = find_steam_root()
    print("Steam root:", root)
    if root:
        for lib in find_library_folders(root):
            print("  library:", lib)
        for g in scan_installed_games(root):
            line = f"  {g.appid:>10}  {g.name}  ({g.installdir})  installed={g.fully_installed}"
            sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
