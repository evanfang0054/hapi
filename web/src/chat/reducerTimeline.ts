import type { ChatBlock, ToolCallBlock, ToolPermission } from '@/chat/types'
import type { TracedMessage } from '@/chat/tracer'
import { createCliOutputBlock, isCliOutputText, mergeCliOutputBlocks } from '@/chat/reducerCliOutput'
import { parseMessageAsEvent } from '@/chat/reducerEvents'
import { ensureToolBlock, extractTitleFromChangeTitleInput, isChangeTitleToolName, type PermissionEntry } from '@/chat/reducerTools'

function isSkillToolName(name: string): boolean {
    return name === 'Skill' || name === 'skill' || name === 'activate_skill'
}

function isSkillBoilerplateText(text: string): boolean {
    const trimmed = text.trimStart()
    if (trimmed.length === 0) return false

    const hasSkillHeader = trimmed.startsWith('Name:') && trimmed.includes('Base directory for this skill:')
    const hasSkillPolicyMarkers = trimmed.includes('<EXTREMELY-IMPORTANT>') && trimmed.includes('How to Access Skills')
    const hasSkillBaseDirectoryDoc = trimmed.includes('Base directory for this skill:')
        && trimmed.length > 200

    return hasSkillHeader || hasSkillPolicyMarkers || hasSkillBaseDirectoryDoc
}

function isCompactionSummaryText(text: string): boolean {
    const trimmed = text.trimStart()
    if (trimmed.length < 120) return false

    // Heuristic scoring instead of exact phrase matching:
    // classify as compaction dump only when multiple structural signals appear together.
    let signals = 0

    if (/(?:^|\n)<\/summary>/.test(trimmed) || /(?:^|\n)<summary>/i.test(trimmed)) {
        signals += 1
    }

    if (/\bcompaction\b/i.test(trimmed) || /\bcompact(?:ed|ion)?\b/i.test(trimmed)) {
        signals += 1
    }

    if (/\bfull transcript\b/i.test(trimmed) || /\btranscript at\b/i.test(trimmed)) {
        signals += 1
    }

    if (/\.claude\/projects\//i.test(trimmed)) {
        signals += 1
    }

    if (/If you need specific details/i.test(trimmed) && /before compaction/i.test(trimmed)) {
        signals += 1
    }

    if (trimmed.length > 1200) {
        signals += 1
    }

    return signals >= 2
}

export function reduceTimeline(
    messages: TracedMessage[],
    context: {
        permissionsById: Map<string, PermissionEntry>
        groups: Map<string, TracedMessage[]>
        consumedGroupIds: Set<string>
        titleChangesByToolUseId: Map<string, string>
        emittedTitleChangeToolUseIds: Set<string>
    }
): { blocks: ChatBlock[]; toolBlocksById: Map<string, ToolCallBlock>; hasReadyEvent: boolean } {
    const blocks: ChatBlock[] = []
    const toolBlocksById = new Map<string, ToolCallBlock>()
    let hasReadyEvent = false
    let lastSkillToolCallAt: number | null = null
    let lastSkillToolCallId: string | null = null

    for (const msg of messages) {
        if (msg.role === 'event') {
            if (msg.content.type === 'ready') {
                hasReadyEvent = true
                continue
            }
            blocks.push({
                kind: 'agent-event',
                id: msg.id,
                createdAt: msg.createdAt,
                event: msg.content,
                meta: msg.meta
            })
            continue
        }

        const event = parseMessageAsEvent(msg)
        if (event) {
            blocks.push({
                kind: 'agent-event',
                id: msg.id,
                createdAt: msg.createdAt,
                event,
                meta: msg.meta
            })
            continue
        }

        if (msg.role === 'user') {
            if (isCliOutputText(msg.content.text, msg.meta)) {
                blocks.push(createCliOutputBlock({
                    id: msg.id,
                    localId: msg.localId,
                    createdAt: msg.createdAt,
                    text: msg.content.text,
                    source: 'user',
                    meta: msg.meta
                }))
                continue
            }
            blocks.push({
                kind: 'user-text',
                id: msg.id,
                localId: msg.localId,
                createdAt: msg.createdAt,
                text: msg.content.text,
                attachments: msg.content.attachments,
                status: msg.status,
                originalText: msg.originalText,
                meta: msg.meta
            })
            continue
        }

        if (msg.role === 'agent') {
            // When the message contains a Task tool_use, Claude often writes the
            // prompt as a text block before the tool_use block.  We only want to
            // suppress that exact prompt text — not every text block in the message.
            const taskToolCall = msg.content.find(
                (c) => c.type === 'tool-call' && c.name === 'Task'
            )
            const taskPromptText: string | null = (() => {
                if (!taskToolCall || taskToolCall.type !== 'tool-call') return null
                const input = taskToolCall.input
                if (typeof input === 'object' && input !== null && 'prompt' in input) {
                    const p = (input as { prompt: unknown }).prompt
                    if (typeof p === 'string') return p
                }
                return null
            })()

            const hasSkillToolCall = msg.content.some(
                (c) => c.type === 'tool-call' && isSkillToolName(c.name)
            )

            for (let idx = 0; idx < msg.content.length; idx += 1) {
                const c = msg.content[idx]
                if (c.type === 'text') {
                    // Skip text blocks that are just the Task tool prompt (already shown in tool card)
                    if (taskPromptText && c.text.trim() === taskPromptText.trim()) continue

                    // Skill calls can emit the full skill document as text; keep the tool card and drop boilerplate.
                    const shouldSuppressSkillBoilerplate = isSkillBoilerplateText(c.text)
                        && (
                            hasSkillToolCall
                            || (lastSkillToolCallAt !== null && Math.abs(msg.createdAt - lastSkillToolCallAt) < 2 * 60 * 1000)
                        )
                    if (shouldSuppressSkillBoilerplate) {
                        const skillBlock = lastSkillToolCallId ? toolBlocksById.get(lastSkillToolCallId) : null
                        if (skillBlock && isSkillToolName(skillBlock.tool.name)) {
                            const existing = typeof skillBlock.tool.result === 'string'
                                ? skillBlock.tool.result.trimEnd()
                                : ''
                            skillBlock.tool.result = existing.length > 0
                                ? `${existing}\n\n${c.text}`
                                : c.text
                        }
                        continue
                    }

                    if (isCompactionSummaryText(c.text)) {
                        blocks.push({
                            kind: 'agent-reasoning',
                            id: `${msg.id}:${idx}`,
                            localId: msg.localId,
                            createdAt: msg.createdAt,
                            text: c.text,
                            meta: msg.meta
                        })
                        continue
                    }

                    if (isCliOutputText(c.text, msg.meta)) {
                        blocks.push(createCliOutputBlock({
                            id: `${msg.id}:${idx}`,
                            localId: msg.localId,
                            createdAt: msg.createdAt,
                            text: c.text,
                            source: 'assistant',
                            meta: msg.meta
                        }))
                        continue
                    }
                    blocks.push({
                        kind: 'agent-text',
                        id: `${msg.id}:${idx}`,
                        localId: msg.localId,
                        createdAt: msg.createdAt,
                        text: c.text,
                        meta: msg.meta
                    })
                    continue
                }

                if (c.type === 'reasoning') {
                    blocks.push({
                        kind: 'agent-reasoning',
                        id: `${msg.id}:${idx}`,
                        localId: msg.localId,
                        createdAt: msg.createdAt,
                        text: c.text,
                        meta: msg.meta
                    })
                    continue
                }

                if (c.type === 'summary') {
                    blocks.push({
                        kind: 'agent-event',
                        id: `${msg.id}:${idx}`,
                        createdAt: msg.createdAt,
                        event: { type: 'message', message: c.summary },
                        meta: msg.meta
                    })
                    continue
                }

                if (c.type === 'tool-call') {
                    if (isSkillToolName(c.name)) {
                        lastSkillToolCallAt = msg.createdAt
                        lastSkillToolCallId = c.id
                    }

                    if (isChangeTitleToolName(c.name)) {
                        const title = context.titleChangesByToolUseId.get(c.id) ?? extractTitleFromChangeTitleInput(c.input)
                        if (title && !context.emittedTitleChangeToolUseIds.has(c.id)) {
                            context.emittedTitleChangeToolUseIds.add(c.id)
                            blocks.push({
                                kind: 'agent-event',
                                id: `${msg.id}:${idx}`,
                                createdAt: msg.createdAt,
                                event: { type: 'title-changed', title },
                                meta: msg.meta
                            })
                        }
                        continue
                    }

                    const permission = context.permissionsById.get(c.id)?.permission

                    const block = ensureToolBlock(blocks, toolBlocksById, c.id, {
                        createdAt: msg.createdAt,
                        localId: msg.localId,
                        meta: msg.meta,
                        name: c.name,
                        input: c.input,
                        description: c.description,
                        permission
                    })

                    if (block.tool.state === 'pending') {
                        block.tool.state = 'running'
                        block.tool.startedAt = msg.createdAt
                    }

                    if (c.name === 'Task' && !context.consumedGroupIds.has(msg.id)) {
                        const sidechain = context.groups.get(msg.id) ?? null
                        if (sidechain && sidechain.length > 0) {
                            context.consumedGroupIds.add(msg.id)
                            const child = reduceTimeline(sidechain, context)
                            hasReadyEvent = hasReadyEvent || child.hasReadyEvent
                            block.children = child.blocks
                        }
                    }
                    continue
                }

                if (c.type === 'tool-result') {
                    const title = context.titleChangesByToolUseId.get(c.tool_use_id) ?? null
                    if (title) {
                        if (!context.emittedTitleChangeToolUseIds.has(c.tool_use_id)) {
                            context.emittedTitleChangeToolUseIds.add(c.tool_use_id)
                            blocks.push({
                                kind: 'agent-event',
                                id: `${msg.id}:${idx}`,
                                createdAt: msg.createdAt,
                                event: { type: 'title-changed', title },
                                meta: msg.meta
                            })
                        }
                        continue
                    }

                    const permissionEntry = context.permissionsById.get(c.tool_use_id)
                    const permissionFromResult = c.permissions ? ({
                        id: c.tool_use_id,
                        status: c.permissions.result === 'approved' ? 'approved' : 'denied',
                        date: c.permissions.date,
                        mode: c.permissions.mode,
                        allowedTools: c.permissions.allowedTools,
                        decision: c.permissions.decision
                    } satisfies ToolPermission) : undefined

                    const permission = (() => {
                        if (permissionFromResult && permissionEntry?.permission) {
                            return {
                                ...permissionEntry.permission,
                                ...permissionFromResult,
                                allowedTools: permissionFromResult.allowedTools ?? permissionEntry.permission.allowedTools,
                                decision: permissionFromResult.decision ?? permissionEntry.permission.decision
                            } satisfies ToolPermission
                        }
                        return permissionFromResult ?? permissionEntry?.permission
                    })()

                    const block = ensureToolBlock(blocks, toolBlocksById, c.tool_use_id, {
                        createdAt: msg.createdAt,
                        localId: msg.localId,
                        meta: msg.meta,
                        name: permissionEntry?.toolName ?? 'Tool',
                        input: permissionEntry?.input ?? null,
                        description: null,
                        permission
                    })

                    if (isSkillToolName(block.tool.name)) {
                        lastSkillToolCallAt = msg.createdAt
                        lastSkillToolCallId = c.tool_use_id
                    }

                    block.tool.result = c.content
                    block.tool.completedAt = msg.createdAt
                    block.tool.state = c.is_error ? 'error' : 'completed'
                    continue
                }

                if (c.type === 'sidechain') {
                    // Skip - the prompt is already visible in the parent Task tool call's input
                    continue
                }
            }
        }
    }

    return { blocks: mergeCliOutputBlocks(blocks), toolBlocksById, hasReadyEvent }
}
