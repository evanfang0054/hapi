import type { WorkerHandle, WorkerStartCommand } from './host'

export type WorkerFactory = (command: WorkerStartCommand) => Promise<WorkerHandle>
