"""
Host Log Collector
Reads real system logs from the host OS:
  - /var/log/syslog or /var/log/messages  (system events)
  - /var/log/auth.log or /var/log/secure  (auth / SSH events)
  - /var/log/kern.log                     (kernel events)
  - journald via `journalctl`             (systemd hosts)
  - Windows Event Log via `wevtutil`      (Windows hosts)

Each raw log line is parsed into a normalised dict:
  { source, severity, message, raw_data, ip_address, timestamp }
"""

import os
import re
import platform
import subprocess
from datetime import datetime, timedelta
from typing import List, Dict, Optional


# ── Severity keyword mapping ──────────────────────────────────────────────────
_SEV_KEYWORDS = {
    "critical": ["critical", "emerg", "panic", "fatal", "crit"],
    "error":    ["error", "err", "failed", "failure", "denied", "refused",
                 "exception", "abort", "segfault", "oops"],
    "warning":  ["warn", "warning", "invalid", "suspicious", "unauthorized",
                 "timeout", "retry", "deprecated", "skipping"],
    "info":     ["info", "notice", "accepted", "started", "stopped",
                 "connected", "opened", "loaded", "initialized"],
}

_IP_RE = re.compile(
    r"\b(?:from|src|source|address|for|rhost)[=:\s]+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\b"
    r"|(?<!\d)([0-9]{1,3}(?:\.[0-9]{1,3}){3})(?!\d)",
    re.IGNORECASE,
)


def _classify_severity(line: str) -> str:
    lower = line.lower()
    for sev, keywords in _SEV_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return sev
    return "info"


def _extract_ip(line: str) -> Optional[str]:
    m = _IP_RE.search(line)
    if m:
        candidate = m.group(1) or m.group(2)
        # Filter out obvious non-routable false-positives like version numbers
        parts = candidate.split(".")
        if all(0 <= int(p) <= 255 for p in parts):
            return candidate
    return None


def _parse_syslog_ts(line: str) -> datetime:
    """Try to parse leading timestamp from a syslog line; fall back to now()."""
    # Standard syslog: 'Jan  5 12:34:56 hostname ...'
    m = re.match(r"^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})", line)
    if m:
        year = datetime.now().year
        try:
            dt = datetime.strptime(f"{year} {m.group(1)}", "%Y %b %d %H:%M:%S")
            if dt > datetime.now() + timedelta(days=1):
                dt = dt.replace(year=year - 1)
            return dt
        except ValueError:
            pass

    # ISO-8601: '2026-05-24T10:23:45' or with offset
    m2 = re.match(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})", line)
    if m2:
        try:
            return datetime.fromisoformat(m2.group(1))
        except ValueError:
            pass

    return datetime.now()


def _parse_line(line: str, source_label: str) -> Dict:
    line = line.strip()
    return {
        "source":     source_label,
        "severity":   _classify_severity(line),
        "message":    line[:500],
        "raw_data":   line,
        "ip_address": _extract_ip(line),
        "timestamp":  _parse_syslog_ts(line),
    }


# ── Per-source readers ────────────────────────────────────────────────────────

def _read_file_tail(path: str, max_lines: int = 500) -> List[str]:
    """Read last N lines of a log file without external tools."""
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", errors="replace") as f:
            lines = f.readlines()
        return lines[-max_lines:]
    except PermissionError:
        return []


def _collect_file(path: str, source_label: str, max_lines: int = 300) -> List[Dict]:
    return [
        _parse_line(l, source_label)
        for l in _read_file_tail(path, max_lines)
        if l.strip()
    ]


def _collect_journald(unit_filter: Optional[str] = None,
                      since_hours: int = 24,
                      max_lines: int = 300) -> List[Dict]:
    """Collect systemd journal entries via journalctl."""
    cmd = [
        "journalctl", "--no-pager",
        "-n", str(max_lines),
        f"--since={since_hours} hours ago",
        "-o", "short-iso",
    ]
    if unit_filter:
        cmd += ["-u", unit_filter]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return [
            _parse_line(l, unit_filter or "System/Journald")
            for l in result.stdout.splitlines()
            if l.strip()
        ]
    except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
        return []


def _collect_windows_event_log(log_name: str = "System",
                                max_events: int = 200) -> List[Dict]:
    """Collect Windows Event Log entries via wevtutil."""
    cmd = [
        "wevtutil", "qe", log_name,
        f"/count:{max_events}", "/rd:true", "/f:text",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        entries, current = [], []
        for line in result.stdout.splitlines():
            if line.startswith("Event["):
                if current:
                    text = " | ".join(current)
                    entries.append(_parse_line(text, f"WinEvt/{log_name}"))
                current = []
            else:
                current.append(line.strip())
        return entries
    except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
        return []


# ── Public API ────────────────────────────────────────────────────────────────

def collect_host_logs(max_per_source: int = 300) -> List[Dict]:
    """
    Collect real host logs from the current OS.
    Returns a list of normalised log dicts sorted newest-first.
    """
    logs: List[Dict] = []
    system = platform.system()

    if system == "Linux":
        # Syslog / messages
        for path, label in [
            ("/var/log/syslog",   "System/Syslog"),
            ("/var/log/messages", "System/Messages"),
        ]:
            logs += _collect_file(path, label, max_per_source)

        # Auth / SSH
        for path, label in [
            ("/var/log/auth.log", "Auth/SSH"),
            ("/var/log/secure",   "Auth/Secure"),
        ]:
            logs += _collect_file(path, label, max_per_source)

        # Kernel
        logs += _collect_file("/var/log/kern.log", "Kernel", max_per_source)

        # journald (supplement / fallback)
        logs += _collect_journald(since_hours=24, max_lines=max_per_source)

        # Common application logs
        for path, label in [
            ("/var/log/nginx/error.log",   "WebServer/Nginx"),
            ("/var/log/apache2/error.log", "WebServer/Apache"),
            ("/var/log/mysql/error.log",   "Database/MySQL"),
            ("/var/log/postgresql/postgresql-*.log", "Database/PostgreSQL"),
        ]:
            logs += _collect_file(path, label, 100)

    elif system == "Darwin":
        logs += _collect_file("/var/log/system.log", "System/macOS", max_per_source)
        logs += _collect_journald(since_hours=24, max_lines=max_per_source)

    elif system == "Windows":
        for log_name in ["System", "Security", "Application"]:
            logs += _collect_windows_event_log(log_name, max_events=max_per_source)

    # Deduplicate by (timestamp-minute, message prefix)
    seen: set = set()
    unique: List[Dict] = []
    for entry in logs:
        key = (entry["timestamp"].strftime("%Y%m%d%H%M"), entry["message"][:80])
        if key not in seen:
            seen.add(key)
            unique.append(entry)

    unique.sort(key=lambda x: x["timestamp"], reverse=True)
    return unique
