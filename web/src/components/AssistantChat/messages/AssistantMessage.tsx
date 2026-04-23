import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { HappyToolMessage } from '@/components/AssistantChat/messages/ToolMessage'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { CheckIcon, CopyIcon } from '@/components/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { useTranslation } from '@/lib/use-translation'

function formatMessageTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const TOOL_COMPONENTS = {
    Fallback: HappyToolMessage
} as const

const MESSAGE_PART_COMPONENTS = {
    Text: MarkdownText,
    Reasoning: Reasoning,
    ReasoningGroup: ReasoningGroup,
    tools: TOOL_COMPONENTS
} as const

export function HappyAssistantMessage() {
    const { t } = useTranslation()
    const { copied, copy } = useCopyToClipboard()
    const isCliOutput = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.kind === 'cli-output'
    })
    const cliText = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        if (custom?.kind !== 'cli-output') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const toolOnly = useAssistantState(({ message }) => {
        if (message.role !== 'assistant') return false
        const parts = message.content
        return parts.length > 0 && parts.every((part) => part.type === 'tool-call')
    })
    const copyableText = useAssistantState(({ message }) => {
        if (message.role !== 'assistant') return ''
        return message.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n\n')
    })
    const createdAt = useAssistantState(({ message }) => message.createdAt)
    const isRunning = useAssistantState(({ thread }) => thread.isRunning)
    const isLastAssistant = useAssistantState(({ thread, message }) => {
        const messages = thread.messages
        const lastMsg = messages[messages.length - 1]
        return lastMsg?.id === message.id && message.role === 'assistant'
    })
    const showThinking = isRunning && isLastAssistant
    const rootClass = toolOnly
        ? 'py-1 min-w-0 max-w-full overflow-x-hidden animate-msg-in'
        : 'mr-auto min-w-0 max-w-full overflow-x-hidden animate-msg-in'

    if (isCliOutput) {
        return (
            <MessagePrimitive.Root className="mr-auto min-w-0 max-w-full overflow-x-hidden animate-msg-in">
                <div className="w-full rounded-[20px] rounded-bl-[6px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-[18px] py-[14px]">
                    <CliOutputBlock text={cliText} />
                </div>
            </MessagePrimitive.Root>
        )
    }

    return (
        <MessagePrimitive.Root className={`${rootClass} group/msg`}>
            <div className="w-full rounded-[20px] rounded-bl-[6px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-[18px] py-[14px]">
                <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
                {showThinking && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-focus)] animate-[dot-bounce_1.4s_ease-in-out_infinite]" />
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-focus)] animate-[dot-bounce_1.4s_ease-in-out_0.2s_infinite]" />
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-focus)] animate-[dot-bounce_1.4s_ease-in-out_0.4s_infinite]" />
                        </div>
                        <span className="text-[13px] text-[var(--app-hint)]">{t('assistant.thinking')}</span>
                    </div>
                )}
            </div>
            <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover/msg:opacity-100">
                {createdAt ? (
                    <span className="text-[10px] text-[var(--app-hint)]">
                        {formatMessageTime(createdAt)}
                    </span>
                ) : null}
                {copyableText ? (
                    <button
                        type="button"
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                        onClick={() => copy(copyableText)}
                        aria-label={t('assistant.copy')}
                        title={t('assistant.copy')}
                    >
                        {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                ) : null}
            </div>
        </MessagePrimitive.Root>
    )
}
