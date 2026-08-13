"""
animations.py — shared motion: fades, hover pop, staggered cascades,
a lightweight confetti burst, and a slow animated background gradient.
"""
from __future__ import annotations

import random

from PySide6.QtCore import (
    QEasingCurve, QObject, QPointF, QPropertyAnimation, QRectF, Qt, QTimer, Property, Signal,
)
from PySide6.QtGui import QColor, QLinearGradient, QPainter, QRadialGradient
from PySide6.QtWidgets import QGraphicsDropShadowEffect, QGraphicsOpacityEffect, QWidget

from . import theme


def fade_in(widget: QWidget, duration: int = 260, start: float = 0.0, end: float = 1.0) -> QPropertyAnimation:
    eff = widget.graphicsEffect()
    if not isinstance(eff, QGraphicsOpacityEffect):
        eff = QGraphicsOpacityEffect(widget)
        widget.setGraphicsEffect(eff)
    eff.setOpacity(start)
    anim = QPropertyAnimation(eff, b"opacity", widget)
    anim.setDuration(duration)
    anim.setStartValue(start)
    anim.setEndValue(end)
    anim.setEasingCurve(QEasingCurve.Type.OutCubic)

    if end >= 1.0:
        # Drop the effect once it has done its job. A QGraphicsOpacityEffect
        # that stays attached at opacity 1.0 still forces Qt to composite the
        # widget — and every child under it — through an offscreen pixmap on
        # every single repaint. slide_fade_in() puts one on a whole screen,
        # so leaving it behind taxed every frame of the app from then on.
        def drop_effect():
            if widget.graphicsEffect() is eff:
                widget.setGraphicsEffect(None)

        # deferred, so the effect outlives the animation that drives it
        anim.finished.connect(lambda: QTimer.singleShot(0, drop_effect))

    anim.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)
    return anim


def fade_out(widget: QWidget, duration: int = 220, on_finished=None) -> QPropertyAnimation:
    eff = widget.graphicsEffect()
    if not isinstance(eff, QGraphicsOpacityEffect):
        eff = QGraphicsOpacityEffect(widget)
        widget.setGraphicsEffect(eff)
    anim = QPropertyAnimation(eff, b"opacity", widget)
    anim.setDuration(duration)
    anim.setStartValue(eff.opacity())
    anim.setEndValue(0.0)
    anim.setEasingCurve(QEasingCurve.Type.InCubic)
    if on_finished:
        anim.finished.connect(on_finished)
    anim.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)
    return anim


def slide_fade_in(widget: QWidget, dx: int = 24, duration: int = 320):
    """Used for screen transitions: enters from a slight offset while fading in."""
    start_pos = widget.pos()
    widget.move(start_pos.x() + dx, start_pos.y())
    pos_anim = QPropertyAnimation(widget, b"pos", widget)
    pos_anim.setDuration(duration)
    pos_anim.setStartValue(widget.pos())
    pos_anim.setEndValue(start_pos)
    pos_anim.setEasingCurve(QEasingCurve.Type.OutCubic)
    pos_anim.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)
    fade_in(widget, duration=duration)


def stagger(callables, interval_ms: int = 170):
    """Fire a list of zero-arg callables one after another, `interval_ms`
    apart — the cascade effect behind 'Unlock All'."""
    for i, fn in enumerate(callables):
        QTimer.singleShot(i * interval_ms, fn)


def attach_glow(widget: QWidget, color: str = theme.PURPLE, blur: float = 24, base_alpha: int = 90) -> QGraphicsDropShadowEffect:
    eff = QGraphicsDropShadowEffect(widget)
    eff.setBlurRadius(blur)
    eff.setOffset(0, 0)
    c = QColor(color)
    c.setAlpha(base_alpha)
    eff.setColor(c)
    widget.setGraphicsEffect(eff)
    return eff


class HoverAnimator(QObject):
    """Hover feedback for cards: flips a `hovered` dynamic property and
    repolishes, so the look lives entirely in the widget's stylesheet.

    This used to grow the card by animating its `geometry` and attach a
    QGraphicsDropShadowEffect for the glow. Both are wrong for a widget
    that lives in a layout, and together they caused the card to vanish
    while staying clickable:

    * The cards sit in a QGridLayout with setFixedSize(), so every frame of
      the geometry animation fought the layout manager. Worse, `_base_geom`
      was captured on the *first* hover and never refreshed, while
      _relayout() runs on every search keystroke, every filter change,
      every resize and every game the scan thread finds. After any of
      those, hover-leave animated the card back to a position it no longer
      occupied.

    * setGraphicsEffect() destroys the effect already installed on the
      widget. A fast enter -> leave -> enter deleted the drop shadow out
      from under the still-running blurRadius animation from the previous
      leave(), and fade_in()'s opacity effect deleted it too. The widget
      was left owning a half-dead QGraphicsEffect: Qt composites it through
      an offscreen pixmap that never gets painted, so the card renders as
      nothing while its geometry — and therefore its hit-testing and its
      mousePressEvent — stay exactly where they were.

    A dynamic property costs one style repolish per hover, survives any
    number of relayouts, and cannot outlive the widget it belongs to."""

    def __init__(self, widget: QWidget, color: str = theme.PURPLE, scale_px: int = 6):
        super().__init__(widget)
        self.widget = widget
        self.color = color
        self.scale_px = scale_px  # kept for call-site compatibility
        widget.setProperty("hovered", False)

    def enter(self):
        self._set_hovered(True)

    def leave(self):
        self._set_hovered(False)

    def _set_hovered(self, on: bool):
        w = self.widget
        if bool(w.property("hovered")) == on:
            return
        w.setProperty("hovered", on)
        w.style().unpolish(w)
        w.style().polish(w)
        w.update()


class FlipReveal(QObject):
    """A 2D approximation of a card flip: squash the widget's horizontal
    scale to zero, swap its content at the midpoint via a callback, then
    unsquash. Real Qt Widgets have no 3D transform, so this is the classic
    'scaleX bounce' trick — reads convincingly as a flip."""

    finished = Signal()

    def __init__(self, widget: QWidget, on_midpoint, duration: int = 420):
        super().__init__(widget)
        self.widget = widget
        self._on_midpoint = on_midpoint
        self._base_geom = widget.geometry()
        self._fired_mid = False

        self._anim = QPropertyAnimation(widget, b"geometry", self)
        self._anim.setDuration(duration)
        self._anim.setEasingCurve(QEasingCurve.Type.InOutQuad)
        g = self._base_geom
        cx = g.center().x()
        squashed = g.adjusted(g.width() // 2 - 1, 0, -(g.width() // 2 - 1), 0)
        squashed.moveCenter(g.center())
        self._anim.setKeyValueAt(0.0, g)
        self._anim.setKeyValueAt(0.5, squashed)
        self._anim.setKeyValueAt(1.0, g)
        self._anim.valueChanged.connect(self._on_value)
        self._anim.finished.connect(self.finished.emit)

    def _on_value(self, value):
        if not self._fired_mid and value.width() <= self._base_geom.width() * 0.15:
            self._fired_mid = True
            self._on_midpoint()

    def start(self):
        self._anim.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)


class ConfettiBurst(QWidget):
    """A short-lived particle overlay: a handful of colored motes fly out
    and fall, then the widget deletes itself. Meant to be placed as a
    same-size sibling on top of whatever just got unlocked."""

    _COLORS = [theme.PURPLE, theme.PURPLE_SOFT, theme.GOLD, theme.GOLD_SOFT, "#ffffff"]

    def __init__(self, parent: QWidget, count: int = 22, lifetime_ms: int = 850):
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        self.setAttribute(Qt.WidgetAttribute.WA_NoSystemBackground)
        self.setGeometry(parent.rect())
        self.raise_()
        self.show()

        cx, cy = self.width() / 2, self.height() / 2
        self._particles = []
        for _ in range(count):
            ang = random.uniform(0, 6.28318)
            spd = random.uniform(60, 220)
            self._particles.append({
                "x": cx, "y": cy,
                "vx": spd * 0.6 * _cos(ang), "vy": spd * 0.6 * _sin(ang) - 90,
                "size": random.uniform(3, 7),
                "color": QColor(random.choice(self._COLORS)),
                "rot": random.uniform(0, 360),
                "vrot": random.uniform(-360, 360),
            })

        self._elapsed = 0
        self._dt = 16
        self._lifetime = lifetime_ms
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(self._dt)

    def _tick(self):
        self._elapsed += self._dt
        dt = self._dt / 1000.0
        for p in self._particles:
            p["vy"] += 480 * dt
            p["x"] += p["vx"] * dt
            p["y"] += p["vy"] * dt
            p["rot"] += p["vrot"] * dt
        self.update()
        if self._elapsed >= self._lifetime:
            self._timer.stop()
            self.deleteLater()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        life_t = self._elapsed / self._lifetime
        fade = max(0.0, 1.0 - life_t)
        for p in self._particles:
            painter.save()
            painter.translate(p["x"], p["y"])
            painter.rotate(p["rot"])
            c = QColor(p["color"])
            c.setAlphaF(fade)
            painter.setBrush(c)
            painter.setPen(Qt.PenStyle.NoPen)
            s = p["size"]
            painter.drawRect(int(-s / 2), int(-s / 2), int(s), int(s))
            painter.restore()


def _cos(a):
    import math
    return math.cos(a)


def _sin(a):
    import math
    return math.sin(a)


class AnimatedBackground(QWidget):
    """A slow, subtle drifting gradient behind everything — not meant to
    draw the eye, just keep the void from feeling static."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._t = 0.0
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        # ~8fps: this is a slow ambient drift, not real-time motion — no
        # reason to repaint every transparent-background widget in the
        # entire tree 25x/sec for something this subtle.
        self._timer.start(120)

    def _tick(self):
        self._t += 0.0035
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()

        base = QLinearGradient(0, 0, 0, h)
        base.setColorAt(0, QColor(theme.BG_DEEP))
        base.setColorAt(1, QColor("#0d0b16"))
        painter.fillRect(self.rect(), base)

        import math
        for i, (color, speed, radius_f) in enumerate((
            (theme.PURPLE, 0.7, 0.55),
            (theme.GOLD, 0.5, 0.42),
        )):
            cx = w * (0.5 + 0.35 * math.sin(self._t * speed + i * 2.1))
            cy = h * (0.4 + 0.3 * math.cos(self._t * speed * 0.8 + i * 1.3))
            r = min(w, h) * radius_f
            grad = QRadialGradient(QPointF(cx, cy), r)
            c = QColor(color)
            c.setAlpha(26)
            grad.setColorAt(0, c)
            c2 = QColor(color)
            c2.setAlpha(0)
            grad.setColorAt(1, c2)
            painter.fillRect(self.rect(), grad)
