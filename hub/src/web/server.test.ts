import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConfiguration } from '../configuration'
import { Store } from '../store'
import { createWebApp, startWebServer } from './server'
import { SyncEngine } from '../sync/syncEngine'

const initialHapiHome = process.env.HAPI_HOME
const initialCliApiToken = process.env.CLI_API_TOKEN

function restoreEnv(hapiHome = initialHapiHome, cliApiToken = initialCliApiToken) {
    if (hapiHome === undefined) {
        delete process.env.HAPI_HOME
    } else {
        process.env.HAPI_HOME = hapiHome
    }

    if (cliApiToken === undefined) {
        delete process.env.CLI_API_TOKEN
    } else {
        process.env.CLI_API_TOKEN = cliApiToken
    }
}

function createSocketEngineStub() {
    return {
        handler: () => ({
            idleTimeout: 30,
            maxRequestBodySize: 1024 * 1024,
            websocket: {},
            fetch: () => new Response('socket')
        })
    } as never
}

describe('createWebApp CORS', () => {
    const jwtSecret = new Uint8Array([1, 2, 3])

    beforeAll(async () => {
        process.env.HAPI_HOME = mkdtempSync(join(tmpdir(), 'hapi-web-server-test-'))
        process.env.CLI_API_TOKEN = 'task10-token'
        await createConfiguration()
    })

    afterAll(() => {
        restoreEnv()
    })

    it('allows PATCH in API preflight requests', async () => {
        const app = createWebApp({
            getSyncEngine: () => null,
            getSseManager: () => null,
            getVisibilityTracker: () => null,
            jwtSecret,
            store: {} as never,
            vapidPublicKey: 'test-public-key',
            embeddedAssetMap: new Map()
        })

        const response = await app.request('/api/sessions', {
            method: 'OPTIONS',
            headers: {
                origin: 'http://localhost:3000',
                'access-control-request-method': 'PATCH'
            }
        })

        expect(response.headers.get('access-control-allow-methods')).toContain('PATCH')
    })

    it('does not add API CORS headers to non-api static requests', async () => {
        const app = createWebApp({
            getSyncEngine: () => null,
            getSseManager: () => null,
            getVisibilityTracker: () => null,
            jwtSecret,
            store: {} as never,
            vapidPublicKey: 'test-public-key',
            embeddedAssetMap: new Map()
        })

        const response = await app.request('/assets/app.js', {
            method: 'OPTIONS',
            headers: {
                origin: 'http://localhost:3000',
                'access-control-request-method': 'PATCH'
            }
        })

        expect(response.headers.get('access-control-allow-methods')).toBeNull()
    })
})

describe('createWebApp session delete guard', () => {
    let suiteHapiHome: string | undefined
    let suiteCliApiToken: string | undefined

    beforeAll(async () => {
        process.env.HAPI_HOME = mkdtempSync(join(tmpdir(), 'hapi-web-server-delete-guard-'))
        process.env.CLI_API_TOKEN = 'task10-token'
        suiteHapiHome = process.env.HAPI_HOME
        suiteCliApiToken = process.env.CLI_API_TOKEN
        await createConfiguration()
    })

    beforeEach(async () => {
        restoreEnv(suiteHapiHome, suiteCliApiToken)
        await createConfiguration()
    })

    afterAll(() => {
        restoreEnv()
    })

    it('rejects deleting a session after cli create plus session alive on real app routes', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            { to: () => ({ emit() {} }) } as never,
            { getHandler: () => undefined } as never,
            { broadcast() {} } as never
        )

        const app = createWebApp({
            getSyncEngine: () => engine,
            getSseManager: () => null,
            getVisibilityTracker: () => null,
            jwtSecret: new Uint8Array([4, 5, 6]),
            store,
            vapidPublicKey: 'test-public-key',
            embeddedAssetMap: new Map()
        })

        const authResponse = await app.request('/api/auth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ accessToken: 'task10-token' })
        })
        expect(authResponse.status).toBe(200)
        const authBody = await authResponse.json() as { token: string }
        const webToken = authBody.token

        const createResponse = await app.request('/cli/sessions', {
            method: 'POST',
            headers: {
                authorization: 'Bearer task10-token',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                tag: 'task10-active-delete-guard',
                metadata: { path: '/tmp/task10-active-real', host: 'localhost', flavor: 'codex' },
                agentState: { requests: {}, completedRequests: {} }
            })
        })
        expect(createResponse.status).toBe(200)
        const createBody = await createResponse.json() as { session: { id: string, active: boolean } }
        expect(createBody.session.active).toBe(false)

        engine.handleSessionAlive({ sid: createBody.session.id, time: Date.now(), thinking: false })

        const deleteResponse = await app.request(`/api/sessions/${createBody.session.id}`, {
            method: 'DELETE',
            headers: {
                authorization: `Bearer ${webToken}`
            }
        })

        expect(deleteResponse.status).toBe(409)
        expect(await deleteResponse.json()).toEqual({ error: 'Cannot delete active session. Archive it first.' })

        const fetchAfterDelete = await app.request(`/api/sessions/${createBody.session.id}`, {
            headers: {
                authorization: `Bearer ${webToken}`
            }
        })

        expect(fetchAfterDelete.status).toBe(200)
        expect(await fetchAfterDelete.json()).toEqual({
            session: expect.objectContaining({
                id: createBody.session.id,
                active: true
            })
        })

        engine.stop()
        expect(process.env.HAPI_HOME).toBe(suiteHapiHome)
        expect(process.env.CLI_API_TOKEN).toBe(suiteCliApiToken)
    })

    it('keeps suite-local environment stable across tests', () => {
        expect(process.env.HAPI_HOME).toBe(suiteHapiHome)
        expect(process.env.CLI_API_TOKEN).toBe(suiteCliApiToken)
    })
})

describe('startWebServer upload body size', () => {
    it('raises maxRequestBodySize to at least 20MB', async () => {
        const originalServe = Bun.serve
        const serveCalls: Array<Parameters<typeof Bun.serve>[0]> = []

        Bun.serve = mock((options: Parameters<typeof Bun.serve>[0]) => {
            serveCalls.push(options)
            return {
                stop() {},
            } as never
        }) as typeof Bun.serve

        try {
            await startWebServer({
                getSyncEngine: () => null,
                getSseManager: () => null,
                getVisibilityTracker: () => null,
                jwtSecret: new Uint8Array([1, 2, 3]),
                store: {} as never,
                vapidPublicKey: 'test-public-key',
                socketEngine: createSocketEngineStub()
            })
        } finally {
            Bun.serve = originalServe
        }

        expect(serveCalls).toHaveLength(1)
        expect(serveCalls[0]?.maxRequestBodySize).toBe(1024 * 1024 * 20)
    })
})
