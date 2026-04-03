import { describe, expect, it } from 'bun:test'
import { RpcGateway } from './rpcGateway'
import { RpcRegistry } from '../socket/rpcRegistry'

class FakeSocket {
    readonly id: string
    constructor(id: string) {
        this.id = id
    }

    timeout(_ms: number) {
        return {
            emitWithAck: async (_event: string, payload: { method: string; params: string }) => {
                return JSON.stringify({ method: payload.method, params: JSON.parse(payload.params) })
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

        // no throw means successful dispatch through rpcCall
        expect(true).toBe(true)
    })

    it('throws when take-over handler is not registered', async () => {
        const gateway = new RpcGateway(new FakeServer() as never, new RpcRegistry())

        await expect(gateway.takeOverSession('missing')).rejects.toThrow('RPC handler not registered: missing:take-over')
    })
})
