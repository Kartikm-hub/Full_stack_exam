import { useContext } from 'react'

import { AgentStatusContext } from '@/features/agent/AgentStatusContext'

export function useAgentStatus() {
  return useContext(AgentStatusContext)
}