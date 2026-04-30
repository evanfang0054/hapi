import { describe, expect, it, vi } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import type { SessionMessageSnapshot } from './session-message-snapshot'
import {
    clearMessageWindow,
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
