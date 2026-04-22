import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadServerSettings } from './serverSettings'

const initialPublicUrl = process.env.HAPI_PUBLIC_URL
const initialCorsOrigins = process.env.CORS_ORIGINS

function restoreEnv() {
    if (initialPublicUrl === undefined) {
        delete process.env.HAPI_PUBLIC_URL
    } else {
        process.env.HAPI_PUBLIC_URL = initialPublicUrl
    }

    if (initialCorsOrigins === undefined) {
        delete process.env.CORS_ORIGINS
    } else {
        process.env.CORS_ORIGINS = initialCorsOrigins
    }
}

afterEach(() => {
    restoreEnv()
})

describe('loadServerSettings cors origins', () => {
    it('includes localhost vite origin when public url is remote and cors origins are not explicitly configured', async () => {
        const dataDir = mkdtempSync(join(tmpdir(), 'hapi-server-settings-'))
        process.env.HAPI_PUBLIC_URL = 'https://mac-mini.tailb1ffe6.ts.net'
        delete process.env.CORS_ORIGINS

        const result = await loadServerSettings(dataDir)

        expect(result.settings.corsOrigins).toContain('https://mac-mini.tailb1ffe6.ts.net')
        expect(result.settings.corsOrigins).toContain('http://localhost:5173')
    })
})
