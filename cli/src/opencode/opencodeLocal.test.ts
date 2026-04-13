import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  spawnWithAbortMock,
  restoreTerminalStateMock,
  loggerDebugMock
} = vi.hoisted(() => ({
  spawnWithAbortMock: vi.fn(async () => {}),
  restoreTerminalStateMock: vi.fn(),
  loggerDebugMock: vi.fn()
}))

vi.mock('@/utils/spawnWithAbort', () => ({
  spawnWithAbort: spawnWithAbortMock
}))

vi.mock('@/ui/terminalState', () => ({
  restoreTerminalState: restoreTerminalStateMock
}))

vi.mock('@/ui/logger', () => ({
  logger: {
    debug: loggerDebugMock
  }
}))

import { opencodeLocal } from './opencodeLocal'

describe('opencodeLocal', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    spawnWithAbortMock.mockClear()
    restoreTerminalStateMock.mockClear()
    loggerDebugMock.mockClear()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })

  it('rejects unsafe sessionId on win32', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    })

    await expect(opencodeLocal({
      path: '/tmp/project',
      abort: new AbortController().signal,
      env: {},
      sessionId: 'abc&def'
    })).rejects.toThrow('Invalid sessionId')

    expect(spawnWithAbortMock).not.toHaveBeenCalled()
  })
})
