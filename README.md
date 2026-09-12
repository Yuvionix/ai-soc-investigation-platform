# SOC Real-Time SIEM Dashboard 

An offline-first Security Operations Center (SOC) dashboard. It ingests real host and network telemetry from the machine it runs on, streams it live to a React frontend over WebSockets, and includes an AI Investigation Center that analyzes uploaded evidence files using a local LLM (Ollama) with a fully offline rule-based fallback.

This README reflects the **actual current state of the code**, not the original aspirational project scaffold. Where a feature is partially implemented, that's called out explicitly below so nobody is surprised in review or during onboarding.

---

## What this project actually does

- **Real host/network log collection** — tails real OS logs (`syslog`, `auth.log`, `journalctl`, Windows Event Log) and network state (`/proc/net`, firewall logs) from the host the backend runs on, and stores them in SQLite.
- **Live packet capture & threat detection** — via Scapy (falls back to PyShark, then a `/proc/net`-only mode with no root required) with four rule-based detectors: port scan, DDoS/flood, brute force (SSH/RDP), DNS exfiltration.
- **Real-time streaming** — an internal event bus fans out host/network/threat events to every connected client over a JWT-authenticated WebSocket (`/ws?token=<jwt>`).
- **AI Investigation Center** — analysts upload a JSON/CSV/TXT/LOG evidence file; the backend parses it, maps it to MITRE ATT&CK techniques, and generates technical/executive/beginner analysis, an attack-story reconstruction, and role-specific reports. It calls a local Ollama instance if one is running; if not, it produces the same structure of output from a built-in rule-based knowledge base — no external API, no internet connection required either way.
- **Alerts & Incidents workflow** — analysts can view, update, escalate, and annotate alerts/incidents, with every mutating action written to an audit log.
- **Authentication & RBAC** — JWT-based login with two roles (`Admin`, `Analyst`); admin-only endpoints for CSV export and audit log review.

## What this project does *not* fully do yet

Being upfront about this matters more than it looks polished:

- **Alerts, incidents, and feedback are not persisted to the database.** `schema.sql` defines full tables for them (and even for AI investigation sessions), but only the `logs` table is actually wired up through SQLAlchemy at startup. Alerts/incidents/feedback currently live in in-memory Python lists seeded with demo data — **they reset on every backend restart.**
- **AI investigation sessions are also in-memory only** (keyed by UUID in a process-local dict). Restarting the backend loses all uploaded investigations and chat history. The DB schema for this already exists; the persistence layer to use it does not, yet.
- `/api/feedback` and `/api/timeline` are **not currently behind authentication**, unlike almost every other route. This looks like an oversight rather than a deliberate design choice and should be fixed before this is exposed beyond localhost.
- Password hashing uses a fixed, shared salt across the two built-in accounts (`admin`, `analyst`). Acceptable for a two-user local demo; not something to carry into a multi-tenant deployment.
- `docs/final_report.pdf` is a placeholder and is currently empty.
- The Ollama integration assumes a model is already pulled and running locally (`http://127.0.0.1:11434`); the app does not install or manage Ollama itself.

---

## Architecture

```
React Frontend (port 3000)
      │  REST (JWT Bearer)         │ WebSocket (/ws?token=jwt)
      ▼                            ▼
FastAPI Backend (port 8000)
      │
      ├── Host Log Collector ──┐
      ├── Packet Sniffer ──────┼──▶ Event Bus (asyncio.Queue) ──▶ WS fan-out to clients
      ├── Threat→Alert Bridge ─┘         │
      │                                  ▼
      ├── SQLite (logs table only, via SQLAlchemy async)
      │
      └── AI Investigation Service
              ├── Ollama (local LLM, if running)
              └── Offline rule-based fallback engine (always available)
```

## Tech stack

**Backend:** FastAPI, SQLAlchemy 2.0 (async, aiosqlite), Pydantic v2, python-jose (JWT), slowapi (rate limiting), Scapy/PyShark/watchdog (streaming), cryptography (Fernet + PBKDF2), pytest.

**Frontend:** React 18, React Router v6, Axios, native WebSocket via a custom `useRealtimeStream` hook.

**Infra:** Docker Compose (backend + frontend, both bound to `127.0.0.1` only), SQLite (no external DB server required).

---

## Getting started

### Prerequisites
- Python 3.9+ (project is tested against 3.11 in Docker)
- Node.js 16+
- Docker & Docker Compose (optional but recommended)
- [Ollama](https://ollama.com) running locally with a model pulled (optional — the AI features work without it, using the offline fallback engine)

### Option 1 — Docker Compose
```bash
cp .env.example .env
# Edit .env: set SECRET_KEY and ENCRYPTION_KEY to real values before anything but local dev
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

Note: live packet capture needs `NET_RAW`/`NET_ADMIN` capabilities, already granted to the backend container in `docker-compose.yml`. Remove that if you don't need live sniffing, to reduce attack surface.

### Option 2 — Local development

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Live packet capture requires elevated privileges:
sudo setcap cap_net_raw,cap_net_admin+eip $(which python)   # or run uvicorn with sudo in dev
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 REACT_APP_WS_URL=ws://localhost:8000 npm start
```

### Default credentials

Two accounts are seeded via environment variables (`SOC_ADMIN_PASSWORD`, `SOC_ANALYST_PASSWORD` in `config.py`, default `Admin@123` / `Analyst@123`):

| Username | Role | Notes |
|---|---|---|
| `admin` | Admin | Can export CSVs and view the audit log |
| `analyst` | Analyst | Standard dashboard access |

**Change these passwords via `.env` before running anywhere beyond your own machine.**

---

## Project structure

```
backend/app/
├── api/            # Route handlers (auth, logs, alerts, incidents, timeline, feedback, audit, ai_investigation)
├── services/       # Business logic (mostly in-memory for alerts/incidents; DB-backed for logs)
├── models/         # Pydantic schemas + the one SQLAlchemy ORM model (LogORM)
├── database/       # SQLAlchemy async engine setup + schema.sql (ahead of current code — see gaps above)
├── security/       # Fernet encryption, SHA-256 hashing, integrity checking
├── streaming/       # Event bus, host/network collectors' real-time wiring, WebSocket manager
├── collectors/     # Real host log & network log collection from the OS
├── ai/             # Evidence parsing, MITRE mapping, prompt templates, Ollama client + offline fallback
├── audit/          # Analyst action audit logging
└── simulation/     # Replay engine for scenario playback

frontend/src/
├── api/            # Axios clients (apiClient.js, aiClient.js)
├── context/        # AuthContext (JWT session handling)
├── hooks/          # useRealtimeStream (WebSocket connection + reconnect)
├── components/     # Dashboard panels, live-stream widgets, AI-specific components (components/ai/)
└── pages/          # Dashboard, ReplayMode, AI Investigation Center
```

---

## Testing

```bash
cd backend
pytest
```

`backend/tests/test_api.py` includes an explicit regression test asserting protected routes return `401` when unauthenticated — if you touch auth dependencies, run this. `backend/tests/test_threat_detection.py` covers the packet-sniffer threat rules.

Frontend tests: `cd frontend && npm test` (Create React App default test runner; coverage here is currently minimal).

---

## Security notes for contributors

- CORS is intentionally restricted to specific methods/headers — don't widen it to `["*"]`.
- The WebSocket endpoint requires a JWT passed as `?token=<jwt>` because browsers can't send custom headers during the WS handshake. Don't remove this check.
- File uploads to `/api/ai/upload` are validated by extension, magic-byte sniffing, and content pattern matching before parsing — if you add a new evidence format, extend `_sniff_content` and `ALLOWED_EXTENSIONS` together, not just one.
- Encryption keys are derived via PBKDF2 (480,000 iterations) with a randomly generated salt persisted to `data/encryption_salt.bin`. Don't regenerate that file in a running deployment — it will make previously encrypted data undecryptable.
- Default secrets in `config.py` are placeholders. Always override `SECRET_KEY` and `ENCRYPTION_KEY` via `.env` outside of local development.

## Known priorities for the next pass

1. Wire alerts/incidents/feedback to the SQLite tables that already exist in `schema.sql`, so they survive a restart.
2. Persist AI investigation sessions and chat history to the `ai_investigations` / `ai_chat_messages` tables instead of the in-process dict.
3. Add auth guards to `/api/feedback` and `/api/timeline`.
4. Move password hashing to a per-user salt if this ever supports more than the two built-in accounts.
5. Fill in `docs/final_report.pdf`.

---

## License

MIT — see `LICENSE`.
