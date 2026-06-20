"""
Audit Log
=========
Records who performed which action on which record, with a timestamp.
ADDED to close a gap identified during red-team review: previously, no
record existed of which analyst changed an alert/incident status, escalated
an alert, or exported data — the feedback table records analyst notes but
not these account-level actions.

Implementation: append-only, file-based JSON-lines log under data/audit/,
independent of the main SQLite database so a compromised DB connection
cannot retroactively erase the audit trail without separate file access.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("soc_dashboard.audit")

_AUDIT_DIR  = Path("./data/audit")
_AUDIT_FILE = _AUDIT_DIR / "audit_log.jsonl"


def _ensure_dir() -> None:
    _AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def record_action(
    actor:        str,
    action:       str,
    resource_type: str,
    resource_id:  Optional[int] = None,
    details:      Optional[dict] = None,
) -> None:
    """
    Append an audit entry. Never raises — audit logging must not be able
    to break the calling request if the filesystem is briefly unavailable.

    Example:
        record_action("admin", "status_change", "alert", 13,
                      {"from": "open", "to": "investigating"})
    """
    try:
        _ensure_dir()
        entry = {
            "timestamp":      datetime.utcnow().isoformat() + "Z",
            "actor":          actor,
            "action":         action,
            "resource_type":  resource_type,
            "resource_id":    resource_id,
            "details":        details or {},
        }
        with open(_AUDIT_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as exc:
        # Audit logging is best-effort; a failure here must not break the
        # underlying analyst action.
        logger.warning("Audit log write failed: %s", exc)


def read_recent(limit: int = 100) -> list:
    """Return the most recent audit entries, newest first."""
    if not _AUDIT_FILE.exists():
        return []
    try:
        with open(_AUDIT_FILE, "r") as f:
            lines = f.readlines()
        entries = [json.loads(line) for line in lines[-limit:] if line.strip()]
        return list(reversed(entries))
    except Exception as exc:
        logger.warning("Audit log read failed: %s", exc)
        return []
