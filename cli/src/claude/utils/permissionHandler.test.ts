import { describe, expect, it, vi } from 'vitest'
import { PLAN_FAKE_REJECT, PLAN_FAKE_RESTART } from '../sdk/prompts'
import { PermissionHandler } from './permissionHandler'
import type { PermissionResult } from '../sdk/types'
import type { Session } from '../session'
import type { AgentState } from '@/api/types'

type PermissionResponse = {
    id: string
    approved: boolean
    reason?: string
    mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
    contextAction?: 'keep_context' | 'clear_context'
}

class TestPermissionHandler extends PermissionHandler {
    registerPending(id: string, toolName: string, input: unknown = {}) {
        const resolve = vi.fn<(value: PermissionResult) => void>()
        const reject = vi.fn<(error: Error) => void>()
        this.addPendingRequest(id, toolName, input, { resolve, reject })
        return { resolve, reject }
    }
}

function createHarness() {
    let agentState: AgentState = {
        requests: {},
        completedRequests: {}
    } as AgentState

    const rpcHandlers = new Map<string, (params: unknown) => Promise<unknown> | unknown>()
    const queue = {
        unshift: vi.fn(),
        pushIsolateAndClear: vi.fn(),
        reset: vi.fn()
    }
    const setPermissionMode = vi.fn()
    const metadata = { claudeSessionId: 'abc', path: '/tmp/project' }

    const session = {
        client: {
            rpcHandlerManager: {
                registerHandler(method: string, handler: (params: unknown) => Promise<unknown> | unknown) {
                    rpcHandlers.set(method, handler)
                }
            },
            updateAgentState(handler: (state: AgentState) => AgentState) {
                agentState = handler(agentState)
            }
        },
        queue,
        setPermissionMode,
        metadata
    } as unknown as Session

    const handler = new TestPermissionHandler(session)
    const permissionRpc = rpcHandlers.get('permission') as ((params: PermissionResponse) => Promise<void>) | undefined

    return {
        handler,
        queue,
        metadata,
        setPermissionMode,
        getAgentState: () => agentState,
        permissionRpc
    }
}

describe('PermissionHandler exit plan context transitions', () => {
    it('keeps normal permission approvals unchanged', async () => {
        const { handler, permissionRpc } = createHarness()
        const pending = handler.registerPending('perm-0', 'Bash', { command: 'pwd' })

        await permissionRpc?.({
            id: 'perm-0',
            approved: true,
            mode: 'default'
        })

        expect(pending.resolve).toHaveBeenCalledWith({
            behavior: 'allow',
            updatedInput: { command: 'pwd' }
        })
    })

    it('uses selected permission mode when exit plan approval keeps context', async () => {
        const { handler, queue, permissionRpc } = createHarness()
        const pending = handler.registerPending('perm-1', 'exit_plan_mode')

        await permissionRpc?.({
            id: 'perm-1',
            approved: true,
            mode: 'acceptEdits',
            contextAction: 'keep_context'
        })

        expect(queue.unshift).toHaveBeenCalledWith(PLAN_FAKE_RESTART, { permissionMode: 'acceptEdits' })
        expect(queue.pushIsolateAndClear).not.toHaveBeenCalled()
        expect(queue.reset).not.toHaveBeenCalled()
        expect(pending.resolve).toHaveBeenCalledWith({ behavior: 'deny', message: PLAN_FAKE_REJECT })
    })

    it('clears plan execution context before restarting implementation', async () => {
        const { handler, queue, permissionRpc } = createHarness()
        const pending = handler.registerPending('perm-2', 'ExitPlanMode')

        await permissionRpc?.({
            id: 'perm-2',
            approved: true,
            mode: 'default',
            contextAction: 'clear_context'
        })

        expect(queue.pushIsolateAndClear).toHaveBeenCalledWith(PLAN_FAKE_RESTART, { permissionMode: 'default' })
        expect(queue.unshift).not.toHaveBeenCalled()
        expect(pending.resolve).toHaveBeenCalledWith({ behavior: 'deny', message: PLAN_FAKE_REJECT })
    })

    it('does not clear durable session metadata when clearing context', async () => {
        const { handler, metadata, permissionRpc } = createHarness()
        handler.registerPending('perm-3', 'exit_plan_mode')

        await permissionRpc?.({
            id: 'perm-3',
            approved: true,
            contextAction: 'clear_context'
        })

        expect(metadata).toEqual({ claudeSessionId: 'abc', path: '/tmp/project' })
    })

    it('records contextAction in completed exit plan approvals', async () => {
        const { handler, getAgentState, permissionRpc } = createHarness()
        handler.registerPending('perm-4', 'ExitPlanMode')

        await permissionRpc?.({
            id: 'perm-4',
            approved: true,
            mode: 'acceptEdits',
            contextAction: 'clear_context'
        })

        expect(getAgentState().completedRequests?.['perm-4']).toMatchObject({
            tool: 'ExitPlanMode',
            status: 'approved',
            mode: 'acceptEdits',
            contextAction: 'clear_context'
        })
    })
})
