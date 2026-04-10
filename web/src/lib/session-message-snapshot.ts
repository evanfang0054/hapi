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

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
