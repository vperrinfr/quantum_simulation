import React, { createContext, useContext, useReducer } from 'react'

const DemoContext = createContext(null)

const initialState = {
  // selected molecule + bond length
  selectedMolecule: 'H2',
  bondLength: 0.74,

  // VQE configuration
  vqeMode: 'local-ideal',   // local-ideal | local-noisy | cloud-qpu
  maxIter: 200,
  seed: 42,

  // Result of the last VQE run
  lastResult: null,

  // UI state
  isRunning: false,
  runError: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MOLECULE':
      return { ...state, selectedMolecule: action.molecule }
    case 'SET_BOND_LENGTH':
      return { ...state, bondLength: action.bondLength }
    case 'SET_VQE_MODE':
      return { ...state, vqeMode: action.mode }
    case 'SET_MAX_ITER':
      return { ...state, maxIter: action.maxIter }
    case 'SET_SEED':
      return { ...state, seed: action.seed }
    case 'RUN_START':
      return { ...state, isRunning: true, runError: null }
    case 'RUN_SUCCESS':
      return { ...state, isRunning: false, lastResult: action.result, runError: null }
    case 'RUN_ERROR':
      return { ...state, isRunning: false, runError: action.error }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function DemoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <DemoContext.Provider value={{ state, dispatch }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemoContext() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemoContext must be used inside DemoProvider')
  return ctx
}
