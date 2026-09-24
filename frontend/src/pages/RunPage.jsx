import React, { useState, useRef } from 'react'
import { Button, Dropdown, Tag, Loading, InlineNotification, ProgressIndicator, ProgressStep } from '@carbon/react'
import { PlayFilledAlt, Pause, Reset } from '@carbon/icons-react'
import { LineChart } from '@carbon/charts-react'
import { ScaleTypes } from '@carbon/charts'
import { useDemoContext } from '../context/DemoContext'
import { runVQE } from '../services/api'

const MOLECULES = [
  { id: 'H2',  text: 'H₂ — Hydrogen' },
  { id: 'LiH', text: 'LiH — Lithium Hydride' },
  { id: 'H2O', text: 'H₂O — Water' },
]

const MODES = [
  { id: 'local-ideal',  text: 'local-ideal — StatevectorEstimator (exact, no account needed)' },
  { id: 'local-noisy',  text: 'local-noisy — Aer depolarizing noise (no account needed)' },
  { id: 'cloud-qpu',   text: 'cloud-qpu — IBM Quantum hardware (credentials required)' },
]

const PRESET_SCENARIOS = [
  { label: 'H₂ at 0.74 Å (equilibrium)',  molecule: 'H2',  bondLength: 0.74,  mode: 'local-ideal' },
  { label: 'H₂ at 1.20 Å (stretched)',    molecule: 'H2',  bondLength: 1.20,  mode: 'local-ideal' },
  { label: 'LiH at 1.595 Å (ideal)',      molecule: 'LiH', bondLength: 1.595, mode: 'local-ideal' },
  { label: 'H₂ noisy simulation',          molecule: 'H2',  bondLength: 0.74,  mode: 'local-noisy' },
]

const VQE_STAGES = [
  { label: 'Configure' },
  { label: 'Map Hamiltonian' },
  { label: 'Transpile Ansatz' },
  { label: 'Run Estimator' },
  { label: 'Converge' },
]

function buildChartData(history, exactEnergy) {
  const vqePoints = history.map((e, i) => ({
    group: 'VQE Energy',
    key: i + 1,
    value: e,
  }))
  const exactPoints = history.map((_, i) => ({
    group: 'Exact (NumPy eigensolver)',
    key: i + 1,
    value: exactEnergy,
  }))
  return [...vqePoints, ...exactPoints]
}

export default function RunPage() {
  const { state, dispatch } = useDemoContext()
  const [running, setRunning]     = useState(false)
  const [stage, setStage]         = useState(0)
  const [error, setError]         = useState(null)
  const [result, setResult]       = useState(null)
  const [logs, setLogs]           = useState([])
  const logRef = useRef(null)

  const addLog = (msg, type = 'info') => {
    setLogs(prev => {
      const next = [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]
      return next.slice(-80)
    })
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, 50)
  }

  const applyPreset = (preset) => {
    dispatch({ type: 'SET_MOLECULE', molecule: preset.molecule })
    dispatch({ type: 'SET_BOND_LENGTH', bondLength: preset.bondLength })
    dispatch({ type: 'SET_VQE_MODE', mode: preset.mode })
    setResult(null); setError(null); setLogs([])
  }

  const handleRun = async () => {
    setRunning(true); setError(null); setResult(null); setLogs([]); setStage(1)
    addLog(`Starting VQE for ${state.selectedMolecule} at r=${state.bondLength} Å, mode=${state.vqeMode}`)

    try {
      setStage(2); addLog('Mapping molecule to SparsePauliOp Hamiltonian…', 'info')
      setStage(3); addLog('Transpiling EfficientSU2 ansatz to backend ISA…', 'info')
      setStage(4); addLog('Executing EstimatorV2 PUBs via SciPy COBYLA optimizer…', 'info')

      dispatch({ type: 'RUN_START' })
      const r = await runVQE({
        molecule: state.selectedMolecule,
        bond_length: state.bondLength,
        mode: state.vqeMode,
        max_iter: state.maxIter,
        seed: state.seed,
      })

      setStage(5)
      addLog(`Converged in ${r.n_function_evals} evaluations.`, 'success')
      addLog(`VQE energy:   ${r.final_energy.toFixed(7)} Ha`, 'success')
      addLog(`Exact energy: ${r.exact_energy.toFixed(7)} Ha`, 'success')
      addLog(`Error:        ${(r.error_vs_exact * 1000).toFixed(4)} mHa`, r.error_vs_exact < 0.002 ? 'success' : 'warn')

      setResult(r)
      dispatch({ type: 'RUN_SUCCESS', result: r })
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error')
      setError(e.message)
      setStage(0)
      dispatch({ type: 'RUN_ERROR', error: e.message })
    } finally {
      setRunning(false)
    }
  }

  const BOND_RANGES = { H2: [0.4, 2.5], LiH: [1.0, 4.0], H2O: [0.6, 2.0] }
  const [minR, maxR] = BOND_RANGES[state.selectedMolecule] || [0.4, 3.0]

  const chartData = result ? buildChartData(result.energy_history, result.exact_energy) : []
  const chartOptions = {
    title: 'VQE Convergence — Energy vs Iteration',
    axes: {
      bottom: {
        title: 'Iteration',
        mapsTo: 'key',
        scaleType: ScaleTypes.LINEAR,
      },
      left: {
        title: 'Energy (Ha)',
        mapsTo: 'value',
        scaleType: ScaleTypes.LINEAR,
      },
    },
    color: {
      scale: {
        'VQE Energy': '#4589ff',
        'Exact (NumPy eigensolver)': '#f1c21b',
      },
    },
    curve: 'curveMonotoneX',
    height: '400px',
    theme: 'g100',
    toolbar: { enabled: false },
  }

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.5rem' }}>Run VQE</h1>
      <p style={{ color: '#a8a8a8', marginBottom: '1.5rem', maxWidth: '700px' }}>
        Configure molecule, bond length, and backend mode. Click <strong>Run VQE</strong> to 
        execute the full optimization loop and watch energy converge to the ground state.
      </p>

      {/* Preset scenarios */}
      <p className="section-heading">Preset Scenarios</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {PRESET_SCENARIOS.map(ps => (
          <button
            key={ps.label}
            onClick={() => applyPreset(ps)}
            style={{
              background: 'transparent', border: '1px solid #393939', color: '#c6c6c6',
              padding: '0.375rem 0.875rem', cursor: 'pointer', fontSize: '0.8125rem',
              fontFamily: 'IBM Plex Sans', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.target.style.borderColor = '#4589ff'}
            onMouseLeave={e => e.target.style.borderColor = '#393939'}
            aria-label={`Apply preset: ${ps.label}`}
          >
            {ps.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="run-controls">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Dropdown
            id="run-mol-select"
            titleText="Molecule"
            label="Select molecule"
            items={MOLECULES}
            selectedItem={MOLECULES.find(m => m.id === state.selectedMolecule) || MOLECULES[0]}
            itemToString={item => item ? item.text : ''}
            onChange={({ selectedItem }) => {
              if (!selectedItem) return
              dispatch({ type: 'SET_MOLECULE', molecule: selectedItem.id })
              const refR = { H2: 0.74, LiH: 1.595, H2O: 0.958 }
              dispatch({ type: 'SET_BOND_LENGTH', bondLength: refR[selectedItem.id] || 0.74 })
            }}
            disabled={running}
          />
          <Dropdown
            id="run-mode-select"
            titleText="Backend Mode"
            label="Select mode"
            items={MODES}
            selectedItem={MODES.find(m => m.id === state.vqeMode) || MODES[0]}
            itemToString={item => item ? item.text : ''}
            onChange={({ selectedItem }) => {
              if (!selectedItem) return
              dispatch({ type: 'SET_VQE_MODE', mode: selectedItem.id })
            }}
            disabled={running}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#a8a8a8', display: 'block', marginBottom: '0.5rem' }}>
              Bond Length: <span style={{ fontFamily: 'IBM Plex Mono', color: '#08bdba' }}>{state.bondLength.toFixed(3)} Å</span>
            </label>
            <input
              type="range"
              min={minR}
              max={maxR}
              step={0.05}
              value={state.bondLength}
              onChange={e => dispatch({ type: 'SET_BOND_LENGTH', bondLength: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#4589ff' }}
              disabled={running}
              aria-label="Bond length in Angstrom"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#6f6f6f' }}>
              <span>{minR} Å</span><span>{maxR} Å</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: '#a8a8a8', display: 'block', marginBottom: '0.5rem' }}>
              Max Iterations: <span style={{ fontFamily: 'IBM Plex Mono', color: '#c6c6c6' }}>{state.maxIter}</span>
            </label>
            <input
              type="range" min={20} max={500} step={10}
              value={state.maxIter}
              onChange={e => dispatch({ type: 'SET_MAX_ITER', maxIter: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#4589ff' }}
              disabled={running}
              aria-label="Maximum VQE iterations"
            />
          </div>
        </div>
      </div>

      {/* VQE stage progress */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ProgressIndicator currentIndex={stage - 1} spaceEqually>
          {VQE_STAGES.map((s, i) => (
            <ProgressStep key={s.label} label={s.label}
              complete={stage > i + 1}
              current={stage === i + 1}
            />
          ))}
        </ProgressIndicator>
      </div>

      {/* Run / Reset buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <Button
          renderIcon={running ? Pause : PlayFilledAlt}
          onClick={handleRun}
          disabled={running}
          kind="primary"
          size="lg"
        >
          {running ? 'Running VQE…' : 'Run VQE'}
        </Button>
        <Button
          renderIcon={Reset}
          onClick={() => { setResult(null); setError(null); setLogs([]); setStage(0); dispatch({ type: 'RESET' }) }}
          disabled={running}
          kind="ghost"
          size="lg"
        >
          Reset
        </Button>
        {running && <span className="status-pill running">● Running</span>}
        {result && !running && <span className="status-pill done">✓ Complete in {result.elapsed_seconds}s</span>}
        {error && !running && <span className="status-pill error">✗ Error</span>}
      </div>

      {error && <InlineNotification kind="error" title="Simulation error" subtitle={error} hideCloseButton style={{ marginBottom: '1rem' }} />}

      {/* Live log */}
      <p className="section-heading">Execution Log</p>
      <div className="log-panel" ref={logRef} aria-label="Execution log" aria-live="polite">
        {logs.length === 0 && <div style={{ color: '#4a4a4a' }}>Ready. Press Run VQE to start.</div>}
        {logs.map((l, i) => (
          <div key={i} className={`log-line ${l.type}`}>[{l.ts}] {l.msg}</div>
        ))}
      </div>

      {/* Convergence chart */}
      {result && (
        <>
          <p className="section-heading" style={{ marginTop: '2rem' }}>Convergence Plot</p>
          <div className="chart-tile">
            <LineChart data={chartData} options={chartOptions} />
          </div>

          {/* Quick result summary */}
          <div className="kpi-grid" style={{ marginTop: '1rem' }}>
            <div className="kpi-tile success">
              <div className="kpi-tile__label">VQE Final Energy</div>
              <div className="kpi-tile__value" style={{ fontSize: '1.25rem', fontFamily: 'IBM Plex Mono', color: '#4589ff' }}>
                {result.final_energy.toFixed(6)}
              </div>
              <div className="kpi-tile__sublabel">Hartree</div>
            </div>
            <div className="kpi-tile warning">
              <div className="kpi-tile__label">Exact Energy (NumPy)</div>
              <div className="kpi-tile__value" style={{ fontSize: '1.25rem', fontFamily: 'IBM Plex Mono', color: '#f1c21b' }}>
                {result.exact_energy.toFixed(6)}
              </div>
              <div className="kpi-tile__sublabel">Hartree</div>
            </div>
            <div className={`kpi-tile ${result.error_vs_exact < 0.002 ? 'success' : 'warning'}`}>
              <div className="kpi-tile__label">|Error| vs Exact</div>
              <div className="kpi-tile__value" style={{ fontSize: '1.25rem', fontFamily: 'IBM Plex Mono' }}>
                {(result.error_vs_exact * 1000).toFixed(4)}
              </div>
              <div className="kpi-tile__sublabel">mHa (chemical accuracy: &lt;1.6 mHa)</div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-tile__label">Function Evaluations</div>
              <div className="kpi-tile__value">{result.n_function_evals}</div>
              <div className="kpi-tile__sublabel">{result.backend_name}</div>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#6f6f6f', marginTop: '0.5rem' }}>
            → Navigate to <a href="/results" style={{ color: '#4589ff' }}>Results</a> for full analysis and NISQ honesty notes.
          </p>
        </>
      )}
    </div>
  )
}
