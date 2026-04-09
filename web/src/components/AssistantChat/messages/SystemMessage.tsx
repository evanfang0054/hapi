import { useAssistantState } from '@assistant-ui/react'
import { getEventPresentation } from '@/chat/presentation'
import type { HappyChatMessageMetadata } from '@/lib/assistant-runtime'

export function HappySystemMessage() {
    const role = useAssistantState(({ message }) => message.role)
    const text = useAssistantState(({ message }) => {
        if (message.role !== 'system') return ''
        return message.content[0]?.type === 'text' ? message.content[0].text : ''
    })
    const icon = useAssistantState(({ message }) => {
        if (message.role !== 'system') return null
        const custom = message.metadata.custom as Partial<HappyChatMessageMetadata> | undefined
        const event = custom?.kind === 'event' ? custom.event : undefined
        return event ? getEventPresentation(event).icon : null
    })

    if (role !== 'system') return null

    return (
        <div className="py-1.5">
            <div className="mx-auto flex w-fit max-w-[72ch] items-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted-bg)] px-4 py-2 text-center text-xs text-[var(--app-hint)] shadow-[var(--app-shadow-xs)]">
                <span className="inline-flex items-center gap-1.5">
                    {icon ? <span aria-hidden="true">{icon}</span> : null}
                    <span>{text}</span>
                </span>
            </div>
        </div>
    )
}
