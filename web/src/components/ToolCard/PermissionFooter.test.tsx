import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ApiClient } from '@/api/client'
import type { ChatToolCall } from '@/chat/types'
import { PermissionFooter } from './PermissionFooter'

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            notification: vi.fn()
        }
    })
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}))

function createApi(overrides?: Partial<ApiClient>): ApiClient {
    return {
        approvePermission: vi.fn().mockResolvedValue(undefined),
        denyPermission: vi.fn().mockResolvedValue(undefined),
        ...overrides
    } as unknown as ApiClient & Partial<ApiClient>
}

function createTool(overrides?: Partial<ChatToolCall>): ChatToolCall {
    return {
        id: 'tool-1',
        name: 'exit_plan_mode',
        state: 'completed',
        input: { plan: 'ship it' },
        createdAt: 0,
        startedAt: 0,
        completedAt: 0,
        description: null,
        permission: {
            id: 'permission-1',
            status: 'pending'
        },
        ...overrides
    }
}

const baseProps = {
    api: createApi(),
    sessionId: 'session-1',
    metadata: {
        path: '/tmp/project',
        host: 'localhost',
        flavor: 'claude'
    },
    tool: createTool(),
    disabled: false,
    onDone: vi.fn()
} as const

describe('PermissionFooter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        cleanup()
    })

    it('shows post-plan controls only for exit_plan_mode approvals', () => {
        render(
            <PermissionFooter
                {...baseProps}
                tool={createTool({ name: 'exit_plan_mode', input: { plan: 'do thing' } })}
            />
        )

        expect(screen.getByLabelText(/post-plan permission mode/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/implementation mode/i)).toBeInTheDocument()
    })

    it('keeps extra controls hidden for normal approvals', () => {
        render(
            <PermissionFooter
                {...baseProps}
                tool={createTool({ name: 'Bash', input: { command: 'pwd' } })}
            />
        )

        expect(screen.queryByLabelText(/post-plan permission mode/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/implementation mode/i)).not.toBeInTheDocument()
    })

    it('does not offer unsupported plan mode for exit plan approvals', () => {
        render(
            <PermissionFooter
                {...baseProps}
                tool={createTool({ name: 'exit_plan_mode', input: { plan: 'ship it' } })}
            />
        )

        const modeSelect = screen.getByLabelText(/post-plan permission mode/i) as HTMLSelectElement
        const optionValues = Array.from(modeSelect.options).map((option) => option.value)

        expect(optionValues).toEqual(['default', 'acceptEdits', 'bypassPermissions'])
    })

    it('submits selected mode and contextAction for exit plan approvals', async () => {
        const approvePermission = vi.fn().mockResolvedValue(undefined)

        render(
            <PermissionFooter
                {...baseProps}
                api={createApi({ approvePermission })}
                tool={createTool({ name: 'ExitPlanMode', input: { plan: 'ship it' } })}
            />
        )

        fireEvent.change(screen.getByLabelText(/post-plan permission mode/i), {
            target: { value: 'acceptEdits' }
        })
        fireEvent.change(screen.getByLabelText(/implementation mode/i), {
            target: { value: 'clear_context' }
        })
        fireEvent.click(screen.getByRole('button', { name: /tool\.allow/i }))

        expect(approvePermission).toHaveBeenCalledWith('session-1', 'permission-1', {
            mode: 'acceptEdits',
            contextAction: 'clear_context'
        })
    })

    it('defaults exit plan approval to default mode and keep_context', async () => {
        const approvePermission = vi.fn().mockResolvedValue(undefined)

        render(
            <PermissionFooter
                {...baseProps}
                api={createApi({ approvePermission })}
                tool={createTool({ name: 'exit_plan_mode', input: { plan: 'ship it' } })}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /tool\.allow/i }))

        expect(approvePermission).toHaveBeenCalledWith('session-1', 'permission-1', {
            mode: 'default',
            contextAction: 'keep_context'
        })
    })
})
