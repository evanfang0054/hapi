import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { NewSession } from './index'
import type { Machine } from '@/types/api'

const checkPathsExists = vi.fn(async (_machineId: string, paths: string[]) => ({
    exists: Object.fromEntries(paths.map((path) => [path, path !== '/missing/project']))
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            notification: vi.fn(),
            impact: vi.fn(),
            selection: vi.fn(),
        },
    }),
}))

vi.mock('@/hooks/queries/useSessions', () => ({
    useSessions: () => ({
        sessions: [
            {
                id: 'sess-1',
                metadata: {
                    machineId: 'machine-1',
                    path: '/repo/current',
                    worktree: { basePath: '/repo/worktree-base', branch: 'feat/base' },
                },
            },
        ],
    }),
}))

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>{ui}</I18nProvider>
        </QueryClientProvider>
    )
}

describe('NewSession', () => {
    it('keeps machine directory agent model effort worktree recent paths and status messaging visible', async () => {
        localStorage.setItem('hapi:newSession:agent', 'claude')
        localStorage.setItem('hapi:newSession:yolo', 'false')
        localStorage.setItem('hapi:lastMachineId', 'machine-1')
        localStorage.setItem('hapi:recentPaths', JSON.stringify({
            'machine-1': ['/recent/project', '/missing/project'],
        }))

        const api = {
            checkMachinePathsExists: checkPathsExists,
        } as any

        renderWithProviders(
            <NewSession
                api={api}
                machines={[
                    {
                        id: 'machine-1',
                        active: true,
                        metadata: {
                            host: 'arwen.local',
                            platform: 'darwin',
                            happyCliVersion: '0.16.9-beta.3',
                            displayName: 'Arwen Mac',
                        },
                    } satisfies Machine,
                ]}
                onSuccess={vi.fn()}
                onCancel={vi.fn()}
            />
        )

        expect(await screen.findByText('Machine')).toBeInTheDocument()
        expect(screen.getByText('Directory')).toBeInTheDocument()
        expect(screen.getByText('Agent')).toBeInTheDocument()
        expect(screen.getByText('Model')).toBeInTheDocument()
        expect(screen.getByText('Effort')).toBeInTheDocument()
        expect(screen.getAllByText('(optional)')).toHaveLength(2)
        expect(screen.getByText('Session type')).toBeInTheDocument()
        expect(screen.getByText('Bypass approvals and sandbox')).toBeInTheDocument()
        expect(screen.getByText('Recent paths:')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '/recent/project' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()

        const directoryInput = screen.getByPlaceholderText('/path/to/project')
        fireEvent.change(directoryInput, { target: { value: '' } })
        fireEvent.change(directoryInput, { target: { value: '/missing/project' } })

        expect(await screen.findByText('Directory does not exist. Creating the session will create it automatically.')).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Worktree'))
        expect(await screen.findByPlaceholderText('feature-x (default 1228-xxxx)')).toBeInTheDocument()
        expect(screen.getByText('Worktree sessions require an existing repository directory.')).toBeInTheDocument()

        await waitFor(() => {
            expect(checkPathsExists).toHaveBeenCalled()
        })
    })
})
