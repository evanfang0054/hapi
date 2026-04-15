import { describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createPermissionsRoutes } from './permissions'

function createSession(overrides?: Partial<Session>): Session {
    const baseMetadata = {
        path: '/tmp/project',
        host: 'localhost',
        flavor: 'claude' as const
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
            requests: {
                'request-1': {
                    tool: 'exit_plan_mode',
                    arguments: {},
                    createdAt: 1
                }
            },
            completedRequests: {}
        },
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 1,
        model: 'claude-sonnet-4-6',
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

function createApp(session: Session) {
    const approvePermission = mock(async () => {})
    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: session.id, session }),
        approvePermission
    } as Partial<SyncEngine>

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createPermissionsRoutes(() => engine as SyncEngine))

    return { app, approvePermission }
}

describe('permissions routes', () => {
    it('accepts contextAction for exit plan approvals', async () => {
        const { app, approvePermission } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/permissions/request-1/approve', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                mode: 'default',
                decision: 'approved',
                contextAction: 'clear_context'
            })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(approvePermission).toHaveBeenCalledWith(
            'session-1',
            'request-1',
            'default',
            undefined,
            'approved',
            undefined,
            'clear_context'
        )
    })

    it('rejects invalid contextAction values', async () => {
        const { app, approvePermission } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/permissions/request-1/approve', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                contextAction: 'bad_value'
            })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Invalid body' })
        expect(approvePermission).not.toHaveBeenCalled()
    })
})
