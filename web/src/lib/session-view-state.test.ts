import { beforeEach, describe, expect, it } from 'vitest'
import { getSessionViewState, saveSessionViewState } from './session-view-state'

describe('session-view-state', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('stores whether the user was at bottom', () => {
        saveSessionViewState({
            sessionId: 'session-1',
            atBottom: false,
            anchorSeq: 42,
            savedAt: 100,
        })

        expect(getSessionViewState('session-1')).toEqual({
            sessionId: 'session-1',
            atBottom: false,
            anchorSeq: 42,
            savedAt: 100,
        })
    })
})
