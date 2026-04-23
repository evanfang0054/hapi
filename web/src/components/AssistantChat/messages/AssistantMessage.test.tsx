import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const copyMock = vi.fn()

const mockMessage = {
    id: 'test-msg',
    role: 'assistant',
    content: [{ type: 'text', text: 'First line\n\nSecond line' }],
    metadata: {},
    createdAt: new Date('2026-01-01T12:00:00Z'),
}

vi.mock('@assistant-ui/react', () => ({
    MessagePrimitive: {
        Root: ({ children, className }: { children: ReactNode; className?: string }) => (
            <div data-testid="assistant-message-root" className={className}>
                {children}
            </div>
        ),
        Content: () => (
            <div>
                {mockMessage.content
                    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                    .map((part) => part.text)
                    .join('\n\n')}
            </div>
        ),
    },
    useAssistantState: (selector: (state: { message: typeof mockMessage; thread: { isRunning: boolean; messages: typeof mockMessage[] } }) => unknown) =>
        selector({ message: mockMessage, thread: { isRunning: false, messages: [mockMessage] } }),
}))

vi.mock('@/components/assistant-ui/markdown-text', () => ({
    MarkdownText: () => null,
}))

vi.mock('@/components/assistant-ui/reasoning', () => ({
    Reasoning: () => null,
    ReasoningGroup: () => null,
}))

vi.mock('@/components/AssistantChat/messages/ToolMessage', () => ({
    HappyToolMessage: () => <div>tool message</div>,
}))

vi.mock('@/components/CliOutputBlock', () => ({
    CliOutputBlock: ({ text }: { text: string }) => <div>{text}</div>,
}))

vi.mock('@/hooks/useCopyToClipboard', () => ({
    useCopyToClipboard: () => ({
        copied: false,
        copy: copyMock,
    }),
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/components/icons', () => ({
    CopyIcon: () => <span>copy</span>,
    CheckIcon: () => <span>check</span>,
}))

import en from '@/lib/locales/en'
import zhCN from '@/lib/locales/zh-CN'
import { HappyAssistantMessage } from './AssistantMessage'

describe('HappyAssistantMessage copy action', () => {
    it('registers assistant copy labels in both locales', () => {
        expect(en['assistant.copy']).toBe('Copy assistant message')
        expect(zhCN['assistant.copy']).toBe('复制助手消息')
    })

    beforeEach(() => {
        mockMessage.role = 'assistant'
        mockMessage.content = [{ type: 'text', text: 'First line\n\nSecond line' }]
        mockMessage.metadata = {}
        copyMock.mockReset()
    })

    afterEach(() => {
        cleanup()
    })

    it('shows copy action for assistant text messages', () => {
        render(<HappyAssistantMessage />)

        expect(screen.getByRole('button', { name: 'assistant.copy' })).toBeInTheDocument()
    })

    it('copies only text parts and joins them readably when tools are interleaved', () => {
        mockMessage.content = [
            { type: 'text', text: 'Before tool' },
            { type: 'tool-call', toolName: 'bash', args: '{}' } as any,
            { type: 'text', text: 'After tool' },
        ]

        render(<HappyAssistantMessage />)

        fireEvent.click(screen.getByRole('button', { name: 'assistant.copy' }))

        expect(copyMock).toHaveBeenCalledWith('Before tool\n\nAfter tool')
    })

    it('does not break tool-only layout', () => {
        mockMessage.content = [{ type: 'tool-call', toolName: 'bash', args: '{}' } as any]

        render(<HappyAssistantMessage />)

        expect(screen.getByTestId('assistant-message-root')).toHaveClass('py-1')
        expect(screen.queryByRole('button', { name: 'assistant.copy' })).toBeNull()
    })
})
