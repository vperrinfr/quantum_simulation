/**
 * QuantumMappingPanel — Feature 3
 *
 * Collapsible expander showing:
 *   1. SparsePauliOp Hamiltonian (copyable code block)
 *   2. Ansatz circuit text diagram
 *   3. Transpiled ISA depth / gate-count table (CSV downloadable)
 *
 * Expanding does NOT re-trigger a simulation — data is fetched once when
 * the panel opens or when molecule / backend props change.
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  Accordion,
  AccordionItem,
  Dropdown,
  Tag,
  Loading,
  InlineNotification,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react'
import { Copy, Download, ChevronDown, Information } from '@carbon/icons-react'
import { fetchCircuit, fetchCircuitISA } from '../services/api'

const FAKE_BACKENDS = [
  { id: 'FakeNairobi',    text: 'FakeNairobi (7 qubits)' },
  { id: 'FakeManilaV2',  text: 'FakeManilaV2 (5 qubits)' },
  { id: 'FakeSherbrooke', text: 'FakeSherbrooke (127 qubits)' },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      aria-label="Copy Hamiltonian to clipboard"
      style={{
        background: 'transparent',
        border: '1px solid #393939',
        color: copied ? '#42be65' : '#a8a8a8',
        padding: '0.25rem 0.6rem',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontFamily: 'IBM Plex Sans',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        transition: 'color 0.2s',
      }}
    >
      <Copy size={14} />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function downloadGateCSV(isaData) {
  const rows = Object.entries(isaData.isa_gate_counts).map(([gate, count]) => [gate, count])
  const header = 'gate,count'
  const csv = [header, ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `isa_gates_${isaData.molecule}_${isaData.fake_backend}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Props:
 *   molecule    {string}  — H2 | LiH | H2O
 *   bondLength  {number}  — current bond length (Å)
 */
export default function QuantumMappingPanel({ molecule, bondLength }) {
  const [open,        setOpen]        = useState(false)
  const [backend,     setBackend]     = useState('FakeNairobi')
  const [circuitData, setCircuitData] = useState(null)
  const [isaData,     setIsaData]     = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  // Track last-fetched key so we know when to refetch
  const fetchedKey = useRef(null)
  const currentKey = `${molecule}__${backend}`

  const loadData = () => {
    if (fetchedKey.current === currentKey) return  // already loaded
    setLoading(true); setError(null)
    Promise.all([
      fetchCircuit(molecule),
      fetchCircuitISA(molecule, backend),
    ])
      .then(([cData, iData]) => {
        setCircuitData(cData)
        setIsaData(iData)
        fetchedKey.current = currentKey
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  // Re-fetch when molecule or backend changes (if panel is open)
  useEffect(() => {
    if (!open) return
    fetchedKey.current = null  // invalidate cache
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [molecule, backend])

  const handleOpen = (isOpen) => {
    setOpen(isOpen)
    if (isOpen) loadData()
  }

  // Gate count table rows
  const gateRows = isaData
    ? Object.entries(isaData.isa_gate_counts).map(([gate, count], i) => ({
        id: String(i),
        gate,
        count: String(count),
        isCX: gate === 'cx' || gate === 'ecr' || gate === 'cz',
      }))
    : []

  return (
    <div style={{ marginTop: '2rem' }}>
      <Accordion>
        <AccordionItem
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Information size={16} style={{ color: '#4589ff' }} />
              How this maps to quantum
            </span>
          }
          open={open}
          onHeadingClick={({ isOpen }) => handleOpen(isOpen)}
        >
          {/* Backend selector — inside panel, does not trigger re-run */}
          <div style={{ marginBottom: '1.25rem', maxWidth: 320 }}>
            <Dropdown
              id="qmp-backend"
              titleText="Target backend (for ISA transpilation)"
              label="Select backend"
              items={FAKE_BACKENDS}
              selectedItem={FAKE_BACKENDS.find(b => b.id === backend)}
              itemToString={item => item?.text ?? ''}
              onChange={({ selectedItem }) => {
                if (!selectedItem) return
                setBackend(selectedItem.id)
              }}
              size="sm"
            />
            <p style={{ fontSize: '0.6875rem', color: '#6f6f6f', marginTop: '0.4rem' }}>
              Changing backend re-transpiles the circuit. No simulation is re-run.
            </p>
          </div>

          {error && (
            <InlineNotification
              kind="error"
              title="Error loading quantum info"
              subtitle={error}
              hideCloseButton
              style={{ marginBottom: '1rem' }}
            />
          )}

          {loading && (
            <Loading description="Loading circuit data…" withOverlay={false} />
          )}

          {!loading && isaData && circuitData && (
            <>
              {/* ── 1. Qubit Hamiltonian ── */}
              <p className="section-heading" style={{ marginTop: '0.5rem' }}>
                Qubit Hamiltonian (SparsePauliOp)
                <span style={{ fontSize: '0.6875rem', color: '#6f6f6f', marginLeft: '0.5rem' }}>
                  r = {bondLength?.toFixed(3)} Å · illustrative STO-3G mapping
                </span>
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.3rem' }}>
                <CopyButton text={isaData.hamiltonian_repr} />
              </div>
              <div
                style={{
                  background: '#161616',
                  border: '1px solid #393939',
                  borderRadius: '2px',
                  padding: '1rem',
                  fontFamily: 'IBM Plex Mono',
                  fontSize: '0.8125rem',
                  color: '#08bdba',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
                aria-label="Qubit Hamiltonian SparsePauliOp"
              >
                {isaData.hamiltonian_repr}
              </div>

              {/* ── 2. Ansatz circuit ── */}
              <p className="section-heading" style={{ marginTop: '1.5rem' }}>
                Ansatz Circuit (EfficientSU2, reps=1)
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <Tag type="blue"   size="sm">{circuitData.n_qubits} qubits</Tag>
                <Tag type="teal"   size="sm">{circuitData.n_parameters} params</Tag>
                <Tag type="purple" size="sm">depth {circuitData.depth}</Tag>
                {Object.entries(circuitData.gates || {}).map(([g, n]) => (
                  <Tag key={g} type="outline" size="sm">{g} ×{n}</Tag>
                ))}
              </div>
              <div className="circuit-diagram" aria-label="Ansatz circuit diagram">
                {circuitData.circuit_text}
              </div>

              {/* ── 3. Transpiled ISA stats ── */}
              <p className="section-heading" style={{ marginTop: '1.5rem' }}>
                Transpiled ISA Circuit — {backend}
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div className="kpi-tile" style={{ minWidth: 120 }}>
                  <div className="kpi-tile__label">Original depth</div>
                  <div className="kpi-tile__value">{isaData.ansatz_depth}</div>
                </div>
                <div className="kpi-tile" style={{ minWidth: 120 }}>
                  <div className="kpi-tile__label">ISA depth</div>
                  <div className="kpi-tile__value" style={{ color: '#f1c21b' }}>{isaData.isa_depth}</div>
                </div>
                <div className="kpi-tile" style={{ minWidth: 120 }}>
                  <div className="kpi-tile__label">CX / CNOT gates</div>
                  <div className="kpi-tile__value" style={{ color: '#fa4d56' }}>{isaData.cx_count}</div>
                  <div className="kpi-tile__sublabel">entangling ops (main noise source)</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <Button
                  renderIcon={Download}
                  onClick={() => downloadGateCSV(isaData)}
                  kind="ghost"
                  size="sm"
                >
                  Download gate counts CSV
                </Button>
              </div>

              <DataTable
                rows={gateRows}
                headers={[
                  { key: 'gate',  header: 'Gate' },
                  { key: 'count', header: 'Count' },
                ]}
                size="sm"
              >
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                  <Table {...getTableProps()} style={{ marginBottom: '1rem' }}>
                    <TableHead>
                      <TableRow>
                        {headers.map(h => (
                          <TableHeader {...getHeaderProps({ header: h })} key={h.key}>
                            {h.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          {row.cells.map(cell => (
                            <TableCell
                              key={cell.id}
                              style={{
                                fontFamily: 'IBM Plex Mono',
                                color: row.cells[0]?.value && (
                                  row.cells[0].value === 'cx' ||
                                  row.cells[0].value === 'ecr' ||
                                  row.cells[0].value === 'cz'
                                ) ? '#fa4d56' : undefined,
                              }}
                            >
                              {cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DataTable>

              <p style={{ fontSize: '0.6875rem', color: '#6f6f6f' }}>
                ISA = Instruction Set Architecture. The transpiler rewrites the ansatz into
                the native gate set ({backend}) and routes to the device topology.
                A higher CX count → more noise exposure.
              </p>
            </>
          )}
        </AccordionItem>
      </Accordion>
    </div>
  )
}
