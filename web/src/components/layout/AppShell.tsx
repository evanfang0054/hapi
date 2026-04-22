import { useCallback, useEffect, type ReactNode } from 'react'
import { useLocation, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { DesktopNav } from './DesktopNav'
import { MobileTabBar } from './MobileTabBar'

type AppShellProps = {
    children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const navigate = useNavigate()
    const pathname = useLocation({ select: (location) => location.pathname })
    const matchRoute = useMatchRoute()

    // Determine if we're in a session detail view or new-session page (hide mobile tab bar)
    const sessionMatch = matchRoute({ to: '/sessions/$sessionId', fuzzy: true })
    const isInSessionDetail = Boolean(sessionMatch) && pathname !== '/sessions' && pathname !== '/sessions/'
    const isNewSessionPage = pathname === '/new-session'
    const hideMobileTabBar = isInSessionDetail || isNewSessionPage

    const handleNewSession = useCallback(() => {
        navigate({ to: '/new-session' })
    }, [navigate])

    // Listen for custom event from SessionList to open NewSession page
    useEffect(() => {
        const handler = () => navigate({ to: '/new-session' })
        window.addEventListener('hapi:new-session', handler)
        return () => window.removeEventListener('hapi:new-session', handler)
    }, [navigate])

    return (
        <div className="h-full flex flex-col">
            {/* Desktop: Top nav bar (hidden on mobile) */}
            <div className="hidden lg:block">
                <DesktopNav onNewSession={handleNewSession} />
            </div>

            {/* Main content area */}
            <div className="flex-1 min-h-0">
                {children}
            </div>

            {/* Mobile: Bottom Tab Bar (hidden on desktop, hidden in session detail and new-session page) */}
            <div className="lg:hidden">
                <MobileTabBar onNewSession={handleNewSession} hidden={hideMobileTabBar} />
            </div>
        </div>
    )
}
