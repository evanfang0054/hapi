import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { ComponentPropsWithoutRef, FormEvent, ReactNode, TextareaHTMLAttributes } from 'react'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { HappyComposer } from './HappyComposer'
import {
    __resetSessionDraftStoreForTests,
    clearSessionDraft,
    getSessionDraft,
    setSessionDraft,
} from '@/lib/session-draft-store'

const mockSetText = vi.fn()
const mockSend = vi.fn()
const mockCancelRun = vi.fn()
const mockAddAttachment = vi.fn()
const mockState = {
    composer: {
        text: '',
        attachments: [] as Array<{ status: { type: string } }>,
    },
    thread: {
        isRunning: false,
        isDisabled: false,
    },
}
const mockAssistantApi = {
    composer: () => ({
        setText: (text: string) => {
            mockSetText(text)
            mockState.composer.text = text
        },
        send: mockSend,
        addAttachment: mockAddAttachment,
    }),
    thread: () => ({
        cancelRun: mockCancelRun,
    }),
}

function MockComposerRoot(props: { children: ReactNode; onSubmit?: (event?: FormEvent<HTMLFormElement>) => void; className?: string }) {
    return (
        <form onSubmit={props.onSubmit} className={props.className}>
            {props.children}
        </form>
    )
}

function MockComposerInput(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
    const { ref: _ref, maxRows: _maxRows, submitOnEnter: _submitOnEnter, cancelOnEscape: _cancelOnEscape, ...rest } = props as TextareaHTMLAttributes<HTMLTextAreaElement> & {
        ref?: React.Ref<HTMLTextAreaElement>
        maxRows?: number
        submitOnEnter?: boolean
        cancelOnEscape?: boolean
    }

    return <textarea {...rest} />
}

vi.mock('@assistant-ui/react', () => ({
    ComposerPrimitive: {
        Root: MockComposerRoot,
        Input: MockComposerInput,
        Attachments: () => null,
    },
    useAssistantApi: () => mockAssistantApi,
    useAssistantState: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            impact: vi.fn(),
            notification: vi.fn(),
        },
        isTouch: false,
    }),
}))

vi.mock('@/hooks/usePWAInstall', () => ({
    usePWAInstall: () => ({
        isStandalone: false,
        isIOS: false,
    }),
}))

vi.mock('@/hooks/useActiveWord', () => ({
    useActiveWord: () => null,
}))

vi.mock('@/hooks/useActiveSuggestions', () => ({
    useActiveSuggestions: () => [[], -1, vi.fn(), vi.fn(), vi.fn()],
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/lib/agentFlavorUtils', () => ({
    isClaudeFlavor: () => false,
    supportsModelChange: () => false,
}))

vi.mock('@/lib/recent-skills', () => ({
    markSkillUsed: vi.fn(),
}))

vi.mock('@/utils/applySuggestion', () => ({
    applySuggestion: vi.fn(),
}))

vi.mock('@/components/ChatInput/FloatingOverlay', () => ({
    FloatingOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ChatInput/Autocomplete', () => ({
    Autocomplete: () => null,
}))

vi.mock('@/components/AssistantChat/StatusBar', () => ({
    StatusBar: () => null,
}))

vi.mock('@/components/AssistantChat/ComposerButtons', () => ({
    ComposerButtons: ({ onSend }: { onSend: () => void }) => (
        <button type="button" aria-label="composer-buttons-send" onClick={onSend}>
            send-now
        </button>
    ),
}))

vi.mock('@/components/AssistantChat/AttachmentItem', () => ({
    AttachmentItem: () => null,
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./modelOptions', () => ({
    getModelOptionsForFlavor: () => [],
    getNextModelForFlavor: () => null,
}))

vi.mock('./claudeEffortOptions', () => ({
    getClaudeComposerEffortOptions: () => [],
}))

function getActiveComposerTextarea() {
    const textareas = screen.getAllByRole('textbox')
    return textareas[textareas.length - 1] as HTMLTextAreaElement
}

function resetComposerState() {
    mockState.composer.text = ''
    mockState.composer.attachments = []
    mockState.thread.isRunning = false
    mockState.thread.isDisabled = false
}

describe('HappyComposer draft persistence', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.clear()
        __resetSessionDraftStoreForTests()
        clearSessionDraft('session-1')
        clearSessionDraft('session-2')
        resetComposerState()
        mockSetText.mockReset()
        mockSend.mockReset()
        mockCancelRun.mockReset()
        mockAddAttachment.mockReset()
    })

    afterEach(() => {
        cleanup()
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
    })

    it('hydrates persisted draft text for the active session', () => {
        setSessionDraft('session-1', 'draft from storage')

        render(<HappyComposer sessionId="session-1" />)

        expect(mockSetText).toHaveBeenCalledWith('draft from storage')
    })

    it('hydrates the correct draft when the session changes', () => {
        setSessionDraft('session-1', 'first draft')
        setSessionDraft('session-2', 'second draft')

        const { rerender } = render(<HappyComposer sessionId="session-1" />)
        expect(mockSetText).toHaveBeenLastCalledWith('first draft')

        mockState.composer.text = 'first draft'
        rerender(<HappyComposer sessionId="session-2" />)

        expect(mockSetText).toHaveBeenLastCalledWith('second draft')
    })

    it('clears composer text when switching to a session without a saved draft', () => {
        setSessionDraft('session-1', 'first draft')

        const { rerender } = render(<HappyComposer sessionId="session-1" />)
        expect(mockSetText).toHaveBeenLastCalledWith('first draft')

        mockState.composer.text = 'first draft'
        rerender(<HappyComposer sessionId="session-2" />)

        expect(mockSetText).toHaveBeenLastCalledWith('')
    })

    it('removes the saved draft when the composer becomes empty', () => {
        setSessionDraft('session-1', 'draft to delete')

        const { rerender } = render(<HappyComposer sessionId="session-1" />)
        expect(mockSetText).toHaveBeenLastCalledWith('draft to delete')

        mockState.composer.text = ''
        rerender(<HappyComposer sessionId="session-1" />)

        vi.runOnlyPendingTimers()
        expect(getSessionDraft('session-1')).toBe('')
    })

    it('persists updated composer text after the debounce window', () => {
        const { rerender } = render(<HappyComposer sessionId="session-1" />)

        mockState.composer.text = 'typed but unsent'
        rerender(<HappyComposer sessionId="session-1" />)

        vi.advanceTimersByTime(149)
        expect(getSessionDraft('session-1')).toBe('')

        vi.advanceTimersByTime(1)
        expect(getSessionDraft('session-1')).toBe('typed but unsent')
    })

    it('clears the stored draft when send button is pressed', () => {
        setSessionDraft('session-1', 'hello world')
        mockState.composer.text = 'hello world'

        render(<HappyComposer sessionId="session-1" />)
        fireEvent.click(screen.getByRole('button', { name: 'composer-buttons-send' }))

        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(getSessionDraft('session-1')).toBe('')
    })
})

describe('HappyComposer keyboard behavior', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.clear()
        __resetSessionDraftStoreForTests()
        clearSessionDraft('session-1')
        resetComposerState()
        mockSetText.mockReset()
        mockSend.mockReset()
        mockCancelRun.mockReset()
        mockAddAttachment.mockReset()
    })

    afterEach(() => {
        cleanup()
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
    })

    it('sends on Enter', () => {
        setSessionDraft('session-1', 'hello')
        mockState.composer.text = 'hello'

        render(<HappyComposer sessionId="session-1" />)
        const textarea = getActiveComposerTextarea()
        fireEvent.keyDown(textarea, { key: 'Enter' })

        expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('inserts newline on Shift+Enter', () => {
        setSessionDraft('session-1', 'hello')
        mockState.composer.text = 'hello'

        render(<HappyComposer sessionId="session-1" />)
        const textarea = getActiveComposerTextarea()
        const event = fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

        expect(event).toBe(true)
        expect(mockSend).not.toHaveBeenCalled()
    })

    it('preserves draft persistence while agent is running', () => {
        const { rerender } = render(<HappyComposer sessionId="session-1" />)

        mockState.composer.text = 'draft while running'
        mockState.thread.isRunning = true
        rerender(<HappyComposer sessionId="session-1" thinking />)

        vi.advanceTimersByTime(150)
        expect(getSessionDraft('session-1')).toBe('draft while running')
    })
})
