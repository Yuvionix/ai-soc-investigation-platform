#!/bin/bash
# Setup script for Offline SOC Real-Time SIEM Dashboard
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  SOC Real-Time SIEM — Setup Script v4      ${NC}"
echo -e "${CYAN}=============================================${NC}\n"

# ── .env ──────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ .env created from .env.example${NC}"
    echo -e "${YELLOW}  → Edit .env and set SECRET_KEY and ENCRYPTION_KEY before running${NC}"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi

# ── Directories ───────────────────────────────────────────────────────────────
mkdir -p data/integrity_hashes backend/logs frontend/build
echo -e "${GREEN}✓ Directories created${NC}"

# ── Backend ───────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}Setting up backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null

echo "Installing Python dependencies (including greenlet, aiosqlite)..."
pip install --upgrade pip -q
pip install -r ../requirements.txt greenlet aiosqlite -q
echo -e "${GREEN}✓ Python dependencies installed${NC}"
cd ..

# ── Frontend ──────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}Setting up frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}=============================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo -e "\n${CYAN}To start the project:${NC}"
echo -e "  ${YELLOW}Terminal 1 (Backend):${NC}"
echo    "    cd backend"
echo    "    source venv/bin/activate"
echo    "    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
echo -e "\n  ${YELLOW}Terminal 2 (Frontend):${NC}"
echo    "    cd frontend"
echo    "    REACT_APP_API_URL=http://127.0.0.1:8000 REACT_APP_WS_URL=ws://127.0.0.1:8000 npm start"
echo -e "\n  ${YELLOW}Or with Docker:${NC}"
echo    "    docker-compose up --build"
echo -e "\n  Dashboard → http://localhost:3000"
echo    "  API Docs  → http://localhost:8000/docs"
