import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { useVisibilityReporter } from './useVisibilityReporter'

function HookProbe(props: {
    api: ApiClient | null
    subscriptionId: string | null
    enabled?: boolean
    activeSessionId?: string | null
}) {
    useVisibilityReporter(props)
    return null
}

describe('useVisibilityReporter', () => {
    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
    })

    it('reports again when activeSessionId changes while page stays visible', async () => {
        const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState')
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
        })

        const api = {
            setVisibility: vi.fn().mockResolvedValue(undefined),
        } as unknown as ApiClient

        const { rerender } = render(
            <HookProbe
                api={api}
                subscriptionId="sub-1"
                enabled
                activeSessionId="session-1"
            />
        )

        await waitFor(() => {
            expect(api.setVisibility).toHaveBeenCalledTimes(1)
        })

        expect(api.setVisibility).toHaveBeenNthCalledWith(1, {
            subscriptionId: 'sub-1',
            visibility: 'visible',
            activeSessionId: 'session-1',
        })

        rerender(
            <HookProbe
                api={api}
                subscriptionId="sub-1"
                enabled
                activeSessionId="session-2"
            />
        )

        await waitFor(() => {
            expect(api.setVisibility).toHaveBeenCalledTimes(2)
        })

        expect(api.setVisibility).toHaveBeenNthCalledWith(2, {
            subscriptionId: 'sub-1',
            visibility: 'visible',
            activeSessionId: 'session-2',
        })

        if (originalVisibilityState) {
            Object.defineProperty(document, 'visibilityState', originalVisibilityState)
        }
    })
})
