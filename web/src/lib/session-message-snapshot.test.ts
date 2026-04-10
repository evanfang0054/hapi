import { beforeEach, describe, expect, it } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import {
    clearSessionMessageSnapshot,
    loadSessionMessageSnapshot,
    saveSessionMessageSnapshot,
    type SessionMessageSnapshot,
} from './session-message-snapshot'

const message: DecryptedMessage = {
    id: 'm1',
    seq: 1,
    createdAt: 1,
    content: {
        role: 'user',
        content: {
            type: 'text',
            text: 'hi',
        },
    },
    status: 'sent',
    originalText: 'hi',
    localId: null,
}

const snapshot: SessionMessageSnapshot = {
    sessionId: 'session-1',
    messages: [message],
    oldestSeq: 1,
    newestSeq: 1,
    hasMore: false,
    atBottom: true,
    savedAt: 123,
}

describe('session-message-snapshot', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('round-trips a saved snapshot', () => {
        saveSessionMessageSnapshot(snapshot)

        expect(loadSessionMessageSnapshot('session-1')).toEqual(snapshot)
    })

    it('removes a snapshot cleanly', () => {
        saveSessionMessageSnapshot(snapshot)

        clearSessionMessageSnapshot('session-1')

        expect(loadSessionMessageSnapshot('session-1')).toBeNull()
    })
})
