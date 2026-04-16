import { createFlavorAdapter } from './adapters/base'
import { SharedRuntimeHost, type WorkerHandle, type WorkerStartCommand } from './host'
import { buildDefaultResourcePolicy } from './resourcePolicy'
import type { WorkerFlavor } from './workerProtocol'

function sampleRssSnapshot() {
  return { rssBytes: process.memoryUsage().rss }
}

type RuntimeValidationSample = {
  runtimeMode: 'shared' | 'standalone'
  startedSessions: number
  sessionState?: 'starting' | 'active' | 'idle' | 'failed' | 'terminated'
}

type RuntimeValidationPair = {
  directFit: RuntimeValidationSample
  fallback: RuntimeValidationSample
}

function buildValidationWorkerHandle(sessionId: string): WorkerHandle {
  let onEvent: ((event: { type: string; sessionId: string }) => void) | undefined

  return {
    sessionId,
    postCommand: async () => {},
    terminate: async () => {},
    onEvent(listener) {
      onEvent = listener as typeof onEvent
      onEvent?.({ type: 'active', sessionId })
    },
  }
}

async function measureRuntimeSelectionValidation(options: {
  directFit: WorkerFlavor
  fallback: WorkerFlavor
}): Promise<RuntimeValidationPair> {
  const host = new SharedRuntimeHost({
    createWorker: async (command: WorkerStartCommand) => buildValidationWorkerHandle(command.sessionId),
    resourcePolicy: buildDefaultResourcePolicy(),
  })

  const validation = await host.validateRuntimeSelection({
    directFit: {
      sessionId: `validation-${options.directFit}`,
      flavor: options.directFit,
      payload: { cwd: '/tmp/shared-runtime-baseline' },
    },
    fallback: {
      sessionId: `validation-${options.fallback}`,
      flavor: options.fallback,
      payload: { cwd: '/tmp/shared-runtime-baseline-fallback' },
    },
  })

  return {
    directFit: {
      runtimeMode: validation.directFit.runtimeMode,
      startedSessions: validation.directFit.sessionState ? 1 : 0,
      sessionState: validation.directFit.sessionState,
    },
    fallback: {
      runtimeMode: validation.fallback.runtimeMode,
      startedSessions: validation.fallback.sessionState ? 1 : 0,
      sessionState: validation.fallback.sessionState,
    },
  }
}

export async function measureRuntimeBaseline(options: {
  flavor: WorkerFlavor
  sessionCounts: number[]
  sampleWindowMs: number
}) {
  return {
    flavor: options.flavor,
    sampleWindowMs: options.sampleWindowMs,
    placeholder: true,
    notes: 'RSS snapshot stub; not a multi-session runtime benchmark yet.',
    samples: {
      singleSession: sampleRssSnapshot(),
      multiSession: Object.fromEntries(options.sessionCounts.map((count) => [String(count), sampleRssSnapshot()])),
    },
  }
}

export async function compareSharedRuntimePerformance(options: {
  flavor: WorkerFlavor
  sessionCounts: number[]
  validationFlavors?: {
    directFit: WorkerFlavor
    fallback: WorkerFlavor
  }
}) {
  const runtimeMode = createFlavorAdapter(options.flavor).supportsSharedRuntime() ? 'shared' : 'standalone'
  const validation = options.validationFlavors
    ? await measureRuntimeSelectionValidation(options.validationFlavors)
    : undefined

  return {
    flavor: options.flavor,
    runtimeMode,
    before: Object.fromEntries(options.sessionCounts.map((count) => [String(count), sampleRssSnapshot()])),
    after: Object.fromEntries(options.sessionCounts.map((count) => [String(count), sampleRssSnapshot()])),
    idleReclaim: {
      before: sampleRssSnapshot(),
      after: sampleRssSnapshot(),
    },
    fixedHostOverhead: sampleRssSnapshot(),
    validation,
  }
}
