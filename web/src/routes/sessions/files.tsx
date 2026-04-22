import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { FileSearchItem, GitFileStatus } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { DirectoryTree } from '@/components/SessionFiles/DirectoryTree'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useGitStatusFiles } from '@/hooks/queries/useGitStatusFiles'
import { useSession } from '@/hooks/queries/useSession'
import { useSessionFileSearch } from '@/hooks/queries/useSessionFileSearch'
import { encodeBase64 } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { useQueryClient } from '@tanstack/react-query'

function BackIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function RefreshIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 3 21 9 15 9" />
        </svg>
    )
}

function SearchIcon(props: { className?: string }) {
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
            className={props.className}
        >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    )
}

function GitBranchIcon(props: { className?: string }) {
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
            className={props.className}
        >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
    )
}

function PlusIcon(props: { className?: string }) {
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function MinusIcon(props: { className?: string }) {
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
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function UndoIcon(props: { className?: string }) {
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
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
    )
}

function FolderIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    )
}

function StatusBadge(props: { status: GitFileStatus['status'] }) {
    const { label, color } = useMemo(() => {
        switch (props.status) {
            case 'added':
                return { label: 'A', color: 'var(--app-git-staged-color)' }
            case 'deleted':
                return { label: 'D', color: 'var(--app-git-deleted-color)' }
            case 'renamed':
                return { label: 'R', color: 'var(--app-git-renamed-color)' }
            case 'untracked':
                return { label: '?', color: 'var(--app-git-untracked-color)' }
            case 'conflicted':
                return { label: 'U', color: 'var(--app-git-deleted-color)' }
            default:
                return { label: 'M', color: 'var(--app-git-unstaged-color)' }
        }
    }, [props.status])

    return (
        <span
            className="inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color, borderColor: color }}
        >
            {label}
        </span>
    )
}

function LineChanges(props: { added: number; removed: number }) {
    if (!props.added && !props.removed) return null

    return (
        <span className="flex items-center gap-1 text-[11px] font-mono">
            {props.added ? (
                <span className="text-[var(--app-diff-added-text)]">+{props.added}</span>
            ) : null}
            {props.removed ? (
                <span className="text-[var(--app-diff-removed-text)]">-{props.removed}</span>
            ) : null}
        </span>
    )
}

function GitFileRow(props: {
    file: GitFileStatus
    onOpen: () => void
    onStage?: () => void
    onUnstage?: () => void
    onDiscard?: () => void
    onClean?: () => void
    onRequestConfirm?: (action: () => void, type: 'discard' | 'delete') => void
    showDivider: boolean
    projectRootLabel: string
    actionLoading?: boolean
}) {
    const { t } = useTranslation()
    const subtitle = props.file.filePath || props.projectRootLabel

    const handleAction = (e: React.MouseEvent, action: (() => void) | undefined, confirmType?: 'discard' | 'delete') => {
        e.stopPropagation()
        if (!action) return
        if (confirmType && props.onRequestConfirm) {
            props.onRequestConfirm(action, confirmType)
            return
        }
        action()
    }

    return (
        <div
            className={`flex w-full items-center gap-3 px-3 py-2 hover:bg-[var(--app-subtle-bg)] transition-colors ${props.showDivider ? 'border-b border-[var(--app-divider)]' : ''}`}
        >
            <button
                type="button"
                onClick={props.onOpen}
                className="flex flex-1 items-center gap-3 text-left min-w-0"
            >
                <FileIcon fileName={props.file.fileName} size={22} />
                <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{props.file.fileName}</div>
                    <div className="truncate text-xs text-[var(--app-hint)]">{subtitle}</div>
                </div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
                <LineChanges added={props.file.linesAdded} removed={props.file.linesRemoved} />
                <StatusBadge status={props.file.status} />
                <div className="flex items-center gap-1 ml-2">
                    {props.file.isStaged ? (
                        <button
                            type="button"
                            onClick={(e) => handleAction(e, props.onUnstage)}
                            disabled={props.actionLoading}
                            className="p-1.5 rounded hover:bg-[var(--app-panel-muted-bg)] text-[var(--app-hint)] hover:text-[var(--app-fg)] transition-colors disabled:opacity-50"
                            title={t('sessionFiles.action.unstage')}
                        >
                            <MinusIcon />
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={(e) => handleAction(e, props.onStage)}
                                disabled={props.actionLoading}
                                className="p-1.5 rounded hover:bg-[var(--app-panel-muted-bg)] text-[var(--app-hint)] hover:text-[var(--app-fg)] transition-colors disabled:opacity-50"
                                title={t('sessionFiles.action.stage')}
                            >
                                <PlusIcon />
                            </button>
                            {props.file.status === 'untracked' ? (
                                <button
                                    type="button"
                                    onClick={(e) => handleAction(e, props.onClean, 'delete')}
                                    disabled={props.actionLoading}
                                    className="p-1.5 rounded hover:bg-[var(--app-panel-muted-bg)] text-[var(--app-hint)] hover:text-[var(--app-git-deleted-color)] transition-colors disabled:opacity-50"
                                >
                                    <UndoIcon />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => handleAction(e, props.onDiscard, 'discard')}
                                    disabled={props.actionLoading}
                                    className="p-1.5 rounded hover:bg-[var(--app-panel-muted-bg)] text-[var(--app-hint)] hover:text-[var(--app-git-deleted-color)] transition-colors disabled:opacity-50"
                                >
                                    <UndoIcon />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function HighlightedText(props: { text: string; query: string }) {
    if (!props.query) {
        return <>{props.text}</>
    }
    const escaped = props.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = props.text.split(new RegExp(`(${escaped})`, 'gi'))
    return (
        <>
            {parts.map((part, i) => {
                const isMatch = part.toLowerCase() === props.query.toLowerCase() && part.length > 0
                return isMatch
                    ? <span key={i} className="rounded-sm bg-[rgba(201,100,66,0.2)] px-0.5 text-[var(--app-fg)]">{part}</span>
                    : <span key={i}>{part}</span>
            })}
        </>
    )
}

function SearchResultRow(props: {
    file: FileSearchItem
    onOpen: () => void
    showDivider: boolean
    projectRootLabel: string
    searchQuery: string
}) {
    const subtitle = props.file.filePath || props.projectRootLabel
    const icon = props.file.fileType === 'file'
        ? <FileIcon fileName={props.file.fileName} size={22} />
        : <FolderIcon className="text-[var(--app-link)]" />

    return (
        <button
            type="button"
            onClick={props.onOpen}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--app-subtle-bg)] transition-colors ${props.showDivider ? 'border-b border-[var(--app-divider)]' : ''}`}
        >
            {icon}
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                    <HighlightedText text={props.file.fileName} query={props.searchQuery} />
                </div>
                <div className="truncate text-xs text-[var(--app-hint)]">{subtitle}</div>
            </div>
        </button>
    )
}

function FileListSkeleton(props: { label: string; rows?: number }) {
    const titleWidths = ['w-1/3', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5']
    const subtitleWidths = ['w-1/2', 'w-2/3', 'w-3/4', 'w-1/3']
    const rows = props.rows ?? 6

    return (
        <div className="p-3 animate-pulse space-y-3" role="status" aria-live="polite">
            <span className="sr-only">{props.label}</span>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={`skeleton-row-${index}`} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded bg-[var(--app-subtle-bg)]" />
                    <div className="flex-1 space-y-2">
                        <div className={`h-3 ${titleWidths[index % titleWidths.length]} rounded bg-[var(--app-subtle-bg)]`} />
                        <div className={`h-2 ${subtitleWidths[index % subtitleWidths.length]} rounded bg-[var(--app-subtle-bg)]`} />
                    </div>
                </div>
            ))}
        </div>
    )
}



export default function FilesPage() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const goBack = useAppGoBack()
    const { sessionId } = useParams({ from: '/sessions/$sessionId/files' })
    const search = useSearch({ from: '/sessions/$sessionId/files' })
    const { session } = useSession(api, sessionId)
    const [searchQuery, setSearchQuery] = useState('')
    const [actionLoading, setActionLoading] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        type: 'discard' | 'delete' | 'discardAll'
        onConfirm: () => Promise<void>
    }>({ isOpen: false, type: 'discard', onConfirm: async () => {} })

    const initialTab = search.tab === 'directories' ? 'directories' : 'changes'
    const [activeTab, setActiveTab] = useState<'changes' | 'directories'>(initialTab)

    const {
        status: gitStatus,
        error: gitError,
        isLoading: gitLoading,
        isFetching: gitFetching,
        refetch: refetchGit
    } = useGitStatusFiles(api, sessionId)

    const shouldSearch = Boolean(searchQuery)

    const searchResults = useSessionFileSearch(api, sessionId, searchQuery, {
        enabled: shouldSearch
    })

    const handleOpenFile = useCallback((path: string, staged?: boolean) => {
        const fileSearch = staged === undefined
            ? (activeTab === 'directories'
                ? { path: encodeBase64(path), tab: 'directories' as const }
                : { path: encodeBase64(path) })
            : (activeTab === 'directories'
                ? { path: encodeBase64(path), staged, tab: 'directories' as const }
                : { path: encodeBase64(path), staged })
        navigate({
            to: '/sessions/$sessionId/file',
            params: { sessionId },
            search: fileSearch
        })
    }, [activeTab, navigate, sessionId])

    const branchLabel = gitStatus?.branch ?? t('sessionFiles.detached')
    const subtitle = session?.metadata?.path ?? sessionId
    const showGitErrorBanner = Boolean(gitError)
    const rootLabel = useMemo(() => {
        const base = session?.metadata?.path ?? sessionId
        const parts = base.split(/[/\\]/).filter(Boolean)
        return parts.length ? parts[parts.length - 1] : base
    }, [session?.metadata?.path, sessionId])

    const handleRefresh = useCallback(() => {
        if (searchQuery) {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.sessionFiles(sessionId, searchQuery)
            })
            return
        }

        if (activeTab === 'directories') {
            void queryClient.invalidateQueries({
                queryKey: ['session-directory', sessionId]
            })
            return
        }

        void refetchGit()
    }, [activeTab, queryClient, refetchGit, searchQuery, sessionId])

    const handleTabChange = useCallback((nextTab: 'changes' | 'directories') => {
        setActiveTab(nextTab)
        navigate({
            to: '/sessions/$sessionId/files',
            params: { sessionId },
            search: nextTab === 'changes' ? {} : { tab: nextTab },
            replace: true,
        })
    }, [navigate, sessionId])

    const handleGitAction = useCallback(async (action: 'stage' | 'unstage' | 'discard' | 'clean', filePath: string) => {
        setActionLoading(true)
        try {
            let result
            if (action === 'stage') {
                result = await api.gitStage(sessionId, filePath)
            } else if (action === 'unstage') {
                result = await api.gitUnstage(sessionId, filePath)
            } else if (action === 'clean') {
                result = await api.gitCleanFile(sessionId, filePath)
            } else {
                result = await api.gitDiscard(sessionId, filePath)
            }
            if (!result.success) {
                console.error('Git action failed:', result.error || result.stderr)
            }
            await refetchGit()
        } catch (err) {
            console.error('Git action error:', err)
        } finally {
            setActionLoading(false)
        }
    }, [api, sessionId, refetchGit])

    const handleRequestConfirm = useCallback((action: () => void, type: 'discard' | 'delete') => {
        setConfirmDialog({
            isOpen: true,
            type,
            onConfirm: async () => {
                await action()
            }
        })
    }, [])

    const handleGitBulkAction = useCallback(async (action: 'stageAll' | 'unstageAll' | 'discardAll') => {
        const executeAction = async () => {
            setActionLoading(true)
            try {
                let result
                if (action === 'stageAll') {
                    result = await api.gitStageAll(sessionId)
                } else if (action === 'unstageAll') {
                    result = await api.gitUnstageAll(sessionId)
                } else {
                    result = await api.gitDiscardAll(sessionId)
                }
                if (!result.success) {
                    console.error('Git bulk action failed:', result.error || result.stderr)
                }
                await refetchGit()
            } catch (err) {
                console.error('Git bulk action error:', err)
            } finally {
                setActionLoading(false)
            }
        }

        if (action === 'discardAll') {
            setConfirmDialog({
                isOpen: true,
                type: 'discardAll',
                onConfirm: executeAction
            })
            return
        }

        await executeAction()
    }, [api, sessionId, refetchGit])

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-content px-2 py-2 md:px-3 md:py-3">
                    <div className="space-y-4">
                        <Card className="overflow-hidden border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)]">
                            <CardHeader className="gap-4 border-b border-[var(--app-border)] px-5 py-5 sm:px-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={goBack}
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]"
                                            >
                                                <BackIcon />
                                            </button>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]">
                                                    {t('sessionFiles.repository')}
                                                </p>
                                                <CardTitle className="mt-2 text-3xl leading-none" data-ui-heading="serif">
                                                    {t('sessionFiles.title')}
                                                </CardTitle>
                                            </div>
                                        </div>
                                        <CardDescription className="max-w-3xl text-sm leading-6 text-[var(--app-hint)]">
                                            {t('sessionFiles.description')}
                                        </CardDescription>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--app-hint)]">
                                            <span className="truncate">{subtitle}</span>
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-1 text-[var(--app-fg)]">
                                                <GitBranchIcon className="h-3.5 w-3.5 text-[var(--app-hint)]" />
                                                <span className="font-medium">{branchLabel}</span>
                                            </span>
                                            {!gitLoading && gitStatus && !searchQuery && activeTab === 'changes' ? (
                                                <span>
                                                    {t('sessionFiles.stats', { staged: gitStatus.totalStaged, unstaged: gitStatus.totalUnstaged })}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex w-full flex-col gap-3 md:max-w-sm md:items-end">
                                        <button
                                            type="button"
                                            onClick={handleRefresh}
                                            disabled={gitFetching}
                                            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 text-sm text-[var(--app-fg)] transition-colors hover:bg-[var(--app-panel-muted-bg)] disabled:opacity-70 md:self-end"
                                            title={t('sessionFiles.refresh')}
                                        >
                                            <RefreshIcon className={`h-4 w-4 text-[var(--app-hint)] ${gitFetching ? 'animate-spin' : ''}`} />
                                            <span>{t('sessionFiles.refresh')}</span>
                                        </button>
                                        <div className="flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-3 shadow-[var(--app-shadow-sm)]">
                                            <SearchIcon className="shrink-0 text-[var(--app-hint)]" />
                                            <input
                                                value={searchQuery}
                                                onChange={(event) => setSearchQuery(event.target.value)}
                                                placeholder={t('sessionFiles.searchPlaceholder')}
                                                className="w-full bg-transparent text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none"
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2" role="tablist">
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'changes'}
                                        onClick={() => handleTabChange('changes')}
                                        className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'changes'
                                            ? 'border-[var(--app-link)] bg-[color:color-mix(in_srgb,var(--app-link)_12%,transparent)] text-[var(--app-fg)]'
                                            : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]'}`}
                                    >
                                        {t('sessionFiles.tab.changes')}
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === 'directories'}
                                        onClick={() => handleTabChange('directories')}
                                        className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'directories'
                                            ? 'border-[var(--app-link)] bg-[color:color-mix(in_srgb,var(--app-link)_12%,transparent)] text-[var(--app-fg)]'
                                            : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]'}`}
                                    >
                                        {t('sessionFiles.tab.directories')}
                                    </button>
                                </div>
                            </CardHeader>

                            <CardContent className="px-0 py-0">
                                {showGitErrorBanner && activeTab === 'changes' ? (
                                    <div>
                                        <div className="flex items-center gap-3 border-b border-[var(--app-divider)] px-5 py-3 text-sm text-[var(--app-danger)] sm:px-6" style={{ background: 'color-mix(in srgb, var(--app-danger) 12%, transparent)' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            <span className="flex-1 min-w-0">{gitError}</span>
                                            <button
                                                type="button"
                                                onClick={() => void refetchGit()}
                                                className="shrink-0 rounded-lg border border-[var(--app-danger)] px-3 py-1 text-xs font-medium text-[var(--app-danger)] transition-colors hover:bg-[var(--app-danger)] hover:text-white"
                                            >
                                                {t('sessionFiles.retry')}
                                            </button>
                                        </div>
                                        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--app-subtle-bg)]">
                                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-hint)]">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                            </div>
                                            <div className="font-serif text-lg font-medium" data-ui-heading="serif">{t('sessionFiles.errorTitle')}</div>
                                            <div className="max-w-[280px] text-sm leading-relaxed text-[var(--app-hint)]">{t('sessionFiles.errorDescription')}</div>
                                        </div>
                                    </div>
                                ) : null}

                                {shouldSearch ? (
                                    searchResults.isLoading ? (
                                        <FileListSkeleton label={t('sessionFiles.loadingFiles')} />
                                    ) : searchResults.error ? (
                                        <div className="px-5 py-10 text-sm text-[var(--app-hint)] sm:px-6">{searchResults.error}</div>
                                    ) : searchResults.files.length === 0 ? (
                                        <div className="px-5 py-10 text-sm text-[var(--app-hint)] sm:px-6">
                                            {searchQuery ? t('sessionFiles.noSearchResult') : t('sessionFiles.noProjectFiles')}
                                        </div>
                                    ) : (
                                        <div>
                                            {searchResults.files.map((file, index) => (
                                                <SearchResultRow
                                                    key={`${file.fullPath}-${index}`}
                                                    file={file}
                                                    onOpen={() => handleOpenFile(file.fullPath)}
                                                    showDivider={index < searchResults.files.length - 1}
                                                    projectRootLabel={t('sessionFiles.projectRoot')}
                                                    searchQuery={searchQuery}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : activeTab === 'directories' ? (
                                    <div className="px-2 py-2 sm:px-3 sm:py-3">
                                        <DirectoryTree
                                            api={api}
                                            sessionId={sessionId}
                                            rootLabel={rootLabel}
                                            onOpenFile={(path) => handleOpenFile(path)}
                                        />
                                    </div>
                                ) : gitLoading ? (
                                    <FileListSkeleton label={t('sessionFiles.loadingGit')} />
                                ) : (
                                    <div>
                                        {gitStatus?.stagedFiles.length ? (
                                            <div>
                                                <div className="flex items-center justify-between border-b border-[var(--app-divider)] bg-[var(--app-panel-muted-bg)] px-5 py-2 sm:px-6">
                                                    <span className="text-xs font-semibold text-[var(--app-git-staged-color)]">
                                                        {t('sessionFiles.section.staged', { count: gitStatus.stagedFiles.length })}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleGitBulkAction('unstageAll')}
                                                        disabled={actionLoading}
                                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--app-hint)] hover:bg-[var(--app-panel-elevated-bg)] hover:text-[var(--app-fg)] transition-colors disabled:opacity-50"
                                                    >
                                                        <MinusIcon />
                                                        <span>{t('sessionFiles.action.unstageAll')}</span>
                                                    </button>
                                                </div>
                                                {gitStatus.stagedFiles.map((file, index) => (
                                                    <GitFileRow
                                                        key={`staged-${file.fullPath}-${index}`}
                                                        file={file}
                                                        onOpen={() => handleOpenFile(file.fullPath, file.isStaged)}
                                                        onUnstage={() => handleGitAction('unstage', file.fullPath)}
                                                        onRequestConfirm={handleRequestConfirm}
                                                        showDivider={index < gitStatus.stagedFiles.length - 1 || gitStatus.unstagedFiles.length > 0}
                                                        projectRootLabel={t('sessionFiles.projectRoot')}
                                                        actionLoading={actionLoading}
                                                    />
                                                ))}
                                            </div>
                                        ) : null}

                                        {gitStatus?.unstagedFiles.length ? (
                                            <div>
                                                <div className="flex items-center justify-between border-b border-[var(--app-divider)] bg-[var(--app-panel-muted-bg)] px-5 py-2 sm:px-6">
                                                    <span className="text-xs font-semibold text-[var(--app-git-unstaged-color)]">
                                                        {t('sessionFiles.section.unstaged', { count: gitStatus.unstagedFiles.length })}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleGitBulkAction('stageAll')}
                                                            disabled={actionLoading}
                                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--app-hint)] hover:bg-[var(--app-panel-elevated-bg)] hover:text-[var(--app-fg)] transition-colors disabled:opacity-50"
                                                        >
                                                            <PlusIcon />
                                                            <span>{t('sessionFiles.action.stageAll')}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleGitBulkAction('discardAll')}
                                                            disabled={actionLoading}
                                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--app-hint)] hover:bg-[var(--app-panel-elevated-bg)] hover:text-[var(--app-git-deleted-color)] transition-colors disabled:opacity-50"
                                                        >
                                                            <UndoIcon />
                                                            <span>{t('sessionFiles.action.discardAll')}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                {gitStatus.unstagedFiles.map((file, index) => (
                                                    <GitFileRow
                                                        key={`unstaged-${file.fullPath}-${index}`}
                                                        file={file}
                                                        onOpen={() => handleOpenFile(file.fullPath, file.isStaged)}
                                                        onStage={() => handleGitAction('stage', file.fullPath)}
                                                        onDiscard={() => handleGitAction('discard', file.fullPath)}
                                                        onClean={() => handleGitAction('clean', file.fullPath)}
                                                        onRequestConfirm={handleRequestConfirm}
                                                        showDivider={index < gitStatus.unstagedFiles.length - 1}
                                                        projectRootLabel={t('sessionFiles.projectRoot')}
                                                        actionLoading={actionLoading}
                                                    />
                                                ))}
                                            </div>
                                        ) : null}

                                        {!gitStatus ? (
                                            <div className="px-5 py-10 text-sm text-[var(--app-hint)] sm:px-6">
                                                {t('sessionFiles.gitUnavailable')}
                                            </div>
                                        ) : null}

                                        {gitStatus && gitStatus.stagedFiles.length === 0 && gitStatus.unstagedFiles.length === 0 ? (
                                            <div className="px-5 py-10 text-sm text-[var(--app-hint)] sm:px-6">
                                                {t('sessionFiles.noChangesDetected')}
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                title={t(confirmDialog.type === 'delete'
                    ? 'sessionFiles.dialog.delete.title'
                    : confirmDialog.type === 'discardAll'
                        ? 'sessionFiles.dialog.discardAll.title'
                        : 'sessionFiles.dialog.discard.title')}
                description={t(confirmDialog.type === 'delete'
                    ? 'sessionFiles.dialog.delete.description'
                    : confirmDialog.type === 'discardAll'
                        ? 'sessionFiles.dialog.discardAll.description'
                        : 'sessionFiles.dialog.discard.description')}
                confirmLabel={t(confirmDialog.type === 'delete'
                    ? 'sessionFiles.dialog.delete.confirm'
                    : 'sessionFiles.dialog.discard.confirm')}
                confirmingLabel={t('sessionFiles.dialog.confirming')}
                onConfirm={confirmDialog.onConfirm}
                isPending={actionLoading}
                destructive
            />
        </div>
    )
}
