/**
 * Shared API client and service functions.
 * Reads base URL from VITE_API_BASE_URL or defaults to /api.
 */
import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const client = axios.create({
  baseURL: BASE,
  timeout: 300_000,  // 5 min — VQE can be slow on cloud-qpu
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

// -------- circuit info
export const fetchCircuit = (molecule) =>
  client.get('/quantum/circuit', { params: { molecule } })

// -------- run VQE
export const runVQE = (payload) =>
  client.post('/quantum/run', payload)

// -------- health
export const fetchHealth = () => client.get('/health')
