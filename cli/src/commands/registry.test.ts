import { describe, expect, it } from 'vitest'
import { resolveCommand } from './registry'

describe('command registry', () => {
    it('resolves adopt command', () => {
        const resolved = resolveCommand(['adopt', 'session-1'])
        expect(resolved.command.name).toBe('adopt')
        expect(resolved.context.commandArgs).toEqual(['session-1'])
    })

    it('resolves attach command as standalone entry', () => {
        const attach = resolveCommand(['attach', 'session-1'])

        expect(attach.command.name).toBe('attach')
        expect(typeof attach.command.run).toBe('function')
        expect(attach.context.commandArgs).toEqual(['session-1'])
    })

    it('falls back to default claude command for unknown subcommand', () => {
        const resolved = resolveCommand(['unknown-cmd'])
        expect(resolved.command.name).toBe('default')
        expect(resolved.context.commandArgs).toEqual(['unknown-cmd'])
    })
})
