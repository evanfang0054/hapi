import { describe, expect, it, vi } from 'vitest'
import { createFlavorAdapter, startSessionWithRuntimeSelection } from './base'

describe('flavor adapters', () => {
  it.each([
    ['claude', true],
    ['codex', true],
    ['cursor', false],
    ['gemini', false],
    ['opencode', false],
  ] as const)('reports shared runtime support for %s', (flavor, supported) => {
    const adapter = createFlavorAdapter(flavor)

    expect(adapter.supportsSharedRuntime()).toBe(supported)
  })

  it.each(['claude', 'codex', 'cursor', 'gemini', 'opencode'] as const)(
    'provides shared runtime adapter contract for %s',
    (flavor) => {
      const adapter = createFlavorAdapter(flavor)

      expect(adapter.startSession).toBeTypeOf('function')
      expect(adapter.resumeSession).toBeTypeOf('function')
      expect(adapter.sendMessage).toBeTypeOf('function')
      expect(adapter.abort).toBeTypeOf('function')
      expect(adapter.terminate).toBeTypeOf('function')
    },
  )

  it('starts shared runtime sessions for supported adapters', async () => {
    const adapter = createFlavorAdapter('claude')
    const startSession = vi.spyOn(adapter, 'startSession')

    const result = await startSessionWithRuntimeSelection({
      sessionId: 'session-1',
      flavor: 'claude',
      payload: { cwd: '/tmp/project' },
      adapter,
    })

    expect(result.runtimeMode).toBe('shared')
    expect(startSession).toHaveBeenCalledWith({ cwd: '/tmp/project' })
  })

  it.each(['cursor', 'gemini', 'opencode'] as const)(
    'falls back to standalone runtime for unsupported %s adapters',
    async (flavor) => {
      const adapter = createFlavorAdapter(flavor)
      const startSession = vi.spyOn(adapter, 'startSession')

      const result = await startSessionWithRuntimeSelection({
        sessionId: 'session-1',
        flavor,
        payload: {},
        adapter,
      })

      expect(result.runtimeMode).toBe('standalone')
      expect(startSession).not.toHaveBeenCalled()
    },
  )
})
