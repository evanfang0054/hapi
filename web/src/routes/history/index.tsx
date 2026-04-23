import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useSessions } from '@/hooks/queries/useSessions'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { useTranslation } from '@/lib/use-translation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type FilterMode = 'all' | 'archived' | 'unarchived'

type SessionItem = {
    id: string
    name: string
    agent: string
    model: string | null
    active: boolean
    updatedAt: number
    projectPath: string | null
    summary: string | null
    archived: boolean
    deleted: boolean
}

type SessionGroup = {
    label: string
    sessions: SessionItem[]
}

function groupSessionsByTime(sessions: SessionItem[]): SessionGroup[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    const yesterdayMs = todayMs - 86400000
    const weekMs = todayMs - 7 * 86400000

    const groups: SessionGroup[] = [
        { label: 'Today', sessions: [] },
        { label: 'Yesterday', sessions: [] },
        { label: 'This Week', sessions: [] },
        { label: 'Older', sessions: [] },
    ]

    for (const session of sessions) {
        if (session.updatedAt >= todayMs) {
            groups[0].sessions.push(session)
        } else if (session.updatedAt >= yesterdayMs) {
            groups[1].sessions.push(session)
        } else if (session.updatedAt >= weekMs) {
            groups[2].sessions.push(session)
        } else {
            groups[3].sessions.push(session)
        }
    }

    return groups.filter(g => g.sessions.length > 0)
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
}

function highlightText(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text
    const q = query.trim()
    const lowerText = text.toLowerCase()
    const lowerQ = q.toLowerCase()
    const idx = lowerText.indexOf(lowerQ)
    if (idx === -1) return text
    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + q.length)
    const after = text.slice(idx + q.length)
    return <>{before}<mark className="rounded-[2px] bg-[rgba(201,100,66,0.2)] px-[2px] text-[var(--app-fg)]">{match}</mark>{highlightText(after, q)}</>
}

function HistorySessionItem({ session, api, onOpen, searchInput }: {
    session: SessionItem
    api: import('@/api/client').ApiClient
    onOpen: () => void
    searchInput: string
}) {
    const { t } = useTranslation()
    const { archiveSession, deleteSession } = useSessionActions(api, session.id, session.agent)
    const [actionsOpen, setActionsOpen] = useState(false)
    const itemRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!actionsOpen) return
        function handleClickOutside(e: MouseEvent) {
            if (itemRef.current && !itemRef.current.contains(e.target as Node)) {
                setActionsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [actionsOpen])

    const handleAction = useCallback((fn: () => Promise<void>) => {
        fn().catch(() => {})
        setActionsOpen(false)
    }, [])

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        type: 'archive' | 'delete' | 'permanentDelete'
        action: () => Promise<void>
    }>({ isOpen: false, type: 'delete', action: async () => {} })

    const [isConfirmPending, setIsConfirmPending] = useState(false)

    const handleConfirm = useCallback(async () => {
        setIsConfirmPending(true)
        try {
            await confirmDialog.action()
        } catch {}
        setIsConfirmPending(false)
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        setActionsOpen(false)
    }, [confirmDialog.action])

    const status: 'normal' | 'archived' | 'deleted' = session.deleted ? 'deleted' : session.archived ? 'archived' : 'normal'
    const secondaryMeta = session.model ?? session.agent

    return (
        <div
            ref={itemRef}
            className={`cursor-pointer rounded-[16px] border bg-[var(--app-panel-elevated-bg)] p-3.5 transition-all [webkit-tap-highlight-color:transparent] ${actionsOpen ? 'border-[var(--app-link)] shadow-[var(--app-shadow-sm)]' : 'border-[var(--app-border)] hover:border-[var(--app-link)] hover:shadow-[var(--app-shadow-sm)]'}`}
            onClick={() => setActionsOpen(open => !open)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActionsOpen(open => !open)
                }
            }}
        >
            <div className="flex items-start gap-3">
                <div className={`h-10 w-10 shrink-0 rounded-[10px] ${session.archived ? 'bg-[var(--app-border)]' : 'bg-[var(--app-subtle-bg)]'} flex items-center justify-center text-[var(--app-hint)]`}>
                    {status === 'deleted' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    ) : session.archived ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                            <path d="M21 8v13H3V8" />
                            <path d="M1 3h22v5H1z" />
                            <path d="M10 12h4" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-[var(--app-fg)]" onClick={(e) => { e.stopPropagation(); onOpen() }}>
                        {highlightText(session.name, searchInput)}
                    </div>
                    {(session.summary || session.projectPath) && (
                        <div className="mt-1 line-clamp-2 text-[12px] leading-[1.4] text-[var(--app-hint)]">
                            {highlightText(session.summary || session.projectPath || '', searchInput)}
                        </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-[var(--app-hint)]">
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                        <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--app-hint)]" />
                        <span className="truncate">{secondaryMeta}</span>
                        {session.archived && !session.deleted && (
                            <>
                                <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--app-hint)]" />
                                <span className="rounded-[6px] bg-[var(--app-border)] px-2 py-0.5 text-[10px] font-medium">Archived</span>
                            </>
                        )}
                        {session.deleted && (
                            <>
                                <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--app-hint)]" />
                                <span className="rounded-[6px] bg-[rgba(181,51,51,0.08)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-error)]">Deleted</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {actionsOpen && (
                <div className="mt-2 ml-[52px] flex flex-wrap items-center gap-1.5">
                    {status === 'normal' && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpen() }}
                                className="flex items-center gap-1 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-1.5 text-[12px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)] active:scale-95"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                {t('history.open')}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setConfirmDialog({
                                        isOpen: true,
                                        type: 'archive',
                                        action: archiveSession
                                    })
                                }}
                                className="flex items-center gap-1 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-1.5 text-[12px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)] active:scale-95"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                                {t('history.archive')}
                            </button>
                        </>
                    )}
                    {status === 'archived' && (
                        <>
                            <button
                                type="button"
                                disabled
                                onClick={(e) => e.stopPropagation()}
                                className="flex cursor-not-allowed items-center gap-1 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-1.5 text-[12px] text-[var(--app-hint)] opacity-55"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                {t('history.restore')}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setConfirmDialog({
                                        isOpen: true,
                                        type: 'delete',
                                        action: deleteSession
                                    })
                                }}
                                className="flex items-center gap-1 rounded-[16px] border border-[rgba(181,51,51,0.3)] bg-transparent px-3 py-1.5 text-[12px] text-[var(--app-error)] transition-colors hover:bg-[rgba(181,51,51,0.08)] active:scale-95"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                {t('history.delete')}
                            </button>
                        </>
                    )}
                    {status === 'deleted' && (
                        <>
                            <button
                                type="button"
                                disabled
                                onClick={(e) => e.stopPropagation()}
                                className="flex cursor-not-allowed items-center gap-1 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-1.5 text-[12px] text-[var(--app-hint)] opacity-55"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                                {t('history.restore')}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setConfirmDialog({
                                        isOpen: true,
                                        type: 'permanentDelete',
                                        action: deleteSession
                                    })
                                }}
                                className="flex items-center gap-1 rounded-[16px] border border-[rgba(181,51,51,0.3)] bg-transparent px-3 py-1.5 text-[12px] text-[var(--app-error)] transition-colors hover:bg-[rgba(181,51,51,0.08)] active:scale-95"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                {t('history.permanentDelete')}
                            </button>
                        </>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                title={confirmDialog.type === 'archive'
                    ? `Archive "${session.name}"?`
                    : confirmDialog.type === 'permanentDelete'
                        ? `Permanently delete "${session.name}"?`
                        : `Delete "${session.name}"?`
                }
                description={confirmDialog.type === 'archive'
                    ? 'This session will be moved to archive.'
                    : 'This action cannot be undone.'
                }
                confirmLabel={confirmDialog.type === 'archive' ? 'Archive' : 'Delete'}
                confirmingLabel={confirmDialog.type === 'archive' ? 'Archiving...' : 'Deleting...'}
                onConfirm={handleConfirm}
                isPending={isConfirmPending}
                destructive={confirmDialog.type !== 'archive'}
                accent={confirmDialog.type === 'archive' ? 'archive' : 'default'}
            />
        </div>
    )
}

export default function HistoryPage() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const navigate = useNavigate()
    const { sessions, isLoading, error } = useSessions(api)
    const [searchInput, setSearchInput] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [filterMode, setFilterMode] = useState<FilterMode>('all')
    const [filterOpen, setFilterOpen] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchInput), 200)
        return () => clearTimeout(timer)
    }, [searchInput])

    const allSessions = useMemo(() => sessions.map(s => ({
        id: s.id,
        name: s.metadata?.summary?.text ?? '',
        agent: s.metadata?.flavor ?? 'claude',
        model: s.model ?? null,
        active: s.active ?? false,
        updatedAt: s.updatedAt ?? 0,
        projectPath: s.metadata?.path ?? s.metadata?.worktree?.basePath ?? null,
        summary: null,
        archived: s.metadata?.lifecycleState === 'archived' || s.active === false,
        deleted: false,
    })), [sessions])

    const filteredSessions = useMemo(() => {
        let result = allSessions
        if (filterMode === 'archived') {
            result = result.filter(s => s.archived)
        } else if (filterMode === 'unarchived') {
            result = result.filter(s => !s.archived)
        }
        if (debouncedQuery.trim()) {
            const q = debouncedQuery.toLowerCase()
            result = result.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.projectPath?.toLowerCase().includes(q) ||
                s.agent.toLowerCase().includes(q)
            )
        }
        return result
    }, [allSessions, filterMode, debouncedQuery])

    const groups = useMemo(() => groupSessionsByTime(filteredSessions), [filteredSessions])

    const totalCount = allSessions.length
    const thisWeekCount = allSessions.filter(s => s.updatedAt >= Date.now() - 7 * 86400000).length

    // Average duration placeholder — no createdAt field available yet
    const avgDuration = '—'

    const filterLabel = useCallback((mode: FilterMode): string => {
        if (mode === 'all') return t('history.filter.all')
        if (mode === 'archived') return t('history.filter.archived')
        return t('history.filter.unarchived')
    }, [t])

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            {/* Sticky header */}
            <div className="bg-[var(--app-panel-bg)] border-b border-[var(--app-border)] px-4 py-4" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
                <h1 className="text-[28px] font-normal italic text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                    {t('history.title')}
                </h1>
                <p className="text-[13px] text-[var(--app-hint)] mt-1">{t('history.subtitle')}</p>
            </div>

            {/* Search bar + filter button */}
            <div className="flex gap-2.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3">
                <div className="relative flex-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-[var(--app-hint)]">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('history.search')}
                        className="w-full rounded-[12px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] py-2.5 pr-4 pl-10 text-[14px] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] transition-colors focus:border-[var(--app-link)] focus:outline-none"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setFilterOpen(!filterOpen)}
                    className={`flex h-11 w-11 items-center justify-center rounded-[12px] border bg-[var(--app-panel-elevated-bg)] transition-colors ${filterOpen ? 'border-[var(--app-link)] text-[var(--app-link)]' : 'border-[var(--app-border)] text-[var(--app-hint)] hover:text-[var(--app-fg)]'}`}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                </button>
            </div>

            {/* Filter chips */}
            {filterOpen && (
                <div className="flex flex-wrap gap-2 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3">
                    {(['all', 'archived', 'unarchived'] as FilterMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setFilterMode(mode)}
                            className={`flex items-center gap-1.5 rounded-[20px] border px-3.5 py-2 text-[13px] font-medium transition-colors active:scale-95 ${
                                filterMode === mode
                                    ? 'border-[var(--app-link)] bg-[var(--app-link)] text-white'
                                    : 'border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-hint)] hover:bg-[var(--app-panel-muted-bg)]'
                            }`}
                        >
                            {mode === 'archived' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                                    <path d="M21 8v13H3V8" />
                                    <path d="M1 3h22v5H1z" />
                                    <path d="M10 12h4" />
                                </svg>
                            ) : mode === 'unarchived' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            ) : null}
                            {filterLabel(mode)}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats bar */}
            <div className="flex gap-4 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3">
                <div className="text-[12px] text-[var(--app-hint)]">
                    <strong className="font-semibold text-[var(--app-fg)]">{totalCount}</strong> {t('history.total')}
                </div>
                <div className="text-[12px] text-[var(--app-hint)]">
                    <strong className="font-semibold text-[var(--app-fg)]">{thisWeekCount}</strong> {t('history.thisWeek')}
                </div>
                <div className="text-[12px] text-[var(--app-hint)]">
                    <strong className="font-semibold text-[var(--app-fg)]">{avgDuration}</strong> {t('history.avgDuration')}
                </div>
            </div>

            {/* Content */}
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full px-4 py-4">
                    {error ? (
                        <div className="text-sm text-[var(--app-error)] p-4">{error}</div>
                    ) : isLoading ? (
                        <div className="space-y-3">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="border border-[var(--app-border)] rounded-[16px] bg-[var(--app-panel-bg)] p-3.5">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-[10px] bg-[linear-gradient(90deg,var(--app-subtle-bg)_25%,var(--app-panel-bg)_50%,var(--app-subtle-bg)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-[14px] w-[60%] rounded bg-[linear-gradient(90deg,var(--app-subtle-bg)_25%,var(--app-panel-bg)_50%,var(--app-subtle-bg)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
                                            <div className="h-[12px] w-[40%] rounded bg-[linear-gradient(90deg,var(--app-subtle-bg)_25%,var(--app-panel-bg)_50%,var(--app-subtle-bg)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : allSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--app-subtle-bg)]">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[var(--app-hint)]">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div className="text-[16px] font-medium text-[var(--app-fg)]">{t('history.empty')}</div>
                            <div className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-[var(--app-hint)]">{t('history.empty.description')}</div>
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center text-[var(--app-hint)]">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 opacity-50">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                            <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('history.noResults')}</div>
                            <div className="mt-1 text-[13px] text-[var(--app-hint)]">{t('history.noResults.description')}</div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {groups.map((group) => (
                                <div key={group.label}>
                                    <div className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)] mb-3 pl-1">
                                        {group.label}
                                    </div>
                                    <div className="space-y-2.5">
                                        {group.sessions.map((session) => (
                                            <HistorySessionItem
                                                key={session.id}
                                                session={session}
                                                api={api}
                                                searchInput={searchInput}
                                                onOpen={() => navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bottom padding for mobile tab bar */}
                    <div className="h-20 lg:h-4" />
                </div>
            </div>
        </div>
    )
}
