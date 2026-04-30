import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildMessageChain, truncateJsonl, truncateJsonlByUserText, findFileSnapshot } from './rewind'

describe('rewind utilities', () => {
    let testDir: string

    beforeEach(() => {
        testDir = join(tmpdir(), `rewind-test-${Date.now()}`)
        mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true })
    })

    describe('buildMessageChain', () => {
        it('builds a chain from a valid JSONL file', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'hello' } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'bye' } }),
            ].join('\n') + '\n')

            const chain = buildMessageChain(jsonlPath)
            expect(chain).toHaveLength(3)
            expect(chain[0].uuid).toBe('aaa')
            expect(chain[1].parentUuid).toBe('aaa')
            expect(chain[2].parentUuid).toBe('bbb')
        })

        it('skips file-history-snapshot and other internal types', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'file-history-snapshot', uuid: 'snap1', msgId: 'aaa' }),
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
            ].join('\n') + '\n')

            const chain = buildMessageChain(jsonlPath)
            expect(chain).toHaveLength(1)
            expect(chain[0].uuid).toBe('aaa')
        })

        it('throws if file does not exist', () => {
            expect(() => buildMessageChain(join(testDir, 'nope.jsonl'))).toThrow()
        })
    })

    describe('truncateJsonl', () => {
        it('truncates file keeping lines up to and including target uuid', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'hello' } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'bye' } }),
            ].join('\n') + '\n')

            truncateJsonl(jsonlPath, 'bbb')

            const chain = buildMessageChain(jsonlPath)
            expect(chain).toHaveLength(2)
            expect(chain[0].uuid).toBe('aaa')
            expect(chain[1].uuid).toBe('bbb')
        })

        it('throws if target uuid not found', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
            ].join('\n') + '\n')

            expect(() => truncateJsonl(jsonlPath, 'nonexistent')).toThrow('not found')
        })
    })

    describe('findFileSnapshot', () => {
        it('finds the most recent file-history-snapshot before target uuid', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'file-history-snapshot', uuid: 'snap1', msgId: 'pre', files: { '/a.ts': 'content1' } }),
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
                JSON.stringify({ type: 'file-history-snapshot', uuid: 'snap2', msgId: 'bbb', files: { '/b.ts': 'content2' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'hello' } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'bye' } }),
            ].join('\n') + '\n')

            const snapshot = findFileSnapshot(jsonlPath, 'ccc')
            expect(snapshot).not.toBeNull()
            expect(snapshot!.files['/b.ts']).toBe('content2')
        })

        it('returns null if no snapshot found', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
            ].join('\n') + '\n')

            const snapshot = findFileSnapshot(jsonlPath, 'aaa')
            expect(snapshot).toBeNull()
        })
    })

    describe('truncateJsonlByUserText', () => {
        it('truncates file excluding the matched user message and everything after', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hello' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'rewind to here' } }),
                JSON.stringify({ type: 'assistant', uuid: 'ddd', parentUuid: 'ccc', message: { role: 'assistant', content: [{ type: 'text', text: 'response after' }] } }),
            ].join('\n') + '\n')

            const lastKeptUuid = truncateJsonlByUserText(jsonlPath, 'rewind to here')

            // Returns the uuid of the last line before the target (assistant bbb)
            expect(lastKeptUuid).toBe('bbb')
            const chain = buildMessageChain(jsonlPath)
            // Target user message and everything after is removed
            expect(chain).toHaveLength(2)
            expect(chain[0].uuid).toBe('aaa')
            expect(chain[1].uuid).toBe('bbb')
        })

        it('handles string content in user messages', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hello' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'reply' } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'find me' } }),
            ].join('\n') + '\n')

            const lastKeptUuid = truncateJsonlByUserText(jsonlPath, 'find me')

            expect(lastKeptUuid).toBe('bbb')
            const chain = buildMessageChain(jsonlPath)
            expect(chain).toHaveLength(2)
            expect(chain[1].uuid).toBe('bbb')
        })

        it('throws if no matching user message found', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hello' } }),
            ].join('\n') + '\n')

            expect(() => truncateJsonlByUserText(jsonlPath, 'nonexistent text')).toThrow('No user message found')
        })
    })
})
