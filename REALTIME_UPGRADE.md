# Real-Time SIEM Upgrade — Deployment Guide

## What Was Added

| Component | File | Purpose |
|---|---|---|
| Event Bus | `backend/app/streaming/event_bus.py` | Thread-safe async queue; fans events to all WS clients |
| Host Streamer | `backend/app/streaming/host_streamer.py` | `tail -f` / watchdog / Windows event log real-time monitoring |
| Packet Sniffer | `backend/app/streaming/packet_sniffer.py` | Scapy / PyShark live capture + 4-type threat detection |
| WebSocket Manager | `backend/app/streaming/websocket_manager.py` | FastAPI `/ws` endpoint; broadcasts to all connected clients |
| WS Hook | `frontend/src/hooks/useRealtimeStream.js` | React hook: auto-connect, reconnect, per-type state lists |
| Live Log Terminal | `frontend/src/components/LiveLogTerminal.jsx` | Terminal-style scrolling log viewer |
| Live Packet Table | `frontend/src/components/LivePacketTable.jsx` | Real-time packet table with threat badges |
| Threat Alert Feed | `frontend/src/components/ThreatAlertFeed.jsx` | Toast popups + scrolling threat feed |
| Connection Monitor | `frontend/src/components/ConnectionMonitorPanel.jsx` | WS status, stats, filter, event-rate chart |
| Dashboard | `frontend/src/pages/Dashboard.jsx` | Tabbed: Overview / Live Logs / Network / Threats |
| main.py | `backend/app/main.py` | Starts streaming workers at app lifespan |

---

## Quick Start (Local Dev)

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# For live packet capture (Scapy) you need root / capabilities:
sudo setcap cap_net_raw,cap_net_admin+eip $(which python)
# OR just run as root in dev:
sudo uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8000 \
REACT_APP_WS_URL=ws://localhost:8000 \
npm start
```

---

## Docker (Recommended for Production)

```bash
# Copy env file
cp .env.example .env
# Edit .env: set SECRET_KEY, ENCRYPTION_KEY

docker-compose up --build
```

> Docker Compose uses `network_mode: host` for the backend so Scapy can
> access real network interfaces. `NET_ADMIN` and `NET_RAW` capabilities
> are granted for raw socket access.

---

## Packet Capture Options

| Library | Privilege Needed | Install |
|---|---|---|
| **Scapy** (recommended) | `root` or `cap_net_raw` | `pip install scapy` |
| **PyShark** (tshark wrapper) | tshark must be installed | `pip install pyshark` + `apt install tshark` |
| **/proc/net fallback** | None | Built-in (Linux only, no packet payload) |

The sniffer auto-selects the best available option at startup. Check backend logs:
```
INFO  soc_dashboard.packet_sniffer  Using Scapy for live packet capture.
```

---

## Threat Detection Logic

| Threat | Trigger | Severity |
|---|---|---|
| **Port Scan** | ≥15 unique dst-ports from same IP in 60 s | Warning |
| **DDoS / Flood** | ≥200 packets from same IP in 10 s | Critical |
| **Brute Force** | ≥10 SYN to port 22 or 3389 in 30 s | Error |
| **DNS Exfiltration** | ≥50 DNS queries/min from same IP | Warning |

All detected threats are:
1. Published to the event bus (instant WS delivery)
2. Persisted to SQLite as log entries

---

## WebSocket Protocol

Connect to: `ws://localhost:8000/ws`

### Server → Client events

```json
{ "type": "connected",  "message": "...", "timestamp": "..." }
{ "type": "host_log",   "source": "Auth/SSH", "severity": "warning", "message": "...", ... }
{ "type": "packet",     "protocol": "TCP", "src_ip": "...", "dst_ip": "...", "dst_port": 22, ... }
{ "type": "threat",     "threat_type": "brute_force", "severity": "error", ... }
{ "type": "heartbeat",  "timestamp": "..." }
```

### Client → Server messages

```json
{ "type": "ping" }                         // → { "type": "pong" }
{ "type": "filter", "severity": "critical" } // server-side filter
{ "type": "filter", "severity": "" }         // clear filter
```

---

## Folder Structure (New Files Only)

```
backend/app/
└── streaming/
    ├── __init__.py
    ├── event_bus.py          ← async broadcast queue
    ├── host_streamer.py      ← tail -f / watchdog / Windows event log
    ├── packet_sniffer.py     ← Scapy / PyShark / /proc/net
    └── websocket_manager.py  ← FastAPI /ws endpoint

frontend/src/
├── hooks/
│   └── useRealtimeStream.js  ← WS connection hook
└── components/
    ├── LiveLogTerminal.jsx      ← terminal log viewer
    ├── LivePacketTable.jsx      ← live packet table
    ├── ThreatAlertFeed.jsx      ← toasts + threat feed
    └── ConnectionMonitorPanel.jsx ← WS status + rate chart
```

---

## Troubleshooting

**No logs streaming:**
- Check backend logs for `tail -f` or watchdog startup messages
- Ensure the process has read permission to `/var/log/syslog` etc.
- On macOS, grant Full Disk Access to the terminal/IDE in System Preferences

**No packets captured:**
- Run backend as root or set `cap_net_raw` capability
- Install Scapy: `pip install scapy`
- Install tshark as fallback: `apt install tshark`

**WebSocket disconnects immediately:**
- Check CORS origins in `config.py` include `ws://localhost:3000`
- Ensure `REACT_APP_WS_URL` env var points to the correct backend host

**High CPU from Scapy:**
- Scapy captures all IP traffic by default. Add a BPF filter:
  Edit `packet_sniffer.py` → `sniff(filter="tcp port 80 or tcp port 443 or tcp port 22")`
