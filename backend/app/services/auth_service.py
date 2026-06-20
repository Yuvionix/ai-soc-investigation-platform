"""
Authentication Service — NO passlib/bcrypt dependency.
Uses Python built-in hashlib PBKDF2-HMAC-SHA256.
"""
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from app.config import settings

_SALT = b"soc-rt-salt-2024"

def _hash(password: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), _SALT, iterations=260_000
    ).hex()

def _verify(plain: str, hashed: str) -> bool:
    return hmac.compare_digest(_hash(plain), hashed)

_USERS = {
    "admin": {
        "username": "admin", "name": "SOC Administrator", "role": "Admin",
        "hashed_password": _hash(settings.SOC_ADMIN_PASSWORD),
    },
    "analyst": {
        "username": "analyst", "name": "L1 Analyst", "role": "Analyst",
        "hashed_password": _hash(settings.SOC_ANALYST_PASSWORD),
    },
}

ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60

def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = _USERS.get(username)
    if not user or not _verify(password, user["hashed_password"]):
        return None
    return user

def create_access_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload if payload.get("sub") else None
    except JWTError:
        return None
