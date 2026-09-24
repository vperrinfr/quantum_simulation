import React, { useState, useCallback } from 'react'
import {
  Button,
  Dropdown,
  Toggle,
  InlineNotification,
  ProgressBar,
  Tag,
} from '@carbon/react'
import { ChartLine, PlayFilledAlt, Reset, Download } from '@carbon/icons-react'
import { LineChart } from '@carbon/charts-react'
import { ScaleTypes } from '@carbon/charts'
import { runSweep } from '../services/api'

// ── constants ──────────────────────────────────────────────────────────────

const MOLECULES = [
  { id: 'H2',  text: 'H₂ — Hydrogen' },
  { id: 'LiH', text: 'LiH — Lithium Hydride' },
  { id: 'H2O', text: 'H₂O — Water' },
]

const FAKE_BACKENDS = [
  { id: 'FakeNairobi',    text: 'FakeNairobi (7 qubits)' },
  { id: 'FakeManilaV2',  text: 'FakeManilaV2 (5 qubits)' },
  { id: 'FakeSherbrooke', text: 'FakeSherbrooke (127 qubits)' },
]

const MOL_RANGES = {
  H2:  { min: 0.3,  max: 2.5,  ref: 0.74 },
  LiH: { min: 1.0,  max: 4.0,  ref: 1.595 },
  H2O: { min: 0.6,  max: 2.0,  ref: 0.958 },
}

const SERIES_COLORS = {
  'Exact (classical)':  '#f1c21b',
  'VQE — Ideal':        '#4589ff',
  'VQE — Noisy':        '#fa4d56',
  'VQE — Mitigated':    '#42be65',
}

// ── helpers ────────────────────────────────────────────────────────────────

function buildChartData(sweepResult) {
  const { bond_lengths, series } = sweepResult
  const data = []
  const seriesMap = {
    exact:     'Exact (classical)',
    ideal:     'VQE — Ideal',
    noisy:     'VQE — Noisy',
    mitigated: 'VQE — Mitigated',
  }
  for (const [key, label] of Object.entries(seriesMap)) {
    if (!series[key]) continue
    series[key].forEach((e, i) => {
      data.push({ group: label, key: bond_lengths[i], value: e })
    })
  }
  return data
}

function downloadCSV(sweepResult) {
  const { bond_lengths, series } = sweepResult
  const headers = ['bond_length_A', 'exact_Ha', 'ideal_vqe_Ha',
    ...(series.noisy     ? ['noisy_vqe_Ha']     : []),
    ...(series.mitigated ? ['mitigated_vqe_Ha'] : []),
  ]
  const rows = bond_lengths.map((r, i) => [
    r,
    series.exact[i],
    series.ideal[i],
    ...(series.noisy     ? [series.noisy[i]]     : []),
    ...(series.mitigated ? [series.mitigated[i]] : []),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `bond_curve_${sweepResult.molecule}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── component ──────────────────────────────────────────────────────────────

export default function BondCurvePage() {
  const [molecule,        setMolecule]        = useState('H2')
  const [fakeBackend,     setFakeBackend]      = useState('FakeNairobi')
  const [includeNoisy,    setIncludeNoisy]     = useState(true)
  const [includeMitigated, setIncludeMitigated] = useState(true)
  const [rMin,            setRMin]             = useState(0.3)
  const [rMax,            setRMax]             = useState(2.5)
  const [rStep,           setRStep]            = useState(0.1)
  const [maxIter,         setMaxIter]          = useState(80)
  const [running,         setRunning]          = useState(false)
  const [progress,        setProgress]         = useState(0)
  const [result,          setResult]           = useState(null)
  const [error,           setError]            = useState(null)

  const nPoints = Math.round((rMax - rMin) / rStep) + 1

  const handleMoleculeChange = useCallback(({ selectedItem }) => {
    if (!selectedItem) return
    setMolecule(selectedItem.id)
    const range = MOL_RANGES[selectedItem.id]
    setRMin(range.min)
    setRMax(range.max)
    setResult(null); setError(null)
  }, [])

  const handleRun = async () => {
    setRunning(true); setError(null); setResult(null); setProgress(5)
    try {
      // Fake incremental progress ticks while waiting
      const timer = setInterval(() => {
        setProgress(p => Math.min(p + 3, 90))
      }, 1500)

      const data = await runSweep({
        molecule,
        r_min: rMin,
        r_max: rMax,
        r_step: rStep,
        max_iter: maxIter,
        seed: 42,
        fake_backend: fakeBackend,
        include_noisy: includeNoisy,
        include_mitigated: includeMitigated,
      })

      clearInterval(timer)
      setProgress(100)
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const chartData    = result ? buildChartData(result) : []
  const chartOptions = {
    title: `H₂ Bond Dissociation Curve${result ? ` — ${result.molecule}` : ''}`,
    axes: {
      bottom: {
        title: 'Bond Length (Å)',
        mapsTo: 'key',
        scaleType: ScaleTypes.LINEAR,
      },
      left: {
        title: 'Energy (Ha)',
        mapsTo: 'value',
        scaleType: ScaleTypes.LINEAR,
      },
    },
    color: { scale: SERIES_COLORS },
    curve: 'curveMonotoneX',
    height: '460px',
    theme: 'g100',
    toolbar: { enabled: false },
    points: { radius: 3 },
  }

  const eq = result?.equilibrium

  return (
    <div className="page-content">
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '0.5rem' }}>
        Bond Dissociation Curve
      </h1>
      <p style={{ color: '#a8a8a8', marginBottom: '1.5rem', maxWidth: '720px' }}>
        Sweep bond lengths and compare VQE energies (ideal, noisy, mitigated) against the
        exact classical reference. The equilibrium bond length is marked where energy is
        minimised. All runs are local — no IBM Quantum account required.
      </p>

      {/* ── Controls ── */}
      <div className="run-controls" style={{ alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Dropdown
            id="bc-mol"
            titleText="Molecule"
            label="Select molecule"
            items={MOLECULES}
            selectedItem={MOLECULES.find(m => m.id === molecule)}
            itemToString={item => item?.text ?? ''}
            onChange={handleMoleculeChange}
            disabled={running}
          />
          <Dropdown
            id="bc-backend"
            titleText="Fake backend (noise model)"
            label="Select backend"
            items={FAKE_BACKENDS}
            selectedItem={FAKE_BACKENDS.find(b => b.id === fakeBackend)}
            itemToString={item => item?.text ?? ''}
            onChange={({ selectedItem }) => selectedItem && setFakeBackend(selectedItem.id)}
            disabled={running}
          />
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Toggle
              id="toggle-noisy"
              labelText="Noisy series"
              toggled={includeNoisy}
              onToggle={setIncludeNoisy}
              disabled={running}
              size="sm"
            />
            <Toggle
              id="toggle-mit"
              labelText="Mitigated series"
              toggled={includeMitigated}
              onToggle={setIncludeMitigated}
              disabled={running || !includeNoisy}
              size="sm"
            />
          </div>
        </div>

        {/* Right column — range sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 260 }}>
          {[
            { label: 'r min', value: rMin, min: 0.1, max: rMax - rStep, step: 0.05, set: setRMin },
            { label: 'r max', value: rMax, min: rMin + rStep, max: 6.0,  step: 0.05, set: setRMax },
            { label: 'Step',  value: rStep, min: 0.05, max: 0.5, step: 0.05, set: setRStep },
            { label: 'Max VQE iterations', value: maxIter, min: 20, max: 200, step: 10, set: setMaxIter },
          ].map(({ label, value, min, max, step, set }) => (
            <div key={label}>
              <label style={{ fontSize: '0.75rem', color: '#a8a8a8', display: 'block', marginBottom: '0.4rem' }}>
                {label}:{' '}
                <span style={{ fontFamily: 'IBM Plex Mono', color: '#08bdba' }}>
                  {label === 'Max VQE iterations' ? value : `${value.toFixed(2)} Å`}
                </span>
              </label>
              <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#4589ff' }}
                disabled={running}
              />
            </div>
          ))}
          <p style={{ fontSize: '0.6875rem', color: '#6f6f6f', margin: 0 }}>
            {nPoints} points · {includeNoisy ? (includeMitigated ? '3 series' : '2 series') : '2 series'}
          </p>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: '1rem', margin: '1.5rem 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          renderIcon={running ? undefined : PlayFilledAlt}
          onClick={handleRun}
          disabled={running || nPoints > 60}
          kind="primary"
          size="lg"
        >
          {running ? 'Running sweep…' : 'Run sweep'}
        </Button>
        <Button
          renderIcon={Reset}
          onClick={() => { setResult(null); setError(null); setProgress(0) }}
          disabled={running}
          kind="ghost"
          size="lg"
        >
          Reset
        </Button>
        {result && (
          <Button
            renderIcon={Download}
            onClick={() => downloadCSV(result)}
            kind="tertiary"
            size="lg"
          >
            Download CSV
          </Button>
        )}
        {nPoints > 60 && (
          <Tag type="red" size="sm">Too many points ({nPoints} &gt; 60) — increase step</Tag>
        )}
        {running && <span className="status-pill running">● Running</span>}
        {result && !running && (
          <span className="status-pill done">✓ {result.n_points} points · {result.fake_backend}</span>
        )}
      </div>

      {/* ── Progress ── */}
      {running && (
        <div style={{ marginBottom: '1rem' }}>
          <ProgressBar
            label={`Computing ${nPoints} geometries…`}
            value={progress}
            max={100}
            size="sm"
            status={progress < 100 ? 'active' : 'finished'}
          />
        </div>
      )}

      {error && (
        <InlineNotification
          kind="error"
          title="Sweep error"
          subtitle={error}
          hideCloseButton
          style={{ marginBottom: '1rem' }}
        />
      )}

      {/* ── Equilibrium info ── */}
      {eq && (
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="kpi-tile success">
            <div className="kpi-tile__label">Equilibrium Bond Length</div>
            <div className="kpi-tile__value" style={{ fontFamily: 'IBM Plex Mono', color: '#f1c21b' }}>
              {eq.bond_length.toFixed(3)} Å
            </div>
            <div className="kpi-tile__sublabel">Minimum of exact curve</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-tile__label">Exact Energy at Eq.</div>
            <div className="kpi-tile__value" style={{ fontFamily: 'IBM Plex Mono', color: '#f1c21b' }}>
              {eq.exact_energy.toFixed(6)} Ha
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-tile__label">VQE (Ideal) at Eq.</div>
            <div className="kpi-tile__value" style={{ fontFamily: 'IBM Plex Mono', color: '#4589ff' }}>
              {eq.ideal_vqe_energy.toFixed(6)} Ha
            </div>
          </div>
          {eq.noise_shift_ha != null && (
            <div className="kpi-tile warning">
              <div className="kpi-tile__label">Noise Shift at Eq.</div>
              <div className="kpi-tile__value" style={{ fontFamily: 'IBM Plex Mono', color: '#fa4d56' }}>
                {eq.noise_shift_ha > 0 ? '+' : ''}{eq.noise_shift_ha.toFixed(4)} Ha
              </div>
              <div className="kpi-tile__sublabel">Noisy VQE − exact; mitigation reduces this</div>
            </div>
          )}
        </div>
      )}

      {/* ── Chart ── */}
      {result && (
        <div className="chart-tile">
          <LineChart data={chartData} options={chartOptions} />
          <p style={{ fontSize: '0.75rem', color: '#6f6f6f', marginTop: '0.75rem', padding: '0 0.5rem 0.5rem' }}>
            <strong style={{ color: '#f1c21b' }}>Yellow</strong>: exact classical diagonalisation &nbsp;·&nbsp;
            <strong style={{ color: '#4589ff' }}>Blue</strong>: ideal VQE (StatevectorEstimator) &nbsp;·&nbsp;
            {result.series.noisy && <><strong style={{ color: '#fa4d56' }}>Red</strong>: noisy VQE ({result.fake_backend}) &nbsp;·&nbsp;</>}
            {result.series.mitigated && <><strong style={{ color: '#42be65' }}>Green</strong>: mitigated (T-REx resilience_level=1)</>}
          </p>
        </div>
      )}
    </div>
  )
}
