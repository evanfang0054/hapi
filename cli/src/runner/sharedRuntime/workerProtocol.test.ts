import { describe, expect, it } from 'vitest'
import { measureSharedRuntimeReport } from '../../../scripts/measure-shared-runtime'
import { compareSharedRuntimePerformance, measureRuntimeBaseline } from './baseline'
import { WorkerCommandSchema, WorkerEventSchema } from './workerProtocol'

describe('worker protocol', () => {
  it('accepts start-session commands', () => {
    const parsed = WorkerCommandSchema.parse({
      type: 'start-session',
      sessionId: 'session-1',
      flavor: 'claude',
      payload: { cwd: '/tmp/project' },
    })

    expect(parsed.type).toBe('start-session')
  })

  it('accepts failed events with scoped error metadata', () => {
    const parsed = WorkerEventSchema.parse({
      type: 'failed',
      sessionId: 'session-1',
      scope: 'worker',
      recoverable: false,
      error: 'spawn failed',
    })

    expect(parsed.scope).toBe('worker')
  })

  it('rejects commands with unsupported type', () => {
    expect(() =>
      WorkerCommandSchema.parse({
        type: 'launch-session',
        sessionId: 'session-1',
        flavor: 'claude',
        payload: { cwd: '/tmp/project' },
      }),
    ).toThrow()
  })

  it('rejects events with invalid failed scope', () => {
    expect(() =>
      WorkerEventSchema.parse({
        type: 'failed',
        sessionId: 'session-1',
        scope: 'runtime',
        recoverable: false,
        error: 'spawn failed',
      }),
    ).toThrow()
  })

  it('rejects events without sessionId', () => {
    expect(() =>
      WorkerEventSchema.parse({
        type: 'started',
      }),
    ).toThrow()
  })

  it('rejects heartbeat events with fractional rss bytes', () => {
    expect(() =>
      WorkerEventSchema.parse({
        type: 'heartbeat',
        sessionId: 'session-1',
        rssBytes: 12.5,
      }),
    ).toThrow()
  })
})

describe('measureRuntimeBaseline', () => {
  it('records rss samples for single and multiple sessions', async () => {
    const result = await measureRuntimeBaseline({
      flavor: 'claude',
      sessionCounts: [1, 3],
      sampleWindowMs: 5_000,
    })

    expect(result.placeholder).toBe(true)
    expect(result.notes).toContain('RSS snapshot stub')
    expect(result.samples.singleSession.rssBytes).toBeGreaterThan(0)
    expect(result.samples.multiSession['3'].rssBytes).toBeGreaterThan(0)
  })
})

describe('compareSharedRuntimePerformance', () => {
  it('reports before-and-after rss snapshots for each sampled session count', async () => {
    const report = await compareSharedRuntimePerformance({
      flavor: 'claude',
      sessionCounts: [1, 3, 5],
    })

    expect(report.before['1'].rssBytes).toBeGreaterThan(0)
    expect(report.after['1'].rssBytes).toBeGreaterThan(0)
    expect(report.before['5'].rssBytes).toBeGreaterThan(0)
    expect(report.after['5'].rssBytes).toBeGreaterThan(0)
  })

  it('keeps non-migrated flavors on standalone runtime without regression', async () => {
    const report = await compareSharedRuntimePerformance({
      flavor: 'opencode',
      sessionCounts: [1],
    })

    expect(report.runtimeMode).toBe('standalone')
  })

  it('reports idle reclaim and host overhead fields for cli measurement output', async () => {
    const report = await compareSharedRuntimePerformance({
      flavor: 'claude',
      sessionCounts: [1, 3, 5],
    })

    expect(report.idleReclaim.before.rssBytes).toBeGreaterThan(0)
    expect(report.idleReclaim.after.rssBytes).toBeGreaterThan(0)
    expect(report.fixedHostOverhead.rssBytes).toBeGreaterThan(0)
  })

  it('reports a shared-capable fallback without starting it as its own session', async () => {
    const report = await compareSharedRuntimePerformance({
      flavor: 'claude',
      sessionCounts: [1],
      validationFlavors: {
        directFit: 'opencode',
        fallback: 'claude',
      },
    } as never)

    expect((report as any).validation.directFit).toEqual({
      runtimeMode: 'standalone',
      startedSessions: 0,
      sessionState: undefined,
    })
    expect((report as any).validation.fallback).toEqual({
      runtimeMode: 'shared',
      startedSessions: 0,
      sessionState: undefined,
    })
  })
})

describe('measureSharedRuntimeReport', () => {
  it('formats cli measurement output with sampled counts and memory sections', async () => {
    const output = await measureSharedRuntimeReport({
      flavor: 'claude',
      sessionCounts: [1, 3, 5],
    })

    expect(output).toContain('flavor: claude')
    expect(output).toContain('session counts: 1, 3, 5')
    expect(output).toContain('before:')
    expect(output).toContain('after:')
    expect(output).toContain('idle reclaim:')
    expect(output).toContain('fixed host overhead:')
  })

  it('includes host validation details when requested', async () => {
    const output = await measureSharedRuntimeReport({
      flavor: 'claude',
      sessionCounts: [1],
      validationFlavors: {
        directFit: 'claude',
        fallback: 'codex',
      },
    } as never)

    expect(output).toContain('validation:')
    expect(output).toContain('direct fit: claude -> shared (started: 1, sessionState: active)')
    expect(output).toContain('fallback: codex -> shared (started: 0, sessionState: n/a)')
  })
})
