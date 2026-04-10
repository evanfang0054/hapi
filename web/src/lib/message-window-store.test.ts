import { describe, expect, it } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import type { SessionMessageSnapshot } from './session-message-snapshot'
import {
    clearMessageWindow,
    getMessageWindowState,
    getPersistableMessageWindowSnapshot,
    hydrateMessageWindowFromSnapshot,
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
