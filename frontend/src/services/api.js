/**
 * Shared API client and service functions.
 * Reads base URL from VITE_API_BASE_URL or defaults to /api.
 */
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({
  baseURL: BASE,
  timeout: 600_000,  // 10 min — sweep can be slow with noisy+mitigated
})

client.interceptors.response.use(
  (r) => r.data,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

// -------- molecules catalogue
export const fetchMolecules = () => client.get('/quantum/molecules')

// -------- hamiltonian at a bond length
export const fetchHamiltonian = (molecule, bondLength) =>
  client.get('/quantum/hamiltonian', { params: { molecule, bond_length: bondLength } })

// -------- circuit info (ansatz metadata)
export const fetchCircuit = (molecule) =>
  client.get('/quantum/circuit', { params: { molecule } })

// -------- transpiled ISA circuit stats for a fake backend
export const fetchCircuitISA = (molecule, fakeBackend) =>
  client.get('/quantum/circuit-isa', { params: { molecule, fake_backend: fakeBackend } })

// -------- list available fake backends
export const fetchFakeBackends = () => client.get('/quantum/fake-backends')

// -------- run single-point VQE
export const runVQE = (payload) =>
  client.post('/quantum/run', payload)

// -------- run bond-dissociation sweep
export const runSweep = (payload) =>
  client.post('/quantum/sweep', payload)

// -------- health
export const fetchHealth = () => client.get('/health')
