"""
Replay Engine for simulating security scenarios
==================================================
COMPLETED IN THIS PASS:
  _process_event() previously contained `pass` stubs for log/alert/incident
  creation — events were timed and iterated correctly but never written to
  the database. This is now wired to the same LogService / AlertService /
  IncidentService classes used by the live monitoring pipeline, and each
  persisted record is additionally broadcast on the live event bus so
  replayed events appear on the dashboard exactly like a live detection.
"""
import asyncio
import json
import logging
from typing import Dict, Optional
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.models.log_model      import LogCreate
from app.models.alert_model    import AlertCreate
from app.models.incident_model import IncidentCreate
from app.services.log_service      import LogService
from app.services.alert_service    import AlertService
from app.services.incident_service import IncidentService

logger = logging.getLogger("soc_dashboard.replay_engine")

# Optional: broadcast replayed events on the live WebSocket bus.
# Import is best-effort so the replay engine still works standalone
# (e.g. under pytest) even if the streaming module isn't initialised.
try:
    from app.streaming.event_bus import publish as _bus_publish
    _BUS_AVAILABLE = True
except ImportError:
    _BUS_AVAILABLE = False


class ReplayEngine:
    """Engine for replaying security events from a recorded scenario file."""

    def __init__(self):
        self.is_running        = False
        self.current_scenario  = None
        self.replay_speed      = settings.REPLAY_SPEED
        self._log_service      = LogService()
        self._alert_service    = AlertService()
        self._incident_service = IncidentService()
        self.events_processed  = 0
        self.events_failed     = 0

    async def load_scenario(self, scenario_path: str) -> Dict:
        """Load a scenario from a JSON file."""
        path = Path(scenario_path)
        if not path.exists():
            raise FileNotFoundError(f"Scenario file not found: {scenario_path}")
        with open(path, "r") as f:
            scenario = json.load(f)
        return scenario

    async def replay_scenario(self, scenario: Dict, speed_override: Optional[float] = None) -> Dict:
        """
        Replay a security scenario, persisting every event to the database
        and broadcasting it on the live event bus.

        Returns a summary dict: {events_processed, events_failed, duration_seconds}.
        """
        self.is_running       = True
        self.current_scenario = scenario
        self.events_processed = 0
        self.events_failed    = 0
        if speed_override:
            self.replay_speed = speed_override

        events     = scenario.get("events", [])
        start_wall = datetime.now()

        # Anchor delays to the first event's recorded timestamp rather than
        # to wall-clock "now", so relative spacing between events is preserved
        # regardless of when replay is started.
        first_ts = None
        if events:
            try:
                first_ts = datetime.fromisoformat(events[0].get("timestamp"))
            except (ValueError, TypeError):
                first_ts = None

        for event in events:
            if not self.is_running:
                logger.info("Replay stopped early by request (%d/%d events processed).",
                            self.events_processed, len(events))
                break

            # Calculate delay relative to the first event, scaled by speed multiplier
            if first_ts is not None:
                try:
                    event_ts = datetime.fromisoformat(event.get("timestamp"))
                    offset   = (event_ts - first_ts).total_seconds() / max(self.replay_speed, 0.01)
                    elapsed  = (datetime.now() - start_wall).total_seconds()
                    delay    = offset - elapsed
                    if delay > 0:
                        await asyncio.sleep(delay)
                except (ValueError, TypeError):
                    pass

            try:
                await self._process_event(event)
                self.events_processed += 1
            except Exception as exc:
                self.events_failed += 1
                logger.warning("Replay event failed to persist: %s — event=%r", exc, event)

        self.is_running = False
        duration = (datetime.now() - start_wall).total_seconds()
        logger.info(
            "Replay complete: %d processed, %d failed, %.1fs elapsed.",
            self.events_processed, self.events_failed, duration,
        )
        return {
            "events_processed": self.events_processed,
            "events_failed":    self.events_failed,
            "duration_seconds": round(duration, 2),
        }

    def stop(self) -> None:
        """Request the currently running replay to stop after the in-flight event."""
        self.is_running = False

    async def _process_event(self, event: Dict) -> None:
        """
        Persist a single replayed event using the same services the live
        monitoring pipeline uses, then broadcast it on the event bus so it
        appears on connected dashboards in real time.
        """
        event_type = event.get("type")

        if event_type == "log":
            created = await self._log_service.create_log(LogCreate(
                source=event.get("source", "Replay Engine"),
                severity=event.get("severity", "info"),
                message=event.get("message", "Replayed log event"),
                raw_data=json.dumps(event),
                ip_address=event.get("ip_address"),
            ))
            await self._broadcast("log", created)

        elif event_type == "alert":
            created = await self._alert_service.create_alert(AlertCreate(
                title=event.get("title", "Replayed Alert"),
                description=event.get("description", "Alert replayed from recorded scenario."),
                severity=event.get("severity", "medium"),
                source=event.get("source", "Replay Engine"),
                alert_type=event.get("alert_type", "network_anomaly"),
                ip_address=event.get("ip_address"),
            ))
            await self._broadcast("alert", created)

        elif event_type == "incident":
            created = await self._incident_service.create_incident(IncidentCreate(
                title=event.get("title", "Replayed Incident"),
                description=event.get("description", "Incident replayed from recorded scenario."),
                severity=event.get("severity", "medium"),
                incident_type=event.get("incident_type", "replay"),
                related_alert_ids=event.get("related_alert_ids", []),
            ))
            await self._broadcast("incident", created)

        else:
            logger.debug("Unknown replay event type '%s' — skipped.", event_type)

    async def _broadcast(self, kind: str, record) -> None:
        """Publish the persisted record to the live event bus, if available."""
        if not _BUS_AVAILABLE:
            return
        try:
            payload = record.model_dump() if hasattr(record, "model_dump") else dict(record)
            # datetime fields aren't JSON-serialisable by default — stringify them
            for k, v in list(payload.items()):
                if isinstance(v, datetime):
                    payload[k] = v.isoformat()
            await _bus_publish({"type": kind, "source": "replay", **payload})
        except Exception as exc:
            logger.debug("Replay broadcast skipped (event bus unavailable): %s", exc)
