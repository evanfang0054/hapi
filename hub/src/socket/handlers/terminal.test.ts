import { describe, expect, it } from 'bun:test'
import { registerTerminalHandlers } from './terminal'
import { TerminalRegistry } from '../terminalRegistry'
import type { SocketServer, SocketWithData } from '../socketTypes'

type EmittedEvent = {
    event: string
    data: unknown
}

class FakeSocket {
    readonly id: string
    readonly data: Record<string, unknown> = {}
    readonly emitted: EmittedEvent[] = []
    private readonly handlers = new Map<string, (...args: unknown[]) => void>()

    constructor(id: string) {
        this.id = id
    }

    on(event: string, handler: (...args: unknown[]) => void): this {
        this.handlers.set(event, handler)
        return this
    }

    emit(event: string, data: unknown): boolean {
        this.emitted.push({ event, data })
        return true
    }

    trigger(event: string, data?: unknown): void {
        const handler = this.handlers.get(event)
        if (!handler) {
            return
        }
        if (typeof data === 'undefined') {
            handler()
            return
        }
        handler(data)
    }
}

class FakeNamespace {
    readonly sockets = new Map<string, FakeSocket>()
    readonly adapter = { rooms: new Map<string, Set<string>>() }
}

class FakeServer {
    private readonly namespaces = new Map<string, FakeNamespace>()

    of(name: string): FakeNamespace {
        const existing = this.namespaces.get(name)
        if (existing) {
            return existing
        }
        const namespace = new FakeNamespace()
        this.namespaces.set(name, namespace)
        return namespace
    }
}

type Harness = {
    io: FakeServer
    terminalSocket: FakeSocket
    cliNamespace: FakeNamespace
    terminalRegistry: TerminalRegistry
}

function createHarness(options?: {
    sessionActive?: boolean
    maxTerminalsPerSocket?: number
    maxTerminalsPerSession?: number
}): Harness {
    const io = new FakeServer()
    const terminalSocket = new FakeSocket('terminal-socket')
    terminalSocket.data.namespace = 'default'
    const terminalRegistry = new TerminalRegistry({ idleTimeoutMs: 0 })
    const cliNamespace = io.of('/cli')

    registerTerminalHandlers(terminalSocket as unknown as SocketWithData, {
        io: io as unknown as SocketServer,
        getSession: () => ({ active: options?.sessionActive ?? true, namespace: 'default' }),
        terminalRegistry,
        maxTerminalsPerSocket: options?.maxTerminalsPerSocket ?? 4,
        maxTerminalsPerSession: options?.maxTerminalsPerSession ?? 4
    })

    return { io, terminalSocket, cliNamespace, terminalRegistry }
}

function connectCliSocket(cliNamespace: FakeNamespace, cliSocket: FakeSocket, sessionId: string): void {
    cliSocket.data.namespace = 'default'
    cliNamespace.sockets.set(cliSocket.id, cliSocket)
    const roomId = `session:${sessionId}`
    const room = cliNamespace.adapter.rooms.get(roomId) ?? new Set<string>()
    room.add(cliSocket.id)
    cliNamespace.adapter.rooms.set(roomId, room)
}

function lastEmit(socket: FakeSocket, event: string): EmittedEvent | undefined {
    return [...socket.emitted].reverse().find((entry) => entry.event === event)
}

describe('terminal socket handlers', () => {
    it('re-registers a terminal when same session reconnects with a new socket', () => {
        const registry = new TerminalRegistry({ idleTimeoutMs: 0 })

        const first = registry.register('terminal-1', 'session-1', 'socket-1', 'cli-1')
        expect(first).not.toBeNull()

        const second = registry.register('terminal-1', 'session-1', 'socket-2', 'cli-1')
        expect(second?.socketId).toBe('socket-2')
        expect(registry.get('terminal-1')?.socketId).toBe('socket-2')
    })

    it('keeps rejecting terminal reuse across different sessions', () => {
        const registry = new TerminalRegistry({ idleTimeoutMs: 0 })
        registry.register('terminal-1', 'session-1', 'socket-1', 'cli-1')

        const second = registry.register('terminal-1', 'session-2', 'socket-2', 'cli-1')
        expect(second).toBeNull()
    })

    it('allows same-session reconnect replace even when terminal limits are full', () => {
        const io = new FakeServer()
        const terminalRegistry = new TerminalRegistry({ idleTimeoutMs: 0 })
        const cliNamespace = io.of('/cli')
        const cliSocket = new FakeSocket('cli-socket-1')
        connectCliSocket(cliNamespace, cliSocket, 'session-1')

        const firstTerminalSocket = new FakeSocket('terminal-socket-1')
        firstTerminalSocket.data.namespace = 'default'
        registerTerminalHandlers(firstTerminalSocket as unknown as SocketWithData, {
            io: io as unknown as SocketServer,
            getSession: () => ({ active: true, namespace: 'default' }),
            terminalRegistry,
            maxTerminalsPerSocket: 1,
            maxTerminalsPerSession: 1
        })

        firstTerminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 80,
            rows: 24
        })

        const secondTerminalSocket = new FakeSocket('terminal-socket-2')
        secondTerminalSocket.data.namespace = 'default'
        registerTerminalHandlers(secondTerminalSocket as unknown as SocketWithData, {
            io: io as unknown as SocketServer,
            getSession: () => ({ active: true, namespace: 'default' }),
            terminalRegistry,
            maxTerminalsPerSocket: 1,
            maxTerminalsPerSession: 1
        })

        secondTerminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 120,
            rows: 40
        })

        expect(lastEmit(secondTerminalSocket, 'terminal:error')).toBeUndefined()
        expect(terminalRegistry.get('terminal-1')?.socketId).toBe('terminal-socket-2')
        expect(lastEmit(cliSocket, 'terminal:open')?.data).toEqual({
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 120,
            rows: 40
        })
    })

    it('rejects terminal creation when session is inactive', () => {
        const { terminalSocket, terminalRegistry } = createHarness({ sessionActive: false })

        terminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 80,
            rows: 24
        })

        const errorEvent = lastEmit(terminalSocket, 'terminal:error')
        expect(errorEvent).toBeDefined()
        expect(errorEvent?.data).toEqual({
            terminalId: 'terminal-1',
            message: 'Session is inactive or unavailable.'
        })
        expect(terminalRegistry.get('terminal-1')).toBeNull()
    })

    it('opens a terminal and forwards write/resize/close to the CLI socket', () => {
        const { terminalSocket, cliNamespace, terminalRegistry } = createHarness()
        const cliSocket = new FakeSocket('cli-socket-1')
        connectCliSocket(cliNamespace, cliSocket, 'session-1')

        terminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 120,
            rows: 40
        })

        const openEvent = lastEmit(cliSocket, 'terminal:open')
        expect(openEvent?.data).toEqual({
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 120,
            rows: 40
        })
        expect(terminalRegistry.get('terminal-1')).not.toBeNull()

        terminalSocket.trigger('terminal:write', {
            terminalId: 'terminal-1',
            data: 'ls\n'
        })
        const writeEvent = lastEmit(cliSocket, 'terminal:write')
        expect(writeEvent?.data).toEqual({
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            data: 'ls\n'
        })

        terminalSocket.trigger('terminal:resize', {
            terminalId: 'terminal-1',
            cols: 100,
            rows: 30
        })
        const resizeEvent = lastEmit(cliSocket, 'terminal:resize')
        expect(resizeEvent?.data).toEqual({
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 100,
            rows: 30
        })

        terminalSocket.trigger('terminal:close', {
            terminalId: 'terminal-1'
        })
        const closeEvent = lastEmit(cliSocket, 'terminal:close')
        expect(closeEvent?.data).toEqual({
            sessionId: 'session-1',
            terminalId: 'terminal-1'
        })
        expect(terminalRegistry.get('terminal-1')).toBeNull()
    })

    it('cleans up and notifies CLI on terminal socket disconnect', () => {
        const { terminalSocket, cliNamespace, terminalRegistry } = createHarness()
        const cliSocket = new FakeSocket('cli-socket-1')
        connectCliSocket(cliNamespace, cliSocket, 'session-1')

        terminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 90,
            rows: 24
        })

        terminalSocket.trigger('disconnect')

        const closeEvent = lastEmit(cliSocket, 'terminal:close')
        expect(closeEvent?.data).toEqual({
            sessionId: 'session-1',
            terminalId: 'terminal-1'
        })
        expect(terminalRegistry.get('terminal-1')).toBeNull()
    })

    it('enforces per-socket terminal limits', () => {
        const { terminalSocket, cliNamespace } = createHarness({ maxTerminalsPerSocket: 1 })
        const cliSocket = new FakeSocket('cli-socket-1')
        connectCliSocket(cliNamespace, cliSocket, 'session-1')

        terminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-1',
            cols: 80,
            rows: 24
        })

        terminalSocket.trigger('terminal:create', {
            sessionId: 'session-1',
            terminalId: 'terminal-2',
            cols: 80,
            rows: 24
        })

        const errorEvent = lastEmit(terminalSocket, 'terminal:error')
        expect(errorEvent?.data).toEqual({
            terminalId: 'terminal-2',
            message: 'Too many terminals open (max 1).'
        })
    })
})
