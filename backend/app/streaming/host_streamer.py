"""
Real-Time Host Log Streamer
============================
Continuously monitors OS log files and emits new lines as events on the event bus.

Strategy (in priority order):
  Linux/macOS  →  asyncio subprocess `tail -f`  (lowest latency, ~0ms)
  Linux/macOS  →  watchdog FileSystemObserver   (fallback if tail unavailable)
  Windows      →  win32evtlog + threading       (Windows Event Log subscription)
  All          →  async polling fallback        (stat-based, 2s interval)

Each new log line is:
  1. Parsed (severity, IP, timestamp) using existing host_log_collector helpers.
  2. Persisted to SQLite via LogService.create_log().
  3. Published to the event bus so WebSocket clients receive it instantly.
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import re
import subprocess
import threading
from datetime import datetime
from typing import Dict, List, Optional

from app.collectors.host_log_collector import _classify_severity, _extract_ip, _parse_syslog_ts
from app.streaming.event_bus import publish

logger = logging.getLogger("soc_dashboard.host_streamer")

# ── File sources by OS ─────────────────────────────────────────────────────────
_LINUX_SOURCES = [
    ("/var/log/syslog",   "System/Syslog"),
    ("/var/log/auth.log", "Auth/SSH"),
    ("/var/log/kern.log", "Kernel"),
    ("/var/log/ufw.log",  "Firewall/UFW"),
]
_MACOS_SOURCES = [
    ("/var/log/system.log", "System/macOS"),
]


def _build_event(line: str, source: str) -> Dict:
    line = line.strip()
    if not line:
        return {}
    return {
        "event_type": "host_log",
        "source":     source,
        "severity":   _classify_severity(line),
        "message":    line[:500],
        "raw_data":   line,
        "ip_address": _extract_ip(line),
        "timestamp":  _parse_syslog_ts(line).isoformat(),
    }


# ── Strategy 1: asyncio tail -f (Linux / macOS) ────────────────────────────────

async def _tail_file(path: str, source: str) -> None:
    """Continuously read new lines from a file using `tail -f`."""
    if not os.path.isfile(path):
        logger.debug("tail-f: %s not found, skipping.", path)
        return

    logger.info("Starting tail -f on %s (%s)", path, source)
    proc = await asyncio.create_subprocess_exec(
        "tail", "-F", "-n", "0", path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        while True:
            line_bytes = await proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace")
            event = _build_event(line, source)
            if event:
                await publish(event)
                await _persist_event(event)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            proc.terminate()
        except ProcessLookupError:
            pass


# ── Strategy 2: watchdog observer (cross-platform fallback) ───────────────────

class _LogFileHandler:
    """Watchdog event handler that reads appended lines from a log file."""

    def __init__(self, path: str, source: str, loop: asyncio.AbstractEventLoop):
        self.path   = path
        self.source = source
        self.loop   = loop
        self._pos   = os.path.getsize(path) if os.path.isfile(path) else 0

    def on_modified(self, event=None):  # noqa: compatible with watchdog API
        try:
            with open(self.path, "r", errors="replace") as f:
                f.seek(self._pos)
                new_lines = f.read()
                self._pos = f.tell()
            for line in new_lines.splitlines():
                ev = _build_event(line, self.source)
                if ev:
                    asyncio.run_coroutine_threadsafe(publish(ev),        self.loop)
                    asyncio.run_coroutine_threadsafe(_persist_event(ev), self.loop)
        except (PermissionError, FileNotFoundError):
            pass


def _start_watchdog(sources: List[tuple]) -> None:
    """Start a watchdog observer in a background thread."""
    try:
        from watchdog.observers import Observer
        from watchdog.events   import FileSystemEventHandler, FileModifiedEvent

        class _Handler(FileSystemEventHandler):
            def __init__(self, handler: _LogFileHandler):
                self._h = handler
            def on_modified(self, event):
                if event.src_path == self._h.path:
                    self._h.on_modified()

        loop = asyncio.get_event_loop()
        observer = Observer()
        for path, label in sources:
            if not os.path.isfile(path):
                continue
            h = _LogFileHandler(path, label, loop)
            observer.schedule(_Handler(h), os.path.dirname(path), recursive=False)
            logger.info("watchdog monitoring %s (%s)", path, label)
        observer.start()
    except ImportError:
        logger.warning("watchdog not installed — using poll fallback.")


# ── Strategy 3: Windows Event Log subscription ────────────────────────────────

async def _windows_event_streamer() -> None:
    """
    Poll Windows Event Log channels every 2 s for new Security / System events.
    Requires pywin32 (`pip install pywin32`).
    """
    try:
        import win32evtlog
        import win32evtlogutil
        import win32con
    except ImportError:
        logger.warning("pywin32 not installed — Windows event streaming disabled.")
        return

    channels = ["Security", "System", "Application"]
    handles  = {}
    for ch in channels:
        try:
            handles[ch] = win32evtlog.OpenEventLog(None, ch)
        except Exception:
            pass

    logger.info("Windows Event Log streamer started for: %s", channels)
    flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

    while True:
        for ch, handle in handles.items():
            try:
                records = win32evtlog.ReadEventLog(handle, flags, 0)
                for rec in records:
                    msg = win32evtlogutil.SafeFormatMessage(rec, ch)
                    event = _build_event(f"{ch}: {msg}", f"WinEvt/{ch}")
                    if event:
                        await publish(event)
                        await _persist_event(event)
            except Exception:
                pass
        await asyncio.sleep(2)


# ── macOS Unified Log streaming ───────────────────────────────────────────────

async def _macos_log_streamer() -> None:
    """Stream macOS unified log via `log stream` subprocess."""
    logger.info("Starting macOS unified log stream.")
    proc = await asyncio.create_subprocess_exec(
        "log", "stream", "--style", "syslog", "--level", "default",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        while True:
            line_bytes = await proc.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode("utf-8", errors="replace")
            event = _build_event(line, "System/macOS-Unified")
            if event:
                await publish(event)
                await _persist_event(event)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            proc.terminate()
        except ProcessLookupError:
            pass


# ── Polling fallback ───────────────────────────────────────────────────────────

async def _poll_file(path: str, source: str, interval: float = 2.0) -> None:
    """Read newly appended lines by tracking file position (stat-based)."""
    pos = os.path.getsize(path) if os.path.isfile(path) else 0
    logger.info("Poll-fallback watching %s (%s)", path, source)
    while True:
        await asyncio.sleep(interval)
        if not os.path.isfile(path):
            continue
        try:
            size = os.path.getsize(path)
            if size <= pos:
                if size < pos:
                    pos = 0   # file rotated
                continue
            with open(path, "r", errors="replace") as f:
                f.seek(pos)
                new_text = f.read()
                pos = f.tell()
            for line in new_text.splitlines():
                ev = _build_event(line, source)
                if ev:
                    await publish(ev)
                    await _persist_event(ev)
        except (PermissionError, OSError):
            pass


# ── DB persistence helper ─────────────────────────────────────────────────────

async def _persist_event(event: Dict) -> None:
    """Insert a streamed log event into the SQLite database."""
    try:
        from app.models.log_model import LogCreate
        from app.services.log_service import LogService
        svc = LogService()
        log = LogCreate(
            source     = event.get("source", "Unknown"),
            severity   = event.get("severity", "info"),
            message    = event.get("message", ""),
            raw_data   = event.get("raw_data"),
            ip_address = event.get("ip_address"),
            timestamp  = datetime.fromisoformat(event["timestamp"]) if event.get("timestamp") else datetime.now(),
        )
        await svc.create_log(log)
    except Exception as exc:
        logger.debug("DB persist error (non-fatal): %s", exc)


# ── Public entry point ─────────────────────────────────────────────────────────

async def start_host_streaming() -> None:
    """
    Launch all appropriate host log streamers for the current OS.
    Runs as background async tasks — never returns.
    """
    system = platform.system()
    tasks  = []

    if system == "Linux":
        # Check if tail is available
        has_tail = subprocess.run(["which", "tail"], capture_output=True).returncode == 0
        if has_tail:
            for path, label in _LINUX_SOURCES:
                tasks.append(asyncio.create_task(_tail_file(path, label)))
        else:
            # watchdog or poll fallback
            try:
                import watchdog  # noqa
                _start_watchdog(_LINUX_SOURCES)
            except ImportError:
                for path, label in _LINUX_SOURCES:
                    tasks.append(asyncio.create_task(_poll_file(path, label)))

    elif system == "Darwin":
        tasks.append(asyncio.create_task(_macos_log_streamer()))
        # Also poll file-based sources as supplement
        for path, label in _MACOS_SOURCES:
            tasks.append(asyncio.create_task(_poll_file(path, label)))

    elif system == "Windows":
        tasks.append(asyncio.create_task(_windows_event_streamer()))

    if not tasks:
        logger.warning("No host log streaming tasks could be started on this OS (%s).", system)
        return

    logger.info("Host log streaming started: %d task(s).", len(tasks))
    await asyncio.gather(*tasks, return_exceptions=True)
