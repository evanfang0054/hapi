import { beforeAll, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConfiguration } from '../configuration'
import { createWebApp, startWebServer } from './server'

describe('createWebApp CORS', () => {
    const jwtSecret = new Uint8Array([1, 2, 3])

    beforeAll(async () => {
        process.env.HAPI_HOME = mkdtempSync(join(tmpdir(), 'hapi-web-server-test-'))
        await createConfiguration()
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
                socketEngine: {
                    handler: () => ({
                        idleTimeout: 30,
                        maxRequestBodySize: 1024 * 1024,
                        websocket: {},
                        fetch: () => new Response('socket')
                    })
                } as never
            })
        } finally {
            Bun.serve = originalServe
        }

        expect(serveCalls).toHaveLength(1)
        expect(serveCalls[0]?.maxRequestBodySize).toBe(1024 * 1024 * 20)
    })
})
