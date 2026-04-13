import { beforeEach, describe, expect, it } from 'vitest'
import { __resetNotificationDedupeForTests, markNotificationSeen, shouldShowNotification } from './notification-dedupe'

describe('notification-dedupe', () => {
    beforeEach(() => {
        __resetNotificationDedupeForTests()
    })

    it('allows the first notification key and suppresses repeats', () => {
        expect(shouldShowNotification('ready-session-1-1')).toBe(true)
        markNotificationSeen('ready-session-1-1')
        expect(shouldShowNotification('ready-session-1-1')).toBe(false)
    })
})
