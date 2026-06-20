"""
Audit Log API
==============
Admin-only endpoint for reviewing analyst actions recorded by audit_log.py.
"""
from fastapi import APIRouter, Depends, Query
from app.api.auth import require_admin
from app.audit.audit_log import read_recent

router = APIRouter()


@router.get("")
async def get_audit_log(
    limit: int = Query(100, ge=1, le=1000),
    _user: dict = Depends(require_admin),   # RBAC: Admin-only
):
    """Return the most recent audit entries (analyst status changes, escalations, exports)."""
    return read_recent(limit=limit)
