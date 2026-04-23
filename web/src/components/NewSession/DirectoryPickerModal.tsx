import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ApiClient } from '@/api/client'
import { useTranslation } from '@/lib/use-translation'

export function DirectoryPickerModal(props: {
    isOpen: boolean
    onClose: () => void
    onConfirm: (path: string) => void
    machineId: string | null
    api: ApiClient | null
    initialPath?: string
}) {
    const { t } = useTranslation()
    const [currentPath, setCurrentPath] = useState(props.initialPath ?? '/')
    const [entries, setEntries] = useState<{ name: string; path: string }[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadDirectory = useCallback(async (path: string) => {
        if (!props.api || !props.machineId) return
        setIsLoading(true)
        try {
            const result = await props.api.listMachineDirectory(props.machineId, path)
            setCurrentPath(path)
            if (result.entries) {
                setEntries(
                    result.entries
                        .filter(e => e.type === 'directory')
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(e => ({
                            name: e.name,
                            path: path === '/' ? `/${e.name}` : `${path}/${e.name}`
                        }))
                )
            }
        } catch {
            setEntries([])
        } finally {
            setIsLoading(false)
        }
    }, [props.api, props.machineId])

    useEffect(() => {
        if (props.isOpen && props.machineId) {
            loadDirectory(props.initialPath ?? '/')
        }
    }, [props.isOpen, props.machineId, props.initialPath, loadDirectory])

    const handleEntryClick = (entry: { name: string; path: string }) => {
        loadDirectory(entry.path)
    }

    const handleConfirm = () => {
        props.onConfirm(currentPath)
        props.onClose()
    }

    return (
        <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('newSession.directoryPicker.title')}</DialogTitle>
                </DialogHeader>
                <div className="text-xs font-mono text-[var(--app-hint)] px-1 py-2 truncate border-b border-[var(--app-border)]">
                    {currentPath}
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 py-2 app-scroll-y">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-[var(--app-hint)]">
                            {t('misc.loading')}
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-[var(--app-hint)]">
                            {t('newSession.directoryPicker.empty')}
                        </div>
                    ) : (
                        entries.map(entry => (
                            <button
                                key={entry.path}
                                type="button"
                                onClick={() => handleEntryClick(entry)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4 text-[var(--app-hint)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                <span className="truncate">{entry.name}</span>
                            </button>
                        ))
                    )}
                </div>
                <div className="flex gap-3 pt-3 border-t border-[var(--app-border)]">
                    <button
                        type="button"
                        onClick={props.onClose}
                        className="flex-1 h-11 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[13px] font-medium text-[var(--app-fg)]"
                    >
                        {t('button.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 h-11 rounded-[16px] border border-[var(--app-link)] bg-[var(--app-link)] text-[13px] font-medium text-[#faf9f5]"
                    >
                        {t('newSession.directoryPicker.confirm')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
