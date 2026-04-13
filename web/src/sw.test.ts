import { beforeEach, describe, expect, it, vi } from 'vitest'

const precacheAndRoute = vi.fn()
const registerRoute = vi.fn()
const CacheFirst = vi.fn()
const NetworkFirst = vi.fn()
const ExpirationPlugin = vi.fn()

vi.mock('workbox-precaching', () => ({
    precacheAndRoute,
}))

vi.mock('workbox-routing', () => ({
    registerRoute,
}))

vi.mock('workbox-strategies', () => ({
    CacheFirst,
    NetworkFirst,
}))

vi.mock('workbox-expiration', () => ({
    ExpirationPlugin,
}))

type ListenerMap = Record<string, EventListener>
const listeners: ListenerMap = {}
const openWindow = vi.fn()
const matchAll = vi.fn()
const showNotification = vi.fn()

const selfMock = {
    __WB_MANIFEST: [],
    location: {
        origin: 'https://example.com',
    },
    registration: {
        showNotification,
    },
    clients: {
        openWindow,
        matchAll,
    },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners[type] = listener
    }),
}

Object.assign(globalThis, { self: selfMock })

await import('./sw')

describe('service worker notificationclick', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        matchAll.mockResolvedValue([])
        openWindow.mockResolvedValue(undefined)
    })

    it('focuses an existing client before opening a new window', async () => {
        const focus = vi.fn().mockResolvedValue(undefined)
        matchAll.mockResolvedValue([
            {
                url: 'https://example.com/sessions/session-1',
                focus,
            },
        ])

        let pending: Promise<unknown> | null = null
        const waitUntil = vi.fn((promise: Promise<unknown>) => {
            pending = promise
        })
        const close = vi.fn()

        listeners.notificationclick({
            notification: {
                close,
                data: { url: '/sessions/session-1' },
            },
            waitUntil,
        } as unknown as Event)
        await pending

        expect(close).toHaveBeenCalledTimes(1)
        expect(matchAll).toHaveBeenCalledTimes(1)
        expect(focus).toHaveBeenCalledTimes(1)
        expect(openWindow).not.toHaveBeenCalled()
    })

    it('opens a new window when no matching client exists', async () => {
        let pending: Promise<unknown> | null = null
        const waitUntil = vi.fn((promise: Promise<unknown>) => {
            pending = promise
        })
        const close = vi.fn()

        listeners.notificationclick({
            notification: {
                close,
                data: { url: '/sessions/session-2' },
            },
            waitUntil,
        } as unknown as Event)
        await pending

        expect(close).toHaveBeenCalledTimes(1)
        expect(matchAll).toHaveBeenCalledTimes(1)
        expect(openWindow).toHaveBeenCalledWith('/sessions/session-2')
    })
})
