import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionList } from '@/components/SessionList'
import type { BulkDeleteSummary } from '@/hooks/mutations/useSessionActions'

const longPressHandlers: Array<{ text: string; onLongPress?: () => void }> = []
const toastMock = {
    toasts: [] as { id: string; title: string; body: string }[],
    addToast: vi.fn(),
    removeToast: vi.fn(),
}

vi.mock('@/lib/toast-context', () => ({
    useToast: () => toastMock,
}))
const sessionActionsMock = {
    archiveSession: vi.fn(async () => {}),
    renameSession: vi.fn(async () => {}),
    deleteSession: vi.fn(async () => {}),
    deleteSessions: vi.fn(async (): Promise<BulkDeleteSummary> => ({ successCount: 0, failureCount: 0, failures: [] })),
    isPending: false,
}

vi.mock('@/hooks/useLongPress', () => ({
    useLongPress: ({ onClick, onLongPress }: { onClick?: () => void; onLongPress?: () => void }) => ({
        onClick,
        onMouseDown: vi.fn(),
        onMouseUp: vi.fn(),
        onMouseLeave: vi.fn(),
        onTouchStart: vi.fn(),
        onTouchEnd: vi.fn(),
        ref: (node: HTMLElement | null) => {
            if (!node) return
            const text = node.textContent?.trim()
            if (!text) return
            longPressHandlers.push({ text, onLongPress })
        },
    }),
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({ haptic: { impact: vi.fn() } }),
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => sessionActionsMock,
}))

vi.mock('@/components/RenameSessionDialog', () => ({
    RenameSessionDialog: () => null,
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: ({
        isOpen,
        title,
        description,
        confirmLabel,
        onConfirm,
        onClose,
    }: {
        isOpen: boolean
        title: string
        description: string
        confirmLabel: string
        onConfirm: () => Promise<void>
        onClose: () => void
    }) => {
        if (!isOpen) return null
        return (
            <div>
                <div>{title}</div>
                <div>{description}</div>
                <button type="button" onClick={() => void onConfirm()}>
                    {confirmLabel}
                </button>
                <button type="button" onClick={onClose}>
                    Cancel
                </button>
            </div>
        )
    },
}))

function renderWithProviders(ui: React.ReactElement) {
    cleanup()
    longPressHandlers.length = 0
    sessionActionsMock.archiveSession.mockReset()
    sessionActionsMock.renameSession.mockReset()
    sessionActionsMock.deleteSession.mockReset()
    sessionActionsMock.deleteSessions.mockReset()
    sessionActionsMock.deleteSessions.mockResolvedValue({ successCount: 0, failureCount: 0, failures: [] })
    sessionActionsMock.isPending = false
    toastMock.addToast.mockReset()
    toastMock.removeToast.mockReset()
    return render(<I18nProvider>{ui}</I18nProvider>)
}

async function triggerLongPress(sessionName: string) {
    const matches = [...longPressHandlers].filter((entry) => entry.text.includes(sessionName))
    const exactMatch = matches.find((entry) => entry.text === sessionName)
    const handler = exactMatch
        ?? matches.sort((left, right) => left.text.length - right.text.length)[0]
    await act(async () => {
        handler?.onLongPress?.()
    })
}

const inactiveSession = {
    id: 'sess-inactive',
    active: false,
    thinking: false,
    pendingRequestsCount: 0,
    updatedAt: Date.now(),
    metadata: {
        name: 'Inactive session',
        path: '/Users/arwen/hapi/web',
        machineId: 'machine-1',
    },
} as any

const inactiveSessionB = {
    ...inactiveSession,
    id: 'sess-inactive-b',
    metadata: {
        ...inactiveSession.metadata,
        name: 'Inactive session B',
    },
} as any

const inactiveSessionC = {
    ...inactiveSession,
    id: 'sess-inactive-c',
    metadata: {
        ...inactiveSession.metadata,
        name: 'Inactive session C',
    },
} as any

const activeSession = {
    id: 'sess-active',
    active: true,
    thinking: false,
    pendingRequestsCount: 0,
    updatedAt: Date.now(),
    metadata: {
        name: 'Active session',
        path: '/Users/arwen/hapi/web',
        machineId: 'machine-1',
    },
} as any

const baseProps = {
    onSelect: vi.fn(),
    onNewSession: vi.fn(),
    onRefresh: vi.fn(),
    isLoading: false,
    api: null,
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
                machineLabelsById={{ 'machine-12345678': 'Arwen Mac' }}
                {...baseProps}
            />
        )

        expect(screen.getAllByText('Design sync').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('/Users/arwen/hapi/web').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('1/4')).toBeInTheDocument()
        expect(screen.getByText(/Pending 3/i)).toBeInTheDocument()
        expect(screen.getByText('claude')).toBeInTheDocument()
        expect(screen.getByText(/model: sonnet/i)).toBeInTheDocument()
        expect(screen.getByText(/feat\/redesign/i)).toBeInTheDocument()
        expect(screen.getByText('Arwen Mac')).toBeInTheDocument()
    })

    it('keeps session action menu reachable outside selection mode', () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession]}
                selectedSessionId={inactiveSession.id}
            />
        )

        fireEvent.contextMenu(screen.getByRole('button', { name: /inactive session/i }))

        expect(screen.getByText('More actions')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    })

    it('keeps session action menu reachable through explicit button outside selection mode', () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession]}
                selectedSessionId={inactiveSession.id}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'More actions' }))

        expect(screen.getByText('More actions')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    })

    it('enters selection mode on long press and selects the pressed inactive session', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession]}
                selectedSessionId={inactiveSession.id}
            />
        )

        await triggerLongPress(inactiveSession.metadata.name)

        expect(screen.getByRole('button', { name: /^Delete \(1\)$/i })).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: inactiveSession.metadata.name })).toHaveAttribute('aria-checked', 'true')
    })

    it('does not auto-select an active session on long press', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[activeSession]}
                selectedSessionId={activeSession.id}
            />
        )

        await triggerLongPress(activeSession.metadata.name)

        expect(screen.getByRole('checkbox', { name: activeSession.metadata.name })).toHaveAttribute('aria-checked', 'true')
    })

    it('allows selecting active sessions in selection mode', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[activeSession, inactiveSession]}
                selectedSessionId={inactiveSession.id}
            />
        )

        await triggerLongPress(inactiveSession.metadata.name)
        fireEvent.click(screen.getByRole('checkbox', { name: activeSession.metadata.name }))

        expect(screen.getByRole('checkbox', { name: activeSession.metadata.name })).toHaveAttribute('aria-checked', 'true')
    })

    it('prunes removed selected sessions when sessions change', async () => {
        const view = renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession]}
                selectedSessionId={inactiveSession.id}
            />
        )

        await triggerLongPress(inactiveSession.metadata.name)
        expect(screen.getByRole('button', { name: /^Delete \(1\)$/i })).toBeEnabled()

        view.rerender(
            <I18nProvider>
                <SessionList
                    {...baseProps}
                    sessions={[]}
                    selectedSessionId={null}
                />
            </I18nProvider>
        )

        expect(screen.queryByRole('checkbox', { name: inactiveSession.metadata.name })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument()
    })

    it('clears selection state when selection mode is cancelled', async () => {
        vi.useFakeTimers()
        try {
            renderWithProviders(
                <SessionList
                    {...baseProps}
                    sessions={[inactiveSession]}
                    selectedSessionId={inactiveSession.id}
                />
            )

            await triggerLongPress(inactiveSession.metadata.name)
            fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
            await act(async () => { vi.advanceTimersByTime(250) })

            expect(screen.queryByRole('checkbox', { name: inactiveSession.metadata.name })).not.toBeInTheDocument()
        } finally {
            vi.useRealTimers()
        }
    })

    it('shows bulk delete confirmation with selected count', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession, inactiveSessionB]}
                selectedSessionId={inactiveSession.id}
            />
        )

        await triggerLongPress(inactiveSession.metadata.name)
        fireEvent.click(screen.getByRole('checkbox', { name: inactiveSessionB.metadata.name }))
        fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/i }))

        expect(screen.getByText(/delete 2 sessions\?/i)).toBeInTheDocument()
    })

    it('shows partial failure summary after bulk delete', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession, inactiveSessionB, inactiveSessionC]}
                selectedSessionId={inactiveSession.id}
            />
        )
        sessionActionsMock.deleteSessions.mockResolvedValue({
            successCount: 1,
            failureCount: 2,
            failures: [
                { sessionId: 'sess-inactive-b', reason: 'Cannot delete active session' },
                { sessionId: 'sess-inactive-c', reason: 'Session not found' },
            ],
        })

        await triggerLongPress(inactiveSession.metadata.name)
        fireEvent.click(screen.getByRole('checkbox', { name: inactiveSessionB.metadata.name }))
        fireEvent.click(screen.getByRole('checkbox', { name: inactiveSessionC.metadata.name }))
        fireEvent.click(screen.getByRole('button', { name: /^Delete \(3\)$/i }))
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /delete selected/i }))
        })

        expect(toastMock.addToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: expect.stringMatching(/1/),
                body: expect.stringMatching(/2/),
            })
        )
    })

    it('keeps selection mode active when bulk delete request fails unexpectedly', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession, inactiveSessionB]}
                selectedSessionId={inactiveSession.id}
            />
        )
        sessionActionsMock.deleteSessions.mockRejectedValue(new Error('Session unavailable'))

        await triggerLongPress(inactiveSession.metadata.name)
        fireEvent.click(screen.getByRole('checkbox', { name: inactiveSessionB.metadata.name }))
        fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/i }))
        fireEvent.click(screen.getByRole('button', { name: /delete selected/i }))

        expect(screen.getByRole('button', { name: /^Delete \(2\)$/i })).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: inactiveSession.metadata.name })).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('checkbox', { name: inactiveSessionB.metadata.name })).toHaveAttribute('aria-checked', 'true')
    })

    it('clears selected ids after bulk delete completes', async () => {
        renderWithProviders(
            <SessionList
                {...baseProps}
                sessions={[inactiveSession, inactiveSessionB]}
                selectedSessionId={inactiveSession.id}
            />
        )
        sessionActionsMock.deleteSessions.mockResolvedValue({
            successCount: 2,
            failureCount: 0,
            failures: [],
        })

        await triggerLongPress(inactiveSession.metadata.name)
        fireEvent.click(screen.getByRole('checkbox', { name: inactiveSessionB.metadata.name }))
        fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/i }))
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /delete selected/i }))
        })

        expect(toastMock.addToast).toHaveBeenCalledWith(
            expect.objectContaining({ title: expect.stringMatching(/2/) })
        )
        expect(screen.queryByRole('checkbox', { name: inactiveSession.metadata.name })).not.toBeInTheDocument()
        expect(screen.queryByRole('checkbox', { name: inactiveSessionB.metadata.name })).not.toBeInTheDocument()
    })
})
