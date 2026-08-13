"""
schema_parser.py — turns an installed game into a full achievement schema:
names, descriptions, unlock state, global rarity, and a safety verdict.

Reading achievement state is always safe — it's a local query of state the
Steam client already shows you, nothing is written. So browsing/progress
is available for every game with a supported engine build, including
VAC-secured or online titles; only the *unlock* action (elsewhere, in
achievement_engine.SteamworksBridge.unlock/lock) is gated by GameSafety.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .achievement_engine import (
    AchievementInfo, SteamworksBridge, GameSafety, SteamworksError, UnsupportedGame,
    fetch_game_safety, fetch_global_percentages, find_steam_api_dll, is_modern_sdk, is_pe64,
)
from .steam_finder import InstalledGame


@dataclass
class GameSchema:
    game: InstalledGame
    safety: GameSafety
    dll_path: object | None
    achievements: list[AchievementInfo] = field(default_factory=list)
    supported: bool = False
    unsupported_reason: str = ""

    @property
    def unlocked_count(self) -> int:
        return sum(1 for a in self.achievements if a.unlocked)

    @property
    def total_count(self) -> int:
        return len(self.achievements)

    @property
    def can_unlock(self) -> bool:
        return self.supported and self.safety.unlock_allowed


def load_schema(game: InstalledGame, use_safety_cache: bool = True) -> GameSchema:
    safety = fetch_game_safety(game.appid, use_cache=use_safety_cache)
    dll_path = find_steam_api_dll(game.install_path)

    schema = GameSchema(game=game, safety=safety, dll_path=dll_path)

    if dll_path is None:
        schema.unsupported_reason = "no Steamworks integration found in this install"
        return _fallback_from_web(schema)

    if not is_modern_sdk(dll_path):
        schema.unsupported_reason = "legacy Steamworks SDK — browsing/unlock not supported"
        return _fallback_from_web(schema)

    if not is_pe64(dll_path):
        schema.unsupported_reason = "32-bit game build — browsing/unlock not supported yet"
        return _fallback_from_web(schema)

    try:
        with SteamworksBridge(game.appid, dll_path) as bridge:
            schema.achievements = bridge.list_achievements()
        schema.supported = True
    except (SteamworksError, UnsupportedGame) as e:
        schema.unsupported_reason = str(e)
        return _fallback_from_web(schema)

    _attach_rarity(schema)
    return schema


def _fallback_from_web(schema: GameSchema) -> GameSchema:
    """No local engine access — at least report how many achievements exist
    and their rarity, from Valve's keyless global-stats endpoint. No display
    names/descriptions are available this way (those aren't exposed without
    a Web API key), so the UI shows raw API names in this mode."""
    percents = fetch_global_percentages(schema.game.appid)
    if percents:
        schema.achievements = [
            AchievementInfo(api_name=n, display_name=n, description="", hidden=False,
                             unlocked=False, global_percent=p)
            for n, p in percents.items()
        ]
    return schema


def _attach_rarity(schema: GameSchema):
    percents = fetch_global_percentages(schema.game.appid)
    if not percents:
        return
    for a in schema.achievements:
        a.global_percent = percents.get(a.api_name)
