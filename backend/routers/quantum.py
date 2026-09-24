"""FastAPI routers for quantum endpoints."""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import settings
from services.quantum_service import run_vqe, get_circuit_info
from services.molecular_hamiltonians import MOLECULES, exact_ground_state_energy, build_hamiltonian

router = APIRouter(prefix="/api/quantum", tags=["quantum"])
logger = logging.getLogger("quantum_router")


# ----------------------------------------------------------------- schemas
class VQERequest(BaseModel):
    molecule: str = Field(..., description="H2, LiH, or H2O")
    bond_length: float = Field(..., gt=0.0, le=6.0)
    mode: str | None = Field(
        default=None,
        description="local-ideal | local-noisy | cloud-qpu. Defaults to EXECUTION_TARGET from .env",
    )
    max_iter: int = Field(default=200, ge=10, le=1000)
    seed: int = Field(default=42, ge=0)
    shots: int | None = Field(default=None, description="Shot count; defaults to DEFAULT_SHOTS from .env")


class HamiltonianResponse(BaseModel):
    molecule: str
    bond_length: float
    pauli_terms: list[dict]
    exact_energy: float
    n_qubits: int


# ----------------------------------------------------------------- endpoints
@router.get("/molecules")
def list_molecules():
    """Return the catalogue of illustrative molecules available for simulation."""
    return {
        "molecules": [
            {
                "key": k,
                **{f: v[f] for f in ["label", "formula", "description", "n_qubits",
                                       "reference_bond_length", "bond_length_range",
                                       "exact_energy_hartree", "literature_ref"]},
            }
            for k, v in MOLECULES.items()
        ],
        "disclaimer": (
            "ILLUSTRATIVE HAMILTONIANS ONLY. Not suitable for real chemistry research. "
            "Values derived from STO-3G minimal-basis literature sources for demo purposes."
        ),
    }


@router.get("/hamiltonian")
def get_hamiltonian(molecule: str, bond_length: float):
    """Return the Pauli decomposition and exact energy for a molecule at a given bond length."""
    if molecule not in MOLECULES:
        raise HTTPException(400, f"Unknown molecule '{molecule}'. Choose H2, LiH, or H2O.")
    try:
        hamiltonian, _ = build_hamiltonian(molecule, bond_length)
        exact_e = exact_ground_state_energy(molecule, bond_length)
        pauli_terms = [
            {"pauli": str(p), "coeff": float(c.real)}
            for p, c in zip(hamiltonian.paulis, hamiltonian.coeffs)
        ]
        return HamiltonianResponse(
            molecule=molecule,
            bond_length=bond_length,
            pauli_terms=pauli_terms,
            exact_energy=exact_e,
            n_qubits=MOLECULES[molecule]["n_qubits"],
        )
    except Exception as exc:
        logger.exception("hamiltonian error")
        raise HTTPException(500, str(exc)) from exc


@router.get("/circuit")
def get_circuit(molecule: str):
    """Return ansatz circuit metadata and text diagram."""
    if molecule not in MOLECULES:
        raise HTTPException(400, f"Unknown molecule '{molecule}'.")
    try:
        return get_circuit_info(molecule)
    except Exception as exc:
        logger.exception("circuit error")
        raise HTTPException(500, str(exc)) from exc


@router.post("/run")
def run_simulation(req: VQERequest):
    """
    Execute a full VQE simulation.

    - local-ideal  : exact StatevectorEstimator, no IBM account needed
    - local-noisy  : Aer depolarizing noise model, no IBM account needed
    - cloud-qpu    : real IBM Quantum hardware (requires credentials in .env)

    Mode defaults to EXECUTION_TARGET from .env (currently effective_mode).
    Shots default to DEFAULT_SHOTS from .env.
    ALLOW_PAID_QPU=false blocks cloud-qpu automatically.
    """
    if req.molecule not in MOLECULES:
        raise HTTPException(400, f"Unknown molecule '{req.molecule}'.")

    # Resolve mode: request override → env effective_mode
    resolved_mode = req.mode if req.mode else settings.effective_mode
    resolved_shots = req.shots if req.shots else settings.DEFAULT_SHOTS

    # Guard: never silently charge QPU credits
    if resolved_mode == "cloud-qpu" and not settings.ALLOW_PAID_QPU:
        raise HTTPException(
            403,
            "cloud-qpu mode is disabled (ALLOW_PAID_QPU=false in .env). "
            "Set ALLOW_PAID_QPU=true and provide IBM_QUANTUM_API_KEY to enable.",
        )
    if resolved_mode == "cloud-qpu" and not settings.IBM_QUANTUM_API_KEY:
        raise HTTPException(
            422,
            "IBM_QUANTUM_API_KEY is not set. Configure it in .env to use cloud-qpu mode.",
        )

    logger.info(
        "VQE run: molecule=%s r=%.3f mode=%s shots=%d max_iter=%d seed=%d",
        req.molecule, req.bond_length, resolved_mode, resolved_shots, req.max_iter, req.seed,
    )

    try:
        result = run_vqe(
            molecule=req.molecule,
            bond_length=req.bond_length,
            mode=resolved_mode,
            max_iter=req.max_iter,
            seed=req.seed,
            ibm_api_key=settings.IBM_QUANTUM_API_KEY,
            ibm_instance=settings.IBM_QUANTUM_INSTANCE,
        )
        result["resolved_mode"] = resolved_mode
        result["resolved_shots"] = resolved_shots
        return result
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("VQE run error")
        raise HTTPException(500, f"VQE simulation failed: {exc}") from exc
