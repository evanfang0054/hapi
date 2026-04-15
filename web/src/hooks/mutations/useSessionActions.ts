import { useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query'
import { isPermissionModeAllowedForFlavor } from '@hapi/protocol'
import type { ApiClient } from '@/api/client'
import type { CodexCollaborationMode, PermissionMode } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { clearMessageWindow } from '@/lib/message-window-store'
import { isKnownFlavor } from '@/lib/agentFlavorUtils'

export type BulkDeleteSummary = {
    successCount: number
    failureCount: number
    failures: Array<{ sessionId: string, reason: string }>
}

function isTakeOverHandlerMissing(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    const normalized = message.toLowerCase()
    return normalized.includes('take-over') && normalized.includes('not registered')
}

export function useSessionActions(
    api: ApiClient | null,
    sessionId: string | null,
    agentFlavor?: string | null,
    codexCollaborationModeSupported?: boolean
): {
    abortSession: () => Promise<void>
    archiveSession: () => Promise<void>
    switchSession: () => Promise<void>
    setPermissionMode: (mode: PermissionMode) => Promise<void>
    setCollaborationMode: (mode: CodexCollaborationMode) => Promise<void>
    setModel: (model: string | null) => Promise<void>
    setEffort: (effort: string | null) => Promise<void>
    renameSession: (name: string) => Promise<void>
    deleteSession: () => Promise<void>
    deleteSessions: (sessionIds: string[]) => Promise<BulkDeleteSummary>
    isPending: boolean
} {
    const queryClient = useQueryClient()
    const bulkDeleteMutationKey = ['session-actions', 'bulk-delete', sessionId ?? 'unknown'] as const
    const bulkDeletePendingCount = useIsMutating({ mutationKey: bulkDeleteMutationKey })

    const invalidateSession = async () => {
        if (!sessionId) return
        await queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
    }

    const abortMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.abortSession(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const archiveMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.archiveSession(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const switchMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            try {
                await api.takeOverSession(sessionId)
                return
            } catch (error) {
                if (!isTakeOverHandlerMissing(error)) {
                    throw error
                }
            }
            await api.switchSession(sessionId)
        },
        onSuccess: () => void invalidateSession(),
    })

    const permissionMutation = useMutation({
        mutationFn: async (mode: PermissionMode) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            if (isKnownFlavor(agentFlavor) && !isPermissionModeAllowedForFlavor(mode, agentFlavor)) {
                throw new Error('Invalid permission mode for session flavor')
            }
            await api.setPermissionMode(sessionId, mode)
        },
        onSuccess: () => void invalidateSession(),
    })

    const collaborationMutation = useMutation({
        mutationFn: async (mode: CodexCollaborationMode) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            if (agentFlavor !== 'codex') {
                throw new Error('Collaboration mode is only supported for Codex sessions')
            }
            if (!codexCollaborationModeSupported) {
                throw new Error('Collaboration mode is only supported for remote Codex sessions')
            }
            await api.setCollaborationMode(sessionId, mode)
        },
        onSuccess: () => void invalidateSession(),
    })

    const modelMutation = useMutation({
        mutationFn: async (model: string | null) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.setModel(sessionId, model)
        },
        onSuccess: () => void invalidateSession(),
    })

    const effortMutation = useMutation({
        mutationFn: async (effort: string | null) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.setEffort(sessionId, effort)
        },
        onSuccess: () => void invalidateSession(),
    })

    const renameMutation = useMutation({
        mutationFn: async (name: string) => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.renameSession(sessionId, name)
        },
        onSuccess: () => void invalidateSession(),
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            await api.deleteSession(sessionId)
        },
        onSuccess: async () => {
            if (!sessionId) return
            queryClient.removeQueries({ queryKey: queryKeys.session(sessionId) })
            clearMessageWindow(sessionId)
            await queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
        },
    })

    const bulkDeleteMutation = useMutation({
        mutationKey: bulkDeleteMutationKey,
        mutationFn: async (sessionIds: string[]): Promise<BulkDeleteSummary> => {
            if (!api) {
                throw new Error('Session unavailable')
            }

            const failures: Array<{ sessionId: string, reason: string }> = []
            let successCount = 0

            for (const targetSessionId of sessionIds) {
                try {
                    await api.deleteSession(targetSessionId)
                    queryClient.removeQueries({ queryKey: queryKeys.session(targetSessionId) })
                    clearMessageWindow(targetSessionId)
                    successCount += 1
                } catch (error) {
                    failures.push({
                        sessionId: targetSessionId,
                        reason: error instanceof Error ? error.message : 'Failed to delete session',
                    })
                }
            }

            await queryClient.invalidateQueries({ queryKey: queryKeys.sessions })

            return {
                successCount,
                failureCount: failures.length,
                failures,
            }
        },
    })

    return {
        abortSession: abortMutation.mutateAsync,
        archiveSession: archiveMutation.mutateAsync,
        switchSession: switchMutation.mutateAsync,
        setPermissionMode: permissionMutation.mutateAsync,
        setCollaborationMode: collaborationMutation.mutateAsync,
        setModel: modelMutation.mutateAsync,
        setEffort: effortMutation.mutateAsync,
        renameSession: renameMutation.mutateAsync,
        deleteSession: deleteMutation.mutateAsync,
        deleteSessions: bulkDeleteMutation.mutateAsync,
        isPending: abortMutation.isPending
            || archiveMutation.isPending
            || switchMutation.isPending
            || permissionMutation.isPending
            || collaborationMutation.isPending
            || modelMutation.isPending
            || effortMutation.isPending
            || renameMutation.isPending
            || deleteMutation.isPending
            || bulkDeletePendingCount > 0,
    }
}
