import { useId, useMemo, useRef, useState } from 'react'
import type { Session } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { isTelegramApp } from '@/hooks/useTelegram'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
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
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15.3-6.36L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15.3 6.36L3 16" />
        </svg>
    )
}

export function SessionHeader(props: {
    session: Session
    onBack: () => void
    onRefresh?: () => void
    onViewFiles?: () => void
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

    return (
        <>
            <div className="bg-[color:color-mix(in_srgb,var(--app-bg)_92%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-content items-start gap-1.5 px-2 py-1.5 md:gap-3 md:px-5 md:py-4">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={props.onBack}
                        className="self-center h-9 w-9 rounded-[10px] p-0 text-[var(--app-hint)] hover:text-[var(--app-fg)] md:h-9 md:w-9"
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
                    </Button>

                    <div className="min-w-0 flex-1 rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-2 shadow-[var(--app-shadow-sm)] md:px-5 md:py-3">
                        <div className="flex items-start justify-between gap-1.5 md:gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${session.active ? 'bg-[var(--app-git-staged-color)]' : 'bg-[var(--app-hint)] opacity-40'}`} />
                                    <div className="truncate text-[15px] leading-tight text-[var(--app-fg)] md:text-xl" data-ui-heading="serif">
                                        {title}
                                    </div>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[var(--app-hint)] md:mt-2 md:gap-2 md:text-xs">
                                    <Badge className="gap-1.5 bg-[var(--app-panel-muted-bg)] text-[var(--app-fg)]">
                                        <span aria-hidden="true">❖</span>
                                        {session.metadata?.flavor?.trim() || 'unknown'}
                                    </Badge>
                                    {modelLabel ? (
                                        <Badge variant="default" className="bg-[var(--app-panel-elevated-bg)]">
                                            {t(modelLabel.key)}: {modelLabel.value}
                                        </Badge>
                                    ) : null}
                                    {worktreeBranch ? (
                                        <Badge variant="default" className="bg-[var(--app-panel-elevated-bg)]">
                                            {t('session.item.worktree')}: {worktreeBranch}
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>

                            <div className="self-center flex items-center gap-1 md:gap-2">
                                {props.onViewFiles ? (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={props.onViewFiles}
                                        className="h-8 w-8 rounded-full p-0 text-[var(--app-hint)] hover:text-[var(--app-fg)] md:h-10 md:w-10"
                                        title={t('session.title')}
                                    >
                                        <FilesIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                                    </Button>
                                ) : null}

                                {props.onRefresh ? (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={props.onRefresh}
                                        className="h-8 w-8 rounded-full p-0 text-[var(--app-hint)] hover:text-[var(--app-fg)] md:h-10 md:w-10"
                                        title="刷新"
                                        aria-label="刷新"
                                    >
                                        <RefreshIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
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
                                    className="h-8 w-8 rounded-full p-0 text-[var(--app-hint)] hover:text-[var(--app-fg)] md:h-10 md:w-10"
                                    title={t('session.more')}
                                >
                                    <MoreVerticalIcon className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                                </Button>
                            </div>
                        </div>
                    </div>
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
                destructive
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
