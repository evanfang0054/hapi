import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionHeader } from '@/components/SessionHeader'

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        archiveSession: vi.fn(async () => {}),
        renameSession: vi.fn(async () => {}),
        deleteSession: vi.fn(async () => {}),
        isPending: false,
    }),
}))

vi.mock('@/hooks/useTelegram', () => ({
    isTelegramApp: () => false,
}))

vi.mock('@/components/SessionActionMenu', () => ({
    SessionActionMenu: () => null,
}))

vi.mock('@/components/RenameSessionDialog', () => ({
    RenameSessionDialog: () => null,
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}))

function renderWithProviders(ui: React.ReactElement) {
    return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('SessionHeader', () => {
    it('keeps title flavor model and worktree in the session header', () => {
        renderWithProviders(
            <SessionHeader
                session={{
                    id: 'sess-1',
                    active: true,
                    model: 'sonnet',
                    metadata: {
                        name: 'Release prep',
                        flavor: 'claude',
                        worktree: { branch: 'feat/redesign' },
                    },
                } as any}
                onBack={vi.fn()}
                api={null}
            />
        )

        expect(screen.getByText('Release prep')).toBeInTheDocument()
        expect(screen.getByText('claude')).toBeInTheDocument()
        expect(screen.getByText(/model: sonnet/i)).toBeInTheDocument()
        expect(screen.getByText(/Worktree: feat\/redesign/i)).toBeInTheDocument()
    })
})
