import { useState, useRef, useEffect } from 'react'
import { useTranslation, type Locale } from '@/lib/use-translation'
import { getElevenLabsSupportedLanguages, getLanguageDisplayName, type Language } from '@/lib/languages'
import { getFontScaleOptions, useFontScale, type FontScale } from '@/hooks/useFontScale'
import { getTerminalFontSizeOptions, useTerminalFontSize, type TerminalFontSize } from '@/hooks/useTerminalFontSize'
import { useAppearance, useTheme } from '@/hooks/useTheme'
import { useAppContext } from '@/lib/app-context'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PROTOCOL_VERSION } from '@hapi/protocol'

const locales: { value: Locale; nativeLabel: string }[] = [
    { value: 'en', nativeLabel: 'English' },
    { value: 'zh-CN', nativeLabel: '简体中文' },
]

const voiceLanguages = getElevenLabsSupportedLanguages()

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function ChevronDownIcon(props: { open?: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 transition-transform ${props.open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

function ChevronRightIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[var(--app-hint)]">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? 'bg-[var(--app-link)]' : 'bg-[var(--app-subtle-bg)]'}`}
        >
            <span
                className={`pointer-events-none inline-block h-[22px] w-[22px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'} mt-[3px]`}
            />
        </button>
    )
}

function SettingIconBox({ children, variant }: { children: React.ReactNode; variant?: 'default' | 'accent' | 'danger' }) {
    const bgClass = variant === 'accent'
        ? 'bg-[rgba(201,100,66,0.12)] text-[var(--app-link)] [html[data-theme=dark]_&]:bg-[rgba(217,119,87,0.15)]'
        : variant === 'danger'
            ? 'bg-[rgba(181,51,51,0.12)] text-[var(--app-error)]'
            : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'

    return (
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${bgClass}`}>
            {children}
        </div>
    )
}

function SettingRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center justify-between px-4 py-3.5 border-b border-[var(--app-border)] last:border-b-0 text-left hover:bg-[var(--app-subtle-bg)] transition-colors"
        >
            {children}
        </button>
    )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--app-hint)] px-1 mb-2.5">
            {children}
        </p>
    )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="border border-[var(--app-border)] rounded-[var(--app-radius-2xl)] overflow-hidden bg-[var(--app-panel-bg)]">
            {children}
        </div>
    )
}

function DropdownMenu({ open, children }: { open: boolean; children: React.ReactNode }) {
    if (!open) return null
    return (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] shadow-[var(--app-shadow-md)]">
            {children}
        </div>
    )
}

function DropdownOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                selected
                    ? 'bg-[var(--app-panel-muted-bg)] text-[var(--app-link)]'
                    : 'text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]'
            }`}
        >
            <span>{children}</span>
            {selected ? <span className="text-[var(--app-link)] ml-2"><CheckIcon /></span> : null}
        </button>
    )
}

export default function SettingsPage() {
    const { t, locale, setLocale } = useTranslation()
    const { api, connectionState, clearAuth, baseUrl } = useAppContext()
    const [isOpen, setIsOpen] = useState(false)
    const [isFontOpen, setIsFontOpen] = useState(false)
    const [isTerminalFontOpen, setIsTerminalFontOpen] = useState(false)
    const [isVoiceOpen, setIsVoiceOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const fontContainerRef = useRef<HTMLDivElement>(null)
    const terminalFontContainerRef = useRef<HTMLDivElement>(null)
    const voiceContainerRef = useRef<HTMLDivElement>(null)
    const { fontScale, setFontScale } = useFontScale()
    const { terminalFontSize, setTerminalFontSize } = useTerminalFontSize()
    const { setAppearance } = useAppearance()
    const { isDark } = useTheme()

    const [voiceLanguage, setVoiceLanguage] = useState<string | null>(() => {
        return localStorage.getItem('hapi-voice-lang')
    })
    const [voiceEnabled, setVoiceEnabled] = useState(() => {
        return localStorage.getItem('hapi-voice-enabled') !== 'false'
    })
    const [logoutOpen, setLogoutOpen] = useState(false)
    const [pushNotifications, setPushNotifications] = useState(true)
    const [telegramNotifications, setTelegramNotifications] = useState(false)

    const fontScaleOptions = getFontScaleOptions()
    const terminalFontSizeOptions = getTerminalFontSizeOptions()
    const currentLocale = locales.find((loc) => loc.value === locale)
    const currentFontScaleLabel = fontScaleOptions.find((opt) => opt.value === fontScale)?.label ?? '100%'
    const currentTerminalFontSizeLabel = terminalFontSizeOptions.find((opt) => opt.value === terminalFontSize)?.label ?? '13px'
    const currentVoiceLanguage = voiceLanguages.find((lang) => lang.code === voiceLanguage)

    const handleLocaleChange = (newLocale: Locale) => {
        setLocale(newLocale)
        setIsOpen(false)
    }

    const handleDarkModeToggle = (checked: boolean) => {
        setAppearance(checked ? 'dark' : 'light')
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
        if (!isOpen && !isFontOpen && !isTerminalFontOpen && !isVoiceOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
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
    }, [isOpen, isFontOpen, isTerminalFontOpen, isVoiceOpen])

    // Close on escape key
    useEffect(() => {
        if (!isOpen && !isFontOpen && !isTerminalFontOpen && !isVoiceOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                setIsFontOpen(false)
                setIsTerminalFontOpen(false)
                setIsVoiceOpen(false)
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, isFontOpen, isTerminalFontOpen, isVoiceOpen])

    const voiceLanguageDisplay = currentVoiceLanguage
        ? currentVoiceLanguage.code === null
            ? t('settings.voice.autoDetect')
            : getLanguageDisplayName(currentVoiceLanguage)
        : t('settings.voice.autoDetect')

    const isConnected = connectionState === 'connected'

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-[var(--app-panel-bg)] border-b border-[var(--app-border)] px-5 py-4">
                <h1 className="text-[20px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
                    {t('settings.title')}
                </h1>
            </div>

            {/* Scrollable content */}
            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-[600px] px-4 py-5 space-y-6">
                    {/* User Card */}
                    <div>
                        <SettingsCard>
                            <div className="flex items-center gap-3.5 p-4 cursor-pointer hover:border-[var(--app-link)] transition-all rounded-[var(--app-radius-2xl)]">
                                <div
                                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0"
                                    style={{ background: 'linear-gradient(135deg, var(--app-link) 0%, #d97757 100%)' }}
                                >
                                    {t('settings.user.name').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[16px] font-semibold text-[var(--app-fg)]">{t('settings.user.name')}</div>
                                    <div className="text-[13px] text-[var(--app-hint)] mt-0.5" style={{ fontFamily: 'var(--app-font-mono)' }}>{t('settings.user.email')}</div>
                                </div>
                                <ChevronRightIcon />
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Appearance Section */}
                    <div>
                        <SectionTitle>{t('settings.display.title')}</SectionTitle>
                        <SettingsCard>
                            {/* Dark Mode Toggle */}
                            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--app-border)]">
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox variant="accent">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                        </svg>
                                    </SettingIconBox>
                                    <div>
                                        <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.display.darkMode')}</div>
                                        <div className="text-[12px] text-[var(--app-hint)] mt-0.5">{t('settings.display.darkModeDesc')}</div>
                                    </div>
                                </div>
                                <Toggle checked={isDark} onChange={handleDarkModeToggle} />
                            </div>

                            {/* Language */}
                            <div ref={containerRef} className="relative">
                                <SettingRow onClick={() => setIsOpen(!isOpen)}>
                                    <div className="flex items-center gap-3.5">
                                        <SettingIconBox>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="2" y1="12" x2="22" y2="12" />
                                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                            </svg>
                                        </SettingIconBox>
                                        <div>
                                            <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.language.label')}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--app-hint)]">
                                        <span>{currentLocale?.nativeLabel}</span>
                                        <ChevronDownIcon open={isOpen} />
                                    </div>
                                </SettingRow>
                                <DropdownMenu open={isOpen}>
                                    {locales.map((loc) => (
                                        <DropdownOption key={loc.value} selected={locale === loc.value} onClick={() => handleLocaleChange(loc.value)}>
                                            {loc.nativeLabel}
                                        </DropdownOption>
                                    ))}
                                </DropdownMenu>
                            </div>

                            {/* Font Scale */}
                            <div ref={fontContainerRef} className="relative">
                                <SettingRow onClick={() => setIsFontOpen(!isFontOpen)}>
                                    <div className="flex items-center gap-3.5">
                                        <SettingIconBox>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                                <polyline points="4 7 4 4 20 4 20 7" />
                                                <line x1="9" y1="20" x2="15" y2="20" />
                                                <line x1="12" y1="4" x2="12" y2="20" />
                                            </svg>
                                        </SettingIconBox>
                                        <div>
                                            <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.display.fontSize')}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--app-hint)]">
                                        <span>{currentFontScaleLabel}</span>
                                        <ChevronDownIcon open={isFontOpen} />
                                    </div>
                                </SettingRow>
                                <DropdownMenu open={isFontOpen}>
                                    {fontScaleOptions.map((opt) => (
                                        <DropdownOption key={opt.value} selected={fontScale === opt.value} onClick={() => handleFontScaleChange(opt.value)}>
                                            {opt.label}
                                        </DropdownOption>
                                    ))}
                                </DropdownMenu>
                            </div>

                            {/* Terminal Font Size */}
                            <div ref={terminalFontContainerRef} className="relative">
                                <SettingRow onClick={() => setIsTerminalFontOpen(!isTerminalFontOpen)}>
                                    <div className="flex items-center gap-3.5">
                                        <SettingIconBox>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                                <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                                                <polyline points="7 9 10 12 7 15" />
                                                <line x1="12" y1="15" x2="17" y2="15" />
                                            </svg>
                                        </SettingIconBox>
                                        <div>
                                            <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.display.terminalFontSize')}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--app-hint)]">
                                        <span>{currentTerminalFontSizeLabel}</span>
                                        <ChevronDownIcon open={isTerminalFontOpen} />
                                    </div>
                                </SettingRow>
                                <DropdownMenu open={isTerminalFontOpen}>
                                    {terminalFontSizeOptions.map((opt) => (
                                        <DropdownOption key={opt.value} selected={terminalFontSize === opt.value} onClick={() => handleTerminalFontSizeChange(opt.value)}>
                                            {opt.label}
                                        </DropdownOption>
                                    ))}
                                </DropdownMenu>
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Voice Section */}
                    <div>
                        <SectionTitle>{t('settings.voice.title')}</SectionTitle>
                        <SettingsCard>
                            {/* Voice Enable Toggle */}
                            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--app-border)]">
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox variant="accent">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                            <line x1="12" y1="19" x2="12" y2="22" />
                                        </svg>
                                    </SettingIconBox>
                                    <div>
                                        <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.voice.enable')}</div>
                                        <div className="text-[12px] text-[var(--app-hint)] mt-0.5">{t('settings.voice.enableDesc')}</div>
                                    </div>
                                </div>
                                <Toggle checked={voiceEnabled} onChange={(val) => { setVoiceEnabled(val); localStorage.setItem('hapi-voice-enabled', String(val)) }} />
                            </div>

                            {/* Voice Language */}
                            <div ref={voiceContainerRef} className="relative">
                                <SettingRow onClick={() => setIsVoiceOpen(!isVoiceOpen)}>
                                    <div className="flex items-center gap-3.5">
                                        <SettingIconBox>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                                <path d="M12 6v12" />
                                                <path d="M8 9v6" />
                                                <path d="M16 9v6" />
                                                <path d="M4 11v2" />
                                                <path d="M20 11v2" />
                                            </svg>
                                        </SettingIconBox>
                                        <div>
                                            <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.voice.language')}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--app-hint)]">
                                        <span>{voiceLanguageDisplay}</span>
                                        <ChevronDownIcon open={isVoiceOpen} />
                                    </div>
                                </SettingRow>
                                <DropdownMenu open={isVoiceOpen}>
                                    <div className="max-h-[300px] overflow-y-auto min-w-[220px]">
                                        {voiceLanguages.map((lang) => (
                                            <DropdownOption key={lang.code ?? 'auto'} selected={voiceLanguage === lang.code} onClick={() => handleVoiceLanguageChange(lang)}>
                                                {lang.code === null ? t('settings.voice.autoDetect') : getLanguageDisplayName(lang)}
                                            </DropdownOption>
                                        ))}
                                    </div>
                                </DropdownMenu>
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Notifications Section */}
                    <div>
                        <SectionTitle>{t('settings.notifications.title')}</SectionTitle>
                        <SettingsCard>
                            {/* Push Notifications Toggle */}
                            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--app-border)]">
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                        </svg>
                                    </SettingIconBox>
                                    <div>
                                        <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.notifications.push')}</div>
                                        <div className="text-[12px] text-[var(--app-hint)] mt-0.5">{t('settings.notifications.pushDesc')}</div>
                                    </div>
                                </div>
                                <Toggle checked={pushNotifications} onChange={setPushNotifications} />
                            </div>
                            {/* Telegram Notifications Toggle */}
                            <div className="flex items-center justify-between px-4 py-3.5">
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" />
                                        </svg>
                                    </SettingIconBox>
                                    <div>
                                        <div className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.notifications.telegram')}</div>
                                    </div>
                                </div>
                                <Toggle checked={telegramNotifications} onChange={setTelegramNotifications} />
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Server Info Section */}
                    <div>
                        <SectionTitle>{t('settings.server.title')}</SectionTitle>
                        <SettingsCard>
                            <div className="px-4 py-3.5 space-y-1.5" style={{ fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--app-hint)]">Hub URL</span>
                                    <span className="text-[var(--app-fg)]">{baseUrl}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--app-hint)]">{t('settings.server.status')}</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[var(--app-git-staged-color)]' : 'bg-[var(--app-error)]'}`} />
                                        <span className={isConnected ? 'text-[var(--app-git-staged-color)]' : 'text-[var(--app-error)]'}>
                                            {isConnected ? t('settings.server.connected') : t('settings.server.disconnected')}
                                        </span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--app-hint)]">{t('settings.about.appVersion')}</span>
                                    <span className="text-[var(--app-fg)]">{__APP_VERSION__}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[var(--app-hint)]">{t('settings.about.protocolVersion')}</span>
                                    <span className="text-[var(--app-fg)]">{PROTOCOL_VERSION}</span>
                                </div>
                            </div>
                        </SettingsCard>
                    </div>

                    {/* About Section */}
                    <div>
                        <SectionTitle>{t('settings.about.title')}</SectionTitle>
                        <SettingsCard>
                            <a
                                href="https://hapi.run"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                            >
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                        </svg>
                                    </SettingIconBox>
                                    <span className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.about.website')}</span>
                                </div>
                                <ChevronRightIcon />
                            </a>
                            <a
                                href="https://hapi.run/docs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)] transition-colors"
                            >
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                        </svg>
                                    </SettingIconBox>
                                    <span className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.about.documentation')}</span>
                                </div>
                                <ChevronRightIcon />
                            </a>
                            <div className="flex items-center justify-between px-4 py-3.5">
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                    </SettingIconBox>
                                    <span className="text-[15px] font-medium text-[var(--app-fg)]">{t('settings.about.protocolVersion')}</span>
                                </div>
                                <span className="text-[13px] text-[var(--app-hint)]">{PROTOCOL_VERSION}</span>
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Danger Zone — Log Out */}
                    <div>
                        <SectionTitle>{t('settings.danger.title')}</SectionTitle>
                        <SettingsCard>
                            <button
                                type="button"
                                onClick={() => setLogoutOpen(true)}
                                className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-[var(--app-subtle-bg)] transition-colors"
                            >
                                <div className="flex items-center gap-3.5">
                                    <SettingIconBox variant="danger">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                    </SettingIconBox>
                                    <div>
                                        <div className="text-[15px] font-medium text-[var(--app-error)]">{t('settings.danger.logOut')}</div>
                                        <div className="text-[12px] text-[var(--app-hint)] mt-0.5">{t('settings.danger.logOutDesc')}</div>
                                    </div>
                                </div>
                            </button>
                        </SettingsCard>
                    </div>

                    <ConfirmDialog
                        isOpen={logoutOpen}
                        onClose={() => setLogoutOpen(false)}
                        title={t('settings.danger.logOut')}
                        description={t('settings.danger.logOutDesc')}
                        confirmLabel={t('settings.danger.logOut')}
                        confirmingLabel={t('settings.danger.logOut')}
                        onConfirm={async () => clearAuth()}
                        isPending={false}
                        destructive
                    />

                    {/* Bottom padding for mobile tab bar */}
                    <div className="h-20 lg:h-4" />
                </div>
            </div>
        </div>
    )
}
