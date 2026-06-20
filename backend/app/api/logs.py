"""Logs API endpoints — auth-protected, fully wired to real SQLite data."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.models.log_model import LogCreate, LogFilter, LogResponse
from app.services.log_service import LogService
from app.api.auth import get_current_user

router = APIRouter()


def get_service() -> LogService:
    return LogService()


@router.get("", response_model=List[LogResponse])
async def get_logs(
    skip:       int            = Query(0,    ge=0),
    limit:      int            = Query(50,   ge=1, le=1000),
    severity:   Optional[str]  = Query(None),
    source:     Optional[str]  = Query(None),
    ip_address: Optional[str]  = Query(None),
    search:     Optional[str]  = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time:   Optional[datetime] = Query(None),
    service:    LogService     = Depends(get_service),
    _user:      dict           = Depends(get_current_user),   # AUTH GUARD
):
    filters = LogFilter(
        severity=severity, source=source, ip_address=ip_address,
        start_time=start_time, end_time=end_time, search=search,
    )
    return await service.get_logs(skip=skip, limit=limit, filters=filters)


@router.get("/stats/summary")
async def get_log_stats(
    service: LogService = Depends(get_service),
    _user: dict = Depends(get_current_user),                  # AUTH GUARD
):
    return await service.get_log_statistics()


@router.post("/refresh")
async def refresh_logs(
    service: LogService = Depends(get_service),
    _user: dict = Depends(get_current_user),                  # AUTH GUARD
):
    return await service.refresh_logs()


@router.get("/{log_id}", response_model=LogResponse)
async def get_log(
    log_id: int,
    service: LogService = Depends(get_service),
    _user: dict = Depends(get_current_user),                  # AUTH GUARD
):
    entry = await service.get_log_by_id(log_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Log {log_id} not found")
    return entry


@router.post("", response_model=LogResponse, status_code=status.HTTP_201_CREATED)
async def create_log(
    log: LogCreate,
    service: LogService = Depends(get_service),
    _user: dict = Depends(get_current_user),                  # AUTH GUARD
):
    return await service.create_log(log)
