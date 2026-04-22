import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useMachines } from '@/hooks/queries/useMachines'
import { queryKeys } from '@/lib/query-keys'
import { NewSession } from '@/components/NewSession'
import { LoadingState } from '@/components/LoadingState'
import { useTranslation } from '@/lib/use-translation'

export default function NewSessionPage() {
    const { api } = useAppContext()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const { machines, isLoading, error } = useMachines(api, true)

    const handleCancel = useCallback(() => {
        navigate({ to: '/sessions' })
    }, [navigate])

    const handleSuccess = useCallback((sessionId: string) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
        navigate({ to: '/sessions/$sessionId', params: { sessionId }, replace: true })
    }, [navigate, queryClient])

    if (error) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <div className="text-sm text-red-600">{error}</div>
            </div>
        )
    }

    if (isLoading && machines.length === 0) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <LoadingState label={t('loading.machines')} className="text-sm" />
            </div>
        )
    }

    return (
        <NewSession
            api={api}
            machines={machines}
            isLoading={isLoading}
            onCancel={handleCancel}
            onSuccess={handleSuccess}
        />
    )
}
