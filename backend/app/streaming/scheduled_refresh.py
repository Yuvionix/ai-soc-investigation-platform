"""
Scheduled Log Refresh
======================
Re-runs the host + network log collectors every REFRESH_INTERVAL seconds
so new OS log entries appear in the DB automatically without manual API calls.
"""

import asyncio
import logging

logger = logging.getLogger("soc_dashboard.scheduled_refresh")

REFRESH_INTERVAL = 300  # 5 minutes


async def start_scheduled_refresh() -> None:
    """Auto-refresh log ingestion on a fixed interval."""
    logger.info("Scheduled log refresh started (every %ds).", REFRESH_INTERVAL)
    while True:
        await asyncio.sleep(REFRESH_INTERVAL)
        try:
            from app.services.log_service import LogService
            svc = LogService()
            result = await svc.refresh_logs()
            logger.info("Scheduled refresh complete: %d new entries.", result.get("new_entries", 0))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Scheduled refresh error (non-fatal): %s", exc)
