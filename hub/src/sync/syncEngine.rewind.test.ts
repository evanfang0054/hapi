import { describe, expect, it } from 'bun:test'
import { SyncEngine } from './syncEngine'
import { Store } from '../store'
import { RpcRegistry } from '../socket/rpcRegistry'

async function waitForCallOrderLength(callOrder: string[], expectedLength: number): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (callOrder.length === expectedLength) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(callOrder.length).toBe(expectedLength)
}

describe('SyncEngine rewind', () => {
    it('rewinds an active session, deletes later messages, and broadcasts session-rewound', async () => {
        const store = new Store(':memory:')
        const broadcasts: unknown[] = []
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast(event: unknown) { broadcasts.push(event) } } as never
        )

        try {
            const session = engine.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
            engine.handleSessionAlive({ sid: session.id, time: Date.now() })

            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'before target' }
            }, 'user-0')
            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'target' }
            }, 'user-1')
            store.messages.addMessage(session.id, {
                role: 'assistant',
                content: [{ type: 'text', text: 'assistant after target' }]
            }, 'assistant-2')
            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'user after target' }
            }, 'user-3')

            const rewindCalls: unknown[] = []
            ;(engine as any).rpcGateway.rewindSession = async (...args: unknown[]) => {
                rewindCalls.push(args)
                return { success: true, canRewind: true }
            }

            const result = await engine.rewindSession(session.id, 'user-1')

            expect(rewindCalls).toEqual([[session.id, 'user-1']])
            expect(result).toEqual({ success: true, deletedCount: 2 })
            expect(store.messages.getMessages(session.id).map((message) => message.localId)).toEqual([
                'user-0',
                'user-1'
            ])
            expect(broadcasts).toContainEqual({
                type: 'session-rewound',
                sessionId: session.id,
                namespace: 'default',
                rewindToLocalId: 'user-1',
                deletedCount: 2
            })
        } finally {
            engine.stop()
        }
    })

    it('does not delete messages or broadcast when CLI reports missing file checkpoint', async () => {
        const store = new Store(':memory:')
        const broadcasts: unknown[] = []
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast(event: unknown) { broadcasts.push(event) } } as never
        )

        try {
            const session = engine.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
            engine.handleSessionAlive({ sid: session.id, time: Date.now() })

            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'before target' }
            }, 'user-0')
            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'target' }
            }, 'user-1')
            store.messages.addMessage(session.id, {
                role: 'assistant',
                content: [{ type: 'text', text: 'assistant after target' }]
            }, 'assistant-2')
            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'user after target' }
            }, 'user-3')

            const broadcastCountBeforeRewind = broadcasts.length
            ;(engine as any).rpcGateway.rewindSession = async () => ({
                success: false,
                error: 'No file checkpoint found for this message.'
            })

            const result = await engine.rewindSession(session.id, 'user-1')

            expect(result).toEqual({
                success: false,
                error: 'No file checkpoint found for this message.'
            })
            expect(store.messages.getMessages(session.id).map((message) => message.localId)).toEqual([
                'user-0',
                'user-1',
                'assistant-2',
                'user-3'
            ])
            expect(broadcasts).toHaveLength(broadcastCountBeforeRewind)
            expect(broadcasts.some((event) => (event as { type?: string }).type === 'session-rewound')).toBeFalse()
        } finally {
            engine.stop()
        }
    })

    it('serializes concurrent rewinds for the same session', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never
        )

        try {
            const session = engine.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
            engine.handleSessionAlive({ sid: session.id, time: Date.now() })

            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'first target' }
            }, 'user-1')
            store.messages.addMessage(session.id, {
                role: 'assistant',
                content: [{ type: 'text', text: 'after first target' }]
            }, 'assistant-2')

            let releaseFirst!: () => void
            let callCount = 0
            const callOrder: string[] = []
            ;(engine as any).rpcGateway.rewindSession = async (_sessionId: string, localId: string) => {
                callCount += 1
                callOrder.push(`start:${callCount}:${localId}`)
                if (callCount === 1) {
                    await new Promise<void>((resolve) => {
                        releaseFirst = resolve
                    })
                }
                callOrder.push(`end:${callCount}:${localId}`)
                return { success: true, canRewind: true }
            }

            const first = engine.rewindSession(session.id, 'user-1')
            const second = engine.rewindSession(session.id, 'user-1')
            await Promise.resolve()

            expect(callOrder).toEqual(['start:1:user-1'])

            releaseFirst()
            await Promise.all([first, second])

            expect(callOrder).toEqual([
                'start:1:user-1',
                'end:1:user-1',
                'start:2:user-1',
                'end:2:user-1'
            ])
        } finally {
            engine.stop()
        }
    })

    it('serializes three concurrent rewinds for the same session', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never
        )

        try {
            const session = engine.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
            engine.handleSessionAlive({ sid: session.id, time: Date.now() })

            store.messages.addMessage(session.id, {
                role: 'user',
                content: { type: 'text', text: 'first target' }
            }, 'user-1')
            store.messages.addMessage(session.id, {
                role: 'assistant',
                content: [{ type: 'text', text: 'after first target' }]
            }, 'assistant-2')

            const releases: Array<() => void> = []
            const callOrder: string[] = []
            let callCount = 0
            ;(engine as any).rpcGateway.rewindSession = async (_sessionId: string, localId: string) => {
                callCount += 1
                const currentCall = callCount
                callOrder.push(`start:${currentCall}:${localId}`)
                await new Promise<void>((resolve) => {
                    releases.push(resolve)
                })
                callOrder.push(`end:${currentCall}:${localId}`)
                return { success: true, canRewind: true }
            }

            const first = engine.rewindSession(session.id, 'user-1')
            const second = engine.rewindSession(session.id, 'user-1')
            const third = engine.rewindSession(session.id, 'user-1')
            await Promise.resolve()

            expect(callOrder).toEqual(['start:1:user-1'])

            releases.shift()?.()
            await waitForCallOrderLength(callOrder, 3)
            expect(callOrder).toEqual(['start:1:user-1', 'end:1:user-1', 'start:2:user-1'])

            releases.shift()?.()
            await waitForCallOrderLength(callOrder, 5)
            expect(callOrder).toEqual([
                'start:1:user-1',
                'end:1:user-1',
                'start:2:user-1',
                'end:2:user-1',
                'start:3:user-1'
            ])

            releases.shift()?.()
            await Promise.all([first, second, third])

            expect(callOrder).toEqual([
                'start:1:user-1',
                'end:1:user-1',
                'start:2:user-1',
                'end:2:user-1',
                'start:3:user-1',
                'end:3:user-1'
            ])
        } finally {
            engine.stop()
        }
    })

    it('returns not-user-message when rewind target is not a user message', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never
        )

        try {
            const session = engine.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
            engine.handleSessionAlive({ sid: session.id, time: Date.now() })

            store.messages.addMessage(session.id, {
                role: 'assistant',
                content: [{ type: 'text', text: 'assistant message' }]
            }, 'assistant-1')

            ;(engine as any).rpcGateway.rewindSession = async () => ({ success: true, canRewind: true })

            const result = await engine.rewindSession(session.id, 'assistant-1')

            expect(result).toEqual({ success: false, error: 'NOT_USER_MESSAGE' })
        } finally {
            engine.stop()
        }
    })
})

