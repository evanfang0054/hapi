import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useLocation, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useMachines } from '@/hooks/queries/useMachines'
import { queryKeys } from '@/lib/query-keys'
import { DesktopNav } from './DesktopNav'
import { MobileTabBar } from './MobileTabBar'
import { NewSession } from '@/components/NewSession'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/use-translation'

type AppShellProps = {
    children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
    const { api } = useAppContext()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const pathname = useLocation({ select: (location) => location.pathname })
    const matchRoute = useMatchRoute()
    const { machines, isLoading: machinesLoading, error: machinesError } = useMachines(api, true)
    const [newSessionOpen, setNewSessionOpen] = useState(false)

    // Determine if we're in a session detail view (hide mobile tab bar)
    const sessionMatch = matchRoute({ to: '/sessions/$sessionId', fuzzy: true })
    const isInSessionDetail = Boolean(sessionMatch) && pathname !== '/sessions' && pathname !== '/sessions/'

    const handleNewSession = useCallback(() => {
        setNewSessionOpen(true)
    }, [])

    const handleNewSessionSuccess = useCallback((sessionId: string) => {
        setNewSessionOpen(false)
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
        navigate({ to: '/sessions', replace: true })
        requestAnimationFrame(() => {
            navigate({
                to: '/sessions/$sessionId',
                params: { sessionId },
            })
        })
    }, [navigate, queryClient])

    const handleNewSessionCancel = useCallback(() => {
        setNewSessionOpen(false)
    }, [])

    // Listen for custom event from SessionList to open NewSession modal
    useEffect(() => {
        const handler = () => setNewSessionOpen(true)
        window.addEventListener('hapi:new-session', handler)
        return () => window.removeEventListener('hapi:new-session', handler)
    }, [])

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

            {/* Mobile: Bottom Tab Bar (hidden on desktop, hidden in session detail) */}
            <div className="lg:hidden">
                <MobileTabBar onNewSession={handleNewSession} hidden={isInSessionDetail} />
            </div>

            {/* New Session Modal */}
            <Dialog open={newSessionOpen} onOpenChange={setNewSessionOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('newSession.title')}</DialogTitle>
                    </DialogHeader>
                    {machinesError ? (
                        <div className="p-3 text-sm text-red-600">{machinesError}</div>
                    ) : null}
                    <div className="app-scroll-y flex-1 min-h-0">
                        <NewSession
                            api={api}
                            machines={machines}
                            isLoading={machinesLoading}
                            onCancel={handleNewSessionCancel}
                            onSuccess={handleNewSessionSuccess}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
