# 安卓 PWA 系统通知扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有 H5 内横栏通知语义的前提下，为 Android Chrome / 已安装 PWA 增加系统通知能力：前台看当前会话时只显示站内 toast，后台、锁屏或正在看别的会话时走 Web Push + Service Worker 系统通知，并保证点击通知可回到对应 session。

**Architecture:** 继续以 `hub/src/notifications/notificationHub.ts` 为通知事件源，复用现有 `PushNotificationChannel`、`PushService` 和 `web/src/sw.ts`。在现有“namespace 级可见性”之上，新增“subscription 当前查看的 sessionId”状态，让 hub 能区分“用户正在看当前会话”与“只是页面前台但在看别的会话”；同时在 web 侧给 toast 加稳定 key 做本地去重，并让 service worker 优先聚焦已打开窗口后再跳转。

**Tech Stack:** Bun, Hono, React 19, TanStack Router, SSE, Service Worker, Web Push, Vitest, bun:test。

---

## File Structure

### New files
- `web/src/lib/notification-dedupe.ts` — 前端 toast 事件 key 生成与短期去重缓存
- `web/src/lib/notification-dedupe.test.ts` — 去重缓存单测
- `web/src/sw.test.ts` — Service Worker 的 push / click 行为测试

### Modified files
- `shared/src/schemas.ts` — 扩展 `toast` 事件 payload，增加稳定通知 key
- `web/src/types/api.ts` — 同步 `VisibilityPayload`，支持上报当前活跃 session
- `web/src/api/client.ts` — 支持带 `activeSessionId` 上报可见性
- `web/src/hooks/useVisibilityReporter.ts` — 上报 `document.visibilityState` + 当前活跃 session
- `web/src/hooks/useVisibilityReporter.test.tsx` — 覆盖可见状态下切换 session 的重新上报
- `web/src/lib/toast-context.tsx` — 支持带自定义 `id` 的 toast，便于幂等去重
- `web/src/App.tsx` — 读取 toast key；仅在未重复时显示站内 toast；把当前 route session 传给 visibility reporter
- `web/src/sw.ts` — 为系统通知增加稳定 `tag`、优先聚焦已有窗口、带 URL 跳转
- `hub/src/visibility/visibilityTracker.ts` — 从“namespace 是否有可见连接”升级为“subscription 可见性 + 当前活跃 session”追踪
- `hub/src/web/routes/events.ts` — `/visibility` 路由接收 `activeSessionId`
- `hub/src/sse/sseManager.ts` — 透传连接可见性与活跃 session 查询能力给通知层使用的 tracker
- `hub/src/notifications/notificationTypes.ts` — 如需要，补充通知 channel 所需的 payload 类型约束
- `hub/src/push/pushNotificationChannel.ts` — 按 active session 分流：看当前 session 则发 toast，不看当前 session 或后台则发 push；为 payload 注入通知 key
- `hub/src/notifications/notificationHub.test.ts` — 增加“前台正在当前 session 时只 toast、不 push；前台看别的 session 时 push；后台时 push”的覆盖
- `hub/src/sse/sseManager.test.ts` — 覆盖 visibility / activeSessionId 新行为

### Existing files to read during implementation
- `web/src/App.tsx` — 当前 `onToast` 入口与 push 权限订阅逻辑
- `web/src/hooks/usePushNotifications.ts` — 当前浏览器 push 订阅流程
- `hub/src/notifications/notificationHub.ts` — ready / permission 事件触发源
- `hub/src/push/pushService.ts` — Web Push 下发与 410 订阅清理
- `hub/src/push/pushNotificationChannel.ts` — 现有“可见则 toast，否则 push”的分流点
- `hub/src/web/routes/events.ts` — SSE 订阅与 visibility 上报路由

---

### Task 1: 扩展共享事件模型，给 toast 和 visibility 增加精确分流字段

**Files:**
- Modify: `shared/src/schemas.ts:218-226`
- Modify: `web/src/types/api.ts:197-218`
- Modify: `web/src/api/client.ts:181-186`
- Test: `web/src/types/api.ts` 由 typecheck 覆盖

- [x] **Step 1: 先写出会失败的类型使用点**

在 `web/src/App.tsx` 的 toast 处理函数里先按新字段读取，制造编译失败：

```ts
const handleToast = useCallback((event: ToastEvent) => {
  addToast({
    id: event.data.notificationKey,
    title: event.data.title,
    body: event.data.body,
    sessionId: event.data.sessionId,
    url: event.data.url,
  })
}, [addToast])
```

并在 `useVisibilityReporter` 的调用点先传入当前会话：

```ts
useVisibilityReporter({
  api,
  subscriptionId,
  enabled: Boolean(api && token),
  activeSessionId: selectedSessionId,
})
```

- [x] **Step 2: 跑 web typecheck，确认新增字段还不存在**

Run: `bun run typecheck:web`
Expected: FAIL，提示 `notificationKey` 与 `activeSessionId` 不存在。

- [x] **Step 3: 扩展共享 schema 与 API 类型**

在 `shared/src/schemas.ts` 将 `toast` schema 从：

```ts
SessionEventBaseSchema.extend({
  type: z.literal('toast'),
  data: z.object({
    title: z.string(),
    body: z.string(),
    sessionId: z.string(),
    url: z.string()
  })
})
```

改为：

```ts
SessionEventBaseSchema.extend({
  type: z.literal('toast'),
  data: z.object({
    title: z.string(),
    body: z.string(),
    sessionId: z.string(),
    url: z.string(),
    notificationKey: z.string()
  })
})
```

在 `web/src/types/api.ts` 扩展：

```ts
export type VisibilityPayload = {
  subscriptionId: string
  visibility: 'visible' | 'hidden'
  activeSessionId?: string | null
}
```

并确保 `web/src/api/client.ts` 继续直接透传 payload：

```ts
async setVisibility(payload: VisibilityPayload): Promise<void> {
  await this.request('/api/events/visibility', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}
```

- [x] **Step 4: 跑 web typecheck，确认类型通过**

Run: `bun run typecheck:web`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

### Task 2: 让 hub 追踪“哪个前台连接正在看哪个 session”

**Files:**
- Modify: `hub/src/visibility/visibilityTracker.ts`
- Modify: `hub/src/web/routes/events.ts:29-139`
- Modify: `hub/src/sse/sseManager.test.ts`
- Test: `hub/src/sse/sseManager.test.ts`

- [x] **Step 1: 先写失败的 tracker 测试**

在 `hub/src/sse/sseManager.test.ts` 增加两个测试，断言 tracker 能记录可见连接正在看的 session：

```ts
it('tracks the active session for a visible subscription', () => {
  const tracker = new VisibilityTracker()
  tracker.registerConnection('sub-1', 'ns-1', 'visible', 'session-1')

  expect(tracker.hasVisibleConnectionForSession('ns-1', 'session-1')).toBe(true)
  expect(tracker.hasVisibleConnectionForSession('ns-1', 'session-2')).toBe(false)
})

it('updates the tracked session when visibility payload changes', () => {
  const tracker = new VisibilityTracker()
  tracker.registerConnection('sub-1', 'ns-1', 'visible', 'session-1')

  tracker.setVisibility('sub-1', 'ns-1', 'visible', 'session-2')

  expect(tracker.hasVisibleConnectionForSession('ns-1', 'session-1')).toBe(false)
  expect(tracker.hasVisibleConnectionForSession('ns-1', 'session-2')).toBe(true)
})
```

- [x] **Step 2: 跑 hub 测试确认失败**

Run: `bun run test:hub -- hub/src/sse/sseManager.test.ts`
Expected: FAIL，提示 `registerConnection` / `setVisibility` 参数或 `hasVisibleConnectionForSession` 方法不存在。

- [x] **Step 3: 在 visibility tracker 中增加 activeSessionId 追踪**

把 `hub/src/visibility/visibilityTracker.ts` 的连接结构改成显式状态对象：

```ts
export type VisibilityState = 'visible' | 'hidden'

type ConnectionState = {
  namespace: string
  visibility: VisibilityState
  activeSessionId: string | null
}

export class VisibilityTracker {
  private readonly connections = new Map<string, ConnectionState>()

  registerConnection(
    subscriptionId: string,
    namespace: string,
    state: VisibilityState,
    activeSessionId: string | null = null
  ): void {
    this.connections.set(subscriptionId, {
      namespace,
      visibility: state,
      activeSessionId,
    })
  }

  setVisibility(
    subscriptionId: string,
    namespace: string,
    state: VisibilityState,
    activeSessionId: string | null = null
  ): boolean {
    const current = this.connections.get(subscriptionId)
    if (!current || current.namespace !== namespace) {
      return false
    }
    this.connections.set(subscriptionId, {
      namespace,
      visibility: state,
      activeSessionId,
    })
    return true
  }

  hasVisibleConnection(namespace: string): boolean {
    for (const connection of this.connections.values()) {
      if (connection.namespace === namespace && connection.visibility === 'visible') {
        return true
      }
    }
    return false
  }

  hasVisibleConnectionForSession(namespace: string, sessionId: string): boolean {
    for (const connection of this.connections.values()) {
      if (
        connection.namespace === namespace &&
        connection.visibility === 'visible' &&
        connection.activeSessionId === sessionId
      ) {
        return true
      }
    }
    return false
  }

  isVisibleConnection(subscriptionId: string): boolean {
    return this.connections.get(subscriptionId)?.visibility === 'visible'
  }

  removeConnection(subscriptionId: string): void {
    this.connections.delete(subscriptionId)
  }
}
```

在 `hub/src/web/routes/events.ts` 扩展 schema：

```ts
const visibilitySchema = z.object({
  subscriptionId: z.string().min(1),
  visibility: z.enum(['visible', 'hidden']),
  activeSessionId: z.string().min(1).nullable().optional(),
})
```

并传给 tracker：

```ts
const updated = tracker.setVisibility(
  parsed.data.subscriptionId,
  namespace,
  parsed.data.visibility,
  parsed.data.activeSessionId ?? null
)
```

SSE 初始订阅时补默认值：

```ts
manager.subscribe({
  id: subscriptionId,
  namespace,
  all,
  sessionId: resolvedSessionId,
  machineId,
  visibility,
  activeSessionId: resolvedSessionId,
  send: (event) => stream.writeSSE({ data: JSON.stringify(event) }),
  sendHeartbeat: async () => { /* unchanged */ },
})
```

如果 `SSEManager.subscribe` 还没有 `activeSessionId` 参数，同步加上：

```ts
activeSessionId?: string | null
```

并在 `registerConnection` 时透传。

- [x] **Step 4: 跑 hub 测试确认通过**

Run: `bun run test:hub -- hub/src/sse/sseManager.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
git add hub/src/visibility/visibilityTracker.ts hub/src/web/routes/events.ts hub/src/sse/sseManager.ts hub/src/sse/sseManager.test.ts
git commit -m "feat(hub): track active session for visible connections"
```

---

### Task 3: 在 web 侧上报当前可见性和活跃 session

**Files:**
- Modify: `web/src/hooks/useVisibilityReporter.ts`
- Modify: `web/src/App.tsx:115-270`
- Create: `web/src/hooks/useVisibilityReporter.test.tsx`
- Test: `web/src/hooks/useVisibilityReporter.test.tsx`

- [x] **Step 1: 写失败的 visibility reporter 测试**

新增 `web/src/hooks/useVisibilityReporter.test.tsx`，mock `api.setVisibility`，验证页面保持可见时切换当前 session 也会重新上报：

```tsx
it('reports the selected session id with visibility updates', async () => {
  const setVisibility = vi.fn().mockResolvedValue(undefined)
  const api = { setVisibility } as any

  render(<TestApp api={api} initialPath="/sessions/session-1" />)

  await waitFor(() => {
    expect(setVisibility).toHaveBeenCalledWith({
      subscriptionId: 'sub-1',
      visibility: 'visible',
      activeSessionId: 'session-1',
    })
  })
})
```

- [x] **Step 2: 跑这个测试确认失败**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/useVisibilityReporter.test.tsx`
Expected: FAIL，因为 `useVisibilityReporter` 还不会在可见状态下随 `activeSessionId` 变化重新上报。

- [x] **Step 3: 修改 hook 与 App 调用点**

将 `useVisibilityReporter` 入参扩展为：

```ts
export function useVisibilityReporter(options: {
  api: ApiClient | null
  subscriptionId: string | null
  enabled?: boolean
  activeSessionId?: string | null
}): void
```

并在 `flush()` 里发送：

```ts
void api.setVisibility({
  subscriptionId,
  visibility: desired,
  activeSessionId: options.activeSessionId ?? null,
})
```

同时确保 `activeSessionId` 变化也会触发重新 `report()`：

```ts
}, [options.api, options.enabled, options.subscriptionId, options.activeSessionId])
```

在 `web/src/App.tsx` 保持当前已有的：

```ts
const sessionMatch = matchRoute({ to: '/sessions/$sessionId' })
const selectedSessionId = sessionMatch && sessionMatch.sessionId !== 'new' ? sessionMatch.sessionId : null
```

并把它传入：

```ts
useVisibilityReporter({
  api,
  subscriptionId,
  enabled: Boolean(api && token),
  activeSessionId: selectedSessionId,
})
```

- [x] **Step 4: 跑 App 测试与 typecheck**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/useVisibilityReporter.test.tsx && bunx tsc --noEmit`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

### Task 4: 给前端 toast 增加稳定 key 与幂等去重

**Files:**
- Create: `web/src/lib/notification-dedupe.ts`
- Create: `web/src/lib/notification-dedupe.test.ts`
- Modify: `web/src/lib/toast-context.tsx`
- Modify: `web/src/App.tsx:232-240`
- Test: `web/src/lib/notification-dedupe.test.ts`

- [x] **Step 1: 先写 failing 去重测试**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { markNotificationSeen, shouldShowNotification, __resetNotificationDedupeForTests } from './notification-dedupe'

describe('notification-dedupe', () => {
  beforeEach(() => {
    __resetNotificationDedupeForTests()
  })

  it('allows the first notification key and suppresses repeats', () => {
    expect(shouldShowNotification('ready-session-1-1')).toBe(true)
    markNotificationSeen('ready-session-1-1')
    expect(shouldShowNotification('ready-session-1-1')).toBe(false)
  })
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/notification-dedupe.test.ts`
Expected: FAIL，文件不存在。

- [x] **Step 3: 写最小去重实现，并让 toast 支持自定义 id**

新增 `web/src/lib/notification-dedupe.ts`：

```ts
const seen = new Map<string, number>()
const TTL_MS = 15_000

function prune(now: number): void {
  for (const [key, timestamp] of seen.entries()) {
    if (now - timestamp > TTL_MS) {
      seen.delete(key)
    }
  }
}

export function shouldShowNotification(key: string): boolean {
  const now = Date.now()
  prune(now)
  return !seen.has(key)
}

export function markNotificationSeen(key: string): void {
  const now = Date.now()
  prune(now)
  seen.set(key, now)
}

export function __resetNotificationDedupeForTests(): void {
  seen.clear()
}
```

修改 `web/src/lib/toast-context.tsx`，允许 `addToast` 透传 id，并且相同 id 直接忽略：

```ts
export type ToastContextValue = {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'> & { id?: string }) => void
  removeToast: (id: string) => void
}

const addToast = useCallback((toast: Omit<Toast, 'id'> & { id?: string }) => {
  const id = toast.id ?? createToastId()
  setToasts((prev) => {
    if (prev.some((item) => item.id === id)) {
      return prev
    }
    return [...prev, { ...toast, id }]
  })
  if (timersRef.current.has(id)) {
    return
  }
  const timer = setTimeout(() => {
    removeToast(id)
  }, TOAST_DURATION_MS)
  timersRef.current.set(id, timer)
}, [removeToast])
```

在 `web/src/App.tsx` 的 `handleToast` 中接入：

```ts
const handleToast = useCallback((event: ToastEvent) => {
  const key = event.data.notificationKey
  if (!shouldShowNotification(key)) {
    return
  }
  markNotificationSeen(key)
  addToast({
    id: key,
    title: event.data.title,
    body: event.data.body,
    sessionId: event.data.sessionId,
    url: event.data.url,
  })
}, [addToast])
```

- [x] **Step 4: 跑去重测试与现有相关测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/lib/notification-dedupe.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

### Task 5: 按“正在看当前 session / 看别的 session / 后台”三种情况分流 toast 与 push

**Files:**
- Modify: `hub/src/push/pushNotificationChannel.ts:16-97`
- Modify: `hub/src/visibility/visibilityTracker.ts`
- Test: `hub/src/push/pushNotificationChannel.test.ts`

- [x] **Step 1: 先写 failing 通知分流测试**

在 `hub/src/push/pushNotificationChannel.test.ts` 新增 stub push / stub sse / stub tracker，覆盖 3 条主路径：

```ts
it('sends only toast when a visible connection is already on the same session', async () => {
  const tracker = new VisibilityTracker()
  tracker.registerConnection('sub-1', 'default', 'visible', 'session-1')

  const pushService = { sendToNamespace: vi.fn().mockResolvedValue(undefined) } as any
  const sseManager = { sendToast: vi.fn().mockResolvedValue(1) } as any
  const channel = new PushNotificationChannel(pushService, sseManager, tracker, 'http://localhost:3000')

  await channel.sendReady(createSession())

  expect(sseManager.sendToast).toHaveBeenCalledTimes(1)
  expect(pushService.sendToNamespace).not.toHaveBeenCalled()
})

it('sends push when a visible connection is on a different session', async () => {
  const tracker = new VisibilityTracker()
  tracker.registerConnection('sub-1', 'default', 'visible', 'session-2')

  const pushService = { sendToNamespace: vi.fn().mockResolvedValue(undefined) } as any
  const sseManager = { sendToast: vi.fn().mockResolvedValue(0) } as any
  const channel = new PushNotificationChannel(pushService, sseManager, tracker, 'http://localhost:3000')

  await channel.sendReady(createSession({ id: 'session-1' }))

  expect(pushService.sendToNamespace).toHaveBeenCalledTimes(1)
})
```

- [x] **Step 2: 跑 hub 测试确认失败**

Run: `bun run test:hub -- hub/src/push/pushNotificationChannel.test.ts`
Expected: FAIL，因为当前 `PushNotificationChannel` 只看 `hasVisibleConnection(namespace)`，无法区分当前 session。

- [x] **Step 3: 重写 PushNotificationChannel 分流逻辑**

先提取统一 payload builder，避免 ready / permission 两套逻辑分裂：

```ts
function buildReadyPayload(session: Session): PushPayload {
  const agentName = getAgentName(session)
  const name = getSessionName(session)
  return {
    title: 'Ready for input',
    body: `${agentName} is waiting in ${name}`,
    tag: `ready-${session.id}`,
    data: {
      type: 'ready',
      sessionId: session.id,
      url: buildSessionPath(session.id),
      notificationKey: `ready-${session.id}`,
    },
  }
}
```

permission 也同样生成：

```ts
function buildPermissionPayload(session: Session): PushPayload {
  const name = getSessionName(session)
  const request = session.agentState?.requests ? Object.values(session.agentState.requests)[0] : null
  const toolName = request?.tool ? ` (${request.tool})` : ''
  const requestId = request?.createdAt ?? 'latest'

  return {
    title: 'Permission Request',
    body: `${name}${toolName}`,
    tag: `permission-${session.id}`,
    data: {
      type: 'permission-request',
      sessionId: session.id,
      url: buildSessionPath(session.id),
      notificationKey: `permission-${session.id}-${requestId}`,
    },
  }
}
```

然后统一用一个分流函数：

```ts
private async deliver(session: Session, payload: PushPayload): Promise<void> {
  const url = payload.data?.url ?? this.buildSessionPath(session.id)
  const notificationKey = payload.data?.notificationKey ?? payload.tag ?? `${payload.data?.type ?? 'notification'}-${session.id}`

  if (this.visibilityTracker.hasVisibleConnectionForSession(session.namespace, session.id)) {
    const delivered = await this.sseManager.sendToast(session.namespace, {
      type: 'toast',
      data: {
        title: payload.title,
        body: payload.body,
        sessionId: session.id,
        url,
        notificationKey,
      },
    })
    if (delivered > 0) {
      return
    }
  }

  await this.pushService.sendToNamespace(session.namespace, payload)
}
```

`sendReady` 与 `sendPermissionRequest` 都只负责 active 校验 + build + `deliver()`。

同时把 `PushPayload` 的 `data` 类型在 `hub/src/push/pushService.ts` / `web/src/sw.ts` 补成：

```ts
data?: {
  type: string
  sessionId: string
  url: string
  notificationKey?: string
}
```

- [x] **Step 4: 跑 hub 通知测试**

Run: `bun run test:hub -- hub/src/push/pushNotificationChannel.test.ts hub/src/sse/sseManager.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

### Task 6: 强化 Service Worker 的系统通知展示与点击回跳

**Files:**
- Modify: `web/src/sw.ts:10-122`
- Create: `web/src/sw.test.ts`
- Test: `web/src/sw.test.ts`

- [x] **Step 1: 先写 failing service worker 测试**

```ts
it('focuses an existing client before opening a new window on notification click', async () => {
  const focus = vi.fn().mockResolvedValue(undefined)
  const postMessage = vi.fn()
  ;(self as any).clients.matchAll = vi.fn().mockResolvedValue([
    { url: 'https://hapi.local/sessions/session-1', focus, postMessage },
  ])

  await handleNotificationClick(createClickEvent('/sessions/session-1'))

  expect(focus).toHaveBeenCalled()
  expect((self as any).clients.openWindow).not.toHaveBeenCalled()
})
```

再加一个 push 展示测试，断言稳定 `tag` 会被透传：

```ts
it('shows notifications with the provided tag and data', async () => {
  const showNotification = vi.fn().mockResolvedValue(undefined)
  ;(self as any).registration.showNotification = showNotification

  await handlePush(createPushEvent({
    title: 'Ready for input',
    body: 'Claude is waiting',
    tag: 'ready-session-1',
    data: { sessionId: 'session-1', url: '/sessions/session-1' },
  }))

  expect(showNotification).toHaveBeenCalledWith('Ready for input', expect.objectContaining({
    tag: 'ready-session-1',
    data: { sessionId: 'session-1', url: '/sessions/session-1' },
  }))
})
```

- [x] **Step 2: 跑 sw 测试确认失败**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/sw.test.ts`
Expected: FAIL，测试文件或 click 聚焦逻辑尚不存在。

- [x] **Step 3: 提取可测 helper 并增强 click 行为**

在 `web/src/sw.ts` 中提取两个函数并导出给测试使用：

```ts
export async function showPushNotification(payload: PushPayload): Promise<void> {
  const title = payload.title || 'HAPI'
  const body = payload.body ?? ''
  const icon = payload.icon ?? '/pwa-192x192.png'
  const badge = payload.badge ?? '/pwa-64x64.png'
  const data = payload.data
  const tag = payload.tag

  await self.registration.showNotification(title, {
    body,
    icon,
    badge,
    data,
    tag,
  })
}

export async function openNotificationTarget(url: string): Promise<void> {
  const targetUrl = new URL(url, self.location.origin).toString()
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  for (const client of clients) {
    if ('focus' in client) {
      await client.focus()
      if ('navigate' in client) {
        await client.navigate(targetUrl)
      }
      return
    }
  }

  await self.clients.openWindow(targetUrl)
}
```

并让事件监听器调用这些 helper：

```ts
self.addEventListener('push', (event) => {
  const payload = event.data?.json() as PushPayload | undefined
  if (!payload) return
  event.waitUntil(showPushNotification(payload))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  event.waitUntil(openNotificationTarget(data?.url ?? '/'))
})
```

- [x] **Step 4: 跑 sw 测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/sw.test.ts`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

### Task 7: 补齐 App 层“前台同会话只 toast、重复事件不重复显示”的测试

**Files:**
- Modify/Create: `web/src/App.test.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/src/App.test.tsx`

- [x] **Step 1: 写两个端到端风格的前端测试**

```tsx
it('renders a single toast for a foreground notification event', async () => {
  render(<TestAppWithToastEvent {
    ...props,
    toastEvent: {
      type: 'toast',
      data: {
        title: 'Ready for input',
        body: 'Claude is waiting in Demo',
        sessionId: 'session-1',
        url: '/sessions/session-1',
        notificationKey: 'ready-session-1',
      },
    },
  } />)

  expect(await screen.findByText('Ready for input')).toBeInTheDocument()
})

it('does not render duplicate toasts for the same notification key', async () => {
  render(<TestAppWithToastEvents events={[sameEvent, sameEvent]} />)
  const titles = await screen.findAllByText('Ready for input')
  expect(titles).toHaveLength(1)
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/App.test.tsx`
Expected: FAIL，当前还未做稳定 key 去重或测试 harness 未补齐。

- [x] **Step 3: 最小化修正 App harness 或 toast 显示逻辑**

如果 Task 4 已完成但测试仍失败，优先修正 `App.test.tsx` 的 mock：

```tsx
vi.mock('@/hooks/useSSE', () => ({
  useSSE: ({ onToast }: any) => {
    queueMicrotask(() => {
      for (const event of injectedEvents) {
        onToast(event)
      }
    })
    return { subscriptionId: 'sub-1' }
  },
}))
```

保持 `App.tsx` 的 `handleToast` 为：

```ts
const key = event.data.notificationKey
if (!shouldShowNotification(key)) return
markNotificationSeen(key)
addToast({ id: key, ... })
```

- [x] **Step 4: 跑 web 测试集确认通过**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/App.test.tsx src/components/SessionChat.test.tsx src/hooks/queries/useMessages.test.tsx`
Expected: PASS。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

### Task 8: 跑分层验证并记录安卓真实验收清单

**Files:**
- Modify: `docs/superpowers/specs/2026-04-11-android-pwa-notification-design.md`（仅在实现与 spec 明显偏差时回填；无偏差则不改）
- Test: `hub/src/notifications/notificationHub.test.ts`, `hub/src/sse/sseManager.test.ts`, `web/src/App.test.tsx`, `web/src/lib/notification-dedupe.test.ts`, `web/src/sw.test.ts`

- [x] **Step 1: 跑 hub 聚焦测试**

Run: `bun run test:hub -- hub/src/notifications/notificationHub.test.ts hub/src/sse/sseManager.test.ts`
Expected: PASS。

- [x] **Step 2: 跑 web 聚焦测试**

Run: `bun run test:web -- --run src/App.test.tsx src/lib/notification-dedupe.test.ts src/sw.test.ts src/components/SessionChat.test.tsx`
Expected: PASS。

- [x] **Step 3: 跑受影响包 typecheck**

Run: `bun run typecheck:web && bun run typecheck:hub`
Expected: PASS。

- [ ] **Step 4: 手工安卓验收**

在真机上按顺序验证并记录结果：

```text
1. Android Chrome 打开 H5，接受通知权限。
2. 触发 ready 通知：
   - 当前就在该 session 页面：只出现站内横栏，不出现系统通知。
3. 切到另一个 session 页面，再触发同一 session 的 ready：
   - 出现系统通知。
4. 将 H5 切后台或锁屏，再触发 ready��
   - 出现系统通知。
5. 点击系统通知：
   - 已打开 PWA/浏览器时优先聚焦并跳到对应 session。
6. 触发 permission request：
   - 前台当前 session 只 toast；后台或看别的 session 时系统通知。
7. 取消浏览器通知权限：
   - 不再有系统通知，但前台 toast 仍工作。
8. 取消订阅并重新触发：
   - 不再收到系统通知。
```

回归修复记录：

- 已修复 `hub/src/sync/syncEngine.ts` 中 realtime `session-updated` / `machine-updated` 刷新缓存后提前返回的问题；现在会继续 `emit` 给 `NotificationHub` 与其他订阅者。
- 已在 `hub/src/notifications/notificationHub.test.ts` 增加回归测试，覆盖真实 `SyncEngine.handleRealtimeEvent({ type: 'session-updated' })` 触发 permission notification 的链路。
- 已验证 `hub/src/notifications/notificationHub.test.ts`、`hub/src/notifications/eventParsing.test.ts`、`hub/src/push/pushNotificationChannel.test.ts`、`hub/src/sse/sseManager.test.ts` 全部通过，`bun run typecheck:hub` 通过。
- 已修复 `web/src/App.tsx` 的自动订阅补偿逻辑：首次权限请求仍只触发一次，但在 `pushPermission === 'granted' && isSubscribed === false` 时，首次失败后会补一次自动重试，避免“权限已授权但服务端未落库订阅”后停在无通知状态。
- 已在 `web/src/App.test.tsx` 增加两条回归测试：覆盖“已授权但未订阅时自动重试”与“权限请求只触发一次、随后补一次自动重试”。
- 已验证 `bun run test:web -- ./src/App.test.tsx` 通过，`bun run typecheck:web` 通过。

- [x] **Step 5: Commit**

```bash
# Inline execution: commit deferred until a later user-confirmed git step.
```

---

## Self-Review

### Spec coverage
- **保留当前通知语义** → Task 5 只修改 `PushNotificationChannel` 分流，不改 `NotificationHub` 的 ready / permission 触发条件。
- **前台横栏、后台系统通知** → Task 3 + Task 5。
- **正在看别的 session 也要系统通知** → Task 2 + Task 5。
- **去重** → Task 4 + Task 5（toast key + push tag）。
- **点击通知回到 session** → Task 6。
- **测试覆盖可交付** → Task 7 + Task 8。

### Placeholder scan
- 无 TBD / TODO / “类似 Task N”。
- 每个改代码步骤都给出了具体代码片段或命令。

### Type consistency
- 统一使用 `notificationKey` 作为 toast 稳定 key。
- 统一使用 `activeSessionId` 作为 visibility payload 字段名。
- `PushPayload.data.notificationKey`、`toast.data.notificationKey`、前端 dedupe key 三处保持同名。

### Rollback note
- 若实现后安卓系统通知表现异常，可仅回退 Task 5/6 的 push 分流与 sw 点击逻辑，保留 Task 2/3/4 的前台精确可见性和 toast 去重，不影响现有 H5 站内提醒。
