import chalk from 'chalk'
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { getInvokedCwd } from '@/utils/invokedCwd'
import { getProjectPath } from '@/claude/utils/path'
import { claudeCheckSession } from '@/claude/utils/claudeCheckSession'
import { initializeToken } from '@/ui/tokenInit'
import type { CommandDefinition } from './types'

type SessionCandidate = {
    sessionId: string
    filePath: string
    mtimeMs: number
}

async function listRecentSessions(projectDir: string): Promise<SessionCandidate[]> {
    const entries = await readdir(projectDir, { withFileTypes: true }).catch(() => [])
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))

    const candidates = await Promise.all(files.map(async (entry): Promise<SessionCandidate | null> => {
        const sessionId = basename(entry.name, '.jsonl')
        const filePath = join(projectDir, entry.name)
        const stats = await stat(filePath).catch(() => null)
        if (!stats) {
            return null
        }
        return {
            sessionId,
            filePath,
            mtimeMs: stats.mtimeMs
        }
    }))

    return candidates
        .filter((candidate): candidate is SessionCandidate => Boolean(candidate))
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
}

async function promptSelectSession(candidates: SessionCandidate[]): Promise<string | null> {
    if (!process.stdin.isTTY) {
        return null
    }

    console.log(chalk.cyan('Select a Claude session to adopt:'))
    for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i]
        const date = new Date(item.mtimeMs).toLocaleString()
        console.log(chalk.gray(`  ${i + 1}) ${item.sessionId}  (${date})`))
    }

    const rl = readline.createInterface({ input, output })
    try {
        const answer = (await rl.question(chalk.cyan('Enter number (or press Enter to cancel): '))).trim()
        if (!answer) {
            return null
        }
        const index = Number.parseInt(answer, 10)
        if (!Number.isFinite(index) || index < 1 || index > candidates.length) {
            return null
        }
        return candidates[index - 1].sessionId
    } finally {
        rl.close()
    }
}

export const adoptCommand: CommandDefinition = {
    name: 'adopt',
    requiresRuntimeAssets: true,
    run: async ({ commandArgs }) => {
        await initializeToken()

        const workingDirectory = getInvokedCwd()
        const projectDir = getProjectPath(workingDirectory)
        let sessionId = commandArgs[0]?.trim()

        if (!sessionId) {
            const candidates = await listRecentSessions(projectDir)
            if (candidates.length === 0) {
                console.error(chalk.red('No Claude sessions found for this project.'))
                console.error(chalk.gray(`  Looked in: ${projectDir}`))
                process.exit(1)
            }

            const selected = await promptSelectSession(candidates.slice(0, 20))
            if (!selected) {
                console.error(chalk.yellow('Adopt cancelled.'))
                process.exit(1)
            }
            sessionId = selected
        }

        if (!claudeCheckSession(sessionId, workingDirectory)) {
            console.error(chalk.red(`Session not found or invalid: ${sessionId}`))
            console.error(chalk.gray(`  Project dir: ${projectDir}`))
            process.exit(1)
        }

        const { runClaude } = await import('@/claude/runClaude')
        await runClaude({
            adoptSessionId: sessionId,
            startingMode: 'local'
        })
    }
}
