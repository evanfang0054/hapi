const FEATURE_PREFERENCE_EVENT = 'hapi:feature-preference-change'

export const FEATURE_PREFERENCE_KEYS = {
    voiceEnabled: 'hapi-voice-enabled',
    pushEnabled: 'hapi-push-enabled',
    telegramEnabled: 'hapi-telegram-enabled'
} as const

export type FeaturePreferenceName = keyof typeof FEATURE_PREFERENCE_KEYS

const FEATURE_PREFERENCE_DEFAULTS: Record<FeaturePreferenceName, boolean> = {
    voiceEnabled: true,
    pushEnabled: true,
    telegramEnabled: false
}

function isWindowAvailable(): boolean {
    return typeof window !== 'undefined'
}

export function getFeaturePreference(name: FeaturePreferenceName): boolean {
    if (!isWindowAvailable()) {
        return FEATURE_PREFERENCE_DEFAULTS[name]
    }

    try {
        const key = FEATURE_PREFERENCE_KEYS[name]
        const raw = window.localStorage.getItem(key)
        if (raw === null) {
            return FEATURE_PREFERENCE_DEFAULTS[name]
        }
        return raw !== 'false'
    } catch {
        return FEATURE_PREFERENCE_DEFAULTS[name]
    }
}

export function setFeaturePreference(name: FeaturePreferenceName, value: boolean): void {
    if (!isWindowAvailable()) {
        return
    }

    try {
        const key = FEATURE_PREFERENCE_KEYS[name]
        window.localStorage.setItem(key, String(value))
        window.dispatchEvent(
            new CustomEvent(FEATURE_PREFERENCE_EVENT, {
                detail: {
                    key,
                    value
                }
            })
        )
    } catch {
        // Ignore storage errors
    }
}

export function onFeaturePreferenceChange(listener: () => void): () => void {
    if (!isWindowAvailable()) {
        return () => {}
    }

    const handleStorage = (event: StorageEvent) => {
        if (!event.key) {
            return
        }
        const keys = Object.values(FEATURE_PREFERENCE_KEYS)
        if (keys.includes(event.key as (typeof keys)[number])) {
            listener()
        }
    }

    const handleCustomEvent = () => {
        listener()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(FEATURE_PREFERENCE_EVENT, handleCustomEvent)

    return () => {
        window.removeEventListener('storage', handleStorage)
        window.removeEventListener(FEATURE_PREFERENCE_EVENT, handleCustomEvent)
    }
}
