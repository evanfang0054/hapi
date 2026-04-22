import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const mutateAsyncMock = vi.fn()
const confirmMock = vi.fn()
const copyMock = vi.fn()

const mockMessage = {
    role: 'user',
    content: [{ type: 'text', text: 'rewind target' }],
    metadata: {
        custom: {
            kind: 'user',
            localId: 'user-1',
            status: undefined,
            attachments: undefined
        }
    }
}

vi.mock('@assistant-ui/react', () => ({
    MessagePrimitive: {
        Root: ({ children, className }: { children: ReactNode; className?: string }) => (
            <div data-testid="user-message-root" className={className}>
                {children}
            </div>
        ),
    },
    useAssistantState: (selector: (state: { message: typeof mockMessage }) => unknown) => selector({ message: mockMessage }),
}))

vi.mock('lucide-react', () => ({
    RotateCcwIcon: () => <span>rewind-icon</span>,
}))

vi.mock('@/components/LazyRainbowText', () => ({
    LazyRainbowText: ({ text }: { text: string }) => <div>{text}</div>,
}))

vi.mock('@/components/AssistantChat/context', () => ({
    useHappyChatContext: () => ({
        api: {},
        sessionId: 'session-1',
        metadata: null,
        disabled: false,
        onRefresh: vi.fn(),
        onRetryMessage: undefined,
    }),
}))

vi.mock('@/components/AssistantChat/messages/MessageStatusIndicator', () => ({
    MessageStatusIndicator: () => null,
}))

vi.mock('@/components/AssistantChat/messages/MessageAttachments', () => ({
    MessageAttachments: () => null,
}))

vi.mock('@/components/CliOutputBlock', () => ({
    CliOutputBlock: ({ text }: { text: string }) => <div>{text}</div>,
}))

vi.mock('@/components/icons', () => ({
    CopyIcon: () => <span>copy</span>,
    CheckIcon: () => <span>check</span>,
}))

vi.mock('@/hooks/useCopyToClipboard', () => ({
    useCopyToClipboard: () => ({
        copied: false,
        copy: copyMock,
    }),
}))

vi.mock('@/hooks/mutations/useRewindSession', () => ({
    useRewindSession: () => ({
        mutateAsync: mutateAsyncMock,
        isPending: false,
    }),
}))

import { HappyUserMessage } from './UserMessage'

describe('HappyUserMessage rewind action', () => {
    beforeEach(() => {
        mutateAsyncMock.mockReset()
        copyMock.mockReset()
        confirmMock.mockReset()
        vi.stubGlobal('confirm', confirmMock)
        mockMessage.role = 'user'
        mockMessage.content = [{ type: 'text', text: 'rewind target' }]
        mockMessage.metadata.custom = {
            kind: 'user',
            localId: 'user-1',
            status: undefined,
            attachments: undefined
        }
    })

    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    it('rewinds to the user message after confirmation', async () => {
        confirmMock.mockReturnValue(true)
        mutateAsyncMock.mockResolvedValue({ success: true, deletedCount: 2 })

        render(<HappyUserMessage />)

        fireEvent.click(screen.getByTitle('回撤到此消息'))

        expect(confirmMock).toHaveBeenCalledTimes(1)
        expect(mutateAsyncMock).toHaveBeenCalledWith({
            sessionId: 'session-1',
            messageLocalId: 'user-1',
        })
    })

    it('does not rewind when confirmation is cancelled', () => {
        confirmMock.mockReturnValue(false)

        render(<HappyUserMessage />)

        fireEvent.click(screen.getByTitle('回撤到此消息'))

        expect(mutateAsyncMock).not.toHaveBeenCalled()
    })

    it('does not show rewind action for stringified tool-result user messages', () => {
        mockMessage.content = [{
            type: 'text',
            text: '[{"tool_use_id":"call_123","type":"tool_result","content":"updated"}]'
        }]

        render(<HappyUserMessage />)

        expect(screen.queryByTitle('回撤到此消息')).toBeNull()
    })

    it('keeps rewind action for ordinary JSON text messages', () => {
        mockMessage.content = [{
            type: 'text',
            text: '{"note":"plain json text"}'
        }]

        render(<HappyUserMessage />)

        expect(screen.getByTitle('回撤到此消息')).toBeTruthy()
    })

    it('keeps rewind action for malformed JSON text messages', () => {
        mockMessage.content = [{
            type: 'text',
            text: '[{"type":"tool_result"}'
        }]

        render(<HappyUserMessage />)

        expect(screen.getByTitle('回撤到此消息')).toBeTruthy()
    })
})
