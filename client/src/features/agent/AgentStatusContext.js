import { createContext } from 'react'

import { readAgentStatus } from '@/features/agent/agentStatus'

export const AgentStatusContext = createContext(readAgentStatus())
export const AgentCommandsContext = createContext(null)