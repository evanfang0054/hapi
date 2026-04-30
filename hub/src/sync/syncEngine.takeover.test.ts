import { describe, expect, it } from 'bun:test'
import { SyncEngine } from './syncEngine'
import { Store } from '../store'
import { RpcRegistry } from '../socket/rpcRegistry'

describe('SyncEngine take-over', () => {
    it('does not delete messages when rewind RPC fails', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            { of: () => ({ to: () => ({ emit() {} }) }) } as never,
            new RpcRegistry(),
            { broadcast() {} } as never
        )

        try {
            const session = store.sessions.getOrCreateSession('session-1', {}, {}, 'default')
            store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'repeat' } })
            store.messages.addMessage(session.id, { role: 'assistant', content: { type: 'text', text: 'first reply' } })
            store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'repeat' } })
            store.messages.addMessage(session.id, { role: 'assistant', content: { type: 'text', text: 'second reply' } })

            const calls: unknown[] = []
            ;(engine as any).rpcGateway.rewindSession = async (...args: unknown[]) => {
                calls.push(args)
                throw new Error('rewind failed')
            }

            await expect(engine.rewindSession(session.id, 3)).rejects.toThrow('rewind failed')

            expect(calls).toEqual([[session.id, {
                userMessageText: 'repeat',
                targetSeq: 3,
                userMessageTextOccurrence: 2
            }]])
            expect(store.messages.getMessages(session.id).map((message) => message.seq)).toEqual([1, 2, 3, 4])
        } finally {
            engine.stop()
        }
    })

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
