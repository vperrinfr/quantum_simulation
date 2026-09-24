# Demo Script — Quantum Molecular Simulator

**Duration**: 15 minutes | **Audience**: Technical / C-suite hybrid | **Format**: Live

---

## Pre-Demo Checklist

- [ ] `bash scripts/verify-demo.sh` passes (backend + frontend green)
- [ ] Backend running: `cd backend && uvicorn main:app --port 8000`
- [ ] Frontend running: `cd frontend && npm run dev`  
- [ ] Browser at http://localhost:5173, Chrome, 1920×1080
- [ ] No IBM Quantum credentials needed (local-ideal mode)
- [ ] Disable notifications / focus mode on

---

## Opening (2 min) — Dashboard

> *"Classical computers can exactly simulate a hydrogen molecule — but add just 50 electrons and you'd need more memory than atoms in the observable universe. This is the quantum computing opportunity."*

**Click**: Open http://localhost:5173 → Dashboard

- Point to the **3 molecules** (H2, LiH, H2O) and their exact reference energies
- Note: **2 qubits** — we're at H2-scale, demonstrating the algorithm
- Point to **Backend Status: Online · local-ideal** — no IBM cloud account needed

> *"Today we'll watch VQE — IBM's flagship near-term quantum algorithm — converge to the exact ground-state energy of hydrogen."*

---

## Problem (3 min)

**Click**: Problem page

- Walk the **4 VQE steps** (Map → Optimize → Execute → Post-process) — this is the Qiskit pattern
- Highlight the **NISQ limitations** section: be honest about where quantum is today
  
> *"We're not claiming drug discovery. We're demonstrating that a quantum algorithm can find the right answer at H2-scale — which is the foundational proof point. Chemical accuracy at larger scales is the roadmap."*

---

## Circuit (3 min)

**Click**: Circuit page

- Show the **Dropdown** — select H2, then H2O. Note the Hamiltonian Pauli terms change.
- Move the **bond length slider** — watch the Pauli coefficients update live
- Point to the **circuit diagram**: "This is EfficientSU2 — 6 parameters, shallow depth. Hardware-efficient."
- Show the **Hamiltonian table**: "These Pauli strings are what EstimatorV2 evaluates. No measurements in the Estimator circuit — that's a V2 primitive rule."

---

## Run VQE — THE WOW MOMENT (5 min)

**Click**: Run VQE page

1. **Apply preset**: Click **"H₂ at 0.74 Å (equilibrium)"** — pre-fills everything
2. Confirm: mode = `local-ideal`, max_iter = 200
3. **Click "Run VQE"** — watch the progress indicator and live log

> *"The VQE is running right now. SciPy's COBYLA optimizer is calling the quantum Estimator on every iteration, minimising the expectation value of the molecular Hamiltonian. No measurements in the quantum circuit — the V2 Estimator handles that."*

4. When complete (~2-3s), point to the **convergence chart**:
   - Blue line = VQE energy per iteration
   - Gold line = exact energy from NumPy (classical diagonalisation)
   - *"Watch it land exactly on the gold line."*

5. **Repeat with "H₂ noisy simulation"** preset (local-noisy mode):
   - *"This simulates a real NISQ device with depolarizing noise. The VQE still converges, but there's more scatter and it may miss by a few milliHartree."*

---

## Results (2 min)

**Click**: Results page

- Show the **energy comparison**: VQE vs Exact, with mHa error
- Read the **NISQ honesty notes** — this builds trust with technical audiences
  
> *"We're honest: this is H2-scale. Drug molecules need 100-1000+ qubits. IBM's fault-tolerant roadmap — Heron and beyond — is where that becomes possible. Today we're proving the algorithm works."*

---

## Architecture (1 min — for technical audience)

**Click**: Architecture page

- Show the **Mermaid diagram**: tri-mode backends, Qiskit pattern
- Point to: "EstimatorV2 · V2 primitives only · apply_layout · Session for cloud-qpu"

---

## Close (1 min)

> *"This running demo is the foundation of a 3-week Client Engineering engagement. We'd instrument a real molecule relevant to your work, run it on IBM Quantum hardware, and produce a benchmarking report — exactly what you need for a quantum readiness assessment."*

---

## FAQ

| Question | Answer |
|----------|--------|
| "Can it simulate aspirin?" | Not yet — aspirin is ~100 qubits. We're demonstrating the algorithm proof-of-concept at 2 qubits. IBM's roadmap targets drug-relevant scales. |
| "Why not use a classical computer for H2?" | Exactly right — for H2 classical is fine. VQE's advantage emerges at 50+ electrons where classical becomes intractable. |
| "What's the error?" | < 0.1 mHa on local-ideal (essentially exact). On noisy simulation, ~1-5 mHa. Real hardware with error mitigation typically achieves 1-10 mHa. |
| "How fast on real hardware?" | Depends on queue. A single VQE run with 200 iterations takes ~10-30 min on a real QPU. Session mode minimises inter-job latency. |
| "Is this production-ready?" | This is a demonstration. Production-quality chemistry requires PySCF integration, proper basis sets, and fault-tolerant hardware. |
