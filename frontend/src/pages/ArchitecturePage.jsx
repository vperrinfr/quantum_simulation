import React, { useEffect, useRef } from 'react'
import { Tag } from '@carbon/react'

const ARCHITECTURE_DIAGRAM = `
graph TB
  subgraph UI ["Carbon React UI (g100)"]
    dash[Dashboard]
    prob[Problem]
    circ[Circuit]
    run[Run VQE]
    res[Results]
    arch[Architecture]
  end

  subgraph API ["FastAPI Backend  :8000"]
    health[GET /api/health]
    mols[GET /api/quantum/molecules]
    ham[GET /api/quantum/hamiltonian]
    circuit_ep[GET /api/quantum/circuit]
    run_ep[POST /api/quantum/run]
  end

  subgraph QKernel ["Quantum Kernel  (backend/services/)"]
    MH[molecular_hamiltonians.py\nSparsePauliOp · NumPy eigensolver]
    QS_ideal[StatevectorEstimator\nlocal-ideal mode]
    QS_noisy[qiskit_aer EstimatorV2\nlocal-noisy mode]
    QS_cloud[qiskit_ibm_runtime EstimatorV2\nSession · cloud-qpu mode]
    EfficientSU2[EfficientSU2 Ansatz\nreps=1, n_params=6]
    COBYLA[SciPy COBYLA Optimizer]
  end

  UI -->|Axios /api| API
  API --> QKernel
  MH --> QS_ideal & QS_noisy & QS_cloud
  EfficientSU2 --> QS_ideal & QS_noisy & QS_cloud
  COBYLA -->|minimise ⟨H⟩| QS_ideal & QS_noisy & QS_cloud

  style QS_ideal fill:#005d5d,color:#fff
  style QS_noisy fill:#6929c4,color:#fff
  style QS_cloud fill:#0f62fe,color:#fff
  style MH       fill:#1c1c1c,color:#f4f4f4,stroke:#08bdba
  style COBYLA   fill:#1c1c1c,color:#f4f4f4,stroke:#f1c21b
`

const COMPONENTS = [
  { layer: 'Frontend',     component: 'React 18 + Vite',        description: 'SPA, react-router-dom v6' },
  { layer: 'Frontend',     component: '@carbon/react v11',       description: 'All UI components, g100 theme' },
  { layer: 'Frontend',     component: '@carbon/charts-react',    description: 'LineChart convergence plots' },
  { layer: 'Frontend',     component: 'DemoContext',             description: 'useReducer global state for molecule / run config' },
  { layer: 'Backend',      component: 'FastAPI',                 description: 'Python 3.11, pydantic v2, uvicorn' },
  { layer: 'Backend',      component: 'molecular_hamiltonians',  description: 'Illustrative SparsePauliOp Hamiltonians + NumPy eigensolver' },
  { layer: 'Backend',      component: 'quantum_service',         description: 'Tri-mode VQE dispatch + EfficientSU2 + COBYLA' },
  { layer: 'Quantum (local)', component: 'qiskit.primitives.StatevectorEstimator', description: 'Exact local V2 Estimator, no account needed' },
  { layer: 'Quantum (local)', component: 'qiskit_aer EstimatorV2', description: 'Depolarizing noise model, shots-based simulation' },
  { layer: 'Quantum (cloud)', component: 'qiskit_ibm_runtime EstimatorV2', description: 'Hardware QPU via Session, resilience_level=1' },
  { layer: 'Circuit',      component: 'EfficientSU2',            description: 'Hardware-efficient ansatz, reps=1, 6 parameters, linear entanglement' },
  { layer: 'Circuit',      component: 'generate_preset_pass_manager', description: 'ISA transpilation, optimization_level=1' },
  { layer: 'Optimizer',    component: 'SciPy COBYLA',            description: 'Derivative-free classical optimizer, max_iter configurable' },
  { layer: 'Primitives',   component: 'V2 PUBs',                 description: 'Estimator: (circuit, observables, params) — no measurements in circuit' },
]

export default function ArchitecturePage() {
  const mermaidRef = useRef(null)

  useEffect(() => {
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true })
      if (mermaidRef.current) {
        mermaid.render('arch-diagram', ARCHITECTURE_DIAGRAM.trim())
          .then(({ svg }) => {
            if (mermaidRef.current) mermaidRef.current.innerHTML = svg
          })
          .catch(() => {
            if (mermaidRef.current)
              mermaidRef.current.innerHTML = `<pre style="color:#a8a8a8;font-size:0.75rem">${ARCHITECTURE_DIAGRAM}</pre>`
          })
      }
    })
  }, [])

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.25rem' }}>Architecture</h1>
      <p style={{ color: '#a8a8a8', marginBottom: '2rem' }}>
        Built with IBM Qiskit 2.x · qiskit-aer 0.17 · qiskit-ibm-runtime 0.47 · Carbon React v11
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {['IBM Qiskit 2.4.1', 'qiskit-aer 0.17.2', 'qiskit-ibm-runtime 0.47.0', 'FastAPI', 'React 18', '@carbon/react v11', 'V2 primitives only', 'EstimatorV2 · PUBs'].map(t => (
          <Tag key={t} type="blue" size="sm">{t}</Tag>
        ))}
      </div>

      {/* Mermaid diagram */}
      <p className="section-heading">System Diagram</p>
      <div ref={mermaidRef} style={{ background: '#1c1c1c', padding: '1.5rem', marginBottom: '2rem', overflowX: 'auto', borderRadius: '2px' }}>
        <div style={{ color: '#6f6f6f', fontSize: '0.875rem' }}>Loading diagram…</div>
      </div>

      {/* Component inventory */}
      <p className="section-heading">Component Inventory</p>
      <table className="arch-component-table">
        <thead>
          <tr>
            <th>Layer</th>
            <th>Component</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {COMPONENTS.map((c, i) => (
            <tr key={i}>
              <td><Tag type="outline" size="sm">{c.layer}</Tag></td>
              <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.8125rem', color: '#08bdba' }}>{c.component}</td>
              <td style={{ color: '#c6c6c6' }}>{c.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Qiskit pattern */}
      <p className="section-heading" style={{ marginTop: '2rem' }}>Qiskit Pattern Compliance</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          ['1. Map',      'SparsePauliOp Hamiltonian from illustrative STO-3G coefficients'],
          ['2. Optimize', 'generate_preset_pass_manager → ISA circuit + apply_layout on observables'],
          ['3. Execute',  'EstimatorV2 PUBs: (circuit, observables, params). NO measurements.'],
          ['4. Post',     'Energy history → SciPy COBYLA minimize → convergence plot vs NumPy exact'],
        ].map(([step, desc]) => (
          <div key={step} style={{ background: '#262626', padding: '1rem', borderLeft: '3px solid #4589ff' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', color: '#4589ff', fontSize: '0.875rem', marginBottom: '0.375rem' }}>{step}</div>
            <div style={{ color: '#c6c6c6', fontSize: '0.8125rem', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
