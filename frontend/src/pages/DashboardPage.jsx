import React, { useEffect, useState } from 'react'
import { Tile, Tag, Loading, InlineNotification } from '@carbon/react'
import { fetchMolecules, fetchHealth } from '../services/api'

const PRESET_RUNS = [
  { molecule: 'H2',  bondLength: 0.74,  mode: 'local-ideal', label: 'H₂ equilibrium (ideal)' },
  { molecule: 'LiH', bondLength: 1.595, mode: 'local-ideal', label: 'LiH equilibrium (ideal)' },
  { molecule: 'H2O', bondLength: 0.958, mode: 'local-ideal', label: 'H₂O equilibrium (ideal)' },
]

export default function DashboardPage() {
  const [health, setHealth]     = useState(null)
  const [molecules, setMols]    = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    Promise.all([fetchHealth(), fetchMolecules()])
      .then(([h, m]) => { setHealth(h); setMols(m.molecules) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-content"><Loading description="Loading dashboard…" withOverlay={false} /></div>
  if (error)   return <div className="page-content"><InlineNotification kind="error" title="Backend unavailable" subtitle={error} hideCloseButton /></div>

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.25rem' }}>
        Quantum Molecular Simulator
      </h1>
      <p style={{ color: '#8d8d8d', marginBottom: '2rem', fontSize: '0.9375rem' }}>
        VQE ground-state energy calculation on IBM Qiskit · Built for IBM Tech Sales demo
      </p>

      {/* Status KPIs */}
      <div className="kpi-grid">
        <div className={`kpi-tile ${health?.status === 'ok' ? 'success' : 'danger'}`}>
          <div className="kpi-tile__label">Backend Status</div>
          <div className="kpi-tile__value" style={{ fontSize: '1.25rem' }}>
            {health?.status === 'ok' ? '● Online' : '● Offline'}
          </div>
          <div className="kpi-tile__sublabel">{health?.service}</div>
        </div>
        <div className="kpi-tile teal">
          <div className="kpi-tile__label">Active Mode</div>
          <div className="kpi-tile__value" style={{ fontSize: '1.125rem', fontFamily: 'IBM Plex Mono' }}>
            {health?.demo_mode || '—'}
          </div>
          <div className="kpi-tile__sublabel">local-ideal | local-noisy | cloud-qpu</div>
        </div>
        <div className="kpi-tile purple">
          <div className="kpi-tile__label">Available Molecules</div>
          <div className="kpi-tile__value">{molecules.length}</div>
          <div className="kpi-tile__sublabel">H₂ · LiH · H₂O (illustrative)</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-tile__label">Qubit Count</div>
          <div className="kpi-tile__value">2</div>
          <div className="kpi-tile__sublabel">All molecules use 2-qubit BK mapping</div>
        </div>
      </div>

      {/* Molecule catalogue */}
      <p className="section-heading">Molecule Catalogue</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {molecules.map(m => (
          <Tile key={m.key} id={`mol-tile-${m.key}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.5rem', color: '#08bdba' }}>{m.formula}</span>
              <Tag type="blue" size="sm">{m.n_qubits} qubits</Tag>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#c6c6c6', marginBottom: '0.5rem' }}>{m.description}</p>
            <p style={{ fontSize: '0.75rem', color: '#6f6f6f' }}>Ref energy: {m.exact_energy_hartree.toFixed(6)} Ha</p>
            <p style={{ fontSize: '0.75rem', color: '#6f6f6f' }}>r_ref = {m.reference_bond_length} Å · {m.literature_ref}</p>
          </Tile>
        ))}
      </div>

      {/* Quick-start preset runs */}
      <p className="section-heading">Quick-Start Preset Scenarios</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {PRESET_RUNS.map(r => (
          <a key={r.label} href="/run"
            style={{ textDecoration: 'none' }}>
            <Tag type="teal" size="lg">{r.label}</Tag>
          </a>
        ))}
      </div>
      <p style={{ color: '#6f6f6f', fontSize: '0.75rem', marginTop: '0.5rem' }}>
        Navigate to <strong>Run VQE</strong> to select a molecule, set bond length, choose backend mode, and execute the simulation.
      </p>
    </div>
  )
}
