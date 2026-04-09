import chalk from 'chalk'
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { getProjectPath } from '@/claude/utils/path'
import { claudeCheckSession } from '@/claude/utils/claudeCheckSession'
import { isRunnerRunningCurrentlyInstalledHappyVersion, isRunnerHttpReady } from '@/runner/controlClient'
import { initializeToken } from '@/ui/tokenInit'
import { spawnHappyCLI } from '@/utils/spawnHappyCLI'
import { getInvokedCwd } from '@/utils/invokedCwd'
import type { CommandDefinition } from './types'

type SessionCandidate = {
    sessionId: string
    filePath: string
    mtimeMs: number
}

type AdoptRunMode = 'auto' | 'foreground'

type ParsedArgs = {
    sessionId?: string
    background: boolean
    showHelp: boolean
}

async function listRecentSessions(projectDir: string) {
    const entries = await readdir(projectDir, { withFileTypes: true }).catch(() => [])
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    const candidates: SessionCandidate[] = []

    for (const entry of files) {
        const sessionId = basename(entry.name, '.jsonl')
        const filePath = join(projectDir, entry.name)
        const stats = await stat(filePath).catch(() => null)
        if (!stats) {
            continue
        }
        candidates.push({
            sessionId,
            filePath,
            mtimeMs: stats.mtimeMs
        })
    }

    return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

async function promptSelectSession(candidates: SessionCandidate[]) {
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

function printAdoptHelp() {
    console.log(`
${chalk.bold('Usage:')}
  hapi adopt [sessionId] [--background]
  hapi attach [sessionId]

${chalk.bold('Options:')}
  -d, --background   Start adopt observer in background and return immediately
      --foreground   Internal flag used by background launcher
  -h, --help         Show this help
`)
}

function parseArgs(commandArgs: string[], runMode: AdoptRunMode): ParsedArgs {
    let sessionId: string | undefined
    let background = false
    let showHelp = false

    for (const arg of commandArgs) {
        if (arg === '--background' || arg === '-d') {
            background = true
            continue
        }
        if (arg === '--foreground') {
            background = false
            continue
        }
        if (arg === '--help' || arg === '-h') {
            showHelp = true
            continue
        }
        if (arg.startsWith('-')) {
            throw new Error(`Unknown adopt option: ${arg}`)
        }
        if (!sessionId) {
            sessionId = arg.trim()
            continue
        }
        throw new Error(`Unexpected argument: ${arg}`)
    }

    if (runMode === 'foreground') {
        background = false
    }

    return {
        sessionId,
        background,
        showHelp
    }
}

async function ensureRunnerReady() {
    if (await isRunnerRunningCurrentlyInstalledHappyVersion()) {
        // Runner is running with correct version, but ensure HTTP server is ready
        for (let i = 0; i < 20; i++) {
            if (await isRunnerHttpReady()) {
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return
    }

    const runnerProcess = spawnHappyCLI(['runner', 'start-sync'], {
        detached: true,
        stdio: 'ignore',
        env: process.env
    })
    runnerProcess.unref()

    // Wait for runner HTTP server to be fully ready (up to 10 seconds)
    for (let i = 0; i < 100; i++) {
        if (await isRunnerHttpReady()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
    }
}

async function resolveSessionId(sessionIdArg?: string) {
    const workingDirectory = getInvokedCwd()
    const projectDir = getProjectPath(workingDirectory)
    let sessionId = sessionIdArg?.trim()

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

    return {
        sessionId,
        workingDirectory
    }
}

async function runAdoptForeground(sessionId: string) {
    const { runClaude } = await import('@/claude/runClaude')
    await runClaude({
        adoptSessionId: sessionId,
        startingMode: 'local'
    })
}

async function runAdoptBackground(sessionId: string, workingDirectory: string) {
    await ensureRunnerReady()

    const child = spawnHappyCLI(['adopt', sessionId, '--foreground'], {
        cwd: workingDirectory,
        detached: true,
        stdio: 'ignore',
        env: process.env
    })
    child.unref()

    console.log(chalk.green(`Started background adopt observer for session: ${sessionId}`))
    console.log(chalk.gray('  Use `hapi runner list` to inspect running sessions'))
    console.log(chalk.gray('  Use `hapi runner stop-session <hapiSessionId>` to stop it'))
    console.log(chalk.gray(`  Use \`hapi attach ${sessionId}\` to return to foreground observer`))
}

export async function runAdoptCommand(commandArgs: string[], runMode: AdoptRunMode) {
    await initializeToken()

    let parsed: ParsedArgs
    try {
        parsed = parseArgs(commandArgs, runMode)
    } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        printAdoptHelp()
        process.exit(1)
    }

    if (parsed.showHelp) {
        printAdoptHelp()
        process.exit(0)
    }

    const { sessionId, workingDirectory } = await resolveSessionId(parsed.sessionId)

    if (parsed.background) {
        await runAdoptBackground(sessionId, workingDirectory)
        return
    }

    await runAdoptForeground(sessionId)
}

export const adoptCommand: CommandDefinition = {
    name: 'adopt',
    requiresRuntimeAssets: true,
    run: async ({ commandArgs }) => {
        await runAdoptCommand(commandArgs, 'auto')
    }
}
