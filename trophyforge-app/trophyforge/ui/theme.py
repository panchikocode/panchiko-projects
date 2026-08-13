"""
theme.py — the TrophyForge look: near-black background, glass-panel cards,
a purple -> gold "forge" accent gradient.

A note on "glassmorphism" in Qt Widgets: real live backdrop-blur (seeing a
blurred version of whatever's actually behind a widget, updated every frame)
isn't something Qt Widgets does natively — that needs compositor-level
support or a QGraphicsView/QML scenegraph. What's implemented here is the
standard widget-toolkit approximation: semi-transparent panels, a soft
gradient border, and a glow shadow that intensifies on hover. It reads as
"glass," it just isn't literally blurring pixels behind it.
"""
from __future__ import annotations

# -- palette ---------------------------------------------------------------

BG_DEEP = "#08070d"
BG_PANEL = "#12111c"
GLASS = "rgba(24, 22, 38, 170)"
GLASS_HOVER = "rgba(34, 30, 54, 200)"
BORDER = "rgba(168, 130, 255, 60)"
BORDER_HOVER = "rgba(196, 160, 255, 140)"

PURPLE = "#a855f7"
PURPLE_SOFT = "#c084fc"
GOLD = "#f4b93a"
GOLD_SOFT = "#ffd76a"
JADE_OK = "#4ade80"
RED_BAD = "#f87171"

TEXT = "#f1eefc"
TEXT_DIM = "#9d95b8"
TEXT_FAINT = "#655d80"

FONT_FAMILY = '"Segoe UI", "Inter", "Helvetica Neue", sans-serif'

QSS = f"""
QWidget {{
    background: transparent;
    color: {TEXT};
    font-family: {FONT_FAMILY};
    font-size: 13px;
}}

QMainWindow, #root {{
    background-color: {BG_DEEP};
}}

QLabel#h1 {{
    font-size: 22px;
    font-weight: 700;
    color: {TEXT};
}}
QLabel#h2 {{
    font-size: 15px;
    font-weight: 600;
    color: {TEXT_DIM};
}}
QLabel#statLabel {{
    font-size: 12px;
    color: {TEXT_FAINT};
}}
QLabel#statValue {{
    font-size: 18px;
    font-weight: 700;
    color: {GOLD};
}}

QLineEdit#searchBox {{
    background: {GLASS};
    border: 1px solid {BORDER};
    border-radius: 10px;
    padding: 8px 14px;
    color: {TEXT};
    font-size: 13px;
}}
QLineEdit#searchBox:focus {{
    border: 1px solid {PURPLE_SOFT};
}}

QComboBox {{
    background: {GLASS};
    border: 1px solid {BORDER};
    border-radius: 8px;
    padding: 6px 10px;
    color: {TEXT};
}}
QComboBox QAbstractItemView {{
    background: {BG_PANEL};
    color: {TEXT};
    selection-background-color: {PURPLE};
    border: 1px solid {BORDER};
}}

QPushButton {{
    background: {GLASS};
    border: 1px solid {BORDER};
    border-radius: 9px;
    padding: 8px 16px;
    color: {TEXT};
    font-weight: 600;
}}
QPushButton:hover {{
    background: {GLASS_HOVER};
    border: 1px solid {BORDER_HOVER};
}}
QPushButton:pressed {{
    background: rgba(50, 40, 80, 220);
}}
QPushButton:disabled {{
    color: {TEXT_FAINT};
    border: 1px solid rgba(120, 110, 150, 30);
}}

QPushButton#primary {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {PURPLE}, stop:1 {GOLD});
    border: none;
    color: #0a0812;
    font-weight: 700;
}}
QPushButton#primary:hover {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 {PURPLE_SOFT}, stop:1 {GOLD_SOFT});
}}
QPushButton#primary:disabled {{
    background: rgba(120, 110, 150, 40);
    color: {TEXT_FAINT};
}}

QPushButton#ghost {{
    background: transparent;
    border: 1px solid {BORDER};
}}

QScrollArea {{
    border: none;
    background: transparent;
}}
QScrollBar:vertical {{
    background: transparent;
    width: 10px;
    margin: 0;
}}
QScrollBar::handle:vertical {{
    background: rgba(168, 130, 255, 90);
    border-radius: 5px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{
    background: rgba(168, 130, 255, 150);
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

QCheckBox {{
    spacing: 8px;
}}
QCheckBox::indicator {{
    width: 16px; height: 16px;
    border-radius: 4px;
    border: 1px solid {BORDER_HOVER};
    background: {GLASS};
}}
QCheckBox::indicator:checked {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 {PURPLE}, stop:1 {GOLD});
    border: 1px solid {GOLD_SOFT};
}}

QToolTip {{
    background: {BG_PANEL};
    color: {TEXT};
    border: 1px solid {BORDER};
    padding: 6px;
    border-radius: 6px;
}}
"""
