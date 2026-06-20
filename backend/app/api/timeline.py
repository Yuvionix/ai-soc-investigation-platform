"""
Timeline API endpoints
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime

from app.services.timeline_service import TimelineService

router = APIRouter()


@router.get("/")
async def get_timeline(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    incident_id: Optional[int] = None,
    event_types: Optional[str] = Query(None, description="Comma-separated event types"),
    service: TimelineService = Depends()
):
    """Get timeline events with optional filters"""
    event_type_list = event_types.split(",") if event_types else None
    return await service.get_timeline_events(
        start_time=start_time,
        end_time=end_time,
        incident_id=incident_id,
        event_types=event_type_list
    )


@router.get("/incident/{incident_id}")
async def get_incident_timeline(incident_id: int, service: TimelineService = Depends()):
    """Get timeline for a specific incident"""
    return await service.get_incident_timeline(incident_id)


@router.get("/export")
async def export_timeline(
    start_time: datetime,
    end_time: datetime,
    format: str = Query("json", pattern="^(json|csv)$"),
    service: TimelineService = Depends()
):
    """Export timeline events in specified format"""
    return await service.export_timeline(start_time, end_time, format)
