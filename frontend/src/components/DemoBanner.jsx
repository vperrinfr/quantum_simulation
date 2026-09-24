import React from 'react'
import { InlineNotification } from '@carbon/react'

/**
 * DemoBanner — always visible, sticky below the 48px header.
 * Uses InlineNotification from Carbon v11 (verified via carbon-mcp code_search).
 */
export default function DemoBanner() {
  return (
    <InlineNotification
      kind="info"
      title="Demonstration Environment"
      subtitle="All molecular Hamiltonians are ILLUSTRATIVE (STO-3G literature values). Not suitable for real chemistry research. No real client data or PII is used."
      hideCloseButton
      lowContrast={false}
      role="status"
    />
  )
}
