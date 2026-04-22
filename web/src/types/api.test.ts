import { describe, it, expect } from 'vitest'
import type { RewindSessionResponse } from './api'

describe('RewindSessionResponse', () => {
    it('accepts success response', () => {
        const success: RewindSessionResponse = {
            success: true,
            deletedCount: 2,
        }
        expect(success.success).toBe(true)
    })

    it('accepts failure response', () => {
        const failure: RewindSessionResponse = {
            success: false,
            error: 'CLI_UNAVAILABLE',
        }
        expect(failure.success).toBe(false)
    })
})
