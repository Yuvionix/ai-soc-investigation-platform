"""
Network Log Collector
Reads real network data from the host:
  - /proc/net/tcp  /proc/net/tcp6   (active TCP connections)
  - /proc/net/udp  /proc/net/udp6   (active UDP connections)
  - iptables / nftables log         (/var/log/iptables.log, /var/log/ufw.log, kern.log)
  - `ss` / `netstat` live snapshot
  - /var/log/ufw.log                (UFW firewall)
  - /var/log/firewalld              (firewalld)
  - Windows netsh / firewall log    (Windows)

Each entry is normalised to:
  { source, severity, message, raw_data, ip_address, timestamp }
"""

import os
import re
import subprocess
import platform
from datetime import datetime
from typing import List, Dict, Optional


_IP_RE = re.compile(
    r"\b([0-9]{1,3}(?:\.[0-9]{1,3}){3})\b"
)

_PORT_RE = re.compile(r":(\d{1,5})\b")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_network_severity(line: str) -> str:
    lower = line.lower()
    if any(k in lower for k in ["drop", "reject", "block", "deny", "attack",
                                 "flood", "scan", "spoof", "exploit"]):
        return "warning"
    if any(k in lower for k in ["error", "fail", "refused", "reset", "invalid",
                                 "malformed", "forbidden"]):
        return "error"
    if any(k in lower for k in ["critical", "emerg", "crit", "panic"]):
        return "critical"
    return "info"


def _extract_ip(line: str) -> Optional[str]:
    """Return the first non-loopback IP found in a line."""
    for m in _IP_RE.finditer(line):
        ip = m.group(1)
        parts = ip.split(".")
        if all(0 <= int(p) <= 255 for p in parts) and ip not in ("127.0.0.1", "0.0.0.0"):
            return ip
    return None


def _now() -> datetime:
    return datetime.now()


def _make_entry(source: str, severity: str, message: str,
                raw: str, ip: Optional[str] = None,
                ts: Optional[datetime] = None) -> Dict:
    return {
        "source":     source,
        "severity":   severity,
        "message":    message[:500],
        "raw_data":   raw,
        "ip_address": ip,
        "timestamp":  ts or _now(),
    }


# ── /proc/net readers ─────────────────────────────────────────────────────────

def _hex_to_ip(hex_addr: str) -> str:
    """Convert kernel little-endian hex address to dotted-decimal IP."""
    try:
        addr = int(hex_addr, 16)
        return ".".join(str((addr >> (8 * i)) & 0xFF) for i in range(4))
    except ValueError:
        return hex_addr


def _hex_to_port(hex_port: str) -> int:
    try:
        return int(hex_port, 16)
    except ValueError:
        return 0


_TCP_STATES = {
    "01": "ESTABLISHED", "02": "SYN_SENT",  "03": "SYN_RECV",
    "04": "FIN_WAIT1",   "05": "FIN_WAIT2", "06": "TIME_WAIT",
    "07": "CLOSE",       "08": "CLOSE_WAIT","09": "LAST_ACK",
    "0A": "LISTEN",      "0B": "CLOSING",
}


def _collect_proc_net(proto: str = "tcp") -> List[Dict]:
    """
    Parse /proc/net/tcp (or udp) for active connections.
    Returns one log entry per non-loopback connection.
    """
    path = f"/proc/net/{proto}"
    if not os.path.exists(path):
        return []
    entries = []
    try:
        with open(path, "r") as f:
            lines = f.readlines()[1:]  # skip header

        for line in lines:
            parts = line.split()
            if len(parts) < 4:
                continue
            local_hex, remote_hex = parts[1], parts[2]
            state_hex = parts[3]

            local_ip, local_port = local_hex.split(":")
            remote_ip, remote_port = remote_hex.split(":")

            lip = _hex_to_ip(local_ip)
            rip = _hex_to_ip(remote_ip)
            lport = _hex_to_port(local_port)
            rport = _hex_to_port(remote_port)
            state = _TCP_STATES.get(state_hex.upper(), state_hex)

            # Skip pure loopback & unconnected
            if rip in ("0.0.0.0", "127.0.0.1") and state != "LISTEN":
                continue

            severity = "info"
            if state in ("SYN_RECV", "SYN_SENT") and rip not in ("0.0.0.0",):
                severity = "warning"

            msg = (f"{proto.upper()} {state}: {lip}:{lport} → {rip}:{rport}")
            raw = line.strip()
            entries.append(_make_entry(
                source=f"Network/{proto.upper()}",
                severity=severity,
                message=msg,
                raw=raw,
                ip=rip if rip not in ("0.0.0.0",) else lip,
            ))
    except (PermissionError, FileNotFoundError):
        pass
    return entries


# ── `ss` snapshot ─────────────────────────────────────────────────────────────

def _collect_ss() -> List[Dict]:
    """Run `ss -tunp` and parse established / listening sockets."""
    try:
        result = subprocess.run(
            ["ss", "-tunp", "--no-header"],
            capture_output=True, text=True, timeout=8,
        )
        entries = []
        for line in result.stdout.splitlines():
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 5:
                continue
            proto = parts[0]
            state = parts[1]
            local = parts[4]
            peer  = parts[5] if len(parts) > 5 else "*"

            ip = _extract_ip(peer) or _extract_ip(local)
            severity = "warning" if state in ("SYN-RECV",) else "info"
            msg = f"{proto} {state}: local={local} peer={peer}"
            entries.append(_make_entry(
                source="Network/SocketState",
                severity=severity,
                message=msg,
                raw=line.strip(),
                ip=ip,
            ))
        return entries
    except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
        return []


# ── Firewall / UFW log readers ────────────────────────────────────────────────

def _collect_firewall_file(path: str, source_label: str, max_lines: int = 300) -> List[Dict]:
    """Parse UFW / iptables / firewalld log lines."""
    if not os.path.isfile(path):
        return []
    entries = []
    try:
        with open(path, "r", errors="replace") as f:
            lines = f.readlines()[-max_lines:]
        for line in lines:
            line = line.strip()
            if not line:
                continue
            ip = _extract_ip(line)
            sev = _classify_network_severity(line)

            # Extract timestamp from syslog-format line
            ts_match = re.match(r"^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})", line)
            if ts_match:
                try:
                    year = datetime.now().year
                    ts = datetime.strptime(f"{year} {ts_match.group(1)}", "%Y %b %d %H:%M:%S")
                except ValueError:
                    ts = _now()
            else:
                ts = _now()

            # Build a clean message
            msg_match = re.search(r"UFW\s+(BLOCK|ALLOW|AUDIT)[^\]]*\]\s*(.*)", line, re.IGNORECASE)
            if msg_match:
                action = msg_match.group(1).upper()
                detail = msg_match.group(2)
                sev = "warning" if action == "BLOCK" else "info"
                msg = f"Firewall {action}: {detail[:200]}"
            else:
                msg = line[:300]

            entries.append(_make_entry(source_label, sev, msg, line, ip, ts))
    except PermissionError:
        pass
    return entries


# ── Windows netsh firewall log ────────────────────────────────────────────────

def _collect_windows_firewall_log() -> List[Dict]:
    """Read Windows Firewall log (pfirewall.log)."""
    win_log = r"C:\Windows\System32\LogFiles\Firewall\pfirewall.log"
    entries = []
    if not os.path.isfile(win_log):
        return entries
    try:
        with open(win_log, "r", errors="replace") as f:
            lines = f.readlines()[-300:]
        for line in lines:
            line = line.strip()
            if line.startswith("#") or not line:
                continue
            parts = line.split()
            # Format: date time action protocol src-ip dst-ip src-port dst-port ...
            if len(parts) < 5:
                continue
            try:
                ts = datetime.strptime(f"{parts[0]} {parts[1]}", "%Y-%m-%d %H:%M:%S")
            except ValueError:
                ts = _now()
            action = parts[2] if len(parts) > 2 else "UNKNOWN"
            src_ip = parts[4] if len(parts) > 4 else None
            sev = "warning" if action.upper() in ("DROP", "DENY") else "info"
            msg = f"WinFirewall {action}: {' '.join(parts[3:])[:200]}"
            entries.append(_make_entry("Network/WinFirewall", sev, msg, line, src_ip, ts))
    except PermissionError:
        pass
    return entries


# ── Public API ────────────────────────────────────────────────────────────────

def collect_network_logs(max_per_source: int = 300) -> List[Dict]:
    """
    Collect real network logs and connection states from the current host.
    Returns a list of normalised log dicts sorted newest-first.
    """
    logs: List[Dict] = []
    system = platform.system()

    if system in ("Linux", "Darwin"):
        # /proc/net (Linux only)
        if system == "Linux":
            for proto in ("tcp", "tcp6", "udp", "udp6"):
                logs += _collect_proc_net(proto)

        # ss socket snapshot
        logs += _collect_ss()

        # UFW firewall
        for path, label in [
            ("/var/log/ufw.log",             "Firewall/UFW"),
            ("/var/log/iptables.log",        "Firewall/iptables"),
            ("/var/log/firewalld",           "Firewall/firewalld"),
        ]:
            logs += _collect_firewall_file(path, label, max_per_source)

        # kern.log often contains netfilter / iptables drops
        logs += _collect_firewall_file("/var/log/kern.log", "Kernel/Netfilter", 200)

    elif system == "Windows":
        logs += _collect_windows_firewall_log()

    # Deduplicate
    seen: set = set()
    unique: List[Dict] = []
    for entry in logs:
        key = (entry["timestamp"].strftime("%Y%m%d%H%M"), entry["message"][:80])
        if key not in seen:
            seen.add(key)
            unique.append(entry)

    unique.sort(key=lambda x: x["timestamp"], reverse=True)
    return unique
