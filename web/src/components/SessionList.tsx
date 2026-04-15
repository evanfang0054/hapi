import { useEffect, useMemo, useState } from 'react'
import type { SessionSummary } from '@/types/api'
import type { ApiClient } from '@/api/client'
import type { BulkDeleteSummary } from '@/hooks/mutations/useSessionActions'
import { useLongPress } from '@/hooks/useLongPress'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { getSessionModelLabel } from '@/lib/sessionModelLabel'
import { useTranslation } from '@/lib/use-translation'

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
        ? (s.thinking ? 'bg-[#007AFF]' : 'bg-[var(--app-badge-success-text)]')
        : 'bg-[var(--app-hint)]'
    const todoProgress = getTodoProgress(s)
    const sessionContent = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-[15px] font-medium leading-5">
                            {sessionName}
                        </div>
                    </div>
                    {showPath ? (
                        <div className="truncate text-xs text-[var(--app-hint)]">
                            {s.metadata?.path ?? s.id}
                        </div>
                    ) : null}
                </div>
                <div className="shrink-0 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1 text-[11px] text-[var(--app-hint)]">
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
            <div className={`rounded-[var(--app-radius-control)] border transition-[background-color,border-color,box-shadow,transform] ${selected ? 'border-[var(--app-border)] bg-[var(--app-subtle-bg)] shadow-[var(--app-shadow-sm)]' : 'border-transparent bg-[var(--app-panel-elevated-bg)] hover:border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)]'}`}>
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
                            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
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
                            className="shrink-0 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-3 py-2 text-xs text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg)]"
                            onClick={(event) => {
                                event.stopPropagation()
                                const rect = event.currentTarget.getBoundingClientRect()
                                openActionMenu({
                                    x: rect.left + rect.width / 2,
                                    y: rect.bottom,
                                })
                            }}
                        >
                            <span aria-hidden="true">•••</span>
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
    const [bulkDeleteSummary, setBulkDeleteSummary] = useState<BulkDeleteSummary | null>(null)
    const { deleteSessions, isPending } = useSessionActions(api, selectedSessionId ?? null)
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
        setBulkDeleteSummary(null)
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
            setBulkDeleteSummary(summary)
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
        <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-3 pb-4 pt-4 md:px-5 md:pt-6">
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
                {bulkDeleteSummary ? (
                    <div className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3 shadow-[var(--app-shadow-sm)]">
                        <div className="text-sm font-medium">
                            Deleted {bulkDeleteSummary.successCount} session{bulkDeleteSummary.successCount === 1 ? '' : 's'}
                        </div>
                        {bulkDeleteSummary.failureCount > 0 ? (
                            <div className="mt-2 space-y-1 text-sm text-[var(--app-hint)]">
                                <div>{bulkDeleteSummary.failureCount} deletions failed</div>
                                {bulkDeleteSummary.failures.map((failure) => (
                                    <div key={`${failure.sessionId}-${failure.reason}`}>{failure.reason}</div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {selectionMode && !bulkDeleteOpen ? (
                    <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3 shadow-[var(--app-shadow-sm)]">
                        <Button type="button" variant="secondary" onClick={cancelSelectionMode}>
                            Cancel selection
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setBulkDeleteOpen(true)}
                            disabled={selectedIds.size === 0}
                        >
                            Delete selected
                        </Button>
                    </div>
                ) : null}
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
                                        <span className="font-semibold text-sm break-words min-w-0" title={group.directory}>
                                            {group.displayName}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-[var(--app-subtle-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-hint)]">
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
                                <ChevronIcon
                                    className="h-4 w-4 shrink-0 text-[var(--app-hint)]"
                                    collapsed={isCollapsed}
                                />
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
                title={`Delete ${selectedCount} sessions?`}
                description={`This will permanently delete ${selectedCount} selected session${selectedCount === 1 ? '' : 's'}.`}
                confirmLabel="Delete selected"
                confirmingLabel="Deleting selected"
                onConfirm={confirmBulkDelete}
                isPending={isPending}
                destructive
            />
        </div>
    )
}
