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
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]">
                {t('newSession.type')}
            </label>
            <div className="flex flex-col gap-3">
                {(['simple', 'worktree'] as const).map((type) => (
                    <div key={type} className="flex flex-col gap-2">
                        {type === 'worktree' ? (
                            <div className="flex items-center gap-3">
                                <input
                                    id="session-type-worktree"
                                    type="radio"
                                    name="sessionType"
                                    value="worktree"
                                    checked={props.sessionType === 'worktree'}
                                    onChange={() => props.onSessionTypeChange('worktree')}
                                    disabled={props.isDisabled}
                                    className="accent-[var(--app-link)]"
                                />
                                <div className="flex-1">
                                    <div className="min-h-12 flex items-center">
                                        {props.sessionType === 'worktree' ? (
                                            <input
                                                ref={props.worktreeInputRef}
                                                type="text"
                                                placeholder={t('newSession.type.worktree.placeholder')}
                                                value={props.worktreeName}
                                                onChange={(e) => props.onWorktreeNameChange(e.target.value)}
                                                disabled={props.isDisabled}
                                                className="min-h-12 w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-3 text-sm text-[var(--app-fg)] shadow-[var(--app-shadow-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-60"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <label
                                                    htmlFor="session-type-worktree"
                                                    className="cursor-pointer text-sm capitalize text-[var(--app-fg)]"
                                                >
                                                    {t('newSession.type.worktree')}
                                                </label>
                                                <span className="text-xs text-[var(--app-hint)]">
                                                    {t('newSession.type.worktree.desc')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <label className="flex min-h-12 items-center gap-3 cursor-pointer">
                                <input
                                    id="session-type-simple"
                                    type="radio"
                                    name="sessionType"
                                    value="simple"
                                    checked={props.sessionType === 'simple'}
                                    onChange={() => props.onSessionTypeChange('simple')}
                                    disabled={props.isDisabled}
                                    className="accent-[var(--app-link)]"
                                />
                                <span className="text-sm capitalize text-[var(--app-fg)]">{t('newSession.type.simple')}</span>
                                <span className="text-xs text-[var(--app-hint)]">
                                    {t('newSession.type.simple.desc')}
                                </span>
                            </label>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
