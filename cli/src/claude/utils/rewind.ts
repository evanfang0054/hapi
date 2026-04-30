import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'node:fs'
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
    deleted?: string[]
}

type HapiFileSnapshotEntry = {
    files: Record<string, string | null>
}

const HAPI_FILE_SNAPSHOT_TYPE = 'hapi-file-snapshot'

const INTERNAL_TYPES = new Set([
    'file-history-snapshot',
    'hapi-file-snapshot',
    'change',
    'queue-operation',
])

function getUserMessageText(parsed: any): string {
    if (parsed.type !== 'user' || parsed.message?.role !== 'user') return ''

    const msgContent = parsed.message.content
    return typeof msgContent === 'string'
        ? msgContent
        : Array.isArray(msgContent)
            ? msgContent
                .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
                .map((c: any) => c.text)
                .join('')
            : ''
}

function mergeHapiSnapshot(target: FileSnapshot, files: HapiFileSnapshotEntry['files']): void {
    for (const [filePath, content] of Object.entries(files)) {
        if (filePath in target.files || target.deleted?.includes(filePath)) continue

        if (typeof content === 'string') {
            target.files[filePath] = content
        } else if (content === null) {
            target.deleted!.push(filePath)
        }
    }
}

function hasSnapshotContent(snapshot: FileSnapshot): boolean {
    return Object.keys(snapshot.files).length > 0 || (snapshot.deleted?.length ?? 0) > 0
}

/**
 * Find HAPI snapshots captured after a target user message. This must run
 * before truncation because these snapshots are written after the target
 * message and would otherwise be removed. Since rewind deletes the target
 * message and everything after it, collect snapshots across the whole suffix.
 */
export function findHapiFileSnapshotAfterUserText(jsonlPath: string, userMessageText: string): FileSnapshot | null {
    if (!existsSync(jsonlPath)) {
        return null
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')
    const snapshot: FileSnapshot = { files: {}, deleted: [] }
    let foundTarget = false

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        try {
            const parsed = JSON.parse(line)
            const text = getUserMessageText(parsed)

            if (!foundTarget) {
                if (text === userMessageText) {
                    foundTarget = true
                }
                continue
            }

            if (parsed.type === HAPI_FILE_SNAPSHOT_TYPE) {
                const files = parsed.snapshot?.files
                if (files && typeof files === 'object') {
                    mergeHapiSnapshot(snapshot, files as HapiFileSnapshotEntry['files'])
                }
            }
        } catch {
            // Skip malformed lines
        }
    }

    return hasSnapshotContent(snapshot) ? snapshot : null
}

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
 * Truncate a JSONL file, removing the user message matching userMessageText
 * and everything after it. The target user message itself is excluded so that
 * after --resume Claude Code waits for fresh input rather than re-seeing the
 * old message.
 *
 * Returns the uuid of the last kept message line (for file-snapshot lookup).
 */
export function truncateJsonlByUserText(jsonlPath: string, userMessageText: string): string | null {
    if (!existsSync(jsonlPath)) {
        throw new Error(`JSONL file not found: ${jsonlPath}`)
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')
    let targetLineIndex = -1
    let lastKeptUuid: string | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'user' && parsed.message?.role === 'user') {
                if (getUserMessageText(parsed) === userMessageText && parsed.uuid) {
                    targetLineIndex = i
                    break
                }
            }
            // Track last meaningful uuid before the target
            if (parsed.uuid) {
                lastKeptUuid = parsed.uuid
            }
        } catch {
            // Skip malformed lines
        }
    }

    if (targetLineIndex === -1) {
        throw new Error(`No user message found matching text: "${userMessageText.substring(0, 50)}..."`)
    }

    // Keep lines BEFORE the target user message (exclusive)
    const keptLines = lines.slice(0, targetLineIndex)
    writeFileSync(jsonlPath, keptLines.join('\n') + '\n')

    logger.debug(`[rewind] Truncated JSONL before line ${targetLineIndex}, excluded user message "${userMessageText.substring(0, 50)}"`)

    return lastKeptUuid
}

export function appendHapiFileSnapshot(jsonlPath: string, snapshot: FileSnapshot): void {
    const files: Record<string, string | null> = {}

    for (const [filePath, content] of Object.entries(snapshot.files)) {
        files[filePath] = content
    }

    for (const filePath of snapshot.deleted ?? []) {
        files[filePath] = null
    }

    writeFileSync(jsonlPath, JSON.stringify({
        type: HAPI_FILE_SNAPSHOT_TYPE,
        snapshot: { files },
        timestamp: new Date().toISOString()
    }) + '\n', { flag: 'a' })
}

export function captureFilesSnapshot(filePaths: string[], cwd: string): FileSnapshot | null {
    const snapshot: FileSnapshot = { files: {}, deleted: [] }
    const uniquePaths = [...new Set(filePaths)]

    for (const filePath of uniquePaths) {
        const absolutePath = filePath.startsWith('/') ? filePath : join(cwd, filePath)
        try {
            if (!existsSync(absolutePath)) {
                snapshot.deleted!.push(filePath)
                continue
            }
            if (!statSync(absolutePath).isFile()) continue
            snapshot.files[filePath] = readFileSync(absolutePath, 'utf-8')
        } catch (error) {
            logger.debug(`[rewind] Failed to capture file snapshot: ${filePath}`, error)
        }
    }

    if (Object.keys(snapshot.files).length === 0 && snapshot.deleted!.length === 0) {
        return null
    }

    return snapshot
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
 * Find the most recent file-history-snapshot in a JSONL file.
 *
 * Claude Code stores snapshots as:
 *   { type: "file-history-snapshot", snapshot: { trackedFileBackups: { "<path>": { backupFileName, version, backupTime } } } }
 *
 * The actual file contents live in:
 *   ~/.claude/file-history/<claudeSessionId>/<backupFileName>@v<version>
 *
 * We resolve the backup references into actual file contents so that
 * applyFileSnapshot can write them back.
 */
export function findFileSnapshot(jsonlPath: string): FileSnapshot | null {
    if (!existsSync(jsonlPath)) {
        return null
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')

    // JSONL path is: ~/.claude/projects/<project>/<sessionId>.jsonl
    // File history is at: ~/.claude/file-history/<sessionId>/<backupFileName>@v<version>
    const jsonlBasename = jsonlPath.split('/').pop() || ''
    const claudeSessionId = jsonlBasename.replace(/\.jsonl$/, '')
    const claudeHome = dirname(dirname(dirname(jsonlPath))) // ~/.claude from ~/.claude/projects/<project>/<sessionId>.jsonl

    let lastSnapshot: FileSnapshot | null = null

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
            const parsed = JSON.parse(trimmed)

            if (parsed.type === HAPI_FILE_SNAPSHOT_TYPE) {
                const files = parsed.snapshot?.files
                if (files && typeof files === 'object') {
                    const snapshot: FileSnapshot = { files: {}, deleted: [] }
                    mergeHapiSnapshot(snapshot, files as HapiFileSnapshotEntry['files'])
                    lastSnapshot = snapshot
                }
                continue
            }

            if (parsed.type === 'file-history-snapshot') {
                const trackedFileBackups = parsed.snapshot?.trackedFileBackups
                if (trackedFileBackups && typeof trackedFileBackups === 'object') {
                    const files: Record<string, string> = {}
                    for (const [filePath, backupInfo] of Object.entries(trackedFileBackups)) {
                        if (!backupInfo || typeof backupInfo !== 'object') continue
                        const info = backupInfo as { backupFileName?: string; version?: number }
                        if (!info.backupFileName) continue

                        const backupPath = join(
                            claudeHome,
                            'file-history',
                            claudeSessionId,
                            `${info.backupFileName}@v${info.version ?? 1}`
                        )
                        try {
                            if (existsSync(backupPath)) {
                                files[filePath] = readFileSync(backupPath, 'utf-8')
                            }
                        } catch {
                            // Skip unreadable backups
                        }
                    }
                    if (Object.keys(files).length > 0) {
                        lastSnapshot = { files }
                    }
                }
            }
        } catch {
            // Skip malformed lines
        }
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

    for (const filePath of snapshot.deleted ?? []) {
        const absolutePath = filePath.startsWith('/') ? filePath : join(cwd, filePath)
        try {
            if (existsSync(absolutePath)) {
                unlinkSync(absolutePath)
                restored.push(filePath)
            }
        } catch (error) {
            logger.debug(`[rewind] Failed to delete restored-missing file: ${filePath}`, error)
        }
    }

    return restored
}
