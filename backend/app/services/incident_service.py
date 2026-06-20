"""
Incident Service — real incidents + working update + analyst notes + CSV export.
"""
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import csv, io

from app.models.incident_model import IncidentCreate, IncidentUpdate, IncidentResponse

_SEEDED_INCIDENTS: List[IncidentResponse] = [
    IncidentResponse(id=1, title="APT Campaign: Multi-Vector Attack from 45.22.11.9",
        description="Coordinated attack chain: SSH brute force → DNS tunneling → lateral movement. Three alerts correlated to same IP within 53-minute window. Consistent with APT-style intrusion.",
        severity="critical", incident_type="apt_campaign", status="open",
        created_at=datetime.now()-timedelta(minutes=8)),
    IncidentResponse(id=2, title="Active RDP Intrusion Attempt from 92.118.160.11",
        description="375 failed RDP logins. Likely automated credential stuffing targeting port 3389. Geolocation: Eastern Europe. IP on 3 threat intel feeds.",
        severity="critical", incident_type="brute_force", status="investigating",
        created_at=datetime.now()-timedelta(minutes=67)),
    IncidentResponse(id=3, title="Suspected Data Exfiltration: Host 10.0.0.5",
        description="2.3GB outbound transfer to unknown external IP. Possible insider threat or compromised endpoint.",
        severity="high", incident_type="data_exfiltration", status="open",
        created_at=datetime.now()-timedelta(minutes=31)),
    IncidentResponse(id=4, title="Malware C2 Communication Confirmed",
        description="Known C2 beacon pattern from internal host. EDR flagged process injection. Host should be isolated pending forensics.",
        severity="critical", incident_type="malware_infection", status="investigating",
        created_at=datetime.now()-timedelta(minutes=22)),
    IncidentResponse(id=5, title="Tor Exit Node Connection — Possible Evasion",
        description="Internal host 10.0.0.7 connected to Tor exit node. Could be policy violation or attacker using Tor for anonymised C2.",
        severity="high", incident_type="network_anomaly", status="open",
        created_at=datetime.now()-timedelta(minutes=150)),
]

_LIVE_INCIDENTS: List[IncidentResponse] = []
_next_id = len(_SEEDED_INCIDENTS) + 1

# Per-incident analyst notes: {incident_id: [{"author","note","ts"}]}
_INCIDENT_NOTES: Dict[int, List[dict]] = {}


def _all() -> List[IncidentResponse]:
    return _LIVE_INCIDENTS + _SEEDED_INCIDENTS


class IncidentService:
    async def get_incidents(self, skip=0, limit=50, status=None, severity=None) -> List[IncidentResponse]:
        res = _all()
        if status:   res = [i for i in res if i.status   == status.lower()]
        if severity: res = [i for i in res if i.severity == severity.lower()]
        return res[skip: skip + limit]

    async def get_incident_by_id(self, incident_id: int) -> Optional[IncidentResponse]:
        return next((i for i in _all() if i.id == incident_id), None)

    async def create_incident(self, incident: IncidentCreate) -> IncidentResponse:
        global _next_id
        data = incident.dict(exclude={"related_alert_ids"})
        inc = IncidentResponse(id=_next_id, **data, created_at=datetime.now())
        _LIVE_INCIDENTS.insert(0, inc)
        _next_id += 1
        return inc

    async def update_incident(self, incident_id: int, upd: IncidentUpdate) -> Optional[IncidentResponse]:
        """FIX: actually mutates the stored incident."""
        for lst in (_LIVE_INCIDENTS, _SEEDED_INCIDENTS):
            for i, inc in enumerate(lst):
                if inc.id == incident_id:
                    d = inc.dict()
                    for k, v in upd.dict(exclude_unset=True).items():
                        if v is not None:
                            d[k] = v
                    d["updated_at"] = datetime.now()
                    if d.get("status") == "resolved":
                        d["resolved_at"] = datetime.now()
                    lst[i] = IncidentResponse(**d)
                    return lst[i]
        return None

    async def add_note(self, incident_id: int, author: str, note: str) -> dict:
        """Add an analyst investigation note to an incident."""
        entry = {"author": author, "note": note, "timestamp": datetime.now().isoformat()}
        if incident_id not in _INCIDENT_NOTES:
            _INCIDENT_NOTES[incident_id] = []
        _INCIDENT_NOTES[incident_id].insert(0, entry)
        return entry

    async def get_notes(self, incident_id: int) -> List[dict]:
        return _INCIDENT_NOTES.get(incident_id, [])

    async def correlate_incident(self, incident_id: int) -> dict:
        from app.services.alert_service import _all_alerts
        inc = await self.get_incident_by_id(incident_id)
        if not inc:
            return {}
        import re
        ip_match = re.search(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b", inc.title)
        target_ip = ip_match.group(1) if ip_match else None
        related_alerts = [a for a in _all_alerts() if a.ip_address == target_ip] if target_ip else []

        score = 0.5; ai_analysis = []; attack_pattern = []
        if any(a.alert_type == "auth_failure"    for a in related_alerts):
            score += 0.15; ai_analysis.append({"rule":"Multiple Auth Failures","weight":"+0.15"}); attack_pattern.append("Initial Access (Brute Force)")
        if any(a.alert_type == "network_anomaly" for a in related_alerts):
            score += 0.10; ai_analysis.append({"rule":"Network Anomaly Pattern","weight":"+0.10"}); attack_pattern.append("Network Recon")
        if any(a.alert_type == "malware"         for a in related_alerts):
            score += 0.20; ai_analysis.append({"rule":"Malware Signature Match","weight":"+0.20"}); attack_pattern.append("Execution")
        if any(a.alert_type == "data_exfil"      for a in related_alerts):
            score += 0.15; ai_analysis.append({"rule":"Exfiltration Indicators","weight":"+0.15"}); attack_pattern.append("Exfiltration")
        if len(set(a.source for a in related_alerts)) >= 2:
            score += 0.10; ai_analysis.append({"rule":"Multi-Source Cross-Vector","weight":"+0.10"}); attack_pattern.append("Multi-Vector Campaign")
        if not ai_analysis:
            ai_analysis = [{"rule":"Heuristic Behaviour Match","weight":"+0.50"}]
            attack_pattern = ["Suspicious Activity"]

        timeline = []
        for a in sorted(related_alerts, key=lambda x: x.created_at):
            timeline.append({"type":"alert","title":a.title,"description":a.description,
                             "timestamp":a.created_at.isoformat(),"severity":a.severity})
        timeline.append({"type":"incident","title":"Incident Created","description":inc.description,
                         "timestamp":inc.created_at.isoformat(),"severity":inc.severity})

        return {
            "incident_id": incident_id, "target_ip": target_ip or "Multiple",
            "related_alerts": [a.id for a in related_alerts],
            "correlation_score": min(score, 0.99),
            "attack_pattern": attack_pattern,
            "ai_analysis": ai_analysis,
            "timeline": timeline,
            "notes": _INCIDENT_NOTES.get(incident_id, []),
        }

    async def get_incident_statistics(self) -> dict:
        incs = _all()
        return {
            "total_incidents": len(incs),
            "open_incidents":  len([i for i in incs if i.status=="open"]),
            "in_progress":     len([i for i in incs if i.status=="investigating"]),
            "resolved":        len([i for i in incs if i.status=="resolved"]),
            "by_severity": {
                "critical": len([i for i in incs if i.severity=="critical"]),
                "high":     len([i for i in incs if i.severity=="high"]),
                "medium":   len([i for i in incs if i.severity=="medium"]),
            },
        }

    async def export_csv(self) -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id","title","severity","incident_type","status","assigned_to","created_at","description"])
        for i in _all():
            w.writerow([i.id, i.title, i.severity, i.incident_type, i.status,
                        i.assigned_to or "", i.created_at.isoformat(), i.description])
        return buf.getvalue()


MOCK_INCIDENTS = _SEEDED_INCIDENTS
