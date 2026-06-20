"""Alerts API — auth-protected, with escalate-to-incident and CSV export."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from typing import List, Optional
from app.services.alert_service import AlertService
from app.models.alert_model import AlertResponse, AlertCreate, AlertUpdate
from app.api.auth import get_current_user, require_admin
from app.audit.audit_log import record_action

router = APIRouter()


@router.get("", response_model=List[AlertResponse])
async def get_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    service: AlertService = Depends(),
    _user: dict = Depends(get_current_user),          # AUTH GUARD
):
    return await service.get_alerts(skip=skip, limit=limit, severity=severity, status=status, source=source)


@router.get("/stats/summary")
async def get_alert_stats(
    service: AlertService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.get_alert_statistics()


@router.get("/critical/active")
async def get_critical_alerts(
    service: AlertService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.get_critical_alerts()


@router.get("/export/csv")
async def export_alerts_csv(
    service: AlertService = Depends(),
    _user: dict = Depends(require_admin),              # RBAC: Admin-only — bulk export of alert data
):
    csv_data = await service.export_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=soc_alerts.csv"},
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: int,
    service: AlertService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    alert = await service.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alert


@router.post("", response_model=AlertResponse, status_code=201)
async def create_alert(
    alert: AlertCreate,
    service: AlertService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    return await service.create_alert(alert)


@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    service: AlertService = Depends(),
    user: dict = Depends(get_current_user),            # AUTH GUARD
):
    result = await service.update_alert(alert_id, alert_update)
    if not result:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    record_action(
        actor=user.get("username", "unknown"), action="update_alert",
        resource_type="alert", resource_id=alert_id,
        details=alert_update.model_dump(exclude_none=True),
    )
    return result


@router.post("/{alert_id}/escalate")
async def escalate_alert(
    alert_id: int,
    service: AlertService = Depends(),
    user: dict = Depends(get_current_user),            # AUTH GUARD
):
    result = await service.escalate_to_incident(alert_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    record_action(
        actor=user.get("username", "unknown"), action="escalate_alert",
        resource_type="alert", resource_id=alert_id,
        details={"escalated_to_incident": True},
    )
    return result
