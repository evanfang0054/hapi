import { describe, expect, it, vi } from 'vitest'
import { createFlavorAdapter } from './adapters/base'
import { SharedRuntimeHost, type WorkerHandle, type WorkerStartCommand } from './host'
import { buildDefaultResourcePolicy } from './resourcePolicy'
import type { WorkerEvent } from './workerProtocol'

type TestWorkerHandle = WorkerHandle & {
  emit: (event: WorkerEvent) => void
}

function buildWorkerHandle(sessionId: string): TestWorkerHandle {
  let onEvent: ((event: WorkerEvent) => void) | undefined

  return {
    sessionId,
    postCommand: vi.fn(),
    terminate: vi.fn(async () => {}),
    onEvent(listener) {
      onEvent = listener
    },
    emit(event) {
      onEvent?.(event)
    },
  }
}

describe('SharedRuntimeHost', () => {
  it('creates isolated workers per session and tracks them independently', async () => {
    const host = new SharedRuntimeHost({
      createWorker: vi
        .fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>()
        .mockResolvedValueOnce(buildWorkerHandle('session-a'))
        .mockResolvedValueOnce(buildWorkerHandle('session-b')),
      resourcePolicy: buildDefaultResourcePolicy(),
    })

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: { cwd: '/tmp/a' } })
    await host.startSession({ sessionId: 'session-b', flavor: 'codex', payload: { cwd: '/tmp/b' } })

    expect(host.getWorker('session-a')).toBeDefined()
    expect(host.getWorker('session-b')).toBeDefined()
    expect(host.getWorker('session-a')).not.toBe(host.getWorker('session-b'))
  })

  it('marks only the crashed session as failed when a worker crashes', async () => {
    const workerA = buildWorkerHandle('session-a')
    const workerB = buildWorkerHandle('session-b')
    const host = new SharedRuntimeHost({
      createWorker: vi
        .fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>()
        .mockResolvedValueOnce(workerA)
        .mockResolvedValueOnce(workerB),
      resourcePolicy: buildDefaultResourcePolicy(),
    })

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })
    await host.startSession({ sessionId: 'session-b', flavor: 'claude', payload: {} })

    workerA.emit({
      type: 'failed',
      sessionId: 'session-a',
      scope: 'worker',
      recoverable: false,
      error: 'boom',
    })
    workerB.emit({
      type: 'active',
      sessionId: 'session-b',
    })

    expect(host.getSessionState('session-a')).toBe('failed')
    expect(host.getSessionState('session-b')).toBe('active')
  })

  it('rejects starting the same session twice', async () => {
    const host = new SharedRuntimeHost({
      createWorker: vi
        .fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>()
        .mockResolvedValue(buildWorkerHandle('session-a')),
      resourcePolicy: buildDefaultResourcePolicy(),
    })

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })

    await expect(host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })).rejects.toThrow(
      'Shared runtime session already started',
    )
  })

  it('rejects concurrent starts for the same session', async () => {
    let releaseWorkerCreation: (() => void) | undefined
    const createWorker = vi.fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>().mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        releaseWorkerCreation = resolve
      })
      return buildWorkerHandle('session-a')
    })
    const host = new SharedRuntimeHost({
      createWorker,
      resourcePolicy: buildDefaultResourcePolicy(),
    })

    const firstStart = host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })
    const secondStart = host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })

    await expect(secondStart).rejects.toThrow('Shared runtime session already started')

    releaseWorkerCreation?.()
    await firstStart
    expect(createWorker).toHaveBeenCalledTimes(1)
  })

  it('enforces maxWorkers during concurrent starts', async () => {
    let releaseFirstWorker: (() => void) | undefined
    const createWorker = vi
      .fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>()
      .mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => {
          releaseFirstWorker = resolve
        })
        return buildWorkerHandle('session-a')
      })
      .mockResolvedValueOnce(buildWorkerHandle('session-b'))

    const host = new SharedRuntimeHost({
      createWorker,
      resourcePolicy: {
        ...buildDefaultResourcePolicy(),
        maxWorkers: 1,
      },
    })

    const firstStart = host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })
    const secondStart = host.startSession({ sessionId: 'session-b', flavor: 'codex', payload: {} })

    await expect(secondStart).rejects.toThrow('Shared runtime worker limit reached')

    releaseFirstWorker?.()
    await firstStart
    expect(createWorker).toHaveBeenCalledTimes(1)
  })

  it('reclaims only idle workers that exceed the reclaim threshold', async () => {
    const idleWorker = buildWorkerHandle('session-a')
    const activeWorker = buildWorkerHandle('session-b')
    const terminateIdleWorker = vi.spyOn(idleWorker, 'terminate')
    const terminateActiveWorker = vi.spyOn(activeWorker, 'terminate')
    const host = new SharedRuntimeHost({
      createWorker: vi
        .fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>()
        .mockResolvedValueOnce(idleWorker)
        .mockResolvedValueOnce(activeWorker),
      resourcePolicy: {
        ...buildDefaultResourcePolicy(),
        shouldReclaimIdleWorker: ({ idleForMs }) => idleForMs >= 10 * 60 * 1000,
      },
    })

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })
    await host.startSession({ sessionId: 'session-b', flavor: 'codex', payload: {} })

    idleWorker.emit({ type: 'active', sessionId: 'session-a' })
    activeWorker.emit({ type: 'active', sessionId: 'session-b' })

    host.markWorkerIdle('session-a', 11 * 60 * 1000, 10)
    host.markWorkerIdle('session-b', 0, 10)

    await host.reclaimIdleWorkers()

    expect(terminateIdleWorker).toHaveBeenCalledTimes(1)
    expect(terminateActiveWorker).not.toHaveBeenCalled()
    expect(host.getSessionState('session-a')).toBe('terminated')
    expect(host.getSessionState('session-b')).toBe('active')
  })

  it('uses adapter resume when a reclaimed session is resumed', async () => {
    const worker = buildWorkerHandle('session-a')
    const host = new SharedRuntimeHost({
      createWorker: vi.fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>().mockResolvedValue(worker),
      resourcePolicy: buildDefaultResourcePolicy(),
    })
    const resumeSession = vi.fn(async () => {})

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })
    worker.emit({ type: 'active', sessionId: 'session-a' })
    host.markWorkerIdle('session-a', 11 * 60 * 1000, 10)
    await host.reclaimIdleWorkers()

    await host.resumeSession({
      sessionId: 'session-a',
      flavor: 'claude',
      payload: { claudeSessionId: 'resume-token' },
      resumeSession,
    })

    expect(resumeSession).toHaveBeenCalledWith({ claudeSessionId: 'resume-token' })
    expect(host.getSessionState('session-a')).toBe('starting')
  })

  it('starts a direct-fit flavor through SharedRuntimeHost while unsupported flavors stay standalone', async () => {
    const worker = buildWorkerHandle('session-shared')
    const createWorker = vi.fn<(command: WorkerStartCommand) => Promise<WorkerHandle>>().mockResolvedValue(worker)
    const host = new SharedRuntimeHost({
      createWorker,
      resourcePolicy: buildDefaultResourcePolicy(),
    })

    const validation = await host.validateRuntimeSelection({
      directFit: {
        sessionId: 'session-shared',
        flavor: 'claude',
        payload: { cwd: '/tmp/shared-runtime' },
      },
      fallback: {
        sessionId: 'session-standalone',
        flavor: 'opencode',
        payload: { cwd: '/tmp/standalone-runtime' },
      },
    } as never)

    worker.emit({ type: 'active', sessionId: 'session-shared' })

    expect(validation.directFit.runtimeMode).toBe('shared')
    expect(host.getSessionState('session-shared')).toBe('active')
    expect(validation.fallback.runtimeMode).toBe('standalone')
    expect(host.getSessionState('session-standalone')).toBeUndefined()
    expect(createWorker).toHaveBeenCalledTimes(1)
    expect(createFlavorAdapter('claude').supportsSharedRuntime()).toBe(true)
    expect(createFlavorAdapter('opencode').supportsSharedRuntime()).toBe(false)
  })
})
