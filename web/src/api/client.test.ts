import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from './client'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

describe('ApiClient takeOverSession', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('posts to the take-over endpoint', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true })
        }))

        globalThis.fetch = fetchMock as unknown as typeof fetch

        const client = new ApiClient('token')
        await client.takeOverSession('session-1')

        expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/take-over', expect.objectContaining({
            method: 'POST'
        }))
    })
})

describe('ApiClient rewindSession', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('posts messageLocalId to the rewind endpoint', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ success: true, deletedCount: 2 })
        }))

        globalThis.fetch = fetchMock as unknown as typeof fetch

        const client = new ApiClient('token')
        const response = await client.rewindSession('session-1', 'user-1')

        expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/rewind', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ messageLocalId: 'user-1' })
        }))
        expect(response).toEqual({ success: true, deletedCount: 2 })
    })
})

describe('ApiClient approvePermission', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('sends contextAction in approvePermission payload', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true })
        }))

        globalThis.fetch = fetchMock as unknown as typeof fetch

        const options: Parameters<ApiClient['approvePermission']>[2] = {
            mode: 'acceptEdits',
            decision: 'approved',
            contextAction: 'clear_context'
        }

        const client = new ApiClient('token')
        await client.approvePermission('session-1', 'request-1', options)

        expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/permissions/request-1/approve', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
                mode: 'acceptEdits',
                decision: 'approved',
                contextAction: 'clear_context'
            })
        }))
    })
})
