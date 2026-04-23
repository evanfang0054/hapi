import { useEffect, useRef } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'

function getLanguageExtension(lang: string | undefined): Extension[] {
    if (!lang) return []
    const l = lang.toLowerCase()
    if (l === 'javascript' || l === 'typescript' || l === 'jsx' || l === 'tsx') return [javascript({ jsx: true, typescript: l.includes('typescript') || l.includes('tsx') })]
    if (l === 'css' || l === 'scss' || l === 'less') return [css()]
    if (l === 'html' || l === 'xml' || l === 'svg') return [html()]
    if (l === 'python' || l === 'py') return [python()]
    if (l === 'json' || l === 'jsonc') return [json()]
    if (l === 'markdown' || l === 'md') return [markdown()]
    return []
}

function getEditorTheme(): Extension {
    const style = getComputedStyle(document.documentElement)
    const bg = style.getPropertyValue('--app-code-bg').trim() || '#1e1e2e'
    const fg = style.getPropertyValue('--app-fg').trim() || '#cdd6f4'
    const gutterBg = style.getPropertyValue('--app-subtle-bg').trim() || '#181825'
    const gutterFg = style.getPropertyValue('--app-hint').trim() || '#6c7086'
    const activeLine = style.getPropertyValue('--app-subtle-bg').trim() || '#2a2a3c'

    return EditorView.theme({
        '&': { backgroundColor: bg, color: fg, fontSize: '13px' },
        '.cm-content': { fontFamily: 'var(--app-font-mono, monospace)', caretColor: fg },
        '.cm-cursor': { borderLeftColor: fg },
        '.cm-gutters': { backgroundColor: gutterBg, color: gutterFg, border: 'none' },
        '.cm-activeLine': { backgroundColor: activeLine },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: 'rgba(255, 255, 255, 0.15) !important'
        },
    }, { dark: true })
}

interface FileEditorProps {
    content: string
    language: string | undefined
    onChange: (content: string) => void
}

export function FileEditor(props: FileEditorProps) {
    const { content, language, onChange } = props
    const containerRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const langExts = getLanguageExtension(language)
        const state = EditorState.create({
            doc: content,
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                history(),
                bracketMatching(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
                getEditorTheme(),
                oneDark,
                ...langExts,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChangeRef.current(update.state.doc.toString())
                    }
                }),
                EditorView.lineWrapping,
            ]
        })

        const view = new EditorView({
            state,
            parent: container,
        })

        viewRef.current = view

        const handleResize = () => {
            if (document.activeElement && container.contains(document.activeElement as Node)) {
                view.requestMeasure()
            }
        }
        if (typeof visualViewport !== 'undefined') {
            visualViewport.addEventListener('resize', handleResize)
        }

        return () => {
            if (typeof visualViewport !== 'undefined') {
                visualViewport.removeEventListener('resize', handleResize)
            }
            view.destroy()
            viewRef.current = null
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className="overflow-auto rounded-[20px] border border-[var(--app-border)] shadow-[var(--app-shadow-sm)] [&_.cm-editor]:!h-auto [&_.cm-scroller]:!max-h-[60vh] [&_.cm-scroller]:overflow-auto"
        />
    )
}
