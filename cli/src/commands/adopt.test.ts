import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => {
    const question = vi.fn(async () => '1')
    const close = vi.fn()
    const unref = vi.fn()
    return {
        getInvokedCwd: vi.fn(() => '/tmp/workspace'),
        getProjectPath: vi.fn(() => '/tmp/.claude/projects/workspace'),
        claudeCheckSession: vi.fn(() => true),
        runClaude: vi.fn(async () => {}),
        initializeToken: vi.fn(async () => {}),
        isRunnerRunningCurrentlyInstalledHappyVersion: vi.fn(async () => true),
        isRunnerHttpReady: vi.fn(async () => true),
        spawnHappyCLI: vi.fn(() => ({ unref })),
        readdir: vi.fn(async () => []),
        stat: vi.fn(async () => ({ mtimeMs: 1000 })),
        createInterface: vi.fn(() => ({ question, close })),
        question,
        close,
        unref
    }
})

vi.mock('@/utils/invokedCwd', () => ({
    getInvokedCwd: harness.getInvokedCwd
}))

vi.mock('@/claude/utils/path', () => ({
    getProjectPath: harness.getProjectPath
}))

vi.mock('@/claude/utils/claudeCheckSession', () => ({
    claudeCheckSession: harness.claudeCheckSession
}))

vi.mock('@/claude/runClaude', () => ({
    runClaude: harness.runClaude
}))

vi.mock('@/ui/tokenInit', () => ({
    initializeToken: harness.initializeToken
}))

vi.mock('@/runner/controlClient', () => ({
    isRunnerRunningCurrentlyInstalledHappyVersion: harness.isRunnerRunningCurrentlyInstalledHappyVersion,
    isRunnerHttpReady: harness.isRunnerHttpReady
}))

vi.mock('@/utils/spawnHappyCLI', () => ({
    spawnHappyCLI: harness.spawnHappyCLI
}))

vi.mock('node:fs/promises', () => ({
    readdir: harness.readdir,
    stat: harness.stat
}))

vi.mock('node:readline/promises', () => ({
    default: {
        createInterface: harness.createInterface
    },
    createInterface: harness.createInterface
}))

import { adoptCommand, runAdoptCommand } from './adopt'

describe('adopt command', () => {
    const originalIsTTY = process.stdin.isTTY

    beforeEach(() => {
        vi.resetAllMocks()
        Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
        harness.getInvokedCwd.mockReturnValue('/tmp/workspace')
        harness.getProjectPath.mockReturnValue('/tmp/.claude/projects/workspace')
        harness.claudeCheckSession.mockReturnValue(true)
        harness.runClaude.mockResolvedValue(undefined)
        harness.initializeToken.mockResolvedValue(undefined)
        harness.isRunnerRunningCurrentlyInstalledHappyVersion.mockResolvedValue(true)
        harness.readdir.mockResolvedValue([])
        harness.stat.mockResolvedValue({ mtimeMs: 1000 })
        harness.question.mockResolvedValue('1')
    })

    it('runs adopt directly when session id is provided', async () => {
        await adoptCommand.run({ args: ['adopt', 'session-1'], subcommand: 'adopt', commandArgs: ['session-1'] })

        expect(harness.initializeToken).toHaveBeenCalled()
        expect(harness.claudeCheckSession).toHaveBeenCalledWith('session-1', '/tmp/workspace')
        expect(harness.runClaude).toHaveBeenCalledWith({
            adoptSessionId: 'session-1',
            startingMode: 'local'
        })
    })

    it('starts detached observer when --background is used', async () => {
        await adoptCommand.run({
            args: ['adopt', 'session-2', '--background'],
            subcommand: 'adopt',
            commandArgs: ['session-2', '--background']
        })

        expect(harness.runClaude).not.toHaveBeenCalled()
        expect(harness.spawnHappyCLI).toHaveBeenCalledWith(['adopt', 'session-2', '--foreground'], {
            cwd: '/tmp/workspace',
            detached: true,
            stdio: 'ignore',
            env: process.env
        })
        expect(harness.unref).toHaveBeenCalled()
    })

    it('waits for runner HTTP to be ready when starting it', async () => {
        // Runner not running initially
        harness.isRunnerRunningCurrentlyInstalledHappyVersion.mockResolvedValue(false)
        
        // HTTP server becomes ready after a few checks
        let httpCheckCount = 0
        harness.isRunnerHttpReady.mockImplementation(async () => {
            httpCheckCount++
            return httpCheckCount >= 3 // Ready after 2 checks
        })

        await adoptCommand.run({
            args: ['adopt', 'session-3', '--background'],
            subcommand: 'adopt',
            commandArgs: ['session-3', '--background']
        })

        // Should have called isRunnerHttpReady multiple times
        expect(harness.isRunnerHttpReady).toHaveBeenCalledTimes(3)
        expect(harness.spawnHappyCLI).toHaveBeenCalledTimes(2) // Once for runner start, once for adopt
    })

    it('ignores --background when attach mode forces foreground', async () => {
        await runAdoptCommand(['session-attach', '--background'], 'foreground')

        expect(harness.spawnHappyCLI).not.toHaveBeenCalled()
        expect(harness.runClaude).toHaveBeenCalledWith({
            adoptSessionId: 'session-attach',
            startingMode: 'local'
        })
    })

    it('selects recent session interactively when no id is provided', async () => {
        harness.readdir.mockResolvedValue([
            { isFile: () => true, name: 'session-a.jsonl' },
            { isFile: () => true, name: 'session-b.jsonl' }
        ] as any)
        harness.stat
            .mockResolvedValueOnce({ mtimeMs: 1000 })
            .mockResolvedValueOnce({ mtimeMs: 2000 })

        await adoptCommand.run({ args: ['adopt'], subcommand: 'adopt', commandArgs: [] })

        expect(harness.runClaude).toHaveBeenCalledWith({
            adoptSessionId: 'session-b',
            startingMode: 'local'
        })
        expect(harness.close).toHaveBeenCalled()
    })

    it('exits when session id is invalid', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`exit:${code}`)
        }) as never)
        harness.claudeCheckSession.mockReturnValue(false)

        await expect(
            adoptCommand.run({ args: ['adopt', 'bad-session'], subcommand: 'adopt', commandArgs: ['bad-session'] })
        ).rejects.toThrow('exit:1')

        exitSpy.mockRestore()
    })

    afterEach(() => {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
    })
})
