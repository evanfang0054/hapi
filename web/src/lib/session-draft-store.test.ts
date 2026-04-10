import { beforeEach, describe, expect, it } from 'vitest'
import {
    __resetSessionDraftStoreForTests,
    clearSessionDraft,
    getSessionDraft,
    setSessionDraft,
} from './session-draft-store'

describe('session-draft-store', () => {
    beforeEach(() => {
        localStorage.clear()
        __resetSessionDraftStoreForTests()
    })

    it('persists and restores draft text by session id', () => {
        setSessionDraft('session-1', 'draft message')

        expect(getSessionDraft('session-1')).toBe('draft message')
        expect(JSON.parse(localStorage.getItem('hapi:session-drafts') ?? '{}')).toEqual({
            'session-1': 'draft message',
        })
    })

    it('clears a draft without affecting other sessions', () => {
        setSessionDraft('session-1', 'first')
        setSessionDraft('session-2', 'second')

        clearSessionDraft('session-1')

        expect(getSessionDraft('session-1')).toBe('')
        expect(getSessionDraft('session-2')).toBe('second')
        expect(JSON.parse(localStorage.getItem('hapi:session-drafts') ?? '{}')).toEqual({
            'session-2': 'second',
        })
    })

    it('treats blank drafts as cleared state', () => {
        setSessionDraft('session-1', 'draft message')
        setSessionDraft('session-1', '   ')

        expect(getSessionDraft('session-1')).toBe('')
        expect(localStorage.getItem('hapi:session-drafts')).toBe('{}')
    })

    it('rehydrates drafts from localStorage after reset', () => {
        localStorage.setItem('hapi:session-drafts', JSON.stringify({
            'session-1': 'persisted',
            'session-2': 'another draft',
        }))

        expect(getSessionDraft('session-1')).toBe('persisted')
        expect(getSessionDraft('session-2')).toBe('another draft')
    })

    it('ignores malformed persisted payloads and returns empty drafts', () => {
        localStorage.setItem('hapi:session-drafts', '{not-valid-json')

        expect(getSessionDraft('session-1')).toBe('')
        expect(localStorage.getItem('hapi:session-drafts')).toBe('{not-valid-json')
    })

    it('ignores non-string or empty values from persisted storage', () => {
        localStorage.setItem('hapi:session-drafts', JSON.stringify({
            'session-1': '',
            'session-2': 123,
            'session-3': 'saved',
        }))

        expect(getSessionDraft('session-1')).toBe('')
        expect(getSessionDraft('session-2')).toBe('')
        expect(getSessionDraft('session-3')).toBe('saved')
    })
})
