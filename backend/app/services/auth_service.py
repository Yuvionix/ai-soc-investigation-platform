"""
Authentication Service — NO passlib/bcrypt dependency.
Uses Python built-in hashlib PBKDF2-HMAC-SHA256.

SECURITY FIXES:
  - Per-user random salt instead of a single hard-coded salt.
  - JWTs via PyJWT (python-jose has unpatched CVE-2024-33663 / CVE-2024-33664).
  - Tokens carry iat/nbf and are validated with required claims.
  - Failed-login lockout per username and per client IP to stop brute force.
  - Constant-time verification even for unknown usernames (no user enumeration
    via response timing).
"""
import hashlib
import hmac
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import jwt
from app.config import settings

_ITERATIONS = 600_000   # OWASP 2023 recommendation for PBKDF2-HMAC-SHA256


def _hash(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, iterations=_ITERATIONS
    ).hex()


def _make_user(username: str, name: str, role: str, password: str) -> dict:
    salt = os.urandom(16)
    return {
        "username": username, "name": name, "role": role,
        "salt": salt, "hashed_password": _hash(password, salt),
    }


def _verify(plain: str, user: dict) -> bool:
    return hmac.compare_digest(_hash(plain, user["salt"]), user["hashed_password"])


_USERS = {
    "admin":   _make_user("admin",   "SOC Administrator", "Admin",   settings.SOC_ADMIN_PASSWORD),
    "analyst": _make_user("analyst", "L1 Analyst",        "Analyst", settings.SOC_ANALYST_PASSWORD),
}

# Used to burn the same CPU time for unknown usernames.
_DUMMY_USER = _make_user("-", "-", "-", os.urandom(16).hex())

ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60


# ── Brute-force lockout ───────────────────────────────────────────────────────

_failures: Dict[str, List[float]] = {}
_failures_lock = threading.Lock()


def _window() -> float:
    return settings.LOGIN_LOCKOUT_MINUTES * 60


def _recent(key: str, now: float) -> List[float]:
    attempts = [t for t in _failures.get(key, []) if now - t < _window()]
    if attempts:
        _failures[key] = attempts
    else:
        _failures.pop(key, None)
    return attempts


def is_locked_out(username: str, client_ip: str) -> bool:
    now = time.monotonic()
    with _failures_lock:
        return any(
            len(_recent(k, now)) >= settings.LOGIN_MAX_ATTEMPTS
            for k in (f"u:{username.lower()}", f"ip:{client_ip}")
        )


def _record_failure(username: str, client_ip: str) -> None:
    now = time.monotonic()
    with _failures_lock:
        for k in (f"u:{username.lower()}", f"ip:{client_ip}"):
            _failures.setdefault(k, []).append(now)
        # Bound memory if hit with many random usernames / IPs
        if len(_failures) > 10_000:
            for k in list(_failures):
                _recent(k, now)


def _clear_failures(username: str, client_ip: str) -> None:
    with _failures_lock:
        _failures.pop(f"u:{username.lower()}", None)
        _failures.pop(f"ip:{client_ip}", None)


# ── Public API ────────────────────────────────────────────────────────────────

def authenticate_user(username: str, password: str, client_ip: str = "unknown") -> Optional[dict]:
    user = _USERS.get(username)
    ok = _verify(password, user or _DUMMY_USER) and user is not None
    if not ok:
        _record_failure(username, client_ip)
        return None
    _clear_failures(username, client_ip)
    return user


def create_access_token(data: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {**data, "iat": now, "nbf": now, "exp": now + timedelta(minutes=TOKEN_EXPIRE)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
        return payload if payload.get("sub") in _USERS else None
    except jwt.PyJWTError:
        return None
