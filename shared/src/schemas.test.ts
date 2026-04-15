import { describe, expect, it } from 'bun:test'
import { AgentStateCompletedRequestSchema } from './schemas'

describe('AgentStateCompletedRequestSchema', () => {
    it('accepts exit-plan approvals with contextAction', () => {
        const parsed = AgentStateCompletedRequestSchema.parse({
            tool: 'exit_plan_mode',
            arguments: {},
            status: 'approved',
            mode: 'default',
            decision: 'approved',
            contextAction: 'clear_context'
        } as any)

        expect((parsed as any).contextAction).toBe('clear_context')
    })

    it('rejects unknown contextAction values', () => {
        expect(() =>
            AgentStateCompletedRequestSchema.parse({
                tool: 'exit_plan_mode',
                arguments: {},
                status: 'approved',
                contextAction: 'reset_everything'
            })
        ).toThrow()
    })
})
