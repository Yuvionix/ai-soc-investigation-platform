"""
Real-Time Network Packet Sniffer
==================================
Captures live packets and emits structured events to the event bus.

Libraries (in preference order):
  1. Scapy  — cross-platform, richest parsing, requires root/cap_net_raw
  2. pyshark — uses tshark subprocess, no raw-socket privilege needed on some distros
  3. macOS  — `netstat -an` + `nettop` polling (no root needed)
  4. /proc/net poll — Linux-only pure-Python fallback
  5. ss snapshot — Linux socket state fallback

Threat Detection (stateful, per source-IP):
  - Port scan      : >=15 unique dst-ports from same src-IP in 60s  → WARNING
  - DDoS / flood   : >=200 packets from same src-IP in 10s          → CRITICAL
  - Brute force    : >=10 SYN packets to port 22/3389 in 30s        → ERROR
  - DNS exfil      : >50 DNS queries/min from same src              → WARNING
"""

from __future__ import annotations

import asyncio
import collections
import logging
import platform
import re
import subprocess
import time
from datetime import datetime
from typing import Dict, List, Optional

from app.streaming.event_bus import publish

logger = logging.getLogger("soc_dashboard.packet_sniffer")

# ── Threat detection state ────────────────────────────────────────────────────
_port_scan_tracker:  Dict[str, set]   = collections.defaultdict(set)
_port_scan_ts:       Dict[str, float] = {}
_flood_tracker:      Dict[str, int]   = collections.defaultdict(int)
_flood_ts:           Dict[str, float] = {}
_brute_tracker:      Dict[str, int]   = collections.defaultdict(int)
_brute_ts:           Dict[str, float] = {}
_dns_tracker:        Dict[str, int]   = collections.defaultdict(int)
_dns_ts:             Dict[str, float] = {}

_SCAN_WINDOW  = 60;  _SCAN_THRESH  = 15
_FLOOD_WINDOW = 10;  _FLOOD_THRESH = 200
_BRUTE_WINDOW = 30;  _BRUTE_THRESH = 10
_DNS_WINDOW   = 60;  _DNS_THRESH   = 50


def _detect_threats(src_ip: str, dst_port: int,
                    protocol: str, flags: str = "") -> Optional[Dict]:
    now = time.time()

    # Port scan
    if now - _port_scan_ts.get(src_ip, 0) > _SCAN_WINDOW:
        _port_scan_tracker[src_ip] = set()
        _port_scan_ts[src_ip] = now
    _port_scan_tracker[src_ip].add(dst_port)
    if len(_port_scan_tracker[src_ip]) >= _SCAN_THRESH:
        _port_scan_tracker[src_ip] = set()
        return {"event_type":"threat","threat_type":"port_scan","severity":"warning",
                "source":"Network/PacketSniffer","ip_address":src_ip,
                "message":f"Port scan detected from {src_ip}: {_SCAN_THRESH}+ unique ports",
                "timestamp":datetime.now().isoformat()}

    # DDoS flood
    if now - _flood_ts.get(src_ip, 0) > _FLOOD_WINDOW:
        _flood_tracker[src_ip] = 0; _flood_ts[src_ip] = now
    _flood_tracker[src_ip] += 1
    if _flood_tracker[src_ip] >= _FLOOD_THRESH:
        _flood_tracker[src_ip] = 0
        return {"event_type":"threat","threat_type":"ddos","severity":"critical",
                "source":"Network/PacketSniffer","ip_address":src_ip,
                "message":f"DDoS/flood from {src_ip}: {_FLOOD_THRESH}+ pkts in {_FLOOD_WINDOW}s",
                "timestamp":datetime.now().isoformat()}

    # Brute force SSH/RDP
    if dst_port in (22, 3389) and "S" in flags:
        if now - _brute_ts.get(src_ip, 0) > _BRUTE_WINDOW:
            _brute_tracker[src_ip] = 0; _brute_ts[src_ip] = now
        _brute_tracker[src_ip] += 1
        if _brute_tracker[src_ip] >= _BRUTE_THRESH:
            _brute_tracker[src_ip] = 0
            svc = "SSH" if dst_port == 22 else "RDP"
            return {"event_type":"threat","threat_type":"brute_force","severity":"error",
                    "source":"Network/PacketSniffer","ip_address":src_ip,
                    "message":f"Brute-force on {svc} from {src_ip}",
                    "timestamp":datetime.now().isoformat()}

    # DNS exfil
    if protocol == "DNS":
        if now - _dns_ts.get(src_ip, 0) > _DNS_WINDOW:
            _dns_tracker[src_ip] = 0; _dns_ts[src_ip] = now
        _dns_tracker[src_ip] += 1
        if _dns_tracker[src_ip] >= _DNS_THRESH:
            _dns_tracker[src_ip] = 0
            return {"event_type":"threat","threat_type":"dns_exfil","severity":"warning",
                    "source":"Network/PacketSniffer","ip_address":src_ip,
                    "message":f"DNS exfiltration from {src_ip}: {_DNS_THRESH}+ queries/min",
                    "timestamp":datetime.now().isoformat()}
    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_packet_event(proto, src_ip, dst_ip, dst_port, flags="", dns_query="") -> Dict:
    return {
        "event_type": "packet",
        "type":       "packet",
        "source":     "Network/LiveCapture",
        "severity":   "info",
        "protocol":   proto,
        "src_ip":     src_ip,
        "dst_ip":     dst_ip,
        "dst_port":   dst_port,
        "flags":      flags,
        "dns_query":  dns_query,
        "ip_address": src_ip,
        "message":    f"{proto} {src_ip} → {dst_ip}:{dst_port}" + (f" [{dns_query}]" if dns_query else ""),
        "timestamp":  datetime.now().isoformat(),
    }


async def _persist_threat(threat: Dict) -> None:
    try:
        from app.models.log_model import LogCreate
        from app.services.log_service import LogService
        await LogService().create_log(LogCreate(
            source=threat.get("source","Network/Threat"),
            severity=threat.get("severity","warning"),
            message=threat.get("message",""),
            ip_address=threat.get("ip_address"),
            timestamp=datetime.fromisoformat(threat["timestamp"]) if threat.get("timestamp") else datetime.now(),
        ))
    except Exception as e:
        logger.debug("Threat persist error: %s", e)


# ── Strategy 1: Scapy ─────────────────────────────────────────────────────────

def _scapy_callback(loop):
    def callback(pkt):
        try:
            from scapy.all import IP, TCP, UDP, DNS
            if not pkt.haslayer(IP): return
            src_ip = pkt[IP].src; dst_ip = pkt[IP].dst
            proto = "OTHER"; dst_port = 0; flags = ""; dns_query = ""
            if pkt.haslayer(DNS):
                proto = "DNS"
                try: dns_query = pkt[DNS].qd.qname.decode("utf-8","replace").rstrip(".")
                except: pass
            elif pkt.haslayer(TCP):
                proto = "TCP"; dst_port = pkt[TCP].dport; flags = str(pkt[TCP].flags)
            elif pkt.haslayer(UDP):
                proto = "UDP"; dst_port = pkt[UDP].dport
            ev = _make_packet_event(proto, src_ip, dst_ip, dst_port, flags, dns_query)
            asyncio.run_coroutine_threadsafe(publish(ev), loop)
            threat = _detect_threats(src_ip, dst_port, proto, flags)
            if threat:
                asyncio.run_coroutine_threadsafe(publish(threat), loop)
                asyncio.run_coroutine_threadsafe(_persist_threat(threat), loop)
        except Exception: pass
    return callback

async def _run_scapy() -> None:
    from scapy.all import sniff
    loop = asyncio.get_event_loop()
    logger.info("Scapy live capture started.")
    await loop.run_in_executor(None, lambda: sniff(prn=_scapy_callback(loop), store=False, filter="ip"))


# ── Strategy 2: PyShark ───────────────────────────────────────────────────────

async def _run_pyshark() -> None:
    import pyshark
    loop = asyncio.get_event_loop()
    capture = pyshark.LiveCapture(display_filter="ip")
    logger.info("PyShark live capture started.")
    def _on(pkt):
        try:
            src_ip = str(getattr(pkt.ip,"src",""))
            dst_ip = str(getattr(pkt.ip,"dst",""))
            proto  = pkt.highest_layer; dst_port = 0; flags = ""; dns_query = ""
            if hasattr(pkt,"tcp"):
                dst_port = int(getattr(pkt.tcp,"dstport",0)); flags = str(getattr(pkt.tcp,"flags",""))
            elif hasattr(pkt,"udp"):
                dst_port = int(getattr(pkt.udp,"dstport",0))
            if hasattr(pkt,"dns"): dns_query = str(getattr(pkt.dns,"qry_name",""))
            ev = _make_packet_event(proto, src_ip, dst_ip, dst_port, flags, dns_query)
            asyncio.run_coroutine_threadsafe(publish(ev), loop)
            threat = _detect_threats(src_ip, dst_port, proto, flags)
            if threat:
                asyncio.run_coroutine_threadsafe(publish(threat), loop)
                asyncio.run_coroutine_threadsafe(_persist_threat(threat), loop)
        except Exception: pass
    await loop.run_in_executor(None, lambda: capture.apply_on_packets(_on))


# ── Strategy 3: macOS netstat polling (NO ROOT NEEDED) ───────────────────────

_NETSTAT_RE = re.compile(
    r"^(tcp[46]?|udp[46]?)\s+\d+\s+\d+\s+"
    r"([\d\.]+|[\da-f:]+)\.(\d+)\s+"        # local addr.port
    r"([\d\.]+|[\da-f:]+)\.(\*|\d+)\s+"     # remote addr.port
    r"(\w+)?",                               # state
    re.IGNORECASE
)

async def _macos_netstat_monitor(interval: float = 2.0) -> None:
    """
    Poll `netstat -an` on macOS every interval seconds.
    Emits one packet event per NEW connection seen.
    No root required.
    """
    logger.info("macOS netstat monitor started (no root required).")
    seen: set = set()

    while True:
        await asyncio.sleep(interval)
        try:
            result = subprocess.run(
                ["netstat", "-an", "-p", "tcp"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                m = _NETSTAT_RE.match(line.strip())
                if not m: continue
                proto_raw = m.group(1).upper()
                proto     = "TCP" if "TCP" in proto_raw else "UDP"
                local_ip  = m.group(2); local_port  = m.group(3)
                remote_ip = m.group(4); remote_port = m.group(5)
                state     = (m.group(6) or "").upper()

                # Skip loopback and unconnected
                if remote_ip in ("*", "0.0.0.0", "127.0.0.1", "::1", "localhost"): continue
                # Skip link-local and private loopback ranges
                if remote_ip.startswith("169.254."): continue
                if state in ("LISTEN", "CLOSED", ""): continue

                key = f"{proto}:{local_ip}:{local_port}:{remote_ip}:{remote_port}"
                if key in seen: continue
                seen.add(key)

                try: dst_port = int(remote_port)
                except: dst_port = 0

                ev = _make_packet_event(proto, local_ip, remote_ip, dst_port)
                ev["flags"] = state
                await publish(ev)

                threat = _detect_threats(local_ip, dst_port, proto)
                if threat:
                    await publish(threat)
                    await _persist_threat(threat)

            # Trim seen set
            if len(seen) > 10000:
                seen = set(list(seen)[-4000:])

        except (subprocess.TimeoutExpired, Exception) as e:
            logger.debug("netstat error: %s", e)


async def _macos_dns_monitor(interval: float = 3.0) -> None:
    """
    Poll `nslookup` / parse mDNSResponder via `log stream` filtered for DNS.
    Lightweight: uses `log show` for recent DNS activity.
    """
    logger.info("macOS DNS activity monitor started.")
    seen: set = set()
    while True:
        await asyncio.sleep(interval)
        try:
            result = subprocess.run(
                ["log", "show", "--last", "10s",
                 "--predicate", "process == \"mDNSResponder\" OR process == \"dns-sd\"",
                 "--style", "compact"],
                capture_output=True, text=True, timeout=8
            )
            for line in result.stdout.splitlines():
                if not line.strip() or line.startswith("Filtering"): continue
                key = line[:100]
                if key in seen: continue
                seen.add(key)
                ip_match = re.search(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b", line)
                src_ip = ip_match.group(1) if ip_match else "127.0.0.1"
                domain_match = re.search(r"for\s+([\w\.\-]+\.\w+)", line)
                dns_query = domain_match.group(1) if domain_match else ""
                # Filter loopback DNS noise (mDNSResponder internal)
                if src_ip in ("127.0.0.1", "0.0.0.0", "::1"):
                    continue
                if not dns_query:
                    continue
                ev = _make_packet_event("DNS", src_ip, "DNS", 53, "", dns_query)
                await publish(ev)
            if len(seen) > 5000:
                seen = set(list(seen)[-2000:])
        except Exception as e:
            logger.debug("DNS monitor error: %s", e)


# ── Strategy 4: Linux /proc/net ───────────────────────────────────────────────

async def _linux_proc_net_monitor(interval: float = 2.0) -> None:
    """Linux-only: poll /proc/net/tcp for new connections."""
    logger.info("/proc/net monitor started (Linux fallback).")
    from app.collectors.network_log_collector import _collect_proc_net, _collect_ss
    seen: set = set()
    while True:
        await asyncio.sleep(interval)
        entries = _collect_proc_net("tcp") + _collect_ss()
        for entry in entries:
            key = entry["message"][:80]
            if key in seen: continue
            seen.add(key)
            ev = {
                "event_type":"packet","type":"packet",
                "source":entry["source"],"severity":entry["severity"],
                "protocol":"TCP","src_ip":entry.get("ip_address",""),
                "dst_ip":"","dst_port":0,"flags":"","dns_query":"",
                "message":entry["message"],
                "ip_address":entry.get("ip_address"),
                "timestamp":datetime.now().isoformat(),
            }
            await publish(ev)
        if len(seen) > 5000:
            seen = set(list(seen)[-2000:])


# ── Public entry point ────────────────────────────────────────────────────────

async def start_packet_sniffing() -> None:
    """
    Start live packet capture using the best available method for the current OS.
    Graceful fallback chain — never crashes the backend.
    """
    system = platform.system()

    # ── Try Scapy first (all platforms, needs root) ────────────────────────
    try:
        import scapy  # noqa
        logger.info("Attempting Scapy live capture...")
        await _run_scapy()
        return
    except ImportError:
        logger.info("Scapy not installed.")
    except PermissionError:
        logger.warning("Scapy needs root/cap_net_raw. Trying next option.")
    except Exception as e:
        logger.warning("Scapy failed: %s", e)

    # ── Try PyShark (needs tshark installed) ──────────────────────────────
    try:
        import pyshark  # noqa
        logger.info("Attempting PyShark capture...")
        await _run_pyshark()
        return
    except ImportError:
        logger.info("PyShark not installed.")
    except Exception as e:
        logger.warning("PyShark failed: %s", e)

    # ── macOS fallback: netstat + DNS monitor (NO ROOT) ───────────────────
    if system == "Darwin":
        logger.info(
            "Using macOS netstat monitor (no root required). "
            "Install scapy + run with sudo for full packet capture."
        )
        await asyncio.gather(
            _macos_netstat_monitor(),
            _macos_dns_monitor(),
            return_exceptions=True,
        )
        return

    # ── Linux fallback: /proc/net ──────────────────────────────────────────
    if system == "Linux":
        logger.info("Using Linux /proc/net fallback.")
        await _linux_proc_net_monitor()
        return

    logger.warning("No network monitoring available on %s.", system)
