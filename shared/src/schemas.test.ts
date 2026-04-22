import { describe, expect, it } from 'bun:test'
import { AgentStateCompletedRequestSchema, SyncEventSchema } from './schemas'

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

describe('SyncEventSchema', () => {
    it('accepts session-rewound events', () => {
        const parsed = SyncEventSchema.parse({
            type: 'session-rewound',
            sessionId: 'session-1',
            rewindToLocalId: 'msg-1',
            deletedCount: 2
        })

        expect(parsed).toEqual({
            type: 'session-rewound',
            sessionId: 'session-1',
            rewindToLocalId: 'msg-1',
            deletedCount: 2
        })
    })
})
