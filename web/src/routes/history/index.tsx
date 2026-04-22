import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useSessions } from '@/hooks/queries/useSessions'
import { useTranslation } from '@/lib/use-translation'

type SessionGroup = {
    label: string
    sessions: Array<{
        id: string
        name: string
        agent: string
        model: string | null
        active: boolean
        updatedAt: number
        projectPath: string | null
    }>
}

function groupSessionsByTime(sessions: SessionGroup['sessions']): SessionGroup[] {
    const now = Date.now()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    const yesterdayMs = todayMs - 86400000
    const weekMs = todayMs - 7 * 86400000
    const monthMs = todayMs - 30 * 86400000

    const groups: SessionGroup[] = [
        { label: 'Today', sessions: [] },
        { label: 'Yesterday', sessions: [] },
        { label: 'This Week', sessions: [] },
        { label: 'This Month', sessions: [] },
        { label: 'Older', sessions: [] },
    ]

    for (const session of sessions) {
        if (session.updatedAt >= todayMs) {
            groups[0].sessions.push(session)
        } else if (session.updatedAt >= yesterdayMs) {
            groups[1].sessions.push(session)
        } else if (session.updatedAt >= weekMs) {
            groups[2].sessions.push(session)
        } else if (session.updatedAt >= monthMs) {
            groups[3].sessions.push(session)
        } else {
            groups[4].sessions.push(session)
        }
    }

    return groups.filter(g => g.sessions.length > 0)
}

export default function HistoryPage() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const navigate = useNavigate()
    const { sessions, isLoading, error } = useSessions(api)
    const [searchQuery, setSearchQuery] = useState('')

    const filteredSessions = useMemo(() => {
        const allSessions = sessions.map(s => ({
            id: s.id,
            name: s.metadata?.name ?? s.id.slice(0, 8),
            agent: s.metadata?.flavor ?? 'claude',
            model: s.model ?? null,
            active: s.active ?? false,
            updatedAt: s.updatedAt ?? 0,
            projectPath: s.metadata?.path ?? s.metadata?.worktree?.basePath ?? null,
        }))

        if (!searchQuery.trim()) return allSessions
        const q = searchQuery.toLowerCase()
        return allSessions.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.projectPath?.toLowerCase().includes(q) ||
            s.agent.toLowerCase().includes(q)
        )
    }, [sessions, searchQuery])

    const groups = useMemo(() => groupSessionsByTime(filteredSessions), [filteredSessions])

    const totalCount = sessions.length
    const activeCount = sessions.filter(s => s.active).length

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-[var(--app-bg)] border-b border-[var(--app-border)] px-5 py-3">
                <h1 className="text-[20px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                    {t('history.title')}
                </h1>
                {totalCount > 0 && (
                    <div className="text-[12px] text-[var(--app-hint)] mt-1">
                        {totalCount} {t('history.total')} · {activeCount} {t('history.active')}
                    </div>
                )}
            </div>

            {/* Search bar */}
            <div className="px-4 py-3 border-b border-[var(--app-border)]">
                <div className="relative">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--app-hint)]">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('history.search')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:border-[var(--app-link)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.12)] transition-colors"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-[600px] px-4 py-6 space-y-6">
                    {error ? (
                        <div className="text-sm text-[var(--app-error)] p-4">{error}</div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-sm text-[var(--app-hint)]">{t('loading')}</div>
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-[var(--app-hint)] opacity-40 mb-4">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <div className="text-[var(--app-fg)] font-medium">
                                {searchQuery ? t('history.noResults') : t('history.empty')}
                            </div>
                            <div className="text-sm text-[var(--app-hint)] mt-1">{t('history.empty.description')}</div>
                        </div>
                    ) : (
                        groups.map((group) => (
                            <div key={group.label}>
                                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--app-hint)] mb-2">
                                    {group.label} ({group.sessions.length})
                                </div>
                                <div className="border border-[var(--app-border)] rounded-[var(--app-radius-xl)] overflow-hidden bg-[var(--app-panel-bg)]">
                                    {group.sessions.map((session, i) => (
                                        <button
                                            key={session.id}
                                            type="button"
                                            onClick={() => navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } })}
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--app-panel-muted-bg)] transition-colors ${i < group.sessions.length - 1 ? 'border-b border-[var(--app-border)]' : ''}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${session.active ? 'bg-[var(--app-git-staged-color)]' : 'bg-[var(--app-hint)] opacity-40'}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[14px] font-medium text-[var(--app-fg)] truncate">{session.name}</div>
                                                <div className="text-[12px] text-[var(--app-hint)] flex items-center gap-2 mt-0.5">
                                                    <span>{session.agent}</span>
                                                    {session.model && (
                                                        <>
                                                            <span className="text-[var(--app-border)]">·</span>
                                                            <span>{session.model}</span>
                                                        </>
                                                    )}
                                                    {session.projectPath && (
                                                        <>
                                                            <span className="text-[var(--app-border)]">·</span>
                                                            <span className="truncate">{session.projectPath.split('/').pop()}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[var(--app-hint)] shrink-0">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}

                    {/* Bottom padding for mobile tab bar */}
                    <div className="h-20 lg:h-4" />
                </div>
            </div>
        </div>
    )
}
