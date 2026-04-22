import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { queryKeys } from '@/lib/query-keys'

export function useRewindSession() {
    const { api } = useAppContext()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ sessionId, messageLocalId }: { sessionId: string; messageLocalId: string }) => {
            return await api.rewindSession(sessionId, messageLocalId)
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.messages(variables.sessionId) })
        }
    })
}
