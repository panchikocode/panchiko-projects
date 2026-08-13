"""
main_window.py — wires everything together: library scan, the game grid,
the per-game detail screen, and the live unlock/lock engine thread.
"""
from __future__ import annotations

import json
import queue
import time
from dataclasses import dataclass
from pathlib import Path

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QSize, Qt, QThread, QTimer, Signal
from PySide6.QtGui import QFont
from PySide6.QtMultimedia import QSoundEffect
from PySide6.QtCore import QUrl
from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit,
    QMainWindow, QMessageBox, QPushButton, QScrollArea, QSizePolicy, QStackedWidget,
    QVBoxLayout, QWidget,
)

from .. import steam_finder, schema_parser, sound
from ..achievement_engine import SteamworksBridge, SteamworksError, UnsupportedGame
from ..cache_manager import CacheManager
from . import theme
from .animations import AnimatedBackground, slide_fade_in, stagger
from .achievement_card import AchievementCardWidget
from .game_card import CARD_W, GameCardWidget

STATS_PATH = Path.home() / ".trophyforge" / "stats.json"


def _load_app_stats() -> dict:
    try:
        return json.loads(STATS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"unlocked_by_app": 0}


def _save_app_stats(stats: dict):
    STATS_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATS_PATH.write_text(json.dumps(stats), encoding="utf-8")


# ---------------------------------------------------------------------------
# Background library scan
# ---------------------------------------------------------------------------

class LibraryScanThread(QThread):
    game_ready = Signal(object)      # GameSchema
    finished_scan = Signal(int)      # total games

    def run(self):
        games = steam_finder.scan_installed_games()
        for g in games:
            try:
                schema = schema_parser.load_schema(g)
            except Exception as e:
                schema = schema_parser.GameSchema(
                    game=g, safety=schema_parser.fetch_game_safety(g.appid), dll_path=None,
                    unsupported_reason=f"scan error: {e}",
                )
            self.game_ready.emit(schema)
        self.finished_scan.emit(len(games))


# ---------------------------------------------------------------------------
# Live per-game engine thread — owns the one Steamworks session for
# whichever game screen is currently open. All ctypes calls happen here,
# never on the UI thread.
# ---------------------------------------------------------------------------

@dataclass
class _Job:
    kind: str          # 'unlock_batch' | 'lock' | 'icon'
    payload: object


class GameEngineThread(QThread):
    ready = Signal(bool, str)                 # ok, reason-if-not
    batch_unlocked = Signal(list, list)        # [AchievementInfo unlocked ok], [api_name failed]
    locked = Signal(str, bool)                 # api_name, ok
    icon_ready = Signal(str, object)           # api_name, (w,h,rgba)-or-None

    def __init__(self, appid: int, dll_path, parent=None):
        super().__init__(parent)
        self.appid = appid
        self.dll_path = dll_path
        self._queue: queue.Queue[_Job | None] = queue.Queue()
        self._bridge: SteamworksBridge | None = None

    def submit(self, job: _Job):
        self._queue.put(job)

    def stop(self):
        self._queue.put(None)

    def run(self):
        try:
            self._bridge = SteamworksBridge(self.appid, self.dll_path)
            self._bridge._init()
        except (SteamworksError, UnsupportedGame) as e:
            self.ready.emit(False, str(e))
            return
        self.ready.emit(True, "")

        while True:
            job = self._queue.get()
            if job is None:
                break
            try:
                self._handle(job)
            except Exception:
                pass

        try:
            self._bridge.shutdown()
        except Exception:
            pass

    def _handle(self, job: _Job):
        if job.kind == "unlock_batch":
            api_names: list[str] = job.payload
            ok_infos, failed = [], []
            for name in api_names:
                try:
                    if self._bridge.unlock(name):
                        ok_infos.append(self._bridge._describe(name))
                    else:
                        failed.append(name)
                except SteamworksError:
                    failed.append(name)
            if ok_infos:
                self._bridge.commit()
            self.batch_unlocked.emit(ok_infos, failed)

        elif job.kind == "lock":
            name = job.payload
            try:
                ok = self._bridge.lock(name)
                if ok:
                    self._bridge.commit()
            except SteamworksError:
                ok = False
            self.locked.emit(name, ok)

        elif job.kind == "icon":
            name = job.payload
            try:
                result = self._bridge.get_achievement_icon_rgba(name, wait=0.6)
            except Exception:
                result = None
            self.icon_ready.emit(name, result)


# ---------------------------------------------------------------------------
# Top stats bar
# ---------------------------------------------------------------------------

class StatsBar(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        row = QHBoxLayout(self)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(28)

        title = QLabel("TROPHY<span style='color:%s'>FORGE</span>" % theme.GOLD)
        title.setTextFormat(Qt.TextFormat.RichText)
        title.setObjectName("h1")
        row.addWidget(title)
        row.addStretch(1)

        self.games_stat = self._stat("GAMES SCANNED", "0")
        self.complete_stat = self._stat("100% COMPLETE", "0")
        self.unlocked_stat = self._stat("UNLOCKED THIS SESSION", "0")
        for w in (self.games_stat, self.complete_stat, self.unlocked_stat):
            row.addWidget(w)

    def _stat(self, label: str, value: str) -> QWidget:
        box = QWidget()
        col = QVBoxLayout(box)
        col.setContentsMargins(0, 0, 0, 0)
        col.setSpacing(0)
        lbl = QLabel(label)
        lbl.setObjectName("statLabel")
        val = QLabel(value)
        val.setObjectName("statValue")
        val.setAlignment(Qt.AlignmentFlag.AlignRight)
        col.addWidget(val)
        col.addWidget(lbl)
        box._value_label = val
        return box

    def update_counts(self, total_games: int, complete_games: int, unlocked_session: int):
        self.games_stat._value_label.setText(str(total_games))
        self.complete_stat._value_label.setText(str(complete_games))
        self.unlocked_stat._value_label.setText(str(unlocked_session))


# ---------------------------------------------------------------------------
# Library screen — the card grid
# ---------------------------------------------------------------------------

class LibraryScreen(QWidget):
    game_opened = Signal(object)  # GameSchema

    def __init__(self, cache: CacheManager, parent=None):
        super().__init__(parent)
        self.cache = cache
        self.schemas: list = []
        self.cards: dict[int, GameCardWidget] = {}
        self._relayout_pending = False

        root = QVBoxLayout(self)
        root.setContentsMargins(28, 20, 28, 20)
        root.setSpacing(16)

        self.stats_bar = StatsBar()
        root.addWidget(self.stats_bar)

        controls = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setObjectName("searchBox")
        self.search.setPlaceholderText("Search your library…")
        self.search.textChanged.connect(self._schedule_relayout)
        controls.addWidget(self.search, stretch=1)

        self.filter_box = QComboBox()
        self.filter_box.addItems(["All games", "Missing achievements", "100% complete", "Unlock supported"])
        self.filter_box.currentIndexChanged.connect(self._schedule_relayout)
        controls.addWidget(self.filter_box)
        root.addLayout(controls)

        self.status_label = QLabel("Scanning your Steam library…")
        self.status_label.setStyleSheet(f"color: {theme.TEXT_DIM};")
        root.addWidget(self.status_label)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.grid_host = QWidget()
        self.grid = QGridLayout(self.grid_host)
        self.grid.setSpacing(16)
        self.grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self.scroll.setWidget(self.grid_host)
        root.addWidget(self.scroll, stretch=1)

    def add_schema(self, schema):
        self.schemas.append(schema)
        card = GameCardWidget(schema, self.cache)
        card.clicked.connect(self.game_opened.emit)
        self.cards[schema.game.appid] = card
        self._schedule_relayout()

    def scan_finished(self, total: int):
        self.status_label.setText(f"{total} games found.")
        QTimer.singleShot(1500, lambda: self.status_label.setText(""))

    def _visible_schemas(self):
        text = self.search.text().strip().lower()
        mode = self.filter_box.currentText()
        out = []
        for s in self.schemas:
            if text and text not in s.game.name.lower():
                continue
            if mode == "Missing achievements" and not (s.total_count and s.unlocked_count < s.total_count):
                continue
            if mode == "100% complete" and not (s.total_count and s.unlocked_count == s.total_count):
                continue
            if mode == "Unlock supported" and not s.can_unlock:
                continue
            out.append(s)
        return out

    def _schedule_relayout(self):
        """Coalesce relayout requests into one pass per event-loop turn.

        _relayout() rebuilds the whole grid, and it was wired directly to
        every trigger: each game the scan thread finds, every keystroke in
        the search box, and every single resizeEvent of a window drag. A
        200-game library therefore rebuilt the grid 200 times during the
        scan, each rebuild touching all 200 cards. Deferring also gets the
        rebuild out of the resize pass, which is where the original crash
        this method's comment describes came from."""
        if self._relayout_pending:
            return
        self._relayout_pending = True
        QTimer.singleShot(30, self._run_relayout)

    def _run_relayout(self):
        self._relayout_pending = False
        self._relayout()

    def _relayout(self):
        # Clear layout *items* only — never detach/reinstall the QGridLayout
        # itself (setParent(None) + setLayout() again). That reparenting
        # dance reproduced a hard native crash the first time this ran,
        # because _relayout() is called from resizeEvent, and a widget's
        # very first resizeEvent fires synchronously inside .show(); mutating
        # the layout's own parentage mid-layout-pass corrupted Qt's internal
        # state. Clearing items via takeAt() is the documented-safe way to
        # rebuild a layout in place.
        while self.grid.count():
            self.grid.takeAt(0)

        # simple responsive column count
        width = max(self.scroll.viewport().width(), CARD_W + 32)
        cols = max(1, width // (CARD_W + 16))

        visible = sorted(self._visible_schemas(), key=lambda s: s.game.name.lower())

        # Hide only what actually dropped out of the filter. Blanket-hiding
        # every card and re-showing it made each rebuild a full hide/show
        # storm across the library, which is both the flicker and a good
        # chunk of the cost.
        wanted = {s.game.appid for s in visible}
        for appid, card in self.cards.items():
            if appid not in wanted:
                card.setVisible(False)

        for i, s in enumerate(visible):
            card = self.cards.get(s.game.appid)
            if card is None:
                continue
            card.setVisible(True)
            r, c = divmod(i, cols)
            self.grid.addWidget(card, r, c)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._schedule_relayout()

    def refresh_stats(self) -> tuple[int, int]:
        total = len(self.schemas)
        complete = sum(1 for s in self.schemas if s.total_count and s.unlocked_count == s.total_count)
        return total, complete


# ---------------------------------------------------------------------------
# Game detail screen
# ---------------------------------------------------------------------------

class GameDetailScreen(QWidget):
    back_requested = Signal()
    achievements_unlocked = Signal(int)  # count, bubbled up for the session counter

    def __init__(self, cache: CacheManager, parent=None):
        super().__init__(parent)
        self.cache = cache
        self.schema = None
        self.engine: GameEngineThread | None = None
        self.cards: dict[str, AchievementCardWidget] = {}
        self.sound_enabled = True
        self._sound = QSoundEffect(self)
        self._pending_infos: list = []
        self._engine_ready = False

        root = QVBoxLayout(self)
        root.setContentsMargins(28, 20, 28, 20)
        root.setSpacing(14)

        header = QHBoxLayout()
        back = QPushButton("←  Library")
        back.setObjectName("ghost")
        back.clicked.connect(self.back_requested.emit)
        header.addWidget(back)
        header.addStretch(1)

        self.sound_toggle = QCheckBox("Unlock sound")
        self.sound_toggle.setChecked(True)
        self.sound_toggle.toggled.connect(lambda v: setattr(self, "sound_enabled", v))
        header.addWidget(self.sound_toggle)
        root.addLayout(header)

        title_row = QHBoxLayout()
        self.title_label = QLabel("")
        self.title_label.setObjectName("h1")
        title_row.addWidget(self.title_label)
        title_row.addStretch(1)
        self.progress_label = QLabel("")
        self.progress_label.setObjectName("h2")
        title_row.addWidget(self.progress_label)
        root.addLayout(title_row)

        self.reason_label = QLabel("")
        self.reason_label.setStyleSheet(f"color: {theme.RED_BAD}; font-size: 12px;")
        root.addWidget(self.reason_label)

        actions = QHBoxLayout()
        self.unlock_selected_btn = QPushButton("Unlock Selected")
        self.unlock_selected_btn.clicked.connect(self._unlock_selected)
        self.unlock_all_btn = QPushButton("Unlock All")
        self.unlock_all_btn.setObjectName("primary")
        self.unlock_all_btn.clicked.connect(self._unlock_all)
        actions.addWidget(self.unlock_selected_btn)
        actions.addWidget(self.unlock_all_btn)
        actions.addStretch(1)
        root.addLayout(actions)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.list_host = QWidget()
        self.list_layout = QVBoxLayout(self.list_host)
        self.list_layout.setSpacing(8)
        self.list_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.scroll.setWidget(self.list_host)
        root.addWidget(self.scroll, stretch=1)

        try:
            QTimer.singleShot(0, self._prep_sound)
        except Exception:
            pass

    def _prep_sound(self):
        wav_path = Path.home() / ".trophyforge" / "cache" / "unlock.wav"
        if not wav_path.exists():
            wav_path.parent.mkdir(parents=True, exist_ok=True)
            sound.write_unlock_chime(wav_path)
        self._sound.setSource(QUrl.fromLocalFile(str(wav_path)))
        self._sound.setVolume(0.5)

    # Rows are built this many at a time, one batch per event-loop turn.
    _BUILD_CHUNK = 25
    # How many unlocks get the full reveal animation before the rest just flip.
    _CELEBRATE_MAX = 12

    def open_game(self, schema):
        self._teardown_engine()
        self.schema = schema
        self.cards.clear()
        self._pending_infos = []
        self._engine_ready = False
        while self.list_layout.count():
            item = self.list_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        self.title_label.setText(schema.game.name)
        self._refresh_progress_label()
        self.reason_label.setText("" if schema.can_unlock else
                                   f"Read-only: {schema.unsupported_reason or schema.safety.reason}")
        self.unlock_selected_btn.setEnabled(schema.can_unlock)
        self.unlock_all_btn.setEnabled(schema.can_unlock and schema.unlocked_count < schema.total_count)

        if schema.can_unlock and schema.dll_path:
            self.engine = GameEngineThread(schema.game.appid, schema.dll_path)
            self.engine.ready.connect(self._on_engine_ready)
            self.engine.batch_unlocked.connect(self._on_batch_unlocked)
            self.engine.icon_ready.connect(self._on_icon_ready)
            self.engine.start()

        # Build the rows in batches instead of all at once. A game with a
        # few hundred achievements used to construct every row — and, back
        # when each row desaturated its own icon pixel by pixel in Python,
        # a few hundred thousand QColor round-trips — inside this one
        # synchronous loop, with the UI thread unable to paint until it
        # finished. That is the long "loading" the list appeared to do.
        #
        # The per-card fade_in() is gone as well: it installed a
        # QGraphicsOpacityEffect on every row and started at opacity 0, so
        # the rows the layout had already shown were blanked and then faded
        # back in one by one — the "achievements appear, then vanish". Every
        # one of those effects also forces its row to be composited through
        # an offscreen pixmap on each repaint, for the whole list, forever.
        self._pending_infos = sorted(schema.achievements, key=lambda a: a.unlocked)
        self._build_next_chunk()

    def _build_next_chunk(self):
        chunk = self._pending_infos[: self._BUILD_CHUNK]
        self._pending_infos = self._pending_infos[self._BUILD_CHUNK :]
        for info in chunk:
            card = AchievementCardWidget(info)
            card.set_multiselect(True)
            card.icon_needed.connect(self._request_icon)
            self.cards[info.api_name] = card
            self.list_layout.addWidget(card)
        if self._pending_infos:
            QTimer.singleShot(0, self._build_next_chunk)
        else:
            self._maybe_request_icons()

    def closeEvent(self, event):
        self._teardown_engine()
        super().closeEvent(event)

    def leave(self):
        self._teardown_engine()

    def _teardown_engine(self):
        self._engine_ready = False
        if self.engine is not None:
            self.engine.stop()
            self.engine.wait(2000)
            self.engine = None

    def _on_engine_ready(self, ok: bool, reason: str):
        if not ok:
            self.reason_label.setText(f"Engine unavailable: {reason}")
            self.unlock_selected_btn.setEnabled(False)
            self.unlock_all_btn.setEnabled(False)
            return
        self._engine_ready = True
        self._maybe_request_icons()

    def _maybe_request_icons(self):
        """Queue every icon on the engine thread and let the results arrive
        as signals.

        The old path handed each card a fetch function that a QThreadPool
        worker called, and that function connected to the engine's
        icon_ready signal, submitted a job, then blocked its worker for up
        to 2.5 seconds waiting. The engine drains its queue serially, so N
        icons meant N blocking waits stacked behind each other while the
        global thread pool — the same pool the library uses for cover art —
        sat there full of parked workers. Nothing needed to block: the
        engine already emits the result."""
        if not self._engine_ready or self._pending_infos or self.engine is None:
            return
        for api_name in self.cards:
            self.engine.submit(_Job("icon", api_name))

    def _request_icon(self, api_name: str):
        if self._engine_ready and self.engine is not None:
            self.engine.submit(_Job("icon", api_name))

    def _on_icon_ready(self, api_name: str, result):
        card = self.cards.get(api_name)
        if card is not None:
            card.set_icon_rgba(result)

    # -- unlocking ----------------------------------------------------------

    def _unlock_selected(self):
        names = [name for name, c in self.cards.items() if not c.info.unlocked and c.is_checked()]
        if not names:
            QMessageBox.information(self, "TrophyForge", "Check a few locked achievements first.")
            return
        self._submit_unlock(names)

    def _unlock_all(self):
        names = [name for name, c in self.cards.items() if not c.info.unlocked]
        if not names:
            return
        self._submit_unlock(names)

    def _submit_unlock(self, names: list[str]):
        if self.engine is None:
            return
        self.unlock_selected_btn.setEnabled(False)
        self.unlock_all_btn.setEnabled(False)
        self.engine.submit(_Job("unlock_batch", names))

    def _on_batch_unlocked(self, ok_infos: list, failed: list):
        self.unlock_selected_btn.setEnabled(self.schema.can_unlock)
        self.unlock_all_btn.setEnabled(self.schema.can_unlock)

        # Only the first few get the flip-and-confetti treatment. "Unlock
        # All" on a 200-achievement game would otherwise queue 200 reveals
        # 180ms apart — a full minute of cascade, each step spawning a
        # confetti overlay with its own 16ms repaint timer.
        reveals = []
        for i, info in enumerate(ok_infos):
            card = self.cards.get(info.api_name)
            if card is None:
                continue
            if i >= self._CELEBRATE_MAX:
                card.apply_unlocked(info)
                continue

            def do_reveal(card=card, info=info):
                card.play_unlock_animation(info)
                if self.sound_enabled:
                    self._sound.play()

            reveals.append(do_reveal)

        stagger(reveals, interval_ms=180)

        for info in ok_infos:
            for a in self.schema.achievements:
                if a.api_name == info.api_name:
                    a.unlocked = True
        if ok_infos:
            self.achievements_unlocked.emit(len(ok_infos))

        QTimer.singleShot(len(reveals) * 180 + 500, self._refresh_progress_label)

        if failed:
            QMessageBox.warning(self, "TrophyForge",
                                 f"{len(failed)} achievement(s) could not be set:\n" + ", ".join(failed[:10]))

    def _refresh_progress_label(self):
        s = self.schema
        self.progress_label.setText(f"{s.unlocked_count} / {s.total_count} unlocked")
        self.unlock_all_btn.setEnabled(s.can_unlock and s.unlocked_count < s.total_count)


# ---------------------------------------------------------------------------
# Main window
# ---------------------------------------------------------------------------

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("TrophyForge")
        self.resize(1180, 800)
        self.setMinimumSize(860, 600)

        self.cache = CacheManager()
        self.app_stats = _load_app_stats()
        self.session_unlocked = 0

        self.bg = AnimatedBackground(self)
        self.setCentralWidget(self.bg)
        outer = QVBoxLayout(self.bg)
        outer.setContentsMargins(0, 0, 0, 0)

        self.stack = QStackedWidget()
        outer.addWidget(self.stack)

        self.library = LibraryScreen(self.cache)
        self.library.game_opened.connect(self._open_game)
        self.stack.addWidget(self.library)

        self.detail = GameDetailScreen(self.cache)
        self.detail.back_requested.connect(self._back_to_library)
        self.detail.achievements_unlocked.connect(self._on_session_unlock)
        self.stack.addWidget(self.detail)

        self.scan_thread = LibraryScanThread()
        self.scan_thread.game_ready.connect(self._on_game_ready)
        self.scan_thread.finished_scan.connect(self._on_scan_finished)
        # Deliberately not started here: loading steam_api64.dll via ctypes
        # from a background thread while the window's very first show/paint
        # is happening on the main thread reproduced a hard native crash
        # during development (0xC0000005) — almost certainly Windows'
        # per-process loader lock, held during DLL-load/thread-attach
        # notifications, contending with whatever the first paint cycle
        # touches. Starting the scan only once the event loop is already
        # idling sidesteps that window entirely.
        QTimer.singleShot(150, self.scan_thread.start)

    def _on_game_ready(self, schema):
        self.library.add_schema(schema)
        total, complete = self.library.refresh_stats()
        self.library.stats_bar.update_counts(total, complete, self.session_unlocked)

    def _on_scan_finished(self, total: int):
        self.library.scan_finished(total)

    def _open_game(self, schema):
        self.detail.open_game(schema)
        self.stack.setCurrentWidget(self.detail)
        slide_fade_in(self.detail)

    def _back_to_library(self):
        self.detail.leave()
        self.stack.setCurrentWidget(self.library)
        slide_fade_in(self.library)
        total, complete = self.library.refresh_stats()
        self.library.stats_bar.update_counts(total, complete, self.session_unlocked)
        for appid, card in self.library.cards.items():
            card.refresh_progress()

    def _on_session_unlock(self, count: int):
        self.session_unlocked += count
        self.app_stats["unlocked_by_app"] = self.app_stats.get("unlocked_by_app", 0) + count
        _save_app_stats(self.app_stats)
        total, complete = self.library.refresh_stats()
        self.library.stats_bar.update_counts(total, complete, self.session_unlocked)

    def closeEvent(self, event):
        self.detail.leave()
        if self.scan_thread.isRunning():
            self.scan_thread.terminate()
            self.scan_thread.wait(500)
        super().closeEvent(event)
