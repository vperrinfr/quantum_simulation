#!/usr/bin/env bash
# verify-demo.sh — Boot backend + build frontend, assert green before handover
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Stage 1: Backend ==="
cd backend
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt

# Boot uvicorn in background
uvicorn main:app --port 8000 &
UVICORN_PID=$!
sleep 3

curl -fsS http://localhost:8000/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok', d"
echo "✅ /api/health OK"
curl -fsS "http://localhost:8000/api/quantum/molecules" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['molecules'])==3"
echo "✅ /api/quantum/molecules OK"
curl -fsS "http://localhost:8000/api/quantum/hamiltonian?molecule=H2&bond_length=0.74" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'exact_energy' in d"
echo "✅ /api/quantum/hamiltonian OK"
curl -fsS "http://localhost:8000/api/quantum/circuit?molecule=H2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['n_qubits']==2"
echo "✅ /api/quantum/circuit OK"
curl -fsS -X POST http://localhost:8000/api/quantum/run \
  -H "Content-Type: application/json" \
  -d '{"molecule":"H2","bond_length":0.74,"mode":"local-ideal","max_iter":50,"seed":42}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'final_energy' in d and 'exact_energy' in d; print(f'VQE={d[\"final_energy\"]:.6f} exact={d[\"exact_energy\"]:.6f}')"
echo "✅ /api/quantum/run (VQE) OK"

kill $UVICORN_PID 2>/dev/null || true
deactivate
cd "$ROOT"

echo ""
echo "=== Stage 2: Frontend build ==="
cd frontend
npm ci
npm run build
echo "✅ npm run build OK"
cd "$ROOT"

echo ""
echo "=== ALL STAGES PASSED ==="
