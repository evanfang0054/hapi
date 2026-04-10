import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import type { DecryptedMessage } from '@/types/api'
import { useMessages } from './useMessages'
import { clearMessageWindow, hydrateMessageWindowFromSnapshot } from '@/lib/message-window-store'
import { loadSessionMessageSnapshot, saveSessionMessageSnapshot } from '@/lib/session-message-snapshot'

const cachedMessage: DecryptedMessage = {
    id: 'm1',
    seq: 1,
    createdAt: 1,
    content: {
        role: 'user',
        content: {
            type: 'text',
            text: 'cached',
        },
    },
    status: 'sent',
    originalText: 'cached',
    localId: null,
}

const snapshot = {
    sessionId: 'session-1',
    messages: [cachedMessage],
    oldestSeq: 1,
    newestSeq: 1,
    hasMore: false,
    atBottom: true,
    savedAt: 123,
}

vi.mock('@/lib/session-message-snapshot', async () => {
    const actual = await vi.importActual<typeof import('@/lib/session-message-snapshot')>('@/lib/session-message-snapshot')
    return {
        ...actual,
        loadSessionMessageSnapshot: vi.fn(),
        saveSessionMessageSnapshot: vi.fn(),
    }
})

function HookProbe(props: { api: ApiClient; sessionId: string }) {
    const result = useMessages(props.api, props.sessionId)

    return (
        <div>
            <div data-testid="message-id">{result.messages[0]?.id ?? 'none'}</div>
            <div data-testid="loading">{String(result.isLoading)}</div>
        </div>
    )
}

describe('useMessages snapshot hydration', () => {
    beforeEach(() => {
        vi.mocked(loadSessionMessageSnapshot).mockReset()
        vi.mocked(saveSessionMessageSnapshot).mockReset()
        clearMessageWindow('session-1')
    })

    afterEach(() => {
        cleanup()
        clearMessageWindow('session-1')
    })

    it('returns cached messages before refetch completes', async () => {
        vi.mocked(loadSessionMessageSnapshot).mockReturnValue(snapshot)

        const api = {
            getMessages: vi.fn(() => new Promise(() => {})),
        } as unknown as ApiClient

        render(<HookProbe api={api} sessionId="session-1" />)

        await waitFor(() => {
            expect(screen.getByTestId('message-id').textContent).toBe('m1')
        })

        expect(screen.getByTestId('loading').textContent).toBe('true')
    })

    it('persists a snapshot on unmount', async () => {
        vi.mocked(loadSessionMessageSnapshot).mockReturnValue(null)

        const api = {
            getMessages: vi.fn().mockResolvedValue({
                messages: [cachedMessage],
                page: {
                    limit: 50,
                    beforeSeq: null,
                    nextBeforeSeq: null,
                    hasMore: false,
                },
            }),
        } as unknown as ApiClient

        hydrateMessageWindowFromSnapshot(snapshot)

        const { unmount } = render(<HookProbe api={api} sessionId="session-1" />)

        await waitFor(() => {
            expect(screen.getByTestId('message-id').textContent).toBe('m1')
        })

        unmount()

        expect(saveSessionMessageSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: 'session-1',
                messages: [cachedMessage],
                oldestSeq: 1,
                newestSeq: 1,
                hasMore: false,
                atBottom: true,
            })
        )
    })
})
