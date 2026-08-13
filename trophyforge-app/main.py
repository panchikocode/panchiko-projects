#!/usr/bin/env python3
"""TrophyForge — an offline Steam achievement manager for your own library."""
import sys

from PySide6.QtWidgets import QApplication

from trophyforge.ui import theme
from trophyforge.ui.main_window import MainWindow


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("TrophyForge")
    app.setStyleSheet(theme.QSS)

    window = MainWindow()
    window.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
