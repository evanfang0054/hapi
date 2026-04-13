import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '@/api/client'

export function useMachinePathsExists(
    api: ApiClient,
    machineId: string | null,
    paths: string[]
): {
    pathExistence: Record<string, boolean>
    checkPathsExists: (pathsToCheck: string[]) => Promise<Record<string, boolean>>
} {
    const [pathExistence, setPathExistence] = useState<Record<string, boolean>>({})

    useEffect(() => {
        setPathExistence({})
    }, [machineId])

    useEffect(() => {
        let cancelled = false

        if (!machineId) {
            setPathExistence({})
            return () => {
                cancelled = true
            }
        }

        if (paths.length === 0) {
            return () => {
                cancelled = true
            }
        }

        const uniquePaths = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)))
        const pendingPaths = uniquePaths.filter((path) => pathExistence[path] === undefined)

        if (pendingPaths.length === 0) {
            return () => {
                cancelled = true
            }
        }

        void api.checkMachinePathsExists(machineId, pendingPaths)
            .then((result) => {
                if (cancelled) return
                const exists = result.exists ?? {}
                setPathExistence((current) => ({ ...current, ...exists }))
            })
            .catch(() => {
                if (cancelled) return
            })

        return () => {
            cancelled = true
        }
    }, [api, machineId, pathExistence, paths])

    const checkPathsExists = useCallback(async (pathsToCheck: string[]) => {
        if (!machineId || pathsToCheck.length === 0) {
            return {}
        }

        const result = await api.checkMachinePathsExists(machineId, pathsToCheck)
        const exists = result.exists ?? {}
        setPathExistence((current) => ({ ...current, ...exists }))
        return exists
    }, [api, machineId])

    return {
        pathExistence,
        checkPathsExists,
    }
}
