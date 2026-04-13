const seen = new Map<string, number>()
const TTL_MS = 15_000

function prune(now: number): void {
    for (const [key, timestamp] of seen.entries()) {
        if (now - timestamp > TTL_MS) {
            seen.delete(key)
        }
    }
}

export function shouldShowNotification(key: string): boolean {
    const now = Date.now()
    prune(now)
    return !seen.has(key)
}

export function markNotificationSeen(key: string): void {
    const now = Date.now()
    prune(now)
    seen.set(key, now)
}

export function __resetNotificationDedupeForTests(): void {
    seen.clear()
}
