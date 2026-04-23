export type SessionViewState = {
    sessionId: string
    atBottom: boolean
    anchorSeq: number | null
    savedAt: number
}

const STORAGE_KEY = 'hapi:session-view-state'

function readAll(): Record<string, SessionViewState> {
    if (typeof window === 'undefined') {
        return {}
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
        return {}
    }

    return JSON.parse(raw) as Record<string, SessionViewState>
}

function writeAll(next: Record<string, SessionViewState>): void {
    if (typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // localStorage quota exceeded — evict oldest entries and retry
        const entries = Object.entries(next).sort((a, b) => a[1].savedAt - b[1].savedAt)
        // Drop oldest half
        const keep = entries.slice(Math.floor(entries.length / 2))
        const trimmed = Object.fromEntries(keep)
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        } catch {
            try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
        }
    }
}

export function getSessionViewState(sessionId: string): SessionViewState | null {
    return readAll()[sessionId] ?? null
}

export function saveSessionViewState(state: SessionViewState): void {
    const all = readAll()
    all[state.sessionId] = state
    writeAll(all)
}
