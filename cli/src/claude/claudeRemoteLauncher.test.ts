import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RawJSONLines } from '@/claude/types'
import type { RewindFilesResponse } from './sdk/types'

const harness = vi.hoisted(() => ({
    claudeRemoteCalls: [] as Array<Record<string, unknown>>,
    rewindFactory: null as ((userMessageId: string) => Promise<RewindFilesResponse>) | null,
    flushQueue: vi.fn(async function (this: { queuedMessages: unknown[]; sendFunction: ((message: unknown) => void) | null }) {
        for (const message of this.queuedMessages) {
            this.sendFunction?.(message)
        }
        this.queuedMessages = []
    }),
    destroyQueue: vi.fn(),
    claudeRemoteGate: null as Promise<void> | null,
    autoExitOnStart: true,
    activeLauncher: null as { exitReason: 'switch' | 'exit' | null } | null,
}))

vi.mock('./claudeRemote', () => ({
    claudeRemote: async (opts: Record<string, unknown>) => {
        harness.claudeRemoteCalls.push(opts)
        const onRewindFilesReady = opts.onRewindFilesReady as ((rewind: (userMessageId: string) => Promise<RewindFilesResponse>) => void) | undefined
        if (onRewindFilesReady && harness.rewindFactory) {
            onRewindFilesReady(harness.rewindFactory)
        }
        if (harness.claudeRemoteGate) {
            await harness.claudeRemoteGate
        }
    }
}))

vi.mock('./utils/permissionHandler', () => ({
    PermissionHandler: class {
        constructor(_session: unknown) {}
        handleToolCall = vi.fn(async () => ({ behavior: 'allow', updatedInput: {} }))
        setOnPermissionRequest() {}
        onMessage() {}
        getResponses() {
            return new Map()
        }
        reset() {}
        handleModeChange() {}
        isAborted() {
            return false
        }
    }
}))

vi.mock('./utils/OutgoingMessageQueue', () => ({
    OutgoingMessageQueue: class {
        queuedMessages: unknown[] = []
        sendFunction: ((message: unknown) => void) | null

        constructor(sendFunction: (message: unknown) => void) {
            this.sendFunction = sendFunction
        }

        releaseToolCall() {}

        enqueue(message: unknown) {
            this.queuedMessages.push(message)
            void this.flush()
        }

        flush = harness.flushQueue
        destroy = harness.destroyQueue
    }
}))

vi.mock('./utils/sdkToLogConverter', () => ({
    SDKToLogConverter: class {
        constructor(_sessionMeta: unknown, _responses: unknown) {}
        convert(message: { type?: string; uuid?: string; message?: { role?: string; content?: unknown } }) {
            if (message.type === 'user' && typeof message.uuid === 'string') {
                return {
                    type: 'user',
                    uuid: `log-${message.uuid}`,
                    userType: 'external',
                    isSidechain: false,
                    message: message.message ?? { role: 'user', content: '' },
                }
            }
            return null
        }
        convertSidechainUserMessage() {
            return null
        }
        generateInterruptedToolResult() {
            return null
        }
        updateSessionId() {}
        resetParentChain() {}
    }
}))

vi.mock('@/modules/common/remote/RemoteLauncherBase', () => ({
    RemoteLauncherBase: class {
        messageBuffer = { addMessage: vi.fn(), clear: vi.fn() }
        hasTTY = false
        logPath?: string
        exitReason: 'switch' | 'exit' | null = null
        shouldExit = false
        constructor(logPath?: string) {
            this.logPath = logPath
            harness.activeLauncher = this as unknown as { exitReason: 'switch' | 'exit' | null }
        }
        setupAbortHandlers(rpcHandlerManager: { registerHandler: (method: string, handler: (params: unknown) => unknown) => void }, handlers: { onAbort: () => Promise<void>; onSwitch: () => Promise<void> }) {
            rpcHandlerManager.registerHandler('abort', handlers.onAbort)
            rpcHandlerManager.registerHandler('switch', handlers.onSwitch)
        }
        clearAbortHandlers(rpcHandlerManager: { registerHandler: (method: string, handler: (params: unknown) => unknown) => void }) {
            rpcHandlerManager.registerHandler('abort', async () => {})
            rpcHandlerManager.registerHandler('switch', async () => {})
        }
        async start(_handlers: { onExit: () => void; onSwitchToLocal: () => void }): Promise<'switch' | 'exit'> {
            if (harness.autoExitOnStart) {
                queueMicrotask(() => {
                    this.exitReason = 'exit'
                })
            }
            await (this as unknown as { runMainLoop: () => Promise<void> }).runMainLoop()
            await (this as unknown as { cleanup: () => Promise<void> }).cleanup()
            return this.exitReason ?? 'exit'
        }
    }
}))

vi.mock('@/ui/messageFormatterInk', () => ({
    formatClaudeMessageForInk: () => {}
}))

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn(),
        debugLargeJson: vi.fn(),
    }
}))

vi.mock('@/utils/future', () => ({
    Future: class<T> {
        promise: Promise<T>
        private resolveInternal!: (value: T | PromiseLike<T>) => void
        constructor() {
            this.promise = new Promise<T>((resolve) => {
                this.resolveInternal = resolve
            })
        }
        resolve(value: T) {
            this.resolveInternal(value)
        }
    }
}))

import { claudeRemoteLauncher } from './claudeRemoteLauncher'

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

function createSessionStub() {
    const rpcHandlers = new Map<string, (params: unknown) => unknown>()
    const sessionEvents: Array<Record<string, unknown>> = []
    const sentMessages: RawJSONLines[] = []

    const session = {
        sessionId: 'session-1',
        path: '/tmp/test',
        logPath: '/tmp/test.log',
        claudeEnvVars: {},
        claudeArgs: [],
        mcpServers: {},
        allowedTools: [],
        hookSettingsPath: '/tmp/hook.json',
        queue: {
            size: () => 0,
            waitForMessagesAndGetAsString: vi.fn(async () => null)
        },
        client: {
            sendClaudeSessionMessage: vi.fn((message: RawJSONLines) => {
                sentMessages.push(message)
            }),
            sendSessionEvent: (event: Record<string, unknown>) => {
                sessionEvents.push(event)
            },
            rpcHandlerManager: {
                registerHandler(method: string, handler: (params: unknown) => unknown) {
                    rpcHandlers.set(method, handler)
                }
            }
        },
        addSessionFoundCallback: vi.fn(),
        removeSessionFoundCallback: vi.fn(),
        onSessionFound: vi.fn(),
        onThinkingChange: vi.fn(),
        clearSessionId: vi.fn(),
        consumeOneTimeFlags: vi.fn(),
    }

    return { session, rpcHandlers, sessionEvents, sentMessages }
}

describe('claudeRemoteLauncher rewind-session RPC handler', () => {
    beforeEach(() => {
        harness.claudeRemoteCalls = []
        harness.rewindFactory = null
        harness.flushQueue.mockClear()
        harness.destroyQueue.mockClear()
        harness.claudeRemoteGate = null
        harness.autoExitOnStart = true
        harness.activeLauncher = null
    })

    afterEach(() => {
        harness.rewindFactory = null
    })

    it('proxies rewind-session RPC requests to the active rewind callback after the target message is mapped', async () => {
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
            filesChanged: ['src/file.ts'],
            insertions: 2,
            deletions: 1
        }))
        const gate = deferred<void>()
        harness.claudeRemoteGate = gate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const onMessage = harness.claudeRemoteCalls[0]?.onMessage as ((message: unknown) => void) | undefined
        expect(onMessage).toBeTypeOf('function')

        onMessage?.({
            type: 'user',
            uuid: 'claude-user-message-id',
            message: {
                role: 'user',
                content: 'rewind me',
            },
        })

        expect(sentMessages).toHaveLength(1)
        const handler = rpcHandlers.get('rewind-session')
        expect(handler).toBeTypeOf('function')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: true,
            canRewind: true,
            filesChanged: ['src/file.ts'],
            insertions: 2,
            deletions: 1
        })
        expect(harness.rewindFactory).toHaveBeenCalledWith('claude-user-message-id')

        gate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })

    it('uses the Claude user message id from the forwarded log message instead of the hub local id', async () => {
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
        }))
        const gate = deferred<void>()
        harness.claudeRemoteGate = gate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const onMessage = harness.claudeRemoteCalls[0]?.onMessage as ((message: unknown) => void) | undefined
        expect(onMessage).toBeTypeOf('function')

        onMessage?.({
            type: 'user',
            uuid: 'claude-user-message-id',
            message: {
                role: 'user',
                content: 'rewind me',
            },
        })

        expect(sentMessages).toHaveLength(1)
        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: true,
            canRewind: true,
        })
        expect(harness.rewindFactory).toHaveBeenCalledWith('claude-user-message-id')

        gate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })

    it('rejects rewind requests for forwarded user messages that carry tool_use_result metadata', async () => {
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
        }))
        const gate = deferred<void>()
        harness.claudeRemoteGate = gate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const onMessage = harness.claudeRemoteCalls[0]?.onMessage as ((message: unknown) => void) | undefined
        expect(onMessage).toBeTypeOf('function')

        onMessage?.({
            type: 'user',
            uuid: 'claude-tool-result-user-id',
            message: {
                role: 'user',
                content: 'rewind me',
            },
            tool_use_result: {
                stdout: 'done',
            },
        })

        expect(sentMessages).toHaveLength(1)
        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: false,
            error: 'Rewind target message is not available in the active Claude session history',
        })
        expect(harness.rewindFactory).not.toHaveBeenCalled()

        gate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })

    it('rejects rewind requests for forwarded local command stdout messages that do not create selectable checkpoints', async () => {
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
        }))
        const gate = deferred<void>()
        harness.claudeRemoteGate = gate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const onMessage = harness.claudeRemoteCalls[0]?.onMessage as ((message: unknown) => void) | undefined
        expect(onMessage).toBeTypeOf('function')

        onMessage?.({
            type: 'user',
            uuid: 'claude-local-command-user-id',
            message: {
                role: 'user',
                content: '<local-command-stdout>done</local-command-stdout>',
            },
        })

        expect(sentMessages).toHaveLength(1)
        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: false,
            error: 'Rewind target message is not available in the active Claude session history',
        })
        expect(harness.rewindFactory).not.toHaveBeenCalled()

        gate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })

    it('rejects rewind requests for forwarded local command stdout messages inside structured content blocks', async () => {
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
        }))
        const gate = deferred<void>()
        harness.claudeRemoteGate = gate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const onMessage = harness.claudeRemoteCalls[0]?.onMessage as ((message: unknown) => void) | undefined
        expect(onMessage).toBeTypeOf('function')

        onMessage?.({
            type: 'user',
            uuid: 'claude-local-command-block-id',
            message: {
                role: 'user',
                content: [{
                    type: 'text',
                    text: '<local-command-stdout>done</local-command-stdout>',
                }],
            },
        })

        expect(sentMessages).toHaveLength(1)
        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: false,
            error: 'Rewind target message is not available in the active Claude session history',
        })
        expect(harness.rewindFactory).not.toHaveBeenCalled()

        gate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })
    it('keeps rewind available after the first Claude session id is discovered between turns', async () => {
        const firstTurnGate = deferred<void>()
        const secondTurnGate = deferred<void>()
        harness.autoExitOnStart = false
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
            filesChanged: ['src/file.ts'],
        }))
        harness.claudeRemoteGate = firstTurnGate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()
        ;(session as any).sessionId = null

        let queueWaitCalls = 0
        ;(session.queue as any).waitForMessagesAndGetAsString = vi.fn(async () => {
            queueWaitCalls += 1
            if (queueWaitCalls === 1) {
                return {
                    message: 'next turn',
                    hash: 'mode-1',
                    isolate: false,
                    mode: { permissionMode: 'default' },
                }
            }
            return null
        })

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const firstCall = harness.claudeRemoteCalls[0]
        const firstOnMessage = firstCall?.onMessage as ((message: unknown) => void) | undefined
        const firstOnSessionFound = firstCall?.onSessionFound as ((sessionId: string) => void) | undefined
        expect(firstOnMessage).toBeTypeOf('function')
        expect(firstOnSessionFound).toBeTypeOf('function')

        firstOnMessage?.({
            type: 'user',
            uuid: 'claude-user-message-id',
            message: {
                role: 'user',
                content: 'rewind me',
            },
        })
        session.sessionId = 'session-1'
        firstOnSessionFound?.('session-1')

        expect(sentMessages).toHaveLength(1)

        firstTurnGate.resolve(undefined)
        await Promise.resolve()
        await Promise.resolve()

        harness.claudeRemoteGate = secondTurnGate.promise
        await Promise.resolve()
        await Promise.resolve()

        expect(harness.claudeRemoteCalls).toHaveLength(2)

        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: true,
            canRewind: true,
            filesChanged: ['src/file.ts'],
        })
        expect(harness.rewindFactory).toHaveBeenCalledWith('claude-user-message-id')

        harness.activeLauncher!.exitReason = 'exit'
        secondTurnGate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })

    it('keeps rewind available after an idle turn finishes and a new turn starts', async () => {
        const firstTurnGate = deferred<void>()
        const secondTurnGate = deferred<void>()
        harness.autoExitOnStart = false
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true,
            filesChanged: ['src/file.ts'],
        }))
        harness.claudeRemoteGate = firstTurnGate.promise
        const { session, rpcHandlers, sentMessages } = createSessionStub()

        let queueWaitCalls = 0
        ;(session.queue as any).waitForMessagesAndGetAsString = vi.fn(async () => {
            queueWaitCalls += 1
            if (queueWaitCalls === 1) {
                return {
                    message: 'next turn',
                    hash: 'mode-1',
                    isolate: false,
                    mode: { permissionMode: 'default' },
                }
            }
            return null
        })

        const runPromise = claudeRemoteLauncher(session as never)
        await Promise.resolve()

        const firstOnMessage = harness.claudeRemoteCalls[0]?.onMessage as ((message: unknown) => void) | undefined
        expect(firstOnMessage).toBeTypeOf('function')

        firstOnMessage?.({
            type: 'user',
            uuid: 'claude-user-message-id',
            message: {
                role: 'user',
                content: 'rewind me',
            },
        })

        expect(sentMessages).toHaveLength(1)

        firstTurnGate.resolve(undefined)
        await Promise.resolve()
        await Promise.resolve()

        harness.claudeRemoteGate = secondTurnGate.promise
        await Promise.resolve()
        await Promise.resolve()

        expect(harness.claudeRemoteCalls).toHaveLength(2)

        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: sentMessages[0].uuid })).resolves.toEqual({
            success: true,
            canRewind: true,
            filesChanged: ['src/file.ts'],
        })
        expect(harness.rewindFactory).toHaveBeenCalledWith('claude-user-message-id')

        harness.activeLauncher!.exitReason = 'exit'
        secondTurnGate.resolve(undefined)
        await expect(runPromise).resolves.toBe('exit')
    })

    it('clears rewind callback after launcher cleanup', async () => {
        harness.rewindFactory = vi.fn(async () => ({
            canRewind: true
        }))
        const { session, rpcHandlers } = createSessionStub()

        await claudeRemoteLauncher(session as never)

        const handler = rpcHandlers.get('rewind-session')
        await expect(handler?.({ userMessageLocalId: 'msg-1' })).resolves.toEqual({
            success: false,
            error: 'Rewind not available - session not active'
        })
    })
})
