"""
Threat → Alert Bridge
======================
Subscribes to the event bus, watches for threat events emitted by the
packet sniffer, and automatically creates alert records from them.

This wires the gap between:
  packet_sniffer.py  →  event_bus  →  [THIS]  →  alert_service.ingest_threat_as_alert()
"""

import asyncio
import logging
from app.streaming.event_bus import subscribe, unsubscribe

logger = logging.getLogger("soc_dashboard.threat_bridge")


async def start_threat_alert_bridge() -> None:
    """
    Long-running coroutine. Reads from event bus and converts
    every 'threat' event into an alert visible in the dashboard.
    """
    q = await subscribe()
    logger.info("Threat→Alert bridge started.")

    try:
        while True:
            event = await q.get()
            if event.get("event_type") != "threat":
                continue

            try:
                from app.services.alert_service import ingest_threat_as_alert
                alert = ingest_threat_as_alert(event)
                logger.info(
                    "Auto-alert created from threat [%s]: %s",
                    event.get("threat_type", "?"), alert.title,
                )
            except Exception as exc:
                logger.debug("Bridge alert create error (non-fatal): %s", exc)

    except asyncio.CancelledError:
        pass
    finally:
        await unsubscribe(q)
        logger.info("Threat→Alert bridge stopped.")
