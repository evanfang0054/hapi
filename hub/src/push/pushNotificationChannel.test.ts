import { describe, expect, it, mock } from 'bun:test'
import type { Session } from '../sync/syncEngine'
import { PushNotificationChannel } from './pushNotificationChannel'
import type { PushPayload, PushService } from './pushService'
import type { SyncEvent } from '../sync/syncEngine'
import type { VisibilityTracker } from '../visibility/visibilityTracker'
import type { SSEManager } from '../sse/sseManager'

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: 0,
        updatedAt: 0,
        active: true,
        activeAt: 0,
        metadata: null,
        metadataVersion: 0,
        agentState: null,
        agentStateVersion: 0,
        thinking: false,
        thinkingAt: 0,
        model: null,
        effort: null,
        ...overrides
    }
}

describe('PushNotificationChannel', () => {
    it('sends toast only when the visible client is already on the same session', async () => {
        const sendToNamespace = mock(async (_namespace: string, _payload: PushPayload) => {})
        const sendToast = mock(async (_namespace: string, _event: Extract<SyncEvent, { type: 'toast' }>) => 1)
        const hasVisibleConnectionForSession = mock((_namespace: string, _sessionId: string) => true)

        const channel = new PushNotificationChannel(
            { sendToNamespace } as unknown as PushService,
            { sendToast } as unknown as SSEManager,
            {
                hasVisibleConnectionForSession,
                hasVisibleConnection: mock((_namespace: string) => true)
            } as unknown as VisibilityTracker,
            'https://example.com'
        )

        const session = createSession()
        await channel.sendReady(session)

        expect(hasVisibleConnectionForSession).toHaveBeenCalledWith('default', 'session-1')
        expect(sendToast).toHaveBeenCalledTimes(1)
        expect(sendToast).toHaveBeenCalledWith('default', {
            type: 'toast',
            data: {
                title: 'Ready for input',
                body: 'Agent is waiting in session-',
                sessionId: 'session-1',
                url: '/sessions/session-1',
                notificationKey: 'ready-session-1'
            }
        })
        expect(sendToNamespace).toHaveBeenCalledTimes(0)
    })

    it('sends push when a visible client is on a different session', async () => {
        const sendToNamespace = mock(async (_namespace: string, _payload: PushPayload) => {})
        const sendToast = mock(async (_namespace: string, _event: Extract<SyncEvent, { type: 'toast' }>) => 1)
        const hasVisibleConnectionForSession = mock((_namespace: string, _sessionId: string) => false)

        const channel = new PushNotificationChannel(
            { sendToNamespace } as unknown as PushService,
            { sendToast } as unknown as SSEManager,
            {
                hasVisibleConnectionForSession,
                hasVisibleConnection: mock((_namespace: string) => true)
            } as unknown as VisibilityTracker,
            'https://example.com'
        )

        const session = createSession()
        await channel.sendReady(session)

        expect(sendToast).toHaveBeenCalledTimes(0)
        expect(sendToNamespace).toHaveBeenCalledTimes(1)
        expect(sendToNamespace.mock.calls[0]?.[0]).toBe('default')
        expect(sendToNamespace.mock.calls[0]?.[1]).toEqual({
            title: 'Ready for input',
            body: 'Agent is waiting in session-',
            tag: 'ready-session-1',
            data: {
                type: 'ready',
                sessionId: 'session-1',
                url: '/sessions/session-1'
            }
        })
    })

    it('falls back to push when toast delivery fails', async () => {
        const sendToNamespace = mock(async (_namespace: string, _payload: PushPayload) => {})
        const sendToast = mock(async (_namespace: string, _event: Extract<SyncEvent, { type: 'toast' }>) => 0)
        const hasVisibleConnectionForSession = mock((_namespace: string, _sessionId: string) => true)

        const channel = new PushNotificationChannel(
            { sendToNamespace } as unknown as PushService,
            { sendToast } as unknown as SSEManager,
            {
                hasVisibleConnectionForSession,
                hasVisibleConnection: mock((_namespace: string) => true)
            } as unknown as VisibilityTracker,
            'https://example.com'
        )

        const session = createSession()
        await channel.sendPermissionRequest(session)

        expect(sendToast).toHaveBeenCalledTimes(1)
        expect(sendToNamespace).toHaveBeenCalledTimes(1)
        expect(sendToNamespace.mock.calls[0]?.[1]).toEqual({
            title: 'Permission Request',
            body: 'session-',
            tag: 'permission-session-1',
            data: {
                type: 'permission-request',
                sessionId: 'session-1',
                url: '/sessions/session-1'
            }
        })
    })
})
