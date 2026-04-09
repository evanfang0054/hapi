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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    const allPaths = useDirectorySuggestions(machineId, sessions, recentPaths)

    const pathsToCheck = useMemo(
        () => Array.from(new Set([
            ...(deferredDirectory ? [deferredDirectory] : []),
            ...allPaths
        ])).slice(0, 1000),
        [allPaths, deferredDirectory]
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
        const lowered = query.toLowerCase()
        return verifiedPaths
            .filter((path) => path.toLowerCase().includes(lowered))
            .slice(0, 8)
            .map((path) => ({
                key: path,
                text: path,
                label: path
            }))
    }, [verifiedPaths])

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
        <div className="mx-auto w-full max-w-5xl px-3 py-4 md:px-5 md:py-6">
            <div className="space-y-4">
                <Card className="overflow-hidden border-[color:color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-link)_7%,var(--app-panel-bg))_0%,var(--app-panel-bg)_100%)]">
                    <CardHeader className="gap-3 p-5 md:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-hint)]">
                                    {t('newSession.hero.eyebrow')}
                                </p>
                                <div className="space-y-2">
                                    <CardTitle className="text-3xl leading-none md:text-4xl" data-ui-heading="serif">
                                        {t('newSession.hero.title')}
                                    </CardTitle>
                                    <CardDescription className="max-w-2xl text-sm leading-6">
                                        {t('newSession.hero.description')}
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="grid min-w-44 gap-2 rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-panel-elevated-bg)_88%,transparent)] px-4 py-3 text-xs text-[var(--app-hint)] shadow-[var(--app-shadow-sm)]">
                                <span>{t('newSession.hero.step.machineDirectory')}</span>
                                <span>{t('newSession.hero.step.agentModelEffort')}</span>
                                <span>{t('newSession.hero.step.sessionApprovals')}</span>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {runnerSpawnError ? (
                    <div className="rounded-[var(--app-radius-control)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {t('newSession.runnerLastSpawnError', { error: runnerSpawnError })}
                    </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="p-5 pb-4">
                                <CardTitle className="text-lg" data-ui-heading="serif">{t('newSession.workspace.title')}</CardTitle>
                                <CardDescription>
                                    {t('newSession.workspace.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5 p-5 pt-0">
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
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="p-5 pb-4">
                                <CardTitle className="text-lg" data-ui-heading="serif">{t('newSession.runtime.title')}</CardTitle>
                                <CardDescription>
                                    {t('newSession.runtime.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5 p-5 pt-0">
                                <AgentSelector
                                    agent={agent}
                                    isDisabled={isFormDisabled}
                                    onAgentChange={setAgent}
                                />
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
                                <ReasoningEffortSelector
                                    agent={agent}
                                    value={modelReasoningEffort}
                                    isDisabled={isFormDisabled}
                                    onChange={setModelReasoningEffort}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="p-5 pb-4">
                                <CardTitle className="text-lg" data-ui-heading="serif">{t('newSession.behavior.title')}</CardTitle>
                                <CardDescription>
                                    {t('newSession.behavior.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5 p-5 pt-0">
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
                            </CardContent>
                        </Card>

                        {(error ?? spawnError) ? (
                            <div className="rounded-[var(--app-radius-control)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                                {error ?? spawnError}
                            </div>
                        ) : null}

                        <Card>
                            <CardHeader className="p-5 pb-4">
                                <CardTitle className="text-lg" data-ui-heading="serif">{t('newSession.review.title')}</CardTitle>
                                <CardDescription>
                                    {t('newSession.review.description')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <ActionButtons
                                    isPending={isPending}
                                    canCreate={canCreate}
                                    isDisabled={isFormDisabled}
                                    createLabel={createLabel}
                                    onCancel={props.onCancel}
                                    onCreate={handleCreate}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
