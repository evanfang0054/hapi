import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { CanvasAddon } from '@xterm/addon-canvas'
import '@xterm/xterm/css/xterm.css'
import { ensureBuiltinFontLoaded, getFontProvider } from '@/lib/terminalFont'
import { getInitialTerminalFontSize, type TerminalFontSize } from '@/hooks/useTerminalFontSize'

function resolveThemeColors(): { background: string; foreground: string; cursor: string; selectionBackground: string } {
    const background = '#1a1a1a'
    const foreground = '#e0e0e0'
    const cursor = '#e0e0e0'
    const selectionBackground = 'rgba(255, 255, 255, 0.2)'
    return { background, foreground, cursor, selectionBackground }
}

export function TerminalView(props: {
    onMount?: (terminal: Terminal) => void
    onResize?: (cols: number, rows: number) => void
    className?: string
    fontSize?: TerminalFontSize
}) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const onMountRef = useRef(props.onMount)
    const onResizeRef = useRef(props.onResize)

    useEffect(() => {
        onMountRef.current = props.onMount
    }, [props.onMount])

    useEffect(() => {
        onResizeRef.current = props.onResize
    }, [props.onResize])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const abortController = new AbortController()

        const fontProvider = getFontProvider()
        const fontSize = props.fontSize ?? getInitialTerminalFontSize()
        const { background, foreground, cursor, selectionBackground } = resolveThemeColors()
        const terminal = new Terminal({
            cursorBlink: true,
            fontFamily: fontProvider.getFontFamily(),
            fontSize,
            theme: {
                background,
                foreground,
                cursor,
                selectionBackground
            },
            customGlyphs: false
        })

        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()
        const canvasAddon = new CanvasAddon()
        terminal.loadAddon(fitAddon)
        terminal.loadAddon(webLinksAddon)
        terminal.loadAddon(canvasAddon)
        terminal.open(container)

        terminalRef.current = terminal
        fitAddonRef.current = fitAddon

        const observer = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                fitAddon.fit()
                onResizeRef.current?.(terminal.cols, terminal.rows)
            })
        })
        observer.observe(container)

        const refreshFont = (forceRemeasure = false) => {
            if (abortController.signal.aborted) return
            const nextFamily = fontProvider.getFontFamily()

            if (forceRemeasure && terminal.options.fontFamily === nextFamily) {
                terminal.options.fontFamily = `${nextFamily}, "__hapi_font_refresh__"`
                requestAnimationFrame(() => {
                    if (abortController.signal.aborted) return
                    terminal.options.fontFamily = nextFamily
                    if (terminal.rows > 0) {
                        terminal.refresh(0, terminal.rows - 1)
                    }
                    fitAddon.fit()
                    onResizeRef.current?.(terminal.cols, terminal.rows)
                })
                return
            }

            terminal.options.fontFamily = nextFamily
            if (terminal.rows > 0) {
                terminal.refresh(0, terminal.rows - 1)
            }
            fitAddon.fit()
            onResizeRef.current?.(terminal.cols, terminal.rows)
        }

        void ensureBuiltinFontLoaded().then(loaded => {
            if (!loaded) return
            refreshFont(true)
            if (!abortController.signal.aborted) {
                terminal.options.customGlyphs = true
                if (terminal.rows > 0) {
                    terminal.refresh(0, terminal.rows - 1)
                }
            }
        })

        // Cleanup on abort
        abortController.signal.addEventListener('abort', () => {
            observer.disconnect()
            fitAddon.dispose()
            webLinksAddon.dispose()
            canvasAddon.dispose()
            terminal.dispose()
            terminalRef.current = null
            fitAddonRef.current = null
        })

        requestAnimationFrame(() => {
            fitAddon.fit()
            onResizeRef.current?.(terminal.cols, terminal.rows)
        })
        onMountRef.current?.(terminal)

        return () => abortController.abort()
    }, [])

    // Respond to fontSize changes
    useEffect(() => {
        const terminal = terminalRef.current
        const fitAddon = fitAddonRef.current
        if (!terminal || !fitAddon || !props.fontSize) return

        terminal.options.fontSize = props.fontSize
        fitAddon.fit()
        onResizeRef.current?.(terminal.cols, terminal.rows)
    }, [props.fontSize])

    return (
        <div
            ref={containerRef}
            className={`h-full w-full ${props.className ?? ''}`}
        />
    )
}
