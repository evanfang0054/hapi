import { createFlavorAdapter } from './adapters/base'
import type { WorkerEvent, WorkerFlavor } from './workerProtocol'
import type { ResourcePolicy } from './resourcePolicy'

export type WorkerStartCommand = {
  sessionId: string
  flavor: WorkerFlavor
  payload: Record<string, unknown>
}

export type WorkerResumeCommand = WorkerStartCommand & {
  resumeSession: (payload: Record<string, unknown>) => Promise<void>
}

export type SessionState = 'starting' | 'active' | 'idle' | 'failed' | 'terminated'

export type WorkerHandle = {
  sessionId: string
  postCommand: (command: unknown) => void | Promise<void>
  terminate: () => Promise<void>
  onEvent: (listener: (event: WorkerEvent) => void) => void
}

type IdleWorkerSnapshot = {
  idleForMs: number
  rssBytes: number
}

export class SharedRuntimeHost {
  private readonly workers = new Map<string, WorkerHandle>()
  private readonly sessionStates = new Map<string, SessionState>()
  private readonly pendingSessionIds = new Set<string>()
  private readonly idleWorkers = new Map<string, IdleWorkerSnapshot>()

  constructor(
    private readonly deps: {
      createWorker: (command: WorkerStartCommand) => Promise<WorkerHandle>
      resourcePolicy: ResourcePolicy
    },
  ) {}

  async startSession(command: WorkerStartCommand): Promise<void> {
    if (this.workers.has(command.sessionId) || this.pendingSessionIds.has(command.sessionId)) {
      throw new Error('Shared runtime session already started')
    }

    if (this.workers.size + this.pendingSessionIds.size >= this.deps.resourcePolicy.maxWorkers) {
      throw new Error('Shared runtime worker limit reached')
    }

    this.pendingSessionIds.add(command.sessionId)

    try {
      const worker = await this.deps.createWorker(command)
      this.workers.set(command.sessionId, worker)
      this.sessionStates.set(command.sessionId, 'starting')
      this.idleWorkers.delete(command.sessionId)

      worker.onEvent((event) => {
        if (event.sessionId !== command.sessionId) {
          return
        }

        if (event.type === 'active') {
          this.sessionStates.set(event.sessionId, 'active')
          this.idleWorkers.delete(event.sessionId)
          return
        }

        if (event.type === 'failed') {
          this.sessionStates.set(event.sessionId, 'failed')
          this.idleWorkers.delete(event.sessionId)
          return
        }

        if (event.type === 'terminated') {
          this.sessionStates.set(event.sessionId, 'terminated')
          this.workers.delete(event.sessionId)
          this.idleWorkers.delete(event.sessionId)
        }
      })
    } finally {
      this.pendingSessionIds.delete(command.sessionId)
    }
  }

  async validateRuntimeSelection(options: {
    directFit: WorkerStartCommand
    fallback: WorkerStartCommand
  }): Promise<{
    directFit: { runtimeMode: 'shared' | 'standalone'; sessionState: SessionState | undefined }
    fallback: { runtimeMode: 'shared' | 'standalone'; sessionState: SessionState | undefined }
  }> {
    const directFitAdapter = createFlavorAdapter(options.directFit.flavor)
    if (directFitAdapter.supportsSharedRuntime()) {
      await this.startSession(options.directFit)
    }

    const fallbackAdapter = createFlavorAdapter(options.fallback.flavor)

    return {
      directFit: {
        runtimeMode: directFitAdapter.supportsSharedRuntime() ? 'shared' : 'standalone',
        sessionState: this.getSessionState(options.directFit.sessionId),
      },
      fallback: {
        runtimeMode: fallbackAdapter.supportsSharedRuntime() ? 'shared' : 'standalone',
        sessionState: this.getSessionState(options.fallback.sessionId),
      },
    }
  }

  markWorkerIdle(sessionId: string, idleForMs: number, rssBytes: number): void {
    if (!this.workers.has(sessionId)) {
      return
    }

    this.sessionStates.set(sessionId, 'idle')
    this.idleWorkers.set(sessionId, { idleForMs, rssBytes })
  }

  async reclaimIdleWorkers(): Promise<void> {
    for (const [sessionId, snapshot] of this.idleWorkers) {
      const worker = this.workers.get(sessionId)
      if (!worker) {
        this.idleWorkers.delete(sessionId)
        continue
      }

      if (!this.deps.resourcePolicy.shouldReclaimIdleWorker({ sessionId, ...snapshot })) {
        this.sessionStates.set(sessionId, 'active')
        this.idleWorkers.delete(sessionId)
        continue
      }

      await worker.terminate()
      this.workers.delete(sessionId)
      this.sessionStates.set(sessionId, 'terminated')
      this.idleWorkers.delete(sessionId)
    }
  }

  async resumeSession(command: WorkerResumeCommand): Promise<void> {
    await command.resumeSession(command.payload)
    this.sessionStates.set(command.sessionId, 'starting')
    this.idleWorkers.delete(command.sessionId)
  }

  getWorker(sessionId: string): WorkerHandle | undefined {
    return this.workers.get(sessionId)
  }

  getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId)
  }
}
