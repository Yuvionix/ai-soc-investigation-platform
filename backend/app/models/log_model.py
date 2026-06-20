"""
Log data models — Pydantic schemas + SQLAlchemy ORM
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, Text, Index
from sqlalchemy.sql import func

from app.database.database import Base


# ── SQLAlchemy ORM ────────────────────────────────────────────────────────────

class LogORM(Base):
    """Persistent log record stored in SQLite."""
    __tablename__ = "logs"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    source     = Column(String(255), nullable=False)
    severity   = Column(String(50),  nullable=False)
    message    = Column(Text,        nullable=False)
    raw_data   = Column(Text,        nullable=True)
    ip_address = Column(String(64),  nullable=True)
    timestamp  = Column(DateTime,    nullable=False, default=func.now())
    created_at = Column(DateTime,    nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_logs_timestamp", "timestamp"),
        Index("idx_logs_severity",  "severity"),
        Index("idx_logs_source",    "source"),
        Index("idx_logs_ip",        "ip_address"),
    )


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class LogBase(BaseModel):
    source:     str           = Field(..., description="Log source (e.g. Auth/SSH, Firewall/UFW)")
    severity:   str           = Field(..., description="Severity: info | warning | error | critical")
    message:    str           = Field(..., description="Human-readable log message")
    raw_data:   Optional[str] = Field(None, description="Original raw log line")
    ip_address: Optional[str] = Field(None, description="Source / destination IP address")


class LogCreate(LogBase):
    """Schema for manually creating a log entry via POST /api/logs."""
    timestamp: Optional[datetime] = Field(None, description="Override timestamp (defaults to now)")


class LogResponse(LogBase):
    """Schema returned by all log endpoints."""
    id:        int
    timestamp: datetime

    class Config:
        from_attributes = True


class LogFilter(BaseModel):
    """Query-parameter filters for GET /api/logs."""
    severity:   Optional[str]      = None
    source:     Optional[str]      = None
    ip_address: Optional[str]      = None
    start_time: Optional[datetime] = None
    end_time:   Optional[datetime] = None
    search:     Optional[str]      = None   # free-text search in message
