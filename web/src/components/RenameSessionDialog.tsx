import { useState, useEffect, useRef } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/use-translation'

type RenameSessionDialogProps = {
    isOpen: boolean
    onClose: () => void
    currentName: string
    onRename: (newName: string) => Promise<void>
    isPending: boolean
}

export function RenameSessionDialog(props: RenameSessionDialogProps) {
    const { t } = useTranslation()
    const { isOpen, onClose, currentName, onRename, isPending } = props
    const [name, setName] = useState(currentName)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setName(currentName)
            setError(null)
            setTimeout(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
            }, 100)
        }
    }, [isOpen, currentName])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || trimmed === currentName) {
            onClose()
            return
        }
        setError(null)
        try {
            await onRename(trimmed)
            onClose()
        } catch (err) {
            setError(t('dialog.rename.error'))
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose()
        }
    }

    const trimmedName = name.trim()
    const hasNameChange = trimmedName.length > 0 && trimmedName !== currentName

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-subtle-bg)] text-[var(--app-link)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                    </svg>
                </div>
                <DialogHeader className="items-center">
                    <DialogTitle>{t('dialog.rename.title')}</DialogTitle>
                    <DialogDescription className="mt-2">
                        {t('dialog.rename.placeholder')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('dialog.rename.placeholder')}
                            className="h-11 w-full rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 pr-12 text-[13px] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] shadow-[var(--app-shadow-sm)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--app-focus)] focus:ring-offset-2 focus:ring-offset-[var(--app-panel-bg)]"
                            disabled={isPending}
                            maxLength={255}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--app-hint)] font-mono tabular-nums">
                            {trimmedName.length}/255
                        </span>
                    </div>

                    {error ? (
                        <div className="rounded-[16px] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-3 py-2.5 text-[13px] text-[var(--app-badge-error-text)] text-left">
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
                            type="submit"
                            disabled={isPending || !hasNameChange}
                            className="flex-1 h-11 min-h-[44px] rounded-[16px] border border-[var(--app-link)] bg-[var(--app-link)] px-[18px] text-[13px] font-medium text-[#faf9f5] transition-all hover:brightness-110 hover:-translate-y-px hover:shadow-[var(--app-shadow-md)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                        >
                            {isPending ? t('dialog.rename.saving') : t('button.save')}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
