import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RewindFilesRequest, RewindFilesResponse } from './types'

const spawnMock = vi.fn()
const killProcessMock = vi.fn(async (child: any) => {
    child.killed = true
    child.stdout.end()
    child.emit('close', 0)
})

vi.mock('node:child_process', () => ({
    ...require('node:child_process'),
    spawn: spawnMock
}))

vi.mock('@/utils/process', () => ({
    isProcessAlive: () => false,
    isWindows: () => false,
    killProcess: async () => true,
    killProcessByChildProcess: killProcessMock
}))

vi.mock('@/utils/bunRuntime', () => ({
    withBunRuntimeEnv: (env: NodeJS.ProcessEnv) => env
}))

vi.mock('../utils/mcpConfig', () => ({
    appendMcpConfigArg: () => null
}))

function createFakeChild() {
    const child = new EventEmitter() as EventEmitter & {
        stdin: PassThrough
        stdout: PassThrough
        stderr: PassThrough
        killed: boolean
    }

    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.killed = false
    return child
}

afterEach(() => {
    vi.clearAllMocks()
    delete process.env.HAPI_CLAUDE_PATH
})

describe('Query', () => {
    it('passes file checkpointing env var when spawning Claude Code', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        process.env.HAPI_CLAUDE_PATH = 'claude'

        const { query } = await import('./query')
        query({ prompt: 'hello' })

        expect(spawnMock).toHaveBeenCalledTimes(1)
        expect(spawnMock.mock.calls[0]?.[2]?.env?.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING).toBe('1')
    })

    it('sends rewind_files control request and returns rewind response', async () => {
        const { Query } = await import('./query')
        const stdout = new PassThrough()
        const stdin = new PassThrough()
        const query = new Query(stdin, stdout, Promise.resolve())

        const writes: string[] = []
        stdin.on('data', (chunk) => {
            writes.push(chunk.toString())
            const parsed = JSON.parse(chunk.toString().trim())
            stdout.write(JSON.stringify({
                type: 'control_response',
                response: {
                    subtype: 'success',
                    request_id: parsed.request_id,
                    response: {
                        canRewind: true,
                        filesChanged: ['src/file.ts']
                    }
                }
            }) + '\n')
        })

        const response = await query.rewindFiles('msg-1', true)

        expect(JSON.parse(writes[0]!.trim())).toMatchObject({
            type: 'control_request',
            request: {
                subtype: 'rewind_files',
                user_message_id: 'msg-1',
                dry_run: true
            }
        })
        expect(response).toEqual({
            canRewind: true,
            filesChanged: ['src/file.ts']
        })
    })

    it('rejects rewindFiles without stream-json stdin', async () => {
        const { Query } = await import('./query')
        const query = new Query(null, new PassThrough(), Promise.resolve())

        await expect(query.rewindFiles('msg-1')).rejects.toThrow('rewindFiles requires --input-format stream-json')
    })

    it('defines rewind control request and response shapes', () => {
        const request = {
            subtype: 'rewind_files',
            user_message_id: 'msg-1',
            dry_run: true
        } satisfies RewindFilesRequest

        const response = {
            canRewind: true,
            filesChanged: ['src/file.ts'],
            insertions: 1,
            deletions: 2
        } satisfies RewindFilesResponse

        expect(request.subtype).toBe('rewind_files')
        expect(response.canRewind).toBe(true)
    })

    it('preserves externally set errors even if the process exits cleanly', async () => {
        const { Query } = await import('./query')
        const stdout = new PassThrough()
        const query = new Query(null, stdout, Promise.resolve())

        query.setError(new Error('prompt failed'))
        stdout.end()

        await expect(query.next()).rejects.toThrow('prompt failed')
    })

    it('propagates prompt stream failures through query()', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        process.env.HAPI_CLAUDE_PATH = 'claude'

        const { query } = await import('./query')
        const prompt = {
            async *[Symbol.asyncIterator]() {
                yield { type: 'user', message: { role: 'user', content: 'hello' } }
                throw new Error('prompt failed')
            }
        }

        const result = query({ prompt })

        await expect(result.next()).rejects.toThrow('prompt failed')
    })

    it('fails fast after cleanup timeout when prompt cleanup hangs', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        killProcessMock.mockReturnValueOnce(new Promise<void>(() => {}))
        process.env.HAPI_CLAUDE_PATH = 'claude'

        const { query } = await import('./query')
        const prompt = {
            async *[Symbol.asyncIterator]() {
                yield { type: 'user', message: { role: 'user', content: 'hello' } }
                throw new Error('prompt failed')
            }
        }

        const result = query({ prompt, options: { promptFailureCleanupTimeoutMs: 10 } })

        await expect(result.next()).rejects.toThrow('prompt failed')
    })
})
