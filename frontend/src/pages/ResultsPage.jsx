import React from 'react'
import { Tag, InlineNotification } from '@carbon/react'
import { LineChart } from '@carbon/charts-react'
import { ScaleTypes } from '@carbon/charts'
import { useDemoContext } from '../context/DemoContext'

function buildChartData(history, exactEnergy) {
  const vqePoints = history.map((e, i) => ({ group: 'VQE Energy', key: i + 1, value: e }))
  const exactPoints = history.map((_, i) => ({ group: 'Exact (NumPy)', key: i + 1, value: exactEnergy }))
  return [...vqePoints, ...exactPoints]
}

const NISQ_NOTES = [
  'This is an H₂-scale (2-qubit) demonstration only.',
  'STO-3G minimal basis overfits small molecules — NOT suitable for chemistry research.',
  'Chemical accuracy requires |ΔE| < 1.6 mHa (1 kcal/mol). We aim to demonstrate convergence, not accuracy.',
  'Real NISQ devices add gate noise, measurement errors, and decoherence — visible in local-noisy mode.',
  'Drug-molecule simulations require 100–1000+ qubits and millions of gates — well beyond today\'s NISQ era.',
  'IBM Quantum\'s fault-tolerant roadmap (Condor, Heron, beyond) targets large-scale error-corrected circuits.',
]

export default function ResultsPage() {
  const { state } = useDemoContext()
  const result = state.lastResult

  if (!result) {
    return (
      <div className="page-content">
        <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '1rem' }}>Results</h1>
        <InlineNotification
          kind="info"
          title="No simulation results yet"
          subtitle="Navigate to 'Run VQE' and execute a simulation first."
          hideCloseButton
        />
      </div>
    )
  }

  const chartData = buildChartData(result.energy_history, result.exact_energy)
  const chartOptions = {
    title: `VQE Convergence — ${result.molecule} at r=${result.bond_length} Å`,
    axes: {
      bottom: { title: 'Iteration', mapsTo: 'key', scaleType: ScaleTypes.LINEAR },
      left:   { title: 'Energy (Ha)', mapsTo: 'value', scaleType: ScaleTypes.LINEAR },
    },
    color: {
      scale: {
        'VQE Energy':     '#4589ff',
        'Exact (NumPy)':  '#f1c21b',
      },
    },
    curve: 'curveMonotoneX',
    height: '420px',
    theme: 'g100',
    toolbar: { enabled: false },
  }

  const chemAccuracy = result.error_vs_exact * 1000 < 1.6
  const conv = result.converged

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.25rem' }}>Results</h1>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <Tag type="blue"   size="sm">{result.molecule}</Tag>
        <Tag type="teal"   size="sm">r = {result.bond_length} Å</Tag>
        <Tag type="purple" size="sm">{result.mode}</Tag>
        <Tag type="gray"   size="sm">{result.backend_name}</Tag>
        <Tag type={conv ? 'green' : 'red'} size="sm">{conv ? '✓ Converged' : '⚠ Not converged'}</Tag>
      </div>

      {/* NISQ honesty banner */}
      <div className="honesty-banner" style={{ marginBottom: '1.5rem' }}>
        <strong>⚠ NISQ / H₂-scale — NOT a drug molecule</strong>
        {NISQ_NOTES.map((n, i) => <div key={i} style={{ marginTop: '0.25rem' }}>• {n}</div>)}
      </div>

      {/* Key results */}
      <p className="section-heading">Energy Comparison</p>
      <div className="results-compare">
        <div>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8d8d8d', marginBottom: '0.5rem' }}>VQE Result (Quantum)</div>
          <div className="energy-display">{result.final_energy.toFixed(8)} Ha</div>
          <div style={{ fontSize: '0.75rem', color: '#6f6f6f', marginTop: '0.375rem' }}>
            {result.n_function_evals} circuit evaluations · {result.elapsed_seconds}s elapsed
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8d8d8d', marginBottom: '0.5rem' }}>Classical Exact (NumPy eigensolver)</div>
          <div className="energy-display exact">{result.exact_energy.toFixed(8)} Ha</div>
          <div style={{ fontSize: '0.75rem', color: '#6f6f6f', marginTop: '0.375rem' }}>
            Direct diagonalisation of 4×4 Hamiltonian matrix
          </div>
        </div>
      </div>

      {/* Error metric */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#262626', borderLeft: `4px solid ${chemAccuracy ? '#42be65' : '#f1c21b'}`, marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8d8d8d' }}>|VQE − Exact|</span>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.75rem', color: chemAccuracy ? '#42be65' : '#f1c21b', marginTop: '0.25rem' }}>
          {(result.error_vs_exact * 1000).toFixed(4)} mHa
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#a8a8a8', marginTop: '0.25rem' }}>
          Chemical accuracy threshold: 1.6 mHa (1 kcal/mol).{' '}
          {chemAccuracy ? '✓ Within chemical accuracy for this illustrative Hamiltonian.' : '⚠ Outside chemical accuracy — expected for NISQ/illustrative Hamiltonians.'}
        </div>
      </div>

      {/* Convergence chart */}
      <p className="section-heading">Convergence Chart</p>
      <div className="chart-tile">
        <LineChart data={chartData} options={chartOptions} />
      </div>
      <p style={{ fontSize: '0.75rem', color: '#6f6f6f', marginTop: '0.5rem' }}>
        Blue line = VQE energy per optimizer iteration. Gold line = exact classical ground-state energy.
        VQE should converge to (or very near) the gold line.
      </p>

      {/* Optimal parameters */}
      <p className="section-heading" style={{ marginTop: '1.5rem' }}>Optimal Ansatz Parameters</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {result.optimal_params.map((p, i) => (
          <div key={i} style={{ background: '#1c1c1c', border: '1px solid #393939', padding: '0.375rem 0.75rem' }}>
            <span style={{ fontSize: '0.6875rem', color: '#6f6f6f' }}>θ_{i} </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.8125rem', color: '#4589ff' }}>
              {p.toFixed(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
