import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useMachines } from '@/hooks/queries/useMachines'
import { useTranslation } from '@/lib/use-translation'
import { queryKeys } from '@/lib/query-keys'
import type { Machine } from '@/types/api'

function getMachineTitle(machine: Machine): string {
    if (machine.metadata?.displayName) return machine.metadata.displayName
    if (machine.metadata?.host) return machine.metadata.host
    return machine.id.slice(0, 8)
}

function MachineCard({ machine, onNewSession }: { machine: Machine; onNewSession: () => void }) {
    const { t } = useTranslation()
    const title = getMachineTitle(machine)
    const platform = machine.metadata?.platform ?? 'Unknown'
    const cliVersion = machine.metadata?.happyCliVersion
    const isActive = machine.active
    const runnerError = machine.runnerState?.lastSpawnError?.message

    return (
        <div
            className="border border-[var(--app-border)] rounded-[var(--app-radius-2xl)] bg-[var(--app-panel-bg)] p-4 cursor-pointer hover:border-[var(--app-link)] hover:shadow-[var(--app-shadow-sm)] transition-all"
            onClick={onNewSession}
        >
            {/* Header: Icon + Name + Status */}
            <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 ${isActive ? 'bg-[rgba(95,138,99,0.12)]' : 'bg-[var(--app-subtle-bg)]'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--app-git-staged-color)' : 'var(--app-hint)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-semibold text-[var(--app-fg)] flex items-center gap-2">
                        <span className="truncate">{title}</span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[var(--app-git-staged-color)] shadow-[0_0_6px_var(--app-git-staged-color)]' : 'bg-[var(--app-hint)] opacity-40'}`} />
                    </div>
                    <div className="text-[11px] text-[var(--app-hint)] mt-0.5 font-mono">{machine.id.slice(0, 8)}</div>
                </div>
            </div>

            {/* Meta section */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--app-border)]">
                <div className="flex items-center gap-1.5 text-[12px] text-[var(--app-hint)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-60">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <rect x="9" y="9" width="6" height="6" />
                    </svg>
                    <span className="font-mono text-[var(--app-fg)]">{platform}</span>
                </div>
                {cliVersion ? (
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--app-hint)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 opacity-60">
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <span className="font-mono text-[var(--app-fg)]">{cliVersion}</span>
                    </div>
                ) : null}
            </div>

            {/* Runner error */}
            {runnerError ? (
                <div className="mt-3 rounded-[12px] border border-[rgba(181,51,51,0.2)] bg-[rgba(181,51,51,0.08)] p-3 flex items-start gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--app-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 mt-0.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-[12px] text-[var(--app-error)]">{runnerError}</span>
                </div>
            ) : null}
        </div>
    )
}

function SkeletonCard() {
    return (
        <div className="border border-[var(--app-border)] rounded-[var(--app-radius-2xl)] bg-[var(--app-panel-bg)] p-4">
            <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-[12px] bg-[var(--app-subtle-bg)] animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-[18px] w-[120px] rounded bg-[var(--app-subtle-bg)] animate-pulse" />
                    <div className="h-[12px] w-[80px] rounded bg-[var(--app-subtle-bg)] animate-pulse" />
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
                <div className="h-[14px] w-full rounded bg-[var(--app-subtle-bg)] animate-pulse" />
            </div>
        </div>
    )
}

export default function MachinesPage() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const { machines, isLoading, error } = useMachines(api, true)
    const queryClient = useQueryClient()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const onlineCount = useMemo(() => machines.filter(m => m.active).length, [machines])

    const handleRefresh = () => {
        setIsRefreshing(true)
        queryClient.invalidateQueries({ queryKey: queryKeys.machines })
        setTimeout(() => setIsRefreshing(false), 1500)
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-[var(--app-panel-bg)] border-b border-[var(--app-border)] px-5 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                        {t('machines.title')}
                    </h1>
                    {machines.length > 0 && (
                        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--app-hint)] mt-1">
                            {onlineCount} {onlineCount === 1 ? t('machines.online.singular') : t('machines.online.plural')}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-medium border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)] disabled:opacity-60 transition-colors"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}>
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15.3-6.36L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15.3 6.36L3 16" />
                    </svg>
                    {t('machines.refresh')}
                </button>
            </div>

            {/* Content */}
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-[600px] px-4 py-5 space-y-3">
                    {error ? (
                        <div className="text-sm text-[var(--app-error)] p-4">{error}</div>
                    ) : isLoading ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : machines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-[var(--app-subtle-bg)] flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                    <rect x="2" y="3" width="20" height="14" rx="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </div>
                            <div className="text-[18px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>{t('machines.empty')}</div>
                            <div className="text-[13px] text-[var(--app-hint)] mt-2 max-w-[280px] leading-relaxed">{t('machines.empty.description')}</div>
                        </div>
                    ) : (
                        machines.map((machine) => (
                            <MachineCard
                                key={machine.id}
                                machine={machine}
                                onNewSession={() => {
                                    window.dispatchEvent(new CustomEvent('hapi:new-session'))
                                }}
                            />
                        ))
                    )}

                    {/* Bottom padding for mobile tab bar */}
                    <div className="h-20 lg:h-4" />
                </div>
            </div>
        </div>
    )
}
