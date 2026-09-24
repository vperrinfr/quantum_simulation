"""
VQE quantum service — tri-mode:
  local-ideal : qiskit.primitives.StatevectorEstimator (exact, noiseless)
  local-noisy : qiskit_aer.primitives.EstimatorV2 with a depolarizing noise model
  cloud-qpu   : qiskit_ibm_runtime.EstimatorV2 inside a Session on IBM Quantum hardware

VQE kernel:
  Ansatz   : efficient_su2 (hardware-efficient, 2 qubits, reps=1) — function API (Qiskit 2.x)
  Optimizer: SciPy COBYLA with a two-phase schedule (coarse rhobeg=0.5, fine rhobeg=0.05)
  Post-proc: per-iteration energy history returned to caller

All primitives are V2 (PUB-based). EstimatorV2 circuits must NOT have measurements.
Observables are applied via SparsePauliOp.apply_layout() after transpilation.
"""

from __future__ import annotations
import time
import logging
from typing import Any

import numpy as np
from scipy.optimize import minimize

from qiskit import QuantumCircuit
from qiskit.circuit.library import efficient_su2   # function API — no deprecation warning
from qiskit.quantum_info import SparsePauliOp
from qiskit.transpiler import generate_preset_pass_manager

logger = logging.getLogger("quantum_service")


# ------------------------------------------------------------------ helpers
def _build_ansatz(n_qubits: int) -> QuantumCircuit:
    """Return an efficient_su2 ansatz with reps=1 (8 free params for n=2)."""
    return efficient_su2(num_qubits=n_qubits, reps=1, entanglement="linear")


def _initial_params(ansatz: QuantumCircuit, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.uniform(-np.pi, np.pi, ansatz.num_parameters)


def _cobyla_minimize(cost_fn, x0: np.ndarray, max_iter: int) -> Any:
    """
    Two-phase COBYLA: coarse exploration then fine convergence.
    Phase 1: rhobeg=0.5, half the budget
    Phase 2: rhobeg=0.05, remaining budget (tighter neighbourhood = faster final convergence)
    """
    split = max(10, max_iter // 2)

    r1 = minimize(
        cost_fn, x0, method="COBYLA",
        options={"maxiter": split, "rhobeg": 0.5, "disp": False},
    )
    r2 = minimize(
        cost_fn, r1.x, method="COBYLA",
        options={"maxiter": max_iter - split, "rhobeg": 0.05, "disp": False},
    )
    # Merge nfev counts — minimizer resets per call
    r2.nfev = r1.nfev + r2.nfev
    return r2


# ---------------------------------------------------------------- local-ideal
def _run_vqe_ideal(
    hamiltonian: SparsePauliOp,
    n_qubits: int,
    max_iter: int,
    seed: int,
) -> dict[str, Any]:
    """VQE with qiskit.primitives.StatevectorEstimator — exact, zero noise."""
    from qiskit.primitives import StatevectorEstimator

    ansatz = _build_ansatz(n_qubits)
    estimator = StatevectorEstimator()
    energy_history: list[float] = []

    def cost_fn(params: np.ndarray) -> float:
        # StatevectorEstimator PUB: (circuit, observables, parameter_values)
        pub = (ansatz, [hamiltonian], [params])
        result = estimator.run([pub]).result()
        energy = float(result[0].data.evs[0])
        energy_history.append(energy)
        return energy

    x0 = _initial_params(ansatz, seed)
    t0 = time.perf_counter()
    opt_result = _cobyla_minimize(cost_fn, x0, max_iter)
    elapsed = time.perf_counter() - t0

    return {
        "final_energy": float(opt_result.fun),
        "optimal_params": opt_result.x.tolist(),
        "n_function_evals": int(opt_result.nfev),
        "converged": bool(opt_result.success),
        "energy_history": energy_history,
        "elapsed_seconds": round(elapsed, 3),
        "mode": "local-ideal",
        "backend_name": "StatevectorEstimator",
        "n_qubits": n_qubits,
        "n_params": int(ansatz.num_parameters),
    }


# ---------------------------------------------------------------- local-noisy
def _run_vqe_noisy(
    hamiltonian: SparsePauliOp,
    n_qubits: int,
    max_iter: int,
    seed: int,
    noise_level: float = 0.005,
) -> dict[str, Any]:
    """
    VQE with qiskit_aer EstimatorV2 and a simple depolarizing noise model.
    Simulates what happens on a real NISQ device.
    """
    from qiskit_aer.primitives import EstimatorV2 as AerEstimator
    from qiskit_aer.noise import NoiseModel, depolarizing_error
    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

    ansatz = _build_ansatz(n_qubits)

    # Build a simple depolarizing noise model
    noise_model = NoiseModel()
    noise_model.add_all_qubit_quantum_error(
        depolarizing_error(noise_level, 1), ["u", "rx", "ry", "rz", "h", "x"]
    )
    noise_model.add_all_qubit_quantum_error(
        depolarizing_error(noise_level * 10, 2), ["cx", "cz", "ecr"]
    )

    options = {
        "backend_options": {
            "noise_model": noise_model,
            "seed_simulator": seed,
        },
        "run_options": {"shots": 4096},
    }
    estimator = AerEstimator(options=options)

    # Transpile ansatz for AerSimulator
    from qiskit_aer import AerSimulator
    sim_backend = AerSimulator(noise_model=noise_model, seed_simulator=seed)
    pm = generate_preset_pass_manager(optimization_level=1, backend=sim_backend)
    isa_ansatz = pm.run(ansatz)
    isa_hamiltonian = hamiltonian.apply_layout(isa_ansatz.layout)

    energy_history: list[float] = []

    def cost_fn(params: np.ndarray) -> float:
        pub = (isa_ansatz, [isa_hamiltonian], [params])
        result = estimator.run([pub]).result()
        energy = float(result[0].data.evs[0])
        energy_history.append(energy)
        return energy

    x0 = _initial_params(ansatz, seed)
    t0 = time.perf_counter()
    opt_result = _cobyla_minimize(cost_fn, x0, max_iter)
    elapsed = time.perf_counter() - t0

    return {
        "final_energy": float(opt_result.fun),
        "optimal_params": opt_result.x.tolist(),
        "n_function_evals": int(opt_result.nfev),
        "converged": bool(opt_result.success),
        "energy_history": energy_history,
        "elapsed_seconds": round(elapsed, 3),
        "mode": "local-noisy",
        "backend_name": f"AerSimulator (depolarizing p={noise_level})",
        "n_qubits": n_qubits,
        "n_params": int(ansatz.num_parameters),
    }


# ---------------------------------------------------------------- cloud-qpu
def _run_vqe_cloud(
    hamiltonian: SparsePauliOp,
    n_qubits: int,
    max_iter: int,
    seed: int,
    api_key: str,
    instance: str | None,
) -> dict[str, Any]:
    """
    VQE on a real IBM Quantum backend via qiskit_ibm_runtime.EstimatorV2
    inside a Session for low-latency iterative calls.

    Requires IBM Quantum Platform credentials. Channel: ibm_quantum_platform.
    """
    from qiskit_ibm_runtime import QiskitRuntimeService, Session
    from qiskit_ibm_runtime import EstimatorV2 as RuntimeEstimator

    service = QiskitRuntimeService(
        token=api_key,
        instance=instance,
    )
    backend = service.least_busy(operational=True, simulator=False)
    logger.info("Cloud QPU: selected backend %s", backend.name)

    ansatz = _build_ansatz(n_qubits)
    pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
    isa_ansatz = pm.run(ansatz)
    isa_hamiltonian = hamiltonian.apply_layout(isa_ansatz.layout)

    energy_history: list[float] = []
    t0 = time.perf_counter()

    with Session(backend=backend) as session:
        estimator = RuntimeEstimator(mode=session)
        estimator.options.default_shots = 2048
        estimator.options.resilience_level = 1  # measurement error mitigation

        def cost_fn(params: np.ndarray) -> float:
            pub = (isa_ansatz, [isa_hamiltonian], [params])
            result = estimator.run([pub]).result()
            energy = float(result[0].data.evs[0])
            energy_history.append(energy)
            return energy

        x0 = _initial_params(ansatz, seed)
        opt_result = minimize(
            cost_fn, x0, method="COBYLA",
            options={"maxiter": max_iter, "rhobeg": 0.5, "disp": False},
        )

    elapsed = time.perf_counter() - t0
    return {
        "final_energy": float(opt_result.fun),
        "optimal_params": opt_result.x.tolist(),
        "n_function_evals": int(opt_result.nfev),
        "converged": bool(opt_result.success),
        "energy_history": energy_history,
        "elapsed_seconds": round(elapsed, 3),
        "mode": "cloud-qpu",
        "backend_name": backend.name,
        "n_qubits": n_qubits,
        "n_params": int(ansatz.num_parameters),
    }


# ----------------------------------------------------------------- public API
def run_vqe(
    molecule: str,
    bond_length: float,
    mode: str,
    max_iter: int = 200,
    seed: int = 42,
    ibm_api_key: str | None = None,
    ibm_instance: str | None = None,
) -> dict[str, Any]:
    """
    Entry point. Dispatches to local-ideal / local-noisy / cloud-qpu.
    Returns a result dict with energy_history, final_energy, mode, etc.
    """
    from services.molecular_hamiltonians import build_hamiltonian, exact_ground_state_energy, MOLECULES

    if molecule not in MOLECULES:
        raise ValueError(f"Unknown molecule: {molecule}. Must be one of {list(MOLECULES)}")

    n_qubits = MOLECULES[molecule]["n_qubits"]
    hamiltonian, _ = build_hamiltonian(molecule, bond_length)
    exact_energy = exact_ground_state_energy(molecule, bond_length)

    if mode == "local-ideal":
        result = _run_vqe_ideal(hamiltonian, n_qubits, max_iter, seed)
    elif mode == "local-noisy":
        result = _run_vqe_noisy(hamiltonian, n_qubits, max_iter, seed)
    elif mode == "cloud-qpu":
        if not ibm_api_key:
            raise ValueError("IBM_QUANTUM_API_KEY is required for cloud-qpu mode.")
        result = _run_vqe_cloud(
            hamiltonian, n_qubits, max_iter, seed, ibm_api_key, ibm_instance
        )
    else:
        raise ValueError(f"Unknown mode: {mode}. Must be local-ideal, local-noisy, or cloud-qpu.")

    result["exact_energy"] = exact_energy
    result["error_vs_exact"] = abs(result["final_energy"] - exact_energy)
    result["molecule"] = molecule
    result["bond_length"] = bond_length
    return result


def get_circuit_info(molecule: str) -> dict[str, Any]:
    """
    Return ansatz circuit metadata and a text-form circuit diagram.
    Does NOT run the full VQE — just builds the circuit and returns its description.
    """
    from services.molecular_hamiltonians import MOLECULES

    n_qubits = MOLECULES[molecule]["n_qubits"]
    ansatz = _build_ansatz(n_qubits)

    bound = ansatz.assign_parameters({p: 0.0 for p in ansatz.parameters})

    return {
        "n_qubits": n_qubits,
        "n_parameters": ansatz.num_parameters,
        "depth": bound.depth(),
        "circuit_text": str(ansatz.draw(output="text", fold=-1)),
        "gates": dict(ansatz.count_ops()),
        "ansatz_name": "EfficientSU2 (reps=1, linear entanglement)",
    }
