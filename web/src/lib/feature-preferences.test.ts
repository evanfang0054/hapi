import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    FEATURE_PREFERENCE_KEYS,
    getFeaturePreference,
    onFeaturePreferenceChange,
    setFeaturePreference,
} from './feature-preferences'

describe('feature-preferences', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('returns expected defaults when no persisted value exists', () => {
        expect(getFeaturePreference('voiceEnabled')).toBe(true)
        expect(getFeaturePreference('pushEnabled')).toBe(true)
        expect(getFeaturePreference('telegramEnabled')).toBe(false)
    })

    it('persists and reads preference values from localStorage', () => {
        setFeaturePreference('voiceEnabled', false)
        setFeaturePreference('pushEnabled', false)
        setFeaturePreference('telegramEnabled', true)

        expect(window.localStorage.getItem(FEATURE_PREFERENCE_KEYS.voiceEnabled)).toBe('false')
        expect(window.localStorage.getItem(FEATURE_PREFERENCE_KEYS.pushEnabled)).toBe('false')
        expect(window.localStorage.getItem(FEATURE_PREFERENCE_KEYS.telegramEnabled)).toBe('true')

        expect(getFeaturePreference('voiceEnabled')).toBe(false)
        expect(getFeaturePreference('pushEnabled')).toBe(false)
        expect(getFeaturePreference('telegramEnabled')).toBe(true)
    })

    it('notifies listeners when preference changes in same tab', () => {
        const listener = vi.fn()
        const dispose = onFeaturePreferenceChange(listener)

        setFeaturePreference('pushEnabled', false)

        expect(listener).toHaveBeenCalledTimes(1)
        dispose()
    })

    it('notifies listeners on cross-tab storage updates for known keys only', () => {
        const listener = vi.fn()
        const dispose = onFeaturePreferenceChange(listener)

        window.dispatchEvent(new StorageEvent('storage', {
            key: FEATURE_PREFERENCE_KEYS.pushEnabled,
            newValue: 'false',
        }))
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'unrelated-key',
            newValue: 'true',
        }))

        expect(listener).toHaveBeenCalledTimes(1)
        dispose()
    })
})
