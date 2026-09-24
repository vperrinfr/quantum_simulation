"""
Bond-dissociation sweep service.

Runs VQE across a range of bond lengths for H2 under three conditions:
  1. ideal   — StatevectorEstimator (noiseless)
  2. noisy   — AerSimulator.from_backend(FakeNairobi/FakeManilaV2/…) noise model
  3. mitigated — same noisy sim + resilience_level=1 via qiskit_ibm_runtime local mode

All runs are fully local; no IBM Quantum account is required.
"""

from __future__ import annotations
import logging
import numpy as np
from typing import Any

from scipy.optimize import minimize
from qiskit.circuit.library import efficient_su2
from qiskit.quantum_info import SparsePauliOp
from qiskit.transpiler import generate_preset_pass_manager

logger = logging.getLogger("sweep_service")

# Fake backends available without an account
FAKE_BACKENDS: dict[str, str] = {
    "FakeNairobi": "qiskit_ibm_runtime.fake_provider.FakeNairobi",
    "FakeManilaV2": "qiskit_ibm_runtime.fake_provider.FakeManilaV2",
    "FakeSherbrooke": "qiskit_ibm_runtime.fake_provider.FakeSherbrooke",
}


def _load_fake_backend(name: str):
    """Import and instantiate a fake backend by name."""
    import importlib
    module_path, cls_name = FAKE_BACKENDS[name].rsplit(".", 1)
    mod = importlib.import_module(module_path)
    return getattr(mod, cls_name)()


def _build_ansatz(n_qubits: int = 2):
    return efficient_su2(num_qubits=n_qubits, reps=1, entanglement="linear")


def _initial_params(n_params: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.uniform(-np.pi, np.pi, n_params)


def _cobyla(cost_fn, x0, max_iter: int):
    split = max(10, max_iter // 2)
    r1 = minimize(cost_fn, x0, method="COBYLA",
                  options={"maxiter": split, "rhobeg": 0.5, "disp": False})
    r2 = minimize(cost_fn, r1.x, method="COBYLA",
                  options={"maxiter": max_iter - split, "rhobeg": 0.05, "disp": False})
    r2.nfev = r1.nfev + r2.nfev
    return r2


def _vqe_ideal(hamiltonian: SparsePauliOp, max_iter: int, seed: int) -> float:
    from qiskit.primitives import StatevectorEstimator
    ansatz = _build_ansatz()
    estimator = StatevectorEstimator()

    def cost(params):
        pub = (ansatz, [hamiltonian], [params])
        return float(estimator.run([pub]).result()[0].data.evs[0])

    x0 = _initial_params(ansatz.num_parameters, seed)
    result = _cobyla(cost, x0, max_iter)
    return float(result.fun)


def _vqe_noisy(
    hamiltonian: SparsePauliOp,
    fake_backend_name: str,
    max_iter: int,
    seed: int,
    mitigated: bool,
) -> float:
    """
    Run VQE on a local fake-device noise model.

    mitigated=False → raw noisy run
    mitigated=True  → resilience_level=1 (T-REx measurement mitigation) via
                       qiskit_ibm_runtime.EstimatorV2 in local mode
    """
    from qiskit_aer import AerSimulator

    fake_backend = _load_fake_backend(fake_backend_name)
    sim = AerSimulator.from_backend(fake_backend)
    ansatz = _build_ansatz()
    pm = generate_preset_pass_manager(optimization_level=1, backend=sim)
    isa_ansatz = pm.run(ansatz)
    isa_ham = hamiltonian.apply_layout(isa_ansatz.layout)

    if mitigated:
        # Use qiskit_ibm_runtime local mode with T-REx (resilience_level=1)
        from qiskit_ibm_runtime import EstimatorV2 as RuntimeEstimator
        from qiskit_ibm_runtime.fake_provider import GenericBackendV2 as _  # noqa: ensure import path works

        estimator = RuntimeEstimator(mode=sim)
        estimator.options.resilience_level = 1
        estimator.options.default_shots = 4096
    else:
        from qiskit_aer.primitives import EstimatorV2 as AerEstimator
        estimator = AerEstimator()
        estimator.options.default_shots = 4096
        estimator.options.seed_simulator = seed

    def cost(params):
        pub = (isa_ansatz, [isa_ham], [params])
        return float(estimator.run([pub]).result()[0].data.evs[0])

    x0 = _initial_params(ansatz.num_parameters, seed)
    result = _cobyla(cost, x0, max_iter)
    return float(result.fun)


def run_sweep(
    molecule: str,
    r_min: float,
    r_max: float,
    r_step: float,
    max_iter: int,
    seed: int,
    fake_backend_name: str,
    include_noisy: bool,
    include_mitigated: bool,
) -> dict[str, Any]:
    """
    Sweep bond lengths and compute energies for each series requested.
    Returns a dict with bond_lengths array and series dicts (ideal, exact,
    noisy, mitigated) each containing an array of energies.
    """
    from services.molecular_hamiltonians import build_hamiltonian, exact_ground_state_energy, MOLECULES

    if molecule not in MOLECULES:
        raise ValueError(f"Unknown molecule '{molecule}'")

    bond_lengths = list(np.arange(r_min, r_max + r_step / 2, r_step))
    bond_lengths = [round(float(r), 4) for r in bond_lengths]

    results: dict[str, list[float]] = {
        "ideal": [],
        "exact": [],
    }
    if include_noisy:
        results["noisy"] = []
    if include_mitigated:
        results["mitigated"] = []

    for r in bond_lengths:
        logger.info("Sweep r=%.3f", r)
        hamiltonian, _ = build_hamiltonian(molecule, r)
        exact_e = exact_ground_state_energy(molecule, r)

        results["exact"].append(round(exact_e, 8))
        results["ideal"].append(round(_vqe_ideal(hamiltonian, max_iter, seed), 8))

        if include_noisy:
            noisy_e = _vqe_noisy(hamiltonian, fake_backend_name, max_iter, seed, mitigated=False)
            results["noisy"].append(round(noisy_e, 8))

        if include_mitigated:
            mit_e = _vqe_noisy(hamiltonian, fake_backend_name, max_iter, seed, mitigated=True)
            results["mitigated"].append(round(mit_e, 8))

    # Find equilibrium bond length (min of exact curve)
    exact_arr = np.array(results["exact"])
    eq_idx = int(np.argmin(exact_arr))
    eq_bond_length = bond_lengths[eq_idx]
    eq_energy_exact = results["exact"][eq_idx]
    eq_energy_ideal = results["ideal"][eq_idx]

    noise_shift = None
    if include_noisy:
        noise_shift = round(float(results["noisy"][eq_idx] - eq_energy_exact), 6)

    return {
        "molecule": molecule,
        "bond_lengths": bond_lengths,
        "series": results,
        "equilibrium": {
            "bond_length": eq_bond_length,
            "exact_energy": eq_energy_exact,
            "ideal_vqe_energy": eq_energy_ideal,
            "noise_shift_ha": noise_shift,
        },
        "fake_backend": fake_backend_name if (include_noisy or include_mitigated) else None,
        "n_points": len(bond_lengths),
    }


def get_isa_circuit_stats(molecule: str, fake_backend_name: str) -> dict[str, Any]:
    """
    Transpile the ansatz to the ISA of the given fake backend and return stats.
    Does NOT run VQE — purely structural analysis.
    """
    from qiskit_aer import AerSimulator
    from services.molecular_hamiltonians import build_hamiltonian, MOLECULES

    n_qubits = MOLECULES[molecule]["n_qubits"]
    ansatz = _build_ansatz(n_qubits)

    fake_backend = _load_fake_backend(fake_backend_name)
    sim = AerSimulator.from_backend(fake_backend)
    pm = generate_preset_pass_manager(optimization_level=1, backend=sim)
    isa_circuit = pm.run(ansatz)

    # Build hamiltonian at reference geometry for SparsePauliOp string
    ref_r = MOLECULES[molecule]["reference_bond_length"]
    hamiltonian, _ = build_hamiltonian(molecule, ref_r)

    gate_counts = dict(isa_circuit.count_ops())
    cx_count = gate_counts.get("cx", gate_counts.get("ecr", gate_counts.get("cz", 0)))

    return {
        "molecule": molecule,
        "fake_backend": fake_backend_name,
        "ansatz_depth": ansatz.depth(),
        "isa_depth": isa_circuit.depth(),
        "isa_gate_counts": gate_counts,
        "cx_count": cx_count,
        "n_qubits": n_qubits,
        "n_parameters": ansatz.num_parameters,
        "hamiltonian_repr": str(hamiltonian),
        "ansatz_text": str(ansatz.draw(output="text", fold=-1)),
        "isa_text": str(isa_circuit.draw(output="text", fold=-1)),
    }
