import { useState, useRef, useEffect } from 'react'
import { useTranslation, type Locale } from '@/lib/use-translation'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { getElevenLabsSupportedLanguages, getLanguageDisplayName, type Language } from '@/lib/languages'
import { getFontScaleOptions, useFontScale, type FontScale } from '@/hooks/useFontScale'
import { getTerminalFontSizeOptions, useTerminalFontSize, type TerminalFontSize } from '@/hooks/useTerminalFontSize'
import { useAppearance, getAppearanceOptions, type AppearancePreference } from '@/hooks/useTheme'
import { PROTOCOL_VERSION } from '@hapi/protocol'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const locales: { value: Locale; nativeLabel: string }[] = [
    { value: 'en', nativeLabel: 'English' },
    { value: 'zh-CN', nativeLabel: '简体中文' },
]

const voiceLanguages = getElevenLabsSupportedLanguages()

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

function CheckIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function ChevronDownIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

export default function SettingsPage() {
    const { t, locale, setLocale } = useTranslation()
    const goBack = useAppGoBack()
    const [isOpen, setIsOpen] = useState(false)
    const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
    const [isFontOpen, setIsFontOpen] = useState(false)
    const [isTerminalFontOpen, setIsTerminalFontOpen] = useState(false)
    const [isVoiceOpen, setIsVoiceOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const appearanceContainerRef = useRef<HTMLDivElement>(null)
    const fontContainerRef = useRef<HTMLDivElement>(null)
    const terminalFontContainerRef = useRef<HTMLDivElement>(null)
    const voiceContainerRef = useRef<HTMLDivElement>(null)
    const { fontScale, setFontScale } = useFontScale()
    const { terminalFontSize, setTerminalFontSize } = useTerminalFontSize()
    const { appearance, setAppearance } = useAppearance()

    // Voice language state - read from localStorage
    const [voiceLanguage, setVoiceLanguage] = useState<string | null>(() => {
        return localStorage.getItem('hapi-voice-lang')
    })

    const fontScaleOptions = getFontScaleOptions()
    const terminalFontSizeOptions = getTerminalFontSizeOptions()
    const appearanceOptions = getAppearanceOptions()
    const currentLocale = locales.find((loc) => loc.value === locale)
    const currentAppearanceLabel = appearanceOptions.find((opt) => opt.value === appearance)?.labelKey ?? 'settings.display.appearance.system'
    const currentFontScaleLabel = fontScaleOptions.find((opt) => opt.value === fontScale)?.label ?? '100%'
    const currentTerminalFontSizeLabel = terminalFontSizeOptions.find((opt) => opt.value === terminalFontSize)?.label ?? '13px'
    const currentVoiceLanguage = voiceLanguages.find((lang) => lang.code === voiceLanguage)

    const handleLocaleChange = (newLocale: Locale) => {
        setLocale(newLocale)
        setIsOpen(false)
    }

    const handleAppearanceChange = (pref: AppearancePreference) => {
        setAppearance(pref)
        setIsAppearanceOpen(false)
    }

    const handleFontScaleChange = (newScale: FontScale) => {
        setFontScale(newScale)
        setIsFontOpen(false)
    }

    const handleTerminalFontSizeChange = (newSize: TerminalFontSize) => {
        setTerminalFontSize(newSize)
        setIsTerminalFontOpen(false)
    }

    const handleVoiceLanguageChange = (language: Language) => {
        setVoiceLanguage(language.code)
        if (language.code === null) {
            localStorage.removeItem('hapi-voice-lang')
        } else {
            localStorage.setItem('hapi-voice-lang', language.code)
        }
        setIsVoiceOpen(false)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isOpen && !isAppearanceOpen && !isFontOpen && !isTerminalFontOpen && !isVoiceOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
            if (isAppearanceOpen && appearanceContainerRef.current && !appearanceContainerRef.current.contains(event.target as Node)) {
                setIsAppearanceOpen(false)
            }
            if (isFontOpen && fontContainerRef.current && !fontContainerRef.current.contains(event.target as Node)) {
                setIsFontOpen(false)
            }
            if (isTerminalFontOpen && terminalFontContainerRef.current && !terminalFontContainerRef.current.contains(event.target as Node)) {
                setIsTerminalFontOpen(false)
            }
            if (isVoiceOpen && voiceContainerRef.current && !voiceContainerRef.current.contains(event.target as Node)) {
                setIsVoiceOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, isAppearanceOpen, isFontOpen, isTerminalFontOpen, isVoiceOpen])

    // Close on escape key
    useEffect(() => {
        if (!isOpen && !isAppearanceOpen && !isFontOpen && !isTerminalFontOpen && !isVoiceOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                setIsAppearanceOpen(false)
                setIsFontOpen(false)
                setIsTerminalFontOpen(false)
                setIsVoiceOpen(false)
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, isAppearanceOpen, isFontOpen, isTerminalFontOpen, isVoiceOpen])

    const sectionTitleClassName = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint)]'
    const rowButtonClassName = 'flex w-full items-center justify-between rounded-[var(--app-radius-control)] border border-transparent px-4 py-3 text-left transition-colors hover:border-[var(--app-border)] hover:bg-[var(--app-panel-muted-bg)]'
    const valueClassName = 'flex items-center gap-1 text-[var(--app-hint)]'
    const menuClassName = 'absolute right-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] shadow-[var(--app-shadow-md)]'
    const menuOptionClassName = 'flex w-full items-center justify-between px-3 py-2 text-base text-left transition-colors'

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-content px-3 py-4 md:px-5 md:py-6">
                    <div className="space-y-4">
                        <Card className="overflow-visible border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)]">
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
                                                    {t('settings.eyebrow')}
                                                </p>
                                                <CardTitle className="mt-2 text-3xl leading-none" data-ui-heading="serif">
                                                    {t('settings.title')}
                                                </CardTitle>
                                            </div>
                                        </div>
                                        <CardDescription className="max-w-3xl text-sm leading-6 text-[var(--app-hint)]">
                                            {t('settings.description')}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="px-5 py-5 sm:px-6">
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
                                    <div className="space-y-4">
                                        <section className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-4 shadow-[var(--app-shadow-sm)]">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className={sectionTitleClassName}>{t('settings.language.title')}</p>
                                                </div>
                                                <div ref={containerRef} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsOpen(!isOpen)}
                                                        className={rowButtonClassName}
                                                        aria-expanded={isOpen}
                                                        aria-haspopup="listbox"
                                                    >
                                                        <span className="text-[var(--app-fg)]">{t('settings.language.label')}</span>
                                                        <span className={valueClassName}>
                                                            <span>{currentLocale?.nativeLabel}</span>
                                                            <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </button>

                                                    {isOpen && (
                                                        <div
                                                            className={menuClassName}
                                                            role="listbox"
                                                            aria-label={t('settings.language.title')}
                                                        >
                                                            {locales.map((loc) => {
                                                                const isSelected = locale === loc.value
                                                                return (
                                                                    <button
                                                                        key={loc.value}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        onClick={() => handleLocaleChange(loc.value)}
                                                                        className={`${menuOptionClassName} ${isSelected
                                                                            ? 'bg-[var(--app-panel-muted-bg)] text-[var(--app-link)]'
                                                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'}`}
                                                                    >
                                                                        <span>{loc.nativeLabel}</span>
                                                                        {isSelected ? (
                                                                            <span className="ml-2 text-[var(--app-link)]">
                                                                                <CheckIcon />
                                                                            </span>
                                                                        ) : null}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-4 shadow-[var(--app-shadow-sm)]">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className={sectionTitleClassName}>{t('settings.display.title')}</p>
                                                </div>
                                                <div ref={appearanceContainerRef} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsAppearanceOpen(!isAppearanceOpen)}
                                                        className={rowButtonClassName}
                                                        aria-expanded={isAppearanceOpen}
                                                        aria-haspopup="listbox"
                                                    >
                                                        <span className="text-[var(--app-fg)]">{t('settings.display.appearance')}</span>
                                                        <span className={valueClassName}>
                                                            <span>{t(currentAppearanceLabel)}</span>
                                                            <ChevronDownIcon className={`transition-transform ${isAppearanceOpen ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </button>

                                                    {isAppearanceOpen && (
                                                        <div
                                                            className={menuClassName}
                                                            role="listbox"
                                                            aria-label={t('settings.display.appearance')}
                                                        >
                                                            {appearanceOptions.map((opt) => {
                                                                const isSelected = appearance === opt.value
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        onClick={() => handleAppearanceChange(opt.value)}
                                                                        className={`${menuOptionClassName} ${isSelected
                                                                            ? 'bg-[var(--app-panel-muted-bg)] text-[var(--app-link)]'
                                                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'}`}
                                                                    >
                                                                        <span>{t(opt.labelKey)}</span>
                                                                        {isSelected ? (
                                                                            <span className="ml-2 text-[var(--app-link)]">
                                                                                <CheckIcon />
                                                                            </span>
                                                                        ) : null}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div ref={fontContainerRef} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsFontOpen(!isFontOpen)}
                                                        className={rowButtonClassName}
                                                        aria-expanded={isFontOpen}
                                                        aria-haspopup="listbox"
                                                    >
                                                        <span className="text-[var(--app-fg)]">{t('settings.display.fontSize')}</span>
                                                        <span className={valueClassName}>
                                                            <span>{currentFontScaleLabel}</span>
                                                            <ChevronDownIcon className={`transition-transform ${isFontOpen ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </button>

                                                    {isFontOpen && (
                                                        <div
                                                            className={menuClassName}
                                                            role="listbox"
                                                            aria-label={t('settings.display.fontSize')}
                                                        >
                                                            {fontScaleOptions.map((opt) => {
                                                                const isSelected = fontScale === opt.value
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        onClick={() => handleFontScaleChange(opt.value)}
                                                                        className={`${menuOptionClassName} ${isSelected
                                                                            ? 'bg-[var(--app-panel-muted-bg)] text-[var(--app-link)]'
                                                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'}`}
                                                                    >
                                                                        <span>{opt.label}</span>
                                                                        {isSelected ? (
                                                                            <span className="ml-2 text-[var(--app-link)]">
                                                                                <CheckIcon />
                                                                            </span>
                                                                        ) : null}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div ref={terminalFontContainerRef} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsTerminalFontOpen(!isTerminalFontOpen)}
                                                        className={rowButtonClassName}
                                                        aria-expanded={isTerminalFontOpen}
                                                        aria-haspopup="listbox"
                                                    >
                                                        <span className="text-[var(--app-fg)]">{t('settings.display.terminalFontSize')}</span>
                                                        <span className={valueClassName}>
                                                            <span>{currentTerminalFontSizeLabel}</span>
                                                            <ChevronDownIcon className={`transition-transform ${isTerminalFontOpen ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </button>

                                                    {isTerminalFontOpen && (
                                                        <div
                                                            className={menuClassName}
                                                            role="listbox"
                                                            aria-label={t('settings.display.terminalFontSize')}
                                                        >
                                                            {terminalFontSizeOptions.map((opt) => {
                                                                const isSelected = terminalFontSize === opt.value
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        onClick={() => handleTerminalFontSizeChange(opt.value)}
                                                                        className={`${menuOptionClassName} ${isSelected
                                                                            ? 'bg-[var(--app-panel-muted-bg)] text-[var(--app-link)]'
                                                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'}`}
                                                                    >
                                                                        <span>{opt.label}</span>
                                                                        {isSelected ? (
                                                                            <span className="ml-2 text-[var(--app-link)]">
                                                                                <CheckIcon />
                                                                            </span>
                                                                        ) : null}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    <div className="space-y-4">
                                        <section className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-4 shadow-[var(--app-shadow-sm)]">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className={sectionTitleClassName}>{t('settings.voice.title')}</p>
                                                </div>
                                                <div ref={voiceContainerRef} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsVoiceOpen(!isVoiceOpen)}
                                                        className={rowButtonClassName}
                                                        aria-expanded={isVoiceOpen}
                                                        aria-haspopup="listbox"
                                                    >
                                                        <span className="text-[var(--app-fg)]">{t('settings.voice.language')}</span>
                                                        <span className={valueClassName}>
                                                            <span>
                                                                {currentVoiceLanguage
                                                                    ? currentVoiceLanguage.code === null
                                                                        ? t('settings.voice.autoDetect')
                                                                        : getLanguageDisplayName(currentVoiceLanguage)
                                                                    : t('settings.voice.autoDetect')}
                                                            </span>
                                                            <ChevronDownIcon className={`transition-transform ${isVoiceOpen ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </button>

                                                    {isVoiceOpen && (
                                                        <div
                                                            className={`${menuClassName} max-h-[300px] overflow-y-auto min-w-[220px]`}
                                                            role="listbox"
                                                            aria-label={t('settings.voice.title')}
                                                        >
                                                            {voiceLanguages.map((lang) => {
                                                                const isSelected = voiceLanguage === lang.code
                                                                const displayName = lang.code === null
                                                                    ? t('settings.voice.autoDetect')
                                                                    : getLanguageDisplayName(lang)
                                                                return (
                                                                    <button
                                                                        key={lang.code ?? 'auto'}
                                                                        type="button"
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        onClick={() => handleVoiceLanguageChange(lang)}
                                                                        className={`${menuOptionClassName} ${isSelected
                                                                            ? 'bg-[var(--app-panel-muted-bg)] text-[var(--app-link)]'
                                                                            : 'text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'}`}
                                                                    >
                                                                        <span>{displayName}</span>
                                                                        {isSelected ? (
                                                                            <span className="ml-2 text-[var(--app-link)]">
                                                                                <CheckIcon />
                                                                            </span>
                                                                        ) : null}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-[var(--app-radius-panel)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-4 shadow-[var(--app-shadow-sm)]">
                                            <div className="space-y-3">
                                                <div>
                                                    <p className={sectionTitleClassName}>{t('settings.about.title')}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between rounded-[var(--app-radius-control)] px-4 py-3">
                                                        <span className="text-[var(--app-fg)]">{t('settings.about.website')}</span>
                                                        <a
                                                            href="https://hapi.run"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[var(--app-link)] hover:underline"
                                                        >
                                                            hapi.run
                                                        </a>
                                                    </div>
                                                    <div className="flex items-center justify-between rounded-[var(--app-radius-control)] px-4 py-3">
                                                        <span className="text-[var(--app-fg)]">{t('settings.about.appVersion')}</span>
                                                        <span className="text-[var(--app-hint)]">{__APP_VERSION__}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between rounded-[var(--app-radius-control)] px-4 py-3">
                                                        <span className="text-[var(--app-fg)]">{t('settings.about.protocolVersion')}</span>
                                                        <span className="text-[var(--app-hint)]">{PROTOCOL_VERSION}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
