import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { logger } from '@/ui/logger'

export type MessageChainEntry = {
    uuid: string
    parentUuid: string | null
    type: string
    line: string
    lineNumber: number
}

export type FileSnapshot = {
    files: Record<string, string>
}

const INTERNAL_TYPES = new Set([
    'file-history-snapshot',
    'change',
    'queue-operation',
])

/**
 * Parse a JSONL file and build a message chain of user/assistant/system messages.
 * Skips internal Claude Code event types.
 */
export function buildMessageChain(jsonlPath: string): MessageChainEntry[] {
    if (!existsSync(jsonlPath)) {
        throw new Error(`JSONL file not found: ${jsonlPath}`)
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')
    const chain: MessageChainEntry[] = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        try {
            const parsed = JSON.parse(line)
            if (INTERNAL_TYPES.has(parsed.type)) continue
            if (!parsed.uuid) continue

            chain.push({
                uuid: parsed.uuid,
                parentUuid: parsed.parentUuid ?? null,
                type: parsed.type,
                line,
                lineNumber: i,
            })
        } catch {
            // Skip malformed lines
        }
    }

    return chain
}

/**
 * Truncate a JSONL file, keeping all lines up to and including the line with targetUuid.
 * Both internal and message lines are preserved up to the target.
 */
export function truncateJsonl(jsonlPath: string, targetUuid: string): void {
    if (!existsSync(jsonlPath)) {
        throw new Error(`JSONL file not found: ${jsonlPath}`)
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')
    let targetLineIndex = -1

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        try {
            const parsed = JSON.parse(line)
            if (parsed.uuid === targetUuid) {
                targetLineIndex = i
                break
            }
        } catch {
            // Skip malformed lines
        }
    }

    if (targetLineIndex === -1) {
        throw new Error(`Target uuid not found in JSONL: ${targetUuid}`)
    }

    const keptLines = lines.slice(0, targetLineIndex + 1)
    writeFileSync(jsonlPath, keptLines.join('\n') + '\n')

    logger.debug(`[rewind] Truncated JSONL at line ${targetLineIndex}, uuid=${targetUuid}`)
}

/**
 * Find the most recent file-history-snapshot that appears before the target uuid.
 * Returns null if no snapshot exists.
 */
export function findFileSnapshot(jsonlPath: string, targetUuid: string): FileSnapshot | null {
    if (!existsSync(jsonlPath)) {
        return null
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')

    let foundTarget = false
    let lastSnapshot: FileSnapshot | null = null

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
            const parsed = JSON.parse(trimmed)

            if (parsed.uuid === targetUuid) {
                foundTarget = true
                break
            }

            if (parsed.type === 'file-history-snapshot' && parsed.files && typeof parsed.files === 'object') {
                lastSnapshot = { files: parsed.files as Record<string, string> }
            }
        } catch {
            // Skip malformed lines
        }
    }

    if (!foundTarget) {
        return null
    }

    return lastSnapshot
}

/**
 * Apply a file snapshot by writing files back to disk.
 * Returns the list of files restored.
 */
export function applyFileSnapshot(snapshot: FileSnapshot, cwd: string): string[] {
    const restored: string[] = []

    for (const [filePath, content] of Object.entries(snapshot.files)) {
        if (typeof content !== 'string') continue
        const absolutePath = filePath.startsWith('/') ? filePath : join(cwd, filePath)
        try {
            mkdirSync(dirname(absolutePath), { recursive: true })
            writeFileSync(absolutePath, content, 'utf-8')
            restored.push(filePath)
        } catch (error) {
            logger.debug(`[rewind] Failed to restore file: ${filePath}`, error)
        }
    }

    return restored
}
