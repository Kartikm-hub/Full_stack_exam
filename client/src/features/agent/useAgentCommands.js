import { useContext } from 'react'

import { AgentCommandsContext } from '@/features/agent/AgentStatusContext'

export function useAgentCommands() {
  const context = useContext(AgentCommandsContext)
  if (!context) throw new Error('useAgentCommands must be used within AgentStatusProvider')
  return context
}