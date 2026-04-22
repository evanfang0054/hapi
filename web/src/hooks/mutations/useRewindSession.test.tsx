// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AppContextProvider } from '@/lib/app-context'
import { queryKeys } from '@/lib/query-keys'
import { useRewindSession } from './useRewindSession'

describe('useRewindSession', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    function createWrapper(queryClient: QueryClient, api: { rewindSession: ReturnType<typeof vi.fn> }) {
        return function Wrapper(props: { children: ReactNode }) {
            return (
                <QueryClientProvider client={queryClient}>
                    <AppContextProvider value={{ api: api as any, token: 'token', baseUrl: '/', connectionState: 'connected' }}>
                        {props.children}
                    </AppContextProvider>
                </QueryClientProvider>
            )
        }
    }

    it('rewinds the session and invalidates the messages query for that session', async () => {
        const rewindSession = vi.fn().mockResolvedValue({ success: true, deletedCount: 2 })
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(
            () => useRewindSession(),
            { wrapper: createWrapper(queryClient, { rewindSession }) }
        )

        await act(async () => {
            await result.current.mutateAsync({ sessionId: 'session-1', messageLocalId: 'user-1' })
        })

        expect(rewindSession).toHaveBeenCalledWith('session-1', 'user-1')
        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.messages('session-1') })
        })
    })
})
