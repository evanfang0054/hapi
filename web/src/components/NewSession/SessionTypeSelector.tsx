import type { RefObject } from 'react'
import type { SessionType } from './types'
import { useTranslation } from '@/lib/use-translation'

export function SessionTypeSelector(props: {
    sessionType: SessionType
    worktreeName: string
    worktreeInputRef: RefObject<HTMLInputElement | null>
    isDisabled: boolean
    onSessionTypeChange: (value: SessionType) => void
    onWorktreeNameChange: (value: string) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)]">
                {t('newSession.type')}
            </label>
            <div className="flex gap-[10px]">
                {(['simple', 'worktree'] as const).map((type) => {
                    const selected = props.sessionType === type
                    return (
                        <button
                            key={type}
                            type="button"
                            disabled={props.isDisabled}
                            onClick={() => props.onSessionTypeChange(type)}
                            className={`flex-1 flex items-center gap-[10px] rounded-[14px] border-2 p-[14px] transition-colors ${
                                selected
                                    ? 'border-[var(--app-link)] bg-[rgba(201,100,66,0.08)] dark:bg-[rgba(217,119,87,0.12)]'
                                    : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] hover:border-[var(--app-hint)]'
                            } ${props.isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                                selected
                                    ? 'border-[var(--app-link)]'
                                    : 'border-[var(--app-border)]'
                            }`}>
                                {selected && (
                                    <div className="w-2 h-2 rounded-full bg-[var(--app-link)]" />
                                )}
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-[13px] font-medium">
                                    {type === 'simple' ? t('newSession.type.simple') : t('newSession.type.worktree')}
                                </div>
                                <div className="text-[11px] text-[var(--app-hint)] mt-[2px]">
                                    {type === 'simple' ? t('newSession.type.simple.desc') : t('newSession.type.worktree.desc')}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
            {props.sessionType === 'worktree' && (
                <div className="mt-2">
                    <label className="block text-[11px] font-medium text-[var(--app-hint)] mb-1.5">
                        {t('newSession.type.worktree.nameLabel')}
                    </label>
                    <input
                        ref={props.worktreeInputRef}
                        type="text"
                        placeholder={t('newSession.type.worktree.placeholder')}
                        value={props.worktreeName}
                        onChange={(e) => props.onWorktreeNameChange(e.target.value)}
                        disabled={props.isDisabled}
                        className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-[14px] py-3 text-[13px] font-mono text-[var(--app-fg)] focus:outline-none focus:border-[var(--app-link)] placeholder:text-[var(--app-hint)] disabled:opacity-60"
                    />
                </div>
            )}
        </div>
    )
}
