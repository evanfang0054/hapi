import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/use-translation'

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
        destructive = false
    } = props

    const [error, setError] = useState<string | null>(null)

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
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-badge-error-text)]">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
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

                <DialogFooter className="mt-5 flex gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1"
                    >
                        {t('button.cancel')}
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={handleConfirm}
                        disabled={isPending}
                        className="flex-1"
                    >
                        {isPending ? confirmingLabel : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
