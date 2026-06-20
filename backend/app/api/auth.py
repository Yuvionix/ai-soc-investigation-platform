"""
Auth API — login and /me endpoints.

SECURITY FIXES applied:
  - /me now reads token from Authorization: Bearer header, NOT query parameter.
    Query param tokens are logged by every proxy, web server, and browser history.
  - get_current_user() dependency created for reuse across all protected routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.services.auth_service import authenticate_user, create_access_token, decode_token, _USERS

router  = APIRouter()
_bearer = HTTPBearer(auto_error=False)


# ── Reusable auth dependency ──────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    FastAPI dependency — validates Bearer token and returns the user dict.
    Raises 401 if token is missing, expired, or invalid.
    Use with:  user: dict = Depends(get_current_user)
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = _USERS.get(payload.get("sub"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency that additionally requires Admin role."""
    if user.get("role") != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


# ── Request / Response models ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    name: str
    role: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return TokenResponse(
        access_token=token,
        username=user["username"],
        name=user["name"],
        role=user["role"],
    )


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Return current user info — token read from Authorization header, not query param."""
    return {
        "username": user["username"],
        "name":     user["name"],
        "role":     user["role"],
    }
