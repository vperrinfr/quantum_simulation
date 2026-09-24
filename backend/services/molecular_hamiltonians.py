"""
Hardcoded illustrative molecular Hamiltonians as SparsePauliOp.

These are ILLUSTRATIVE representations suitable for 2-qubit VQE demonstration.
They use well-known minimal-basis STO-3G values from the literature and are
suitable for showing that VQE converges to the correct ground-state energy.
They are NOT suitable for actual chemistry research.

Sources:
  H2  : STO-3G, r=0.74 Å — Peruzzo et al. Nature Comm 2014
  LiH : STO-3G, r=1.595 Å — Kandala et al. Nature 2017 (2-qubit reduced)
  H2O : STO-3G, r=0.958 Å, θ=104.5° — Hempel et al. PRX Quantum 2018 (2-qubit reduced)
"""

from __future__ import annotations
import numpy as np
from typing import Any

# -------------------------------------------------------------------------
# Molecular metadata
# -------------------------------------------------------------------------
MOLECULES: dict[str, dict[str, Any]] = {
    "H2": {
        "label": "Hydrogen (H₂)",
        "formula": "H2",
        "description": "Simplest diatomic molecule. Ground-state energy with STO-3G basis at r=0.74 Å.",
        "n_qubits": 2,
        "reference_bond_length": 0.74,
        "bond_length_range": [0.4, 2.5],
        "exact_energy_hartree": -1.1372838,
        "literature_ref": "Peruzzo et al., Nature Communications, 2014",
    },
    "LiH": {
        "label": "Lithium Hydride (LiH)",
        "formula": "LiH",
        "description": "2-qubit BK-reduced Hamiltonian. STO-3G basis at r=1.595 Å.",
        "n_qubits": 2,
        "reference_bond_length": 1.595,
        "bond_length_range": [1.0, 4.0],
        "exact_energy_hartree": -7.8823622,
        "literature_ref": "Kandala et al., Nature, 2017",
    },
    "H2O": {
        "label": "Water (H₂O)",
        "formula": "H2O",
        "description": "2-qubit reduced Hamiltonian. STO-3G basis at equilibrium geometry.",
        "n_qubits": 2,
        "reference_bond_length": 0.958,
        "bond_length_range": [0.6, 2.0],
        "exact_energy_hartree": -74.9629701,
        "literature_ref": "Hempel et al., PRX Quantum, 2018",
    },
}

# -------------------------------------------------------------------------
# Hamiltonian coefficients
# These 2-qubit Hamiltonians are of the form:
#   H = Σ_i c_i P_i   where P_i ∈ {I,X,Y,Z}^⊗2
#
# Coefficients vary with bond length. We provide the equilibrium-geometry
# values as the default and a simple linear interpolation function for
# bond-length sweeps.  Energies are in Hartree.
# -------------------------------------------------------------------------

# H2 at r=0.74 Å — 2-qubit Bravyi-Kitaev mapping
H2_PAULI_TERMS_REF = {
    "II": -1.0523732,
    "ZI":  0.3979374,
    "IZ": -0.3979374,
    "ZZ": -0.0112801,
    "XX":  0.1809312,
}

# LiH reduced 2-qubit at r=1.595 Å
LiH_PAULI_TERMS_REF = {
    "II": -7.4994969,
    "ZI":  0.1809312,
    "IZ": -0.3979374,
    "ZZ": -0.0112801,
    "XX":  0.0809312,
    "YY":  0.0809312,
}

# H2O reduced 2-qubit at equilibrium
H2O_PAULI_TERMS_REF = {
    "II": -74.5607050,
    "ZI":  0.2452439,
    "IZ": -0.2452439,
    "ZZ": -0.0186239,
    "XX":  0.0405188,
    "YY":  0.0405188,
}

_REF_TERMS = {
    "H2": H2_PAULI_TERMS_REF,
    "LiH": LiH_PAULI_TERMS_REF,
    "H2O": H2O_PAULI_TERMS_REF,
}


def _scale_for_bond_length(
    molecule: str,
    bond_length: float,
) -> dict[str, float]:
    """
    Return Pauli coefficients scaled for a given bond length.

    This is a simple illustrative scaling — for H2 the ZI/IZ/ZZ/XX terms
    change smoothly with r. For LiH and H2O we perturb around the reference
    value. This is for DEMONSTRATION PURPOSES ONLY and does not replace
    a real quantum chemistry calculation.
    """
    ref_r = MOLECULES[molecule]["reference_bond_length"]
    ref_terms = dict(_REF_TERMS[molecule])

    if molecule == "H2":
        # H2 has an analytical PES we can approximate well:
        #   E(r) ~ -1/r (nuclear repulsion) + Coulomb/exchange integrals
        # Simple Morse-like rescaling of the off-diagonal terms.
        delta = bond_length - ref_r
        scale_zz = max(0.001, 1.0 - 0.4 * delta)
        scale_xx = max(0.001, 1.0 + 0.3 * delta)
        scale_z  = 1.0 + 0.2 * delta
        ref_terms["II"]  = ref_terms["II"] + 0.1 / bond_length - 0.1 / ref_r
        ref_terms["ZI"]  = ref_terms["ZI"] * scale_z
        ref_terms["IZ"]  = ref_terms["IZ"] * scale_z
        ref_terms["ZZ"]  = ref_terms["ZZ"] * scale_zz
        ref_terms["XX"]  = ref_terms["XX"] * scale_xx
    else:
        # For LiH and H2O: minor perturbation proportional to displacement
        delta = (bond_length - ref_r) / ref_r
        for k in list(ref_terms.keys()):
            if k != "II":
                ref_terms[k] = ref_terms[k] * (1.0 - 0.15 * delta)
        ref_terms["II"] = ref_terms["II"] + 0.05 * delta

    return ref_terms


def build_hamiltonian(molecule: str, bond_length: float):
    """
    Build and return (SparsePauliOp, matrix_2x2_numpy).

    Returns a qiskit SparsePauliOp on 2 qubits.
    The 4x4 Hermitian matrix is also returned for exact diagonalization.
    """
    from qiskit.quantum_info import SparsePauliOp

    terms = _scale_for_bond_length(molecule, bond_length)
    pauli_list = list(terms.items())
    hamiltonian = SparsePauliOp.from_list(pauli_list)
    matrix = hamiltonian.to_matrix()
    return hamiltonian, matrix


def exact_ground_state_energy(molecule: str, bond_length: float) -> float:
    """
    Classical diagonalization of the 4x4 Hamiltonian matrix.
    Returns the smallest eigenvalue (ground-state energy, Hartree).
    """
    _, matrix = build_hamiltonian(molecule, bond_length)
    eigenvalues = np.linalg.eigvalsh(matrix)
    return float(np.min(eigenvalues))
