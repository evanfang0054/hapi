import type { WorkerFlavor } from '../workerProtocol'

export type AdapterPayload = Record<string, unknown>

const SHARED_RUNTIME_SUPPORTED_FLAVORS = new Set<WorkerFlavor>(['claude', 'codex'])

export interface FlavorAdapter {
  flavor: WorkerFlavor
  supportsSharedRuntime(): boolean
  startSession(payload: AdapterPayload): Promise<void>
  resumeSession(payload: AdapterPayload): Promise<void>
  sendMessage(payload: AdapterPayload): Promise<void>
  abort(): Promise<void>
  terminate(): Promise<void>
}

class SharedRuntimeFlavorAdapter implements FlavorAdapter {
  constructor(public readonly flavor: WorkerFlavor) {}

  supportsSharedRuntime(): boolean {
    return SHARED_RUNTIME_SUPPORTED_FLAVORS.has(this.flavor)
  }

  async startSession(_payload: AdapterPayload): Promise<void> {}

  async resumeSession(_payload: AdapterPayload): Promise<void> {}

  async sendMessage(_payload: AdapterPayload): Promise<void> {}

  async abort(): Promise<void> {}

  async terminate(): Promise<void> {}
}

export function createFlavorAdapter(flavor: WorkerFlavor): FlavorAdapter {
  return new SharedRuntimeFlavorAdapter(flavor)
}

export async function startSessionWithRuntimeSelection(options: {
  sessionId: string
  flavor: WorkerFlavor
  payload: AdapterPayload
  adapter?: FlavorAdapter
}): Promise<{ runtimeMode: 'shared' | 'standalone' }> {
  const adapter = options.adapter ?? createFlavorAdapter(options.flavor)

  if (!adapter.supportsSharedRuntime()) {
    return { runtimeMode: 'standalone' }
  }

  await adapter.startSession(options.payload)
  return { runtimeMode: 'shared' }
}
