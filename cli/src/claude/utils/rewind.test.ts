import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildMessageChain, truncateJsonl, truncateJsonlByUserText, findFileSnapshot, findHapiFileSnapshotAfterUserText, applyFileSnapshot, appendHapiFileSnapshot, captureFilesSnapshot } from './rewind'

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
        it('finds the most recent file-history-snapshot in the file', () => {
            // Mimic the real path structure:
            //   ~/.claude/projects/<project>/<sessionId>.jsonl
            //   ~/.claude/file-history/<sessionId>/<backup>@v1
            const claudeHome = join(testDir, 'claude-home')
            const projectDir = join(claudeHome, 'projects', 'myproject')
            mkdirSync(projectDir, { recursive: true })

            const sessionId = 'test-session'
            const backupDir = join(claudeHome, 'file-history', sessionId)
            mkdirSync(backupDir, { recursive: true })
            writeFileSync(join(backupDir, 'backup1@v1'), 'old content of a.ts')
            writeFileSync(join(backupDir, 'backup2@v1'), 'old content of b.ts')

            const jsonlPath = join(projectDir, `${sessionId}.jsonl`)
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'file-history-snapshot', snapshot: { trackedFileBackups: { '/a.ts': { backupFileName: 'backup1', version: 1 } } } }),
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
                JSON.stringify({ type: 'file-history-snapshot', snapshot: { trackedFileBackups: { '/b.ts': { backupFileName: 'backup2', version: 1 } } } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'hello' } }),
            ].join('\n') + '\n')

            const snapshot = findFileSnapshot(jsonlPath)
            expect(snapshot).not.toBeNull()
            expect(snapshot!.files['/b.ts']).toBe('old content of b.ts')
        })

        it('finds hapi snapshots after the target user message before truncation', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'before' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'ok' } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'edit files' } }),
            ].join('\n') + '\n')
            appendHapiFileSnapshot(jsonlPath, { files: { '/a.ts': 'a before' } })
            appendHapiFileSnapshot(jsonlPath, { files: { '/b.ts': 'b before' }, deleted: ['/new.ts'] })
            writeFileSync(jsonlPath, JSON.stringify({ type: 'assistant', uuid: 'ddd', parentUuid: 'ccc', message: { role: 'assistant', content: 'done' } }) + '\n', { flag: 'a' })

            const snapshot = findHapiFileSnapshotAfterUserText(jsonlPath, 'edit files')

            expect(snapshot).not.toBeNull()
            expect(snapshot!.files).toEqual({ '/a.ts': 'a before', '/b.ts': 'b before' })
            expect(snapshot!.deleted).toEqual(['/new.ts'])
        })

        it('keeps the earliest hapi snapshot for the same file in one user turn', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'edit twice' } }),
            ].join('\n') + '\n')
            appendHapiFileSnapshot(jsonlPath, { files: { '/a.ts': 'before first edit' } })
            appendHapiFileSnapshot(jsonlPath, { files: { '/a.ts': 'after first edit' } })

            const snapshot = findHapiFileSnapshotAfterUserText(jsonlPath, 'edit twice')

            expect(snapshot).not.toBeNull()
            expect(snapshot!.files['/a.ts']).toBe('before first edit')
        })

        it('keeps collecting hapi snapshots after following user messages', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'target' } }),
            ].join('\n') + '\n')
            appendHapiFileSnapshot(jsonlPath, { files: { '/a.ts': 'target before' } })
            writeFileSync(jsonlPath, JSON.stringify({ type: 'user', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'user', content: 'next' } }) + '\n', { flag: 'a' })
            appendHapiFileSnapshot(jsonlPath, { files: { '/b.ts': 'next before' } })

            const snapshot = findHapiFileSnapshotAfterUserText(jsonlPath, 'target')

            expect(snapshot).not.toBeNull()
            expect(snapshot!.files).toEqual({ '/a.ts': 'target before', '/b.ts': 'next before' })
        })

        it('finds hapi snapshots after the requested repeated user text occurrence', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'repeat' } }),
            ].join('\n') + '\n')
            appendHapiFileSnapshot(jsonlPath, { files: { '/first.ts': 'first before' } })
            writeFileSync(jsonlPath, JSON.stringify({ type: 'user', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'user', content: 'repeat' } }) + '\n', { flag: 'a' })
            appendHapiFileSnapshot(jsonlPath, { files: { '/second.ts': 'second before' } })

            const snapshot = findHapiFileSnapshotAfterUserText(jsonlPath, 'repeat', 2)

            expect(snapshot).not.toBeNull()
            expect(snapshot!.files).toEqual({ '/second.ts': 'second before' })
        })

        it('can restore a hapi snapshot captured after the target message before truncation removes it', () => {
            const filePath = join(testDir, 'README.md')
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(filePath, 'before')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'edit readme' } }),
            ].join('\n') + '\n')
            appendHapiFileSnapshot(jsonlPath, captureFilesSnapshot([filePath], testDir)!)

            writeFileSync(filePath, 'after')
            const snapshot = findHapiFileSnapshotAfterUserText(jsonlPath, 'edit readme')
            truncateJsonlByUserText(jsonlPath, 'edit readme')
            const restored = applyFileSnapshot(snapshot!, testDir)

            expect(restored).toEqual([filePath])
            expect(captureFilesSnapshot([filePath], testDir)!.files[filePath]).toBe('before')
            expect(findFileSnapshot(jsonlPath)).toBeNull()
        })

        it('ignores hapi-file-snapshot entries when Claude file history is absent', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            appendHapiFileSnapshot(jsonlPath, { files: { '/a.ts': 'before edit' } })
            appendHapiFileSnapshot(jsonlPath, { files: { '/b.ts': 'before second edit' }, deleted: ['/missing.ts'] })

            expect(findFileSnapshot(jsonlPath)).toBeNull()
        })

        it('captures and restores hapi snapshots from disk', () => {
            const filePath = join(testDir, 'README.md')
            writeFileSync(filePath, 'before')

            const snapshot = captureFilesSnapshot([filePath], testDir)
            expect(snapshot).not.toBeNull()

            writeFileSync(filePath, 'after')
            const restored = applyFileSnapshot(snapshot!, testDir)

            expect(restored).toEqual([filePath])
            expect(captureFilesSnapshot([filePath], testDir)!.files[filePath]).toBe('before')
        })

        it('restores files that were missing when the snapshot was captured', () => {
            const filePath = join(testDir, 'new-file.md')
            const snapshot = captureFilesSnapshot([filePath], testDir)
            expect(snapshot).not.toBeNull()
            expect(snapshot!.deleted).toEqual([filePath])

            writeFileSync(filePath, 'created later')
            const restored = applyFileSnapshot(snapshot!, testDir)

            expect(restored).toEqual([filePath])
            expect(existsSync(filePath)).toBe(false)
        })

        it('returns null if no snapshot found', () => {
            const claudeHome = join(testDir, 'claude-home2')
            const projectDir = join(claudeHome, 'projects', 'myproject')
            mkdirSync(projectDir, { recursive: true })

            const jsonlPath = join(projectDir, 'test-session2.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'hi' } }),
            ].join('\n') + '\n')

            const snapshot = findFileSnapshot(jsonlPath)
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

        it('truncates at the requested repeated user text occurrence', () => {
            const jsonlPath = join(testDir, 'test.jsonl')
            writeFileSync(jsonlPath, [
                JSON.stringify({ type: 'user', uuid: 'aaa', parentUuid: null, message: { role: 'user', content: 'repeat' } }),
                JSON.stringify({ type: 'assistant', uuid: 'bbb', parentUuid: 'aaa', message: { role: 'assistant', content: 'first reply' } }),
                JSON.stringify({ type: 'user', uuid: 'ccc', parentUuid: 'bbb', message: { role: 'user', content: 'repeat' } }),
                JSON.stringify({ type: 'assistant', uuid: 'ddd', parentUuid: 'ccc', message: { role: 'assistant', content: 'second reply' } }),
            ].join('\n') + '\n')

            const lastKeptUuid = truncateJsonlByUserText(jsonlPath, 'repeat', 2)

            expect(lastKeptUuid).toBe('bbb')
            const chain = buildMessageChain(jsonlPath)
            expect(chain.map((entry) => entry.uuid)).toEqual(['aaa', 'bbb'])
        })
    })
})
