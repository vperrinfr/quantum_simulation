# Pilot Plan — Quantum Molecular Simulator

## Executive Summary

A 3-week Client Engineering sprint to extend this H₂-scale VQE demo into a production-grade quantum chemistry workflow that can be benchmarked against a client's molecular targets (with appropriate scope constraints — see Sprint 0).

---

## Objectives

1. **Demonstrate VQE correctness** on 2–4 qubit molecules using IBM Quantum hardware (Sprint 1)
2. **Extend to larger molecules** (BeH2, H2S) using Jordan-Wigner/BK mapping from PySCF (Sprint 2)
3. **Benchmark NISQ vs classical** on client-relevant metrics, produce written findings report (Sprint 3)

---

## Success Criteria

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| VQE error vs exact | varies | < 1.6 mHa (chem accuracy) | NumPy eigensolver comparison |
| Circuit depth (HW) | 4–8 | ≤ 20 after transpile | qiskit depth() |
| Convergence iterations | 200 | < 150 for 2-qubit | COBYLA nfev |
| Local-noisy vs ideal delta | N/A | < 5 mHa | Mode comparison |
| Stakeholder demo-ready | No | Yes | Demo script walk-through |

---

## Sprint 0 — Environment & Scope (Days 1–2)

- Provision IBM Quantum Platform account and verify access
- Identify target molecules (with client) — max 4 qubits for Sprint 1
- Install Qiskit stack, verify `qiskit` 2.4.1 / `qiskit-ibm-runtime` 0.47 compatibility
- Stand up local dev environment: `bash scripts/setup.sh`
- Confirm molecule is within NISQ scope (H2-scale is fine; drug molecules are not)

**Risk flag**: If client wants > 6 qubits in Sprint 1, descope to local simulation only.

---

## Sprint 1 — Core VQE on Hardware (Week 1–2)

- Replace illustrative Hamiltonians with PySCF + qiskit-nature (Jordan-Wigner mapping)
- Run VQE on `ibm_least_busy` with Session + resilience_level=1
- Implement SPSA optimizer (better for noisy devices) alongside COBYLA
- Compare local-ideal / local-noisy / cloud-qpu convergence plots
- Add potential energy surface (PES) sweep: vary bond length, plot E(r) curve

**Deliverable**: Working demo with 1 real molecule on hardware, PES sweep chart.

---

## Sprint 2 — Integration & Governance (Week 2–3)

- Add larger molecules (BeH2 → 4 qubits) if hardware queue permits
- Integrate watsonx.governance AI FactSheet to track VQE experiments
- Add experiment logging (molecule, params, backend, results) to a simple SQLite store
- Polish Carbon UI: add PES chart page, export CSV of results
- Implement error mitigation comparison: no mitigation vs ZNE vs measurement mitigation

**Deliverable**: Multi-molecule demo with governance tracking and results export.

---

## Sprint 3 — Benchmarking & Handover (Week 3)

- Full E2E benchmarking: exact vs VQE error across all molecules and modes
- Written findings report: NISQ readiness, circuit depth analysis, recommendations
- Knowledge transfer session (2h): architecture walkthrough, how to extend
- README + operator runbook updated with production notes
- Pilot close-out presentation to client stakeholders

**Deliverable**: Findings report + runnable demo + operator runbook.

---

## Team

| Role | Person | FTE |
|------|--------|-----|
| Tech Sales Lead | TBD | 0.3 |
| Client Engineer (Quantum) | TBD | 1.0 |
| Client Engineer (Full-Stack) | TBD | 0.5 |
| IBM Quantum Partner contact | TBD | advisory |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| IBM Quantum queue delays | Medium | High | Use local-noisy for demo; show cloud-qpu as stretch goal |
| Molecule too large for NISQ | High | Medium | Stay at H2/LiH/H2O (2 qubits); defer to fault-tolerant roadmap |
| Barren plateau convergence failure | Low | Medium | Use SPSA, reduce ansatz depth, add gradient-free restart |
| Chemistry scope creep | Medium | High | Hard gate: demo molecules only, no drug discovery claims |

---

## Post-Pilot Roadmap

1. **Fault-tolerant target**: revisit with IBM Heron/Flamingo QPUs when available
2. **PySCF integration**: real second-quantized Hamiltonians from PySCF + qiskit-nature
3. **Multi-molecule PES**: interactive potential energy surface explorer
4. **Governance integration**: watsonx.governance experiment tracking at scale
5. **Cloud-native**: deploy on Red Hat OpenShift with Tekton CI/CD
