"""Health router."""
from fastapi import APIRouter
from config import settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "demo_mode": settings.DEMO_MODE,
        "effective_mode": settings.effective_mode,
        "quantum_mode": settings.QUANTUM_MODE,
        "execution_target": settings.EXECUTION_TARGET,
        "allow_paid_qpu": settings.ALLOW_PAID_QPU,
        "default_shots": settings.DEFAULT_SHOTS,
        "version": "1.0.0",
        "service": "Quantum Molecular Simulator",
        "disclaimer": "ILLUSTRATIVE DEMO. All molecular Hamiltonians are synthetic/literature-based. No real client data.",
    }
