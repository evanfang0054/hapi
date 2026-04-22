import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { HappyToolMessage } from '@/components/AssistantChat/messages/ToolMessage'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { CheckIcon, CopyIcon } from '@/components/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { useTranslation } from '@/lib/use-translation'

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
    const rootClass = toolOnly
        ? 'py-1 min-w-0 max-w-full overflow-x-hidden'
        : 'mr-auto min-w-0 max-w-full overflow-x-hidden'

    if (isCliOutput) {
        return (
            <MessagePrimitive.Root className="mr-auto min-w-0 max-w-full overflow-x-hidden">
                <div className="w-full max-w-[min(82ch,100%)] rounded-[20px] rounded-bl-[6px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-[18px] py-[14px]">
                    <CliOutputBlock text={cliText} />
                </div>
            </MessagePrimitive.Root>
        )
    }

    return (
        <MessagePrimitive.Root className={rootClass}>
            <div className="relative w-full max-w-[min(82ch,100%)] rounded-[20px] rounded-bl-[6px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-[18px] py-[14px]">
                {copyableText ? (
                    <button
                        type="button"
                        className="absolute right-3 bottom-3 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                        onClick={() => copy(copyableText)}
                        aria-label={t('assistant.copy')}
                        title={t('assistant.copy')}
                    >
                        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                    </button>
                ) : null}
                <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
            </div>
        </MessagePrimitive.Root>
    )
}
