/**
 * Composable for managing dedicated WebSocket connections for script execution output.
 * Each execution gets its own WebSocket connection (similar to logs/terminal).
 */

interface ExecutionState {
  id: number
  serverId: string
  serverName: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  exitCode: number | null
  output: string
  ws: WebSocket | null
}

export const useScriptExecution = () => {
  const config = useRuntimeConfig()
  const { token } = useAuth()
  const { getCurrentTeamId } = useApi()

  const executions = ref<Map<number, ExecutionState>>(new Map())

  /**
   * Connect to a script execution WebSocket
   */
  const connectExecution = (
    executionId: number,
    serverId: string,
    serverName: string,
    onOutput?: (output: string) => void,
    onStatusChange?: (status: string, exitCode?: number) => void,
  ) => {
    // Initialize execution state
    const state: ExecutionState = {
      id: executionId,
      serverId,
      serverName,
      status: 'pending',
      exitCode: null,
      output: '',
      ws: null,
    }

    const wsBase = config.public.wsBase as string
    const teamId = getCurrentTeamId()
    const wsUrl = `${wsBase}/scripts/execute?executionId=${executionId}&token=${token.value}&team_id=${teamId}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log(`[ScriptExecution] Connected: ${executionId}`)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'started') {
          state.status = 'running'
          executions.value.set(executionId, { ...state })
          onStatusChange?.('running')
        } else if (msg.type === 'completed') {
          state.status = msg.status as 'finished' | 'failed'
          state.exitCode = msg.exit_code
          executions.value.set(executionId, { ...state })
          onStatusChange?.(msg.status, msg.exit_code)
        } else if (msg.type === 'error') {
          console.error(`[ScriptExecution] Error: ${msg.message}`)
          state.status = 'failed'
          state.output += `\nError: ${msg.message}`
          executions.value.set(executionId, { ...state })
          onStatusChange?.('failed')
        }
      } catch {
        // Raw text = script output (stdout/stderr)
        state.output += event.data
        executions.value.set(executionId, { ...state })
        onOutput?.(event.data)
      }
    }

    ws.onclose = () => {
      console.log(`[ScriptExecution] Disconnected: ${executionId}`)
      state.ws = null
    }

    ws.onerror = (err) => {
      console.error(`[ScriptExecution] Error for ${executionId}:`, err)
    }

    state.ws = ws
    executions.value.set(executionId, state)

    return state
  }

  /**
   * Disconnect a specific execution WebSocket
   */
  const disconnectExecution = (executionId: number) => {
    const state = executions.value.get(executionId)
    if (state?.ws) {
      state.ws.close()
      state.ws = null
    }
  }

  /**
   * Disconnect all execution WebSockets
   */
  const disconnectAll = () => {
    for (const [id] of executions.value) {
      disconnectExecution(id)
    }
    executions.value.clear()
  }

  /**
   * Get execution state by ID
   */
  const getExecution = (executionId: number) => {
    return executions.value.get(executionId)
  }

  // Cleanup on unmount
  if (getCurrentInstance()) {
    onUnmounted(() => {
      disconnectAll()
    })
  }

  return {
    executions: readonly(executions),
    connectExecution,
    disconnectExecution,
    disconnectAll,
    getExecution,
  }
}
