import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execSync } from 'child_process'
import { mkdir, rm, writeFile, readFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { RpcHandlerManager } from '../../../api/rpc/RpcHandlerManager'
import { registerGitHandlers } from './git'

interface GitCommandResponse {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

async function createTempDir(prefix: string): Promise<string> {
    const base = tmpdir()
    const path = join(base, `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(path, { recursive: true })
    return path
}

function initGitRepo(dir: string): void {
    execSync('git init', { cwd: dir, stdio: 'ignore' })
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' })
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' })
}

describe('git RPC handlers', () => {
    let rootDir: string
    let rpc: RpcHandlerManager

    beforeEach(async () => {
        rootDir = await createTempDir('hapi-git-handler')
        initGitRepo(rootDir)

        // Create initial commit
        await writeFile(join(rootDir, 'README.md'), '# Test')
        execSync('git add .', { cwd: rootDir, stdio: 'ignore' })
        execSync('git commit -m "initial"', { cwd: rootDir, stdio: 'ignore' })

        rpc = new RpcHandlerManager({ scopePrefix: 'session-test' })
        registerGitHandlers(rpc, rootDir)
    })

    afterEach(async () => {
        if (rootDir) {
            await rm(rootDir, { recursive: true, force: true })
        }
    })

    describe('git-status', () => {
        it('returns git status for clean repo', async () => {
            const response = await rpc.handleRequest({
                method: 'session-test:git-status',
                params: JSON.stringify({})
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)
            expect(parsed.stdout).toContain('# branch')
        })

        it('shows modified files in status', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')

            const response = await rpc.handleRequest({
                method: 'session-test:git-status',
                params: JSON.stringify({})
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)
            expect(parsed.stdout).toContain('README.md')
        })
    })

    describe('git-stage', () => {
        it('stages a modified file', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')

            const response = await rpc.handleRequest({
                method: 'session-test:git-stage',
                params: JSON.stringify({ filePath: 'README.md' })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            // Verify file is staged
            const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' })
            expect(status).toContain('M  README.md')
        })

        it('stages a new file', async () => {
            await writeFile(join(rootDir, 'new-file.txt'), 'new content')

            const response = await rpc.handleRequest({
                method: 'session-test:git-stage',
                params: JSON.stringify({ filePath: 'new-file.txt' })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' })
            expect(status).toContain('A  new-file.txt')
        })
    })

    describe('git-unstage', () => {
        it('unstages a staged file', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')
            execSync('git add README.md', { cwd: rootDir, stdio: 'ignore' })

            const response = await rpc.handleRequest({
                method: 'session-test:git-unstage',
                params: JSON.stringify({ filePath: 'README.md' })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            // Verify file is unstaged
            const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' })
            expect(status).toContain(' M README.md')
        })
    })

    describe('git-discard', () => {
        it('discards changes to a tracked file', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')

            const response = await rpc.handleRequest({
                method: 'session-test:git-discard',
                params: JSON.stringify({ filePath: 'README.md' })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            // Verify file is restored
            const content = await readFile(join(rootDir, 'README.md'), 'utf-8')
            expect(content).toBe('# Test')
        })
    })

    describe('git-stage-all', () => {
        it('stages all changes', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')
            await writeFile(join(rootDir, 'new-file.txt'), 'new content')

            const response = await rpc.handleRequest({
                method: 'session-test:git-stage-all',
                params: JSON.stringify({})
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' })
            expect(status).toContain('M  README.md')
            expect(status).toContain('A  new-file.txt')
        })
    })

    describe('git-unstage-all', () => {
        it('unstages all staged files', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')
            await writeFile(join(rootDir, 'new-file.txt'), 'new content')
            execSync('git add -A', { cwd: rootDir, stdio: 'ignore' })

            const response = await rpc.handleRequest({
                method: 'session-test:git-unstage-all',
                params: JSON.stringify({})
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' })
            expect(status).toContain(' M README.md')
            expect(status).toContain('?? new-file.txt')
        })
    })

    describe('git-discard-all', () => {
        it('discards all tracked file changes', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')

            const response = await rpc.handleRequest({
                method: 'session-test:git-discard-all',
                params: JSON.stringify({})
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)

            const content = await readFile(join(rootDir, 'README.md'), 'utf-8')
            expect(content).toBe('# Test')
        })
    })

    describe('git-clean-file', () => {
        it('deletes an untracked file', async () => {
            const newFilePath = join(rootDir, 'untracked.txt')
            await writeFile(newFilePath, 'untracked content')
            expect(existsSync(newFilePath)).toBe(true)

            const response = await rpc.handleRequest({
                method: 'session-test:git-clean-file',
                params: JSON.stringify({ filePath: 'untracked.txt' })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)
            expect(existsSync(newFilePath)).toBe(false)
        })
    })

    describe('git-diff-numstat', () => {
        it('returns diff stats for unstaged changes', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified\nNew line')

            const response = await rpc.handleRequest({
                method: 'session-test:git-diff-numstat',
                params: JSON.stringify({ staged: false })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)
            expect(parsed.stdout).toContain('README.md')
        })

        it('returns diff stats for staged changes', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified\nNew line')
            execSync('git add README.md', { cwd: rootDir, stdio: 'ignore' })

            const response = await rpc.handleRequest({
                method: 'session-test:git-diff-numstat',
                params: JSON.stringify({ staged: true })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)
            expect(parsed.stdout).toContain('README.md')
        })
    })

    describe('git-diff-file', () => {
        it('returns diff for a specific file', async () => {
            await writeFile(join(rootDir, 'README.md'), '# Modified')

            const response = await rpc.handleRequest({
                method: 'session-test:git-diff-file',
                params: JSON.stringify({ filePath: 'README.md', staged: false })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(true)
            expect(parsed.stdout).toContain('-# Test')
            expect(parsed.stdout).toContain('+# Modified')
        })
    })

    describe('path security', () => {
        it('rejects paths outside working directory', async () => {
            const response = await rpc.handleRequest({
                method: 'session-test:git-stage',
                params: JSON.stringify({ filePath: '../../../etc/passwd' })
            })

            const parsed = JSON.parse(response) as GitCommandResponse
            expect(parsed.success).toBe(false)
            expect(parsed.error).toBeDefined()
        })
    })
})
