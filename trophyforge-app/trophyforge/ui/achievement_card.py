"""
achievement_card.py — one row in a game's achievement list: icon, name,
description, rarity, a select checkbox, and the unlock-reveal animation.
"""
from __future__ import annotations

from functools import lru_cache

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QColor, QImage, QPainter, QPixmap
from PySide6.QtWidgets import QCheckBox, QFrame, QHBoxLayout, QLabel, QVBoxLayout, QWidget

from . import theme
from .animations import ConfettiBurst, FlipReveal

ICON_SIZE = 48


def _grayscale(pm: QPixmap) -> QPixmap:
    """Desaturate in place over the raw buffer.

    The previous version walked the image with pixelColor()/setPixelColor(),
    which is two QColor round-trips per pixel — 2304 pixels per 48x48 icon,
    on the UI thread, for every locked achievement on the screen. Opening a
    game with a few hundred achievements meant hundreds of thousands of
    those calls before the first frame could be painted, which is most of
    why the list took so long to appear."""
    img = pm.toImage().convertToFormat(QImage.Format.Format_ARGB32)
    buf = bytearray(img.constBits())
    # ARGB32 is BGRA in memory on little-endian; leave byte 3 (alpha) alone.
    for i in range(0, len(buf) - 3, 4):
        y = (buf[i] * 29 + buf[i + 1] * 150 + buf[i + 2] * 77) >> 8
        buf[i] = buf[i + 1] = buf[i + 2] = y
    out = QImage(bytes(buf), img.width(), img.height(), img.bytesPerLine(),
                 QImage.Format.Format_ARGB32)
    return QPixmap.fromImage(out.copy())


@lru_cache(maxsize=2)
def _placeholder_icon(locked: bool) -> QPixmap:
    pm = QPixmap(ICON_SIZE, ICON_SIZE)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    color = QColor(theme.TEXT_FAINT) if locked else QColor(theme.GOLD)
    p.setBrush(color)
    p.setPen(Qt.PenStyle.NoPen)
    p.drawEllipse(4, 4, ICON_SIZE - 8, ICON_SIZE - 8)
    p.setPen(QColor("#0a0812"))
    f = p.font()
    f.setBold(True)
    f.setPointSize(16)
    p.setFont(f)
    p.drawText(pm.rect(), Qt.AlignmentFlag.AlignCenter, "?" if locked else "★")
    p.end()
    return pm


@lru_cache(maxsize=2)
def _placeholder_for(locked: bool) -> QPixmap:
    """The scaled — and, when locked, desaturated — placeholder every card
    starts with. It is byte-for-byte identical on every card, so build it
    once instead of once per row."""
    pm = _placeholder_icon(locked).scaled(
        ICON_SIZE, ICON_SIZE, Qt.AspectRatioMode.KeepAspectRatio,
        Qt.TransformationMode.SmoothTransformation)
    return _grayscale(pm) if locked else pm


class AchievementCardWidget(QFrame):
    toggled = Signal(str, bool)          # api_name, checked
    unlock_requested = Signal(str)       # api_name
    lock_requested = Signal(str)         # api_name
    icon_needed = Signal(str)            # api_name — ask the owner to fetch

    def __init__(self, info, icon_fetch_fn=None, parent: QWidget | None = None):
        """Icons are pushed in by the owner (GameDetailScreen) via
        set_icon_rgba(); the card never touches Steamworks itself. The
        `icon_fetch_fn` argument is accepted and ignored, kept so older call
        sites do not break."""
        super().__init__(parent)
        self.info = info
        self.setObjectName("achCard")
        self.setStyleSheet(f"""
            #achCard {{
                background: {theme.GLASS};
                border: 1px solid {theme.BORDER};
                border-radius: 12px;
            }}
            #achCard[unlocked="true"] {{
                border: 1px solid rgba(244, 185, 58, 90);
            }}
        """)
        self.setProperty("unlocked", "true" if info.unlocked else "false")

        root = QHBoxLayout(self)
        root.setContentsMargins(12, 10, 14, 10)
        root.setSpacing(12)

        self.checkbox = QCheckBox()
        self.checkbox.setVisible(False)  # only shown in multi-select mode
        self.checkbox.stateChanged.connect(lambda st: self.toggled.emit(self.info.api_name, st == 2))
        root.addWidget(self.checkbox)

        self.icon_label = QLabel()
        self.icon_label.setFixedSize(ICON_SIZE, ICON_SIZE)
        self.icon_label.setPixmap(_placeholder_for(not info.unlocked))
        root.addWidget(self.icon_label)

        text_col = QVBoxLayout()
        text_col.setSpacing(2)
        name = info.display_name if not (info.hidden and not info.unlocked) else "??? (hidden)"
        self.name_label = QLabel(name)
        self.name_label.setStyleSheet(
            f"font-weight: 700; font-size: 13px; color: {theme.GOLD if info.unlocked else theme.TEXT};"
        )
        text_col.addWidget(self.name_label)

        desc = info.description if not (info.hidden and not info.unlocked) else "Unlocks to reveal details."
        self.desc_label = QLabel(desc)
        self.desc_label.setWordWrap(True)
        self.desc_label.setStyleSheet(f"font-size: 11px; color: {theme.TEXT_DIM};")
        text_col.addWidget(self.desc_label)
        root.addLayout(text_col, stretch=1)

        right_col = QVBoxLayout()
        right_col.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        if info.global_percent is not None:
            pct_label = QLabel(f"{info.global_percent:.1f}% of players")
            pct_label.setStyleSheet(f"font-size: 10px; color: {theme.TEXT_FAINT};")
            right_col.addWidget(pct_label)
        self.state_label = QLabel("UNLOCKED" if info.unlocked else "LOCKED")
        self.state_label.setStyleSheet(
            f"font-size: 10px; font-weight: 700; "
            f"color: {theme.JADE_OK if info.unlocked else theme.TEXT_FAINT};"
        )
        right_col.addWidget(self.state_label, alignment=Qt.AlignmentFlag.AlignRight)
        root.addLayout(right_col)

    def set_multiselect(self, on: bool):
        self.checkbox.setVisible(on and not self.info.unlocked)

    def is_checked(self) -> bool:
        return self.checkbox.isChecked()

    def set_checked(self, val: bool):
        self.checkbox.setChecked(val)

    # -- icon loading -------------------------------------------------------

    def _apply_icon(self, pm: QPixmap):
        scaled = pm.scaled(ICON_SIZE, ICON_SIZE, Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation)
        if not self.info.unlocked:
            scaled = _grayscale(scaled)
        self.icon_label.setPixmap(scaled)

    def set_icon_rgba(self, result):
        """Called on the UI thread with the (w, h, rgba) tuple the engine
        thread produced, or None if the fetch failed."""
        if not result:
            return
        w, h, rgba = result
        img = QImage(rgba, w, h, w * 4, QImage.Format.Format_RGBA8888)
        pm = QPixmap.fromImage(img.copy())
        if not pm.isNull():
            self._apply_icon(pm)

    # -- the unlock reveal --------------------------------------------------

    def apply_unlocked(self, new_info):
        """Restyle the row as unlocked, with no animation."""
        self.info = new_info
        self.icon_label.setPixmap(_placeholder_for(False))
        self.name_label.setText(new_info.display_name)
        self.name_label.setStyleSheet(f"font-weight: 700; font-size: 13px; color: {theme.GOLD};")
        self.desc_label.setText(new_info.description)
        self.state_label.setText("UNLOCKED")
        self.state_label.setStyleSheet(f"font-size: 10px; font-weight: 700; color: {theme.JADE_OK};")
        self.setProperty("unlocked", "true")
        self.style().unpolish(self)
        self.style().polish(self)
        self.checkbox.setVisible(False)
        self.icon_needed.emit(self.info.api_name)

    def play_unlock_animation(self, new_info):
        """Flip the icon from grey to gold, pop confetti, restyle as unlocked."""
        flip = FlipReveal(self.icon_label, lambda: self.apply_unlocked(new_info), duration=380)
        flip.start()
        ConfettiBurst(self, count=18)
        self.checkbox.setVisible(False)
