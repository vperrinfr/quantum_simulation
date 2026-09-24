#!/usr/bin/env bash
# setup.sh — first-run setup
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Quantum Molecular Simulator — Setup ==="

# Check deps
command -v node   >/dev/null || { echo "ERROR: node not found. Install Node.js 20+"; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found. Install Python 3.11+"; exit 1; }

# .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from .env.example"
else
  echo "ℹ  .env already exists"
fi

# Backend deps
echo "Installing backend dependencies…"
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
deactivate
cd "$ROOT"
echo "✅ Backend dependencies installed"

# Frontend deps
echo "Installing frontend dependencies…"
cd frontend
npm ci
cd "$ROOT"
echo "✅ Frontend dependencies installed"

echo ""
echo "=== Setup complete ==="
echo "Start backend : cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "Start frontend: cd frontend && npm run dev"
echo "Open browser  : http://localhost:5173"
