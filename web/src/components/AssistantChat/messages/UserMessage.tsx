import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { LazyRainbowText } from '@/components/LazyRainbowText'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { MessageStatusIndicator } from '@/components/AssistantChat/messages/MessageStatusIndicator'
import { MessageAttachments } from '@/components/AssistantChat/messages/MessageAttachments'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

function formatMessageTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function HappyUserMessage() {
    const ctx = useHappyChatContext()
    const { copied, copy } = useCopyToClipboard()
    const role = useAssistantState(({ message }) => message.role)
    const text = useAssistantState(({ message }) => {
        if (message.role !== 'user') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const status = useAssistantState(({ message }) => {
        if (message.role !== 'user') return undefined
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.status
    })
    const localId = useAssistantState(({ message }) => {
        if (message.role !== 'user') return null
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.localId ?? null
    })
    const seq = useAssistantState(({ message }) => {
        if (message.role !== 'user') return null
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.seq ?? null
    })
    const attachments = useAssistantState(({ message }) => {
        if (message.role !== 'user') return undefined
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.attachments
    })
    const isCliOutput = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        return custom?.kind === 'cli-output'
    })
    const cliText = useAssistantState(({ message }) => {
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        if (custom?.kind !== 'cli-output') return ''
        return message.content.find((part) => part.type === 'text')?.text ?? ''
    })
    const createdAt = useAssistantState(({ message }) => message.createdAt)

    if (role !== 'user') return null
    const canRetry = status === 'failed' && typeof localId === 'string' && Boolean(ctx.onRetryMessage)
    const onRetry = canRetry ? () => ctx.onRetryMessage!(localId) : undefined
    const canRewind = typeof seq === 'number' && Boolean(ctx.onRewindMessage || ctx.onRewindRequest)

    if (isCliOutput) {
        return (
            <MessagePrimitive.Root className="ml-auto min-w-0 max-w-full overflow-x-hidden animate-msg-in">
                <div className="ml-auto w-full">
                    <CliOutputBlock text={cliText} />
                </div>
            </MessagePrimitive.Root>
        )
    }

    const hasText = text.length > 0
    const hasAttachments = attachments && attachments.length > 0

    return (
        <MessagePrimitive.Root className="ml-auto w-fit min-w-0 group/msg animate-msg-in">
            <div className="ml-auto w-fit min-w-0 rounded-[20px] rounded-br-[6px] bg-[var(--app-link)] px-[18px] py-[14px] text-white">
                <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                        {hasText && <LazyRainbowText text={text} />}
                        {hasAttachments && <MessageAttachments attachments={attachments} />}
                    </div>
                    {status && (
                        <div className="shrink-0 self-end pb-0.5 flex items-center gap-1">
                            <MessageStatusIndicator status={status} onRetry={onRetry} />
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-1 flex items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover/msg:opacity-100">
                {createdAt ? (
                    <span className="text-[10px] text-[var(--app-hint)]">
                        {formatMessageTime(createdAt)}
                    </span>
                ) : null}
                {hasText && (
                    <button
                        type="button"
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                        onClick={() => copy(text)}
                    >
                        {copied
                            ? <CheckIcon className="h-3 w-3 text-green-500" />
                            : <CopyIcon className="h-3 w-3" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                )}
                {canRewind && (
                    <button
                        type="button"
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
                        onClick={() => {
                            if (ctx.onRewindRequest) {
                                ctx.onRewindRequest(seq)
                            } else if (ctx.onRewindMessage) {
                                ctx.onRewindMessage(seq)
                            }
                        }}
                    >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        <span>Rewind</span>
                    </button>
                )}
            </div>
        </MessagePrimitive.Root>
    )
}
