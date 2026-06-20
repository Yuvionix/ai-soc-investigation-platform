"""
Event Bus — thread-safe, async-compatible broadcast queue.

All real-time collectors push dicts here.
The WebSocket manager pops them and fans out to every connected client.

Design:
  - asyncio.Queue for async producers/consumers.
  - asyncio.Lock-protected subscriber list for fan-out.
  - Max queue depth of 2000 prevents memory blow-up during spikes.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List

logger = logging.getLogger("soc_dashboard.event_bus")

# ── Global queue (single shared instance) ────────────────────────────────────
_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=2000)

# ── Subscriber WebSocket queues (one per connected client) ───────────────────
_subscribers: List[asyncio.Queue] = []
_sub_lock = asyncio.Lock()


async def publish(event: Dict[str, Any]) -> None:
    """
    Push an event dict onto the bus.
    Called by collectors (host streamer, packet sniffer, Windows event watcher).
    Non-blocking: if the queue is full the oldest event is dropped.
    """
    try:
        _queue.put_nowait(event)
    except asyncio.QueueFull:
        try:
            _queue.get_nowait()          # drop oldest
            _queue.put_nowait(event)     # insert newest
        except asyncio.QueueEmpty:
            pass


async def subscribe() -> asyncio.Queue:
    """
    Register a new WebSocket client.
    Returns a dedicated per-client Queue the WS handler reads from.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    async with _sub_lock:
        _subscribers.append(q)
    logger.debug("New subscriber registered. Total: %d", len(_subscribers))
    return q


async def unsubscribe(q: asyncio.Queue) -> None:
    """Remove a disconnected WebSocket client's queue."""
    async with _sub_lock:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass
    logger.debug("Subscriber removed. Remaining: %d", len(_subscribers))


async def dispatcher() -> None:
    """
    Long-running coroutine started at app startup.
    Reads from the global queue and fans each event out to all subscriber queues.
    """
    logger.info("Event bus dispatcher started.")
    while True:
        event = await _queue.get()
        async with _sub_lock:
            dead = []
            for q in _subscribers:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    dead.append(q)   # slow client — drop it
            for q in dead:
                _subscribers.remove(q)
                logger.warning("Dropped slow WebSocket subscriber.")
