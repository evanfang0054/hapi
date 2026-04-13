// @vitest-environment jsdom
import { createElement } from 'react'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSSE } from './useSSE'

class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  static instances: MockEventSource[] = []

  readonly url: string
  readyState = MockEventSource.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  close = vi.fn(() => {
    this.readyState = MockEventSource.CLOSED
  })

  constructor(url: string | URL) {
    this.url = String(url)
    MockEventSource.instances.push(this)
  }
}

function HookHarness(props: { onDisconnect: (reason: string) => void }) {
  useSSE({
    enabled: true,
    token: 'token-1',
    baseUrl: 'https://example.com',
    subscription: { all: true },
    onEvent: vi.fn(),
    onDisconnect: props.onDisconnect,
  })

  return null
}

describe('useSSE visibility recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-13T10:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    MockEventSource.instances = []
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource,
    })
  })

  afterEach(() => {
    cleanupVisibilityState()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('reconnects immediately when page becomes visible and stream is stale', () => {
    const onDisconnect = vi.fn()
    setVisibilityState('hidden')

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(HookHarness, { onDisconnect })
      )
    )

    expect(MockEventSource.instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(90_001)
      setVisibilityState('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(onDisconnect).toHaveBeenCalledWith('visibility-recovery')
  })

  it('opens a fresh EventSource after visibility recovery reconnect', () => {
    const onDisconnect = vi.fn()
    setVisibilityState('hidden')

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(HookHarness, { onDisconnect })
      )
    )

    const firstSource = MockEventSource.instances[0]
    expect(firstSource).toBeDefined()
    expect(firstSource?.url).toContain('visibility=hidden')

    act(() => {
      vi.advanceTimersByTime(90_001)
      setVisibilityState('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(onDisconnect).toHaveBeenCalledWith('visibility-recovery')
    expect(firstSource?.close).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(MockEventSource.instances).toHaveLength(2)
    expect(MockEventSource.instances[1]?.url).toContain('visibility=visible')
  })
})

function setVisibilityState(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function cleanupVisibilityState() {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
}
