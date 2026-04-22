import { useCallback, useEffect, useState } from 'react'
import { ApiClient } from '@/api/client'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Spinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/use-translation'
import { useTheme, useAppearance } from '@/hooks/useTheme'
import type { ServerUrlResult } from '@/hooks/useServerUrl'

type LoginPromptProps = {
    mode?: 'login' | 'bind'
    onLogin?: (token: string) => void
    onBind?: (token: string) => Promise<void>
    baseUrl: string
    serverUrl: string | null
    setServerUrl: (input: string) => ServerUrlResult
    clearServerUrl: () => void
    requireServerUrl?: boolean
    error?: string | null
}

function ThemeToggle() {
    const { isDark } = useTheme()
    const { setAppearance } = useAppearance()

    return (
        <button
            type="button"
            onClick={() => setAppearance(isDark ? 'light' : 'dark')}
            className="fixed top-4 left-4 z-50 w-9 h-9 rounded-full bg-[var(--app-subtle-bg)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)] transition-colors"
            aria-label={isDark ? 'Light mode' : 'Dark mode'}
        >
            {isDark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    )
}

export function LoginPrompt(props: LoginPromptProps) {
    const { t } = useTranslation()
    const isBindMode = props.mode === 'bind'
    const [accessToken, setAccessToken] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isServerDialogOpen, setIsServerDialogOpen] = useState(false)
    const [serverInput, setServerInput] = useState(props.serverUrl ?? '')
    const [serverError, setServerError] = useState<string | null>(null)

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()

        const trimmedToken = accessToken.trim()
        if (!trimmedToken) {
            setError(t('login.error.enterToken'))
            return
        }

        if (!isBindMode && props.requireServerUrl && !props.serverUrl) {
            setServerError(t('login.server.required'))
            setIsServerDialogOpen(true)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            if (isBindMode) {
                if (!props.onBind) {
                    setError(t('login.error.bindingUnavailable'))
                    return
                }
                await props.onBind(trimmedToken)
            } else {
                const client = new ApiClient('', { baseUrl: props.baseUrl })
                await client.authenticate({ accessToken: trimmedToken })
                if (!props.onLogin) {
                    setError(t('login.error.loginUnavailable'))
                    return
                }
                props.onLogin(trimmedToken)
            }
        } catch (e) {
            const fallbackMessage = isBindMode ? t('login.error.bindFailed') : t('login.error.authFailed')
            setError(e instanceof Error ? e.message : fallbackMessage)
        } finally {
            setIsLoading(false)
        }
    }, [accessToken, props, t, isBindMode])

    useEffect(() => {
        if (!isServerDialogOpen) {
            return
        }
        setServerInput(props.serverUrl ?? '')
    }, [isServerDialogOpen, props.serverUrl])

    const handleSaveServer = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        const result = props.setServerUrl(serverInput)
        if (!result.ok) {
            setServerError(result.error)
            return
        }
        setServerError(null)
        setServerInput(result.value)
        setIsServerDialogOpen(false)
    }, [props, serverInput])

    const handleClearServer = useCallback(() => {
        props.clearServerUrl()
        setServerInput('')
        setServerError(null)
        setIsServerDialogOpen(false)
    }, [props])

    const handleServerDialogOpenChange = useCallback((open: boolean) => {
        setIsServerDialogOpen(open)
        if (!open) {
            setServerError(null)
        }
    }, [])

    const displayError = error || props.error
    const serverSummary = props.serverUrl ?? `${props.baseUrl} ${t('login.server.default')}`
    const title = isBindMode ? t('login.bind.title') : t('login.title')
    const subtitle = t('login.subtitle')
    const submitLabel = isBindMode ? t('login.bind.submit') : t('login.submit')

    return (
        <div className="relative h-full flex items-center justify-center p-6">
            {/* Theme toggle — top left */}
            <ThemeToggle />

            {/* Language switcher — top right */}
            <div className="fixed top-4 right-4 z-50">
                <LanguageSwitcher />
            </div>

            <div className="w-full" style={{ maxWidth: '400px' }}>
                {/* Header with logo */}
                <div className="text-center mb-10">
                    <div
                        className="w-[72px] h-[72px] rounded-[20px] mx-auto mb-6 flex items-center justify-center shadow-[var(--app-shadow-md)]"
                        style={{ background: 'linear-gradient(135deg, var(--app-link) 0%, #d97757 100%)' }}
                    >
                        <span className="text-white text-[28px] font-medium" style={{ fontFamily: 'var(--app-font-serif)' }}>E</span>
                    </div>
                    <h1
                        className="text-[28px] font-medium text-[var(--app-fg)] mb-2"
                        style={{ fontFamily: 'var(--app-font-serif)' }}
                    >
                        {title}
                    </h1>
                    <p className="text-[15px] text-[var(--app-hint)]">{subtitle}</p>
                </div>

                {/* Card */}
                <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)] p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Form group: Access Token */}
                        <div>
                            <label className="block text-[13px] font-medium text-[var(--app-fg)] mb-1.5">
                                {t('login.tokenLabel')}
                            </label>
                            <input
                                type="password"
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                                placeholder={t('login.placeholder')}
                                autoComplete="current-password"
                                disabled={isLoading}
                                className={`w-full px-4 py-3.5 rounded-[16px] border bg-[var(--app-panel-elevated-bg)] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:border-[var(--app-link)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.12)] disabled:opacity-60 transition-colors ${
                                    displayError ? 'border-[var(--app-error)]' : 'border-[var(--app-border)]'
                                }`}
                                style={{ fontFamily: 'var(--app-font-mono)', fontSize: '15px' }}
                            />
                            <p className="mt-1.5 text-[12px] text-[var(--app-hint)]">
                                {t('login.tokenHint')}
                            </p>
                        </div>

                        {/* Error */}
                        {displayError && (
                            <div className="flex items-start gap-2 text-sm text-[var(--app-error)]">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 mt-0.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{displayError}</span>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={isLoading || !accessToken.trim()}
                            aria-busy={isLoading}
                            className="w-full py-3.5 rounded-[16px] text-[var(--app-button-text)] font-semibold disabled:opacity-50 hover:opacity-90 hover:-translate-y-px active:translate-y-0 transition-all inline-flex items-center justify-center gap-2"
                            style={{
                                background: 'linear-gradient(135deg, var(--app-link) 0%, #d97757 100%)',
                                fontSize: '15px',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Spinner size="sm" label={null} className="text-[var(--app-button-text)]" />
                                    {isBindMode ? t('login.bind.submitting') : t('login.submitting')}
                                </>
                            ) : (
                                submitLabel
                            )}
                        </button>
                    </form>

                    {/* Links row with separator */}
                    {!isBindMode && (
                        <div className="mt-5 pt-5 border-t border-[var(--app-border)] flex items-center justify-between text-xs text-[var(--app-hint)]">
                            <a href="https://hapi.run/docs" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--app-fg)] transition-colors">
                                {t('login.help')}
                            </a>
                            <Dialog open={isServerDialogOpen} onOpenChange={handleServerDialogOpenChange}>
                                <DialogTrigger asChild>
                                    <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[12px] bg-[var(--app-subtle-bg)] text-[11px] hover:bg-[var(--app-panel-muted-bg)] transition-colors">
                                        Hub {props.serverUrl ? t('login.server.custom') : t('login.server.default')}
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>{t('login.server.title')}</DialogTitle>
                                        <DialogDescription>
                                            {t('login.server.description')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSaveServer} className="space-y-4">
                                        <div className="px-4 py-3 rounded-[12px] bg-[var(--app-subtle-bg)] text-xs">
                                            <span className="font-medium text-[var(--app-fg)]">{t('login.server.current')}</span>{' '}
                                            <span className="text-[var(--app-hint)]">{serverSummary}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-[var(--app-fg)]">{t('login.server.origin')}</label>
                                            <input
                                                type="url"
                                                value={serverInput}
                                                onChange={(e) => {
                                                    setServerInput(e.target.value)
                                                    setServerError(null)
                                                }}
                                                placeholder={t('login.server.placeholder')}
                                                className="w-full px-3 py-2.5 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] focus:border-transparent"
                                            />
                                            <div className="text-[11px] text-[var(--app-hint)]">
                                                {t('login.server.hint')}
                                            </div>
                                        </div>

                                        {serverError && (
                                            <div className="flex items-center gap-2 text-sm text-[var(--app-error)]">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                                {serverError}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-2">
                                            {props.serverUrl && (
                                                <Button type="button" variant="outline" onClick={handleClearServer}>
                                                    {t('login.server.useSameOrigin')}
                                                </Button>
                                            )}
                                            <Button type="submit">
                                                {t('login.server.save')}
                                            </Button>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-[var(--app-hint)] space-y-1">
                <div>{t('login.footer')} <span className="text-red-500">&#9829;</span> {t('login.footer.for')}</div>
                <div>&copy; {new Date().getFullYear()} HAPI</div>
            </div>
        </div>
    )
}
