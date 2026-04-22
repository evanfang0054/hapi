import { useEffect, useMemo, useState } from 'react'
import type { SessionSummary } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { useLongPress } from '@/hooks/useLongPress'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { getSessionModelLabel } from '@/lib/sessionModelLabel'
import { useTranslation } from '@/lib/use-translation'
import { useToast } from '@/lib/toast-context'
import { useTheme, useAppearance } from '@/hooks/useTheme'

type SessionGroup = {
    key: string
    directory: string
    displayName: string
    machineId: string | null
    sessions: SessionSummary[]
    latestUpdatedAt: number
    hasActiveSession: boolean
}

function getGroupDisplayName(directory: string): string {
    if (directory === 'Other') return directory
    const parts = directory.split(/[\\/]+/).filter(Boolean)
    if (parts.length === 0) return directory
    if (parts.length === 1) return parts[0]
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

export const UNKNOWN_MACHINE_ID = '__unknown__'

function groupSessionsByDirectory(sessions: SessionSummary[]): SessionGroup[] {
    const groups = new Map<string, { directory: string; machineId: string | null; sessions: SessionSummary[] }>()

    sessions.forEach(session => {
        const path = session.metadata?.worktree?.basePath ?? session.metadata?.path ?? 'Other'
        const machineId = session.metadata?.machineId ?? null
        const key = `${machineId ?? UNKNOWN_MACHINE_ID}::${path}`
        if (!groups.has(key)) {
            groups.set(key, {
                directory: path,
                machineId,
                sessions: []
            })
        }
        groups.get(key)!.sessions.push(session)
    })

    return Array.from(groups.entries())
        .map(([key, group]) => {
            const sortedSessions = [...group.sessions].sort((a, b) => {
                const rankA = a.active ? (a.pendingRequestsCount > 0 ? 0 : 1) : 2
                const rankB = b.active ? (b.pendingRequestsCount > 0 ? 0 : 1) : 2
                if (rankA !== rankB) return rankA - rankB
                return b.updatedAt - a.updatedAt
            })
            const latestUpdatedAt = group.sessions.reduce(
                (max, s) => (s.updatedAt > max ? s.updatedAt : max),
                -Infinity
            )
            const hasActiveSession = group.sessions.some(s => s.active)
            const displayName = getGroupDisplayName(group.directory)

            return {
                key,
                directory: group.directory,
                displayName,
                machineId: group.machineId,
                sessions: sortedSessions,
                latestUpdatedAt,
                hasActiveSession
            }
        })
        .sort((a, b) => {
            if (a.hasActiveSession !== b.hasActiveSession) {
                return a.hasActiveSession ? -1 : 1
            }
            return b.latestUpdatedAt - a.latestUpdatedAt
        })
}

function PlusIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function BulbIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12c.6.6 1 1.2 1 2h6c0-.8.4-1.4 1-2a7 7 0 0 0-4-12Z" />
        </svg>
    )
}

function ChevronIcon(props: { className?: string; collapsed?: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${props.className ?? ''} transition-transform duration-200 ${props.collapsed ? '' : 'rotate-90'}`}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function getSessionTitle(session: SessionSummary): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        const parts = session.metadata.path.split('/').filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : session.id.slice(0, 8)
    }
    return session.id.slice(0, 8)
}

function getTodoProgress(session: SessionSummary): { completed: number; total: number } | null {
    if (!session.todoProgress) return null
    if (session.todoProgress.completed === session.todoProgress.total) return null
    return session.todoProgress
}

function getAgentLabel(session: SessionSummary): string {
    const flavor = session.metadata?.flavor?.trim()
    if (flavor) return flavor
    return 'unknown'
}

function MachineIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    )
}

function formatRelativeTime(value: number, t: (key: string, params?: Record<string, string | number>) => string): string | null {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    if (!Number.isFinite(ms)) return null
    const delta = Date.now() - ms
    if (delta < 60_000) return t('session.time.justNow')
    const minutes = Math.floor(delta / 60_000)
    if (minutes < 60) return t('session.time.minutesAgo', { n: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('session.time.hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('session.time.daysAgo', { n: days })
    return new Date(ms).toLocaleDateString()
}

function SessionItem(props: {
    session: SessionSummary
    onSelect: (sessionId: string) => void
    showPath?: boolean
    api: ApiClient | null
    selected?: boolean
    selectionMode?: boolean
    selectionChecked?: boolean
    onEnterSelectionMode?: (sessionId: string, active: boolean) => void
    onToggleSelected?: (sessionId: string, active: boolean) => void
}) {
    const { t } = useTranslation()
    const {
        session: s,
        onSelect,
        showPath = true,
        api,
        selected = false,
        selectionMode = false,
        selectionChecked = false,
        onEnterSelectionMode,
        onToggleSelected
    } = props
    const { haptic } = usePlatform()
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        s.id,
        s.metadata?.flavor ?? null
    )

    const openActionMenu = (point: { x: number; y: number }) => {
        setMenuAnchorPoint(point)
        setMenuOpen(true)
    }

    const longPressHandlers = useLongPress({
        onLongPress: (point) => {
            haptic.impact('medium')
            setMenuAnchorPoint(point)
            setMenuOpen(false)
            onEnterSelectionMode?.(s.id, s.active)
        },
        onClick: () => {
            if (selectionMode) {
                onToggleSelected?.(s.id, s.active)
                return
            }
            if (!menuOpen) {
                onSelect(s.id)
            }
        },
        threshold: 500
    })

    const sessionName = getSessionTitle(s)
    const modelLabel = getSessionModelLabel(s)
    const statusDotClass = s.active
        ? (s.thinking ? 'bg-[#007AFF] shadow-[0_0_8px_#007AFF]' : 'bg-[var(--app-badge-success-text)] shadow-[0_0_6px_var(--app-badge-success-text)]')
        : 'bg-[var(--app-hint)]'
    const todoProgress = getTodoProgress(s)
    const sessionContent = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-[15px] font-medium leading-5" style={{ fontFamily: 'var(--app-font-serif)', fontStyle: 'italic' }}>
                            {sessionName}
                        </div>
                    </div>
                    {showPath ? (
                        <div className="truncate text-xs text-[var(--app-hint)]">
                            {s.metadata?.path ?? s.id}
                        </div>
                    ) : null}
                </div>
                <div className="shrink-0 rounded-full bg-[var(--app-subtle-bg)] px-2.5 py-1 text-[11px] text-[var(--app-hint)]">
                    {formatRelativeTime(s.updatedAt, t)}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
                {s.thinking ? (
                    <span className="rounded-full border border-[var(--app-link)]/20 bg-[var(--app-link)]/10 px-2.5 py-1 text-[var(--app-link)] animate-pulse">
                        {t('session.item.thinking')}
                    </span>
                ) : null}
                {todoProgress ? (
                    <span className="flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1 text-[var(--app-hint)]">
                        <BulbIcon className="h-3 w-3" />
                        {todoProgress.completed}/{todoProgress.total}
                    </span>
                ) : null}
                {s.pendingRequestsCount > 0 ? (
                    <span className="rounded-full border border-[var(--app-badge-warning-border)] bg-[var(--app-badge-warning-bg)] px-2.5 py-1 text-[var(--app-badge-warning-text)]">
                        {t('session.item.pending')} {s.pendingRequestsCount}
                    </span>
                ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--app-hint)]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1">
                    <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
                        ❖
                    </span>
                    {getAgentLabel(s)}
                </span>
                {modelLabel ? (
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1">{t(modelLabel.key)}: {modelLabel.value}</span>
                ) : null}
                {s.metadata?.worktree?.branch ? (
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1">{t('session.item.worktree')}: {s.metadata.worktree.branch}</span>
                ) : null}
            </div>
        </>
    )
    return (
        <>
            <div className={`rounded-[var(--app-radius-control)] border transition-all duration-200 ${selected ? 'border-[var(--app-link)] shadow-[0_0_0_3px_rgba(201,100,66,0.12)]' : 'border-transparent bg-[var(--app-panel-elevated-bg)] hover:border-[var(--app-border)] hover:shadow-[var(--app-shadow-sm)] hover:-translate-y-px'}`}>
                <div className="flex items-start gap-3 px-4 py-4">
                    {selectionMode ? (
                        <input
                            type="checkbox"
                            aria-label={sessionName}
                            className="mt-1 shrink-0"
                            checked={selectionChecked}
                            disabled={s.active}
                            onClick={(event) => {
                                event.stopPropagation()
                            }}
                            onChange={(event) => {
                                event.stopPropagation()
                                onToggleSelected?.(s.id, s.active)
                            }}
                        />
                    ) : (
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
                        </span>
                    )}

                    {selectionMode ? (
                        <div className="session-list-item flex min-w-0 flex-1 flex-col gap-3 select-none">
                            {sessionContent}
                        </div>
                    ) : (
                        <button
                            type="button"
                            {...longPressHandlers}
                            onContextMenu={(event) => {
                                event.preventDefault()
                                if (selectionMode) return
                                openActionMenu({ x: event.clientX, y: event.clientY })
                            }}
                            className="session-list-item flex min-w-0 flex-1 flex-col gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg)] select-none"
                            style={{ WebkitTouchCallout: 'none' }}
                            aria-current={selected ? 'page' : undefined}
                        >
                            {sessionContent}
                        </button>
                    )}

                    {!selectionMode ? (
                        <button
                            type="button"
                            aria-label={t('session.more')}
                            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-[8px] text-xs text-[var(--app-hint)] transition-colors active:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]"
                            onClick={(event) => {
                                event.stopPropagation()
                                const rect = event.currentTarget.getBoundingClientRect()
                                openActionMenu({
                                    x: rect.left + rect.width / 2,
                                    y: rect.bottom,
                                })
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="19" r="1" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            </div>

            <SessionActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                sessionActive={s.active}
                onRename={() => setRenameOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                onDelete={() => setDeleteOpen(true)}
                onSelectMultiple={() => onEnterSelectionMode?.(s.id, s.active)}
                anchorPoint={menuAnchorPoint}
            />

            <RenameSessionDialog
                isOpen={renameOpen}
                onClose={() => setRenameOpen(false)}
                currentName={sessionName}
                onRename={renameSession}
                isPending={isPending}
            />

            <ConfirmDialog
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title={t('dialog.archive.title')}
                description={t('dialog.archive.description', { name: sessionName })}
                confirmLabel={t('dialog.archive.confirm')}
                confirmingLabel={t('dialog.archive.confirming')}
                onConfirm={archiveSession}
                isPending={isPending}
                destructive
            />

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={t('dialog.delete.title')}
                description={t('dialog.delete.description', { name: sessionName })}
                confirmLabel={t('dialog.delete.confirm')}
                confirmingLabel={t('dialog.delete.confirming')}
                onConfirm={deleteSession}
                isPending={isPending}
                destructive
            />
        </>
    )
}

export function SessionList(props: {
    sessions: SessionSummary[]
    onSelect: (sessionId: string) => void
    onNewSession: () => void
    onRefresh: () => void
    isLoading: boolean
    renderHeader?: boolean
    api: ApiClient | null
    machineLabelsById?: Record<string, string>
    selectedSessionId?: string | null
}) {
    const { t } = useTranslation()
    const { isDark } = useTheme()
    const { setAppearance } = useAppearance()
    const { renderHeader = true, api, selectedSessionId, machineLabelsById = {} } = props
    const groups = useMemo(
        () => groupSessionsByDirectory(props.sessions),
        [props.sessions]
    )
    const [collapseOverrides, setCollapseOverrides] = useState<Map<string, boolean>>(
        () => new Map()
    )
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
    const { deleteSessions, isPending } = useSessionActions(api, selectedSessionId ?? null)
    const { addToast } = useToast()
    const selectedCount = selectedIds.size
    const isGroupCollapsed = (group: SessionGroup): boolean => {
        const override = collapseOverrides.get(group.key)
        if (override !== undefined) return override
        const hasSelectedSession = selectedSessionId
            ? group.sessions.some(session => session.id === selectedSessionId)
            : false
        return !group.hasActiveSession && !hasSelectedSession
    }

    const toggleGroup = (groupKey: string, isCollapsed: boolean) => {
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(groupKey, !isCollapsed)
            return next
        })
    }

    const enterSelectionMode = (sessionId: string, active: boolean) => {
        setSelectionMode(true)
        setSelectedIds(active ? new Set() : new Set([sessionId]))
        setBulkDeleteOpen(false)
    }

    const toggleSelected = (sessionId: string, active: boolean) => {
        if (active) return
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(sessionId)) {
                next.delete(sessionId)
            } else {
                next.add(sessionId)
            }
            return next
        })
    }

    const cancelSelectionMode = () => {
        setSelectionMode(false)
        setSelectedIds(new Set())
        setBulkDeleteOpen(false)
    }

    const confirmBulkDelete = async () => {
        const sessionIds = Array.from(selectedIds)
        setBulkDeleteOpen(false)
        try {
            const summary = await deleteSessions(sessionIds)
            setSelectionMode(false)
            setSelectedIds(new Set())
            const title = t('selection.deleted', { n: summary.successCount })
            const body = summary.failureCount > 0
                ? t('selection.failureCount', { n: summary.failureCount })
                : ''
            addToast({ title, body })
        } catch {
            // Keep selection state so the user can retry.
        }
    }

    const resolveMachineLabel = (machineId: string | null): string => {
        if (machineId && machineLabelsById[machineId]) {
            return machineLabelsById[machineId]
        }
        if (machineId) {
            return machineId.slice(0, 8)
        }
        return t('machine.unknown')
    }

    useEffect(() => {
        if (!selectedSessionId) return
        setCollapseOverrides(prev => {
            const group = groups.find(g =>
                g.sessions.some(s => s.id === selectedSessionId)
            )
            if (!group || !prev.has(group.key) || !prev.get(group.key)) return prev
            const next = new Map(prev)
            next.delete(group.key)
            return next
        })
    }, [selectedSessionId, groups])

    useEffect(() => {
        const sessionIds = new Set(props.sessions.map(session => session.id))
        setSelectedIds(prev => {
            if (prev.size === 0) return prev
            const next = new Set(Array.from(prev).filter(sessionId => sessionIds.has(sessionId)))
            return next.size === prev.size ? prev : next
        })
    }, [props.sessions])

    useEffect(() => {
        if (!selectionMode || props.sessions.length > 0) return
        setSelectionMode(false)
        setBulkDeleteOpen(false)
    }, [selectionMode, props.sessions.length])

    useEffect(() => {
        setCollapseOverrides(prev => {
            if (prev.size === 0) return prev
            const next = new Map(prev)
            const knownGroups = new Set(groups.map(group => group.key))
            let changed = false
            for (const groupKey of next.keys()) {
                if (!knownGroups.has(groupKey)) {
                    next.delete(groupKey)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [groups])

    return (
        <div className={`mx-auto flex w-full max-w-content flex-col gap-4 px-3 pt-4 md:px-5 md:pt-6 ${selectionMode ? 'pb-24' : 'pb-4'}`}>
            {/* Mobile theme toggle */}
            <button
                type="button"
                onClick={() => setAppearance(isDark ? 'light' : 'dark')}
                className="fixed top-[calc(16px+env(safe-area-inset-top))] right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--app-panel-elevated-bg)] border border-[var(--app-border)] shadow-[var(--app-shadow-sm)] text-[var(--app-hint)] hover:text-[var(--app-fg)] transition-all lg:hidden"
                aria-label={isDark ? 'Light mode' : 'Dark mode'}
            >
                {isDark ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                )}
            </button>
            {renderHeader ? (
                <div className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-5 py-5 shadow-[var(--app-shadow-sm)]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-hint)]">
                                Workspace
                            </p>
                            <h1 className="text-3xl leading-none" data-ui-heading="serif">
                                hapi
                            </h1>
                            <p className="max-w-2xl text-sm leading-6 text-[var(--app-hint)]">
                                {t('sessions.count', { n: props.sessions.length, m: groups.length })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" onClick={props.onRefresh}>
                                Refresh
                            </Button>
                            <Button type="button" onClick={props.onNewSession}>
                                New session
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="flex flex-col gap-4">
                {groups.length === 0 ? (
                    <div className="rounded-[var(--app-radius-panel)] border border-dashed border-[var(--app-border)] bg-[var(--app-panel-bg)] px-6 py-10 text-center shadow-[var(--app-shadow-sm)]">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-subtle-bg)] text-[var(--app-link)]">
                            <PlusIcon className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl" data-ui-heading="serif">
                            Start a new workspace
                        </h2>
                        <p className="mt-2 text-sm text-[var(--app-hint)]">
                            当前没有 session，但创建入口、说明和主 CTA 都保持清晰。
                        </p>
                        <Button type="button" className="mt-5" onClick={props.onNewSession}>
                            New session
                        </Button>
                    </div>
                ) : null}
                {groups.map((group) => {
                    const isCollapsed = isGroupCollapsed(group)
                    const machineLabel = resolveMachineLabel(group.machineId)
                    return (
                        <div
                            key={group.key}
                            className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-2 shadow-[var(--app-shadow-sm)]"
                        >
                            <button
                                type="button"
                                onClick={() => toggleGroup(group.key, isCollapsed)}
                                className="flex w-full items-center justify-between gap-4 rounded-[var(--app-radius-control)] px-4 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
                            >
                                <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="font-semibold text-sm break-words min-w-0" title={group.directory} style={{ fontFamily: 'var(--app-font-serif)' }}>
                                            {group.displayName}
                                        </span>
                                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: 'var(--app-link)' }}>
                                            {group.sessions.length}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--app-hint)]">
                                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-0.5">
                                            <MachineIcon className="h-3 w-3 shrink-0" />
                                            {machineLabel}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate" title={group.directory}>
                                            {group.directory}
                                        </span>
                                        <span>{formatRelativeTime(group.latestUpdatedAt, t)}</span>
                                    </div>
                                </div>
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-subtle-bg)]">
                                    <ChevronIcon
                                        className="h-4 w-4 text-[var(--app-hint)]"
                                        collapsed={isCollapsed}
                                    />
                                </span>
                            </button>
                            {!isCollapsed ? (
                                <div className="mt-2 space-y-2">
                                    {group.sessions.map((s) => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            onSelect={props.onSelect}
                                            showPath={false}
                                            api={api}
                                            selected={s.id === selectedSessionId}
                                            selectionMode={selectionMode}
                                            selectionChecked={selectedIds.has(s.id)}
                                            onEnterSelectionMode={enterSelectionMode}
                                            onToggleSelected={toggleSelected}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )
                })}
            </div>

            <ConfirmDialog
                isOpen={bulkDeleteOpen}
                onClose={() => setBulkDeleteOpen(false)}
                title={t('dialog.bulkDelete.title', { n: selectedCount })}
                description={t('dialog.bulkDelete.description', { n: selectedCount })}
                confirmLabel={t('dialog.bulkDelete.confirm')}
                confirmingLabel={t('dialog.bulkDelete.confirming')}
                onConfirm={confirmBulkDelete}
                isPending={isPending}
                destructive
            />

            {selectionMode && !bulkDeleteOpen ? (
                <div className="fixed left-1/2 z-50 -translate-x-1/2 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] lg:bottom-4 animate-batch-bar-in" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-[var(--app-fg)]">
                            {selectedCount}
                        </span>
                        <span className="text-sm text-[var(--app-hint)]">
                            {t('selection.selected', { n: selectedCount })}
                        </span>
                        <span className="h-5 w-px bg-[var(--app-border)]" />
                        <button
                            type="button"
                            className="rounded-[8px] px-3 py-1.5 text-xs font-medium text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                            onClick={cancelSelectionMode}
                            aria-label={t('button.cancel')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                                const ids = Array.from(selectedIds)
                                for (const id of ids) {
                                    try { await api?.archiveSession(id) } catch { /* skip */ }
                                }
                                cancelSelectionMode()
                            }}
                            disabled={selectedIds.size === 0}
                        >
                            {t('session.action.archive')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setBulkDeleteOpen(true)}
                            disabled={selectedIds.size === 0}
                        >
                            {t('dialog.delete.confirm')}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
