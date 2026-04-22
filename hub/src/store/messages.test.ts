import { describe, expect, it } from 'bun:test'
import { Store } from './index'

describe('MessageStore deleteMessagesAfter', () => {
    it('returns NOT_FOUND when target localId does not exist', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')

        const result = store.messages.deleteMessagesAfter(session.id, 'missing-local-id')

        expect(result).toEqual({
            deletedCount: 0,
            targetMessage: null,
            error: 'NOT_FOUND'
        })
    })

    it('returns NOT_USER_MESSAGE when target message is not a user message', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
        const assistantMessage = store.messages.addMessage(session.id, {
            role: 'assistant',
            content: [{ type: 'text', text: 'hello' }]
        }, 'assistant-1')
        store.messages.addMessage(session.id, {
            role: 'user',
            content: { type: 'text', text: 'after assistant' }
        }, 'user-2')

        const result = store.messages.deleteMessagesAfter(session.id, 'assistant-1')

        expect(result).toEqual({
            deletedCount: 0,
            targetMessage: assistantMessage,
            error: 'NOT_USER_MESSAGE'
        })
        expect(store.messages.getMessages(session.id)).toHaveLength(2)
    })

    it('deletes all messages after the target user message and returns deleted count', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('tag', { path: '/tmp' }, null, 'default')
        store.messages.addMessage(session.id, {
            role: 'user',
            content: { type: 'text', text: 'before target' }
        }, 'user-0')
        const targetMessage = store.messages.addMessage(session.id, {
            role: 'user',
            content: { type: 'text', text: 'target' }
        }, 'user-1')
        store.messages.addMessage(session.id, {
            role: 'assistant',
            content: [{ type: 'text', text: 'assistant after target' }]
        }, 'assistant-2')
        store.messages.addMessage(session.id, {
            role: 'user',
            content: { type: 'text', text: 'user after target' }
        }, 'user-3')

        const result = store.messages.deleteMessagesAfter(session.id, 'user-1')

        expect(result).toEqual({
            deletedCount: 2,
            targetMessage
        })
        expect(store.messages.getMessages(session.id).map((message) => message.localId)).toEqual([
            'user-0',
            'user-1'
        ])
    })
})
