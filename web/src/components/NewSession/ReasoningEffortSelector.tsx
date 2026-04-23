import type { AgentType, CodexReasoningEffort } from './types'
import { CODEX_REASONING_EFFORT_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

export function ReasoningEffortSelector(props: {
    agent: AgentType
    value: CodexReasoningEffort
    isDisabled: boolean
    onChange: (value: CodexReasoningEffort) => void
}) {
    const { t } = useTranslation()

    if (props.agent !== 'codex') {
        return null
    }

    return (
        <div className="space-y-3">
            <label className="block text-[12px] font-medium tracking-[0.5px] normal-case text-[var(--app-hint)]">
                {t('newSession.reasoningEffort')}{' '}
                <span className="font-normal">({t('newSession.model.optional')})</span>
            </label>
            <div className="relative">
                <select
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value as CodexReasoningEffort)}
                    disabled={props.isDisabled}
                    className="min-h-12 w-full appearance-none rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 pr-10 py-3 text-sm text-[var(--app-fg)] focus:border-[var(--app-link)] focus:outline-none disabled:opacity-50"
                >
                    {CODEX_REASONING_EFFORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-hint)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
        </div>
    )
}
