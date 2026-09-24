# Quantum Molecular Simulator

**Built with IBM Qiskit** | Demo application for IBM Tech Sales

> ⚠️ **DEMONSTRATION ENVIRONMENT** — All molecular Hamiltonians are illustrative (STO-3G minimal-basis literature values). Not suitable for real chemistry research. No real client data or PII.

---

## What it demonstrates

- **VQE (Variational Quantum Eigensolver)** for molecular ground-state energy
- **EfficientSU2** hardware-efficient ansatz (2 qubits, reps=1)
- **EstimatorV2** (V2 primitives, PUBs) — no measurements in Estimator circuits
- **Tri-mode backend**: local-ideal (exact) · local-noisy (Aer depolarizing) · cloud-qpu (IBM Quantum hardware)
- **Classical reference**: NumPy eigensolver diagonalises the exact 4×4 Hamiltonian — VQE converges to match it
- **Carbon Design System v11** (g100 theme) — looks like a scientific instrument

---

## Quick start (local dev)

```bash
# 1. Clone and setup
bash scripts/setup.sh

# 2. Start backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 3. Start frontend (new terminal)
cd frontend && npm run dev

# 4. Open browser
open http://localhost:5173
```

No IBM Quantum account needed for `local-ideal` and `local-noisy` modes.

---

## Project structure

```
demo-quantum-molecular-simulator/
├── backend/
│   ├── main.py                          FastAPI entry point
│   ├── config.py                        Pydantic settings
│   ├── routers/
│   │   ├── health.py                    GET /api/health
│   │   └── quantum.py                   /api/quantum/* endpoints
│   └── services/
│       ├── molecular_hamiltonians.py    Illustrative SparsePauliOp Hamiltonians
│       └── quantum_service.py           VQE: tri-mode dispatch, EfficientSU2, COBYLA
├── frontend/
│   └── src/
│       ├── App.jsx                      Carbon UI Shell (HeaderContainer, SideNav)
│       ├── pages/
│       │   ├── DashboardPage.jsx
│       │   ├── ProblemPage.jsx
│       │   ├── CircuitPage.jsx          Ansatz diagram + Hamiltonian Pauli terms
│       │   ├── RunPage.jsx              VQE execution + convergence chart
│       │   ├── ResultsPage.jsx          Results + NISQ honesty notes
│       │   └── ArchitecturePage.jsx     Mermaid diagram + component table
│       ├── components/DemoBanner.jsx    Mandatory synthetic-data disclaimer
│       ├── context/DemoContext.jsx      useReducer global state
│       └── services/api.js             Axios client
├── scripts/
│   ├── setup.sh
│   ├── verify-demo.sh                   End-to-end build+boot verification
│   └── check-compliance.sh
├── Dockerfile.frontend                  UBI9 nginx (DEPLOY_TARGET: openshift)
├── Dockerfile.backend                   UBI9 python-311
├── docker-compose.yml
└── .env.example
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status + active mode |
| GET | `/api/quantum/molecules` | Molecule catalogue |
| GET | `/api/quantum/hamiltonian?molecule=H2&bond_length=0.74` | Pauli terms + exact energy |
| GET | `/api/quantum/circuit?molecule=H2` | Ansatz circuit info |
| POST | `/api/quantum/run` | Run VQE simulation |

### VQE run request body
```json
{
  "molecule": "H2",
  "bond_length": 0.74,
  "mode": "local-ideal",
  "max_iter": 200,
  "seed": 42
}
```

---

## Backend modes

| Mode | Primitive | Account | Speed |
|------|-----------|---------|-------|
| `local-ideal` | `qiskit.primitives.StatevectorEstimator` | None | ~1–2s |
| `local-noisy` | `qiskit_aer.primitives.EstimatorV2` + depolarizing noise | None | ~5–15s |
| `cloud-qpu` | `qiskit_ibm_runtime.EstimatorV2` (Session) | IBM Quantum | Queue-dependent |

---

## Cloud QPU setup (optional)

1. Create an account at https://quantum.cloud.ibm.com
2. Copy your API key and instance CRN
3. Update `.env`:
   ```
   DEMO_MODE=cloud-qpu
   IBM_QUANTUM_API_KEY=your_api_key_here
   IBM_QUANTUM_INSTANCE=your_crn_here
   ```

⚠️ Cloud QPU uses a real Session and will consume credits/quota. Keep `max_iter` low (≤50) for demos.

---

## Container build (Apple Silicon / arm64 → amd64 cluster)

```bash
# Frontend
docker build --platform linux/amd64 -t qms-frontend:demo -f Dockerfile.frontend .

# Backend
docker build --platform linux/amd64 -t qms-backend:demo -f Dockerfile.backend .

# Or with docker compose:
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build
docker compose up
```

---

## Verification

```bash
bash scripts/verify-demo.sh    # backend API + npm run build
bash scripts/check-compliance.sh  # compliance gate
```

---

## Disclaimer

All molecular Hamiltonians in this demo are **illustrative**. Values are derived from publicly available STO-3G literature sources (Peruzzo 2014, Kandala 2017, Hempel 2018) for demonstration purposes only. The bond-length perturbation is a simple approximation. This application is **not suitable for chemistry research**.

Built with IBM Qiskit 2.4.1 · qiskit-aer 0.17.2 · qiskit-ibm-runtime 0.47.0 · IBM Carbon React v11
