export type ResourcePolicy = {
  maxWorkers: number
  idleTimeoutMs: number
  shouldReclaimIdleWorker: (worker: { sessionId: string; idleForMs: number; rssBytes: number }) => boolean
}

export function buildDefaultResourcePolicy(): ResourcePolicy {
  return {
    maxWorkers: 8,
    idleTimeoutMs: 10 * 60 * 1000,
    shouldReclaimIdleWorker: ({ idleForMs }) => idleForMs >= 10 * 60 * 1000,
  }
}
