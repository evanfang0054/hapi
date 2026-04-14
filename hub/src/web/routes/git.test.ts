import { describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createGitRoutes } from './git'

function createSession(overrides?: Partial<Session>): Session {
    const baseMetadata = {
        path: '/tmp/project',
        host: 'localhost',
        flavor: 'codex' as const
    }
    const base: Session = {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: baseMetadata,
        metadataVersion: 1,
        agentState: {
            controlledByUser: false,
            requests: {},
            completedRequests: {}
        },
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 1,
        model: 'gpt-5.4',
        effort: null,
        permissionMode: 'default',
        collaborationMode: 'default'
    }

    return {
        ...base,
        ...overrides,
        metadata: overrides?.metadata === undefined
            ? base.metadata
            : overrides.metadata === null
                ? null
                : {
                    ...baseMetadata,
                    ...overrides.metadata
                },
        agentState: overrides?.agentState === undefined ? base.agentState : overrides.agentState
    }
}

type GitCommandResponse = { success: boolean; stdout?: string; stderr?: string; exitCode?: number; error?: string }

function createApp(session: Session, rpcMocks?: Partial<Record<string, () => Promise<GitCommandResponse>>>) {
    const defaultResponse: GitCommandResponse = { success: true, stdout: '', stderr: '', exitCode: 0 }
    const getGitStatus = mock(() => Promise.resolve(rpcMocks?.getGitStatus?.() ?? defaultResponse))
    const getGitDiffNumstat = mock(() => Promise.resolve(rpcMocks?.getGitDiffNumstat?.() ?? defaultResponse))
    const getGitDiffFile = mock(() => Promise.resolve(rpcMocks?.getGitDiffFile?.() ?? defaultResponse))
    const gitStage = mock(() => Promise.resolve(rpcMocks?.gitStage?.() ?? defaultResponse))
    const gitUnstage = mock(() => Promise.resolve(rpcMocks?.gitUnstage?.() ?? defaultResponse))
    const gitDiscard = mock(() => Promise.resolve(rpcMocks?.gitDiscard?.() ?? defaultResponse))
    const gitStageAll = mock(() => Promise.resolve(rpcMocks?.gitStageAll?.() ?? defaultResponse))
    const gitUnstageAll = mock(() => Promise.resolve(rpcMocks?.gitUnstageAll?.() ?? defaultResponse))
    const gitDiscardAll = mock(() => Promise.resolve(rpcMocks?.gitDiscardAll?.() ?? defaultResponse))
    const gitCleanFile = mock(() => Promise.resolve(rpcMocks?.gitCleanFile?.() ?? defaultResponse))

    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: session.id, session }),
        getGitStatus,
        getGitDiffNumstat,
        getGitDiffFile,
        gitStage,
        gitUnstage,
        gitDiscard,
        gitStageAll,
        gitUnstageAll,
        gitDiscardAll,
        gitCleanFile
    } as Partial<SyncEngine>

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createGitRoutes(() => engine as SyncEngine))

    return {
        app,
        mocks: {
            getGitStatus,
            getGitDiffNumstat,
            getGitDiffFile,
            gitStage,
            gitUnstage,
            gitDiscard,
            gitStageAll,
            gitUnstageAll,
            gitDiscardAll,
            gitCleanFile
        }
    }
}

describe('git routes', () => {
    describe('GET /sessions/:id/git-status', () => {
        it('returns git status', async () => {
            const session = createSession()
            const { app } = createApp(session, {
                getGitStatus: async () => ({
                    success: true,
                    stdout: '# branch.oid abc123\n# branch.head main',
                    exitCode: 0
                })
            })

            const res = await app.request('/api/sessions/session-1/git-status')
            expect(res.status).toBe(200)

            const data = await res.json()
            expect(data.success).toBe(true)
            expect(data.stdout).toContain('branch')
        })

        it('returns error when session has no path', async () => {
            const session = createSession({ metadata: null })
            const { app } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-status')
            expect(res.status).toBe(200)

            const data = await res.json()
            expect(data.success).toBe(false)
            expect(data.error).toBe('Session path not available')
        })
    })

    describe('POST /sessions/:id/git-stage', () => {
        it('stages a file', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'README.md' })
            })

            expect(res.status).toBe(200)
            expect(mocks.gitStage).toHaveBeenCalled()
        })

        it('returns 400 for missing file path', async () => {
            const session = createSession()
            const { app } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-stage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(res.status).toBe(400)
        })
    })

    describe('POST /sessions/:id/git-unstage', () => {
        it('unstages a file', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-unstage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'README.md' })
            })

            expect(res.status).toBe(200)
            expect(mocks.gitUnstage).toHaveBeenCalled()
        })
    })

    describe('POST /sessions/:id/git-discard', () => {
        it('discards changes to a file', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-discard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'README.md' })
            })

            expect(res.status).toBe(200)
            expect(mocks.gitDiscard).toHaveBeenCalled()
        })
    })

    describe('POST /sessions/:id/git-stage-all', () => {
        it('stages all changes', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-stage-all', {
                method: 'POST'
            })

            expect(res.status).toBe(200)
            expect(mocks.gitStageAll).toHaveBeenCalled()
        })
    })

    describe('POST /sessions/:id/git-unstage-all', () => {
        it('unstages all changes', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-unstage-all', {
                method: 'POST'
            })

            expect(res.status).toBe(200)
            expect(mocks.gitUnstageAll).toHaveBeenCalled()
        })
    })

    describe('POST /sessions/:id/git-discard-all', () => {
        it('discards all changes', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-discard-all', {
                method: 'POST'
            })

            expect(res.status).toBe(200)
            expect(mocks.gitDiscardAll).toHaveBeenCalled()
        })
    })

    describe('POST /sessions/:id/git-clean-file', () => {
        it('cleans an untracked file', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-clean-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'untracked.txt' })
            })

            expect(res.status).toBe(200)
            expect(mocks.gitCleanFile).toHaveBeenCalled()
        })

        it('returns 400 for missing file path', async () => {
            const session = createSession()
            const { app } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-clean-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(res.status).toBe(400)
        })
    })

    describe('GET /sessions/:id/git-diff-numstat', () => {
        it('returns diff numstat', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session, {
                getGitDiffNumstat: async () => ({
                    success: true,
                    stdout: '1\t0\tREADME.md',
                    exitCode: 0
                })
            })

            const res = await app.request('/api/sessions/session-1/git-diff-numstat')
            expect(res.status).toBe(200)
            expect(mocks.getGitDiffNumstat).toHaveBeenCalled()

            const data = await res.json()
            expect(data.success).toBe(true)
        })

        it('accepts staged parameter', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-diff-numstat?staged=true')
            expect(res.status).toBe(200)
            expect(mocks.getGitDiffNumstat).toHaveBeenCalled()
        })
    })

    describe('GET /sessions/:id/git-diff-file', () => {
        it('returns diff for a file', async () => {
            const session = createSession()
            const { app, mocks } = createApp(session, {
                getGitDiffFile: async () => ({
                    success: true,
                    stdout: '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-# Test\n+# Modified',
                    exitCode: 0
                })
            })

            const res = await app.request('/api/sessions/session-1/git-diff-file?path=README.md')
            expect(res.status).toBe(200)
            expect(mocks.getGitDiffFile).toHaveBeenCalled()

            const data = await res.json()
            expect(data.success).toBe(true)
            expect(data.stdout).toContain('README.md')
        })

        it('returns 400 for missing path', async () => {
            const session = createSession()
            const { app } = createApp(session)

            const res = await app.request('/api/sessions/session-1/git-diff-file')
            expect(res.status).toBe(400)
        })
    })
})
