import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ApiClient } from '@/api/client'
import type { Machine } from '@/types/api'
import { usePlatform } from '@/hooks/usePlatform'
import { useMachinePathsExists } from '@/hooks/useMachinePathsExists'
import { useSpawnSession } from '@/hooks/mutations/useSpawnSession'
import { useSessions } from '@/hooks/queries/useSessions'
import { useActiveSuggestions, type Suggestion } from '@/hooks/useActiveSuggestions'
import { useDirectorySuggestions } from '@/hooks/useDirectorySuggestions'
import { useRecentPaths } from '@/hooks/useRecentPaths'
import { useTranslation } from '@/lib/use-translation'
import type { AgentType, ClaudeEffort, CodexReasoningEffort, SessionType } from './types'
import { ActionButtons } from './ActionButtons'
import { AgentSelector } from './AgentSelector'
import { DirectorySection } from './DirectorySection'
import { MachineSelector } from './MachineSelector'
import { ModelSelector } from './ModelSelector'
import { ClaudeEffortSelector } from './ClaudeEffortSelector'
import { ReasoningEffortSelector } from './ReasoningEffortSelector'
import {
    loadPreferredAgent,
    loadPreferredYoloMode,
    savePreferredAgent,
    savePreferredYoloMode,
} from './preferences'
import { SessionTypeSelector } from './SessionTypeSelector'
import { YoloToggle } from './YoloToggle'
import { formatRunnerSpawnError } from '../../utils/formatRunnerSpawnError'

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:$/

function splitDirectoryInput(input: string): { parentPath: string; fragment: string; separator: '/' | '\\' } {
    const trimmed = input.trim()
    if (trimmed === '') {
        return { parentPath: '.', fragment: '', separator: '/' }
    }

    const slashIndex = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
    if (slashIndex < 0) {
        return { parentPath: '.', fragment: trimmed, separator: '/' }
    }

    const separator = trimmed[slashIndex] === '\\' ? '\\' : '/'

    if (slashIndex === 0) {
        return {
            parentPath: trimmed[0],
            fragment: trimmed.slice(1),
            separator
        }
    }

    const parentPath = trimmed.slice(0, slashIndex) || '.'
    const fragment = trimmed.slice(slashIndex + 1)
    return { parentPath, fragment, separator }
}

function buildSuggestionPath(parentPath: string, name: string, separator: '/' | '\\'): string {
    if (parentPath === '.' || parentPath === '') {
        return name
    }

    if (parentPath === '/' || parentPath === '\\') {
        return `${parentPath}${name}`
    }

    const normalizedParent = parentPath.replace(/[\\/]$/, '')
    if (WINDOWS_DRIVE_PATTERN.test(normalizedParent)) {
        return `${normalizedParent}${separator}${name}`
    }

    return `${normalizedParent}${separator}${name}`
}

export function NewSession(props: {
    api: ApiClient
    machines: Machine[]
    isLoading?: boolean
    onSuccess: (sessionId: string) => void
    onCancel: () => void
}) {
    const { haptic } = usePlatform()
    const { t } = useTranslation()
    const { spawnSession, isPending, error: spawnError } = useSpawnSession(props.api)
    const { sessions } = useSessions(props.api)
    const isFormDisabled = Boolean(isPending || props.isLoading)
    const { getRecentPaths, addRecentPath, getLastUsedMachineId, setLastUsedMachineId } = useRecentPaths()

    const [machineId, setMachineId] = useState<string | null>(null)
    const [directory, setDirectory] = useState('')
    const [suppressSuggestions, setSuppressSuggestions] = useState(false)
    const [isDirectoryFocused, setIsDirectoryFocused] = useState(false)
    const [agent, setAgent] = useState<AgentType>(loadPreferredAgent)
    const [model, setModel] = useState('auto')
    const [effort, setEffort] = useState<ClaudeEffort>('auto')
    const [modelReasoningEffort, setModelReasoningEffort] = useState<CodexReasoningEffort>('default')
    const [yoloMode, setYoloMode] = useState(loadPreferredYoloMode)
    const [sessionType, setSessionType] = useState<SessionType>('simple')
    const [worktreeName, setWorktreeName] = useState('')
    const [directoryCreationConfirmed, setDirectoryCreationConfirmed] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const worktreeInputRef = useRef<HTMLInputElement>(null)
    const directoryEntriesCacheRef = useRef<Map<string, string[]>>(new Map())

    useEffect(() => {
        if (sessionType === 'worktree') {
            worktreeInputRef.current?.focus()
        }
    }, [sessionType])

    useEffect(() => {
        setModel('auto')
        setEffort('auto')
    }, [agent])

    useEffect(() => {
        savePreferredAgent(agent)
    }, [agent])

    useEffect(() => {
        savePreferredYoloMode(yoloMode)
    }, [yoloMode])

    useEffect(() => {
        if (props.machines.length === 0) return
        if (machineId && props.machines.find((m) => m.id === machineId)) return

        const lastUsed = getLastUsedMachineId()
        const foundLast = lastUsed ? props.machines.find((m) => m.id === lastUsed) : null

        if (foundLast) {
            setMachineId(foundLast.id)
            const paths = getRecentPaths(foundLast.id)
            if (paths[0]) setDirectory(paths[0])
        } else if (props.machines[0]) {
            setMachineId(props.machines[0].id)
        }
    }, [props.machines, machineId, getLastUsedMachineId, getRecentPaths])

    useEffect(() => {
        directoryEntriesCacheRef.current.clear()
    }, [machineId])

    const selectedMachine = useMemo(
        () => (machineId ? props.machines.find((machine) => machine.id === machineId) ?? null : null),
        [machineId, props.machines]
    )
    const runnerSpawnError = useMemo(
        () => formatRunnerSpawnError(selectedMachine),
        [selectedMachine]
    )

    const recentPaths = useMemo(
        () => getRecentPaths(machineId),
        [getRecentPaths, machineId]
    )

    const trimmedDirectory = directory.trim()
    const deferredDirectory = useDeferredValue(trimmedDirectory)
    const [debouncedDirectory, setDebouncedDirectory] = useState('')
    const allPaths = useDirectorySuggestions(machineId, sessions, recentPaths)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedDirectory(deferredDirectory)
        }, 250)
        return () => clearTimeout(timer)
    }, [deferredDirectory])

    const pathsToCheck = useMemo(
        () => Array.from(new Set([
            ...(debouncedDirectory ? [debouncedDirectory] : []),
            ...allPaths
        ])).slice(0, 1000),
        [allPaths, debouncedDirectory]
    )

    const { pathExistence, checkPathsExists } = useMachinePathsExists(props.api, machineId, pathsToCheck)

    const verifiedPaths = useMemo(
        () => allPaths.filter((path) => pathExistence[path]),
        [allPaths, pathExistence]
    )

    const currentDirectoryExists = trimmedDirectory ? pathExistence[trimmedDirectory] : undefined
    const needsDirectoryCreationWarning = sessionType === 'simple' && trimmedDirectory !== '' && currentDirectoryExists === false
    const missingWorktreeDirectory = sessionType === 'worktree' && trimmedDirectory !== '' && currentDirectoryExists === false
    const directoryStatusMessage = missingWorktreeDirectory
        ? t('session.directoryMissingWorktree')
        : needsDirectoryCreationWarning
            ? (
                directoryCreationConfirmed
                    ? t('session.directoryMissingSimpleConfirm')
                    : t('session.directoryMissingSimple')
            )
            : null
    const directoryStatusTone = missingWorktreeDirectory ? 'error' : needsDirectoryCreationWarning ? 'warning' : null
    const createLabel = needsDirectoryCreationWarning && directoryCreationConfirmed
        ? t('session.createAndCreateDirectory')
        : undefined

    useEffect(() => {
        setDirectoryCreationConfirmed(false)
    }, [machineId, sessionType, trimmedDirectory])

    const getSuggestions = useCallback(async (query: string): Promise<Suggestion[]> => {
        const normalizedQuery = query.trim()
        const loweredQuery = normalizedQuery.toLowerCase()
        const suggestionMap = new Map<string, Suggestion>()

        for (const path of verifiedPaths) {
            if (path.toLowerCase().includes(loweredQuery)) {
                suggestionMap.set(path, {
                    key: path,
                    text: path,
                    label: path
                })
            }
        }

        if (!machineId) {
            return Array.from(suggestionMap.values()).slice(0, 8)
        }

        const { parentPath, fragment, separator } = splitDirectoryInput(normalizedQuery)
        const cacheKey = `${machineId}:${parentPath}`
        let directoryNames = directoryEntriesCacheRef.current.get(cacheKey)

        if (!directoryNames) {
            try {
                const result = await props.api.listMachineDirectory(machineId, parentPath)
                if (result.success) {
                    directoryNames = (result.entries ?? [])
                        .filter((entry) => entry.type === 'directory')
                        .map((entry) => entry.name)
                    directoryEntriesCacheRef.current.set(cacheKey, directoryNames)
                }
            } catch {
                // Ignore autocomplete fetch failures and keep local suggestions only.
            }
        }

        const loweredFragment = fragment.toLowerCase()
        for (const name of directoryNames ?? []) {
            if (loweredFragment !== '' && !name.toLowerCase().startsWith(loweredFragment)) {
                continue
            }
            const fullPath = buildSuggestionPath(parentPath, name, separator)
            suggestionMap.set(fullPath, {
                key: fullPath,
                text: fullPath,
                label: fullPath
            })
        }

        return Array.from(suggestionMap.values()).slice(0, 8)
    }, [verifiedPaths, machineId, props.api])

    const activeQuery = (!isDirectoryFocused || suppressSuggestions) ? null : directory

    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeQuery,
        getSuggestions,
        { allowEmptyQuery: true, autoSelectFirst: false }
    )

    const handleMachineChange = useCallback((newMachineId: string) => {
        setMachineId(newMachineId)
        const paths = getRecentPaths(newMachineId)
        if (paths[0]) {
            setDirectory(paths[0])
        } else {
            setDirectory('')
        }
    }, [getRecentPaths])

    const handlePathClick = useCallback((path: string) => {
        setDirectory(path)
    }, [])

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (suggestion) {
            setDirectory(suggestion.text)
            clearSuggestions()
            setSuppressSuggestions(true)
        }
    }, [suggestions, clearSuggestions])

    const handleDirectoryChange = useCallback((value: string) => {
        setSuppressSuggestions(false)
        setDirectory(value)
    }, [])

    const handleDirectoryFocus = useCallback(() => {
        setSuppressSuggestions(false)
        setIsDirectoryFocused(true)
    }, [])

    const handleDirectoryBlur = useCallback(() => {
        setIsDirectoryFocused(false)
    }, [])

    const handleDirectoryKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) return

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            moveUp()
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            moveDown()
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
            if (selectedIndex >= 0) {
                event.preventDefault()
                handleSuggestionSelect(selectedIndex)
            }
        }

        if (event.key === 'Escape') {
            clearSuggestions()
        }
    }, [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions, handleSuggestionSelect])

    async function handleCreate() {
        if (!machineId || !trimmedDirectory) return

        setError(null)
        try {
            const existsResult = await checkPathsExists([trimmedDirectory])
            const directoryExists = existsResult[trimmedDirectory]

            if (sessionType === 'worktree' && directoryExists === false) {
                haptic.notification('error')
                setError(t('session.directoryMissingWorktree'))
                return
            }

            if (sessionType === 'simple' && directoryExists === false && !directoryCreationConfirmed) {
                setDirectoryCreationConfirmed(true)
                return
            }

            const resolvedModel = model !== 'auto' && agent !== 'opencode' ? model : undefined
            const resolvedEffort = agent === 'claude' && effort !== 'auto' ? effort : undefined
            const resolvedModelReasoningEffort = agent === 'codex' && modelReasoningEffort !== 'default'
                ? modelReasoningEffort
                : undefined
            const result = await spawnSession({
                machineId,
                directory: trimmedDirectory,
                agent,
                model: resolvedModel,
                effort: resolvedEffort,
                modelReasoningEffort: resolvedModelReasoningEffort,
                yolo: yoloMode,
                sessionType,
                worktreeName: sessionType === 'worktree' ? (worktreeName.trim() || undefined) : undefined
            })

            if (result.type === 'success') {
                haptic.notification('success')
                setLastUsedMachineId(machineId)
                addRecentPath(machineId, trimmedDirectory)
                props.onSuccess(result.sessionId)
                return
            }

            haptic.notification('error')
            setError(result.message)
        } catch (e) {
            haptic.notification('error')
            setError(e instanceof Error ? e.message : t('newSession.error.createFailed'))
        }
    }

    const canCreate = Boolean(machineId && trimmedDirectory && !isFormDisabled && !missingWorktreeDirectory)

    return (
        <div className="px-1 py-2">
            <div className="space-y-5">
                {runnerSpawnError ? (
                    <div className="rounded-[var(--app-radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {t('newSession.runnerLastSpawnError', { error: runnerSpawnError })}
                    </div>
                ) : null}

                {/* Workspace: Machine + Directory */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-hint)] mb-3">
                        {t('newSession.workspace.title')}
                    </p>
                    <div className="space-y-4">
                        <MachineSelector
                            machines={props.machines}
                            machineId={machineId}
                            isLoading={props.isLoading}
                            isDisabled={isFormDisabled}
                            onChange={handleMachineChange}
                        />
                        <DirectorySection
                            directory={directory}
                            suggestions={suggestions}
                            selectedIndex={selectedIndex}
                            isDisabled={isFormDisabled}
                            recentPaths={recentPaths}
                            statusMessage={directoryStatusMessage}
                            statusTone={directoryStatusTone}
                            onDirectoryChange={handleDirectoryChange}
                            onDirectoryFocus={handleDirectoryFocus}
                            onDirectoryBlur={handleDirectoryBlur}
                            onDirectoryKeyDown={handleDirectoryKeyDown}
                            onSuggestionSelect={handleSuggestionSelect}
                            onPathClick={handlePathClick}
                        />
                    </div>
                </div>

                {/* Runtime: Agent + Model + Effort */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-hint)] mb-3">
                        {t('newSession.runtime.title')}
                    </p>
                    <div className="space-y-4">
                        <AgentSelector
                            agent={agent}
                            isDisabled={isFormDisabled}
                            onAgentChange={setAgent}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <ModelSelector
                                agent={agent}
                                model={model}
                                isDisabled={isFormDisabled}
                                onModelChange={setModel}
                            />
                            <ClaudeEffortSelector
                                agent={agent}
                                effort={effort}
                                isDisabled={isFormDisabled}
                                onEffortChange={setEffort}
                            />
                        </div>
                        <ReasoningEffortSelector
                            agent={agent}
                            value={modelReasoningEffort}
                            isDisabled={isFormDisabled}
                            onChange={setModelReasoningEffort}
                        />
                    </div>
                </div>

                {/* Behavior: Session Type + YOLO */}
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-hint)] mb-3">
                        {t('newSession.behavior.title')}
                    </p>
                    <div className="space-y-4">
                        <SessionTypeSelector
                            sessionType={sessionType}
                            worktreeName={worktreeName}
                            worktreeInputRef={worktreeInputRef}
                            isDisabled={isFormDisabled}
                            onSessionTypeChange={setSessionType}
                            onWorktreeNameChange={setWorktreeName}
                        />
                        <YoloToggle
                            yoloMode={yoloMode}
                            isDisabled={isFormDisabled}
                            onToggle={setYoloMode}
                        />
                    </div>
                </div>

                {(error ?? spawnError) ? (
                    <div className="rounded-[var(--app-radius-lg)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {error ?? spawnError}
                    </div>
                ) : null}

                {/* Actions */}
                <div className="pt-2 border-t border-[var(--app-border)]">
                    <ActionButtons
                        isPending={isPending}
                        canCreate={canCreate}
                        isDisabled={isFormDisabled}
                        createLabel={createLabel}
                        onCancel={props.onCancel}
                        onCreate={handleCreate}
                    />
                </div>
            </div>
        </div>
    )
}
