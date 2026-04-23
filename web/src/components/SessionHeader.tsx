import { useId, useMemo, useRef, useState } from 'react'
import type { Session } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { isTelegramApp } from '@/hooks/useTelegram'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { getSessionModelLabel } from '@/lib/sessionModelLabel'
import { useTranslation } from '@/lib/use-translation'

function getSessionTitle(session: Session): string {
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

function FilesIcon(props: { className?: string }) {
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
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
        </svg>
    )
}

function MoreVerticalIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={props.className}
        >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
        </svg>
    )
}

function HeaderTerminalIcon(props: { className?: string }) {
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
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    )
}

export function SessionHeader(props: {
    session: Session
    onBack: () => void
    onRefresh?: () => void
    onViewFiles?: () => void
    onViewTerminal?: () => void
    api: ApiClient | null
    onSessionDeleted?: () => void
}) {
    const { t } = useTranslation()
    const { session, api, onSessionDeleted } = props
    const title = useMemo(() => getSessionTitle(session), [session])
    const worktreeBranch = session.metadata?.worktree?.branch
    const modelLabel = getSessionModelLabel(session)

    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const menuId = useId()
    const menuAnchorRef = useRef<HTMLButtonElement | null>(null)
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        session.id,
        session.metadata?.flavor ?? null
    )

    const handleDelete = async () => {
        await deleteSession()
        onSessionDeleted?.()
    }

    const handleMenuToggle = () => {
        if (!menuOpen && menuAnchorRef.current) {
            const rect = menuAnchorRef.current.getBoundingClientRect()
            setMenuAnchorPoint({ x: rect.right, y: rect.bottom })
        }
        setMenuOpen((open) => !open)
    }

    // In Telegram, don't render header (Telegram provides its own)
    if (isTelegramApp()) {
        return null
    }

    const iconButtonClass = 'h-9 w-9 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-0 text-[var(--app-hint)] shadow-[var(--app-shadow-sm)] transition-all hover:-translate-y-px hover:text-[var(--app-fg)] hover:shadow-[var(--app-shadow-md)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-panel-bg)]'

    return (
        <>
            <div className="flex items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3 pt-[calc(12px+env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={props.onBack}
                    className={`${iconButtonClass} flex items-center justify-center text-[var(--app-fg)]`}
                    aria-label="Back"
                >
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
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${session.active ? 'bg-[var(--app-git-staged-color)] animate-pulse' : 'bg-[var(--app-hint)] opacity-40'}`} />
                        <div className="truncate text-[16px] font-medium italic leading-tight text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                            {title}
                        </div>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[11px] text-[var(--app-hint)] font-mono">
                        {session.thinking ? (
                            <>
                                <span className="shrink-0 text-[var(--app-link)] animate-pulse">{t('session.header.thinking')}</span>
                                <span className="shrink-0">·</span>
                            </>
                        ) : session.active ? (
                            <>
                                <span className="shrink-0 text-[var(--app-success)]">{t('session.header.active')}</span>
                                <span className="shrink-0">·</span>
                            </>
                        ) : (
                            <>
                                <span className="shrink-0 text-[var(--app-hint)]">{t('misc.offline')}</span>
                                <span className="shrink-0">·</span>
                            </>
                        )}
                        <span className="shrink-0">{session.metadata?.flavor?.trim() || 'unknown'}</span>
                        {modelLabel ? (
                            <>
                                <span className="hidden shrink-0 sm:inline">·</span>
                                <span className="hidden shrink-0 sm:inline">{t(modelLabel.key)}: {modelLabel.value}</span>
                            </>
                        ) : null}
                        {worktreeBranch ? (
                            <>
                                <span className="shrink-0">·</span>
                                <span className="min-w-0 flex-1 truncate">{t('session.item.worktree')}: {worktreeBranch}</span>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {props.onViewFiles ? (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={props.onViewFiles}
                            className={iconButtonClass}
                            title={t('session.title')}
                        >
                            <FilesIcon className="w-[18px] h-[18px]" />
                        </Button>
                    ) : null}

                    {props.onViewTerminal ? (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={props.onViewTerminal}
                            className={iconButtonClass}
                            title={t('composer.terminal')}
                        >
                            <HeaderTerminalIcon className="w-[18px] h-[18px]" />
                        </Button>
                    ) : null}

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleMenuToggle}
                        onPointerDown={(e) => e.stopPropagation()}
                        ref={menuAnchorRef}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-controls={menuOpen ? menuId : undefined}
                        className={iconButtonClass}
                        title={t('session.more')}
                    >
                        <MoreVerticalIcon className="w-[18px] h-[18px]" />
                    </Button>
                </div>
            </div>

            <SessionActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                sessionActive={session.active}
                onRename={() => setRenameOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                onDelete={() => setDeleteOpen(true)}
                anchorPoint={menuAnchorPoint}
                menuId={menuId}
            />

            <RenameSessionDialog
                isOpen={renameOpen}
                onClose={() => setRenameOpen(false)}
                currentName={title}
                onRename={renameSession}
                isPending={isPending}
            />

            <ConfirmDialog
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title={t('dialog.archive.title')}
                description={t('dialog.archive.description', { name: title })}
                confirmLabel={t('dialog.archive.confirm')}
                confirmingLabel={t('dialog.archive.confirming')}
                onConfirm={archiveSession}
                isPending={isPending}
                accent="archive"
            />

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={t('dialog.delete.title')}
                description={t('dialog.delete.description', { name: title })}
                confirmLabel={t('dialog.delete.confirm')}
                confirmingLabel={t('dialog.delete.confirming')}
                onConfirm={handleDelete}
                isPending={isPending}
                destructive
            />
        </>
    )
}
