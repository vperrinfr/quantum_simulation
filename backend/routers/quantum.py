"""FastAPI routers for quantum endpoints — extended with sweep and ISA stats."""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from config import settings
from services.quantum_service import run_vqe, get_circuit_info
from services.molecular_hamiltonians import MOLECULES, exact_ground_state_energy, build_hamiltonian
from services.sweep_service import run_sweep, get_isa_circuit_stats, FAKE_BACKENDS

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


class SweepRequest(BaseModel):
    molecule: str = Field(default="H2", description="H2, LiH, or H2O")
    r_min: float = Field(default=0.3, gt=0.0, le=6.0)
    r_max: float = Field(default=2.5, gt=0.0, le=6.0)
    r_step: float = Field(default=0.1, ge=0.05, le=0.5)
    max_iter: int = Field(default=80, ge=10, le=400)
    seed: int = Field(default=42, ge=0)
    fake_backend: str = Field(default="FakeNairobi")
    include_noisy: bool = Field(default=True)
    include_mitigated: bool = Field(default=True)


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


@router.get("/fake-backends")
def list_fake_backends():
    """Return the list of available local fake backends (no account needed)."""
    return {"fake_backends": list(FAKE_BACKENDS.keys())}


@router.get("/circuit-isa")
def get_circuit_isa(molecule: str, fake_backend: str = "FakeNairobi"):
    """
    Transpile the ansatz to the ISA gate set of the given fake backend and return:
      - original ansatz depth vs transpiled ISA depth
      - gate counts per operation type
      - CX/CNOT count specifically
      - SparsePauliOp Hamiltonian string
      - text diagrams of ansatz and ISA circuit
    Does NOT run any simulation.
    """
    if molecule not in MOLECULES:
        raise HTTPException(400, f"Unknown molecule '{molecule}'.")
    if fake_backend not in FAKE_BACKENDS:
        raise HTTPException(400, f"Unknown fake backend '{fake_backend}'. Choose from: {list(FAKE_BACKENDS.keys())}")
    try:
        return get_isa_circuit_stats(molecule, fake_backend)
    except Exception as exc:
        logger.exception("circuit-isa error")
        raise HTTPException(500, str(exc)) from exc


@router.post("/sweep")
def sweep_bond_lengths(req: SweepRequest):
    """
    Run a VQE bond-dissociation curve sweep.

    Sweeps bond lengths from r_min to r_max in r_step increments and returns
    energy values for the requested series (ideal, exact, noisy, mitigated).
    All runs are fully local — no IBM Quantum account required.

    The noisy and mitigated series use AerSimulator.from_backend() with a
    real-device noise model from the selected fake backend.
    Mitigation uses qiskit_ibm_runtime EstimatorV2 resilience_level=1 (T-REx).
    """
    if req.molecule not in MOLECULES:
        raise HTTPException(400, f"Unknown molecule '{req.molecule}'.")
    if req.r_min >= req.r_max:
        raise HTTPException(400, "r_min must be less than r_max.")
    if req.fake_backend not in FAKE_BACKENDS:
        raise HTTPException(
            400,
            f"Unknown fake backend '{req.fake_backend}'. Choose from: {list(FAKE_BACKENDS.keys())}"
        )
    n_points = int((req.r_max - req.r_min) / req.r_step) + 1
    if n_points > 60:
        raise HTTPException(
            400,
            f"Too many sweep points ({n_points}). Reduce range or increase step size (max 60 points)."
        )

    logger.info(
        "Bond sweep: molecule=%s r=[%.2f, %.2f] step=%.2f noisy=%s mitigated=%s backend=%s",
        req.molecule, req.r_min, req.r_max, req.r_step,
        req.include_noisy, req.include_mitigated, req.fake_backend,
    )

    try:
        return run_sweep(
            molecule=req.molecule,
            r_min=req.r_min,
            r_max=req.r_max,
            r_step=req.r_step,
            max_iter=req.max_iter,
            seed=req.seed,
            fake_backend_name=req.fake_backend,
            include_noisy=req.include_noisy,
            include_mitigated=req.include_mitigated,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.exception("sweep error")
        raise HTTPException(500, f"Sweep failed: {exc}") from exc


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
