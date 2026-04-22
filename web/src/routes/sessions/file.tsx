import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearch } from '@tanstack/react-router'
import type { GitCommandResponse } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { queryKeys } from '@/lib/query-keys'
import { langAlias, useShikiHighlighter } from '@/lib/shiki'
import { decodeBase64 } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'
import { useToast } from '@/lib/toast-context'

const MAX_COPYABLE_FILE_BYTES = 1_000_000

function decodePath(value: string): string {
    if (!value) return ''
    const decoded = decodeBase64(value)
    return decoded.ok ? decoded.text : value
}

function BackIcon(props: { className?: string }) {
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
            className={props.className}
        >
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function DiffDisplay(props: { diffContent: string }) {
    const lines = props.diffContent.split('\n')

    return (
        <div className="overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-bg)]">
            {lines.map((line, index) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++')
                const isRemove = line.startsWith('-') && !line.startsWith('---')
                const isHunk = line.startsWith('@@')
                const isHeader = line.startsWith('+++') || line.startsWith('---')

                const className = [
                    'whitespace-pre-wrap px-3 py-0.5 text-xs font-mono',
                    isAdd ? 'bg-[var(--app-diff-added-bg)] text-[var(--app-diff-added-text)]' : '',
                    isRemove ? 'bg-[var(--app-diff-removed-bg)] text-[var(--app-diff-removed-text)]' : '',
                    isHunk ? 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)] font-semibold' : '',
                    isHeader ? 'text-[var(--app-hint)] font-semibold' : ''
                ].filter(Boolean).join(' ')

                const style = isAdd
                    ? { borderLeft: '2px solid var(--app-git-staged-color)' }
                    : isRemove
                        ? { borderLeft: '2px solid var(--app-git-deleted-color)' }
                        : undefined

                return (
                    <div key={`${index}-${line}`} className={className} style={style}>
                        {line || ' '}
                    </div>
                )
            })}
        </div>
    )
}

function FileContentSkeleton(props: { label: string }) {
    const widths = ['w-full', 'w-11/12', 'w-5/6', 'w-3/4', 'w-2/3', 'w-4/5']

    return (
        <div role="status" aria-live="polite">
            <span className="sr-only">{props.label}</span>
            <div className="space-y-2 rounded-md border border-[var(--app-border)] bg-[var(--app-code-bg)] p-3">
                {Array.from({ length: 12 }).map((_, index) => (
                    <div key={`file-skeleton-${index}`} className={`h-3 ${widths[index % widths.length]} rounded bg-[linear-gradient(90deg,var(--app-subtle-bg)_25%,var(--app-panel-bg)_50%,var(--app-subtle-bg)_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]`} />
                ))}
            </div>
        </div>
    )
}

function resolveLanguage(path: string): string | undefined {
    const parts = path.split('.')
    if (parts.length <= 1) return undefined
    const ext = parts[parts.length - 1]?.toLowerCase()
    if (!ext) return undefined
    return langAlias[ext] ?? ext
}

function getUtf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).length
}

function isBinaryContent(content: string): boolean {
    if (!content) return false
    if (content.includes('\0')) return true
    const nonPrintable = content.split('').filter((char) => {
        const code = char.charCodeAt(0)
        return code < 32 && code !== 9 && code !== 10 && code !== 13
    }).length
    return nonPrintable / content.length > 0.1
}

function extractCommandError(result: GitCommandResponse | undefined): string | null {
    if (!result) return null
    if (result.success) return null
    return result.error ?? result.stderr ?? null
}

export default function FilePage() {
    const { t } = useTranslation()
    const { addToast } = useToast()
    const { api } = useAppContext()
    const { copied: pathCopied, copy: copyPath } = useCopyToClipboard()
    const { copied: contentCopied, copy: copyContent } = useCopyToClipboard()
    const goBack = useAppGoBack()
    const { sessionId } = useParams({ from: '/sessions/$sessionId/file' })
    const search = useSearch({ from: '/sessions/$sessionId/file' })
    const encodedPath = typeof search.path === 'string' ? search.path : ''
    const staged = search.staged

    const filePath = useMemo(() => decodePath(encodedPath), [encodedPath])
    const fileName = filePath.split('/').pop() || filePath || t('sessionFileDetail.fileFallback')

    const diffQuery = useQuery({
        queryKey: queryKeys.gitFileDiff(sessionId, filePath, staged),
        queryFn: async () => {
            if (!api || !sessionId || !filePath) {
                throw new Error(t('sessionFileDetail.error.missingSessionOrPath'))
            }
            return await api.getGitDiffFile(sessionId, filePath, staged)
        },
        enabled: Boolean(api && sessionId && filePath)
    })

    const fileQuery = useQuery({
        queryKey: queryKeys.sessionFile(sessionId, filePath),
        queryFn: async () => {
            if (!api || !sessionId || !filePath) {
                throw new Error(t('sessionFileDetail.error.missingSessionOrPath'))
            }
            return await api.readSessionFile(sessionId, filePath)
        },
        enabled: Boolean(api && sessionId && filePath)
    })

    const diffContent = diffQuery.data?.success ? (diffQuery.data.stdout ?? '') : ''
    const diffSuccess = diffQuery.data?.success === true
    const diffFailed = diffQuery.data?.success === false
    const diffError = diffFailed
        ? (extractCommandError(diffQuery.data) ?? t('sessionFileDetail.error.failedLoadDiff'))
        : null

    const fileContentResult = fileQuery.data
    const decodedContentResult = fileContentResult?.success && fileContentResult.content
        ? decodeBase64(fileContentResult.content)
        : { text: '', ok: true }
    const decodedContent = decodedContentResult.text
    const binaryFile = fileContentResult?.success
        ? !decodedContentResult.ok || isBinaryContent(decodedContent)
        : false

    const language = useMemo(() => resolveLanguage(filePath), [filePath])
    const highlighted = useShikiHighlighter(decodedContent, language)
    const contentSizeBytes = useMemo(
        () => (decodedContent ? getUtf8ByteLength(decodedContent) : 0),
        [decodedContent]
    )
    const canCopyContent = fileContentResult?.success === true
        && !binaryFile
        && decodedContent.length > 0
        && contentSizeBytes <= MAX_COPYABLE_FILE_BYTES

    const [displayMode, setDisplayMode] = useState<'diff' | 'file'>('diff')

    useEffect(() => {
        if (diffSuccess && !diffContent) {
            setDisplayMode('file')
            return
        }
        if (diffFailed) {
            setDisplayMode('file')
        }
    }, [diffSuccess, diffFailed, diffContent])

    const loading = diffQuery.isLoading || fileQuery.isLoading
    const fileError = fileContentResult && !fileContentResult.success
        ? (fileContentResult.error ?? t('sessionFileDetail.error.failedReadFile'))
        : null
    const missingPath = !filePath
    const diffErrorMessage = diffError ? t('sessionFileDetail.error.diffUnavailable', { error: diffError }) : null

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-content px-2 py-2 md:px-3 md:py-3">
                    <div className="space-y-4">
                        <Card className="overflow-hidden border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)]">
                            <CardHeader className="gap-4 border-b border-[var(--app-border)] px-5 py-5 sm:px-6">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={goBack}
                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]"
                                            >
                                                <BackIcon />
                                            </button>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]">
                                                    {t('sessionFileDetail.viewer')}
                                                </p>
                                                <CardTitle className="mt-2 break-all text-3xl leading-none" data-ui-heading="serif">
                                                    {fileName}
                                                </CardTitle>
                                            </div>
                                        </div>
                                        <CardDescription className="max-w-3xl text-sm leading-6 text-[var(--app-hint)]">
                                            {t('sessionFileDetail.description')}
                                        </CardDescription>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-hint)]">
                                            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-1 text-[var(--app-fg)]">
                                                <FileIcon fileName={fileName} size={18} />
                                                <span className="truncate max-w-[min(60vw,36rem)]">{filePath || t('sessionFileDetail.unknownPath')}</span>
                                            </span>
                                            {filePath ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { copyPath(filePath); addToast({ title: t('sessionFileDetail.copied'), body: '' }) }}
                                                    className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-1 text-[var(--app-fg)] transition-colors hover:bg-[var(--app-panel-muted-bg)]"
                                                    title={t('sessionFileDetail.copyPath')}
                                                >
                                                    {pathCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                                    <span>{pathCopied ? t('sessionFileDetail.copied') : t('sessionFileDetail.copyPath')}</span>
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 md:justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setDisplayMode('diff')}
                                            disabled={!diffContent}
                                            className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${displayMode === 'diff'
                                                ? 'border-[var(--app-link)] bg-[color:color-mix(in_srgb,var(--app-link)_12%,transparent)] text-[var(--app-fg)]'
                                                : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]'} disabled:cursor-not-allowed disabled:opacity-50`}
                                        >
                                            {t('diff.title')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDisplayMode('file')}
                                            className={`inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${displayMode === 'file'
                                                ? 'border-[var(--app-link)] bg-[color:color-mix(in_srgb,var(--app-link)_12%,transparent)] text-[var(--app-fg)]'
                                                : 'border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-hint)] hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]'}`}
                                        >
                                            {t('sessionFileDetail.mode.file')}
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="px-5 py-5 sm:px-6">
                                {diffErrorMessage ? (
                                    <div className="mb-4 rounded-[16px] border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-[var(--app-hint)]">
                                        {diffErrorMessage}
                                    </div>
                                ) : null}
                                {missingPath ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-[var(--app-subtle-bg)] flex items-center justify-center mb-4">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                        </div>
                                        <div className="text-[18px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                                            {t('sessionFileDetail.noFilePath')}
                                        </div>
                                    </div>
                                ) : loading ? (
                                    <FileContentSkeleton label={t('sessionFileDetail.loadingFile')} />
                                ) : fileError ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-[rgba(181,51,51,0.08)] flex items-center justify-center mb-4">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--app-error)" strokeWidth="1.5" className="w-7 h-7">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                        </div>
                                        <div className="text-[18px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                                            {t('sessionFileDetail.error.failedReadFile')}
                                        </div>
                                        <div className="text-[13px] text-[var(--app-hint)] mt-2 max-w-[280px] leading-relaxed">
                                            {fileError}
                                        </div>
                                    </div>
                                ) : binaryFile ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-[var(--app-subtle-bg)] flex items-center justify-center mb-4">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                        </div>
                                        <div className="text-[18px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                                            Binary File
                                        </div>
                                        <div className="text-[13px] text-[var(--app-hint)] mt-2 max-w-[280px] leading-relaxed">
                                            {t('sessionFileDetail.binaryNotDisplayable')}
                                        </div>
                                    </div>
                                ) : displayMode === 'diff' && diffContent ? (
                                    <DiffDisplay diffContent={diffContent} />
                                ) : displayMode === 'diff' && diffError ? (
                                    <div className="text-sm text-[var(--app-hint)]">{diffError}</div>
                                ) : displayMode === 'file' ? (
                                    decodedContent ? (
                                        <div className="relative">
                                            {canCopyContent ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { copyContent(decodedContent); addToast({ title: t('button.copy'), body: '' }) }}
                                                    className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1 text-[11px] text-[var(--app-hint)] shadow-[var(--app-shadow-sm)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]"
                                                    title={t('sessionFileDetail.copyFileContent')}
                                                >
                                                    {contentCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                                    <span>{contentCopied ? t('sessionFileDetail.copied') : t('button.copy')}</span>
                                                </button>
                                            ) : null}
                                            <pre className="shiki overflow-auto rounded-[20px] border border-[var(--app-border)] bg-[var(--app-code-bg)] p-4 pr-10 text-xs font-mono shadow-[var(--app-shadow-sm)]">
                                                <code>{highlighted ?? decodedContent}</code>
                                            </pre>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-[var(--app-hint)]">{t('sessionFileDetail.fileEmpty')}</div>
                                    )
                                ) : (
                                    <div className="text-sm text-[var(--app-hint)]">{t('sessionFileDetail.noChanges')}</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
