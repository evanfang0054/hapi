import type { AgentType } from './types'
import { useTranslation } from '@/lib/use-translation'

const AGENT_COLORS: Record<AgentType, { bg: string; letter: string }> = {
    claude: { bg: '#d97757', letter: 'C' },
    codex: { bg: '#10a37f', letter: 'O' },
    gemini: { bg: '#4285f4', letter: 'G' },
    cursor: { bg: '#000', letter: 'C' },
    opencode: { bg: '#6366f1', letter: 'O' },
}

export function AgentSelector(props: {
    agent: AgentType
    isDisabled: boolean
    onAgentChange: (value: AgentType) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)]">
                {t('newSession.agent')}
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {(['claude', 'codex', 'gemini', 'cursor', 'opencode'] as const).map((agentType) => {
                    const checked = props.agent === agentType
                    const color = AGENT_COLORS[agentType]
                    return (
                        <button
                            key={agentType}
                            type="button"
                            disabled={props.isDisabled}
                            onClick={() => props.onAgentChange(agentType)}
                            className={`flex items-center gap-[10px] rounded-xl border-2 px-4 py-3 transition-colors whitespace-nowrap ${
                                checked
                                    ? 'border-[var(--app-link)] bg-[rgba(201,100,66,0.08)] dark:bg-[rgba(217,119,87,0.12)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] hover:border-[var(--app-hint)]'
                            } ${props.isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div
                                className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-semibold text-white ${
                                    agentType === 'cursor' ? 'dark:bg-white dark:text-black' : ''
                                }`}
                                style={{ backgroundColor: color.bg }}
                            >
                                {color.letter}
                            </div>
                            <span className="text-[13px] font-medium capitalize">
                                {agentType}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
