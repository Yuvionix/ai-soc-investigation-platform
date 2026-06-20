"""
Log Service — real data from SQLite (populated from host & network collectors).

Flow:
  1. On first request (lazy init) the service ingests real host + network logs
     into the SQLite DB via the collectors.
  2. All CRUD operations hit the DB via SQLAlchemy async sessions.
  3. A background refresh can be triggered via `refresh_logs()`.
"""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.host_log_collector import collect_host_logs
from app.collectors.network_log_collector import collect_network_logs
from app.database.database import AsyncSessionLocal
from app.models.log_model import LogCreate, LogFilter, LogORM, LogResponse

logger = logging.getLogger("soc_dashboard")

# ── Mock logs used by incident/timeline services ───────────────────────────────
# These are separate from DB-backed real logs and serve the offline demo flow.

def generate_mock_logs() -> list[LogResponse]:
    ips = ["45.22.11.9", "192.168.1.10", "10.0.0.5", "172.16.0.4"]
    sources = ["Firewall", "Auth System", "EDR", "Network IPS"]
    messages = [
        "Connection attempt blocked from suspicious IP",
        "Failed login detected for admin account",
        "Malware command-and-control beacon observed",
        "Data exfiltration pattern matched on host",
        "Firewall drop rule triggered for anomalous traffic",
    ]
    severities = ["info", "warning", "error", "critical"]
    mock_logs = []
    base_time = datetime.now() - timedelta(hours=2)
    for i in range(1, 31):
        ts = base_time + timedelta(minutes=random.randint(0, 180))
        ip = random.choice(ips)
        msg = random.choice(messages)
        mock_logs.append(LogResponse(
            id=i,
            source=random.choice(sources),
            severity=random.choice(severities),
            message=msg,
            raw_data=f"{msg} -- raw packet metadata",
            ip_address=ip,
            timestamp=ts,
        ))
    mock_logs.sort(key=lambda x: x.timestamp, reverse=True)
    return mock_logs

MOCK_LOGS = generate_mock_logs()

# ── One-time ingestion guard ──────────────────────────────────────────────────
_ingestion_done = False
_ingestion_lock = asyncio.Lock()


async def _ingest_real_logs() -> int:
    """
    Collect host + network logs and insert them into the DB.
    Skips entries already present (dedup by timestamp + message prefix).
    Returns count of newly inserted rows.
    """
    global _ingestion_done

    host_logs    = collect_host_logs(max_per_source=300)
    network_logs = collect_network_logs(max_per_source=300)
    all_raw      = host_logs + network_logs

    if not all_raw:
        logger.warning("Log collectors returned 0 entries — check OS permissions.")
        return 0

    inserted = 0
    async with AsyncSessionLocal() as session:
        for entry in all_raw:
            # Dedup: skip if a row with same timestamp-minute + message prefix exists
            ts_floor = entry["timestamp"].replace(second=0, microsecond=0)
            msg_prefix = entry["message"][:80]
            result = await session.execute(
                select(LogORM.id).where(
                    LogORM.timestamp >= ts_floor,
                    LogORM.timestamp <  ts_floor + timedelta(minutes=1),
                    LogORM.message.startswith(msg_prefix[:60]),
                ).limit(1)
            )
            if result.scalar_one_or_none() is not None:
                continue   # already in DB

            orm = LogORM(
                source     = entry["source"],
                severity   = entry["severity"],
                message    = entry["message"],
                raw_data   = entry.get("raw_data"),
                ip_address = entry.get("ip_address"),
                timestamp  = entry["timestamp"],
            )
            session.add(orm)
            inserted += 1

        await session.commit()

    logger.info("Log ingestion complete: %d new entries inserted.", inserted)
    _ingestion_done = True
    return inserted


async def _ensure_ingested() -> None:
    """Trigger ingestion once at startup (thread-safe via asyncio lock)."""
    global _ingestion_done
    if _ingestion_done:
        return
    async with _ingestion_lock:
        if not _ingestion_done:
            await _ingest_real_logs()


# ── Service class ─────────────────────────────────────────────────────────────

class LogService:
    """Async service for all log CRUD + statistics operations."""

    # ── Internal DB helpers ───────────────────────────────────────────────────

    @staticmethod
    def _build_query(filters: Optional[LogFilter] = None):
        q = select(LogORM)
        if filters:
            if filters.severity:
                q = q.where(LogORM.severity == filters.severity.lower())
            if filters.source:
                q = q.where(LogORM.source.ilike(f"%{filters.source}%"))
            if filters.ip_address:
                q = q.where(LogORM.ip_address == filters.ip_address)
            if filters.start_time:
                q = q.where(LogORM.timestamp >= filters.start_time)
            if filters.end_time:
                q = q.where(LogORM.timestamp <= filters.end_time)
            if filters.search:
                q = q.where(LogORM.message.ilike(f"%{filters.search}%"))
        return q.order_by(LogORM.timestamp.desc())

    @staticmethod
    def _to_response(orm: LogORM) -> LogResponse:
        return LogResponse(
            id         = orm.id,
            source     = orm.source,
            severity   = orm.severity,
            message    = orm.message,
            raw_data   = orm.raw_data,
            ip_address = orm.ip_address,
            timestamp  = orm.timestamp,
        )

    # ── Public methods ────────────────────────────────────────────────────────

    async def get_logs(
        self,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[LogFilter] = None,
    ) -> List[LogResponse]:
        """Return paginated logs with optional filters."""
        await _ensure_ingested()
        q = self._build_query(filters).offset(skip).limit(limit)
        async with AsyncSessionLocal() as session:
            result = await session.execute(q)
            rows = result.scalars().all()
        return [self._to_response(r) for r in rows]

    async def get_log_by_id(self, log_id: int) -> Optional[LogResponse]:
        """Return a single log entry by primary key."""
        await _ensure_ingested()
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(LogORM).where(LogORM.id == log_id)
            )
            row = result.scalar_one_or_none()
        return self._to_response(row) if row else None

    async def create_log(self, log: LogCreate) -> LogResponse:
        """Persist a manually submitted log entry."""
        orm = LogORM(
            source     = log.source,
            severity   = log.severity,
            message    = log.message,
            raw_data   = log.raw_data,
            ip_address = log.ip_address,
            timestamp  = log.timestamp or datetime.now(),
        )
        async with AsyncSessionLocal() as session:
            session.add(orm)
            await session.commit()
            await session.refresh(orm)
        return self._to_response(orm)

    async def refresh_logs(self) -> dict:
        """
        Re-run collectors and ingest any new entries.
        Exposed via POST /api/logs/refresh.
        """
        global _ingestion_done
        _ingestion_done = False   # force re-ingest
        inserted = await _ingest_real_logs()
        return {"status": "ok", "new_entries": inserted}

    async def get_log_statistics(self) -> dict:
        """
        Return aggregated statistics about all logs in the DB.
        """
        await _ensure_ingested()
        async with AsyncSessionLocal() as session:
            # Total count
            total_res = await session.execute(select(func.count()).select_from(LogORM))
            total = total_res.scalar_one()

            # By severity
            sev_res = await session.execute(
                select(LogORM.severity, func.count().label("cnt"))
                .group_by(LogORM.severity)
            )
            by_severity = {row.severity: row.cnt for row in sev_res}

            # By source
            src_res = await session.execute(
                select(LogORM.source, func.count().label("cnt"))
                .group_by(LogORM.source)
                .order_by(text("cnt DESC"))
            )
            by_source = {row.source: row.cnt for row in src_res}

            # Last-hour count
            one_hour_ago = datetime.now() - timedelta(hours=1)
            recent_res = await session.execute(
                select(func.count()).select_from(LogORM)
                .where(LogORM.timestamp >= one_hour_ago)
            )
            recent_count = recent_res.scalar_one()

            # Top IPs
            ip_res = await session.execute(
                select(LogORM.ip_address, func.count().label("cnt"))
                .where(LogORM.ip_address.isnot(None))
                .group_by(LogORM.ip_address)
                .order_by(text("cnt DESC"))
                .limit(10)
            )
            top_ips = {row.ip_address: row.cnt for row in ip_res}

        return {
            "total_logs":    total,
            "by_severity":   by_severity,
            "by_source":     by_source,
            "recent_count":  recent_count,
            "top_ips":       top_ips,
        }
