import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createSessionsRoutes } from './sessions'

function createSession(overrides?: Partial<Session>): Session {
    const baseMetadata = {
        path: '/tmp/project',
        host: 'localhost',
        flavor: 'codex' as const
    }
    const base: Session = {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: baseMetadata,
        metadataVersion: 1,
        agentState: {
            controlledByUser: false,
            requests: {},
            completedRequests: {}
        },
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 1,
        model: 'gpt-5.4',
        effort: null,
        permissionMode: 'default',
        collaborationMode: 'default'
    }

    return {
        ...base,
        ...overrides,
        metadata: overrides?.metadata === undefined
            ? base.metadata
            : overrides.metadata === null
                ? null
                : {
                    ...baseMetadata,
                    ...overrides.metadata
                },
        agentState: overrides?.agentState === undefined ? base.agentState : overrides.agentState
    }
}

function createApp(
    session: Session,
    options?: {
        rewindResult?: { success: boolean; deletedCount?: number; error?: string }
    }
) {
    const applySessionConfigCalls: Array<[string, Record<string, unknown>]> = []
    const takeOverCalls: string[] = []
    const rewindSessionCalls: Array<[string, string]> = []
    const applySessionConfig = async (sessionId: string, config: Record<string, unknown>) => {
        applySessionConfigCalls.push([sessionId, config])
    }
    const takeOverSession = async (sessionId: string) => {
        takeOverCalls.push(sessionId)
    }
    const rewindSession = async (sessionId: string, messageLocalId: string) => {
        rewindSessionCalls.push([sessionId, messageLocalId])
        return options?.rewindResult ?? { success: true, deletedCount: 2 }
    }
    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: session.id, session }),
        applySessionConfig,
        takeOverSession,
        rewindSession
    } as Partial<SyncEngine>

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createSessionsRoutes(() => engine as SyncEngine))

    return { app, applySessionConfigCalls, takeOverCalls, rewindSessionCalls }
}

describe('sessions routes', () => {
    it('rejects collaboration mode changes for local Codex sessions', async () => {
        const session = createSession({
            agentState: {
                controlledByUser: true,
                requests: {},
                completedRequests: {}
            }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/collaboration-mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'plan' })
        })

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({
            error: 'Collaboration mode can only be changed for remote Codex sessions'
        })
        expect(applySessionConfigCalls).toEqual([])
    })

    it('rejects collaboration mode changes for non-Codex sessions', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/collaboration-mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'plan' })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'Collaboration mode is only supported for Codex sessions'
        })
        expect(applySessionConfigCalls).toEqual([])
    })

    it('applies collaboration mode changes for remote Codex sessions', async () => {
        const { app, applySessionConfigCalls } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/collaboration-mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'plan' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { collaborationMode: 'plan' }]
        ])
    })

    it('rejects effort changes for non-Claude sessions', async () => {
        const { app, applySessionConfigCalls } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/effort', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ effort: 'high' })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'Effort selection is only supported for Claude sessions'
        })
        expect(applySessionConfigCalls).toEqual([])
    })

    it('applies effort changes for Claude sessions', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/effort', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ effort: 'max' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { effort: 'max' }]
        ])
    })

    it('triggers take-over route for active session', async () => {
        const { app, takeOverCalls } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/take-over', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(takeOverCalls).toEqual(['session-1'])
    })

    it('rejects take-over route for inactive session', async () => {
        const { app, takeOverCalls } = createApp(createSession({ active: false }))

        const response = await app.request('/api/sessions/session-1/take-over', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        })

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'Session is inactive' })
        expect(takeOverCalls).toEqual([])
    })

    it('rejects rewind for inactive session', async () => {
        const { app, rewindSessionCalls } = createApp(createSession({
            active: false,
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        }))

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageLocalId: 'user-1' })
        })

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'Session is inactive' })
        expect(rewindSessionCalls).toEqual([])
    })

    it('returns a validation error when rewind body is missing messageLocalId', async () => {
        const { app, rewindSessionCalls } = createApp(createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        }))

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Invalid body: messageLocalId is required' })
        expect(rewindSessionCalls).toEqual([])
    })

    it('rejects rewind for non-Claude sessions', async () => {
        const { app, rewindSessionCalls } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageLocalId: 'user-1' })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'UNSUPPORTED_FLAVOR' })
        expect(rewindSessionCalls).toEqual([])
    })

    it('maps CLI unavailable rewind errors to 503', async () => {
        const { app, rewindSessionCalls } = createApp(createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        }), {
            rewindResult: { success: false, error: 'CLI_UNAVAILABLE' }
        })

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageLocalId: 'user-1' })
        })

        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ error: 'CLI_UNAVAILABLE' })
        expect(rewindSessionCalls).toEqual([['session-1', 'user-1']])
    })

    it('maps invalid rewind targets to 400', async () => {
        const { app, rewindSessionCalls } = createApp(createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        }), {
            rewindResult: { success: false, error: 'NOT_USER_MESSAGE' }
        })

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageLocalId: 'assistant-1' })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'NOT_USER_MESSAGE' })
        expect(rewindSessionCalls).toEqual([['session-1', 'assistant-1']])
    })

    it('maps active Claude history rewind misses to 400', async () => {
        const { app, rewindSessionCalls } = createApp(createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        }), {
            rewindResult: {
                success: false,
                error: 'Rewind target message is not available in the active Claude session history'
            }
        })

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageLocalId: 'user-1' })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'Rewind target message is not available in the active Claude session history'
        })
        expect(rewindSessionCalls).toEqual([['session-1', 'user-1']])
    })

    it('rewinds a Claude session by message local id', async () => {
        const { app, rewindSessionCalls } = createApp(createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        }))

        const response = await app.request('/api/sessions/session-1/rewind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageLocalId: 'user-1' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true, deletedCount: 2 })
        expect(rewindSessionCalls).toEqual([['session-1', 'user-1']])
    })

    it('still rejects deleting active sessions', async () => {
        const { app } = createApp(createSession({ active: true }))

        const response = await app.request('/api/sessions/session-1', {
            method: 'DELETE'
        })

        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'Cannot delete active session. Archive it first.' })
    })
})
