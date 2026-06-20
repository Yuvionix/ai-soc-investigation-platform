"""Incidents API — auth-protected, with analyst notes, CSV export, working update."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from typing import List, Optional
from pydantic import BaseModel
from app.services.incident_service import IncidentService
from app.models.incident_model import IncidentResponse, IncidentCreate, IncidentUpdate
from app.api.auth import get_current_user, require_admin
from app.audit.audit_log import record_action

router = APIRouter()


class NoteCreate(BaseModel):
    author: str = "Analyst"
    note: str


@router.get("", response_model=List[IncidentResponse])
async def get_incidents(
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=1000),
    status: Optional[str] = None, severity: Optional[str] = None,
    service: IncidentService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.get_incidents(skip=skip, limit=limit, status=status, severity=severity)


@router.get("/stats/summary")
async def get_incident_stats(
    service: IncidentService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.get_incident_statistics()


@router.get("/export/csv")
async def export_incidents_csv(
    service: IncidentService = Depends(),
    _user: dict = Depends(require_admin),              # RBAC: Admin-only — bulk export of incident data
):
    csv_data = await service.export_csv()
    return Response(content=csv_data, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=soc_incidents.csv"})


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: int,
    service: IncidentService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    inc = await service.get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return inc


@router.post("", response_model=IncidentResponse, status_code=201)
async def create_incident(
    incident: IncidentCreate,
    service: IncidentService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.create_incident(incident)


@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int, upd: IncidentUpdate,
    service: IncidentService = Depends(),
    user: dict = Depends(get_current_user),            # AUTH GUARD
):
    result = await service.update_incident(incident_id, upd)
    if not result:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    record_action(
        actor=user.get("username", "unknown"), action="update_incident",
        resource_type="incident", resource_id=incident_id,
        details=upd.model_dump(exclude_none=True),
    )
    return result


@router.post("/{incident_id}/correlate")
async def correlate_incident(
    incident_id: int,
    service: IncidentService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.correlate_incident(incident_id)


@router.post("/{incident_id}/notes")
async def add_note(
    incident_id: int, body: NoteCreate,
    service: IncidentService = Depends(),
    user: dict = Depends(get_current_user),            # AUTH GUARD — use real username
):
    author = user.get("name", body.author)
    return await service.add_note(incident_id, author, body.note)


@router.get("/{incident_id}/notes")
async def get_notes(
    incident_id: int,
    service: IncidentService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.get_notes(incident_id)
