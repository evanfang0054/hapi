import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import type { RewindMode } from '@/hooks/mutations/useSessionActions'
import { cn } from '@/lib/utils'

type RewindDialogProps = {
    isOpen: boolean
    onClose: () => void
    onConfirm: (mode: RewindMode) => Promise<void>
    isPending: boolean
}

const options: { mode: RewindMode; label: string; description: string }[] = [
    {
        mode: 'session-and-files',
        label: '会话 + 文件',
        description: '回撤消息和 AI 修改的文件',
    },
    {
        mode: 'session-only',
        label: '仅会话',
        description: '清除消息，不恢复文件',
    },
    {
        mode: 'files-only',
        label: '仅文件',
        description: '恢复 AI 修改的文件',
    },
]

export function RewindDialog({ isOpen, onClose, onConfirm, isPending }: RewindDialogProps) {
    const [selected, setSelected] = useState<RewindMode>('session-and-files')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setSelected('session-and-files')
            setError(null)
        }
    }, [isOpen])

    const handleConfirm = async () => {
        setError(null)
        try {
            await onConfirm(selected)
            onClose()
        } catch (err) {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : 'Failed to rewind'
            setError(message)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-badge-warning-bg)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-badge-warning-text)]">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                </div>
                <DialogHeader className="items-center">
                    <DialogTitle>回撤到这条消息</DialogTitle>
                    <DialogDescription className="mt-2">选择回撤范围</DialogDescription>
                </DialogHeader>

                <div className="mt-4 flex flex-col gap-2">
                    {options.map((opt) => (
                        <button
                            key={opt.mode}
                            type="button"
                            disabled={isPending}
                            className={cn(
                                'flex items-center gap-3 rounded-[12px] border-2 px-3 py-3 text-left transition-colors',
                                selected === opt.mode
                                    ? 'border-[var(--app-link)] bg-[var(--app-link)]/5'
                                    : 'border-[var(--app-border)] hover:border-[var(--app-hint)]'
                            )}
                            onClick={() => setSelected(opt.mode)}
                        >
                            <div
                                className={cn(
                                    'h-[18px] w-[18px] shrink-0 rounded-full border-2',
                                    selected === opt.mode
                                        ? 'border-[var(--app-link)] flex items-center justify-center'
                                        : 'border-[var(--app-hint)]'
                                )}
                            >
                                {selected === opt.mode && (
                                    <div className="h-[10px] w-[10px] rounded-full bg-[var(--app-link)]" />
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-medium">{opt.label}</div>
                                <div className="text-xs text-[var(--app-hint)]">{opt.description}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mt-3 rounded-[18px] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-4 py-3 text-sm text-[var(--app-badge-error-text)]">
                        {error}
                    </div>
                )}

                <div className="mt-4 flex flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 h-11 min-h-[44px] rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-[18px] text-[13px] font-medium text-[var(--app-fg)] transition-all hover:bg-[var(--app-panel-elevated-bg)] disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isPending}
                        className="flex-1 h-11 min-h-[44px] rounded-[16px] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-[18px] text-[13px] font-medium text-[var(--app-badge-error-text)] transition-all hover:brightness-95 disabled:opacity-50"
                    >
                        {isPending ? '回撤中...' : '确认回撤'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
