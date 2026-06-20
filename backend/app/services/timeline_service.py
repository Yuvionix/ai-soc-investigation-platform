"""
Timeline service for business logic
"""
from typing import List, Optional
from datetime import datetime, timedelta


class TimelineService:
    """Service for timeline operations"""
    
    async def get_timeline_events(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        incident_id: Optional[int] = None,
        event_types: Optional[List[str]] = None
    ) -> List[dict]:
        """Get timeline events with filters"""
        return []
    
    async def get_incident_timeline(self, incident_id: int) -> List[dict]:
        """Get timeline for a specific incident integrating both alerts and logs natively"""
        from app.services.incident_service import IncidentService
        from app.services.alert_service import MOCK_ALERTS
        from app.services.log_service import MOCK_LOGS
        
        incident_service = IncidentService()
        inc = await incident_service.get_incident_by_id(incident_id)
        if not inc: return []

        target_ip = inc.title.replace("Coordinated Activity on ", "")

        # Target window
        start_time = inc.created_at - timedelta(minutes=60)
        end_time = inc.created_at + timedelta(minutes=120)

        timeline = []
        
        # Extract matching Alerts
        for a in MOCK_ALERTS:
            if getattr(a, "ip_address", None) == target_ip and start_time <= a.created_at <= end_time:
                timeline.append({
                    "id": f"alert-{a.id}",
                    "type": "alert",
                    "timestamp": a.created_at.isoformat(),
                    "title": a.title,
                    "description": a.description,
                    "severity": a.severity,
                    "source": a.source
                })

        # Extract matching Logs
        for l in MOCK_LOGS:
            if getattr(l, "ip_address", None) == target_ip and start_time <= l.timestamp <= end_time:
                timeline.append({
                    "id": f"log-{l.id}",
                    "type": "log",
                    "timestamp": l.timestamp.isoformat(),
                    "title": l.message,
                    "description": l.raw_data or "Standard system log execution.",
                    "severity": l.severity,
                    "source": l.source
                })

        # Sort combined timeline ascending by timestamp
        timeline.sort(key=lambda x: datetime.fromisoformat(x["timestamp"]))
        return timeline
    
    async def export_timeline(
        self,
        start_time: datetime,
        end_time: datetime,
        format: str = "json"
    ) -> dict:
        return {}
