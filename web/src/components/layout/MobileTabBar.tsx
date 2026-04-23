import { useLocation, useNavigate, useMatchRoute } from '@tanstack/react-router'
import { useTranslation } from '@/lib/use-translation'
import { useSessions } from '@/hooks/queries/useSessions'
import { useAppContext } from '@/lib/app-context'
import { isTelegramApp } from '@/hooks/useTelegram'

function ChatIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    )
}

function MachineIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    )
}

function HistoryIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function SettingsIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    )
}

function PlusIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

type MobileTabBarProps = {
    onNewSession: () => void
    hidden?: boolean
}

export function MobileTabBar({ onNewSession, hidden }: MobileTabBarProps) {
    const navigate = useNavigate()
    const pathname = useLocation({ select: (location) => location.pathname })
    const matchRoute = useMatchRoute()
    const { t } = useTranslation()
    const { api } = useAppContext()
    const { sessions } = useSessions(api)

    // Hide in Telegram — TG has its own navigation
    if (isTelegramApp() || hidden) return null

    // Determine active tab
    const isSessionsActive = pathname === '/sessions' || pathname === '/' || Boolean(matchRoute({ to: '/sessions/$sessionId', fuzzy: true }))
    const isMachinesActive = pathname === '/machines'
    const isHistoryActive = pathname === '/history'
    const isSettingsActive = pathname === '/settings'

    const activeSessionsCount = sessions.filter(s => s.active).length

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-90 bg-[var(--app-panel-bg)] border-t border-[var(--app-border)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-around transition-all duration-300 [html[data-theme=dark]_&]:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
            style={{ padding: '8px 16px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
            {/* Sessions */}
            <button
                type="button"
                onClick={() => navigate({ to: '/sessions' })}
                className={`flex flex-col items-center gap-1 rounded-[12px] border-none cursor-pointer transition-all duration-200 min-w-[64px] ${
                    isSessionsActive
                        ? 'text-[var(--app-link)] bg-transparent'
                        : 'text-[var(--app-hint)] bg-transparent hover:bg-[var(--app-subtle-bg)]'
                }`}
                style={{ padding: '8px 16px' }}
            >
                <span className="relative">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-all duration-200 [&>svg]:w-5 [&>svg]:h-5 ${
                        isSessionsActive ? 'bg-[rgba(201,100,66,0.12)] [html[data-theme=dark]_&]:bg-[rgba(217,119,87,0.15)]' : ''
                    }`}>
                        <ChatIcon />
                    </span>
                    {activeSessionsCount > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[var(--app-link)] text-white text-[9px] font-semibold rounded-full flex items-center justify-center px-1">
                            {activeSessionsCount}
                        </span>
                    ) : null}
                </span>
                <span className={`text-[10px] font-${isSessionsActive ? '600' : '500'}`}>
                    {t('sessions.title')}
                </span>
            </button>

            {/* Machines */}
            <button
                type="button"
                onClick={() => navigate({ to: '/machines' })}
                className={`flex flex-col items-center gap-1 rounded-[12px] border-none cursor-pointer transition-all duration-200 min-w-[64px] ${
                    isMachinesActive
                        ? 'text-[var(--app-link)] bg-transparent'
                        : 'text-[var(--app-hint)] bg-transparent hover:bg-[var(--app-subtle-bg)]'
                }`}
                style={{ padding: '8px 16px' }}
            >
                <span className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-all duration-200 [&>svg]:w-5 [&>svg]:h-5 ${
                    isMachinesActive ? 'bg-[rgba(201,100,66,0.12)] [html[data-theme=dark]_&]:bg-[rgba(217,119,87,0.15)]' : ''
                }`}>
                    <MachineIcon />
                </span>
                <span className={`text-[10px] font-${isMachinesActive ? '600' : '500'}`}>
                    {t('machines.title')}
                </span>
            </button>

            {/* FAB — New Session */}
            <button
                type="button"
                onClick={onNewSession}
                className="relative -mt-6 w-12 h-12 rounded-full bg-[var(--app-link)] text-white border-none cursor-pointer flex items-center justify-center shadow-[0_4px_12px_rgba(201,100,66,0.3)] transition-all duration-200 active:scale-95"
            >
                <PlusIcon />
            </button>

            {/* History */}
            <button
                type="button"
                onClick={() => navigate({ to: '/history' })}
                className={`flex flex-col items-center gap-1 rounded-[12px] border-none cursor-pointer transition-all duration-200 min-w-[64px] ${
                    isHistoryActive
                        ? 'text-[var(--app-link)] bg-transparent'
                        : 'text-[var(--app-hint)] bg-transparent hover:bg-[var(--app-subtle-bg)]'
                }`}
                style={{ padding: '8px 16px' }}
            >
                <span className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-all duration-200 [&>svg]:w-5 [&>svg]:h-5 ${
                    isHistoryActive ? 'bg-[rgba(201,100,66,0.12)] [html[data-theme=dark]_&]:bg-[rgba(217,119,87,0.15)]' : ''
                }`}>
                    <HistoryIcon />
                </span>
                <span className={`text-[10px] font-${isHistoryActive ? '600' : '500'}`}>
                    {t('history.title')}
                </span>
            </button>

            {/* Settings */}
            <button
                type="button"
                onClick={() => navigate({ to: '/settings' })}
                className={`flex flex-col items-center gap-1 rounded-[12px] border-none cursor-pointer transition-all duration-200 min-w-[64px] ${
                    isSettingsActive
                        ? 'text-[var(--app-link)] bg-transparent'
                        : 'text-[var(--app-hint)] bg-transparent hover:bg-[var(--app-subtle-bg)]'
                }`}
                style={{ padding: '8px 16px' }}
            >
                <span className={`w-8 h-8 flex items-center justify-center rounded-[10px] transition-all duration-200 [&>svg]:w-5 [&>svg]:h-5 ${
                    isSettingsActive ? 'bg-[rgba(201,100,66,0.12)] [html[data-theme=dark]_&]:bg-[rgba(217,119,87,0.15)]' : ''
                }`}>
                    <SettingsIcon />
                </span>
                <span className={`text-[10px] font-${isSettingsActive ? '600' : '500'}`}>
                    {t('settings.title')}
                </span>
            </button>
        </nav>
    )
}
