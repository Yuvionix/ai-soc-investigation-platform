"""
Evidence Parser
================
Parses uploaded files (JSON, CSV, TXT, SOC exports) into a
normalised list of security events that the AI engine can analyse.
"""

import csv
import json
import io
import re
from datetime import datetime
from typing import List, Dict, Optional


# ── Regex helpers ─────────────────────────────────────────────────────────────
_IP_RE   = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
_PORT_RE = re.compile(r'\b(?:port[s]?[\s:=]+)([\d,\s]+)', re.IGNORECASE)
_TS_RE   = re.compile(
    r'\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?)\b'
    r'|(\d{2}:\d{2}(?::\d{2})?)'
)

# Keywords → internal alert_type
_TYPE_KEYWORDS = [
    (["port scan", "port_scan", "portscan", "nmap"],          "port_scan"),
    (["brute force", "brute_force", "bruteforce"],            "brute_force"),
    (["ssh", "authentication failure", "auth fail"],          "ssh_brute"),
    (["malware", "virus", "trojan", "ransomware", "exploit"], "malware"),
    (["exfil", "data transfer", "outbound"],                  "data_exfil"),
    (["dns tunnel", "dns exfil"],                             "dns_exfil"),
    (["ddos", "dos attack", "flood"],                         "ddos"),
    (["lateral movement", "lateral_movement"],                "lateral_movement"),
    (["c2", "command and control", "beacon"],                 "c2"),
    (["persistence", "backdoor", "create account"],           "persistence"),
    (["login success", "successful login", "authenticated"],  "successful_login"),
    (["file access", "file read", "open file"],               "file_access"),
    (["scan", "discovery", "enumerat"],                       "network_scan"),
    (["anomal", "unusual", "suspicious traffic"],             "network_anomaly"),
]

_SEVERITY_KEYWORDS = {
    "critical": ["critical", "emergency", "emerg", "alert"],
    "high":     ["high", "error", "err", "failed", "failure"],
    "medium":   ["medium", "warning", "warn"],
    "low":      ["low", "info", "notice"],
}


def _classify_type(text: str) -> str:
    lower = text.lower()
    for keywords, atype in _TYPE_KEYWORDS:
        if any(k in lower for k in keywords):
            return atype
    return "network_anomaly"


def _classify_severity(text: str) -> str:
    lower = text.lower()
    for sev, keywords in _SEVERITY_KEYWORDS.items():
        if any(k in lower for k in keywords):
            return sev
    return "low"


def _extract_ips(text: str) -> List[str]:
    return list(set(_IP_RE.findall(text)))


def _extract_timestamp(text: str) -> Optional[str]:
    m = _TS_RE.search(text)
    if m:
        return m.group(1) or m.group(2)
    return None


def _normalise_event(raw: dict, source_label: str = "upload") -> dict:
    """Convert any dict into the normalised event schema."""
    text = " ".join(str(v) for v in raw.values())
    ips  = _extract_ips(text)
    return {
        "alert_type": raw.get("alert_type") or raw.get("type") or raw.get("event_type") or _classify_type(text),
        "severity":   raw.get("severity") or _classify_severity(text),
        "source_ip":  raw.get("source_ip") or raw.get("ip_address") or raw.get("src_ip") or (ips[0] if ips else None),
        "target_ip":  raw.get("target_ip") or raw.get("dst_ip") or (ips[1] if len(ips) > 1 else None),
        "timestamp":  raw.get("timestamp") or raw.get("created_at") or raw.get("time") or _extract_timestamp(text),
        "message":    raw.get("message") or raw.get("description") or raw.get("title") or text[:300],
        "source":     raw.get("source") or source_label,
        "raw":        raw,
    }


# ── File-type parsers ─────────────────────────────────────────────────────────

def parse_json(content: str) -> List[dict]:
    data = json.loads(content)
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        # SOC export: {"events": [...], "alerts": [...], "incidents": [...]}
        items = (
            data.get("events") or data.get("alerts") or
            data.get("incidents") or data.get("logs") or [data]
        )
    else:
        items = [{"message": str(data)}]
    return [_normalise_event(i if isinstance(i, dict) else {"message": str(i)}) for i in items]


def parse_csv(content: str) -> List[dict]:
    reader = csv.DictReader(io.StringIO(content))
    events = []
    for row in reader:
        events.append(_normalise_event(dict(row), "csv_upload"))
    return events


def parse_txt(content: str) -> List[dict]:
    events = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Try JSON line
        try:
            obj = json.loads(line)
            events.append(_normalise_event(obj, "txt_upload"))
            continue
        except (json.JSONDecodeError, ValueError):
            pass
        # Plain text line
        events.append({
            "alert_type": _classify_type(line),
            "severity":   _classify_severity(line),
            "source_ip":  _extract_ips(line)[0] if _extract_ips(line) else None,
            "target_ip":  _extract_ips(line)[1] if len(_extract_ips(line)) > 1 else None,
            "timestamp":  _extract_timestamp(line),
            "message":    line[:500],
            "source":     "txt_upload",
            "raw":        {"line": line},
        })
    return events


def parse_evidence(filename: str, content: str) -> List[dict]:
    """
    Entry point. Detects file type and returns a list of normalised events.
    """
    ext = filename.lower().rsplit(".", 1)[-1]
    try:
        if ext == "json":
            return parse_json(content)
        elif ext == "csv":
            return parse_csv(content)
        elif ext in ("txt", "log"):
            return parse_txt(content)
        else:
            # Try JSON first, then TXT
            try:
                return parse_json(content)
            except Exception:
                return parse_txt(content)
    except Exception as exc:
        # Always return something usable
        return [{
            "alert_type": "network_anomaly",
            "severity":   "low",
            "source_ip":  None,
            "target_ip":  None,
            "timestamp":  None,
            "message":    f"Parse error ({exc}). Raw content preview: {content[:200]}",
            "source":     "parse_error",
            "raw":        {},
        }]


def summarise_events(events: List[dict]) -> dict:
    """Build a summary dict used by AI prompts."""
    attack_types = list(dict.fromkeys(e["alert_type"] for e in events if e.get("alert_type")))
    source_ips   = list(dict.fromkeys(e["source_ip"]  for e in events if e.get("source_ip")))
    target_ips   = list(dict.fromkeys(e["target_ip"]  for e in events if e.get("target_ip")))
    severities   = [e["severity"] for e in events if e.get("severity")]
    timestamps   = sorted([e["timestamp"] for e in events if e.get("timestamp")])

    sev_priority = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    top_severity = max(severities, key=lambda s: sev_priority.get(s, 0), default="low")

    timeline = ""
    if timestamps:
        timeline = f"{timestamps[0]} → {timestamps[-1]}" if len(timestamps) > 1 else timestamps[0]

    return {
        "attack_types": attack_types,
        "source_ips":   source_ips,
        "target_ips":   target_ips,
        "severity":     top_severity,
        "timeline":     timeline,
        "event_count":  len(events),
        "events_text":  "\n".join(
            f"{e.get('timestamp','?')}  [{e['severity'].upper():8}]  {e['alert_type']:20}  "
            f"{e.get('source_ip','?')} → {e.get('target_ip','?')}  {e['message'][:80]}"
            for e in events
        ),
    }
