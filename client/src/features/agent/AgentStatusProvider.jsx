import { useEffect, useMemo, useRef, useState } from 'react'

import { readAgentStatus } from '@/features/agent/agentStatus'
import { AgentCommandsContext, AgentStatusContext } from '@/features/agent/AgentStatusContext'
import { api } from '@/lib/api'

/** Owns the loopback WebSocket lifecycle and publishes only agent-reported state. */
export function AgentStatusProvider({ children, value }) {
  const [liveStatus, setLiveStatus] = useState(readAgentStatus)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    if (value) return

    let disposed = false
    let retryTimer
    let heartbeatTimer
    let heartbeatDeadline
    let retryDelay = 1000
    let socket

    function applyState(data) {
      const state = data?.state || data?.snapshot || data || {}
      const paired = Boolean(state.paired ?? state.isPaired)
      const active = Boolean(state.sessionActive ?? state.focusActive ?? state.activeSession)
      setLiveStatus((previous) => ({
        ...previous,
        status: active ? 'ACTIVE' : paired ? 'READY' : 'IDLE',
        agentId: state.agentId ?? state.deviceId ?? previous.agentId,
        label: state.label ?? state.name ?? previous.label,
        platform: state.platform ?? state.os ?? previous.platform,
        agentVersion: state.agentVersion ?? state.version ?? previous.agentVersion,
        paired,
        sessionActive: active,
        sessionId: state.sessionId ?? state.session?.id ?? null,
        sessionEndsAt: state.endsAt ?? state.session?.endsAt ?? null,
        lastSeenAt: new Date(),
      }))
    }

    function connect() {
      if (disposed) return
      const port = import.meta.env.VITE_AGENT_PORT || '4545'
      try {
        socket = new WebSocket(`ws://127.0.0.1:${port}/agent`)
      } catch {
        setLiveStatus(readAgentStatus())
        scheduleReconnect()
        return
      }
      socketRef.current = socket

      socket.addEventListener('open', () => {
        if (disposed) return socket.close()
        retryDelay = 1000
        heartbeatDeadline = Date.now()
        setConnected(true)
        setLiveStatus((previous) => ({ ...previous, status: 'IDLE', lastSeenAt: new Date() }))
        socket.send(JSON.stringify({ version: 1, type: 'hello', id: crypto.randomUUID(), timestamp: new Date().toISOString(), payload: {} }))
        socket.send(JSON.stringify({ version: 1, type: 'getState', id: crypto.randomUUID(), timestamp: new Date().toISOString(), payload: {} }))
        heartbeatTimer = window.setInterval(() => {
          if (Date.now() - heartbeatDeadline > 30000) {
            socket.close()
            return
          }
          socket.send(JSON.stringify({ version: 1, type: 'ping', id: crypto.randomUUID(), timestamp: new Date().toISOString(), payload: {} }))
        }, 15000)
      })

      socket.addEventListener('message', (event) => {
        let message
        try { message = JSON.parse(event.data) } catch { return }
        const data = message.payload || message.data || message
        if (message.type === 'pong') heartbeatDeadline = Date.now()
        if (message.type === 'paired') {
          setLiveStatus((previous) => ({ ...previous, paired: true, status: 'READY', lastSeenAt: new Date() }))
        } else if (message.type === 'state') {
          heartbeatDeadline = Date.now()
          applyState(data)
        } else if (message.type === 'focusStarted') {
          setLiveStatus((previous) => ({ ...previous, ...data, sessionActive: true, status: 'ACTIVE', lastSeenAt: new Date() }))
        } else if (message.type === 'focusEnded') {
          const endedSessionId = data.sessionId || data.id
          if (endedSessionId) {
            const status = data.reason === 'timeout' || data.completed ? 'COMPLETED' : 'CANCELLED'
            api.patch(`/sessions/${endedSessionId}`, { status }).catch(() => {})
          }
          setLiveStatus((previous) => ({ ...previous, ...data, sessionActive: false, sessionId: null, sessionEndsAt: null, status: previous.paired ? 'READY' : 'IDLE', lastSeenAt: new Date() }))
        } else if (message.type === 'error') {
          setLiveStatus((previous) => ({ ...previous, status: 'FAILED' }))
        }
      })

      socket.addEventListener('close', () => {
        window.clearInterval(heartbeatTimer)
        socketRef.current = null
        setConnected(false)
        if (disposed) return
        setLiveStatus(readAgentStatus())
        scheduleReconnect()
      })
      socket.addEventListener('error', () => socket.close())
    }

    function scheduleReconnect() {
      if (disposed || retryTimer) return
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined
        connect()
      }, retryDelay + Math.random() * 250)
      retryDelay = Math.min(retryDelay * 2, 30000)
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      window.clearInterval(heartbeatTimer)
      socket?.close()
    }
  }, [value])

  const status = useMemo(() => value ?? liveStatus, [value, liveStatus])
  const commands = useMemo(() => ({
    connected,
    send(type, payload = {}) {
      const socket = socketRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error('The local Focus Mode agent is not connected.')
      socket.send(JSON.stringify({ version: 1, type, id: crypto.randomUUID(), timestamp: new Date().toISOString(), payload }))
    },
  }), [connected])

  return (
    <AgentStatusContext.Provider value={status}>
      <AgentCommandsContext.Provider value={commands}>{children}</AgentCommandsContext.Provider>
    </AgentStatusContext.Provider>
  )
}
