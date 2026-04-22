import { useState, useRef, useEffect } from 'react'
import { useTranslation, type Locale } from '@/lib/use-translation'

const locales: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
]

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLabel = locales.find(l => l.value === locale)?.label ?? 'English'

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-[20px] bg-[var(--app-panel-elevated-bg)] border border-[var(--app-border)] text-[13px] text-[var(--app-hint)] hover:text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] transition-all"
        title={t('language.title')}
        aria-label={t('language.title')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <GlobeIcon />
        <span>{currentLabel}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[140px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg overflow-hidden z-50"
          role="listbox"
          aria-label={t('language.title')}
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
                className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors ${
                  isSelected
                    ? 'text-[var(--app-link)] bg-[var(--app-subtle-bg)]'
                    : 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]'
                }`}
              >
                <span>{loc.label}</span>
                {isSelected && (
                  <span className="ml-2 text-[var(--app-link)]">
                    <CheckIcon />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
