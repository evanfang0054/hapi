# Rewind V2 — 自定义弹窗与多模式回撤 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用自定义卡片式弹窗替代 `window.confirm()`，并支持用户选择回撤范围（会话+文件、仅会话、仅文件）。

**Architecture:** 前端新增 `RewindDialog` 组件，通过 context 传递 `onRewindRequest` 打开弹窗；后端 API/引擎/CLI 按 `RewindMode` 分支处理三种模式。变更沿现有数据流路径（context → handler → mutation → API → hub → RPC → CLI）逐步扩展。

**Tech Stack:** React 19, TanStack Query, Radix UI Dialog, Zod, Hono, Bun, Socket.IO RPC

---

## 文件结构

| 操作 | 文件 | 职责 |
|---|---|---|
| Create | `web/src/components/RewindDialog.tsx` | 卡片式单选弹窗组件 |
| Modify | `web/src/components/AssistantChat/context.tsx` | 新增 `onRewindRequest` context 类型 |
| Modify | `web/src/components/AssistantChat/messages/UserMessage.tsx` | 移除 `window.confirm`，改用 `onRewindRequest` |
| Modify | `web/src/components/AssistantChat/HappyThread.tsx` | 透传 `onRewindRequest` prop |
| Modify | `web/src/components/SessionChat.tsx` | 新增 `rewindTargetSeq` state，渲染 `RewindDialog` |
| Modify | `web/src/hooks/mutations/useSessionActions.ts` | mutation 参数扩展 `RewindMode` |
| Modify | `web/src/hooks/mutations/useSessionActions.test.tsx` | 更新 rewind 测试 |
| Modify | `web/src/api/client.ts` | API 方法扩展 `mode` 参数 |
| Modify | `web/src/hooks/useSSE.ts` | 处理 `files-rewound` 事件 |
| Modify | `shared/src/schemas.ts` | 新增 `files-rewound` 事件 schema |
| Modify | `hub/src/web/routes/sessions.ts` | 请求体增加 `mode` 字段 |
| Modify | `hub/src/sync/syncEngine.ts` | `rewindSession` 按 mode 分支 |
| Modify | `hub/src/sync/rpcGateway.ts` | 透传 `mode` |
| Modify | `hub/src/sync/syncEngine.takeover.test.ts` | 更新 rewind 测试 |
| Modify | `cli/src/modules/common/remote/RemoteLauncherBase.ts` | 类型扩展 `mode` |
| Modify | `cli/src/claude/claudeRemoteLauncher.ts` | 按 mode 分支处理 |

---

### Task 1: Shared — 新增 `files-rewound` 事件 schema

**Files:**
- Modify: `shared/src/schemas.ts:243-248`

- [ ] **Step 1: 在 `SessionEventSchema` union 中追加 `files-rewound` 事件**

在 `shared/src/schemas.ts` 中，找到 `SessionEventSchema` union（约第 243 行 `messages-rewound` 之后），追加新的事件类型：

```typescript
// 在现有 messages-rewound 之后追加
SessionEventBaseSchema.extend({
    type: z.literal('files-rewound'),
    sessionId: z.string(),
    targetSeq: z.number()
})
```

- [ ] **Step 2: 验证类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web`
Expected: PASS（schema 变更不影响现有类型）

- [ ] **Step 3: Commit**

```bash
git add shared/src/schemas.ts
git commit -m "feat(shared): add files-rewound event schema for rewind modes"
```

---

### Task 2: Web — 扩展 API client 和 mutation

**Files:**
- Modify: `web/src/api/client.ts:504-509`
- Modify: `web/src/hooks/mutations/useSessionActions.ts:36,162-175`
- Modify: `web/src/hooks/mutations/useSessionActions.test.tsx:155-178`

- [ ] **Step 1: 定义 RewindMode 类型**

在 `web/src/hooks/mutations/useSessionActions.ts` 顶部 import 之后添加：

```typescript
export type RewindMode = 'session-and-files' | 'session-only' | 'files-only'
```

- [ ] **Step 2: 扩展 API client**

修改 `web/src/api/client.ts` 第 504-509 行：

```typescript
async rewindSession(sessionId: string, targetSeq: number, mode: RewindMode = 'session-and-files'): Promise<void> {
    await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/rewind`, {
        method: 'POST',
        body: JSON.stringify({ targetSeq, mode })
    })
}
```

需要在文件顶部 import `RewindMode`：
```typescript
import type { RewindMode } from '@/hooks/mutations/useSessionActions'
```

- [ ] **Step 3: 扩展 mutation 签名和实现**

修改 `useSessionActions.ts`：

返回类型（第 36 行）：
```typescript
rewindSession: (targetSeq: number, mode?: RewindMode) => Promise<void>
```

rewindMutation（第 162-175 行）：
```typescript
const rewindMutation = useMutation({
    mutationFn: async ({ targetSeq, mode }: { targetSeq: number; mode: RewindMode }) => {
        if (!api || !sessionId) {
            throw new Error('Session unavailable')
        }
        await api.rewindSession(sessionId, targetSeq, mode)
    },
    onSuccess: () => {
        if (api && sessionId) {
            void refreshMessagesAfterRewind(api, sessionId)
        }
        void invalidateSession()
    },
})
```

返回值（第 222 行）：
```typescript
rewindSession: (targetSeq: number, mode: RewindMode = 'session-and-files') => rewindMutation.mutateAsync({ targetSeq, mode }),
```

- [ ] **Step 4: 更新测试**

修改 `web/src/hooks/mutations/useSessionActions.test.tsx` 第 155-178 行：

```typescript
it('refreshes the message window after rewind succeeds without clearing it', async () => {
    const api = {
        rewindSession: vi.fn().mockResolvedValue(undefined),
    }
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    const { result } = renderHook(
        () => useSessionActions(api as any, 'session-a'),
        { wrapper: createWrapper(queryClient) }
    )

    await act(async () => {
        await result.current.rewindSession(7)
    })

    expect(api.rewindSession).toHaveBeenCalledWith('session-a', 7, 'session-and-files')
    expect(refreshMessagesAfterRewind).toHaveBeenCalledWith(api, 'session-a')
    expect(clearMessageWindow).not.toHaveBeenCalledWith('session-a')
})
```

- [ ] **Step 5: 运行测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/mutations/useSessionActions.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/api/client.ts web/src/hooks/mutations/useSessionActions.ts web/src/hooks/mutations/useSessionActions.test.tsx
git commit -m "feat(web): extend rewind API and mutation with RewindMode support"
```

---

### Task 3: Web — 新建 RewindDialog 组件

**Files:**
- Create: `web/src/components/RewindDialog.tsx`

- [ ] **Step 1: 创建 RewindDialog 组件**

创建 `web/src/components/RewindDialog.tsx`：

```tsx
import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import type { RewindMode } from '@/hooks/mutations/useSessionActions'
import { cn } from '@/lib/utils'

type RewindDialogProps = {
    isOpen: boolean
    onClose: () => void
    onConfirm: (mode: RewindMode) => Promise<void>
    isPending: boolean
}

const options: { mode: RewindMode; label: string; description: string }[] = [
    {
        mode: 'session-and-files',
        label: '会话 + 文件',
        description: '回撤消息和 AI 修改的文件',
    },
    {
        mode: 'session-only',
        label: '仅会话',
        description: '清除消息，不恢复文件',
    },
    {
        mode: 'files-only',
        label: '仅文件',
        description: '恢复 AI 修改的文件',
    },
]

export function RewindDialog({ isOpen, onClose, onConfirm, isPending }: RewindDialogProps) {
    const [selected, setSelected] = useState<RewindMode>('session-and-files')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setSelected('session-and-files')
            setError(null)
        }
    }, [isOpen])

    const handleConfirm = async () => {
        setError(null)
        try {
            await onConfirm(selected)
            onClose()
        } catch (err) {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : 'Failed to rewind'
            setError(message)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-badge-warning-bg)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-badge-warning-text)]">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                </div>
                <DialogHeader className="items-center">
                    <DialogTitle>回撤到这条消息</DialogTitle>
                    <DialogDescription className="mt-2">选择回撤范围</DialogDescription>
                </DialogHeader>

                <div className="mt-4 flex flex-col gap-2">
                    {options.map((opt) => (
                        <button
                            key={opt.mode}
                            type="button"
                            disabled={isPending}
                            className={cn(
                                'flex items-center gap-3 rounded-[12px] border-2 px-3 py-3 text-left transition-colors',
                                selected === opt.mode
                                    ? 'border-[var(--app-link)] bg-[var(--app-link)]/5'
                                    : 'border-[var(--app-border)] hover:border-[var(--app-hint)]'
                            )}
                            onClick={() => setSelected(opt.mode)}
                        >
                            <div
                                className={cn(
                                    'h-[18px] w-[18px] shrink-0 rounded-full border-2',
                                    selected === opt.mode
                                        ? 'border-[var(--app-link)] flex items-center justify-center'
                                        : 'border-[var(--app-hint)]'
                                )}
                            >
                                {selected === opt.mode && (
                                    <div className="h-[10px] w-[10px] rounded-full bg-[var(--app-link)]" />
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-medium">{opt.label}</div>
                                <div className="text-xs text-[var(--app-hint)]">{opt.description}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mt-3 rounded-[18px] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-4 py-3 text-sm text-[var(--app-badge-error-text)]">
                        {error}
                    </div>
                )}

                <div className="mt-4 flex flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="flex-1 h-11 min-h-[44px] rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-[18px] text-[13px] font-medium text-[var(--app-fg)] transition-all hover:bg-[var(--app-panel-elevated-bg)] disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isPending}
                        className="flex-1 h-11 min-h-[44px] rounded-[16px] border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-[18px] text-[13px] font-medium text-[var(--app-badge-error-text)] transition-all hover:brightness-95 disabled:opacity-50"
                    >
                        {isPending ? '回撤中...' : '确认回撤'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 2: 验证类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/components/RewindDialog.tsx
git commit -m "feat(web): add RewindDialog component with card-style mode selector"
```

---

### Task 4: Web — 更新 context、UserMessage、HappyThread 和 SessionChat

**Files:**
- Modify: `web/src/components/AssistantChat/context.tsx:6-14`
- Modify: `web/src/components/AssistantChat/messages/UserMessage.tsx:105-121`
- Modify: `web/src/components/AssistantChat/HappyThread.tsx:69,323`
- Modify: `web/src/components/SessionChat.tsx:294-303,414,462-473`

- [ ] **Step 1: 更新 context 类型**

修改 `web/src/components/AssistantChat/context.tsx`，在 `HappyChatContextValue` 中新增 `onRewindRequest`：

```typescript
export type HappyChatContextValue = {
    api: ApiClient
    sessionId: string
    metadata: SessionMetadataSummary | null
    disabled: boolean
    onRefresh: () => void
    onRetryMessage?: (localId: string) => void
    onRewindMessage?: (targetSeq: number) => void
    onRewindRequest?: (targetSeq: number) => void
}
```

- [ ] **Step 2: 更新 UserMessage**

修改 `web/src/components/AssistantChat/messages/UserMessage.tsx`：

1. 添加 `onRewindRequest` 的读取（约第 57 行附近）：

```typescript
const canRewind = typeof seq === 'number' && Boolean(ctx.onRewindMessage || ctx.onRewindRequest)
```

2. 替换 Rewind 按钮的 `onClick`（约第 105-121 行）：

```tsx
{canRewind && (
    <button
        type="button"
        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]"
        onClick={() => {
            if (ctx.onRewindRequest) {
                ctx.onRewindRequest(seq)
            } else if (ctx.onRewindMessage) {
                ctx.onRewindMessage(seq)
            }
        }}
    >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span>Rewind</span>
    </button>
)}
```

- [ ] **Step 3: 更新 HappyThread**

修改 `web/src/components/AssistantChat/HappyThread.tsx`：

1. Props 类型（约第 69 行）追加：

```typescript
onRewindRequest?: (targetSeq: number) => void
```

2. Provider value 中（约第 323 行）追加：

```typescript
onRewindMessage: props.onRewindMessage,
onRewindRequest: props.onRewindRequest
```

- [ ] **Step 4: 更新 SessionChat**

修改 `web/src/components/SessionChat.tsx`：

1. 顶部 import 追加：

```typescript
import { RewindDialog } from '@/components/RewindDialog'
import type { RewindMode } from '@/hooks/mutations/useSessionActions'
```

2. 在 `handleRewind` 回调之后（约第 303 行），新增 state 和 handler：

```typescript
const [rewindTargetSeq, setRewindTargetSeq] = useState<number | null>(null)

const handleRewindRequest = useCallback((targetSeq: number) => {
    setRewindTargetSeq(targetSeq)
}, [])

const handleRewindWithMode = useCallback(async (mode: RewindMode) => {
    if (rewindTargetSeq === null) return
    try {
        await rewindSession(rewindTargetSeq, mode)
        haptic.notification('success')
    } catch (e) {
        haptic.notification('error')
        console.error('Failed to rewind session:', e)
        throw e
    }
}, [rewindTargetSeq, rewindSession, haptic])
```

3. 修改 `handleRewind` 保持向后兼容（SSE 触发时仍可用）：

```typescript
const handleRewind = useCallback(async (targetSeq: number) => {
    try {
        await rewindSession(targetSeq, 'session-and-files')
        haptic.notification('success')
    } catch (e) {
        haptic.notification('error')
        console.error('Failed to rewind session:', e)
    }
}, [rewindSession, haptic])
```

4. 更新 HappyThread props（约第 414 行），新增 `onRewindRequest`：

```tsx
onRewindMessage={!controlledByUser ? handleRewind : undefined}
onRewindRequest={!controlledByUser ? handleRewindRequest : undefined}
```

5. 在组件 return 的 `</div>` 结束标签之前（约第 472 行，voice session 之后），添加 RewindDialog：

```tsx
<RewindDialog
    isOpen={rewindTargetSeq !== null}
    onClose={() => setRewindTargetSeq(null)}
    onConfirm={handleRewindWithMode}
    isPending={false}
/>
```

- [ ] **Step 5: 验证类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/components/AssistantChat/context.tsx web/src/components/AssistantChat/messages/UserMessage.tsx web/src/components/AssistantChat/HappyThread.tsx web/src/components/SessionChat.tsx
git commit -m "feat(web): integrate RewindDialog replacing window.confirm"
```

---

### Task 5: Web — 处理 `files-rewound` SSE 事件

**Files:**
- Modify: `web/src/hooks/useSSE.ts:502-510`

- [ ] **Step 1: 添加 `files-rewound` 事件处理**

在 `web/src/hooks/useSSE.ts` 中，`messages-rewound` 事件处理之后（约第 510 行），追加：

```typescript
if (event.type === 'files-rewound') {
    queueSessionDetailInvalidation(event.sessionId)
    queueSessionListInvalidation()
}
```

- [ ] **Step 2: 运行测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/hooks/useSSE.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/useSSE.ts
git commit -m "feat(web): handle files-rewound SSE event"
```

---

### Task 6: Hub — 扩展 API 路由、SyncEngine 和 RPC Gateway

**Files:**
- Modify: `hub/src/web/routes/sessions.ts:199-234`
- Modify: `hub/src/sync/syncEngine.ts:328-367`
- Modify: `hub/src/sync/rpcGateway.ts:96-98`
- Modify: `hub/src/sync/syncEngine.takeover.test.ts`

- [ ] **Step 1: 扩展 RPC Gateway**

修改 `hub/src/sync/rpcGateway.ts` 第 96-98 行：

```typescript
async rewindSession(sessionId: string, params: { userMessageText: string; targetSeq: number; userMessageTextOccurrence?: number; mode: string }): Promise<void> {
    await this.sessionRpc(sessionId, 'rewind', params)
}
```

- [ ] **Step 2: 扩展 SyncEngine**

修改 `hub/src/sync/syncEngine.ts` 第 328-367 行的 `rewindSession` 方法：

```typescript
async rewindSession(sessionId: string, targetSeq: number, mode: string = 'session-and-files'): Promise<void> {
    const messages = this.messageService.getMessagesPage(sessionId, {
        limit: 1,
        beforeSeq: targetSeq + 1
    })
    const targetMessage = messages.messages.find(m => m.seq === targetSeq)

    if (!targetMessage) {
        throw new Error(`Message with seq ${targetSeq} not found`)
    }

    const userMessageText = this.extractUserMessageText(targetMessage)

    if (!userMessageText) {
        throw new Error(`Cannot extract user message text from seq ${targetSeq}`)
    }

    const userMessageTextOccurrence = this.getUserMessageTextOccurrence(sessionId, targetSeq, userMessageText)
    await this.rpcGateway.rewindSession(sessionId, { userMessageText, targetSeq, userMessageTextOccurrence, mode })

    if (mode === 'session-and-files' || mode === 'session-only') {
        this.messageService.deleteMessagesFromSeq(sessionId, targetSeq)
        this.sessionCache.refreshSession(sessionId)
        this.sessionCache.reactivateSession(sessionId)
        this.handleRealtimeEvent({
            type: 'messages-rewound' as const,
            sessionId,
            targetSeq
        })
    } else if (mode === 'files-only') {
        this.handleRealtimeEvent({
            type: 'files-rewound' as const,
            sessionId,
            targetSeq
        })
    }
}
```

- [ ] **Step 3: 扩展 API 路由**

修改 `hub/src/web/routes/sessions.ts` 第 199-234 行：

```typescript
const rewindSchema = z.object({
    targetSeq: z.number().int().positive(),
    mode: z.enum(['session-and-files', 'session-only', 'files-only']).default('session-and-files')
})

app.post('/sessions/:id/rewind', async (c) => {
    const engine = requireSyncEngine(c, getSyncEngine)
    if (engine instanceof Response) {
        return engine
    }

    const sessionResult = requireSessionFromParam(c, engine, { requireActive: true })
    if (sessionResult instanceof Response) {
        return sessionResult
    }

    const body = await c.req.json().catch(() => null)
    const parsed = rewindSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: 'Invalid body: targetSeq and mode are required' }, 400)
    }

    // Only support rewind for remote sessions (controlledByUser is false/undefined in remote mode)
    const controlledByUser = sessionResult.session.agentState?.controlledByUser
    if (controlledByUser === true) {
        return c.json({ error: 'Rewind is only supported for remote sessions' }, 400)
    }

    try {
        await engine.rewindSession(sessionResult.sessionId, parsed.data.targetSeq, parsed.data.mode)
        return c.json({ ok: true })
    } catch (error) {
        return c.json({
            error: error instanceof Error ? error.message : 'Failed to rewind session'
        }, 500)
    }
})
```

- [ ] **Step 4: 更新测试**

修改 `hub/src/sync/syncEngine.takeover.test.ts` 第 7-39 行，更新现有 rewind 测试：

```typescript
it('does not delete messages when rewind RPC fails', async () => {
    const store = new Store(':memory:')
    const engine = new SyncEngine(
        store,
        { of: () => ({ to: () => ({ emit() {} }) }) } as never,
        new RpcRegistry(),
        { broadcast() {} } as never
    )

    try {
        const session = store.sessions.getOrCreateSession('session-1', {}, {}, 'default')
        store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'repeat' } })
        store.messages.addMessage(session.id, { role: 'assistant', content: { type: 'text', text: 'first reply' } })
        store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'repeat' } })
        store.messages.addMessage(session.id, { role: 'assistant', content: { type: 'text', text: 'second reply' } })

        const calls: unknown[] = []
        ;(engine as any).rpcGateway.rewindSession = async (...args: unknown[]) => {
            calls.push(args)
            throw new Error('rewind failed')
        }

        await expect(engine.rewindSession(session.id, 3)).rejects.toThrow('rewind failed')

        expect(calls).toEqual([[session.id, {
            userMessageText: 'repeat',
            targetSeq: 3,
            userMessageTextOccurrence: 2,
            mode: 'session-and-files'
        }]])
        expect(store.messages.getMessages(session.id).map((message) => message.seq)).toEqual([1, 2, 3, 4])
    } finally {
        engine.stop()
    }
})
```

追加新测试：

```typescript
it('handles session-only mode correctly', async () => {
    const store = new Store(':memory:')
    const events: unknown[] = []
    const engine = new SyncEngine(
        store,
        { of: () => ({ to: () => ({ emit() {} }) }) } as never,
        new RpcRegistry(),
        { broadcast() {} } as never
    )
    ;(engine as any).handleRealtimeEvent = (event: unknown) => { events.push(event) }
    ;(engine as any).sessionCache = {
        refreshSession: () => {},
        reactivateSession: () => {},
    }

    try {
        const session = store.sessions.getOrCreateSession('session-1', {}, {}, 'default')
        store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'hello' } })
        store.messages.addMessage(session.id, { role: 'assistant', content: { type: 'text', text: 'reply' } })

        ;(engine as any).rpcGateway.rewindSession = async () => {}

        await engine.rewindSession(session.id, 1, 'session-only')

        expect(store.messages.getMessages(session.id).length).toBe(0)
        expect(events).toEqual([{ type: 'messages-rewound', sessionId: session.id, targetSeq: 1 }])
    } finally {
        engine.stop()
    }
})

it('handles files-only mode without deleting messages', async () => {
    const store = new Store(':memory:')
    const events: unknown[] = []
    const engine = new SyncEngine(
        store,
        { of: () => ({ to: () => ({ emit() {} }) }) } as never,
        new RpcRegistry(),
        { broadcast() {} } as never
    )
    ;(engine as any).handleRealtimeEvent = (event: unknown) => { events.push(event) }

    try {
        const session = store.sessions.getOrCreateSession('session-1', {}, {}, 'default')
        store.messages.addMessage(session.id, { role: 'user', content: { type: 'text', text: 'hello' } })
        store.messages.addMessage(session.id, { role: 'assistant', content: { type: 'text', text: 'reply' } })

        ;(engine as any).rpcGateway.rewindSession = async () => {}

        await engine.rewindSession(session.id, 1, 'files-only')

        expect(store.messages.getMessages(session.id).length).toBe(2)
        expect(events).toEqual([{ type: 'files-rewound', sessionId: session.id, targetSeq: 1 }])
    } finally {
        engine.stop()
    }
})
```

- [ ] **Step 5: 运行测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/hub && bun test src/sync/syncEngine.takeover.test.ts`
Expected: PASS

- [ ] **Step 6: 验证类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:hub`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add hub/src/web/routes/sessions.ts hub/src/sync/syncEngine.ts hub/src/sync/rpcGateway.ts hub/src/sync/syncEngine.takeover.test.ts
git commit -m "feat(hub): support RewindMode in API, engine, and RPC gateway"
```

---

### Task 7: CLI — 扩展类型和按 mode 分支处理

**Files:**
- Modify: `cli/src/modules/common/remote/RemoteLauncherBase.ts:25-27,97-106`
- Modify: `cli/src/claude/claudeRemoteLauncher.ts:99-163`

- [ ] **Step 1: 扩展类型**

修改 `cli/src/modules/common/remote/RemoteLauncherBase.ts` 第 25-27 行：

```typescript
export type RemoteLauncherRewindHandler = {
    onRewind: (params: { userMessageText: string; targetSeq: number; userMessageTextOccurrence?: number; mode: string }) => Promise<void>;
};
```

修改 `setupRewindHandler` 方法（第 97-106 行）：

```typescript
protected setupRewindHandler(
    rpcHandlerManager: RpcHandlerManagerLike,
    handler: RemoteLauncherRewindHandler
): void {
    rpcHandlerManager.registerHandler('rewind', async (params: unknown) => {
        const { userMessageText, targetSeq, userMessageTextOccurrence, mode } = params as { userMessageText: string; targetSeq: number; userMessageTextOccurrence?: number; mode: string }
        await handler.onRewind({ userMessageText, targetSeq, userMessageTextOccurrence, mode })
        return { ok: true }
    });
}
```

- [ ] **Step 2: 按 mode 分支处理**

修改 `cli/src/claude/claudeRemoteLauncher.ts` 第 99-163 行的 rewind handler：

```typescript
this.setupRewindHandler(session.client.rpcHandlerManager, {
    onRewind: async ({ userMessageText, targetSeq, userMessageTextOccurrence, mode }) => {
        if (this.isRewinding) {
            logger.debug('[remote]: rewind already in progress');
            return;
        }
        this.isRewinding = true;

        let barrierResolve!: () => void;
        this.rewindBarrier = new Promise<void>(r => { barrierResolve = r });

        try {
            if (mode === 'files-only') {
                // Files-only: restore files without aborting or truncating
                const claudeSessionId = session.sessionId;
                if (!claudeSessionId) {
                    logger.debug('[remote]: no session id, cannot rewind files');
                    return;
                }

                const projectDir = getProjectPath(session.path);
                const jsonlPath = join(projectDir, `${claudeSessionId}.jsonl`);

                const occurrence = userMessageTextOccurrence ?? 1;
                const hapiSnapshot = findHapiFileSnapshotAfterUserText(jsonlPath, userMessageText, occurrence);
                const snapshot = hapiSnapshot ?? findFileSnapshot(jsonlPath);

                if (snapshot) {
                    const restored = applyFileSnapshot(snapshot, session.path);
                    logger.debug(`[remote]: restored ${restored.length} files from snapshot (files-only)`);
                } else {
                    logger.debug('[remote]: no file snapshot found, skipping file restore');
                }

                logger.debug(`[remote]: files-only rewind complete for seq=${targetSeq}`);
                return;
            }

            // session-and-files or session-only: abort + truncate JSONL
            if (this.abortController && !this.abortController.signal.aborted) {
                this.abortController.abort();
            }
            await this.abortFuture?.promise;

            const claudeSessionId = session.sessionId;
            if (!claudeSessionId) {
                logger.debug('[remote]: no session id, cannot rewind');
                return;
            }

            const projectDir = getProjectPath(session.path);
            const jsonlPath = join(projectDir, `${claudeSessionId}.jsonl`);

            const occurrence = userMessageTextOccurrence ?? 1;

            // Capture HAPI snapshots before truncation (for session-and-files mode)
            let hapiSnapshot: ReturnType<typeof findHapiFileSnapshotAfterUserText> = null;
            if (mode === 'session-and-files') {
                hapiSnapshot = findHapiFileSnapshotAfterUserText(jsonlPath, userMessageText, occurrence);
            }

            // Truncate JSONL by matching user message text
            truncateJsonlByUserText(jsonlPath, userMessageText, occurrence);

            // Restore files only in session-and-files mode
            if (mode === 'session-and-files') {
                const snapshot = hapiSnapshot ?? findFileSnapshot(jsonlPath);
                if (snapshot) {
                    const restored = applyFileSnapshot(snapshot, session.path);
                    logger.debug(`[remote]: restored ${restored.length} files from snapshot`);
                } else {
                    logger.debug('[remote]: no file snapshot found, skipping file restore');
                }
            }

            logger.debug(`[remote]: rewind complete for seq=${targetSeq} mode=${mode}`);
        } catch (error) {
            logger.debug('[remote]: rewind failed', error);
            throw error;
        } finally {
            this.isRewinding = false;
            barrierResolve();
        }
    }
});
```

- [ ] **Step 3: 运行 CLI 测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/cli && bunx vitest run src/claude/utils/rewind.test.ts`
Expected: PASS

- [ ] **Step 4: 验证类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:cli`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/modules/common/remote/RemoteLauncherBase.ts cli/src/claude/claudeRemoteLauncher.ts
git commit -m "feat(cli): support RewindMode with mode-based branching in rewind handler"
```

---

### Task 8: 全量验证

- [ ] **Step 1: 运行全量类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck`
Expected: PASS

- [ ] **Step 2: 运行全量测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run test`
Expected: PASS

- [ ] **Step 3: 手动验证**

1. 启动 `bun run dev`
2. 打开 Web 界面，进入一个远程 session
3. 点击用户消息上的 Rewind 按钮
4. 验证自定义弹窗出现，有三个卡片式选项
5. 默认选中「会话 + 文件」
6. 选择不同选项，确认按钮文字和交互正常
7. 点击取消，弹窗关闭，无操作执行
8. 选择一种模式，点击确认回撤，验证功能正常
