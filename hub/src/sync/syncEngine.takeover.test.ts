import { describe, expect, it } from 'bun:test'
import { SyncEngine } from './syncEngine'
import { Store } from '../store'
import { RpcRegistry } from '../socket/rpcRegistry'

describe('SyncEngine take-over', () => {
    it('delegates take-over session to rpc gateway', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never
        )

        try {
            const calls: string[] = []
            ;(engine as any).rpcGateway.takeOverSession = async (sessionId: string) => {
                calls.push(sessionId)
            }

            await engine.takeOverSession('session-1')
            expect(calls).toEqual(['session-1'])
        } finally {
            engine.stop()
        }
    })

    it('delegates approval contextAction to rpc gateway', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never
        )

        try {
            const calls: unknown[] = []
            ;(engine as any).rpcGateway.approvePermission = async (...args: unknown[]) => {
                calls.push(args)
            }

            await engine.approvePermission(
                'session-1',
                'request-1',
                'default',
                undefined,
                'approved',
                undefined,
                'clear_context'
            )

            expect(calls).toEqual([[
                'session-1',
                'request-1',
                'default',
                undefined,
                'approved',
                undefined,
                'clear_context'
            ]])
        } finally {
            engine.stop()
        }
    })
})
