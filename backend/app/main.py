"""
Main FastAPI application — SOC Real-Time SIEM Dashboard v4
Improvements:
  - Rate limiting via slowapi
  - Rotating file logs
  - Threat→Alert bridge wired
  - Reconnect banner event on WS
"""
import asyncio
import logging
import logging.handlers
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    _RATE_LIMIT_AVAILABLE = True
except ImportError:
    _RATE_LIMIT_AVAILABLE = False
    class Limiter:
        def __init__(self, **kwargs): pass
    def get_remote_address(r): return "127.0.0.1"
    class RateLimitExceeded(Exception): pass
    def _rate_limit_exceeded_handler(r, e): pass

from app.config import settings
from app.database.database import init_db
from app.api import logs, alerts, incidents, timeline, feedback, auth, audit
from app.api.ai_investigation import router as ai_router
from app.streaming.websocket_manager import router as ws_router

# ── File + Console logging ────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
root_logger = logging.getLogger()
root_logger.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))

# Console handler
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter("%(levelname)-8s %(name)s  %(message)s"))
root_logger.addHandler(ch)

# Rotating file handler (10 MB × 5 files)
fh = logging.handlers.RotatingFileHandler(
    settings.LOG_FILE, maxBytes=10*1024*1024, backupCount=5
)
fh.setFormatter(logging.Formatter(
    "%(asctime)s  %(levelname)-8s %(name)s  %(message)s"
))
root_logger.addHandler(fh)

logger = logging.getLogger("soc_dashboard")

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SOC Real-Time SIEM Dashboard v4...")
    await init_db()
    logger.info("Database initialised.")

    from app.streaming.event_bus import dispatcher
    bus_task = asyncio.create_task(dispatcher())

    from app.streaming.host_streamer import start_host_streaming
    host_task = asyncio.create_task(start_host_streaming())

    from app.streaming.packet_sniffer import start_packet_sniffing
    net_task = asyncio.create_task(start_packet_sniffing())

    # ── Threat → Alert bridge ─────────────────────────────────────────────
    from app.streaming.threat_alert_bridge import start_threat_alert_bridge
    bridge_task = asyncio.create_task(start_threat_alert_bridge())

    # ── Scheduled log refresh every 5 minutes ─────────────────────────────
    from app.streaming.scheduled_refresh import start_scheduled_refresh
    refresh_task = asyncio.create_task(start_scheduled_refresh())

    logger.info("All workers started.")
    yield

    for t in (bus_task, host_task, net_task, bridge_task, refresh_task):
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    logger.info("SOC Dashboard shutdown complete.")


app = FastAPI(
    title="SOC Real-Time SIEM Dashboard API",
    description="Offline Security Operations Center — real-time host & network monitoring",
    version="4.0.0",
    lifespan=lifespan,
    # SECURITY FIX: don't publish the interactive API schema outside debug mode
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Rate limiting (only if slowapi is installed)
if _RATE_LIMIT_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    # SECURITY FIX: default_limits are only enforced by the middleware — without
    # it the 200/minute limit above was never applied.
    app.add_middleware(SlowAPIMiddleware)


# SECURITY FIX: standard hardening headers on every HTTP response
_SECURITY_HEADERS = {
    "X-Content-Type-Options":  "nosniff",
    "X-Frame-Options":         "DENY",
    "Referrer-Policy":         "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control":           "no-store",
    "Permissions-Policy":      "geolocation=(), microphone=(), camera=()",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        # Swagger/ReDoc (debug only) load assets from a CDN — skip the strict CSP there
        if header == "Content-Security-Policy" and request.url.path in ("/docs", "/redoc"):
            continue
        response.headers.setdefault(header, value)
    if request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# CORS
# SECURITY FIX: wildcard methods/headers removed. allow_credentials=True combined
# with allow_methods=["*"] / allow_headers=["*"] is broader than necessary —
# restricted to exactly what this API surface uses.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Routers
app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(logs.router,      prefix="/api/logs",      tags=["Logs"])
app.include_router(alerts.router,    prefix="/api/alerts",    tags=["Alerts"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(timeline.router,  prefix="/api/timeline",  tags=["Timeline"])
app.include_router(feedback.router,  prefix="/api/feedback",  tags=["Feedback"])
app.include_router(audit.router,     prefix="/api/audit",     tags=["Audit"])
app.include_router(ws_router,                                  tags=["Real-Time Stream"])
app.include_router(ai_router, prefix="/api/ai", tags=["AI Investigation"])


@app.get("/")
async def root():
    return {"message": "SOC Real-Time SIEM Dashboard", "version": "4.0.0", "status": "operational"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected", "streaming": "active", "version": "4.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=settings.DEBUG)
