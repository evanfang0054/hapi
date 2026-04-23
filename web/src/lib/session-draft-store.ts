const STORAGE_KEY = 'hapi:session-drafts'

const memory = new Map<string, string>()
let hydrated = false

function load(): void {
    if (hydrated || typeof window === 'undefined') {
        return
    }

    hydrated = true

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
        return
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        for (const [sessionId, text] of Object.entries(parsed)) {
            if (typeof text === 'string' && text.length > 0) {
                memory.set(sessionId, text)
            }
        }
    } catch {
        // Ignore malformed persisted drafts and fall back to empty memory.
    }
}

function save(): void {
    if (typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memory)))
    } catch {
        // localStorage quota exceeded — clear drafts and move on
        try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
}

export function getSessionDraft(sessionId: string): string {
    load()
    return memory.get(sessionId) ?? ''
}

export function setSessionDraft(sessionId: string, text: string): void {
    load()

    if (text.trim().length === 0) {
        memory.delete(sessionId)
    } else {
        memory.set(sessionId, text)
    }

    save()
}

export function clearSessionDraft(sessionId: string): void {
    load()
    memory.delete(sessionId)
    save()
}

export function __resetSessionDraftStoreForTests(): void {
    memory.clear()
    hydrated = false
}
