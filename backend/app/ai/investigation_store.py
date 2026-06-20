"""
Investigation Store
====================
In-process store for investigation results and chat history.
Keyed by session_id (UUID generated at upload time).
Survives for the lifetime of the backend process.
"""
import asyncio
from typing import Dict, Optional

_store: Dict[str, dict] = {}
_chat_history: Dict[str, list] = {}
_lock = asyncio.Lock()


async def save_investigation(session_id: str, result: dict) -> None:
    async with _lock:
        _store[session_id] = result
        _chat_history[session_id] = []


async def get_investigation(session_id: str) -> Optional[dict]:
    return _store.get(session_id)


async def append_chat(session_id: str, role: str, content: str) -> None:
    async with _lock:
        if session_id not in _chat_history:
            _chat_history[session_id] = []
        _chat_history[session_id].append({"role": role, "content": content})


async def get_chat_history(session_id: str) -> list:
    return _chat_history.get(session_id, [])


def list_sessions() -> list:
    return [
        {
            "session_id":   sid,
            "filename":     data.get("filename", ""),
            "attack_types": data.get("attack_types", []),
            "severity":     data.get("severity", ""),
            "event_count":  data.get("event_count", 0),
        }
        for sid, data in _store.items()
    ]
