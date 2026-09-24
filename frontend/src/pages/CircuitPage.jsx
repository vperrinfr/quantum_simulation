import React, { useEffect, useState } from 'react'
import { Tile, Dropdown, Tag, Loading, InlineNotification } from '@carbon/react'
import { fetchCircuit, fetchHamiltonian } from '../services/api'
import { useDemoContext } from '../context/DemoContext'
import QuantumMappingPanel from '../components/QuantumMappingPanel'

const MOLECULES = [
  { id: 'H2',  text: 'H₂ — Hydrogen' },
  { id: 'LiH', text: 'LiH — Lithium Hydride' },
  { id: 'H2O', text: 'H₂O — Water' },
]

export default function CircuitPage() {
  const { state, dispatch } = useDemoContext()
  const [circuit, setCircuit]   = useState(null)
  const [hamiltonian, setHam]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [hamLoading, setHL]     = useState(false)
  const [error, setError]       = useState(null)

  const mol = state.selectedMolecule
  const r   = state.bondLength

  // Load circuit info when molecule changes
  useEffect(() => {
    setLoading(true)
    fetchCircuit(mol)
      .then(setCircuit)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [mol])

  // Load Hamiltonian when molecule or bond length changes
  useEffect(() => {
    setHL(true)
    fetchHamiltonian(mol, r)
      .then(setHam)
      .catch(() => {})
      .finally(() => setHL(false))
  }, [mol, r])

  const BOND_RANGES = { H2: [0.4, 2.5], LiH: [1.0, 4.0], H2O: [0.6, 2.0] }
  const [minR, maxR] = BOND_RANGES[mol] || [0.4, 3.0]

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.5rem' }}>Quantum Circuit</h1>
      <p style={{ color: '#a8a8a8', marginBottom: '2rem', maxWidth: '700px' }}>
        EfficientSU2 hardware-efficient ansatz (reps=1) parametrised by θ. 
        The circuit is transpiled to the target backend's ISA before execution. 
        Observables (SparsePauliOp Pauli terms) are passed to EstimatorV2 — no measurements in the circuit.
      </p>

      {/* Molecule + bond length selectors */}
      <div className="run-controls">
        <Dropdown
          id="circuit-mol-select"
          titleText="Molecule"
          label="Select molecule"
          items={MOLECULES}
          selectedItem={MOLECULES.find(m => m.id === mol) || MOLECULES[0]}
          itemToString={item => item ? item.text : ''}
          onChange={({ selectedItem }) => {
            if (!selectedItem) return
            dispatch({ type: 'SET_MOLECULE', molecule: selectedItem.id })
            // Reset bond length to reference
            const refR = { H2: 0.74, LiH: 1.595, H2O: 0.958 }
            dispatch({ type: 'SET_BOND_LENGTH', bondLength: refR[selectedItem.id] || 0.74 })
          }}
        />
        <div>
          <label style={{ fontSize: '0.75rem', color: '#a8a8a8', display: 'block', marginBottom: '0.5rem' }}>
            Bond Length: <span style={{ fontFamily: 'IBM Plex Mono', color: '#08bdba' }}>{r.toFixed(3)} Å</span>
          </label>
          <input
            type="range"
            min={minR}
            max={maxR}
            step={0.05}
            value={r}
            onChange={e => dispatch({ type: 'SET_BOND_LENGTH', bondLength: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: '#4589ff' }}
            aria-label="Bond length in Angstrom"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#6f6f6f', marginTop: '0.25rem' }}>
            <span>{minR} Å</span><span>{maxR} Å</span>
          </div>
        </div>
      </div>

      {error && <InlineNotification kind="error" title="Error" subtitle={error} hideCloseButton />}

      {/* Circuit diagram */}
      <p className="section-heading">Ansatz Circuit Diagram</p>
      {loading
        ? <Loading description="Building circuit…" withOverlay={false} />
        : circuit && (
          <>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <Tag type="blue"   size="sm">{circuit.n_qubits} qubits</Tag>
              <Tag type="teal"   size="sm">{circuit.n_parameters} parameters</Tag>
              <Tag type="purple" size="sm">depth {circuit.depth}</Tag>
              <Tag type="gray"   size="sm">{circuit.ansatz_name}</Tag>
              {Object.entries(circuit.gates || {}).map(([g, n]) => (
                <Tag key={g} type="outline" size="sm">{g} ×{n}</Tag>
              ))}
            </div>
            <div className="circuit-diagram" aria-label="Circuit diagram">{circuit.circuit_text}</div>
          </>
        )
      }

      {/* Hamiltonian Pauli terms */}
      <p className="section-heading" style={{ marginTop: '2rem' }}>
        Hamiltonian Pauli Decomposition  
        <span style={{ fontSize: '0.6875rem', color: '#6f6f6f', marginLeft: '0.5rem' }}>
          H = Σᵢ cᵢ Pᵢ · r = {r.toFixed(3)} Å · ILLUSTRATIVE
        </span>
      </p>
      {hamLoading
        ? <Loading description="Loading Hamiltonian…" withOverlay={false} />
        : hamiltonian && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  {['Pauli String', 'Coefficient (Ha)', 'Visual'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', background: '#1c1c1c', color: '#8d8d8d', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #393939' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hamiltonian.pauli_terms.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'IBM Plex Mono', color: '#08bdba', borderBottom: '1px solid #262626' }}>{t.pauli}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'IBM Plex Mono', color: t.coeff > 0 ? '#42be65' : '#fa4d56', borderBottom: '1px solid #262626' }}>
                      {t.coeff > 0 ? '+' : ''}{t.coeff.toFixed(7)}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #262626' }}>
                      <div style={{ background: '#1c1c1c', height: '8px', width: `${Math.min(100, Math.abs(t.coeff / 1.2) * 100)}%`, background: t.coeff > 0 ? '#42be65' : '#fa4d56', borderRadius: '2px' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '0.75rem', color: '#6f6f6f', marginTop: '0.75rem' }}>
              Exact ground-state energy (classical eigensolver): <span style={{ fontFamily: 'IBM Plex Mono', color: '#f1c21b' }}>{hamiltonian.exact_energy.toFixed(7)} Ha</span>
            </p>
          </div>
        )
      }

      {/* ── Feature 3: "How this maps to quantum" collapsible panel ── */}
      <QuantumMappingPanel molecule={mol} bondLength={r} />
    </div>
  )
}
