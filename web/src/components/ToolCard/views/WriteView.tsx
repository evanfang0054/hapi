import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject } from '@hapi/protocol'
import { DiffView } from '@/components/DiffView'

export function WriteView(props: ToolViewProps) {
    const input = props.block.tool.input
    if (!isObject(input)) return null

    const content = typeof input.content === 'string' ? input.content : typeof input.text === 'string' ? input.text : null
    if (content === null) return null

    return (
        <div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3">
            <DiffView
                oldString=""
                newString={content}
                variant="inline"
            />
        </div>
    )
}
