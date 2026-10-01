import { createContext, useContext, useMemo } from 'react'

import { readAgentStatus } from '@/features/agent/agentStatus'

/**
 * Seam between the UI and the future agent transport.
 *
 * Today it resolves a static `UNAVAILABLE` snapshot. Prompt 010 replaces the
 * provider body with the localhost WebSocket client (`getState`, `state.push`,
 * heartbeat, reconnect) and every consumer keeps working unchanged, because
 * they all read `AgentStatus` through `useAgentStatus()`.
 *
 * This deliberately contains no WebSocket code yet.
 */
const AgentStatusContext = createContext(readAgentStatus())

export function AgentStatusProvider({ children, value }) {
  const status = useMemo(() => value ?? readAgentStatus(), [value])

  return <AgentStatusContext.Provider value={status}>{children}</AgentStatusContext.Provider>
}

/**
 * Current local-agent status.
 *
 * @returns {import('@/features/agent/agentStatus').AgentStatus}
 */
export function useAgentStatus() {
  return useContext(AgentStatusContext)
}

export { AgentStatusContext }