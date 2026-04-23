import type { DecryptedMessage } from '@/types/api'

export type SessionMessageSnapshot = {
    sessionId: string
    messages: DecryptedMessage[]
    oldestSeq: number | null
    newestSeq: number | null
    hasMore: boolean
    atBottom: boolean
    savedAt: number
}

const STORAGE_KEY = 'hapi:session-message-snapshots'

function readAll(): Record<string, SessionMessageSnapshot> {
    if (typeof window === 'undefined') {
        return {}
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
        return {}
    }

    return JSON.parse(raw) as Record<string, SessionMessageSnapshot>
}

function writeAll(next: Record<string, SessionMessageSnapshot>): void {
    if (typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // localStorage quota exceeded — evict oldest snapshots and retry
        const entries = Object.entries(next).sort((a, b) => a[1].savedAt - b[1].savedAt)
        // Drop oldest half
        const keep = entries.slice(Math.floor(entries.length / 2))
        const trimmed = Object.fromEntries(keep)
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        } catch {
            try {
                window.localStorage.removeItem(STORAGE_KEY)
            } catch {
                // give up silently
            }
        }
    }
}

export function loadSessionMessageSnapshot(sessionId: string): SessionMessageSnapshot | null {
    return readAll()[sessionId] ?? null
}

export function saveSessionMessageSnapshot(snapshot: SessionMessageSnapshot): void {
    const all = readAll()
    all[snapshot.sessionId] = snapshot
    writeAll(all)
}

export function clearSessionMessageSnapshot(sessionId: string): void {
    const all = readAll()
    delete all[sessionId]
    writeAll(all)
}
