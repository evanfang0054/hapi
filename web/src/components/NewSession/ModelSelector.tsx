import type { AgentType } from './types'
import { MODEL_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

export function ModelSelector(props: {
    agent: AgentType
    model: string
    isDisabled: boolean
    onModelChange: (value: string) => void
}) {
    const { t } = useTranslation()
    const options = MODEL_OPTIONS[props.agent]
    if (options.length === 0) {
        return null
    }

    return (
        <div className="space-y-3">
            <label className="block text-[12px] font-medium tracking-[0.5px] normal-case text-[var(--app-hint)]">
                {t('newSession.model')}{' '}
                <span className="font-normal">({t('newSession.model.optional')})</span>
            </label>
            <div className="relative">
                <select
                    value={props.model}
                    onChange={(e) => props.onModelChange(e.target.value)}
                    disabled={props.isDisabled}
                    className="min-h-12 w-full appearance-none rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 pr-10 py-3 text-sm text-[var(--app-fg)] focus:border-[var(--app-link)] focus:outline-none disabled:opacity-50"
                >
                    {options.map((option) => (
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
