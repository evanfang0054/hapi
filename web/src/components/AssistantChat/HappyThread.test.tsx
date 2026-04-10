import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { HappyThread } from './HappyThread'
import { getSessionViewState } from '@/lib/session-view-state'

const viewportState = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
}

const mockScrollTo = vi.fn(({ top }: { top: number }) => {
    viewportState.scrollTop = top
})

vi.mock('@assistant-ui/react', () => ({
    ThreadPrimitive: {
        Root: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
        Viewport: ({ children }: { children: ReactNode }) => children,
        Messages: () => <div data-testid="messages" />,
    },
}))

vi.mock('@/components/AssistantChat/context', () => ({
    HappyChatProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/AssistantChat/messages/AssistantMessage', () => ({
    HappyAssistantMessage: () => null,
}))

vi.mock('@/components/AssistantChat/messages/UserMessage', () => ({
    HappyUserMessage: () => null,
}))

vi.mock('@/components/AssistantChat/messages/SystemMessage', () => ({
    HappySystemMessage: () => null,
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/Spinner', () => ({
    Spinner: () => null,
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string, vars?: { n?: number }) => (vars?.n ? `${key}:${vars.n}` : key),
    }),
}))

describe('HappyThread reading position', () => {
    beforeEach(() => {
        cleanup()
        localStorage.clear()
        viewportState.scrollTop = 0
        viewportState.scrollHeight = 1000
        viewportState.clientHeight = 400
        mockScrollTo.mockReset()

        Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
            configurable: true,
            get() {
                return viewportState.scrollHeight
            },
        })
        Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
            configurable: true,
            get() {
                return viewportState.clientHeight
            },
        })
        Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
            configurable: true,
            get() {
                return viewportState.scrollTop
            },
            set(value: number) {
                viewportState.scrollTop = value
            },
        })
        Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
            configurable: true,
            value: mockScrollTo,
        })
    })

    afterEach(() => {
        cleanup()
    })

    it('persists reading position on unmount when user is away from bottom', () => {
        const { container, unmount } = render(
            <HappyThread
                api={{} as any}
                sessionId="session-1"
                metadata={null}
                disabled={false}
                onRefresh={vi.fn()}
                onFlushPending={vi.fn()}
                onAtBottomChange={vi.fn()}
                isLoadingMessages={false}
                messagesWarning={null}
                hasMoreMessages={false}
                isLoadingMoreMessages={false}
                onLoadMore={vi.fn(async () => {})}
                pendingCount={0}
                rawMessagesCount={3}
                normalizedMessagesCount={3}
                messagesVersion={7}
                forceScrollToken={0}
            />
        )

        const viewport = container.querySelector('.app-scroll-y') as HTMLDivElement
        viewport.scrollTop = 200
        fireEvent.scroll(viewport)
        unmount()

        expect(getSessionViewState('session-1')).toEqual({
            sessionId: 'session-1',
            atBottom: false,
            anchorSeq: 7,
            savedAt: expect.any(Number),
        })
    })

    it('restores to bottom when previous view state was at bottom', () => {
        localStorage.setItem('hapi:session-view-state', JSON.stringify({
            'session-1': {
                sessionId: 'session-1',
                atBottom: true,
                anchorSeq: null,
                savedAt: 100,
            },
        }))

        render(
            <HappyThread
                api={{} as any}
                sessionId="session-1"
                metadata={null}
                disabled={false}
                onRefresh={vi.fn()}
                onFlushPending={vi.fn()}
                onAtBottomChange={vi.fn()}
                isLoadingMessages={false}
                messagesWarning={null}
                hasMoreMessages={false}
                isLoadingMoreMessages={false}
                onLoadMore={vi.fn(async () => {})}
                pendingCount={0}
                rawMessagesCount={3}
                normalizedMessagesCount={3}
                messagesVersion={7}
                forceScrollToken={0}
            />
        )

        expect(viewportState.scrollTop).toBe(1000)
    })
})
