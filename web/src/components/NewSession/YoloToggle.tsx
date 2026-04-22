import { useTranslation } from '@/lib/use-translation'

export function YoloToggle(props: {
    yoloMode: boolean
    isDisabled: boolean
    onToggle: (value: boolean) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.5px] text-[var(--app-hint)]">
                {t('newSession.yolo')}
            </label>
            <div className="flex items-center justify-between rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-4">
                <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                        {t('newSession.yolo.title')}
                        <span className="px-2 py-[2px] rounded-md text-[10px] font-semibold bg-[var(--app-warning)] text-white">
                            {t('newSession.yolo.badge')}
                        </span>
                    </div>
                    <div className="text-xs text-[var(--app-hint)] mt-1">
                        {t('newSession.yolo.desc')}
                    </div>
                </div>
                <label className="relative inline-flex items-center">
                    <input
                        type="checkbox"
                        checked={props.yoloMode}
                        onChange={(e) => props.onToggle(e.target.checked)}
                        disabled={props.isDisabled}
                        className="peer sr-only"
                    />
                    <span className={`w-12 h-7 rounded-[14px] transition-colors ${
                        props.yoloMode
                            ? 'bg-[var(--app-warning)]'
                            : 'bg-[var(--app-subtle-bg)]'
                    } ${props.isDisabled ? 'opacity-50' : ''}`} />
                    <span className={`absolute left-[2px] w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform ${
                        props.yoloMode ? 'translate-x-5' : 'translate-x-0'
                    } ${props.isDisabled ? 'opacity-50' : ''}`} />
                </label>
            </div>
        </div>
    )
}
