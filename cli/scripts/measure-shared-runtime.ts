import type { WorkerFlavor } from '../src/runner/sharedRuntime/workerProtocol'
import { compareSharedRuntimePerformance } from '../src/runner/sharedRuntime/baseline'

export async function measureSharedRuntimeReport(options: {
  flavor: WorkerFlavor
  sessionCounts: number[]
  validationFlavors?: {
    directFit: WorkerFlavor
    fallback: WorkerFlavor
  }
}) {
  const validationFlavors = options.validationFlavors ?? {
    directFit: options.flavor,
    fallback: 'opencode' as WorkerFlavor,
  }
  const report = await compareSharedRuntimePerformance({
    ...options,
    validationFlavors,
  })
  const formatSnapshots = (snapshots: Record<string, { rssBytes: number }>) =>
    Object.entries(snapshots)
      .map(([count, snapshot]) => `  - ${count}: ${snapshot.rssBytes}`)
      .join('\n')

  return [
    `flavor: ${report.flavor}`,
    `runtime mode: ${report.runtimeMode}`,
    `session counts: ${options.sessionCounts.join(', ')}`,
    'before:',
    formatSnapshots(report.before),
    'after:',
    formatSnapshots(report.after),
    'idle reclaim:',
    `  - before: ${report.idleReclaim.before.rssBytes}`,
    `  - after: ${report.idleReclaim.after.rssBytes}`,
    'fixed host overhead:',
    `  - rssBytes: ${report.fixedHostOverhead.rssBytes}`,
    ...(report.validation
      ? [
          'validation:',
          `  - direct fit: ${validationFlavors.directFit} -> ${report.validation.directFit.runtimeMode} (started: ${report.validation.directFit.startedSessions}, sessionState: ${report.validation.directFit.sessionState ?? 'n/a'})`,
          `  - fallback: ${validationFlavors.fallback} -> ${report.validation.fallback.runtimeMode} (started: ${report.validation.fallback.startedSessions}, sessionState: ${report.validation.fallback.sessionState ?? 'n/a'})`,
        ]
      : []),
  ].join('\n')
}

function parseArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) {
    return undefined
  }

  return process.argv[index + 1]
}

async function main() {
  const flavor = (parseArgValue('--flavor') ?? 'claude') as WorkerFlavor
  const sessionCounts = (parseArgValue('--sessions') ?? '1')
    .split(',')
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0)

  const output = await measureSharedRuntimeReport({
    flavor,
    sessionCounts: sessionCounts.length > 0 ? sessionCounts : [1],
  })

  console.log(output)
}

if (import.meta.main) {
  await main()
}
