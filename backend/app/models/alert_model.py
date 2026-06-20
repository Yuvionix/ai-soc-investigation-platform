"""
Alert data models — with enum validation for severity and status.

SECURITY FIX: Added enum validators so callers cannot inject arbitrary
strings into severity/status fields (e.g. severity="'; DROP TABLE alerts;--").
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
from enum import Enum


class SeverityEnum(str, Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"
    warning  = "warning"   # used by network threat events
    info     = "info"


class AlertStatusEnum(str, Enum):
    open          = "open"
    investigating = "investigating"
    closed        = "closed"


class AlertBase(BaseModel):
    title:       str          = Field(..., min_length=1, max_length=500)
    description: str          = Field(..., min_length=1, max_length=5000)
    severity:    SeverityEnum = Field(..., description="Severity level")
    source:      str          = Field(..., min_length=1, max_length=255)
    alert_type:  str          = Field(..., min_length=1, max_length=100)
    ip_address:  Optional[str] = Field(None, max_length=45)

    @field_validator("ip_address")
    @classmethod
    def validate_ip(cls, v):
        if v is None:
            return v
        import re
        # Accept IPv4, IPv6, or None
        ipv4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
        ipv6 = re.compile(r"^[0-9a-fA-F:]{2,39}$")
        if not (ipv4.match(v) or ipv6.match(v)):
            raise ValueError(f"Invalid IP address format: {v}")
        return v


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    status:      Optional[AlertStatusEnum] = None
    assigned_to: Optional[str]            = Field(None, max_length=255)
    notes:       Optional[str]            = Field(None, max_length=5000)


class AlertResponse(AlertBase):
    id:          int
    status:      str = "open"
    assigned_to: Optional[str] = None
    notes:       Optional[str] = None
    created_at:  datetime
    updated_at:  Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertResponseWithMitre(AlertResponse):
    """Extended response model that includes MITRE ATT&CK fields."""
    mitre_technique_id:   Optional[str] = None
    mitre_technique_name: Optional[str] = None
    mitre_tactic:         Optional[str] = None
