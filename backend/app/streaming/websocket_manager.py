"""
WebSocket Manager & Endpoint  (SECURITY PATCHED)
================================================
FIXES:
  - Token validation on connect. Unauthenticated clients are rejected immediately.
  - Token is passed as ?token=<jwt> query parameter (standard WS auth pattern
    since WS handshake cannot carry Authorization header in browsers).

Protocol:
  ws://host:8000/ws?token=<jwt>
  Server sends {type:"connected"} on success.
  Server sends {type:"error","detail":"..."} then closes on auth failure.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, Set

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.streaming.event_bus import subscribe, unsubscribe
from app.services.auth_service import decode_token

logger = logging.getLogger("soc_dashboard.websocket")
router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)
        logger.info("WebSocket connected. Total: %d", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)
        logger.info("WebSocket disconnected. Remaining: %d", len(self.active))

    async def broadcast(self, data: dict) -> None:
        dead = set()
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """
    Real-time event stream.  Requires a valid JWT passed as ?token=<jwt>.
    """
    # ── Auth check before accepting ──────────────────────────────────────────
    payload = decode_token(token) if token else None
    if not payload:
        await websocket.accept()
        await websocket.send_json({
            "type":    "error",
            "detail":  "Authentication required. Connect with ?token=<jwt>",
            "timestamp": datetime.now().isoformat(),
        })
        await websocket.close(code=4001)
        logger.warning("WebSocket rejected — missing or invalid token.")
        return

    await manager.connect(websocket)
    q = await subscribe()

    await websocket.send_json({
        "type":      "connected",
        "message":   f"Real-time SOC stream active. Welcome, {payload.get('sub','?')}.",
        "timestamp": datetime.now().isoformat(),
    })

    severity_filter: Optional[str] = None
    heartbeat_task = None

    async def _heartbeat():
        while True:
            await asyncio.sleep(15)
            try:
                await websocket.send_json({
                    "type":      "heartbeat",
                    "timestamp": datetime.now().isoformat(),
                })
            except Exception:
                break

    heartbeat_task = asyncio.create_task(_heartbeat())

    try:
        while True:
            get_event    = asyncio.create_task(q.get())
            recv_message = asyncio.create_task(websocket.receive_text())

            done, pending = await asyncio.wait(
                [get_event, recv_message],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()

            for task in done:
                result = task.result()

                if task is recv_message:
                    try:
                        msg = json.loads(result)
                        if msg.get("type") == "ping":
                            await websocket.send_json({"type": "pong"})
                        elif msg.get("type") == "filter":
                            severity_filter = msg.get("severity")
                            await websocket.send_json({
                                "type":    "filter_ack",
                                "filter":  severity_filter,
                                "message": f"Severity filter set to: {severity_filter or 'ALL'}",
                            })
                    except (json.JSONDecodeError, TypeError):
                        pass

                elif task is get_event:
                    event = result
                    if severity_filter and event.get("severity") != severity_filter:
                        continue
                    await websocket.send_json(event)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally.")
    except Exception as exc:
        logger.warning("WebSocket error: %s", exc)
    finally:
        if heartbeat_task:
            heartbeat_task.cancel()
        await unsubscribe(q)
        manager.disconnect(websocket)
