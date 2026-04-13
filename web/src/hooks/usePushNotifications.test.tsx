import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { usePushNotifications } from './usePushNotifications'

function HookProbe(props: { api: ApiClient | null; onReady?: (value: ReturnType<typeof usePushNotifications>) => void }) {
    const value = usePushNotifications(props.api)
    props.onReady?.(value)
    return null
}

describe('usePushNotifications', () => {
    const originalNotification = globalThis.Notification
    const originalNavigator = globalThis.navigator
    const originalPushManager = globalThis.PushManager

    let latestHook: ReturnType<typeof usePushNotifications> | null = null
    let getSubscription: ReturnType<typeof vi.fn>
    let subscribe: ReturnType<typeof vi.fn>
    let getPushVapidPublicKey: ReturnType<typeof vi.fn>
    let subscribePushNotifications: ReturnType<typeof vi.fn>

    beforeEach(() => {
        latestHook = null
        getSubscription = vi.fn().mockResolvedValue(null)
        subscribe = vi.fn().mockResolvedValue({
            toJSON: () => ({
                endpoint: 'https://push.example.test/sub',
                keys: {
                    p256dh: 'p256dh-key',
                    auth: 'auth-key'
                }
            })
        })
        getPushVapidPublicKey = vi.fn().mockResolvedValue({
            publicKey: 'BEl6Q2FfXzEyMzQ1Njc4OTAtX19BQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWg'
        })
        subscribePushNotifications = vi.fn().mockResolvedValue(undefined)

        Object.defineProperty(globalThis, 'Notification', {
            configurable: true,
            writable: true,
            value: {
                permission: 'granted',
                requestPermission: vi.fn().mockResolvedValue('granted')
            }
        })

        Object.defineProperty(globalThis, 'PushManager', {
            configurable: true,
            writable: true,
            value: class PushManagerMock {}
        })

        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            writable: true,
            value: {
                serviceWorker: {
                    ready: Promise.resolve({
                        pushManager: {
                            getSubscription,
                            subscribe
                        }
                    })
                }
            }
        })
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        Object.defineProperty(globalThis, 'Notification', {
            configurable: true,
            writable: true,
            value: originalNotification
        })
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            writable: true,
            value: originalNavigator
        })
        Object.defineProperty(globalThis, 'PushManager', {
            configurable: true,
            writable: true,
            value: originalPushManager
        })
    })

    it('passes Uint8Array vapid key to pushManager.subscribe and persists the subscription', async () => {
        const api = {
            getPushVapidPublicKey,
            subscribePushNotifications
        } as unknown as ApiClient

        render(<HookProbe api={api} onReady={(value) => { latestHook = value }} />)

        await waitFor(() => {
            expect(latestHook?.isSupported).toBe(true)
        })

        const subscribed = await latestHook!.subscribe()

        expect(subscribed).toBe(true)
        expect(subscribe).toHaveBeenCalledTimes(1)
        expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({
            userVisibleOnly: true,
            applicationServerKey: expect.any(Uint8Array)
        }))
        expect(subscribePushNotifications).toHaveBeenCalledWith({
            endpoint: 'https://push.example.test/sub',
            keys: {
                p256dh: 'p256dh-key',
                auth: 'auth-key'
            }
        })
    })
})
