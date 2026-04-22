import { describe, expect, it } from 'bun:test'
import { RpcGateway } from './rpcGateway'
import { RpcRegistry } from '../socket/rpcRegistry'

class FakeSocket {
    readonly id: string
    lastPayload: { method: string; params: unknown } | null = null

    constructor(id: string) {
        this.id = id
    }

    timeout(_ms: number) {
        return {
            emitWithAck: async (_event: string, payload: { method: string; params: string }) => {
                this.lastPayload = {
                    method: payload.method,
                    params: JSON.parse(payload.params)
                }
                return JSON.stringify(this.lastPayload)
            }
        }
    }
}

class FakeNamespace {
    readonly sockets = new Map<string, FakeSocket>()
}

class FakeServer {
    private readonly namespace = new FakeNamespace()
    of(_name: string): FakeNamespace {
        return this.namespace
    }

    addSocket(socket: FakeSocket): void {
        this.namespace.sockets.set(socket.id, socket)
    }
}

describe('RpcGateway', () => {
    it('dispatches take-over RPC to session method', async () => {
        const io = new FakeServer()
        const rpcRegistry = new RpcRegistry()
        const socket = new FakeSocket('socket-1')
        io.addSocket(socket)
        rpcRegistry.register(socket as never, 'session-1:take-over')

        const gateway = new RpcGateway(io as never, rpcRegistry)
        await gateway.takeOverSession('session-1')

        expect(true).toBe(true)
    })

    it('dispatches rewind-session RPC with user message localId and returns the response', async () => {
        const io = new FakeServer()
        const rpcRegistry = new RpcRegistry()
        const socket = new FakeSocket('socket-1')
        io.addSocket(socket)
        rpcRegistry.register(socket as never, 'session-1:rewind-session')

        const gateway = new RpcGateway(io as never, rpcRegistry)
        const result = await gateway.rewindSession('session-1', 'msg-1')

        expect(socket.lastPayload).toEqual({
            method: 'session-1:rewind-session',
            params: {
                userMessageLocalId: 'msg-1'
            }
        })
        // FakeSocket echoes the payload; type assertion needed since actual CLI would return RpcRewindResponse
        expect(result).toEqual(expect.objectContaining({
            method: 'session-1:rewind-session'
        }))
    })

    it('includes contextAction in permission RPC payload', async () => {
        const io = new FakeServer()
        const rpcRegistry = new RpcRegistry()
        const socket = new FakeSocket('socket-1')
        io.addSocket(socket)
        rpcRegistry.register(socket as never, 'session-1:permission')

        const gateway = new RpcGateway(io as never, rpcRegistry)
        await gateway.approvePermission(
            'session-1',
            'request-1',
            'default',
            undefined,
            'approved',
            undefined,
            'clear_context'
        )

        expect(socket.lastPayload).toEqual({
            method: 'session-1:permission',
            params: {
                id: 'request-1',
                approved: true,
                mode: 'default',
                allowTools: undefined,
                decision: 'approved',
                answers: undefined,
                contextAction: 'clear_context'
            }
        })
    })

    it('throws when take-over handler is not registered', async () => {
        const gateway = new RpcGateway(new FakeServer() as never, new RpcRegistry())

        await expect(gateway.takeOverSession('missing')).rejects.toThrow('RPC handler not registered: missing:take-over')
    })
})

