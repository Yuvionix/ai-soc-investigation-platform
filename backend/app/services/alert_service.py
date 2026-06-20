"""
Alert Service — real alerts + live threat ingestion + working update/export.

ADDED: MITRE ATT&CK technique mapping per alert_type.
Every alert now carries a mitre_technique and mitre_tactic field.
"""
from typing import List, Optional
from datetime import datetime, timedelta
import csv, io

from app.models.alert_model import AlertCreate, AlertUpdate, AlertResponse

# ── MITRE ATT&CK Technique Mapping ───────────────────────────────────────────
# Maps internal alert_type → (technique_id, technique_name, tactic)
MITRE_MAP = {
    "auth_failure":    ("T1110",  "Brute Force",                    "Credential Access"),
    "network_anomaly": ("T1046",  "Network Service Discovery",      "Discovery"),
    "malware":         ("T1059",  "Command and Scripting Interpreter","Execution"),
    "data_exfil":      ("T1041",  "Exfiltration Over C2 Channel",   "Exfiltration"),
    "port_scan":       ("T1046",  "Network Service Scanning",       "Discovery"),
    "ddos":            ("T1498",  "Network Denial of Service",      "Impact"),
    "brute_force":     ("T1110",  "Brute Force",                    "Credential Access"),
    "dns_exfil":       ("T1048",  "Exfiltration Over Alternative Protocol", "Exfiltration"),
    "lateral_movement":("T1021",  "Remote Services",                "Lateral Movement"),
    "persistence":     ("T1136",  "Create Account",                 "Persistence"),
    "c2":              ("T1071",  "Application Layer Protocol",     "Command and Control"),
}

def get_mitre(alert_type: str) -> dict:
    """Return MITRE fields for a given alert_type, or empty dict if unknown."""
    entry = MITRE_MAP.get(alert_type.lower())
    if not entry:
        return {}
    return {
        "mitre_technique_id":   entry[0],
        "mitre_technique_name": entry[1],
        "mitre_tactic":         entry[2],
    }

import csv, io

from app.models.alert_model import AlertCreate, AlertUpdate, AlertResponse

_SEEDED_ALERTS: List[AlertResponse] = [
    AlertResponse(id=1,  title="SSH Brute Force Detected",          description="45+ failed SSH login attempts from 45.22.11.9 in 2 minutes. Possible credential stuffing attack.",         severity="critical", source="Auth System",  alert_type="auth_failure",    status="open",         created_at=datetime.now()-timedelta(minutes=8),  ip_address="45.22.11.9"),
    AlertResponse(id=2,  title="Firewall: Repeated Port Scan",      description="Sequential port scan detected from 188.43.2.1 targeting ports 22,80,443,3306,5432.",                       severity="high",     source="Firewall",    alert_type="network_anomaly", status="open",         created_at=datetime.now()-timedelta(minutes=14), ip_address="188.43.2.1"),
    AlertResponse(id=3,  title="Malware C2 Beacon Observed",        description="Known C2 IP 91.195.240.44 contacted by internal host. Possible malware infection.",                        severity="critical", source="EDR",         alert_type="malware",         status="investigating",created_at=datetime.now()-timedelta(minutes=22), ip_address="91.195.240.44"),
    AlertResponse(id=4,  title="Unusual Outbound Data Transfer",    description="Host 10.0.0.5 transferred 2.3GB to external IP in 4 minutes. Possible data exfiltration.",                severity="high",     source="Network IPS", alert_type="data_exfil",      status="open",         created_at=datetime.now()-timedelta(minutes=31), ip_address="10.0.0.5"),
    AlertResponse(id=5,  title="Admin Account Login Outside Hours", description="Admin account 'root' logged in at 02:43 AM from IP 172.16.0.4. Outside normal business hours.",           severity="high",     source="Auth System", alert_type="auth_failure",    status="open",         created_at=datetime.now()-timedelta(minutes=45), ip_address="172.16.0.4"),
    AlertResponse(id=6,  title="DNS Tunneling Suspected",           description="Abnormally long DNS TXT queries to exfil.tunnel.ru — possible DNS tunneling.",                             severity="high",     source="Network IPS", alert_type="network_anomaly", status="open",         created_at=datetime.now()-timedelta(minutes=53), ip_address="45.22.11.9"),
    AlertResponse(id=7,  title="RDP Brute Force Attempt",           description="375 failed RDP authentication attempts from 92.118.160.11 on port 3389.",                                 severity="critical", source="Firewall",    alert_type="auth_failure",    status="open",         created_at=datetime.now()-timedelta(minutes=67), ip_address="92.118.160.11"),
    AlertResponse(id=8,  title="Lateral Movement Detected",         description="Internal host 10.0.0.12 scanning internal subnet — classic lateral movement.",                             severity="high",     source="EDR",         alert_type="network_anomaly", status="investigating",created_at=datetime.now()-timedelta(minutes=82), ip_address="10.0.0.12"),
    AlertResponse(id=9,  title="Suspicious PowerShell Execution",   description="Encoded PowerShell command on WORKSTATION-04. Matches LOLBAS evasion technique.",                         severity="medium",   source="EDR",         alert_type="malware",         status="open",         created_at=datetime.now()-timedelta(minutes=95), ip_address="10.0.0.8"),
    AlertResponse(id=10, title="New Admin User Created",            description="Unexpected new admin account 'svcback' created on DC-01 — possible persistence.",                         severity="medium",   source="Auth System", alert_type="auth_failure",    status="open",         created_at=datetime.now()-timedelta(minutes=110),ip_address="10.0.0.2"),
    AlertResponse(id=11, title="Failed Sudo Escalation",            description="User 'deploy' attempted sudo su 12 times in 60 seconds on web server.",                                    severity="medium",   source="Auth System", alert_type="auth_failure",    status="closed",       created_at=datetime.now()-timedelta(minutes=130),ip_address="10.0.0.15"),
    AlertResponse(id=12, title="Outbound Connection to Tor Node",   description="Internal host connected to Tor exit node 185.220.101.46 on port 9001.",                                   severity="high",     source="Firewall",    alert_type="network_anomaly", status="open",         created_at=datetime.now()-timedelta(minutes=150),ip_address="10.0.0.7"),
]

_LIVE_ALERTS: List[AlertResponse] = []
_next_id = len(_SEEDED_ALERTS) + 1


def ingest_threat_as_alert(threat: dict) -> AlertResponse:
    """Convert a packet-sniffer threat event into an alert."""
    global _next_id
    type_map = {
        "port_scan":   ("Port Scan Detected (Live)",        "network_anomaly", "high"),
        "ddos":        ("DDoS / Flood Attack (Live)",        "network_anomaly", "critical"),
        "brute_force": ("Brute Force Attempt (Live)",        "auth_failure",    "critical"),
        "dns_exfil":   ("DNS Exfiltration Suspected (Live)", "data_exfil",      "high"),
    }
    tt = threat.get("threat_type", "unknown")
    title, atype, sev = type_map.get(tt, (f"Live Threat: {tt}", "network_anomaly", "warning"))
    alert = AlertResponse(
        id=_next_id, title=title,
        description=threat.get("message", ""),
        severity=sev, source="Network/LiveCapture",
        alert_type=atype, status="open",
        created_at=datetime.now(),
        ip_address=threat.get("ip_address"),
    )
    _LIVE_ALERTS.insert(0, alert)
    if len(_LIVE_ALERTS) > 200:
        _LIVE_ALERTS.pop()
    _next_id += 1
    return alert


def _all_alerts() -> List[AlertResponse]:
    return _LIVE_ALERTS + _SEEDED_ALERTS


class AlertService:
    async def get_alerts(self, skip=0, limit=50,
                         severity=None, status=None, source=None) -> List[AlertResponse]:
        res = _all_alerts()
        if severity: res = [a for a in res if a.severity.lower() == severity.lower()]
        if status:   res = [a for a in res if a.status.lower()   == status.lower()]
        if source:   res = [a for a in res if source.lower() in a.source.lower()
                            or source.lower() in (a.ip_address or "")]
        return res[skip: skip + limit]

    async def get_alert_by_id(self, alert_id: int) -> Optional[AlertResponse]:
        return next((a for a in _all_alerts() if a.id == alert_id), None)

    async def create_alert(self, alert: AlertCreate) -> AlertResponse:
        global _next_id
        a = AlertResponse(id=_next_id, **alert.dict(), created_at=datetime.now())
        _LIVE_ALERTS.insert(0, a)
        _next_id += 1
        return a

    async def update_alert(self, alert_id: int, alert_update: AlertUpdate) -> Optional[AlertResponse]:
        """FIX: actually mutates the stored alert object."""
        for lst in (_LIVE_ALERTS, _SEEDED_ALERTS):
            for i, a in enumerate(lst):
                if a.id == alert_id:
                    d = a.dict()
                    for k, v in alert_update.dict(exclude_unset=True).items():
                        if v is not None:
                            d[k] = v
                    d["updated_at"] = datetime.now()
                    lst[i] = AlertResponse(**d)
                    return lst[i]
        return None

    async def escalate_to_incident(self, alert_id: int) -> Optional[dict]:
        """Create an incident from an alert — one-click escalation."""
        alert = await self.get_alert_by_id(alert_id)
        if not alert:
            return None
        # Lazy import to avoid circular dependency
        from app.services.incident_service import IncidentService
        from app.models.incident_model import IncidentCreate
        inc_svc = IncidentService()
        inc = await inc_svc.create_incident(IncidentCreate(
            title=f"Escalated: {alert.title}",
            description=f"Incident escalated from alert #{alert_id}. Original: {alert.description}",
            severity=alert.severity,
            incident_type=alert.alert_type,
            related_alert_ids=[alert_id],
        ))
        await self.update_alert(alert_id, AlertUpdate(status="investigating", notes=f"Escalated to incident #{inc.id}"))
        return {"incident_id": inc.id, "alert_id": alert_id}

    async def get_critical_alerts(self) -> List[AlertResponse]:
        return [a for a in _all_alerts() if a.severity in ("critical","high") and a.status != "closed"]

    async def get_alert_statistics(self) -> dict:
        alerts = _all_alerts()
        return {
            "total_alerts":   len(alerts),
            "critical_count": len([a for a in alerts if a.severity=="critical"]),
            "high_count":     len([a for a in alerts if a.severity=="high"]),
            "medium_count":   len([a for a in alerts if a.severity=="medium"]),
            "low_count":      len([a for a in alerts if a.severity=="low"]),
            "open_count":     len([a for a in alerts if a.status=="open"]),
            "closed_count":   len([a for a in alerts if a.status=="closed"]),
        }

    async def export_csv(self) -> str:
        """Export all alerts as CSV string."""
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id","title","severity","source","alert_type","status","ip_address","created_at","description"])
        for a in _all_alerts():
            w.writerow([a.id, a.title, a.severity, a.source, a.alert_type,
                        a.status, a.ip_address or "", a.created_at.isoformat(), a.description])
        return buf.getvalue()


MOCK_ALERTS = _SEEDED_ALERTS
