import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  spawnWithAbortMock,
  restoreTerminalStateMock,
  loggerDebugMock,
  stdinPauseMock,
  stdinResumeMock
} = vi.hoisted(() => ({
  spawnWithAbortMock: vi.fn(async () => {}),
  restoreTerminalStateMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  stdinPauseMock: vi.fn(),
  stdinResumeMock: vi.fn()
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
  const originalStdinPause = process.stdin.pause
  const originalStdinResume = process.stdin.resume

  beforeEach(() => {
    spawnWithAbortMock.mockClear()
    restoreTerminalStateMock.mockClear()
    loggerDebugMock.mockClear()
    stdinPauseMock.mockClear()
    stdinResumeMock.mockClear()

    Object.defineProperty(process.stdin, 'pause', {
      value: stdinPauseMock,
      configurable: true
    })
    Object.defineProperty(process.stdin, 'resume', {
      value: stdinResumeMock,
      configurable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
    Object.defineProperty(process.stdin, 'pause', {
      value: originalStdinPause,
      configurable: true
    })
    Object.defineProperty(process.stdin, 'resume', {
      value: originalStdinResume,
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

  it('passes through safe sessionId on win32', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    })

    await opencodeLocal({
      path: '/tmp/project',
      abort: new AbortController().signal,
      env: { TEST_ENV: '1' },
      sessionId: 'session-123_ok'
    })

    expect(spawnWithAbortMock).toHaveBeenCalledWith(expect.objectContaining({
      command: 'opencode',
      args: ['--session', 'session-123_ok'],
      cwd: '/tmp/project',
      env: { TEST_ENV: '1' },
      shell: true
    }))
  })

  it('keeps existing non-win32 behavior for special characters', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true
    })

    await opencodeLocal({
      path: '/tmp/project',
      abort: new AbortController().signal,
      env: {},
      sessionId: 'abc&def'
    })

    expect(spawnWithAbortMock).toHaveBeenCalledWith(expect.objectContaining({
      args: ['--session', 'abc&def'],
      shell: false
    }))
  })
})
