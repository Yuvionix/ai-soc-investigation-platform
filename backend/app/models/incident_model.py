"""
Incident data models — with enum validation.
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


class SeverityEnum(str, Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


class IncidentStatusEnum(str, Enum):
    open          = "open"
    investigating = "investigating"
    resolved      = "resolved"
    closed        = "closed"


class IncidentBase(BaseModel):
    title:         str          = Field(..., min_length=1, max_length=500)
    description:   str          = Field(..., min_length=1, max_length=10000)
    severity:      SeverityEnum = Field(...)
    incident_type: str          = Field(..., min_length=1, max_length=100)


class IncidentCreate(IncidentBase):
    related_alert_ids: Optional[List[int]] = []


class IncidentUpdate(BaseModel):
    status:      Optional[IncidentStatusEnum] = None
    assigned_to: Optional[str]               = Field(None, max_length=255)
    notes:       Optional[str]               = Field(None, max_length=10000)
    resolution:  Optional[str]               = Field(None, max_length=10000)


class IncidentResponse(IncidentBase):
    id:          int
    status:      str = "open"
    assigned_to: Optional[str]      = None
    notes:       Optional[str]      = None
    resolution:  Optional[str]      = None
    created_at:  datetime
    updated_at:  Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
