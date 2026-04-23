import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useSessions } from '@/hooks/queries/useSessions'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { useTranslation } from '@/lib/use-translation'

type FilterMode = 'all' | 'archived' | 'deleted'

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
    return <>{before}<mark className="bg-[rgba(201,100,66,0.2)] text-[var(--app-fg)] rounded-[2px] px-[2px] bg-no-repeat">{match}</mark>{highlightText(after, q)}</>
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

    // Close actions when clicking outside
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

    const confirmAndAct = useCallback((message: string, action: () => Promise<void>) => {
        if (window.confirm(message)) {
            handleAction(action)
        }
    }, [handleAction])

    // Determine status
    const status: 'normal' | 'archived' | 'deleted' = session.deleted ? 'deleted' : session.archived ? 'archived' : 'normal'

    return (
        <div
            ref={itemRef}
            className={`border rounded-[16px] bg-[var(--app-panel-elevated-bg)] p-3.5 transition-all cursor-pointer ${actionsOpen ? 'border-[var(--app-link)] shadow-[var(--app-shadow-sm)]' : 'border-[var(--app-border)] hover:border-[var(--app-link)] hover:shadow-[var(--app-shadow-sm)]'}`}
        >
            <div className="flex items-start gap-3" onClick={() => setActionsOpen(!actionsOpen)}>
                {/* Icon */}
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${session.archived ? 'bg-[var(--app-border)]' : 'bg-[var(--app-subtle-bg)]'}`}>
                    {status === 'deleted' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[var(--app-hint)]">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    ) : session.archived ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[var(--app-hint)]">
                            <path d="M21 8v13H3V8" />
                            <path d="M1 3h22v5H1z" />
                            <path d="M10 12h4" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[var(--app-hint)]">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[var(--app-fg)] truncate cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onOpen() }}>{highlightText(session.name, searchInput)}</div>
                    {(session.summary || session.projectPath) && (
                        <div className="text-[12px] text-[var(--app-hint)] line-clamp-2 mt-1 leading-[1.4]">
                            {highlightText(session.summary || session.projectPath || '', searchInput)}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-[var(--app-hint)] mt-2 font-mono">
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                        {session.archived && !session.deleted && (
                            <span className="ml-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-[var(--app-border)]">Archived</span>
                        )}
                        {session.deleted && (
                            <span className="ml-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-[rgba(181,51,51,0.08)] text-[var(--app-error)]">Deleted</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-2 ml-[52px]">
                {!actionsOpen ? (
                    <button
                        type="button"
                        onClick={() => setActionsOpen(true)}
                        className="text-[12px] text-[var(--app-hint)] hover:text-[var(--app-fg)] transition-colors"
                    >
                        ···
                    </button>
                ) : (
                    <div className="flex items-center gap-2 animate-[fadeIn_0.15s_ease]">
                        {status === 'normal' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleAction(async () => onOpen())}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[16px] text-[12px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] hover:bg-[var(--app-panel-muted-bg)] transition-colors active:scale-95"
                                >
                                    {t('history.open')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmAndAct(`Archive "${session.name}"?`, archiveSession)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[16px] text-[12px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] hover:bg-[var(--app-panel-muted-bg)] transition-colors active:scale-95"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                                    {t('history.archive')}
                                </button>
                            </>
                        )}
                        {status === 'archived' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { /* TODO: implement restoreSession mutation */ }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[16px] text-[12px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] hover:bg-[var(--app-panel-muted-bg)] transition-colors active:scale-95"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                    {t('history.restore')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmAndAct(`Delete "${session.name}"? This action cannot be undone.`, deleteSession)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[16px] text-[12px] border border-[rgba(181,51,51,0.3)] bg-transparent text-[var(--app-error)] hover:bg-[rgba(181,51,51,0.08)] transition-colors active:scale-95"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    {t('history.delete')}
                                </button>
                            </>
                        )}
                        {status === 'deleted' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { /* TODO: implement restoreSession mutation */ }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[16px] text-[12px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] hover:bg-[var(--app-panel-muted-bg)] transition-colors active:scale-95"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                                    {t('history.restore')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmAndAct(`Permanently delete "${session.name}"? This action cannot be undone.`, deleteSession)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-[16px] text-[12px] border border-[rgba(181,51,51,0.3)] bg-transparent text-[var(--app-error)] hover:bg-[rgba(181,51,51,0.08)] transition-colors active:scale-95"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    {t('history.permanentDelete')}
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => setActionsOpen(false)}
                            className="text-[12px] text-[var(--app-hint)] hover:text-[var(--app-fg)] transition-colors ml-1"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>
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
        name: s.metadata?.name ?? s.id.slice(0, 8),
        agent: s.metadata?.flavor ?? 'claude',
        model: s.model ?? null,
        active: s.active ?? false,
        updatedAt: s.updatedAt ?? 0,
        projectPath: s.metadata?.path ?? s.metadata?.worktree?.basePath ?? null,
        summary: s.metadata?.summary?.text ?? null,
        archived: (s.metadata as Record<string, unknown>)?.archived === true,
        deleted: (s.metadata as Record<string, unknown>)?.deleted === true,
    })), [sessions])

    const filteredSessions = useMemo(() => {
        let result = allSessions
        if (filterMode === 'archived') {
            result = result.filter(s => s.archived && !s.deleted)
        } else if (filterMode === 'deleted') {
            result = result.filter(s => s.deleted)
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
        return t('history.filter.deleted')
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
            <div className="px-4 py-3 border-b border-[var(--app-border)] flex gap-2.5">
                <div className="relative flex-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--app-hint)]">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('history.search')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:border-[var(--app-link)] transition-colors"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setFilterOpen(!filterOpen)}
                    className={`flex items-center justify-center w-11 h-11 rounded-[12px] border transition-colors ${filterOpen ? 'border-[var(--app-link)] text-[var(--app-link)]' : 'border-[var(--app-border)] text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)]'}`}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                </button>
            </div>

            {/* Filter chips */}
            {filterOpen && (
                <div className="px-4 py-3 border-b border-[var(--app-border)] flex gap-2 flex-wrap">
                    {(['all', 'archived', 'deleted'] as FilterMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setFilterMode(mode)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[20px] text-[13px] font-medium transition-colors active:scale-95 ${
                                filterMode === mode
                                    ? 'bg-[var(--app-link)] text-white border border-[var(--app-link)]'
                                    : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)] border border-[var(--app-border)] hover:bg-[var(--app-panel-muted-bg)]'
                            }`}
                        >
                            {mode === 'archived' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                    <path d="M21 8v13H3V8" />
                                    <path d="M1 3h22v5H1z" />
                                    <path d="M10 12h4" />
                                </svg>
                            ) : mode === 'deleted' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            ) : null}
                            {filterLabel(mode)}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats bar */}
            {totalCount > 0 && (
                <div className="px-4 py-3 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex gap-4">
                    <div className="text-[12px] text-[var(--app-hint)]">
                        <strong className="text-[var(--app-fg)] font-semibold">{totalCount}</strong> {t('history.total')}
                    </div>
                    <div className="text-[12px] text-[var(--app-hint)]">
                        <strong className="text-[var(--app-fg)] font-semibold">{thisWeekCount}</strong> {t('history.thisWeek')}
                    </div>
                    <div className="text-[12px] text-[var(--app-hint)]">
                        <strong className="text-[var(--app-fg)] font-semibold">{avgDuration}</strong> {t('history.avgDuration')}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full px-4 py-5">
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
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-[var(--app-subtle-bg)] flex items-center justify-center mb-4">
                                {filterMode === 'archived' ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                        <path d="M21 8v13H3V8" />
                                        <path d="M1 3h22v5H1z" />
                                        <path d="M10 12h4" />
                                    </svg>
                                ) : filterMode === 'deleted' ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                ) : searchInput ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                )}
                            </div>
                            <div className="text-[16px] font-medium text-[var(--app-fg)]">
                                {filterMode === 'archived' ? t('history.noArchived') : filterMode === 'deleted' ? t('history.noDeleted') : searchInput ? t('history.noResults') : t('history.empty')}
                            </div>
                            <div className="text-[13px] text-[var(--app-hint)] mt-2 max-w-[280px] leading-relaxed">
                                {filterMode === 'archived' ? t('history.noArchived.description') : filterMode === 'deleted' ? t('history.noDeleted.description') : searchInput ? t('history.noResults.description') : t('history.empty.description')}
                            </div>
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
