import { describe, expect, it, vi } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import type { SessionMessageSnapshot } from './session-message-snapshot'
import {
    clearMessageWindow,
    fetchLatestMessages,
    getMessageWindowState,
    getPersistableMessageWindowSnapshot,
    hydrateMessageWindowFromSnapshot,
    refreshMessagesAfterRewind,
} from './message-window-store'

const message: DecryptedMessage = {
    id: 'm1',
    seq: 1,
    createdAt: 1,
    content: {
        role: 'user',
        content: {
            type: 'text',
            text: 'hello',
        },
    },
    status: 'sent',
    originalText: 'hello',
    localId: null,
}

function makeMessage(id: string, seq: number, text: string): DecryptedMessage {
    return {
        id,
        seq,
        createdAt: seq,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text,
            },
        },
        status: 'sent',
        originalText: text,
        localId: null,
    }
}

function createApi(messages: DecryptedMessage[], hasMore = false) {
    return {
        getMessages: vi.fn(async () => ({
            messages,
            page: { hasMore },
        })),
    }
}

describe('message-window-store snapshot helpers', () => {
    it('hydrates visible messages from a persisted snapshot', () => {
        const snapshot: SessionMessageSnapshot = {
            sessionId: 'session-1',
            messages: [message],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        }

        hydrateMessageWindowFromSnapshot(snapshot)

        expect(getMessageWindowState('session-1').messages).toHaveLength(1)
        clearMessageWindow('session-1')
    })

    it('exports a persistable snapshot for visible messages', () => {
        const sessionId = 'session-2'
        const snapshot: SessionMessageSnapshot = {
            sessionId,
            messages: [message],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: false,
            savedAt: 123,
        }

        hydrateMessageWindowFromSnapshot(snapshot)

        expect(getPersistableMessageWindowSnapshot(sessionId)).toMatchObject({
            sessionId,
            messages: [message],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: false,
        })

        clearMessageWindow(sessionId)
    })
})

describe('message-window-store rewind refresh', () => {
    it('keeps existing messages while loading rewind refresh', async () => {
        const sessionId = 'rewind-loading'
        const oldMessage = makeMessage('old-1', 1, 'old')
        const newMessage = makeMessage('new-1', 1, 'new')
        let resolveRequest: ((value: { messages: DecryptedMessage[]; page: { hasMore: boolean } }) => void) | undefined
        const api = {
            getMessages: vi.fn(() => new Promise<{ messages: DecryptedMessage[]; page: { hasMore: boolean } }>((resolve) => {
                resolveRequest = resolve
            })),
        }

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [oldMessage],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        })

        const promise = refreshMessagesAfterRewind(api as never, sessionId)

        expect(getMessageWindowState(sessionId).messages).toEqual([oldMessage])
        expect(getMessageWindowState(sessionId).isLoading).toBe(true)

        const resolve = resolveRequest
        if (!resolve) {
            throw new Error('request did not start')
        }
        resolve({ messages: [newMessage], page: { hasMore: false } })
        await promise
        clearMessageWindow(sessionId)
    })

    it('replaces visible messages with the server page after rewind refresh succeeds', async () => {
        const sessionId = 'rewind-replace'
        const removedMessage = makeMessage('removed-1', 3, 'removed by rewind')
        const keptMessage = makeMessage('kept-1', 1, 'kept')
        const api = createApi([keptMessage], true)

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [keptMessage, removedMessage],
            oldestSeq: 1,
            newestSeq: 3,
            hasMore: false,
            atBottom: false,
            savedAt: Date.now(),
        })

        await refreshMessagesAfterRewind(api as never, sessionId)

        const state = getMessageWindowState(sessionId)
        expect(api.getMessages).toHaveBeenCalledWith(sessionId, { limit: 50, beforeSeq: null })
        expect(state.messages).toEqual([keptMessage])
        expect(state.pending).toEqual([])
        expect(state.pendingCount).toBe(0)
        expect(state.hasMore).toBe(true)
        expect(state.isLoading).toBe(false)
        expect(state.warning).toBeNull()
        expect(state.atBottom).toBe(true)
        clearMessageWindow(sessionId)
    })

    it('refreshes after rewind even when a regular load is already in flight', async () => {
        const sessionId = 'rewind-during-load'
        const oldMessage = makeMessage('old-1', 1, 'old')
        const rewindMessage = makeMessage('rewind-1', 1, 'after rewind')
        let resolveRegularLoad: ((value: { messages: DecryptedMessage[]; page: { hasMore: boolean } }) => void) | undefined
        const loadingApi = {
            getMessages: vi.fn(() => new Promise<{ messages: DecryptedMessage[]; page: { hasMore: boolean } }>((resolve) => {
                resolveRegularLoad = resolve
            })),
        }
        const rewindApi = createApi([rewindMessage], false)

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [oldMessage],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        })

        const regularLoad = fetchLatestMessages(loadingApi as never, sessionId)
        expect(getMessageWindowState(sessionId).isLoading).toBe(true)

        await refreshMessagesAfterRewind(rewindApi as never, sessionId)

        expect(rewindApi.getMessages).toHaveBeenCalledWith(sessionId, { limit: 50, beforeSeq: null })
        expect(getMessageWindowState(sessionId).messages).toEqual([rewindMessage])

        const resolve = resolveRegularLoad
        if (!resolve) {
            throw new Error('regular load did not start')
        }
        resolve({ messages: [oldMessage], page: { hasMore: false } })
        await regularLoad

        expect(getMessageWindowState(sessionId).messages).toEqual([rewindMessage])
        clearMessageWindow(sessionId)
    })

    it('keeps rewind refresh loading while an older regular load resolves first', async () => {
        const sessionId = 'rewind-loading-after-stale-load'
        const oldMessage = makeMessage('old-1', 1, 'old')
        const rewindMessage = makeMessage('rewind-1', 1, 'after rewind')
        let resolveRegularLoad: ((value: { messages: DecryptedMessage[]; page: { hasMore: boolean } }) => void) | undefined
        let resolveRewindLoad: ((value: { messages: DecryptedMessage[]; page: { hasMore: boolean } }) => void) | undefined
        const loadingApi = {
            getMessages: vi.fn(() => new Promise<{ messages: DecryptedMessage[]; page: { hasMore: boolean } }>((resolve) => {
                resolveRegularLoad = resolve
            })),
        }
        const rewindApi = {
            getMessages: vi.fn(() => new Promise<{ messages: DecryptedMessage[]; page: { hasMore: boolean } }>((resolve) => {
                resolveRewindLoad = resolve
            })),
        }

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [oldMessage],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        })

        const regularLoad = fetchLatestMessages(loadingApi as never, sessionId)
        const rewindLoad = refreshMessagesAfterRewind(rewindApi as never, sessionId)

        const resolveRegular = resolveRegularLoad
        if (!resolveRegular) {
            throw new Error('regular load did not start')
        }
        resolveRegular({ messages: [oldMessage], page: { hasMore: false } })
        await regularLoad

        expect(getMessageWindowState(sessionId).isLoading).toBe(true)

        const resolveRewind = resolveRewindLoad
        if (!resolveRewind) {
            throw new Error('rewind load did not start')
        }
        resolveRewind({ messages: [rewindMessage], page: { hasMore: false } })
        await rewindLoad

        expect(getMessageWindowState(sessionId).messages).toEqual([rewindMessage])
        expect(getMessageWindowState(sessionId).isLoading).toBe(false)
        clearMessageWindow(sessionId)
    })

    it('ignores regular load failure after rewind refresh has advanced the window', async () => {
        const sessionId = 'rewind-during-load-failure'
        const oldMessage = makeMessage('old-1', 1, 'old')
        const rewindMessage = makeMessage('rewind-1', 1, 'after rewind')
        let rejectRegularLoad: ((reason: Error) => void) | undefined
        const loadingApi = {
            getMessages: vi.fn(() => new Promise<{ messages: DecryptedMessage[]; page: { hasMore: boolean } }>((_resolve, reject) => {
                rejectRegularLoad = reject
            })),
        }
        const rewindApi = createApi([rewindMessage], false)

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [oldMessage],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        })

        const regularLoad = fetchLatestMessages(loadingApi as never, sessionId)
        await refreshMessagesAfterRewind(rewindApi as never, sessionId)

        const reject = rejectRegularLoad
        if (!reject) {
            throw new Error('regular load did not start')
        }
        reject(new Error('stale network down'))
        await regularLoad

        const state = getMessageWindowState(sessionId)
        expect(state.messages).toEqual([rewindMessage])
        expect(state.isLoading).toBe(false)
        expect(state.warning).toBeNull()
        clearMessageWindow(sessionId)
    })

    it('keeps existing messages and shows warning when rewind refresh fails', async () => {
        const sessionId = 'rewind-failure'
        const oldMessage = makeMessage('old-1', 1, 'old')
        const api = {
            getMessages: vi.fn(async () => {
                throw new Error('network down')
            }),
        }

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [oldMessage],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        })

        await refreshMessagesAfterRewind(api as never, sessionId)

        const state = getMessageWindowState(sessionId)
        expect(state.messages).toEqual([oldMessage])
        expect(state.isLoading).toBe(false)
        expect(state.warning).toBe('network down')
        clearMessageWindow(sessionId)
    })
})
