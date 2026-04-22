import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { __resetNotificationDedupeForTests } from '@/lib/notification-dedupe'

const navigate = vi.fn()
const replace = vi.fn()
const startSync = vi.fn()
const endSync = vi.fn()
const requestPermission = vi.fn(async () => false)
const subscribe = vi.fn(async () => false)
const setServerUrl = vi.fn()
const clearServerUrl = vi.fn()
const setAccessToken = vi.fn()
const bind = vi.fn(async () => {})
const latestSse = {
    onToast: null as null | ((event: any) => void),
}

let activeSessionId: string | null = 'session-1'
let pushSupported = false
let pushPermission: NotificationPermission = 'default'
let pushSubscribed = false

vi.mock('@tanstack/react-router', () => ({
    Outlet: () => <div data-testid="app-outlet" />,
    useLocation: ({ select }: { select: (location: { pathname: string }) => string }) => select({ pathname: activeSessionId ? `/sessions/${activeSessionId}` : '/sessions' }),
    useMatchRoute: () => (({ to }: { to: string }) => {
        if (to !== '/sessions/$sessionId' || !activeSessionId) {
            return false
        }
        return { sessionId: activeSessionId }
    }),
    useRouter: () => ({
        history: {
            location: {
                pathname: activeSessionId ? `/sessions/${activeSessionId}` : '/sessions',
                search: '',
                hash: '',
                state: {},
            },
            replace,
        },
    }),
    useNavigate: () => navigate,
}))

vi.mock('@/hooks/useTelegram', () => ({
    getTelegramWebApp: () => null,
    isTelegramApp: () => false,
}))

vi.mock('@/hooks/useTheme', () => ({
    initializeTheme: vi.fn(),
    useTheme: () => ({ colorScheme: 'light', isDark: false }),
    useAppearance: () => ({ appearance: 'system', setAppearance: vi.fn() }),
}))

vi.mock('@/hooks/useAuth', () => ({
    useAuth: () => ({
        token: 'token',
        api: {},
        isLoading: false,
        error: null,
        needsBinding: false,
        bind,
    }),
}))

vi.mock('@/hooks/useAuthSource', () => ({
    useAuthSource: () => ({
        authSource: { type: 'accessToken' },
        isLoading: false,
        setAccessToken,
    }),
}))

vi.mock('@/hooks/useServerUrl', () => ({
    useServerUrl: () => ({
        serverUrl: 'https://example.com',
        baseUrl: 'https://example.com',
        setServerUrl,
        clearServerUrl,
    }),
}))

vi.mock('@/hooks/useSSE', () => ({
    useSSE: (options: { onToast?: (event: any) => void }) => {
        latestSse.onToast = options.onToast ?? null
        return { subscriptionId: 'sub-1' }
    },
}))

vi.mock('@/hooks/useSyncingState', () => ({
    useSyncingState: () => ({
        isSyncing: false,
        startSync,
        endSync,
    }),
}))

vi.mock('@/hooks/usePushNotifications', () => ({
    usePushNotifications: () => ({
        isSupported: pushSupported,
        permission: pushPermission,
        isSubscribed: pushSubscribed,
        requestPermission,
        subscribe,
    }),
}))

vi.mock('@/hooks/useVisibilityReporter', () => ({
    useVisibilityReporter: vi.fn(),
}))

vi.mock('@/hooks/useAppGoBack', () => ({
    useAppGoBack: () => vi.fn(),
}))

vi.mock('@/lib/app-context', () => ({
    AppContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAppContext: () => ({
        api: {},
        token: 'token',
        baseUrl: 'https://example.com',
        connectionState: 'connected',
    }),
}))

vi.mock('@/lib/message-window-store', () => ({
    fetchLatestMessages: vi.fn(async () => {}),
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/lib/voice-context', () => ({
    VoiceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/runtime-config', () => ({
    requireHubUrlForLogin: () => false,
}))

vi.mock('@/hooks/queries/useMachines', () => ({
    useMachines: () => ({
        machines: [],
        isLoading: false,
        error: null,
    }),
}))

vi.mock('@/hooks/queries/useSessions', () => ({
    useSessions: () => ({
        sessions: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
    }),
}))

vi.mock('@/components/NewSession', () => ({
    NewSession: () => <div data-testid="new-session" />,
}))

vi.mock('@/components/layout/DesktopNav', () => ({
    DesktopNav: () => <nav data-testid="desktop-nav" />,
}))

vi.mock('@/components/layout/MobileTabBar', () => ({
    MobileTabBar: () => <nav data-testid="mobile-tab-bar" />,
}))

vi.mock('@/components/LoginPrompt', () => ({
    LoginPrompt: () => <div data-testid="login-prompt" />,
}))

vi.mock('@/components/InstallPrompt', () => ({
    InstallPrompt: () => null,
}))

vi.mock('@/components/OfflineBanner', () => ({
    OfflineBanner: () => null,
}))

vi.mock('@/components/SyncingBanner', () => ({
    SyncingBanner: () => null,
}))

vi.mock('@/components/ReconnectingBanner', () => ({
    ReconnectingBanner: () => null,
}))

vi.mock('@/components/VoiceErrorBanner', () => ({
    VoiceErrorBanner: () => null,
}))

vi.mock('@/components/LoadingState', () => ({
    LoadingState: ({ label }: { label: string }) => <div>{label}</div>,
}))

vi.mock('@/components/ui/Toast', () => ({
    Toast: ({ title, body, onClick, onClose }: { title: string, body: string, onClick: () => void, onClose: () => void }) => (
        <div>
            <button type="button" onClick={onClick}>{title}</button>
            <div>{body}</div>
            <button type="button" onClick={onClose}>close</button>
        </div>
    ),
}))

function renderApp() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    )
}

describe('App toast notifications', () => {
    beforeEach(() => {
        activeSessionId = 'session-1'
        pushSupported = false
        pushPermission = 'default'
        pushSubscribed = false
        latestSse.onToast = null
        navigate.mockReset()
        replace.mockReset()
        startSync.mockReset()
        endSync.mockReset()
        requestPermission.mockReset()
        requestPermission.mockResolvedValue(false)
        subscribe.mockReset()
        subscribe.mockResolvedValue(false)
        __resetNotificationDedupeForTests()
    })

    afterEach(() => {
        cleanup()
    })

    it('renders a toast when SSE emits a new notification', async () => {
        renderApp()

        expect(latestSse.onToast).toBeTypeOf('function')

        await act(async () => {
            latestSse.onToast?.({
                type: 'toast',
                data: {
                    title: 'Ready for input',
                    body: 'Agent is waiting in session-1',
                    sessionId: 'session-1',
                    url: '/sessions/session-1',
                    notificationKey: 'ready-session-1',
                },
            })
        })

        expect(screen.getByText('Ready for input')).toBeInTheDocument()
        expect(screen.getByText('Agent is waiting in session-1')).toBeInTheDocument()
    })

    it('retries subscribe automatically when permission is already granted but subscription is still missing', async () => {
        pushSupported = true
        pushPermission = 'granted'
        pushSubscribed = false
        subscribe.mockResolvedValue(false)

        renderApp()

        await vi.waitFor(() => {
            expect(subscribe).toHaveBeenCalledTimes(2)
        })
        expect(requestPermission).not.toHaveBeenCalled()
    })

    it('requests permission only once before retrying subscribe failures', async () => {
        pushSupported = true
        pushPermission = 'default'
        pushSubscribed = false
        requestPermission.mockImplementation(async () => {
            pushPermission = 'granted'
            return true
        })
        subscribe.mockResolvedValue(false)

        renderApp()

        await vi.waitFor(() => {
            expect(subscribe).toHaveBeenCalledTimes(2)
        })
        expect(requestPermission).toHaveBeenCalledTimes(1)
    })
})
