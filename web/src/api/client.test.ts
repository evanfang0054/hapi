import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from './client'

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

        vi.stubGlobal('fetch', fetchMock)

        const client = new ApiClient('token')
        await client.takeOverSession('session-1')

        expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-1/take-over', expect.objectContaining({
            method: 'POST'
        }))
    })
})
