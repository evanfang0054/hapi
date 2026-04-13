// @vitest-environment jsdom
import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTerminalSocket } from './useTerminalSocket'

const {
  ioMock,
  managerConstructorMock,
  managerSocketMock,
  socketConnectMock,
  socketOnMock,
  socketEmitMock,
  socketDisconnectMock,
  socketRemoveAllListenersMock
} = vi.hoisted(() => {
  const socket = {
    connected: false,
    auth: undefined as unknown,
    on: vi.fn(() => socket),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn()
  }

  return {
    ioMock: vi.fn(() => socket),
    managerConstructorMock: vi.fn(),
    managerSocketMock: vi.fn(() => socket),
    socketConnectMock: socket.connect,
    socketOnMock: socket.on,
    socketEmitMock: socket.emit,
    socketDisconnectMock: socket.disconnect,
    socketRemoveAllListenersMock: socket.removeAllListeners
  }
})

vi.mock('socket.io-client', () => {
  function Manager(baseUrl: string, options: Record<string, unknown>) {
    managerConstructorMock(baseUrl, options)
    return {
      socket: managerSocketMock
    }
  }

  return {
    io: ioMock,
    Manager
  }
})

function HookHarness(props: { baseUrl: string; token: string; sessionId: string; terminalId: string }) {
  const { connect } = useTerminalSocket(props)

  useEffect(() => {
    connect(120, 40)
  }, [connect])

  return null
}

describe('useTerminalSocket', () => {
  afterEach(() => {
    ioMock.mockClear()
    managerConstructorMock.mockClear()
    managerSocketMock.mockClear()
    socketConnectMock.mockClear()
    socketOnMock.mockClear()
    socketEmitMock.mockClear()
    socketDisconnectMock.mockClear()
    socketRemoveAllListenersMock.mockClear()
  })

  it('creates the terminal socket via Manager namespace API', () => {
    render(
      <HookHarness
        baseUrl="http://localhost:3000"
        token="secret"
        sessionId="session-1"
        terminalId="terminal-1"
      />
    )

    expect(ioMock).not.toHaveBeenCalled()
    expect(managerConstructorMock).toHaveBeenCalledWith('http://localhost:3000', {
      path: '/socket.io/',
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['polling', 'websocket'],
      autoConnect: false
    })
    expect(managerSocketMock).toHaveBeenCalledWith('/terminal', {
      auth: { token: 'secret' }
    })
    expect(socketConnectMock).toHaveBeenCalled()
  })
})
