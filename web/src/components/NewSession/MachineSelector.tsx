import type { Machine } from '@/types/api'
import { useTranslation } from '@/lib/use-translation'

function getMachineTitle(machine: Machine): string {
    if (machine.metadata?.displayName) return machine.metadata.displayName
    if (machine.metadata?.host) return machine.metadata.host
    return machine.id.slice(0, 8)
}

export function MachineSelector(props: {
    machines: Machine[]
    machineId: string | null
    isLoading?: boolean
    isDisabled: boolean
    onChange: (machineId: string) => void
}) {
    const { t } = useTranslation()

    if (props.isLoading || props.machines.length === 0) {
        return (
            <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)]">
                    {t('newSession.machine')}
                </label>
                <div className="text-sm text-[var(--app-hint)]">
                    {props.isLoading ? t('loading.machines') : t('misc.noMachines')}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)]">
                {t('newSession.machine')}
            </label>
            <div className="flex gap-[10px] overflow-x-auto pb-1">
                {props.machines.map((m) => {
                    const selected = props.machineId === m.id
                    const online = m.active
                    return (
                        <button
                            key={m.id}
                            type="button"
                            disabled={props.isDisabled}
                            onClick={() => props.onChange(m.id)}
                            className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-5 py-[14px] transition-colors min-w-[100px] shrink-0 ${
                                selected
                                    ? 'border-[var(--app-link)] bg-[rgba(201,100,66,0.08)] dark:bg-[rgba(217,119,87,0.12)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] hover:border-[var(--app-hint)]'
                            } ${props.isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${
                                selected
                                    ? 'bg-[var(--app-link)] text-white'
                                    : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'
                            }`}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </div>
                            <span className="text-xs font-medium text-center">
                                {getMachineTitle(m)}
                            </span>
                            <span className={`text-[10px] ${online ? 'text-[var(--app-success)]' : 'text-[var(--app-hint)]'}`}>
                                {online ? t('newSession.machine.online') : t('newSession.machine.offline')}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
