"""
cache_manager.py — disk cache for cover art and achievement icons.

Deliberately has no Qt dependency: it deals in bytes and file paths only,
so it can be exercised headless. Achievement icons come back from the
Steamworks bridge as raw RGBA; rather than hand-roll a PNG encoder (or add
Pillow as a dependency for this alone) they're written out as flat, trivial
BMP files, which Qt reads natively.
"""
from __future__ import annotations

import struct
import time
from pathlib import Path

import requests

CACHE_DIR = Path.home() / ".trophyforge" / "cache"
COVER_DIR = CACHE_DIR / "covers"
ICON_DIR = CACHE_DIR / "icons"
for _d in (CACHE_DIR, COVER_DIR, ICON_DIR):
    _d.mkdir(parents=True, exist_ok=True)

COVER_URL = "https://cdn.akamai.steamstatic.com/steam/apps/{appid}/library_600x900.jpg"
HEADER_URL = "https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg"


def rgba_to_bmp_bytes(width: int, height: int, rgba: bytes) -> bytes:
    """Uncompressed 32bpp BGRA BMP — top-down, so no row reversal needed
    beyond the channel swap BMP requires."""
    row_bytes = width * 4
    pixel_data = bytearray(len(rgba))
    for i in range(0, len(rgba), 4):
        r, g, b, a = rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]
        pixel_data[i:i + 4] = bytes((b, g, r, a))

    header_size = 14 + 40
    file_size = header_size + len(pixel_data)
    file_header = struct.pack("<2sIHHI", b"BM", file_size, 0, 0, header_size)
    # negative height => top-down DIB, matches Steam's row order
    dib_header = struct.pack(
        "<IiiHHIIiiII",
        40, width, -height, 1, 32, 0, len(pixel_data), 2835, 2835, 0, 0
    )
    return file_header + dib_header + bytes(pixel_data)


class CacheManager:
    def __init__(self, cache_dir: Path | None = None):
        self.cache_dir = cache_dir or CACHE_DIR
        self.cover_dir = self.cache_dir / "covers"
        self.icon_dir = self.cache_dir / "icons"
        self.cover_dir.mkdir(parents=True, exist_ok=True)
        self.icon_dir.mkdir(parents=True, exist_ok=True)

    # -- cover art --------------------------------------------------------

    def get_cover_path(self, appid: int, timeout: float = 8.0) -> Path | None:
        """Local path to a cached library cover, downloading it once if
        missing. Falls back to the smaller header image. None if neither
        is reachable (offline, or the game has no store page art)."""
        dest = self.cover_dir / f"{appid}.jpg"
        if dest.exists() and dest.stat().st_size > 0:
            return dest

        for url in (COVER_URL.format(appid=appid), HEADER_URL.format(appid=appid)):
            try:
                r = requests.get(url, timeout=timeout)
                if r.status_code == 200 and r.content:
                    dest.write_bytes(r.content)
                    return dest
            except requests.RequestException:
                continue
        return None

    # -- achievement icons --------------------------------------------------

    def get_icon_path(self, appid: int, api_name: str) -> Path | None:
        dest = self.icon_dir / f"{appid}_{_safe(api_name)}.bmp"
        return dest if dest.exists() and dest.stat().st_size > 0 else None

    def store_icon(self, appid: int, api_name: str, width: int, height: int, rgba: bytes) -> Path:
        dest = self.icon_dir / f"{appid}_{_safe(api_name)}.bmp"
        dest.write_bytes(rgba_to_bmp_bytes(width, height, rgba))
        return dest

    # -- housekeeping ---------------------------------------------------

    def clear(self):
        for d in (self.cover_dir, self.icon_dir):
            for f in d.glob("*"):
                try:
                    f.unlink()
                except OSError:
                    pass

    def size_bytes(self) -> int:
        total = 0
        for d in (self.cover_dir, self.icon_dir):
            for f in d.glob("*"):
                try:
                    total += f.stat().st_size
                except OSError:
                    pass
        return total


def _safe(name: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in name)[:120]
