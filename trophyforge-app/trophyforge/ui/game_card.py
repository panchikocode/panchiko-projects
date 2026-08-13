"""
game_card.py — one tile in the library grid: cover art, progress bar,
a status tag, and the hover pop/glow.
"""
from __future__ import annotations

from PySide6.QtCore import QRunnable, Qt, QThreadPool, Signal, QObject, QPropertyAnimation, QEasingCurve
from PySide6.QtGui import QColor, QFont, QLinearGradient, QPainter, QPixmap
from PySide6.QtWidgets import QFrame, QLabel, QProgressBar, QVBoxLayout, QWidget

from . import theme
from .animations import HoverAnimator
from ..cache_manager import CacheManager

CARD_W, CARD_H = 168, 252
COVER_H = 190

_pool = QThreadPool.globalInstance()


class _CoverSignals(QObject):
    done = Signal(int, object)  # appid, path-or-None


class _CoverJob(QRunnable):
    def __init__(self, appid: int, cache: CacheManager):
        super().__init__()
        self.appid = appid
        self.cache = cache
        self.signals = _CoverSignals()

    def run(self):
        path = self.cache.get_cover_path(self.appid)
        self.signals.done.emit(self.appid, path)


def _placeholder_pixmap(name: str, w: int, h: int) -> QPixmap:
    pm = QPixmap(w, h)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    grad = QLinearGradient(0, 0, w, h)
    grad.setColorAt(0, QColor(theme.PURPLE).darker(180))
    grad.setColorAt(1, QColor(theme.GOLD).darker(220))
    p.fillRect(0, 0, w, h, grad)
    initials = "".join(w[0] for w in name.split()[:2]).upper() or "?"
    p.setPen(QColor(255, 255, 255, 60))
    f = QFont(theme.FONT_FAMILY)
    f.setPointSize(int(h * 0.28))
    f.setBold(True)
    p.setFont(f)
    p.drawText(pm.rect(), Qt.AlignmentFlag.AlignCenter, initials)
    p.end()
    return pm


class GameCardWidget(QFrame):
    clicked = Signal(object)  # GameSchema

    def __init__(self, schema, cache: CacheManager, parent: QWidget | None = None):
        super().__init__(parent)
        self.schema = schema
        self.cache = cache
        self.setFixedSize(CARD_W, CARD_H)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setObjectName("gameCard")
        self.setStyleSheet(f"""
            #gameCard {{
                background: {theme.GLASS};
                border: 1px solid {theme.BORDER};
                border-radius: 14px;
            }}
            #gameCard[hovered="true"] {{
                background: rgba(255, 255, 255, 18);
                border: 1px solid {theme.PURPLE};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)

        self.cover = QLabel()
        self.cover.setFixedSize(CARD_W - 16, COVER_H)
        self.cover.setPixmap(self._scaled(_placeholder_pixmap(schema.game.name, CARD_W - 16, COVER_H)))
        self.cover.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.cover.setStyleSheet("border-radius: 10px;")
        layout.addWidget(self.cover)

        self.title = QLabel(self._elide(schema.game.name))
        self.title.setStyleSheet(f"font-weight: 600; font-size: 12px; color: {theme.TEXT};")
        self.title.setWordWrap(False)
        layout.addWidget(self.title)

        row = QVBoxLayout()
        row.setSpacing(2)
        self.progress = QProgressBar()
        self.progress.setFixedHeight(6)
        self.progress.setTextVisible(False)
        self.progress.setRange(0, max(1, schema.total_count))
        self.progress.setValue(0)
        self._set_progress_style()
        row.addWidget(self.progress)

        self.status = QLabel(self._status_text())
        self.status.setStyleSheet(f"font-size: 10px; color: {self._status_color()};")
        row.addWidget(self.status)
        layout.addLayout(row)

        self._hover = HoverAnimator(self, color=theme.PURPLE, scale_px=5)

        self._value_anim: QPropertyAnimation | None = None
        self._request_cover()
        self._animate_progress_in()

    # -- helpers ----------------------------------------------------------

    def _elide(self, text: str, max_len: int = 22) -> str:
        return text if len(text) <= max_len else text[: max_len - 1].rstrip() + "…"

    def _scaled(self, pm: QPixmap) -> QPixmap:
        return pm.scaled(CARD_W - 16, COVER_H, Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                          Qt.TransformationMode.SmoothTransformation)

    def _status_text(self) -> str:
        s = self.schema
        if s.can_unlock:
            if s.unlocked_count == s.total_count and s.total_count:
                return "100% complete"
            return f"{s.unlocked_count} / {s.total_count} achievements"
        if s.total_count:
            return f"{s.unlocked_count} / {s.total_count} — {s.unsupported_reason or s.safety.reason}"
        return "no achievements"

    def _status_color(self) -> str:
        s = self.schema
        if s.can_unlock:
            return theme.JADE_OK if s.unlocked_count == s.total_count and s.total_count else theme.TEXT_DIM
        return theme.RED_BAD if s.total_count else theme.TEXT_FAINT

    def _set_progress_style(self):
        pct = 0
        if self.schema.total_count:
            pct = int(100 * self.schema.unlocked_count / self.schema.total_count)
        color = theme.GOLD if pct == 100 else theme.PURPLE
        self.progress.setStyleSheet(f"""
            QProgressBar {{
                background: rgba(255,255,255,20);
                border-radius: 3px;
                border: none;
            }}
            QProgressBar::chunk {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 {theme.PURPLE}, stop:1 {color});
                border-radius: 3px;
            }}
        """)

    def _animate_progress_in(self):
        target = self.schema.unlocked_count
        self._value_anim = QPropertyAnimation(self.progress, b"value", self)
        self._value_anim.setDuration(650)
        self._value_anim.setStartValue(0)
        self._value_anim.setEndValue(target)
        self._value_anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        self._value_anim.start()

    def refresh_progress(self):
        self.progress.setRange(0, max(1, self.schema.total_count))
        self._set_progress_style()
        self._animate_progress_in()
        self.status.setText(self._status_text())
        self.status.setStyleSheet(f"font-size: 10px; color: {self._status_color()};")

    def _request_cover(self):
        job = _CoverJob(self.schema.game.appid, self.cache)
        job.signals.done.connect(self._on_cover_ready)
        _pool.start(job)

    def _on_cover_ready(self, appid: int, path):
        if path is None:
            return
        pm = QPixmap(str(path))
        if not pm.isNull():
            self.cover.setPixmap(self._scaled(pm))

    # -- interaction ------------------------------------------------------

    def enterEvent(self, event):
        self._hover.enter()
        super().enterEvent(event)

    def leaveEvent(self, event):
        self._hover.leave()
        super().leaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(self.schema)
        super().mousePressEvent(event)
