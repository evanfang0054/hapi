import { MessagePrimitive, useAssistantState } from '@assistant-ui/react'
import { RotateCcwIcon } from 'lucide-react'
import { LazyRainbowText } from '@/components/LazyRainbowText'
import { useHappyChatContext } from '@/components/AssistantChat/context'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'
import { MessageStatusIndicator } from '@/components/AssistantChat/messages/MessageStatusIndicator'
import { MessageAttachments } from '@/components/AssistantChat/messages/MessageAttachments'
import { CliOutputBlock } from '@/components/CliOutputBlock'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useRewindSession } from '@/hooks/mutations/useRewindSession'

function isStringifiedToolResultMessage(text: string): boolean {
    try {
        const parsed = JSON.parse(text) as unknown
        return Array.isArray(parsed) && parsed.some((item) => {
            if (!item || typeof item !== 'object') return false
            return (item as { type?: unknown }).type === 'tool_result'
        })
    } catch {
        return false
    }
}

export function HappyUserMessage() {
    const ctx = useHappyChatContext()
    const { copied, copy } = useCopyToClipboard()
    const rewindMutation = useRewindSession()
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

    if (role !== 'user') return null
    const canRetry = status === 'failed' && typeof localId === 'string' && Boolean(ctx.onRetryMessage)
    const onRetry = canRetry ? () => ctx.onRetryMessage!(localId) : undefined
    const isRewindableMessage = !isStringifiedToolResultMessage(text)
    const canRewind = typeof localId === 'string' && isRewindableMessage && !rewindMutation.isPending
    const handleRewind = async () => {
        if (typeof localId !== 'string' || !isRewindableMessage) {
            return
        }
        const confirmed = window.confirm(
            '确定要回撤到此消息吗？\n\n'
            + '• 此消息之后的所有消息将被删除\n'
            + '• 文件将恢复到此时的状态\n'
            + '• Bash 命令的副作用无法回滚'
        )
        if (!confirmed) {
            return
        }
        await rewindMutation.mutateAsync({
            sessionId: ctx.sessionId,
            messageLocalId: localId,
        })
    }

    const userBubbleClass = 'ml-auto w-fit min-w-0 max-w-[min(78ch,85%)] rounded-[22px] border border-transparent bg-[var(--app-subtle-bg)] px-4 py-3 text-[var(--app-fg)] shadow-[var(--app-shadow-xs)]'

    if (isCliOutput) {
        return (
            <MessagePrimitive.Root className="ml-auto min-w-0 max-w-full overflow-x-hidden">
                <div className="ml-auto w-full max-w-[min(78ch,85%)]">
                    <CliOutputBlock text={cliText} />
                </div>
            </MessagePrimitive.Root>
        )
    }

    const hasText = text.length > 0
    const hasAttachments = attachments && attachments.length > 0

    return (
        <MessagePrimitive.Root className={`${userBubbleClass} group/msg`}>
            <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                    {hasText && <LazyRainbowText text={text} />}
                    {hasAttachments && <MessageAttachments attachments={attachments} />}
                </div>
                {(hasText || status) && (
                    <div className="shrink-0 self-end pb-0.5 flex items-center gap-1">
                        {typeof localId === 'string' && isRewindableMessage && (
                            <button
                                type="button"
                                title="回撤到此消息"
                                disabled={!canRewind}
                                className="opacity-60 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-[opacity,background-color] p-0.5 rounded hover:bg-[var(--app-subtle-bg)] disabled:opacity-40"
                                onClick={() => {
                                    void handleRewind()
                                }}
                            >
                                <RotateCcwIcon className="h-3.5 w-3.5 text-[var(--app-hint)]" />
                            </button>
                        )}
                        {hasText && (
                            <button
                                type="button"
                                title="Copy"
                                className="opacity-60 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-[opacity,background-color] p-0.5 rounded hover:bg-[var(--app-subtle-bg)]"
                                onClick={() => copy(text)}
                            >
                                {copied
                                    ? <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                                    : <CopyIcon className="h-3.5 w-3.5 text-[var(--app-hint)]" />}
                            </button>
                        )}
                        {status && <MessageStatusIndicator status={status} onRetry={onRetry} />}
                    </div>
                )}
            </div>
        </MessagePrimitive.Root>
    )
}
