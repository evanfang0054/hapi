import { useCallback, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ApiClient } from '@/api/client'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { DirectoryPickerModal } from '@/components/NewSession/DirectoryPickerModal'
import { useTranslation } from '@/lib/use-translation'

export function DirectorySection(props: {
    directory: string
    suggestions: readonly Suggestion[]
    selectedIndex: number
    isDisabled: boolean
    recentPaths: string[]
    statusMessage?: string | null
    statusTone?: 'warning' | 'error' | null
    machineId: string | null
    api: ApiClient | null
    onDirectoryChange: (value: string) => void
    onDirectoryFocus: () => void
    onDirectoryBlur: () => void
    onDirectoryKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
    onSuggestionSelect: (index: number) => void
    onPathClick: (path: string) => void
}) {
    const { t } = useTranslation()
    const [pickerOpen, setPickerOpen] = useState(false)

    const handleBrowse = useCallback(() => {
        setPickerOpen(true)
    }, [])

    return (
        <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)]">
                {t('newSession.directory')}
            </label>
            <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--app-hint)] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <input
                        type="text"
                        placeholder={t('newSession.placeholder')}
                        value={props.directory}
                        onChange={(event) => props.onDirectoryChange(event.target.value)}
                        onKeyDown={props.onDirectoryKeyDown}
                        onFocus={props.onDirectoryFocus}
                        onBlur={props.onDirectoryBlur}
                        disabled={props.isDisabled}
                        className="min-h-12 w-full rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] pl-10 pr-4 py-3 font-mono text-sm text-[var(--app-fg)] focus:outline-none focus:border-[var(--app-link)] disabled:opacity-50"
                    />
                    {props.suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1">
                            <FloatingOverlay maxHeight={200}>
                                <Autocomplete
                                    suggestions={props.suggestions}
                                    selectedIndex={props.selectedIndex}
                                    onSelect={props.onSuggestionSelect}
                                />
                            </FloatingOverlay>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleBrowse}
                    disabled={props.isDisabled || !props.machineId}
                    className="shrink-0 px-3 py-1.5 rounded-[8px] text-[13px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] transition-colors hover:bg-[var(--app-panel-muted-bg)] disabled:opacity-50"
                >
                    {t('newSession.browse')}
                </button>
                <DirectoryPickerModal
                    isOpen={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    onConfirm={props.onDirectoryChange}
                    machineId={props.machineId}
                    api={props.api}
                    initialPath={props.directory || undefined}
                />
            </div>

            {props.recentPaths.length > 0 && (
                <div className="space-y-1.5">
                    <div className="space-y-1.5">
                        {props.recentPaths.map((path) => (
                            <button
                                key={path}
                                type="button"
                                onClick={() => props.onPathClick(path)}
                                disabled={props.isDisabled}
                                className="flex w-full max-w-full items-center gap-2 truncate p-[10px_12px] rounded-[10px] font-mono text-[12px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)] disabled:opacity-50"
                                title={path}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--app-hint)]">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span className="truncate">{path}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {props.statusMessage ? (
                <div
                    className={`rounded-[16px] px-4 py-2.5 text-xs leading-5 ${
                        props.statusTone === 'error'
                            ? 'border border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'border border-[var(--app-border)] bg-[var(--app-panel-muted-bg)] text-[var(--app-hint)]'
                    }`}
                >
                    {props.statusMessage}
                </div>
            ) : null}
        </div>
    )
}
