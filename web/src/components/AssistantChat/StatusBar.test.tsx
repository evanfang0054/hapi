import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('@hapi/protocol', () => ({
    getCodexCollaborationModeLabel: vi.fn(() => 'Plan'),
    getPermissionModeLabel: vi.fn(() => 'Approve'),
    getPermissionModeTone: vi.fn(() => 'neutral'),
    isPermissionModeAllowedForFlavor: vi.fn(() => true),
}))

vi.mock('@/chat/modelConfig', () => ({
    getContextBudgetTokens: vi.fn(() => null),
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            if (key === 'status.backgroundTasks') {
                return `${params?.count} tasks`
            }
            return key
        },
    }),
}))

import { StatusBar } from './StatusBar'

afterEach(() => {
    cleanup()
})

describe('StatusBar background task count', () => {
    it('shows background task count as a secondary status item', () => {
        render(
            <StatusBar
                active
                thinking={false}
                agentState={null}
                backgroundTaskCount={3}
            />
        )

        expect(screen.getByText('3 tasks')).toBeInTheDocument()
    })

    it('keeps collaboration and permission items visible alongside background task count', () => {
        render(
            <StatusBar
                active
                thinking={false}
                agentState={null}
                backgroundTaskCount={3}
                agentFlavor="codex"
                collaborationMode={'plan' as any}
                permissionMode={'acceptEdits' as any}
            />
        )

        expect(screen.getByText('3 tasks')).toBeInTheDocument()
        expect(screen.getByText('Plan')).toBeInTheDocument()
        expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    it('does not render task count when count is zero', () => {
        render(
            <StatusBar
                active
                thinking={false}
                agentState={null}
                backgroundTaskCount={0}
            />
        )

        expect(screen.queryByText(/tasks/)).toBeNull()
    })
})
