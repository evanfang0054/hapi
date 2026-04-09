import { useTranslation } from '@/lib/use-translation'

export function YoloToggle(props: {
    yoloMode: boolean
    isDisabled: boolean
    onToggle: (value: boolean) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]">
                {t('newSession.yolo')}
            </label>
            <div className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-3 shadow-[var(--app-shadow-sm)]">
                <div className="flex flex-col gap-1">
                    <span className="text-sm text-[var(--app-fg)]">
                        {t('newSession.yolo.title')}
                    </span>
                    <span className="text-xs leading-5 text-[var(--app-hint)]">
                        {t('newSession.yolo.desc')}
                    </span>
                </div>
                <label className="relative inline-flex h-6 w-11 items-center">
                    <input
                        type="checkbox"
                        checked={props.yoloMode}
                        onChange={(e) => props.onToggle(e.target.checked)}
                        disabled={props.isDisabled}
                        className="peer sr-only"
                    />
                    <span className="absolute inset-0 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted-bg)] transition-colors peer-checked:border-[var(--app-link)] peer-checked:bg-[var(--app-link)] peer-disabled:opacity-50" />
                    <span className="absolute left-0.5 h-5 w-5 rounded-full bg-[var(--app-panel-bg)] shadow-sm transition-transform peer-checked:translate-x-5 peer-disabled:opacity-50" />
                </label>
            </div>
        </div>
    )
}
