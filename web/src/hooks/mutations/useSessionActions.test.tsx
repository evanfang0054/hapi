// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useSessionActions } from './useSessionActions'
import { queryKeys } from '@/lib/query-keys'
import { clearMessageWindow, refreshMessagesAfterRewind } from '@/lib/message-window-store'

vi.mock('@/lib/message-window-store', () => ({
    clearMessageWindow: vi.fn(),
    refreshMessagesAfterRewind: vi.fn(),
}))

describe('useSessionActions bulk delete', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    function createWrapper(queryClient: QueryClient) {
        return function Wrapper(props: { children: ReactNode }) {
            return (
                <QueryClientProvider client={queryClient}>
                    {props.children}
                </QueryClientProvider>
            )
        }
    }

    it('deletes multiple inactive sessions and clears detail caches', async () => {
        const deleteSession = vi.fn()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        const removeQueries = vi.spyOn(queryClient, 'removeQueries')
        const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(
            () => useSessionActions({ deleteSession } as any, 'session-a'),
            { wrapper: createWrapper(queryClient) }
        )

        const summary = await act(async () => {
            return await result.current.deleteSessions(['session-a', 'session-b'])
        })

        expect(summary).toEqual({
            successCount: 2,
            failureCount: 0,
            failures: [],
        })
        expect(removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-a') })
        expect(removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-b') })
        expect(clearMessageWindow).toHaveBeenCalledWith('session-a')
        expect(clearMessageWindow).toHaveBeenCalledWith('session-b')
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.sessions })
    })

    it('returns partial failure summary for bulk delete', async () => {
        const deleteSession = vi.fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Cannot delete active session'))
            .mockRejectedValueOnce(new Error('Session not found'))
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })

        const { result } = renderHook(
            () => useSessionActions({ deleteSession } as any, 'session-a'),
            { wrapper: createWrapper(queryClient) }
        )

        const summary = await act(async () => {
            return await result.current.deleteSessions(['session-a', 'session-b', 'session-c'])
        })

        expect(summary).toEqual({
            successCount: 1,
            failureCount: 2,
            failures: [
                { sessionId: 'session-b', reason: 'Cannot delete active session' },
                { sessionId: 'session-c', reason: 'Session not found' },
            ],
        })
    })

    it('clears current detail state when the viewed session is deleted in bulk', async () => {
        const deleteSession = vi.fn().mockResolvedValue(undefined)
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        const removeQueries = vi.spyOn(queryClient, 'removeQueries')

        const { result } = renderHook(
            () => useSessionActions({ deleteSession } as any, 'session-a'),
            { wrapper: createWrapper(queryClient) }
        )

        await act(async () => {
            await result.current.deleteSessions(['session-a'])
        })

        expect(clearMessageWindow).toHaveBeenCalledWith('session-a')
        expect(removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-a') })
    })

    it('keeps isPending true while bulk delete is running', async () => {
        let resolveDelete: (() => void) | null = null
        const deleteSession = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
            resolveDelete = resolve
        }))
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })

        const { result } = renderHook(
            () => useSessionActions({ deleteSession } as any, 'session-a'),
            { wrapper: createWrapper(queryClient) }
        )

        let pendingPromise: Promise<unknown> | null = null
        await act(async () => {
            pendingPromise = result.current.deleteSessions(['session-a'])
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(true)
        })

        await act(async () => {
            resolveDelete?.()
            await pendingPromise
        })

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })
    })

    it('refreshes the message window after rewind succeeds without clearing it', async () => {
        const api = {
            rewindSession: vi.fn().mockResolvedValue(undefined),
        }
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })

        const { result } = renderHook(
            () => useSessionActions(api as any, 'session-a'),
            { wrapper: createWrapper(queryClient) }
        )

        await act(async () => {
            await result.current.rewindSession(7)
        })

        expect(api.rewindSession).toHaveBeenCalledWith('session-a', 7)
        expect(refreshMessagesAfterRewind).toHaveBeenCalledWith(api, 'session-a')
        expect(clearMessageWindow).not.toHaveBeenCalledWith('session-a')
    })
})
