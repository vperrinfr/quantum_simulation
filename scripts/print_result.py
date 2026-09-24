import json, sys

with open('/tmp/vqe_result.json') as f:
    d = json.load(f)

hist    = d['energy_history']
exact   = d['exact_energy']
vqe     = d['final_energy']
err_ha  = d['error_vs_exact']
err_mha = err_ha * 1000
chem_ok = err_mha < 1.6

# Header
print()
print("╔══════════════════════════════════════════════════════════════════════╗")
print("║     VQE GROUND-STATE ENERGY  —  H₂  at  r = 0.74 Å               ║")
print("║     IBM Qiskit 2.x  ·  StatevectorEstimator  ·  local-ideal         ║")
print("╚══════════════════════════════════════════════════════════════════════╝")
print()
print(f"  Molecule       : H₂  (illustrative STO-3G Hamiltonian)")
print(f"  Bond length    : {d['bond_length']} Å  (equilibrium geometry)")
print(f"  Ansatz         : efficient_su2  reps=1  ({d['n_params']} parameters,  linear entanglement)")
print(f"  Backend        : {d['backend_name']}  ({d['resolved_mode']})")
print(f"  Optimizer      : SciPy COBYLA  two-phase (coarse 300 + fine 300)")
print(f"  .env defaults  : QUANTUM_MODE=local  EXECUTION_TARGET=local-ideal")
print(f"                   ALLOW_PAID_QPU=false  DEFAULT_SHOTS={d['resolved_shots']}")
print(f"  Iterations     : {len(hist)}   (nfev = {d['n_function_evals']})")
print(f"  Elapsed        : {d['elapsed_seconds']} s")
print()

# Energy comparison table
print("  ┌─────────────────────────────────────────────────────────────────┐")
print("  │                     ENERGY COMPARISON                           │")
print("  ├──────────────────────────────┬──────────────────────────────────┤")
print(f"  │  VQE final energy            │  {vqe:+.8f} Ha               │")
print(f"  │  Exact (NumPy eigensolver)   │  {exact:+.8f} Ha               │")
print("  ├──────────────────────────────┼──────────────────────────────────┤")
print(f"  │  |VQE − Exact|              │  {err_ha:.8f} Ha = {err_mha:.4f} mHa  │")
print(f"  │  Chemical accuracy (<1.6mHa) │  {'✅  YES — converged within threshold' if chem_ok else '❌  NO  — not reached'}     │")
print("  └──────────────────────────────┴──────────────────────────────────┘")
print()

# Convergence curve
W = 54
E_min = min(min(hist), exact) - 0.01
E_max = max(hist[0:8])

def col(e):
    return max(0, min(W, int((e - E_min) / (E_max - E_min) * W)))

exact_col = col(exact)

print("  ENERGY CONVERGENCE CURVE")
print(f"  Left = high energy ({E_max:.3f} Ha) → Right = low energy ({E_min:.3f} Ha)")
print(f"  ● = VQE iterate    │ = exact classical ground state")
print()

indices = list(range(0, len(hist), max(1, len(hist)//36))) + [len(hist)-1]
seen = set()
for i in sorted(set(indices)):
    if i in seen: continue
    seen.add(i)
    e   = hist[i]
    vc  = col(e)
    ec  = exact_col
    row = [' '] * (W + 1)
    if 0 <= ec <= W: row[ec] = '│'
    if 0 <= vc <= W: row[vc] = '●' if vc != ec else '◆'
    note = ' ← exact match ✓' if abs(vc - ec) <= 1 else ''
    print(f"  iter {i:4d}  {e:+.7f} Ha  {''.join(row)}{note}")

# Exact reference marker
row = [' '] * (W + 1)
if 0 <= exact_col <= W: row[exact_col] = '▼'
print(f"  exact        {exact:+.7f} Ha  {''.join(row)}  ← NumPy eigensolver (ground truth)")
print()

# Verdict
if chem_ok:
    print(f"  ╔══════════════════════════════════════════════════════════════╗")
    print(f"  ║  ✅  VQE CONVERGED — within chemical accuracy               ║")
    print(f"  ║  |ΔE| = {err_mha:.4f} mHa  <  1.6 mHa  (1 kcal/mol limit)         ║")
    print(f"  ╚══════════════════════════════════════════════════════════════╝")
else:
    print(f"  ⚠  VQE did not reach chemical accuracy — |ΔE| = {err_mha:.4f} mHa")
print()
print("  ─── Optimal parameters (θ) ─────────────────────────────────────")
for i, p in enumerate(d['optimal_params']):
    print(f"  θ[{i}] = {p:+.6f} rad", end="   ")
    if (i+1) % 3 == 0: print()
print()
print("  ─── NISQ / scope note ──────────────────────────────────────────")
print("  This is a 2-qubit illustrative STO-3G demonstration.")
print("  Not suitable for chemistry research. H₂-scale only.")
print("  Real NISQ hardware adds gate noise → use local-noisy mode to see effect.")
