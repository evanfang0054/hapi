import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => {
    let resolveRun: ((value: 'switch' | 'exit') => void) | null = null
    return {
        scannerOnMessage: null as ((message: Record<string, unknown>) => void) | null,
        scannerCleanup: vi.fn(async () => {}),
        requestSwitch: vi.fn(),
        resolveRun: (value: 'switch' | 'exit') => resolveRun?.(value),
        createDeferredRun: () => new Promise<'switch' | 'exit'>((resolve) => {
            resolveRun = resolve
        })
    }
})

vi.mock('./utils/sessionScanner', () => ({
    createSessionScanner: async (opts: { onMessage: (message: Record<string, unknown>) => void }) => {
        harness.scannerOnMessage = opts.onMessage
        return {
            cleanup: harness.scannerCleanup
        }
    }
}))

vi.mock('@/modules/common/launcher/BaseLocalLauncher', () => ({
    BaseLocalLauncher: class {
        control = {
            requestSwitch: harness.requestSwitch
        }
        async run(): Promise<'switch' | 'exit'> {
            return await harness.createDeferredRun()
        }
    }
}))

import { claudeAdoptLauncher } from './claudeAdoptLauncher'

describe('claudeAdoptLauncher', () => {
    beforeEach(() => {
        harness.scannerOnMessage = null
        harness.scannerCleanup.mockReset()
        harness.requestSwitch.mockReset()
    })

    afterEach(() => {
        harness.resolveRun('exit')
    })

    it('forwards visible messages and filters meta/system noise', async () => {
        const sentMessages: Array<Record<string, unknown>> = []
        const handlers = new Map<string, () => Promise<void> | void>()

        const session = {
            sessionId: 'session-1',
            path: '/tmp/test',
            startedBy: 'terminal' as const,
            startingMode: 'local' as const,
            queue: { size: () => 0, reset: () => {}, setOnMessage: () => {} },
            client: {
                sendClaudeSessionMessage: (msg: Record<string, unknown>) => sentMessages.push(msg),
                sendSessionEvent: vi.fn(),
                rpcHandlerManager: {
                    registerHandler: (name: string, fn: () => Promise<void> | void) => {
                        handlers.set(name, fn)
                    }
                }
            },
            recordLocalLaunchFailure: vi.fn()
        }

        const runPromise = claudeAdoptLauncher(session as never)
        await Promise.resolve()

        harness.scannerOnMessage!({ type: 'summary', uuid: '1' })
        harness.scannerOnMessage!({ type: 'user', isMeta: true, uuid: '2' })
        harness.scannerOnMessage!({ type: 'assistant', isCompactSummary: true, uuid: '3' })
        harness.scannerOnMessage!({ type: 'system', subtype: 'init', uuid: '4' })
        harness.scannerOnMessage!({ type: 'assistant', uuid: '5' })

        expect(sentMessages).toHaveLength(1)
        expect(sentMessages[0]).toEqual({ type: 'assistant', uuid: '5' })

        expect(handlers.has('take-over')).toBe(true)
        expect(handlers.has('takeover')).toBe(true)
        await handlers.get('take-over')?.()
        expect(harness.requestSwitch).toHaveBeenCalledTimes(1)

        harness.resolveRun('switch')
        await expect(runPromise).resolves.toBe('switch')
        expect(harness.scannerCleanup).toHaveBeenCalled()
    })

    it('exits when session id is missing', async () => {
        const sendSessionEvent = vi.fn()
        const session = {
            sessionId: null,
            client: {
                sendSessionEvent,
                rpcHandlerManager: { registerHandler: vi.fn() }
            }
        }

        await expect(claudeAdoptLauncher(session as never)).resolves.toBe('exit')
        expect(sendSessionEvent).toHaveBeenCalled()
    })
})
