# Session Continuity P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make session chat feel continuous by restoring drafts and recent messages instantly, preserving basic reading position, and offering clear weak-network recovery with manual refresh.

**Architecture:** Keep the existing `message-window-store` as the runtime source of truth for chat history and SSE ingestion. Add three focused persistence layers around it: a draft store for unsent text, a message snapshot store for fast chat re-entry, and a lightweight view-state store for bottom-vs-history restoration. Derive stable weak-network recovery state in `App.tsx` from `useSSE` callbacks, then thread that state through route/context props so `SessionChat` can show cached content first and offer manual refresh when the network is unstable.

**Tech Stack:** React 19, TanStack Router, TanStack Query, Vitest, Testing Library, localStorage, existing custom message-window-store + SSE pipeline.

---

## File Structure

### New files
- `web/src/lib/session-draft-store.ts` — session-scoped draft persistence using in-memory cache plus `localStorage`
- `web/src/lib/session-message-snapshot.ts` — serializes and persists the visible message window for each session
- `web/src/lib/session-view-state.ts` — stores basic reading-position state (`atBottom`, anchor seq, timestamp)
- `web/src/lib/session-draft-store.test.ts` — unit tests for draft persistence and cleanup behavior
- `web/src/lib/session-message-snapshot.test.ts` — unit tests for snapshot persistence and restore rules
- `web/src/lib/session-view-state.test.ts` — unit tests for reading-position persistence

### Modified files
- `web/src/components/AssistantChat/HappyComposer.tsx` — hydrate/save/clear draft text per session
- `web/src/components/SessionChat.tsx` — pass `sessionId` into composer, render continuity status banner, expose manual refresh UI
- `web/src/components/AssistantChat/HappyThread.tsx` — persist/read basic view state and restore bottom/history behavior
- `web/src/hooks/queries/useMessages.ts` — restore message snapshots before network fetch, persist snapshots on cleanup, surface initial hydration state
- `web/src/lib/message-window-store.ts` — expose import/export helpers for persistable runtime state and support snapshot-based recovery on route exits
- `web/src/lib/app-context.tsx` — expose shared `connectionState` through app context
- `web/src/App.tsx` — derive stable `connectionState` from `useSSE` callbacks and refresh outcomes
- `web/src/router.tsx` — thread new message state / refresh state props into `SessionChat`

### Existing tests to extend
- `web/src/routes/sessions/terminal.test.tsx` — use as a pattern for route-level rendering and user interactions
- `web/src/components/LoginPrompt.test.tsx` — use as a pattern for localStorage mocking and Testing Library setup

---

### Task 1: Add session draft persistence

**Status:** Completed on 2026-04-09.
**Completed work:** Added `web/src/lib/session-draft-store.ts` and `web/src/lib/session-draft-store.test.ts` with coverage for session isolation, blank-draft cleanup, localStorage round-trip restore, malformed JSON tolerance, and filtering invalid persisted values.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-draft-store.test.ts` ✅ (6 tests passed)

**Files:**
- Create: `web/src/lib/session-draft-store.ts`
- Test: `web/src/lib/session-draft-store.test.ts`

- [x] **Step 1: Write the failing draft-store tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSessionDraft,
  getSessionDraft,
  setSessionDraft,
  __resetSessionDraftStoreForTests,
} from './session-draft-store'

describe('session-draft-store', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetSessionDraftStoreForTests()
  })

  it('persists and restores draft text by session id', () => {
    setSessionDraft('session-1', 'draft message')
    expect(getSessionDraft('session-1')).toBe('draft message')
  })

  it('clears a draft without affecting other sessions', () => {
    setSessionDraft('session-1', 'first')
    setSessionDraft('session-2', 'second')

    clearSessionDraft('session-1')

    expect(getSessionDraft('session-1')).toBe('')
    expect(getSessionDraft('session-2')).toBe('second')
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-draft-store.test.ts`
Expected: FAIL with `Cannot find module './session-draft-store'`.

- [x] **Step 3: Write the minimal draft store implementation**

```ts
const STORAGE_KEY = 'hapi:session-drafts'

const memory = new Map<string, string>()
let hydrated = false

function load(): void {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  const parsed = JSON.parse(raw) as Record<string, string>
  for (const [sessionId, text] of Object.entries(parsed)) {
    if (typeof text === 'string' && text.length > 0) {
      memory.set(sessionId, text)
    }
  }
}

function save(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memory)))
}

export function getSessionDraft(sessionId: string): string {
  load()
  return memory.get(sessionId) ?? ''
}

export function setSessionDraft(sessionId: string, text: string): void {
  load()
  if (text.trim().length === 0) {
    memory.delete(sessionId)
  } else {
    memory.set(sessionId, text)
  }
  save()
}

export function clearSessionDraft(sessionId: string): void {
  load()
  memory.delete(sessionId)
  save()
}

export function __resetSessionDraftStoreForTests(): void {
  memory.clear()
  hydrated = false
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-draft-store.test.ts`
Expected: PASS with 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/session-draft-store.ts web/src/lib/session-draft-store.test.ts
git commit -m "feat(web): persist session drafts locally"
```

---

### Task 2: Restore and clear drafts inside HappyComposer

**Status:** Completed on 2026-04-09.
**Completed work:** Updated `web/src/components/AssistantChat/HappyComposer.tsx` to hydrate per-session drafts, debounce local draft persistence, clear stored drafts on both button send and `Shift+Enter`, and force session changes to synchronize the composer to that session's own draft (including empty drafts) so stale text no longer bleeds across sessions. Added a hydration guard to avoid persistence races while switching sessions. Updated `web/src/components/SessionChat.tsx` to pass `sessionId`, and added `web/src/components/AssistantChat/HappyComposer.test.tsx` with coverage for initial hydration, session switching, switching to a session without a saved draft, debounce persistence, clearing drafts when the composer becomes empty, button send clear, and keyboard send clear.
**Verification:** `bun run --cwd "/Users/arwen/Desktop/Arwen/evanfang/hapi" typecheck:web` ✅. Focused Vitest rerun for `src/components/AssistantChat/HappyComposer.test.tsx` is currently blocked in this environment by Vitest worker OOM (`ERR_WORKER_OUT_OF_MEMORY`) before test execution.

**Files:**
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/components/SessionChat.tsx:373-402`
- Test: `web/src/components/AssistantChat/HappyComposer.test.tsx`

- [x] **Step 1: Write the failing composer draft test**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { HappyComposer } from './HappyComposer'

const setText = vi.fn()
const send = vi.fn()

vi.mock('@assistant-ui/react', () => ({
  ComposerPrimitive: {
    Input: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  },
  useAssistantApi: () => ({ composer: () => ({ setText, send }) }),
  useAssistantState: (selector: (state: any) => unknown) =>
    selector({ composer: { text: '', attachments: [] }, thread: { isRunning: false, isDisabled: false } }),
}))

it('hydrates persisted draft text for the active session', () => {
  localStorage.setItem('hapi:session-drafts', JSON.stringify({ 'session-1': 'draft from storage' }))

  render(
    <I18nProvider>
      <HappyComposer sessionId="session-1" />
    </I18nProvider>
  )

  expect(setText).toHaveBeenCalledWith('draft from storage')
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/AssistantChat/HappyComposer.test.tsx`
Expected: FAIL because `sessionId` prop does not exist and no hydration happens.

- [x] **Step 3: Add `sessionId` prop and sync draft state**

```tsx
export function HappyComposer(props: {
  sessionId: string
  disabled?: boolean
  // ...existing props
}) {
  const { sessionId } = props

  useEffect(() => {
    const savedDraft = getSessionDraft(sessionId)
    if (savedDraft && savedDraft !== composerText) {
      api.composer().setText(savedDraft)
      setInputState({
        text: savedDraft,
        selection: { start: savedDraft.length, end: savedDraft.length },
      })
    }
  }, [api, composerText, sessionId])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSessionDraft(sessionId, composerText)
    }, 150)
    return () => window.clearTimeout(handle)
  }, [composerText, sessionId])

  const handleSend = useCallback((event?: ReactFormEvent) => {
    event?.preventDefault()
    if (!canSend) return
    api.composer().send()
    clearSessionDraft(sessionId)
  }, [api, canSend, sessionId])
}
```

- [x] **Step 4: Thread `sessionId` through `SessionChat`**

```tsx
<HappyComposer
  sessionId={props.session.id}
  disabled={props.isSending}
  permissionMode={props.session.permissionMode}
  // ...existing props
/>
```

- [x] **Step 5: Run focused tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/AssistantChat/HappyComposer.test.tsx`
Expected: PASS with draft hydration and draft clearing coverage.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/AssistantChat/HappyComposer.tsx web/src/components/SessionChat.tsx web/src/components/AssistantChat/HappyComposer.test.tsx
git commit -m "feat(web): restore unsent chat drafts per session"
```

---

### Task 3: Add session message snapshot persistence

**Status:** Completed on 2026-04-09.
**Completed work:** Added `web/src/lib/session-message-snapshot.ts` and `web/src/lib/session-message-snapshot.test.ts` to persist per-session visible message snapshots with round-trip load/save and explicit clear behavior.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-message-snapshot.test.ts` ✅ (2 tests passed)

**Files:**
- Create: `web/src/lib/session-message-snapshot.ts`
- Test: `web/src/lib/session-message-snapshot.test.ts`

- [x] **Step 1: Write the failing snapshot-store tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionMessageSnapshot,
  loadSessionMessageSnapshot,
  saveSessionMessageSnapshot,
} from './session-message-snapshot'

const snapshot = {
  sessionId: 'session-1',
  messages: [{ id: 'm1', seq: 1, createdAt: 1, status: 'sent', content: { role: 'user', content: { type: 'text', text: 'hi' } }, originalText: 'hi', localId: null }],
  oldestSeq: 1,
  newestSeq: 1,
  hasMore: false,
  atBottom: true,
  savedAt: 123,
}

describe('session-message-snapshot', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a saved snapshot', () => {
    saveSessionMessageSnapshot(snapshot)
    expect(loadSessionMessageSnapshot('session-1')).toEqual(snapshot)
  })

  it('removes a snapshot cleanly', () => {
    saveSessionMessageSnapshot(snapshot)
    clearSessionMessageSnapshot('session-1')
    expect(loadSessionMessageSnapshot('session-1')).toBeNull()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-message-snapshot.test.ts`
Expected: FAIL with missing module error.

- [x] **Step 3: Implement the snapshot store**

```ts
import type { DecryptedMessage } from '@/types/api'

export type SessionMessageSnapshot = {
  sessionId: string
  messages: DecryptedMessage[]
  oldestSeq: number | null
  newestSeq: number | null
  hasMore: boolean
  atBottom: boolean
  savedAt: number
}

const STORAGE_KEY = 'hapi:session-message-snapshots'

function readAll(): Record<string, SessionMessageSnapshot> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, SessionMessageSnapshot>
}

function writeAll(next: Record<string, SessionMessageSnapshot>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function loadSessionMessageSnapshot(sessionId: string): SessionMessageSnapshot | null {
  return readAll()[sessionId] ?? null
}

export function saveSessionMessageSnapshot(snapshot: SessionMessageSnapshot): void {
  const all = readAll()
  all[snapshot.sessionId] = snapshot
  writeAll(all)
}

export function clearSessionMessageSnapshot(sessionId: string): void {
  const all = readAll()
  delete all[sessionId]
  writeAll(all)
}
```

- [x] **Step 4: Run the tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-message-snapshot.test.ts`
Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/session-message-snapshot.ts web/src/lib/session-message-snapshot.test.ts
git commit -m "feat(web): add session message snapshot persistence"
```

---

### Task 4: Teach message-window-store to export and hydrate snapshots

**Status:** Completed on 2026-04-09.
**Completed work:** Updated `web/src/lib/message-window-store.ts` to export persistable message snapshots, hydrate visible messages from persisted snapshots, and expose `clearRuntimeMessageWindow` for route-exit cleanup after snapshot persistence. Added `web/src/lib/message-window-store.test.ts` to cover snapshot hydration and export behavior.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/message-window-store.test.ts` ✅ (2 tests passed)

**Files:**
- Modify: `web/src/lib/message-window-store.ts`
- Test: `web/src/lib/message-window-store.test.ts`

- [x] **Step 1: Write the failing message-window snapshot tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  getPersistableMessageWindowSnapshot,
  hydrateMessageWindowFromSnapshot,
  getMessageWindowState,
} from './message-window-store'

it('hydrates visible messages from a persisted snapshot', () => {
  hydrateMessageWindowFromSnapshot({
    sessionId: 'session-1',
    messages: [{ id: 'm1', seq: 1, createdAt: 1, status: 'sent', content: { role: 'user', content: { type: 'text', text: 'hello' } }, originalText: 'hello', localId: null }],
    oldestSeq: 1,
    newestSeq: 1,
    hasMore: false,
    atBottom: true,
    savedAt: Date.now(),
  })

  expect(getMessageWindowState('session-1').messages).toHaveLength(1)
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/message-window-store.test.ts`
Expected: FAIL because helper exports do not exist.

- [x] **Step 3: Add persistable snapshot helpers without storing runtime-only fields**

```ts
export function getPersistableMessageWindowSnapshot(sessionId: string): SessionMessageSnapshot | null {
  const state = states.get(sessionId)
  if (!state || state.messages.length === 0) {
    return null
  }

  return {
    sessionId,
    messages: state.messages,
    oldestSeq: state.oldestSeq,
    newestSeq: state.newestSeq,
    hasMore: state.hasMore,
    atBottom: state.atBottom,
    savedAt: Date.now(),
  }
}

export function hydrateMessageWindowFromSnapshot(snapshot: SessionMessageSnapshot): void {
  const next = buildState(createState(snapshot.sessionId), {
    messages: snapshot.messages,
    pending: [],
    hasMore: snapshot.hasMore,
    atBottom: snapshot.atBottom,
    warning: null,
  })
  states.set(snapshot.sessionId, next)
}
```

- [x] **Step 4: Replace destructive cleanup with snapshot-friendly route-exit cleanup**

```ts
useEffect(() => {
  if (!sessionId) return
  return () => {
    const snapshot = getPersistableMessageWindowSnapshot(sessionId)
    if (snapshot) {
      saveSessionMessageSnapshot(snapshot)
    }
    clearRuntimeMessageWindow(sessionId)
  }
}, [sessionId])
```

Keep `clearMessageWindow` only for explicit destructive use cases; route exits should persist a recoverable snapshot before cleanup so chat can hydrate instantly on re-entry.

- [x] **Step 5: Run focused tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/message-window-store.test.ts`
Expected: PASS with snapshot hydration/export coverage.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/message-window-store.ts web/src/lib/message-window-store.test.ts
git commit -m "feat(web): support message window snapshot hydration"
```

---

### Task 5: Hydrate messages before fetching and persist snapshots on route exit

**Status:** Completed on 2026-04-09.
**Completed work:** Updated `web/src/hooks/queries/useMessages.ts` to hydrate a persisted session snapshot before refetching, save the visible message snapshot on cleanup, and expose `isHydratedFromSnapshot` for cache-aware recovery UI. Added `web/src/hooks/queries/useMessages.test.tsx` covering cached-first render and snapshot persistence on unmount, and adjusted `web/src/lib/message-window-store.ts` unsubscribe cleanup so route exits preserve recoverability through persisted snapshots.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/queries/useMessages.test.tsx` ✅ (2 tests passed); `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/message-window-store.test.ts src/lib/session-message-snapshot.test.ts` ✅ (4 tests passed)

**Files:**
- Modify: `web/src/hooks/queries/useMessages.ts`
- Test: `web/src/hooks/queries/useMessages.test.tsx`

- [x] **Step 1: Write the failing hook test**

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMessages } from './useMessages'

vi.mock('@/lib/session-message-snapshot', () => ({
  loadSessionMessageSnapshot: vi.fn(() => ({
    sessionId: 'session-1',
    messages: [{ id: 'm1', seq: 1, createdAt: 1, status: 'sent', content: { role: 'user', content: { type: 'text', text: 'cached' } }, originalText: 'cached', localId: null }],
    oldestSeq: 1,
    newestSeq: 1,
    hasMore: false,
    atBottom: true,
    savedAt: Date.now(),
  })),
  saveSessionMessageSnapshot: vi.fn(),
}))

it('returns cached messages before refetch completes', async () => {
  const api = { getMessages: vi.fn(() => new Promise(() => {})) } as any
  const { result } = renderHook(() => useMessages(api, 'session-1'))
  expect(result.current.messages[0]?.id).toBe('m1')
  expect(result.current.isLoading).toBe(true)
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/queries/useMessages.test.tsx`
Expected: FAIL because the hook only fetches and never hydrates from cache.

- [x] **Step 3: Hydrate snapshot before refetch**

```ts
useEffect(() => {
  if (!sessionId) return
  const snapshot = loadSessionMessageSnapshot(sessionId)
  if (snapshot) {
    hydrateMessageWindowFromSnapshot(snapshot)
  }
}, [sessionId])

useEffect(() => {
  if (!api || !sessionId) return
  void fetchLatestMessages(api, sessionId)
}, [api, sessionId])
```

- [x] **Step 4: Persist snapshot on cleanup instead of destroying recoverable state**

```ts
useEffect(() => {
  if (!sessionId) return
  return () => {
    const snapshot = getPersistableMessageWindowSnapshot(sessionId)
    if (snapshot) {
      saveSessionMessageSnapshot(snapshot)
    }
    clearRuntimeMessageWindow(sessionId)
  }
}, [sessionId])
```

- [ ] **Step 5: Add explicit initial hydration state to support UI banners**

```ts
const [isHydratedFromSnapshot, setIsHydratedFromSnapshot] = useState(false)

useEffect(() => {
  if (!sessionId) return
  const snapshot = loadSessionMessageSnapshot(sessionId)
  setIsHydratedFromSnapshot(Boolean(snapshot))
  if (snapshot) {
    hydrateMessageWindowFromSnapshot(snapshot)
  }
}, [sessionId])
```

Return `isHydratedFromSnapshot` from the hook.

- [x] **Step 6: Run focused tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/queries/useMessages.test.tsx`
Expected: PASS with hydration and cleanup assertions.

- [ ] **Step 7: Commit**

```bash
git add web/src/hooks/queries/useMessages.ts web/src/hooks/queries/useMessages.test.tsx
git commit -m "feat(web): restore recent messages before syncing"
```

---

### Task 6: Persist and restore basic reading position

**Status:** Completed on 2026-04-09.
**Completed work:** Added `web/src/lib/session-view-state.ts` and `web/src/lib/session-view-state.test.ts` for per-session reading-position persistence. Updated `web/src/components/AssistantChat/HappyThread.tsx` to save bottom-vs-history state on cleanup and restore either bottom position or a simple above-bottom offset on mount, with `web/src/components/AssistantChat/HappyThread.test.tsx` covering both persistence and bottom restoration. This delivers basic reading-position continuity rather than exact message-anchor restoration.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-view-state.test.ts src/components/AssistantChat/HappyThread.test.tsx` ✅ (3 tests passed)

**Files:**
- Create: `web/src/lib/session-view-state.ts`
- Modify: `web/src/components/AssistantChat/HappyThread.tsx`
- Test: `web/src/lib/session-view-state.test.ts`
- Test: `web/src/components/AssistantChat/HappyThread.test.tsx`

- [x] **Step 1: Write the failing view-state store tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { getSessionViewState, saveSessionViewState } from './session-view-state'

describe('session-view-state', () => {
  beforeEach(() => localStorage.clear())

  it('stores whether the user was at bottom', () => {
    saveSessionViewState({ sessionId: 'session-1', atBottom: false, anchorSeq: 42, savedAt: 100 })
    expect(getSessionViewState('session-1')).toEqual({ sessionId: 'session-1', atBottom: false, anchorSeq: 42, savedAt: 100 })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-view-state.test.ts`
Expected: FAIL with missing module error.

- [x] **Step 3: Implement the view-state store**

```ts
export type SessionViewState = {
  sessionId: string
  atBottom: boolean
  anchorSeq: number | null
  savedAt: number
}

const STORAGE_KEY = 'hapi:session-view-state'

export function getSessionViewState(sessionId: string): SessionViewState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const all = JSON.parse(raw) as Record<string, SessionViewState>
  return all[sessionId] ?? null
}

export function saveSessionViewState(state: SessionViewState): void {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const all = raw ? JSON.parse(raw) as Record<string, SessionViewState> : {}
  all[state.sessionId] = state
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}
```

- [x] **Step 4: Save scroll context from `HappyThread`**

```tsx
useEffect(() => {
  return () => {
    const viewport = viewportRef.current
    const atBottom = viewport
      ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 120
      : atBottomRef.current

    saveSessionViewState({
      sessionId: props.sessionId,
      atBottom,
      anchorSeq: atBottom ? null : props.messagesVersion,
      savedAt: Date.now(),
    })
  }
}, [props.messagesVersion, props.sessionId])
```

- [x] **Step 5: Restore bottom-vs-history behavior on mount**

```tsx
useLayoutEffect(() => {
  const viewport = viewportRef.current
  if (!viewport) return
  const state = getSessionViewState(props.sessionId)
  if (!state || state.atBottom) {
    viewport.scrollTop = viewport.scrollHeight
    return
  }
  viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight - 240)
}, [props.messagesVersion, props.sessionId])
```

Keep the first implementation intentionally simple: restore to bottom if the user was at bottom; otherwise keep them above the bottom and show the existing new-message indicator.

- [x] **Step 6: Run focused tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-view-state.test.ts src/components/AssistantChat/HappyThread.test.tsx`
Expected: PASS with bottom/history restoration coverage.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/session-view-state.ts web/src/lib/session-view-state.test.ts web/src/components/AssistantChat/HappyThread.tsx web/src/components/AssistantChat/HappyThread.test.tsx
git commit -m "feat(web): restore basic chat reading position"
```

---

### Task 7: Surface weak-network and refresh recovery UI

**Status:** Completed on 2026-04-09.
**Completed work:** Added `web/src/components/SessionChat.test.tsx` with coverage for cached-content retry and first-load recovery card states. Updated `web/src/App.tsx` to compute a stable `connectionState`, exposed it through `web/src/lib/app-context.tsx`, threaded it through `web/src/router.tsx`, and extended `web/src/hooks/queries/useMessages.ts` to return `isHydratedFromSnapshot` so `web/src/components/SessionChat.tsx` can render cache-aware weak-network recovery UI with manual retry. The final implementation keeps `useSSE` callback-based and derives UI-facing connection state in `App.tsx` rather than changing the `useSSE` return shape.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/SessionChat.test.tsx` ✅ (2 tests passed); `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web` ✅

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/lib/app-context.tsx`
- Modify: `web/src/router.tsx`
- Modify: `web/src/components/SessionChat.tsx`
- Modify: `web/src/hooks/queries/useMessages.ts`
- Test: `web/src/components/SessionChat.test.tsx`

- [x] **Step 1: Write the failing network-recovery UI test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionChat } from './SessionChat'

it('shows retry banner when sync failed but cached messages are visible', () => {
  const onRefresh = vi.fn()
  render(
    <I18nProvider>
      <SessionChat
        api={{} as any}
        session={{ id: 'session-1', active: true, thinking: false, permissionMode: 'default', collaborationMode: 'default', model: null, effort: null, metadata: {}, agentState: null } as any}
        messages={[]}
        messagesWarning={null}
        hasMoreMessages={false}
        isLoadingMessages={false}
        isLoadingMoreMessages={false}
        isSending={false}
        pendingCount={0}
        messagesVersion={1}
        onBack={vi.fn()}
        onRefresh={onRefresh}
        onLoadMore={vi.fn(async () => {})}
        onSend={vi.fn()}
        onFlushPending={vi.fn()}
        onAtBottomChange={vi.fn()}
        continuityState="refresh_failed"
        hasHydratedMessages
      />
    </I18nProvider>
  )

  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(onRefresh).toHaveBeenCalled()
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/SessionChat.test.tsx`
Expected: FAIL because `SessionChat` has no continuity banner API.

- [x] **Step 3: Derive a stable connection state in `App` from `useSSE` callbacks**

```ts
export type ConnectionState = 'connected' | 'reconnecting' | 'refresh_failed'

const [connectionState, setConnectionState] = useState<ConnectionState>('connected')

const handleSseConnect = useCallback(() => {
  setConnectionState('connected')
  // existing logic
}, [])

const handleSseDisconnect = useCallback(() => {
  setConnectionState('reconnecting')
}, [])
```

In `App.tsx`, if the reconnect-driven refresh promise fails, set `connectionState` to `'refresh_failed'` instead of only logging. Keep `useSSE` callback-based and expose the UI-facing state through app context / route props.

- [x] **Step 4: Pass continuity props from `router.tsx` into `SessionChat`**

```tsx
<SessionChat
  // existing props
  continuityState={connectionState}
  hasHydratedMessages={isHydratedFromSnapshot}
/>
```

- [x] **Step 5: Render cache-aware banners in `SessionChat`**

```tsx
{props.continuityState === 'refresh_failed' && props.hasHydratedMessages ? (
  <div className="border-b border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-[var(--app-fg)]">
    <div className="flex items-center justify-between gap-3">
      <span>网络恢复失败，当前显示的是缓存内容。</span>
      <Button variant="secondary" size="sm" onClick={props.onRefresh}>重试</Button>
    </div>
  </div>
) : null}
```

Also add a first-load empty-state card when `messages.length === 0`, `pendingCount === 0`, and `continuityState === 'refresh_failed'`.

- [x] **Step 6: Run focused tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/SessionChat.test.tsx`
Expected: PASS with retry-banner and empty-state refresh coverage.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx web/src/lib/app-context.tsx web/src/router.tsx web/src/components/SessionChat.tsx web/src/hooks/queries/useMessages.ts web/src/components/SessionChat.test.tsx
git commit -m "feat(web): add weak-network recovery UI for chat"
```

---

### Task 8: Run the relevant web test suite and fix regressions

**Status:** Completed on 2026-04-09.
**Completed work:** Ran the full continuity-focused web test suite, the broader affected regression tests, and web typecheck with no regressions found. No code changes were required beyond the previously completed continuity implementation.
**Verification:** `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/session-draft-store.test.ts src/lib/session-message-snapshot.test.ts src/lib/session-view-state.test.ts src/lib/message-window-store.test.ts src/hooks/queries/useMessages.test.tsx src/components/AssistantChat/HappyComposer.test.tsx src/components/AssistantChat/HappyThread.test.tsx src/components/SessionChat.test.tsx` ✅ (8 files, 22 tests passed); `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/routes/sessions/terminal.test.tsx src/components/LoginPrompt.test.tsx src/components/SessionList.test.tsx` ✅ (3 files, 4 tests passed); `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web` ✅

**Files:**
- Test: `web/src/lib/session-draft-store.test.ts`
- Test: `web/src/lib/session-message-snapshot.test.ts`
- Test: `web/src/lib/session-view-state.test.ts`
- Test: `web/src/lib/message-window-store.test.ts`
- Test: `web/src/hooks/queries/useMessages.test.tsx`
- Test: `web/src/components/AssistantChat/HappyComposer.test.tsx`
- Test: `web/src/components/AssistantChat/HappyThread.test.tsx`
- Test: `web/src/components/SessionChat.test.tsx`

- [x] **Step 1: Run the focused continuity suite**

Run:

```bash
cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run \
  src/lib/session-draft-store.test.ts \
  src/lib/session-message-snapshot.test.ts \
  src/lib/session-view-state.test.ts \
  src/lib/message-window-store.test.ts \
  src/hooks/queries/useMessages.test.tsx \
  src/components/AssistantChat/HappyComposer.test.tsx \
  src/components/AssistantChat/HappyThread.test.tsx \
  src/components/SessionChat.test.tsx
```

Expected: PASS for all new and modified continuity tests.

- [x] **Step 2: Run the broader affected web tests**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/routes/sessions/terminal.test.tsx src/components/LoginPrompt.test.tsx src/components/SessionList.test.tsx`
Expected: PASS with no regressions from localStorage mocks or route state changes.

- [x] **Step 3: Run type-safe verification**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web`
Expected: PASS with no new TypeScript errors.

- [ ] **Step 4: Commit the final integrated feature**

```bash
git add web/src/lib/session-draft-store.ts web/src/lib/session-message-snapshot.ts web/src/lib/session-view-state.ts \
  web/src/components/AssistantChat/HappyComposer.tsx web/src/components/AssistantChat/HappyThread.tsx \
  web/src/components/SessionChat.tsx web/src/hooks/queries/useMessages.ts web/src/lib/message-window-store.ts \
  web/src/hooks/useSSE.ts web/src/App.tsx web/src/router.tsx \
  web/src/lib/session-draft-store.test.ts web/src/lib/session-message-snapshot.test.ts \
  web/src/lib/session-view-state.test.ts web/src/lib/message-window-store.test.ts \
  web/src/hooks/queries/useMessages.test.tsx web/src/components/AssistantChat/HappyComposer.test.tsx \
  web/src/components/AssistantChat/HappyThread.test.tsx web/src/components/SessionChat.test.tsx
git commit -m "feat(web): improve session continuity in chat"
```

---

## Self-Review

### Spec coverage
- **消息秒开** — Task 3, Task 4, Task 5
- **草稿不丢** — Task 1, Task 2
- **返回断点** — Task 6（基础底部/历史恢复，不是精确消息锚点恢复）
- **弱网可恢复 / 手动刷新** — Task 7
- **验证与回归测试** — Task 8

No spec gaps remain for the agreed P0 scope.

### Placeholder scan
- No `TODO` / `TBD`
- Every task lists exact files
- Every code-writing step includes concrete code blocks
- Every verification step includes explicit commands and expected outcomes

### Type consistency
- Draft API names are consistent: `getSessionDraft`, `setSessionDraft`, `clearSessionDraft`
- Snapshot API names are consistent: `loadSessionMessageSnapshot`, `saveSessionMessageSnapshot`, `getPersistableMessageWindowSnapshot`, `hydrateMessageWindowFromSnapshot`
- View-state API names are consistent: `getSessionViewState`, `saveSessionViewState`
- UI prop names are consistent: `continuityState`, `hasHydratedMessages`
