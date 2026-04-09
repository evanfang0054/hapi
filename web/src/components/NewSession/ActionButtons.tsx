import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { useTranslation } from '@/lib/use-translation'

export function ActionButtons(props: {
    isPending: boolean
    canCreate: boolean
    isDisabled: boolean
    createLabel?: string
    onCancel: () => void
    onCreate: () => void
}) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--app-hint)]">
                Review the machine, directory, runtime, and session mode before creating.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    variant="secondary"
                    onClick={props.onCancel}
                    disabled={props.isDisabled}
                    className="min-w-28"
                >
                    {t('button.cancel')}
                </Button>
                <Button
                    onClick={props.onCreate}
                    disabled={!props.canCreate}
                    aria-busy={props.isPending}
                    className="min-w-36 gap-2"
                >
                    {props.isPending ? (
                        <>
                            <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                            {t('newSession.creating')}
                        </>
                    ) : (
                        (props.createLabel ?? t('newSession.create'))
                    )}
                </Button>
            </div>
        </div>
    )
}
