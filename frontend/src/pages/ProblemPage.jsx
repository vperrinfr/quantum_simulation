import React, { useEffect, useState } from 'react'
import { Tile, Tag, Loading, StructuredListWrapper, StructuredListHead, StructuredListRow, StructuredListCell, StructuredListBody } from '@carbon/react'
import { fetchMolecules } from '../services/api'

const VQE_STEPS = [
  { step: '1. Map',         desc: 'Molecule → SparsePauliOp qubit Hamiltonian via Bravyi-Kitaev mapping (STO-3G, 2 qubits)' },
  { step: '2. Optimize',    desc: 'Transpile EfficientSU2 ansatz to backend ISA; apply_layout on observables' },
  { step: '3. Execute',     desc: 'EstimatorV2 PUB (circuit, observables, params) → expectation ⟨ψ|H|ψ⟩. V2 primitives only; NO measurements in Estimator circuit.' },
  { step: '4. Post-process','desc': 'SciPy COBYLA minimises E(θ); iterate until convergence. Classical diagonalisation provides exact reference.' },
]

const NISQ_LIMITATIONS = [
  'Gate noise causes deviations from the ideal energy surface — local-noisy mode simulates this.',
  'Barren plateaus can stall convergence for large ansätze; EfficientSU2 reps=1 is deliberately shallow.',
  'Measurement noise on real QPUs requires error mitigation (resilience_level=1 in cloud-qpu mode).',
  'STO-3G is a minimal basis — insufficient for chemical accuracy (1 kcal/mol = 1.6 mHa). This is a demo.',
  'We work at H₂-scale (2 qubits). Drug molecules require 100–1000+ qubits and millions of gates.',
]

export default function ProblemPage() {
  const [molecules, setMols] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMolecules()
      .then(d => setMols(d.molecules))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-content"><Loading description="Loading…" withOverlay={false} /></div>

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.5rem' }}>The Problem</h1>
      <p style={{ color: '#a8a8a8', marginBottom: '2rem', maxWidth: '860px', lineHeight: 1.7 }}>
        Molecular ground-state energy is the lowest eigenvalue of the electronic Hamiltonian. 
        Classical exact diagonalisation scales <strong>exponentially</strong> with system size — 
        a 40-electron molecule requires a Hilbert space of 2⁴⁰ dimensions. 
        Quantum computers can represent this space with only 40 qubits, making VQE a promising 
        near-term hybrid approach.
      </p>

      {/* The VQE algorithm */}
      <p className="section-heading">The VQE Algorithm — Qiskit Pattern</p>
      <div style={{ marginBottom: '2rem' }}>
        {VQE_STEPS.map(({ step, desc }) => (
          <div key={step} style={{
            display: 'flex', gap: '1rem', marginBottom: '1rem',
            padding: '1rem', background: '#262626', borderLeft: '3px solid #4589ff'
          }}>
            <span style={{ fontFamily: 'IBM Plex Mono', color: '#4589ff', minWidth: '120px', fontSize: '0.8125rem' }}>{step}</span>
            <span style={{ color: '#c6c6c6', fontSize: '0.875rem', lineHeight: 1.6 }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Molecules we handle */}
      <p className="section-heading">Illustrative Molecules</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {molecules.map(m => (
          <Tile key={m.key} id={`prob-mol-${m.key}`}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.5rem', color: '#08bdba' }}>{m.formula}</span>
              <Tag type="cyan" size="sm">{m.n_qubits} qubits</Tag>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#a8a8a8', marginBottom: '0.5rem', lineHeight: 1.5 }}>{m.description}</p>
            <table style={{ fontSize: '0.75rem', color: '#6f6f6f', width: '100%' }}>
              <tbody>
                <tr><td>Reference r</td><td style={{ fontFamily: 'IBM Plex Mono', color: '#c6c6c6' }}>{m.reference_bond_length} Å</td></tr>
                <tr><td>Exact E₀ (STO-3G)</td><td style={{ fontFamily: 'IBM Plex Mono', color: '#f1c21b' }}>{m.exact_energy_hartree.toFixed(6)} Ha</td></tr>
                <tr><td>Literature</td><td>{m.literature_ref}</td></tr>
              </tbody>
            </table>
          </Tile>
        ))}
      </div>

      {/* NISQ limitations */}
      <p className="section-heading">NISQ Limitations — Honesty Section</p>
      <div className="honesty-banner">
        <strong>⚠ H₂-scale demonstration — not a drug molecule</strong>
        {NISQ_LIMITATIONS.map((l, i) => (
          <div key={i} style={{ marginTop: '0.375rem' }}>• {l}</div>
        ))}
      </div>
    </div>
  )
}
