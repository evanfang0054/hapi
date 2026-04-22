import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useParams } from '@tanstack/react-router'
import type { Terminal } from '@xterm/xterm'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useSession } from '@/hooks/queries/useSession'
import { useTerminalSocket } from '@/hooks/useTerminalSocket'
import { useLongPress } from '@/hooks/useLongPress'
import { useTranslation } from '@/lib/use-translation'
import { useTerminalFontSize } from '@/hooks/useTerminalFontSize'
import { TerminalView } from '@/components/Terminal/TerminalView'
import { LoadingState } from '@/components/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isRemoteTerminalSupported } from '@/utils/terminalSupport'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
function BackIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function ConnectionIndicator(props: { status: 'idle' | 'connecting' | 'connected' | 'error'; label: string }) {
    const isConnected = props.status === 'connected'
    const isConnecting = props.status === 'connecting'
    const label = props.label
    const colorClass = isConnected
        ? 'bg-emerald-500'
        : isConnecting
          ? 'bg-amber-400 animate-pulse'
          : 'bg-[var(--app-hint)]'

    return (
        <div className="flex items-center" aria-label={label} title={label} role="status">
            <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
        </div>
    )
}

type QuickInput = {
    label: string
    sequence?: string
    description: string
    modifier?: 'ctrl' | 'alt'
    popup?: {
        label: string
        sequence: string
        description: string
    }
}

type ModifierState = {
    ctrl: boolean
    alt: boolean
}

function applyModifierState(sequence: string, state: ModifierState): string {
    let modified = sequence
    if (state.alt) {
        modified = `\u001b${modified}`
    }
    if (state.ctrl && modified.length === 1) {
        const code = modified.toUpperCase().charCodeAt(0)
        if (code >= 64 && code <= 95) {
            modified = String.fromCharCode(code - 64)
        }
    }
    return modified
}

function shouldResetModifiers(sequence: string, state: ModifierState): boolean {
    if (!sequence) {
        return false
    }
    return state.ctrl || state.alt
}

const QUICK_INPUT_ROWS: QuickInput[][] = [
    [
        { label: 'Esc', sequence: '\u001b', description: 'Escape' },
        {
            label: '/',
            sequence: '/',
            description: 'Forward slash',
            popup: { label: '?', sequence: '?', description: 'Question mark' },
        },
        {
            label: '-',
            sequence: '-',
            description: 'Hyphen',
            popup: { label: '|', sequence: '|', description: 'Pipe' },
        },
        { label: 'Home', sequence: '\u001b[H', description: 'Home' },
        { label: '↑', sequence: '\u001b[A', description: 'Arrow up' },
        { label: 'End', sequence: '\u001b[F', description: 'End' },
        { label: 'PgUp', sequence: '\u001b[5~', description: 'Page up' },
    ],
    [
        { label: 'Tab', sequence: '\t', description: 'Tab' },
        { label: 'Ctrl', description: 'Control', modifier: 'ctrl' },
        { label: 'Alt', description: 'Alternate', modifier: 'alt' },
        { label: '←', sequence: '\u001b[D', description: 'Arrow left' },
        { label: '↓', sequence: '\u001b[B', description: 'Arrow down' },
        { label: '→', sequence: '\u001b[C', description: 'Arrow right' },
        { label: 'PgDn', sequence: '\u001b[6~', description: 'Page down' },
    ],
]

function QuickKeyButton(props: {
    input: QuickInput
    disabled: boolean
    isActive: boolean
    onPress: (sequence: string) => void
    onToggleModifier: (modifier: 'ctrl' | 'alt') => void
}) {
    const { input, disabled, isActive, onPress, onToggleModifier } = props
    const modifier = input.modifier
    const popupSequence = input.popup?.sequence
    const popupDescription = input.popup?.description
    const hasPopup = Boolean(popupSequence)
    const longPressDisabled = disabled || Boolean(modifier) || !hasPopup

    const handleClick = useCallback(() => {
        if (modifier) {
            onToggleModifier(modifier)
            return
        }
        onPress(input.sequence ?? '')
    }, [modifier, onToggleModifier, onPress, input.sequence])

    const handlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'touch') {
            event.preventDefault()
        }
    }, [])

    const longPressHandlers = useLongPress({
        onLongPress: () => {
            if (popupSequence && !modifier) {
                onPress(popupSequence)
            }
        },
        onClick: handleClick,
        disabled: longPressDisabled,
    })

    return (
        <button
            type="button"
            {...longPressHandlers}
            onPointerDown={handlePointerDown}
            disabled={disabled}
            aria-pressed={modifier ? isActive : undefined}
            className={`flex-1 border-l border-[var(--app-border)] px-2 py-1.5 text-xs font-medium text-[var(--app-fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-button)] focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent first:border-l-0 active:bg-[var(--app-subtle-bg)] sm:px-3 sm:text-sm ${
                isActive ? 'bg-[var(--app-link)] text-[var(--app-bg)]' : 'hover:bg-[var(--app-subtle-bg)]'
            }`}
            aria-label={input.description}
            title={popupDescription ? `${input.description} (long press: ${popupDescription})` : input.description}
        >
            {input.label}
        </button>
    )
}

export default function TerminalPage() {
    const { t } = useTranslation()
    const { terminalFontSize } = useTerminalFontSize()
    const { sessionId } = useParams({ from: '/sessions/$sessionId/terminal' })
    const { api, token, baseUrl } = useAppContext()
    const goBack = useAppGoBack()
    const { session } = useSession(api, sessionId)
    const terminalSupported = isRemoteTerminalSupported(session?.metadata)
    const terminalId = useMemo(() => {
        if (typeof crypto?.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }, [sessionId])
    const terminalRef = useRef<Terminal | null>(null)
    const inputDisposableRef = useRef<{ dispose: () => void } | null>(null)
    const connectOnceRef = useRef(false)
    const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null)
    const modifierStateRef = useRef<ModifierState>({ ctrl: false, alt: false })
    const [exitInfo, setExitInfo] = useState<{ code: number | null; signal: string | null } | null>(null)
    const [ctrlActive, setCtrlActive] = useState(false)
    const [altActive, setAltActive] = useState(false)
    const [pasteDialogOpen, setPasteDialogOpen] = useState(false)
    const [manualPasteText, setManualPasteText] = useState('')
    const [commandInput, setCommandInput] = useState('')

    const {
        state: terminalState,
        connect,
        write,
        resize,
        disconnect,
        onOutput,
        onExit,
    } = useTerminalSocket({
        token,
        sessionId,
        terminalId,
        baseUrl
    })

    useEffect(() => {
        onOutput((data) => {
            terminalRef.current?.write(data)
        })
    }, [onOutput])

    useEffect(() => {
        onExit((code, signal) => {
            setExitInfo({ code, signal })
            terminalRef.current?.write(`\r\n[process exited${code !== null ? ` with code ${code}` : ''}]`)
        })
    }, [onExit])

    useEffect(() => {
        modifierStateRef.current = { ctrl: ctrlActive, alt: altActive }
    }, [ctrlActive, altActive])

    const resetModifiers = useCallback(() => {
        setCtrlActive(false)
        setAltActive(false)
    }, [])

    const dispatchSequence = useCallback(
        (sequence: string, modifierState: ModifierState) => {
            write(applyModifierState(sequence, modifierState))
            if (shouldResetModifiers(sequence, modifierState)) {
                resetModifiers()
            }
        },
        [write, resetModifiers]
    )

    const handleTerminalMount = useCallback(
        (terminal: Terminal) => {
            terminalRef.current = terminal
            inputDisposableRef.current?.dispose()
            inputDisposableRef.current = terminal.onData((data) => {
                const modifierState = modifierStateRef.current
                dispatchSequence(data, modifierState)
            })
        },
        [dispatchSequence]
    )

    const handleResize = useCallback(
        (cols: number, rows: number) => {
            lastSizeRef.current = { cols, rows }
            if (!session?.active || !terminalSupported) {
                return
            }
            if (!connectOnceRef.current) {
                connectOnceRef.current = true
                connect(cols, rows)
            } else {
                resize(cols, rows)
            }
        },
        [session?.active, terminalSupported, connect, resize]
    )

    useEffect(() => {
        if (!session?.active || !terminalSupported) {
            return
        }
        if (connectOnceRef.current) {
            return
        }
        const size = lastSizeRef.current
        if (!size) {
            return
        }
        connectOnceRef.current = true
        connect(size.cols, size.rows)
    }, [session?.active, terminalSupported, connect])

    useEffect(() => {
        connectOnceRef.current = false
        setExitInfo(null)
        disconnect()
    }, [sessionId, disconnect])

    useEffect(() => {
        return () => {
            inputDisposableRef.current?.dispose()
            connectOnceRef.current = false
            disconnect()
        }
    }, [disconnect])

    useEffect(() => {
        if (session?.active === false || !terminalSupported) {
            disconnect()
            connectOnceRef.current = false
        }
    }, [session?.active, terminalSupported, disconnect])

    useEffect(() => {
        if (terminalState.status === 'connecting' || terminalState.status === 'connected') {
            setExitInfo(null)
        }
    }, [terminalState.status])

    const quickInputDisabled = !session?.active || terminalState.status !== 'connected'
    const writePlainInput = useCallback((text: string) => {
        if (!text || quickInputDisabled) {
            return false
        }
        write(text)
        resetModifiers()
        terminalRef.current?.focus()
        return true
    }, [quickInputDisabled, write, resetModifiers])

    const handlePasteAction = useCallback(async () => {
        if (quickInputDisabled) {
            return
        }
        const readClipboard = navigator.clipboard?.readText
        if (readClipboard) {
            try {
                const clipboardText = await readClipboard.call(navigator.clipboard)
                if (!clipboardText) {
                    return
                }
                if (writePlainInput(clipboardText)) {
                    return
                }
            } catch {
                // Fall through to manual paste modal.
            }
        }
        setManualPasteText('')
        setPasteDialogOpen(true)
    }, [quickInputDisabled, writePlainInput])

    const handleManualPasteSubmit = useCallback(() => {
        if (!manualPasteText.trim()) {
            return
        }
        if (writePlainInput(manualPasteText)) {
            setPasteDialogOpen(false)
            setManualPasteText('')
        }
    }, [manualPasteText, writePlainInput])

    const handleQuickInput = useCallback(
        (sequence: string) => {
            if (quickInputDisabled) {
                return
            }
            const modifierState = { ctrl: ctrlActive, alt: altActive }
            dispatchSequence(sequence, modifierState)
            terminalRef.current?.focus()
        },
        [quickInputDisabled, ctrlActive, altActive, dispatchSequence]
    )

    const handleModifierToggle = useCallback(
        (modifier: 'ctrl' | 'alt') => {
            if (quickInputDisabled) {
                return
            }
            if (modifier === 'ctrl') {
                setCtrlActive((value) => !value)
                setAltActive(false)
            } else {
                setAltActive((value) => !value)
                setCtrlActive(false)
            }
            terminalRef.current?.focus()
        },
        [quickInputDisabled]
    )

    const handleCommandSubmit = useCallback(() => {
        if (!commandInput || quickInputDisabled) {
            return
        }
        write(commandInput + '\r')
        setCommandInput('')
        terminalRef.current?.focus()
    }, [commandInput, quickInputDisabled, write])

    if (!session) {
        return (
            <div className="flex h-full items-center justify-center">
                <LoadingState label={t('loading.session')} className="text-sm" />
            </div>
        )
    }

    const subtitle = session.metadata?.path ?? sessionId
    const status = terminalState.status
    const connectionLabel = status === 'connected'
        ? t('terminal.connection.connected')
        : status === 'connecting'
          ? t('terminal.connection.connecting')
          : t('terminal.connection.offline')
    const errorMessage = !terminalSupported
        ? t('terminal.unsupportedWindows')
        : terminalState.status === 'error'
          ? terminalState.error
          : null

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto flex h-full w-full max-w-content flex-col px-2 py-2 md:px-5 md:py-6">
                    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)]">
                        <CardHeader className="gap-2 border-b border-[var(--app-border)] px-3 py-2 md:gap-4 md:px-6 md:py-5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                                    <button
                                        type="button"
                                        onClick={goBack}
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)] md:h-10 md:w-10"
                                    >
                                        <BackIcon />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="truncate text-base leading-tight md:text-xl" data-ui-heading="serif">
                                            {t('terminal.page.title')}
                                        </CardTitle>
                                        <p className="mt-0.5 truncate text-xs text-[var(--app-hint)] md:hidden">
                                            {subtitle}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <ConnectionIndicator status={status} label={connectionLabel} />
                                        {!session.active ? (
                                            <span className="text-xs text-[var(--app-hint)]">
                                                {t('terminal.sessionInactiveBadge')}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        void handlePasteAction()
                                    }}
                                    disabled={quickInputDisabled}
                                    className="shrink-0"
                                >
                                    {t('button.paste')}
                                </Button>
                            </div>

                            {/* Desktop: show full info */}
                            <div className="hidden md:block">
                                <CardDescription className="max-w-3xl text-sm leading-6 text-[var(--app-hint)]">
                                    {t('terminal.page.description')}
                                </CardDescription>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--app-hint)]">
                                    <span className="inline-flex max-w-[min(65vw,40rem)] items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-1 text-[var(--app-fg)]">
                                        <span className="truncate">{subtitle}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-1 text-[var(--app-fg)]">
                                        <ConnectionIndicator status={status} label={connectionLabel} />
                                        <span>{connectionLabel}</span>
                                    </span>
                                    {!session.active ? (
                                        <span className="inline-flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-1 text-[var(--app-hint)]">
                                            {t('terminal.sessionInactiveBadge')}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            {session.active ? null : (
                                <div className="rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-2 text-xs text-[var(--app-hint)] md:px-4 md:py-3 md:text-sm">
                                    {t('terminal.sessionInactiveMessage')}
                                </div>
                            )}

                            {errorMessage ? (
                                <div className="rounded-[var(--app-radius-control)] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-3 py-2 text-xs leading-5 text-[var(--app-badge-error-text)] md:px-4 md:py-3">
                                    {errorMessage}
                                </div>
                            ) : null}

                            {exitInfo ? (
                                <div className="rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-2 text-xs leading-5 text-[var(--app-hint)] md:px-4 md:py-3">
                                    {t('terminal.exitInfo', {
                                        suffix: `${exitInfo.code !== null ? ` ${t('terminal.exitCode', { code: exitInfo.code })}` : ''}${exitInfo.signal ? ` (${exitInfo.signal})` : ''}.`
                                    })}
                                </div>
                            ) : null}
                        </CardHeader>

                        <CardContent className="relative flex min-h-0 flex-1 flex-col gap-2 md:gap-4 md:px-6 md:py-5">
                            <div className="relative min-h-0 flex-1 overflow-hidden border border-[var(--app-border)] bg-[var(--app-code-bg)]">
                                {terminalSupported ? (
                                    <TerminalView onMount={handleTerminalMount} onResize={handleResize} fontSize={terminalFontSize} className="h-full w-full" />
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--app-subtle-bg)]">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-warning)]">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                        </div>
                                        <div className="font-serif text-lg font-medium" data-ui-heading="serif">{t('terminal.unsupportedWindows.title')}</div>
                                        <div className="max-w-[280px] text-sm leading-relaxed text-[var(--app-hint)]">{t('terminal.unsupportedWindows.description')}</div>
                                    </div>
                                )}
                                {exitInfo && terminalSupported ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--app-bg)]/80 gap-3 text-center font-mono text-[13px] text-[var(--app-hint)]">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <span>{t('terminal.exited')}</span>
                                        <span className={`rounded-md px-2.5 py-1 text-[11px] ${exitInfo.code !== null && exitInfo.code !== 0 ? 'text-[var(--app-danger)] bg-[var(--app-danger)]/15' : 'bg-[var(--app-subtle-bg)]'}`}>
                                            {t('terminal.exitCodeLabel', { code: exitInfo.code ?? '?' })}
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-1.5 rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-2 shadow-[var(--app-shadow-sm)] md:space-y-3 md:p-4">
                                <div className="hidden md:block">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]">
                                        {t('terminal.quickInput.title')}
                                    </p>
                                    <p className="mt-1 text-sm text-[var(--app-hint)]">
                                        {t('terminal.quickInput.description')}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={commandInput}
                                        onChange={(e) => setCommandInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                handleCommandSubmit()
                                            }
                                        }}
                                        placeholder={t('terminal.commandInput.placeholder')}
                                        disabled={quickInputDisabled}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        className="flex-1 rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-3 py-1.5 text-sm text-[var(--app-fg)] placeholder-[var(--app-hint)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCommandSubmit}
                                        disabled={quickInputDisabled || !commandInput}
                                    >
                                        {t('terminal.commandInput.send')}
                                    </Button>
                                </div>
                                {QUICK_INPUT_ROWS.map((row, rowIndex) => (
                                    <div
                                        key={`terminal-quick-row-${rowIndex}`}
                                        className="flex items-stretch overflow-hidden rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-panel-bg)]"
                                    >
                                        {row.map((input) => {
                                            const modifier = input.modifier
                                            const isCtrl = modifier === 'ctrl'
                                            const isAlt = modifier === 'alt'
                                            const isActive = (isCtrl && ctrlActive) || (isAlt && altActive)
                                            return (
                                                <QuickKeyButton
                                                    key={input.label}
                                                    input={input}
                                                    disabled={quickInputDisabled}
                                                    isActive={isActive}
                                                    onPress={handleQuickInput}
                                                    onToggleModifier={handleModifierToggle}
                                                />
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog
                open={pasteDialogOpen}
                onOpenChange={(open) => {
                    setPasteDialogOpen(open)
                    if (!open) {
                        setManualPasteText('')
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('terminal.paste.fallbackTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('terminal.paste.fallbackDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <textarea
                        value={manualPasteText}
                        onChange={(event) => setManualPasteText(event.target.value)}
                        placeholder={t('terminal.paste.placeholder')}
                        className="mt-2 min-h-32 w-full resize-y rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setPasteDialogOpen(false)
                                setManualPasteText('')
                            }}
                        >
                            {t('button.cancel')}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleManualPasteSubmit}
                            disabled={!manualPasteText.trim()}
                        >
                            {t('button.paste')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
