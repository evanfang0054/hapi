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

        vi.stubGlobal('fetch', fetchMock)

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
