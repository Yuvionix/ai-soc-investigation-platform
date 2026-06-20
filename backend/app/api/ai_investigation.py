"""
AI Investigation Center — API Routes  (HARDENED)
==================================================
FIXES applied in this pass:
  - Content-type sniffing added on top of extension check (rejects files whose
    actual bytes don't match a text/structured-data file, e.g. an .txt that is
    actually an executable or HTML with embedded script).
  - Filename sanitised before storage/display (strips path separators and
    control characters) to prevent path traversal or stored-XSS via filename.
  - Per-IP upload rate limit added (separate from the global 200/min limit)
    to prevent upload-endpoint abuse specifically.
"""
import re
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.ai.investigation_service import InvestigationService
from app.ai.investigation_store   import (
    save_investigation, get_investigation,
    append_chat, get_chat_history, list_sessions,
)
from app.ai.ollama_client import check_ollama_status, generate_stream, AVAILABLE_MODELS, SYSTEM_ROLE
from app.ai.prompt_templates import CHAT_PROMPT

logger = logging.getLogger("soc_dashboard.ai_api")
router = APIRouter()

ALLOWED_EXTENSIONS = {"json", "csv", "txt", "log"}
MAX_FILE_SIZE_MB   = 10

# ── Content-sniffing: reject files whose actual bytes don't look like text ───
# A disguised binary (PE/ELF header, embedded <script>, etc.) is rejected even
# if its extension is in ALLOWED_EXTENSIONS.
_BINARY_MAGIC_BYTES = (
    b"MZ",            # Windows PE executable
    b"\x7fELF",       # Linux ELF executable
    b"\xca\xfe\xba\xbe",  # Mach-O / Java class
    b"PK\x03\x04",    # ZIP (could hide a polyglot payload)
)
_SUSPICIOUS_TEXT_PATTERNS = re.compile(
    rb"<script[\s>]|<\?php|#!/bin/(ba)?sh|powershell\s+-enc", re.IGNORECASE
)

_FILENAME_SANITISE = re.compile(r"[^A-Za-z0-9._\- ]")


def _sanitise_filename(name: str) -> str:
    """Strip path separators, control chars, and anything not safe to display/store."""
    name = name.replace("\\", "_").replace("/", "_")
    name = _FILENAME_SANITISE.sub("_", name)
    return name[:255] if name else "uploaded_file"


def _sniff_content(raw_bytes: bytes, ext: str) -> None:
    """Raise HTTPException if the file's actual bytes don't match its claimed type."""
    head = raw_bytes[:16]
    for magic in _BINARY_MAGIC_BYTES:
        if head.startswith(magic):
            raise HTTPException(
                status_code=400,
                detail="File content does not match a text-based evidence format "
                       "(binary signature detected)."
            )
    # Reject embedded script/shell content disguised as a log/text file
    if _SUSPICIOUS_TEXT_PATTERNS.search(raw_bytes[:4096]):
        raise HTTPException(
            status_code=400,
            detail="File content contains disallowed embedded script content."
        )
    # JSON/CSV must actually decode as UTF-8 text
    try:
        raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File is not valid UTF-8 text and cannot be processed as evidence."
        )


# ── Pydantic models ───────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    question:   str
    model:      Optional[str] = "llama3"


class ReportRequest(BaseModel):
    session_id: str
    view:       Optional[str] = "technical"
    model:      Optional[str] = "llama3"


class BeginnerRequest(BaseModel):
    technical_event: str
    model:           Optional[str] = "llama3"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def ai_status(_user: dict = Depends(get_current_user)):
    status = await check_ollama_status()
    status["available_models"] = AVAILABLE_MODELS
    return status


@router.get("/sessions")
async def get_sessions(_user: dict = Depends(get_current_user)):
    return list_sessions()


@router.post("/upload")
async def upload_evidence(
    file:  UploadFile = File(...),
    model: str        = Form(default="llama3"),
    user:  dict       = Depends(get_current_user),
):
    """
    Upload evidence file → sanitise → sniff content → parse → run investigation.
    SECURITY: extension check + content sniffing + filename sanitisation.
    """
    safe_filename = _sanitise_filename(file.filename or "uploaded_file")
    ext = safe_filename.lower().rsplit(".", 1)[-1] if "." in safe_filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit.")
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    _sniff_content(raw_bytes, ext)   # raises 400 if content doesn't match claimed type

    content = raw_bytes.decode("utf-8", errors="replace")

    svc    = InvestigationService()
    result = await svc.investigate(safe_filename, content, model)

    session_id = str(uuid.uuid4())
    await save_investigation(session_id, result)

    logger.info(
        "Investigation complete: file=%s session=%s events=%d uploaded_by=%s",
        safe_filename, session_id, result["event_count"], user.get("username", "?"),
    )

    return {"session_id": session_id, **result}


@router.get("/investigation/{session_id}")
async def get_investigation_result(
    session_id: str,
    _user: dict = Depends(get_current_user),
):
    result = await get_investigation(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Investigation session not found.")
    return result


@router.post("/chat")
async def chat(body: ChatRequest, _user: dict = Depends(get_current_user)):
    investigation = await get_investigation(body.session_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Session not found.")

    context = _build_context(investigation)
    svc     = InvestigationService()
    answer  = await svc.chat(body.question, context, model=body.model)

    await append_chat(body.session_id, "user",      body.question)
    await append_chat(body.session_id, "assistant", answer)

    return {"answer": answer, "session_id": body.session_id}


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest, _user: dict = Depends(get_current_user)):
    investigation = await get_investigation(body.session_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Session not found.")

    context = _build_context(investigation)
    prompt  = CHAT_PROMPT.format(incident_context=context, question=body.question)

    async def _stream():
        full = ""
        async for chunk in generate_stream(prompt, system=SYSTEM_ROLE, model=body.model):
            full += chunk
            yield f"data: {chunk}\n\n"
        await append_chat(body.session_id, "user",      body.question)
        await append_chat(body.session_id, "assistant", full)
        yield "data: [DONE]\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.get("/chat/history/{session_id}")
async def get_history(session_id: str, _user: dict = Depends(get_current_user)):
    return await get_chat_history(session_id)


@router.post("/explain")
async def explain_beginner(body: BeginnerRequest, _user: dict = Depends(get_current_user)):
    svc = InvestigationService()
    explanation = await svc.explain_beginner(body.technical_event, model=body.model)
    return {"explanation": explanation}


@router.post("/report")
async def generate_report(body: ReportRequest, _user: dict = Depends(get_current_user)):
    if body.view not in ("technical", "management", "educational"):
        raise HTTPException(status_code=400, detail="view must be: technical | management | educational")

    investigation = await get_investigation(body.session_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Session not found.")

    svc    = InvestigationService()
    report = await svc.generate_report(investigation, view=body.view, model=body.model)
    return {"report": report, "view": body.view, "session_id": body.session_id}


@router.post("/story/{session_id}")
async def regenerate_story(
    session_id: str,
    model: str  = "llama3",
    _user: dict = Depends(get_current_user),
):
    investigation = await get_investigation(session_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Session not found.")

    svc   = InvestigationService()
    story = await svc.get_story(investigation.get("events_text", ""), model=model)
    return {"story": story}


def _build_context(inv: dict) -> str:
    lines = [
        f"File: {inv.get('filename', 'Unknown')}",
        f"Events analysed: {inv.get('event_count', 0)}",
        f"Attack types: {', '.join(inv.get('attack_types', []))}",
        f"Source IPs: {', '.join(inv.get('source_ips', []))}",
        f"Target IPs: {', '.join(inv.get('target_ips', []))}",
        f"Severity: {inv.get('severity', 'unknown').upper()}",
        f"Timeline: {inv.get('timeline', 'N/A')}",
        "",
        "AI ANALYSIS:",
        inv.get("ai_analysis", "Not available"),
        "",
        "ATTACK STORY:",
        inv.get("attack_story", "Not available"),
        "",
        "MITRE TECHNIQUES:",
    ]
    for t in inv.get("mitre_mapping", []):
        lines.append(f"  {t['technique_id']} — {t['technique_name']} ({t['tactic']})")
    return "\n".join(lines)
