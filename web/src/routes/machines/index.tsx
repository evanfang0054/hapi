import { useMemo } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useMachines } from '@/hooks/queries/useMachines'
import { useTranslation } from '@/lib/use-translation'
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
    const host = machine.metadata?.host
    const isActive = machine.active

    return (
        <div className="border border-[var(--app-border)] rounded-[var(--app-radius-xl)] bg-[var(--app-panel-bg)] overflow-hidden">
            <div className="px-4 py-3.5 flex items-start gap-3">
                {/* Status indicator */}
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isActive ? 'bg-[var(--app-git-staged-color)]' : 'bg-[var(--app-hint)]'}`} />

                <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[var(--app-fg)] truncate">{title}</div>
                    <div className="text-[13px] text-[var(--app-hint)] mt-0.5 flex items-center gap-2">
                        <span>{platform}</span>
                        {host ? (
                            <>
                                <span className="text-[var(--app-border)]">·</span>
                                <span className="truncate" style={{ fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}>{host}</span>
                            </>
                        ) : null}
                    </div>
                </div>

                {/* New Session button */}
                <button
                    type="button"
                    onClick={onNewSession}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--app-radius-lg)] text-xs font-medium bg-[var(--app-subtle-bg)] text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)] transition-colors shrink-0"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {t('machines.newSession')}
                </button>
            </div>
        </div>
    )
}

export default function MachinesPage() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const { machines, isLoading, error } = useMachines(api, true)

    const onlineCount = useMemo(() => machines.filter(m => m.active).length, [machines])

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-[var(--app-bg)] border-b border-[var(--app-border)] px-5 py-3">
                <h1 className="text-[20px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                    {t('machines.title')}
                </h1>
                {machines.length > 0 && (
                    <div className="text-[12px] text-[var(--app-hint)] mt-1">
                        {onlineCount} {onlineCount === 1 ? t('machines.online.singular') : t('machines.online.plural')}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-[600px] px-4 py-6 space-y-3">
                    {error ? (
                        <div className="text-sm text-[var(--app-error)] p-4">{error}</div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-sm text-[var(--app-hint)]">{t('loading.machines')}</div>
                        </div>
                    ) : machines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-[var(--app-hint)] opacity-40 mb-4">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            <div className="text-[var(--app-fg)] font-medium">{t('machines.empty')}</div>
                            <div className="text-sm text-[var(--app-hint)] mt-1">{t('machines.empty.description')}</div>
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
