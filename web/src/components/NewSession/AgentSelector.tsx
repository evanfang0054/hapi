import type { AgentType } from './types'
import { useTranslation } from '@/lib/use-translation'

export function AgentSelector(props: {
    agent: AgentType
    isDisabled: boolean
    onAgentChange: (value: AgentType) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]">
                {t('newSession.agent')}
            </label>
            <div className="flex flex-wrap gap-2">
                {(['claude', 'codex', 'cursor', 'gemini', 'opencode'] as const).map((agentType) => {
                    const checked = props.agent === agentType
                    return (
                        <label
                            key={agentType}
                            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm capitalize transition-colors ${
                                checked
                                    ? 'border-[var(--app-link)] bg-[color:color-mix(in srgb,var(--app-link) 12%,transparent)] text-[var(--app-fg)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'
                            } ${props.isDisabled ? 'opacity-50' : 'cursor-pointer'}`}
                        >
                            <input
                                type="radio"
                                name="agent"
                                value={agentType}
                                checked={checked}
                                onChange={() => props.onAgentChange(agentType)}
                                disabled={props.isDisabled}
                                className="accent-[var(--app-link)]"
                            />
                            <span>{agentType}</span>
                        </label>
                    )
                })}
            </div>
        </div>
    )
}
