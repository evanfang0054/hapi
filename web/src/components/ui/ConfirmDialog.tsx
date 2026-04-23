import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    description: string
    confirmLabel: string
    confirmingLabel: string
    onConfirm: () => Promise<void>
    isPending: boolean
    destructive?: boolean
    accent?: 'default' | 'archive'
    children?: React.ReactNode
}

export function ConfirmDialog(props: ConfirmDialogProps) {
    const { t } = useTranslation()
    const {
        isOpen,
        onClose,
        title,
        description,
        confirmLabel,
        confirmingLabel,
        onConfirm,
        isPending,
        destructive = false,
        accent = 'default'
    } = props

    const [error, setError] = useState<string | null>(null)
    const isArchiveAccent = accent === 'archive' && !destructive

    // Clear error when dialog opens/closes
    useEffect(() => {
        if (isOpen) {
            setError(null)
        }
    }, [isOpen])

    const handleConfirm = async () => {
        setError(null)
        try {
            await onConfirm()
            onClose()
        } catch (err) {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : t('dialog.error.default')
            setError(message)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm text-center">
                {destructive ? (
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-badge-error-bg)]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-badge-error-text)]">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    </div>
                ) : null}

                {isArchiveAccent ? (
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-badge-warning-bg)]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-badge-warning-text)]">
                            <rect width="20" height="5" x="2" y="3" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                            <path d="M10 12h4" />
                        </svg>
                    </div>
                ) : null}
                <DialogHeader className="items-center">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="mt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {props.children}

                {destructive ? (
                    <div className="mt-3 rounded-[12px] border border-[var(--app-badge-warning-border)] bg-[var(--app-badge-warning-bg)] px-3 py-2 text-xs text-[var(--app-badge-warning-text)] text-center">
                        {t('dialog.destructiveWarning')}
                    </div>
                ) : null}

                {error ? (
                    <div className="mt-3 rounded-[18px] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-4 py-3 text-sm text-[var(--app-badge-error-text)]">
                        {error}
                    </div>
                ) : null}

                <div className="mt-4 flex flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 h-11 min-h-[44px] rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-[18px] text-[13px] font-medium text-[var(--app-fg)] transition-all hover:bg-[var(--app-panel-elevated-bg)] disabled:opacity-50"
                    >
                        {t('button.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isPending}
                        className={cn(
                            'flex-1 h-11 min-h-[44px] rounded-[16px] border px-[18px] text-[13px] font-medium transition-all disabled:opacity-50',
                            destructive
                                ? 'border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] text-[var(--app-badge-error-text)] hover:brightness-95'
                                : isArchiveAccent
                                    ? 'border-[var(--app-warning)] bg-[var(--app-warning)] text-[#faf9f5] hover:brightness-110 hover:-translate-y-px hover:shadow-[var(--app-shadow-md)] disabled:hover:translate-y-0 disabled:hover:brightness-100'
                                    : 'border-[var(--app-link)] bg-[var(--app-link)] text-[#faf9f5] hover:brightness-110 hover:-translate-y-px hover:shadow-[var(--app-shadow-md)] disabled:hover:translate-y-0 disabled:hover:brightness-100'
                        )}
                    >
                        {(isArchiveAccent || destructive) && !isPending ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 inline-block align-[-2px]">
                                {destructive ? (
                                    <>
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" />
                                        <line x1="9" y1="9" x2="15" y2="15" />
                                    </>
                                ) : (
                                    <>
                                        <rect width="20" height="5" x="2" y="3" rx="1" />
                                        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                                        <path d="M10 12h4" />
                                    </>
                                )}
                            </svg>
                        ) : null}
                        {isPending ? confirmingLabel : confirmLabel}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
