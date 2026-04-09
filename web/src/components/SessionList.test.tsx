import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionList } from '@/components/SessionList'

vi.mock('@/hooks/useLongPress', () => ({
    useLongPress: ({ onClick }: { onClick?: () => void }) => ({
        onClick,
        onMouseDown: vi.fn(),
        onMouseUp: vi.fn(),
        onMouseLeave: vi.fn(),
        onTouchStart: vi.fn(),
        onTouchEnd: vi.fn(),
    }),
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({ haptic: { impact: vi.fn() } }),
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        archiveSession: vi.fn(async () => {}),
        renameSession: vi.fn(async () => {}),
        deleteSession: vi.fn(async () => {}),
        isPending: false,
    }),
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

describe('SessionList', () => {
    it('keeps session summary, path, todo, pending, flavor, model and worktree visible', () => {
        renderWithProviders(
            <SessionList
                sessions={[
                    {
                        id: 'sess-1',
                        active: true,
                        thinking: true,
                        pendingRequestsCount: 3,
                        updatedAt: Date.now(),
                        todoProgress: { completed: 1, total: 4 },
                        model: 'sonnet',
                        metadata: {
                            name: 'Design sync',
                            path: '/Users/arwen/hapi/web',
                            flavor: 'claude',
                            machineId: 'machine-12345678',
                            worktree: {
                                branch: 'feat/redesign',
                                basePath: '/Users/arwen/hapi/web',
                            },
                        },
                    } as any,
                ]}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                api={null}
                machineLabelsById={{ 'machine-12345678': 'Arwen Mac' }}
            />
        )

        expect(screen.getAllByText('Design sync').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('/Users/arwen/hapi/web').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('1/4')).toBeInTheDocument()
        expect(screen.getByText(/Pending 3/i)).toBeInTheDocument()
        expect(screen.getByText('claude')).toBeInTheDocument()
        expect(screen.getByText(/model: sonnet/i)).toBeInTheDocument()
        expect(screen.getByText(/Worktree: feat\/redesign/i)).toBeInTheDocument()
        expect(screen.getByText('Arwen Mac')).toBeInTheDocument()
    })
})
