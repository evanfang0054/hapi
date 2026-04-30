# Rewind Message Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Web 端点击 rewind 后，当前会话消息窗口自动刷新到服务端最新状态，且刷新期间不出现空屏。

**Architecture:** 在 `message-window-store` 中新增 rewind 专用的 replace-refresh 路径，保留现有普通拉取的 merge 行为。`useSessionActions` 和 `useSSE` 在 rewind 成功/收到 `messages-rewound` 事件时调用同一刷新函数，继续 invalidation session detail/list。

**Tech Stack:** React 19, TanStack Query, Vitest, jsdom, TypeScript, HAPI `ApiClient`, existing external message window store.

---

## File Structure

- Modify: `web/src/lib/message-window-store.ts`
  - 新增 `refreshMessagesAfterRewind(api, sessionId)`。
  - 负责保留旧 `messages`、设置 loading、请求最新页，并用服务端返回的 latest page 替换 visible window 和 pending。

- Modify: `web/src/hooks/mutations/useSessionActions.ts`
  - rewind mutation 成功后调用 `refreshMessagesAfterRewind`，不再 `clearMessageWindow`。

- Modify: `web/src/hooks/useSSE.ts`
  - 给 `useSSE` options 增加可选 `api?: ApiClient | null`。
  - `messages-rewound` 事件触发同一刷新路径。

- Modify: `web/src/App.tsx`
  - 调用 `useSSE` 时传入当前 `api`。

- Modify: `web/src/lib/message-window-store.test.ts`
  - 覆盖 rewind refresh 不空屏、成功替换、失败保留旧消息。

- Modify: `web/src/hooks/useSSE.test.ts`
  - 更新 mock，并验证 `messages-rewound` 调用 refresh 而不是 clear。

---

### Task 1: Add rewind refresh tests for message window store

**Files:**
- Modify: `web/src/lib/message-window-store.test.ts`

- [x] **Step 1: Import the functions under test**

Update the import block in `web/src/lib/message-window-store.test.ts` from:

```ts
import {
    clearMessageWindow,
    getMessageWindowState,
    getPersistableMessageWindowSnapshot,
    hydrateMessageWindowFromSnapshot,
} from './message-window-store'
```

to:

```ts
import {
    clearMessageWindow,
    getMessageWindowState,
    getPersistableMessageWindowSnapshot,
    hydrateMessageWindowFromSnapshot,
    refreshMessagesAfterRewind,
} from './message-window-store'
```

- [x] **Step 2: Add message factory and API mock helper**

Add this code after the existing `message` constant:

```ts
function makeMessage(id: string, seq: number, text: string): DecryptedMessage {
    return {
        id,
        seq,
        createdAt: seq,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text,
            },
        },
        status: 'sent',
        originalText: text,
        localId: null,
    }
}

function createApi(messages: DecryptedMessage[], hasMore = false) {
    return {
        getMessages: vi.fn(async () => ({
            messages,
            page: { hasMore },
        })),
    }
}
```

Also update the Vitest import at the top from:

```ts
import { describe, expect, it } from 'vitest'
```

to:

```ts
import { describe, expect, it, vi } from 'vitest'
```

- [x] **Step 3: Write failing test for preserving old messages while refresh is in flight**

Add this `describe` block after the existing snapshot helper tests:

```ts
describe('message-window-store rewind refresh', () => {
    it('keeps existing messages while loading rewind refresh', async () => {
        const sessionId = 'rewind-loading'
        const oldMessage = makeMessage('old-1', 1, 'old')
        const newMessage = makeMessage('new-1', 1, 'new')
        let resolveRequest: ((value: { messages: DecryptedMessage[]; page: { hasMore: boolean } }) => void) | null = null
        const api = {
            getMessages: vi.fn(() => new Promise<{ messages: DecryptedMessage[]; page: { hasMore: boolean } }>((resolve) => {
                resolveRequest = resolve
            })),
        }

        hydrateMessageWindowFromSnapshot({
            sessionId,
            messages: [oldMessage],
            oldestSeq: 1,
            newestSeq: 1,
            hasMore: false,
            atBottom: true,
            savedAt: Date.now(),
        })

        const promise = refreshMessagesAfterRewind(api as never, sessionId)

        expect(getMessageWindowState(sessionId).messages).toEqual([oldMessage])
        expect(getMessageWindowState(sessionId).isLoading).toBe(true)

        resolveRequest?.({ messages: [newMessage], page: { hasMore: false } })
        await promise
        clearMessageWindow(sessionId)
    })
})
```

- [x] **Step 4: Write failing test for replacing messages with server result**

Add this test inside the same `describe` block:

```ts
it('replaces visible messages with the server page after rewind refresh succeeds', async () => {
    const sessionId = 'rewind-replace'
    const removedMessage = makeMessage('removed-1', 3, 'removed by rewind')
    const keptMessage = makeMessage('kept-1', 1, 'kept')
    const api = createApi([keptMessage], true)

    hydrateMessageWindowFromSnapshot({
        sessionId,
        messages: [keptMessage, removedMessage],
        oldestSeq: 1,
        newestSeq: 3,
        hasMore: false,
        atBottom: false,
        savedAt: Date.now(),
    })

    await refreshMessagesAfterRewind(api as never, sessionId)

    const state = getMessageWindowState(sessionId)
    expect(api.getMessages).toHaveBeenCalledWith(sessionId, { limit: 50, beforeSeq: null })
    expect(state.messages).toEqual([keptMessage])
    expect(state.pending).toEqual([])
    expect(state.pendingCount).toBe(0)
    expect(state.hasMore).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(state.warning).toBeNull()
    expect(state.atBottom).toBe(true)
    clearMessageWindow(sessionId)
})
```

- [x] **Step 5: Write failing test for preserving old messages on refresh failure**

Add this test inside the same `describe` block:

```ts
it('keeps existing messages and shows warning when rewind refresh fails', async () => {
    const sessionId = 'rewind-failure'
    const oldMessage = makeMessage('old-1', 1, 'old')
    const api = {
        getMessages: vi.fn(async () => {
            throw new Error('network down')
        }),
    }

    hydrateMessageWindowFromSnapshot({
        sessionId,
        messages: [oldMessage],
        oldestSeq: 1,
        newestSeq: 1,
        hasMore: false,
        atBottom: true,
        savedAt: Date.now(),
    })

    await refreshMessagesAfterRewind(api as never, sessionId)

    const state = getMessageWindowState(sessionId)
    expect(state.messages).toEqual([oldMessage])
    expect(state.isLoading).toBe(false)
    expect(state.warning).toBe('network down')
    clearMessageWindow(sessionId)
})
```

- [x] **Step 6: Run the targeted test and verify it fails**

Run from repo root:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi && cd web && bunx vitest run src/lib/message-window-store.test.ts
```

Expected: FAIL because `refreshMessagesAfterRewind` is not exported yet.

---

### Task 2: Implement rewind refresh in message window store

**Files:**
- Modify: `web/src/lib/message-window-store.ts`
- Test: `web/src/lib/message-window-store.test.ts`

- [x] **Step 1: Add the exported function**

In `web/src/lib/message-window-store.ts`, add this function after `fetchLatestMessages` and before `fetchOlderMessages`:

```ts
export async function refreshMessagesAfterRewind(api: ApiClient, sessionId: string): Promise<void> {
    const initial = getState(sessionId)
    if (initial.isLoading) {
        return
    }

    updateState(sessionId, (prev) => buildState(prev, { isLoading: true, warning: null }), true)

    try {
        const response = await api.getMessages(sessionId, { limit: PAGE_SIZE, beforeSeq: null })
        updateState(sessionId, (prev) => {
            const trimmed = trimVisible(response.messages, 'append')
            return buildState(prev, {
                messages: trimmed,
                pending: [],
                pendingOverflowCount: 0,
                pendingVisibleCount: 0,
                pendingOverflowVisibleCount: 0,
                hasMore: response.page.hasMore,
                isLoading: false,
                warning: null,
                atBottom: true,
            })
        }, true)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to refresh messages after rewind'
        updateState(sessionId, (prev) => buildState(prev, { isLoading: false, warning: message }), true)
    }
}
```

- [x] **Step 2: Run message-window-store tests**

Run from repo root:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi && cd web && bunx vitest run src/lib/message-window-store.test.ts
```

Expected: PASS.

---

### Task 3: Use rewind refresh after local rewind action

**Files:**
- Modify: `web/src/hooks/mutations/useSessionActions.ts`

- [x] **Step 1: Update import**

Change:

```ts
import { clearMessageWindow } from '@/lib/message-window-store'
```

to:

```ts
import { clearMessageWindow, refreshMessagesAfterRewind } from '@/lib/message-window-store'
```

- [x] **Step 2: Replace rewind onSuccess clear with refresh**

Change the `rewindMutation` `onSuccess` block from:

```ts
onSuccess: () => {
    if (sessionId) {
        clearMessageWindow(sessionId)
    }
    void invalidateSession()
},
```

to:

```ts
onSuccess: () => {
    if (api && sessionId) {
        void refreshMessagesAfterRewind(api, sessionId)
    }
    void invalidateSession()
},
```

- [x] **Step 3: Run TypeScript check for web**

Run from repo root:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web
```

Expected: no new errors from `useSessionActions.ts`.

---

### Task 4: Use rewind refresh for SSE messages-rewound events

**Files:**
- Modify: `web/src/hooks/useSSE.ts`
- Modify: `web/src/App.tsx`
- Test: `web/src/hooks/useSSE.test.ts`

- [x] **Step 1: Update useSSE imports**

In `web/src/hooks/useSSE.ts`, add `ApiClient` import:

```ts
import type { ApiClient } from '@/api/client'
```

Change the message window import from:

```ts
import { clearMessageWindow, ingestIncomingMessages } from '@/lib/message-window-store'
```

to:

```ts
import { clearMessageWindow, ingestIncomingMessages, refreshMessagesAfterRewind } from '@/lib/message-window-store'
```

- [x] **Step 2: Add optional api to useSSE options type**

Change the `useSSE` options type from:

```ts
export function useSSE(options: {
    enabled: boolean
    token: string
    baseUrl: string
    subscription?: SSESubscription
    onEvent: (event: SyncEvent) => void
    onConnect?: () => void
    onDisconnect?: (reason: string) => void
    onError?: (error: unknown) => void
    onToast?: (event: ToastEvent) => void
}): { subscriptionId: string | null } {
```

to:

```ts
export function useSSE(options: {
    enabled: boolean
    token: string
    baseUrl: string
    api?: ApiClient | null
    subscription?: SSESubscription
    onEvent: (event: SyncEvent) => void
    onConnect?: () => void
    onDisconnect?: (reason: string) => void
    onError?: (error: unknown) => void
    onToast?: (event: ToastEvent) => void
}): { subscriptionId: string | null } {
```

- [x] **Step 3: Replace messages-rewound clear with refresh when api exists**

Change:

```ts
if (event.type === 'messages-rewound') {
    clearMessageWindow(event.sessionId)
    queueSessionDetailInvalidation(event.sessionId)
    queueSessionListInvalidation()
}
```

to:

```ts
if (event.type === 'messages-rewound') {
    if (options.api) {
        void refreshMessagesAfterRewind(options.api, event.sessionId)
    } else {
        clearMessageWindow(event.sessionId)
    }
    queueSessionDetailInvalidation(event.sessionId)
    queueSessionListInvalidation()
}
```

- [x] **Step 4: Pass api from App**

In `web/src/App.tsx`, change the `useSSE` call from:

```ts
const { subscriptionId } = useSSE({
    enabled: Boolean(api && token),
    token: token ?? '',
    baseUrl,
    subscription: eventSubscription,
    onConnect: handleSseConnect,
    onDisconnect: handleSseDisconnect,
    onEvent: handleSseEvent,
    onToast: handleToast
})
```

to:

```ts
const { subscriptionId } = useSSE({
    enabled: Boolean(api && token),
    token: token ?? '',
    baseUrl,
    api,
    subscription: eventSubscription,
    onConnect: handleSseConnect,
    onDisconnect: handleSseDisconnect,
    onEvent: handleSseEvent,
    onToast: handleToast
})
```

- [x] **Step 5: Update useSSE test mock**

In `web/src/hooks/useSSE.test.ts`, change the import from:

```ts
import { clearMessageWindow } from '@/lib/message-window-store'
```

to:

```ts
import { clearMessageWindow, refreshMessagesAfterRewind } from '@/lib/message-window-store'
```

Change the mock from:

```ts
vi.mock('@/lib/message-window-store', () => ({
  clearMessageWindow: vi.fn(),
  ingestIncomingMessages: vi.fn(),
}))
```

to:

```ts
vi.mock('@/lib/message-window-store', () => ({
  clearMessageWindow: vi.fn(),
  ingestIncomingMessages: vi.fn(),
  refreshMessagesAfterRewind: vi.fn(),
}))
```

- [x] **Step 6: Add Harness that passes api**

Add this component after `HookHarness`:

```ts
function HookHarnessWithApi(props: { api: unknown }) {
  useSSE({
    enabled: true,
    token: 'token-1',
    baseUrl: 'https://example.com',
    api: props.api as never,
    subscription: { all: true },
    onEvent: vi.fn(),
  })

  return null
}
```

- [x] **Step 7: Add SSE rewind refresh test**

Add this test inside `describe('useSSE visibility recovery', () => { ... })`:

```ts
it('refreshes message window when messages-rewound event arrives and api is available', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const api = { getMessages: vi.fn() }

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(HookHarnessWithApi, { api })
    )
  )

  const source = MockEventSource.instances[0]
  expect(source).toBeDefined()

  act(() => {
    source?.onmessage?.(new MessageEvent('message', {
      data: JSON.stringify({
        type: 'messages-rewound',
        sessionId: 'session-a',
      }),
    }))
  })

  expect(refreshMessagesAfterRewind).toHaveBeenCalledWith(api, 'session-a')
  expect(clearMessageWindow).not.toHaveBeenCalledWith('session-a')
})
```

- [x] **Step 8: Run SSE tests**

Run from repo root:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi && cd web && bunx vitest run src/hooks/useSSE.test.ts
```

Expected: PASS.

---

### Task 5: Final validation

**Files:**
- Test only.

- [x] **Step 1: Run targeted tests together**

Run from repo root:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi && cd web && bunx vitest run src/lib/message-window-store.test.ts src/hooks/useSSE.test.ts
```

Expected: PASS.

- [x] **Step 2: Run web typecheck**

Run from repo root:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web
```

Expected: PASS, or only pre-existing unrelated errors if the branch already has known failures.

- [ ] **Step 3: Manual verification**

In the browser:

1. Open a session page such as `/sessions/503c50f4-911b-4547-8c41-71bdd46222fa`.
2. Click rewind on a previous user message.
3. Verify the chat does not blank out immediately.
4. Verify loading state may appear briefly while old messages remain visible.
5. Verify after refresh, messages at and after the rewind target disappear.
6. Verify manual refresh is no longer required.

---

## Self-Review

- Spec coverage: local rewind action, SSE `messages-rewound`, non-empty refresh UX, replace-not-merge semantics, failure preservation, and tests are all covered.
- Review follow-up: added coverage for rewind refresh while a regular load is already in flight, and changed `refreshMessagesAfterRewind` so it does not skip the replace-refresh when `isLoading` is already true.
- Race follow-up: added generation guarding so a stale `fetchLatestMessages` response that started before rewind refresh cannot merge removed messages back into the visible window, overwrite the refreshed window with a stale warning, or clear the loading state of an in-flight rewind refresh.
- SSE fallback follow-up: added coverage for `messages-rewound` without `api` falling back to `clearMessageWindow`, and with `api` calling `refreshMessagesAfterRewind`.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: `refreshMessagesAfterRewind(api: ApiClient, sessionId: string)` is introduced once and used consistently in store, mutation hook, SSE hook, and tests.
