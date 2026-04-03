import { beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
    runArgs: [] as Array<Record<string, unknown>>,
    sessionCtorArgs: [] as Array<Record<string, unknown>>
}))

vi.mock('@/agent/loopBase', () => ({
    runLocalRemoteSession: vi.fn(async (opts: Record<string, unknown>) => {
        harness.runArgs.push(opts)
    })
}))

vi.mock('./session', () => ({
    Session: class {
        constructor(opts: Record<string, unknown>) {
            harness.sessionCtorArgs.push(opts)
            Object.assign(this, opts)
        }
    }
}))

vi.mock('./claudeLocalLauncher', () => ({ claudeLocalLauncher: vi.fn(async () => 'exit') }))
vi.mock('./claudeAdoptLauncher', () => ({ claudeAdoptLauncher: vi.fn(async () => 'switch') }))
vi.mock('./claudeRemoteLauncher', () => ({ claudeRemoteLauncher: vi.fn(async () => 'exit') }))

import { loop } from './loop'
import { claudeLocalLauncher } from './claudeLocalLauncher'
import { claudeAdoptLauncher } from './claudeAdoptLauncher'

describe('claude loop adopt routing', () => {
    beforeEach(() => {
        harness.runArgs.length = 0
        harness.sessionCtorArgs.length = 0
    })

    it('uses adopt launcher when adoptSessionId is provided', async () => {
        await loop({
            path: '/tmp/project',
            session: {} as never,
            api: {} as never,
            messageQueue: {} as never,
            mcpServers: {},
            onModeChange: vi.fn(),
            hookSettingsPath: '/tmp/hook.json',
            adoptSessionId: 'session-123'
        })

        expect(harness.sessionCtorArgs[0]?.sessionId).toBe('session-123')
        expect(harness.runArgs[0]?.runLocal).toBe(claudeAdoptLauncher)
    })

    it('uses local launcher when adoptSessionId is absent', async () => {
        await loop({
            path: '/tmp/project',
            session: {} as never,
            api: {} as never,
            messageQueue: {} as never,
            mcpServers: {},
            onModeChange: vi.fn(),
            hookSettingsPath: '/tmp/hook.json'
        })

        expect(harness.sessionCtorArgs[0]?.sessionId).toBeNull()
        expect(harness.runArgs[0]?.runLocal).toBe(claudeLocalLauncher)
    })
})
