export type VisibilityState = 'visible' | 'hidden'

type ConnectionState = {
    namespace: string
    visibility: VisibilityState
    activeSessionId: string | null
}

export class VisibilityTracker {
    private readonly connections = new Map<string, ConnectionState>()

    registerConnection(
        subscriptionId: string,
        namespace: string,
        state: VisibilityState,
        activeSessionId: string | null = null
    ): void {
        this.removeConnection(subscriptionId)
        this.connections.set(subscriptionId, {
            namespace,
            visibility: state,
            activeSessionId
        })
    }

    setVisibility(
        subscriptionId: string,
        namespace: string,
        state: VisibilityState,
        activeSessionId: string | null = null
    ): boolean {
        const current = this.connections.get(subscriptionId)
        if (!current || current.namespace !== namespace) {
            return false
        }

        this.connections.set(subscriptionId, {
            namespace,
            visibility: state,
            activeSessionId
        })
        return true
    }

    removeConnection(subscriptionId: string): void {
        this.connections.delete(subscriptionId)
    }

    hasVisibleConnection(namespace: string): boolean {
        for (const connection of this.connections.values()) {
            if (connection.namespace === namespace && connection.visibility === 'visible') {
                return true
            }
        }
        return false
    }

    hasVisibleConnectionForSession(namespace: string, sessionId: string): boolean {
        for (const connection of this.connections.values()) {
            if (
                connection.namespace === namespace &&
                connection.visibility === 'visible' &&
                connection.activeSessionId === sessionId
            ) {
                return true
            }
        }
        return false
    }

    isVisibleConnection(subscriptionId: string): boolean {
        return this.connections.get(subscriptionId)?.visibility === 'visible'
    }

    removeConnectionSession(subscriptionId: string): void {
        const current = this.connections.get(subscriptionId)
        if (!current) {
            return
        }
        this.connections.set(subscriptionId, {
            ...current,
            activeSessionId: null
        })
    }
}
