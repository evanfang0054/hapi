import { useLocation, useNavigate, useMatchRoute } from '@tanstack/react-router'
import { useTranslation } from '@/lib/use-translation'
import { useTheme, useAppearance } from '@/hooks/useTheme'

function ChatIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    )
}

function MachineIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    )
}

function HistoryIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function SettingsIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    )
}

function SunIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    )
}

function MoonIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    )
}

type DesktopNavProps = {
    onNewSession: () => void
}

export function DesktopNav({ onNewSession }: DesktopNavProps) {
    const navigate = useNavigate()
    const pathname = useLocation({ select: (location) => location.pathname })
    const matchRoute = useMatchRoute()
    const { t } = useTranslation()
    const { isDark } = useTheme()
    const { appearance, setAppearance } = useAppearance()

    const toggleTheme = () => {
        setAppearance(isDark ? 'light' : 'dark')
    }

    const isSessionsActive = pathname === '/sessions' || pathname === '/' || Boolean(matchRoute({ to: '/sessions/$sessionId', fuzzy: true }))
    const isMachinesActive = pathname === '/machines'
    const isHistoryActive = pathname === '/history'
    const isSettingsActive = pathname === '/settings'

    const navItems = [
        { label: t('sessions.title'), icon: <ChatIcon />, active: isSessionsActive, onClick: () => navigate({ to: '/sessions' }) },
        { label: t('machines.title'), icon: <MachineIcon />, active: isMachinesActive, onClick: () => navigate({ to: '/machines' }) },
        { label: t('history.title'), icon: <HistoryIcon />, active: isHistoryActive, onClick: () => navigate({ to: '/history' }) },
        { label: t('settings.title'), icon: <SettingsIcon />, active: isSettingsActive, onClick: () => navigate({ to: '/settings' }) },
    ]

    return (
        <header className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 h-14 shrink-0">
            {/* Logo */}
            <button
                type="button"
                onClick={() => navigate({ to: '/sessions' })}
                className="font-[var(--app-font-serif)] text-lg font-semibold tracking-tight text-[var(--app-fg)] hover:opacity-80 transition-opacity"
            >
                hapi
            </button>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                    <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--app-radius-lg)] text-sm transition-colors ${
                            item.active
                                ? 'text-[var(--app-fg)] bg-[var(--app-subtle-bg)] font-medium'
                                : 'text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                        }`}
                    >
                        {item.icon}
                        <span className="hidden xl:inline">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
                {/* New Session button */}
                <button
                    type="button"
                    onClick={onNewSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--app-radius-lg)] text-sm font-medium bg-[var(--app-button)] text-[var(--app-button-text)] shadow-[0_0_0_1px_var(--app-ring-warm)] hover:brightness-[0.98] transition-all"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="hidden xl:inline">{t('sessions.new')}</span>
                </button>

                {/* Theme toggle */}
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center justify-center w-8 h-8 rounded-[var(--app-radius-lg)] text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                    title={isDark ? t('theme.light') : t('theme.dark')}
                >
                    {isDark ? <MoonIcon /> : <SunIcon />}
                </button>
            </div>
        </header>
    )
}
