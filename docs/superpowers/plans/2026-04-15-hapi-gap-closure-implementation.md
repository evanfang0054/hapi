# HAPI 当前缺口补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以最小增量补齐 3 个已确认缺口：`#444` exit-plan-mode 审批闭环、批量删除 inactive sessions、`#461` shared runtime architecture，并确保跨 `web / hub / cli / shared` 的 contract、行为边界与验证路径明确可执行。

**Architecture:** 先补 contract，再补行为。`#444` 通过在共享 approval payload 中加入 `contextAction`，把 plan 审批结果显式传到 CLI 的 implementation 入口；批量删除 v1 复用现有单删 route、query cache 与 SSE 收敛链路，只新增前端多选模式与聚合反馈；`#461` 先定义 shared host / per-session worker / flavor adapter 三层架构，配套 baseline、通信协议、生命周期、回退边界，再分阶段接入。

**Tech Stack:** Bun workspaces, React 19, TanStack Query v5, Vitest, Hono, Socket.IO, SQLite, Zod, Node.js `worker_threads` / `MessageChannel` / `MessagePort`.

---

## File Structure

### Shared contract / approval flow
- Modify: `shared/src/schemas.ts`
  - 为 completed permission request schema 增加 `contextAction`。
- Modify: `shared/src/types.ts` 或当前 permission 相关共享类型文件
  - 若已有 approval payload 类型，补充 `contextAction` 联动类型。
- Modify: `web/src/api/client.ts`
  - 扩展 `approvePermission(...)` 的 options 类型，允许传 `contextAction`。
- Modify: `hub/src/web/routes/permissions.ts`
  - 扩展 approval body schema，校验并透传 `contextAction`。
- Modify: `hub/src/sync/syncEngine.ts`
  - 扩展 `approvePermission(...)` 参数并继续 relay 给 RPC gateway。
- Modify: `hub/src/sync/rpcGateway.ts`
  - 扩展 `permission` RPC payload，透传 `contextAction`。
- Modify: `cli/src/claude/utils/permissionHandler.ts`
  - 把 `exit_plan_mode` 的 special-case 从“只认 mode”改成“显式处理 mode + contextAction”。
- Modify: `cli/src/utils/MessageQueue2.ts`（仅在现有原语不够时）
  - 优先复用 `pushIsolateAndClear` / `reset` / `unshift`；只有测试暴露缺口时才补最小 helper。
- Test: `shared` permission schema tests
- Test: `hub/src/web/routes/permissions*.test.ts`
- Test: `cli/src/claude/utils/permissionHandler*.test.ts`
- Test: `web/src/components/ToolCard/PermissionFooter*.test.tsx`

### Web approval UI
- Modify: `web/src/components/ToolCard/PermissionFooter.tsx`
  - 仅对 `exit_plan_mode` / `ExitPlanMode` 显示 post-plan mode 与 implementation mode 控件。
- Reuse: `web/src/components/ToolCard/views/ExitPlanModeView.tsx`
  - 保持 plan markdown 展示职责，不承载审批控制。
- Test: `web/src/components/ToolCard/PermissionFooter*.test.tsx`

### Batch delete inactive sessions
- Modify: `web/src/components/SessionList.tsx`
  - 引入 `selectionMode` 与 `selectedIds`，复用长按进入多选。
- Modify: `web/src/components/SessionActionMenu.tsx`
  - 提供“进入多选 / 删除所选”入口或与当前菜单协调。
- Modify: `web/src/hooks/mutations/useSessionActions.ts`
  - 新增批量删除 mutation，聚合成功/失败与缓存收敛。
- Modify: `web/src/api/client.ts`
  - 继续复用单个 `deleteSession(sessionId)`，不新增 bulk API。
- Reuse: `hub/src/web/routes/sessions.ts`
  - 保持单删 route 与 active guard 不变，仅补测试如有必要。
- Reuse: `hub/src/sync/sessionCache.ts`
  - 继续使用现有 active guard 与 `session-removed` 广播。
- Reuse: `web/src/hooks/useSSE.ts`
  - 继续用 `session-removed` 做 detail/cache 收敛。
- Test: `web/src/components/SessionList*.test.tsx`
- Test: `web/src/hooks/mutations/useSessionActions*.test.ts`
- Test: `hub/src/web/routes/sessions*.test.ts`

### Shared runtime architecture (`#461`)
- Modify: `docs/superpowers/specs/2026-04-15-hapi-gap-closure-design.md`（如需在实现过程中补充架构附录，单独 commit；若无需补 spec 则不改）
- Create: `docs/superpowers/plans/implementation-artifacts/shared-runtime-baseline.md`（可选；仅当需要单独记录基线采样方法）
- Modify: `cli/src/runner/run.ts`
  - 识别 current runner state 与可抽出的 host 责任。
- Modify: `cli/src/agent/runnerLifecycle.ts`
  - 明确 session worker 生命周期接口。
- Modify: `cli/src/api/apiMachine.ts`
  - 作为 host command ingress / spawn contract 对齐点。
- Modify: 各 flavor runner 入口（按实际存在文件）
  - `cli/src/claude/**`
  - `cli/src/codex/**`
  - `cli/src/cursor/**`
  - `cli/src/gemini/**` 或 `cli/src/agent/**`
  - `cli/src/opencode/**`
- Create: `cli/src/runner/sharedRuntime/`（推荐）
  - `host.ts`：shared runtime host
  - `workerProtocol.ts`：runner ↔ worker command/event/error schema
  - `workerFactory.ts`：worker 创建与销毁
  - `adapters/`：各 flavor adapter
  - `resourcePolicy.ts`：idle reclaim / limits
- Test: `cli/src/runner/sharedRuntime/*.test.ts`
- Test: flavor adapter compatibility tests
- Measure: baseline / shared-runtime comparison script or test harness

### External feasibility references used in this plan
- TanStack Query v5 docs: mutation 后使用 `queryClient.invalidateQueries(...)` 做 targeted invalidation，删除特定详情缓存使用 `queryClient.removeQueries(...)`；v5 不再建议从 query 实例上调用 `remove()`。
- Node.js docs: `worker_threads` 支持 `Worker`、`postMessage`、`MessageChannel`、`MessagePort`；可用于 host ↔ worker 隔离通信与 worker 生命周期管理。

---

## Task 1: 补齐 shared approval contract 的 `contextAction`

**Files:**
- Modify: `shared/src/schemas.ts`
- Modify: `shared/src/types.ts`（或当前 permission approval 共享类型文件）
- Test: `shared` 中 permission schema / type 相关测试文件

- [x] **Step 1: 写出 shared schema 的失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { AgentStateCompletedRequestSchema } from '../src/schemas'

describe('AgentStateCompletedRequestSchema', () => {
    it('accepts exit-plan approvals with contextAction', () => {
        const parsed = AgentStateCompletedRequestSchema.parse({
            tool: 'exit_plan_mode',
            arguments: {},
            status: 'approved',
            mode: 'default',
            decision: 'approved',
            contextAction: 'clear_context'
        })

        expect(parsed.contextAction).toBe('clear_context')
    })

    it('rejects unknown contextAction values', () => {
        expect(() => AgentStateCompletedRequestSchema.parse({
            tool: 'exit_plan_mode',
            arguments: {},
            status: 'approved',
            contextAction: 'reset_everything'
        })).toThrow()
    })
})
```

- [x] **Step 2: 运行 shared 测试并确认失败**

Run: `bun test shared/src/**/*.test.ts`
Expected: FAIL，提示 `contextAction` 不存在或 schema 不接受该字段。

- [x] **Step 3: 在 shared schema 中加入最小实现**

```ts
const ContextActionSchema = z.enum(['keep_context', 'clear_context'])

export const AgentStateCompletedRequestSchema = z.object({
    tool: z.string(),
    arguments: z.unknown(),
    createdAt: z.number().nullish(),
    completedAt: z.number().nullish(),
    status: z.enum(['canceled', 'denied', 'approved']),
    reason: z.string().optional(),
    mode: z.string().optional(),
    decision: z.enum(['approved', 'approved_for_session', 'denied', 'abort']).optional(),
    allowTools: z.array(z.string()).optional(),
    answers: z.union([
        z.record(z.string(), z.array(z.string())),
        z.record(z.string(), z.object({ answers: z.array(z.string()) }))
    ]).optional(),
    contextAction: ContextActionSchema.optional()
})
```

- [x] **Step 4: 同步共享类型**

```ts
export type PermissionContextAction = 'keep_context' | 'clear_context'

export type PermissionApprovalPayload = {
    mode?: PermissionMode
    decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
    allowTools?: string[]
    answers?: Record<string, string[]> | Record<string, { answers: string[] }>
    contextAction?: PermissionContextAction
}
```

- [x] **Step 5: 再跑 shared 测试确认通过**

_Result:_ 新增 `shared/src/schemas.test.ts`，已验证 `contextAction` 允许 `keep_context | clear_context`，未知值会被拒绝；`shared/src/types.ts` 已补 `PermissionApprovalPayload` 等共享类型。

Run: `bun test shared/src/**/*.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add shared/src/schemas.ts shared/src/types.ts shared/src/**/*.test.ts
git commit -m "feat(shared): add plan approval context action contract"
```

---

## Task 2: 让 hub approval route 校验并透传 `contextAction`

**Files:**
- Modify: `hub/src/web/routes/permissions.ts`
- Modify: `hub/src/sync/syncEngine.ts`
- Modify: `hub/src/sync/rpcGateway.ts`
- Test: `hub/src/web/routes/permissions*.test.ts`

- [x] **Step 1: 写 route 级失败测试**

```ts
it('accepts contextAction for exit plan approvals', async () => {
    const response = await app.request('/api/sessions/session-1/permissions/request-1/approve', {
        method: 'POST',
        headers: {
            authorization: 'Bearer test-token',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            mode: 'default',
            decision: 'approved',
            contextAction: 'clear_context'
        })
    })

    expect(response.status).toBe(200)
    expect(engine.approvePermission).toHaveBeenCalledWith(
        'session-1',
        'request-1',
        'default',
        undefined,
        'approved',
        undefined,
        'clear_context'
    )
})

it('rejects invalid contextAction values', async () => {
    const response = await app.request('/api/sessions/session-1/permissions/request-1/approve', {
        method: 'POST',
        headers: {
            authorization: 'Bearer test-token',
            'content-type': 'application/json'
        },
        body: JSON.stringify({ contextAction: 'bad_value' })
    })

    expect(response.status).toBe(400)
})
```

- [x] **Step 2: 运行 hub route 测试确认失败**

Run: `cd hub && bun test src/web/routes/permissions.test.ts`
Expected: FAIL，`contextAction` 未通过 schema 或未传给 engine。

- [x] **Step 3: 扩展 route body schema 与 relay**

```ts
const contextActionSchema = z.enum(['keep_context', 'clear_context'])

const approveBodySchema = z.object({
    mode: PermissionModeSchema.optional(),
    allowTools: z.array(z.string()).optional(),
    decision: decisionSchema.optional(),
    answers: answersSchema.optional(),
    contextAction: contextActionSchema.optional()
})
```

```ts
const allowTools = parsed.data.allowTools
const decision = parsed.data.decision
const answers = parsed.data.answers
const contextAction = parsed.data.contextAction
await engine.approvePermission(sessionId, requestId, mode, allowTools, decision, answers, contextAction)
```

- [x] **Step 4: 扩展 sync engine 与 RPC gateway 签名**

```ts
async approvePermission(
    sessionId: string,
    requestId: string,
    mode?: PermissionMode,
    allowTools?: string[],
    decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort',
    answers?: Record<string, string[]> | Record<string, { answers: string[] }>,
    contextAction?: 'keep_context' | 'clear_context'
): Promise<void> {
    await this.rpcGateway.approvePermission(sessionId, requestId, mode, allowTools, decision, answers, contextAction)
}
```

```ts
await this.sessionRpc(sessionId, 'permission', {
    id: requestId,
    approved: true,
    mode,
    allowTools,
    decision,
    answers,
    contextAction
})
```

- [x] **Step 5: 再跑 hub route 测试确认通过**

_Result:_ `hub/src/web/routes/permissions.ts` 已校验并透传 `contextAction`；`hub/src/sync/syncEngine.ts` 与 `hub/src/sync/rpcGateway.ts` 已补齐 relay；新增 route、sync engine、rpc gateway 测试，覆盖合法值透传、非法值拒绝以及完整 RPC payload 包含 `contextAction`。

Run: `cd hub && bun test src/web/routes/permissions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add hub/src/web/routes/permissions.ts hub/src/sync/syncEngine.ts hub/src/sync/rpcGateway.ts hub/src/web/routes/permissions.test.ts
git commit -m "feat(hub): relay exit plan context action approvals"
```

---

## Task 3: 扩展 web API client 的 approval payload 类型

**Files:**
- Modify: `web/src/api/client.ts`
- Test: `web/src/api/client.test.ts` 或现有 API client 测试文件

- [x] **Step 1: 写失败测试，确认 `approvePermission` 会发送 `contextAction`**

```ts
it('sends contextAction in approvePermission payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
    })

    vi.stubGlobal('fetch', fetchMock)

    const client = new ApiClient('token')
    await client.approvePermission('session-1', 'request-1', {
        mode: 'acceptEdits',
        decision: 'approved',
        contextAction: 'clear_context'
    })

    expect(fetchMock).toHaveBeenCalledWith(
        '/api/sessions/session-1/permissions/request-1/approve',
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
                mode: 'acceptEdits',
                decision: 'approved',
                contextAction: 'clear_context'
            })
        })
    )
})
```

- [x] **Step 2: 运行 web client 测试确认失败**

Run: `cd web && bunx vitest run src/api/client.test.ts`
Expected: FAIL，类型或 payload 断言不通过。

- [x] **Step 3: 扩展 `approvePermission(...)` 参数类型**

```ts
async approvePermission(
    sessionId: string,
    requestId: string,
    modeOrOptions?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | {
        mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
        allowTools?: string[]
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
        answers?: Record<string, string[]> | Record<string, { answers: string[] }>
        contextAction?: 'keep_context' | 'clear_context'
    }
): Promise<void> {
    const body = typeof modeOrOptions === 'string' || modeOrOptions === undefined
        ? { mode: modeOrOptions }
        : modeOrOptions

    await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        body: JSON.stringify(body)
    })
}
```

- [x] **Step 4: 再跑 web client 测试确认通过**

_Result:_ `web/src/api/client.ts` 的 `approvePermission(...)` options 已支持 `contextAction`；`web/src/api/client.test.ts` 通过 `Parameters<ApiClient['approvePermission']>[2]` 覆盖类型约束并验证请求 payload 包含 `contextAction`；同时修正 `shared/src/types.ts` 中 `PermissionApprovalPayload.mode` 的类型引用以恢复 `bun run typecheck:web` 绿灯。

Run: `cd web && bunx vitest run src/api/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/api/client.ts web/src/api/client.test.ts
git commit -m "feat(web): support context action in approval client payload"
```

---

## Task 4: 在 `PermissionFooter` 中补齐 exit-plan-mode 审批 UI

**Files:**
- Modify: `web/src/components/ToolCard/PermissionFooter.tsx`
- Test: `web/src/components/ToolCard/PermissionFooter.test.tsx`

- [x] **Step 1: 写 UI 失败测试，覆盖显示与隐藏规则**

```tsx
it('shows post-plan controls only for exit_plan_mode approvals', () => {
    render(
        <PermissionFooter
            {...baseProps}
            tool={{ ...baseProps.tool, name: 'exit_plan_mode', input: { plan: 'do thing' } }}
        />
    )

    expect(screen.getByLabelText(/post-plan permission mode/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/implementation mode/i)).toBeInTheDocument()
})

it('keeps extra controls hidden for normal approvals', () => {
    render(
        <PermissionFooter
            {...baseProps}
            tool={{ ...baseProps.tool, name: 'Bash', input: { command: 'pwd' } }}
        />
    )

    expect(screen.queryByLabelText(/post-plan permission mode/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/implementation mode/i)).not.toBeInTheDocument()
})
```

- [x] **Step 2: 写提交 payload 的失败测试**

```tsx
it('submits selected mode and contextAction for exit plan approvals', async () => {
    const approvePermission = vi.fn().mockResolvedValue(undefined)
    render(
        <PermissionFooter
            {...baseProps}
            api={{ ...baseProps.api, approvePermission }}
            tool={{ ...baseProps.tool, name: 'ExitPlanMode', input: { plan: 'ship it' } }}
        />
    )

    await userEvent.selectOptions(screen.getByLabelText(/post-plan permission mode/i), 'acceptEdits')
    await userEvent.selectOptions(screen.getByLabelText(/implementation mode/i), 'clear_context')
    await userEvent.click(screen.getByRole('button', { name: /allow/i }))

    expect(approvePermission).toHaveBeenCalledWith('session-1', 'permission-1', {
        mode: 'acceptEdits',
        contextAction: 'clear_context'
    })
})
```

- [x] **Step 3: 运行组件测试并确认失败**

Run: `cd web && bunx vitest run src/components/ToolCard/PermissionFooter.test.tsx`
Expected: FAIL，额外控件不存在或 payload 未带 `contextAction`。

- [x] **Step 4: 在组件中加入最小状态与控件**

```tsx
const isExitPlanApproval = toolName === 'exit_plan_mode' || toolName === 'ExitPlanMode'
const [postPlanMode, setPostPlanMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions'>('default')
const [contextAction, setContextAction] = useState<'keep_context' | 'clear_context'>('keep_context')
```

```tsx
{isExitPlanApproval ? (
    <>
        <label>
            <span>Post-plan permission mode</span>
            <select
                aria-label="Post-plan permission mode"
                value={postPlanMode}
                onChange={(event) => setPostPlanMode(event.currentTarget.value as 'default' | 'acceptEdits' | 'bypassPermissions')}
            >
                <option value="default">default</option>
                <option value="acceptEdits">acceptEdits</option>
                <option value="bypassPermissions">bypassPermissions</option>
            </select>
        </label>
        <label>
            <span>Implementation mode</span>
            <select
                aria-label="Implementation mode"
                value={contextAction}
                onChange={(event) => setContextAction(event.currentTarget.value as 'keep_context' | 'clear_context')}
            >
                <option value="keep_context">keep_context</option>
                <option value="clear_context">clear_context</option>
            </select>
        </label>
    </>
) : null}
```

```ts
const approve = async () => {
    if (!isPending || loading || loadingAllEdits || loadingForSession) return
    setLoading('allow')
    await run(
        () => isExitPlanApproval
            ? props.api.approvePermission(props.sessionId, permission.id, {
                mode: postPlanMode,
                contextAction
            })
            : props.api.approvePermission(props.sessionId, permission.id),
        'success'
    )
    setLoading(null)
}
```

- [x] **Step 5: 补一条默认值测试**

```tsx
it('defaults exit plan approval to default mode and keep_context', async () => {
    const approvePermission = vi.fn().mockResolvedValue(undefined)
    render(
        <PermissionFooter
            {...baseProps}
            api={{ ...baseProps.api, approvePermission }}
            tool={{ ...baseProps.tool, name: 'exit_plan_mode', input: { plan: 'ship it' } }}
        />
    )

    await userEvent.click(screen.getByRole('button', { name: /allow/i }))

    expect(approvePermission).toHaveBeenCalledWith('session-1', 'permission-1', {
        mode: 'default',
        contextAction: 'keep_context'
    })
})
```

- [x] **Step 6: 再跑组件测试确认通过**

_Result:_ `PermissionFooter.tsx` 已仅对 `exit_plan_mode` / `ExitPlanMode` 渲染 post-plan permission mode 与 implementation mode 控件，并在 Allow 时提交 `{ mode, contextAction }`；新增 `PermissionFooter.test.tsx` 覆盖显示/隐藏规则、选中值提交与默认值提交，同时 `bun run typecheck` 通过。

Run: `cd web && bunx vitest run src/components/ToolCard/PermissionFooter.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ToolCard/PermissionFooter.tsx web/src/components/ToolCard/PermissionFooter.test.tsx
git commit -m "feat(web): add explicit exit plan approval controls"
```

---

## Task 5: 在 CLI 中实现 `keep_context` / `clear_context` 的显式处理

**Files:**
- Modify: `cli/src/claude/utils/permissionHandler.ts`
- Modify: `cli/src/utils/MessageQueue2.ts`（仅在测试证明必须时）
- Modify: `cli/src/claude/runClaude.ts`（仅在需要复用既有上下文清理逻辑时）
- Test: `cli/src/claude/utils/permissionHandler.test.ts`

- [x] **Step 1: 写 `keep_context` 行为的失败测试**

```ts
it('uses selected permission mode when exit plan approval keeps context', async () => {
    const queue = {
        unshift: vi.fn(),
        pushIsolateAndClear: vi.fn(),
        reset: vi.fn()
    }
    const pending = buildPendingPermission({ toolName: 'exit_plan_mode' })
    const handler = buildPermissionHandler({ queue, pending })

    await handler.handleResponse(pending.id, {
        approved: true,
        mode: 'acceptEdits',
        contextAction: 'keep_context'
    })

    expect(queue.unshift).toHaveBeenCalledWith(PLAN_FAKE_RESTART, { permissionMode: 'acceptEdits' })
    expect(queue.pushIsolateAndClear).not.toHaveBeenCalled()
    expect(queue.reset).not.toHaveBeenCalled()
    expect(pending.resolve).toHaveBeenCalledWith({ behavior: 'deny', message: PLAN_FAKE_REJECT })
})
```

- [x] **Step 2: 写 `clear_context` 行为的失败测试**

```ts
it('clears plan execution context before restarting implementation', async () => {
    const queue = {
        unshift: vi.fn(),
        pushIsolateAndClear: vi.fn(),
        reset: vi.fn()
    }
    const pending = buildPendingPermission({ toolName: 'ExitPlanMode' })
    const handler = buildPermissionHandler({ queue, pending })

    await handler.handleResponse(pending.id, {
        approved: true,
        mode: 'default',
        contextAction: 'clear_context'
    })

    expect(queue.pushIsolateAndClear).toHaveBeenCalledWith(PLAN_FAKE_RESTART, { permissionMode: 'default' })
    expect(queue.unshift).not.toHaveBeenCalled()
    expect(pending.resolve).toHaveBeenCalledWith({ behavior: 'deny', message: PLAN_FAKE_REJECT })
})
```

- [x] **Step 3: 运行 CLI permission handler 测试确认失败**

Run: `cd cli && bunx vitest run src/claude/utils/permissionHandler.test.ts`
Expected: FAIL，handler 还未读取 `contextAction`。

- [x] **Step 4: 在 `permissionHandler.ts` 中最小实现显式分支**

```ts
const selectedMode = response.mode && PLAN_EXIT_MODES.includes(response.mode)
    ? response.mode
    : 'default'
const contextAction = response.contextAction ?? 'keep_context'

if (pending.toolName === 'exit_plan_mode' || pending.toolName === 'ExitPlanMode') {
    if (response.approved) {
        if (contextAction === 'clear_context') {
            this.session.queue.pushIsolateAndClear(PLAN_FAKE_RESTART, { permissionMode: selectedMode })
        } else {
            this.session.queue.unshift(PLAN_FAKE_RESTART, { permissionMode: selectedMode })
        }
        pending.resolve({ behavior: 'deny', message: PLAN_FAKE_REJECT })
    } else {
        pending.resolve({ behavior: 'deny', message: response.reason || 'Plan rejected' })
    }
    return completion
}
```

- [x] **Step 5: 若测试暴露“仅清队列不够”，补最小 session 状态清理 helper**

```ts
clearPlanContinuationState(): void {
    this.pendingPlanMessages = []
    this.pendingPlanContinuation = null
}
```

```ts
if (contextAction === 'clear_context') {
    this.session.clearPlanContinuationState?.()
    this.session.queue.pushIsolateAndClear(PLAN_FAKE_RESTART, { permissionMode: selectedMode })
}
```

说明：只清与当前 plan continuation 相关的临时状态；不要动持久化 history、session metadata、approval record。

- [x] **Step 6: 增加边界测试，确保不会误删 session record**

```ts
it('does not clear durable session metadata when clearing context', async () => {
    const session = buildSession({
        metadata: { claudeSessionId: 'abc', path: '/tmp/project' },
        queue: {
            unshift: vi.fn(),
            pushIsolateAndClear: vi.fn(),
            reset: vi.fn()
        }
    })
    const pending = buildPendingPermission({ toolName: 'exit_plan_mode' })
    const handler = buildPermissionHandler({ session, pending })

    await handler.handleResponse(pending.id, {
        approved: true,
        contextAction: 'clear_context'
    })

    expect(session.metadata).toEqual({ claudeSessionId: 'abc', path: '/tmp/project' })
})
```

- [x] **Step 7: 再跑 CLI permission handler 测试确认通过**

Run: `cd cli && bunx vitest run src/claude/utils/permissionHandler.test.ts`
Expected: PASS

_Result:_ `cli/src/claude/utils/permissionHandler.ts` 现在会读取 exit-plan 审批里的 `contextAction`，在 `keep_context` 时继续用 `queue.unshift(...)`，在 `clear_context` 时改用 `queue.pushIsolateAndClear(...)`；新增 `cli/src/claude/utils/permissionHandler.test.ts` 覆盖 keep/clear 两条路径和 durable metadata 边界，验证普通 session metadata 不会被误清理。

- [ ] **Step 8: Commit**

```bash
git add cli/src/claude/utils/permissionHandler.ts cli/src/utils/MessageQueue2.ts cli/src/claude/runClaude.ts cli/src/claude/utils/permissionHandler.test.ts
git commit -m "feat(cli): support explicit exit plan context transitions"
```

---

## Task 6: 做 `#444` 端到端回归验证

**Files:**
- Modify: 受影响测试文件（按实际落点）
- Optional: 新增最小 integration-style test 文件

- [x] **Step 1: 补普通工具审批不回归测试**

```ts
it('keeps normal permission approvals unchanged', async () => {
    const pending = buildPendingPermission({ toolName: 'Bash' })
    const handler = buildPermissionHandler({ pending })

    await handler.handleResponse(pending.id, {
        approved: true,
        mode: 'default'
    })

    expect(pending.resolve).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'allow' }))
})
```

- [x] **Step 2: 运行受影响测试集合**

Run: `bun run test:cli && bun run test:hub && bun run test:web`
Expected: PASS 或只剩与当前 feature 无关的已知失败。

- [x] **Step 3: 手动真实路径验证**

Run:
```bash
bun run dev
```

Manual flow:
1. 新建一个 Claude session。
2. 进入 plan mode。
3. 触发 `ExitPlanMode` 审批。
4. 依次验证：
   - `default + keep_context`
   - `acceptEdits + keep_context`
   - `bypassPermissions + keep_context`
   - `default + clear_context`
5. 确认：
   - implementation 阶段 permission mode 与选择一致。
   - `clear_context` 不再消费旧 planning context。
   - 会话历史、session identity、approval record 仍连续可见。

结果：通过 hub API 复用已在 `:3006` 运行的真实 hub，分别创建真实 Claude session 并完成 4 组审批。4 组 case 均返回 `approve { ok: true }`，session `permissionMode` 与审批选择一致；`completedRequests` 中保留对应 `ExitPlanMode` 审批记录；session `id`、`metadata.claudeSessionId` 与完整消息历史均可继续读取。`clear_context` case 在审批后同样保留 session identity 与 approval history，且 pending requests 被清空，未观察到旧 planning continuation 继续挂起或重复消费。随后根据 code review 补充修复两处收尾缺口：`BasePermissionHandler` 现已把 `contextAction` 持久化到 `completedRequests`；`PermissionFooter` 已移除不会被 CLI 接受的 `plan` 选项，并新增对应回归测试。

- [x] **Step 4: 记录真实路径结果**

```md
- default + keep_context: pass
- acceptEdits + keep_context: pass
- bypassPermissions + keep_context: pass
- default + clear_context: pass
- regression on normal Bash approval: none
```

- [x] **Step 5: Commit**

```bash
git add [updated test files]
git commit -m "test(plan): verify exit plan approval contract end to end"
```

---

## Task 7: 在 `SessionList` 中引入多选模式

**Files:**
- Modify: `web/src/components/SessionList.tsx`
- Modify: `web/src/components/SessionActionMenu.tsx`
- Test: `web/src/components/SessionList.test.tsx`

- [x] **Step 1: 写多选模式进入与默认选中的失败测试**

```tsx
it('enters selection mode on long press and selects the pressed inactive session', async () => {
    render(<SessionList {...baseProps} sessions={[inactiveSession]} />)

    await triggerLongPress(screen.getByText(inactiveSession.name))

    expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: inactiveSession.name })).toBeChecked()
})
```

- [x] **Step 2: 写 active session 禁选测试**

```tsx
it('does not allow selecting active sessions in selection mode', async () => {
    render(<SessionList {...baseProps} sessions={[activeSession, inactiveSession]} />)

    await triggerLongPress(screen.getByText(inactiveSession.name))
    await userEvent.click(screen.getByRole('checkbox', { name: activeSession.name }))

    expect(screen.getByRole('checkbox', { name: activeSession.name })).not.toBeChecked()
})
```

- [x] **Step 3: 运行 `SessionList` 测试确认失败**

Run: `cd web && bunx vitest run src/components/SessionList.test.tsx`
Expected: FAIL，多选控件与 selection mode 尚不存在。

- [x] **Step 4: 给 `SessionList` 增加最小状态**

```ts
const [selectionMode, setSelectionMode] = useState(false)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

```ts
const enterSelectionMode = (sessionId: string) => {
    setSelectionMode(true)
    setSelectedIds(new Set([sessionId]))
}

const toggleSelected = (sessionId: string, active: boolean) => {
    if (active) return
    setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(sessionId)) {
            next.delete(sessionId)
        } else {
            next.add(sessionId)
        }
        return next
    })
}
```

- [x] **Step 5: 复用长按进入多选模式**

```ts
const longPressHandlers = useLongPress({
    onLongPress: (point) => {
        haptic.impact('medium')
        setMenuAnchorPoint(point)
        setMenuOpen(false)
        enterSelectionMode(s.id)
    },
    onClick: () => {
        if (selectionMode) {
            toggleSelected(s.id, s.active)
            return
        }
        if (!menuOpen) {
            onSelect(s.id)
        }
    },
    threshold: 500
})
```

- [x] **Step 6: 渲染多选 UI 与批量删除入口**

```tsx
{selectionMode ? (
    <>
        <input
            type="checkbox"
            aria-label={sessionName}
            checked={selectedIds.has(s.id)}
            disabled={s.active}
            onChange={() => toggleSelected(s.id, s.active)}
        />
        <button type="button" onClick={() => setBulkDeleteOpen(true)} disabled={selectedIds.size === 0}>
            Delete selected
        </button>
    </>
) : null}
```

- [x] **Step 7: 补退出多选模式测试**

```tsx
it('clears selection state when selection mode is cancelled', async () => {
    render(<SessionList {...baseProps} sessions={[inactiveSession]} />)

    await triggerLongPress(screen.getByText(inactiveSession.name))
    await userEvent.click(screen.getByRole('button', { name: /cancel selection/i }))

    expect(screen.queryByRole('checkbox', { name: inactiveSession.name })).not.toBeInTheDocument()
})
```

- [x] **Step 8: 再跑 `SessionList` 测试确认通过**

_Result:_ `web/src/components/SessionList.tsx` 已补 `selectionMode`、`selectedIds`、`bulkDeleteOpen` 与选择态清理逻辑；长按会进入多选模式，inactive session 默认选中，active session 不可选；同时保留右键菜单，并新增显式 `More actions` 按钮以覆盖触屏/PWA/Mini App 菜单入口；session item 结构已拆分，避免 checkbox 嵌套在 button 内。`web/src/components/SessionList.test.tsx` 当前覆盖展示信息、右键菜单、显式按钮入口、多选进入、active 禁选、prune、取消选择等 8 条行为测试。主分支人工 code review 结论：无新的 critical / important 阻塞问题，可继续推进。

Run: `cd web && bunx vitest run src/components/SessionList.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add web/src/components/SessionList.tsx web/src/components/SessionActionMenu.tsx web/src/components/SessionList.test.tsx
git commit -m "feat(web): add inactive session multi-select mode"
```

---

## Task 8: 在 `useSessionActions` 中实现批量删除聚合与缓存收敛

**Files:**
- Modify: `web/src/hooks/mutations/useSessionActions.ts`
- Test: `web/src/hooks/mutations/useSessionActions.test.tsx`
- Reuse: `web/src/hooks/useSSE.ts`

- [x] **Step 1: 写批量删除成功聚合测试**

```ts
it('deletes multiple inactive sessions and clears detail caches', async () => {
    const deleteSession = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useSessionActions({
        api: { deleteSession } as any,
        sessionId: 'session-a'
    }), { wrapper: createWrapper() })

    const summary = await act(async () => {
        return await result.current.deleteSessions(['session-a', 'session-b'])
    })

    expect(summary).toEqual({
        successCount: 2,
        failureCount: 0,
        failures: []
    })
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-a') })
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-b') })
})
```

- [x] **Step 2: 写部分失败聚合测试**

```ts
it('returns partial failure summary for bulk delete', async () => {
    const deleteSession = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Cannot delete active session'))
        .mockRejectedValueOnce(new Error('Session not found'))

    const { result } = renderHook(() => useSessionActions({
        api: { deleteSession } as any,
        sessionId: 'session-a'
    }), { wrapper: createWrapper() })

    const summary = await act(async () => {
        return await result.current.deleteSessions(['session-a', 'session-b', 'session-c'])
    })

    expect(summary).toEqual({
        successCount: 1,
        failureCount: 2,
        failures: [
            { sessionId: 'session-b', reason: 'Cannot delete active session' },
            { sessionId: 'session-c', reason: 'Session not found' }
        ]
    })
})
```

- [x] **Step 3: 运行 mutation 测试确认失败**

Run: `cd web && bunx vitest run src/hooks/mutations/useSessionActions.test.ts`
Expected: FAIL，还没有 `deleteSessions(...)` 聚合能力。

- [x] **Step 4: 新增批量删除最小实现**

```ts
const deleteSessions = async (sessionIds: string[]) => {
    const failures: Array<{ sessionId: string; reason: string }> = []
    let successCount = 0

    for (const sessionId of sessionIds) {
        try {
            await api.deleteSession(sessionId)
            queryClient.removeQueries({ queryKey: queryKeys.session(sessionId) })
            clearMessageWindow(sessionId)
            successCount += 1
        } catch (error) {
            failures.push({
                sessionId,
                reason: error instanceof Error ? error.message : 'Failed to delete session'
            })
        }
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.sessions })

    return {
        successCount,
        failureCount: failures.length,
        failures
    }
}
```

说明：v1 先串行；若后续确认串行体验不足，再把循环换成受控并发 helper（例如固定并发 2-3），但保持相同返回结构与统一收敛逻辑。

- [x] **Step 5: 补 detail view 收敛测试**

```ts
it('clears current detail state when the viewed session is deleted in bulk', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useSessionActions({
        api: { deleteSession } as any,
        sessionId: 'session-a'
    }), { wrapper: createWrapper() })

    await act(async () => {
        await result.current.deleteSessions(['session-a'])
    })

    expect(clearMessageWindow).toHaveBeenCalledWith('session-a')
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-a') })
})
```

- [x] **Step 6: 再跑 mutation 测试确认通过**

_Result:_ 新增 `web/src/hooks/mutations/useSessionActions.test.tsx`，覆盖批量删除全成功、部分失败以及当前 detail session 被批量删除时的缓存收敛；`web/src/hooks/mutations/useSessionActions.ts` 已新增串行 `deleteSessions(...)` 聚合接口，复用现有单删 API，并在每次成功删除后清理 `queryKeys.session(sessionId)` 与 `clearMessageWindow(sessionId)`，最后统一 `invalidateQueries({ queryKey: queryKeys.sessions })`。运行 `bunx vitest run web/src/hooks/mutations/useSessionActions.test.tsx` 已通过。主分支人工 code review 结论：无新的 critical / important 阻塞问题，可继续推进。

Run: `cd web && bunx vitest run src/hooks/mutations/useSessionActions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/hooks/mutations/useSessionActions.ts web/src/hooks/mutations/useSessionActions.test.ts
git commit -m "feat(web): aggregate bulk session deletions"
```

---

## Task 9: 完成批量删除的确认流与用户反馈

**Files:**
- Modify: `web/src/components/SessionList.tsx`
- Modify: `web/src/components/ConfirmDialog.tsx`（仅当当前 props 不够）
- Test: `web/src/components/SessionList.test.tsx`

- [x] **Step 1: 写批量确认文案失败测试**

```tsx
it('shows bulk delete confirmation with selected count', async () => {
    render(<SessionList {...baseProps} sessions={[inactiveA, inactiveB]} />)

    await triggerLongPress(screen.getByText(inactiveA.name))
    await userEvent.click(screen.getByRole('checkbox', { name: inactiveB.name }))
    await userEvent.click(screen.getByRole('button', { name: /delete selected/i }))

    expect(screen.getByText(/delete 2 sessions/i)).toBeInTheDocument()
})
```

- [x] **Step 2: 写部分失败摘要展示测试**

```tsx
it('shows partial failure summary after bulk delete', async () => {
    const deleteSessions = vi.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 2,
        failures: [
            { sessionId: 'session-b', reason: 'Cannot delete active session' },
            { sessionId: 'session-c', reason: 'Session not found' }
        ]
    })

    render(<SessionList {...baseProps} deleteSessions={deleteSessions} sessions={[inactiveA, inactiveB, inactiveC]} />)

    await triggerLongPress(screen.getByText(inactiveA.name))
    await userEvent.click(screen.getByRole('checkbox', { name: inactiveB.name }))
    await userEvent.click(screen.getByRole('checkbox', { name: inactiveC.name }))
    await userEvent.click(screen.getByRole('button', { name: /delete selected/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(screen.getByText(/deleted 1 session/i)).toBeInTheDocument()
    expect(screen.getByText(/2 deletions failed/i)).toBeInTheDocument()
    expect(screen.getByText(/Cannot delete active session/i)).toBeInTheDocument()
    expect(screen.getByText(/Session not found/i)).toBeInTheDocument()
})
```

- [x] **Step 3: 运行组件测试确认失败**

Run: `cd web && bunx vitest run src/components/SessionList.test.tsx`
Expected: FAIL，批量确认文案或结果摘要不存在。

- [x] **Step 4: 在 `SessionList` 中加入批量确认与结果摘要**

```tsx
<ConfirmDialog
    isOpen={bulkDeleteOpen}
    onClose={() => setBulkDeleteOpen(false)}
    title={`Delete ${selectedIds.size} sessions?`}
    description="Only inactive sessions will be deleted. Active sessions stay protected."
    confirmLabel="Delete selected"
    confirmingLabel="Deleting selected"
    onConfirm={confirmBulkDelete}
    isPending={bulkDeletePending}
    destructive
/>
```

```ts
const confirmBulkDelete = async () => {
    const summary = await deleteSessions(Array.from(selectedIds))
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
    setBulkDeleteSummary(summary)
}
```

- [x] **Step 5: 确认删除后选中态清空**

```tsx
it('clears selected ids after bulk delete completes', async () => {
    const deleteSessions = vi.fn().mockResolvedValue({ successCount: 2, failureCount: 0, failures: [] })
    render(<SessionList {...baseProps} deleteSessions={deleteSessions} sessions={[inactiveA, inactiveB]} />)

    await triggerLongPress(screen.getByText(inactiveA.name))
    await userEvent.click(screen.getByRole('checkbox', { name: inactiveB.name }))
    await userEvent.click(screen.getByRole('button', { name: /delete selected/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(screen.queryByRole('checkbox', { name: inactiveA.name })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: inactiveB.name })).not.toBeInTheDocument()
})
```

- [x] **Step 6: 再跑组件测试确认通过**

_Result:_ `web/src/components/SessionList.test.tsx` 现已覆盖批量确认数量、部分失败摘要、删除成功后清空选中态，以及整体删除请求失败时保留多选状态；`web/src/components/SessionList.tsx` 已补批量确认弹窗、结果摘要和失败保留选择态逻辑。主工作区复审结论为 ready。

Run: `cd web && bunx vitest run src/components/SessionList.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/components/SessionList.tsx web/src/components/ConfirmDialog.tsx web/src/components/SessionList.test.tsx
git commit -m "feat(web): add bulk delete confirmation and summaries"
```

---

## Task 10: 验证批量删除与现有 hub guard / SSE 收敛不回归

**Files:**
- Test: `hub/src/web/routes/sessions.test.ts`
- Test: `web/src/hooks/useSSE.test.ts`（若已有）
- Test: `web/src/hooks/mutations/useSessionActions.test.ts`

- [x] **Step 1: 补 hub active guard 回归测试**

```ts
it('still rejects deleting active sessions', async () => {
    const response = await app.request('/api/sessions/active-session', {
        method: 'DELETE',
        headers: { authorization: 'Bearer test-token' }
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Cannot delete active session' })
})
```

- [x] **Step 2: 补 SSE 收敛测试**

```ts
it('removes deleted session detail cache when session-removed event arrives', () => {
    handleEvent({ type: 'session-removed', sessionId: 'session-a' })

    expect(removeSessionSummary).toHaveBeenCalledWith('session-a')
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: queryKeys.session('session-a') })
    expect(clearMessageWindow).toHaveBeenCalledWith('session-a')
})
```

- [x] **Step 3: 运行受影响测试**

Run: `bun run test:hub && bun run test:web`
Expected: PASS

- [x] **Step 4: 真实路径验证**

结果：已补充真实 hub 链路验证并确认两条 inactive session 可通过真实 `/api/sessions/:id` 删除，且 `/api/events?all=true&visibility=visible` 会收到对应 `session-removed` 事件；随后连续刷新 `/api/sessions`，已删项未重新出现。另起临时 hub 实例后，已通过真实 `/cli/sessions` 创建 session、再经 `/cli` Socket.IO 连接发送 `session-alive` 将其置为 active，并确认真实 `/api/sessions/:id` DELETE 返回 `409 { error: 'Cannot delete active session. Archive it first.' }`，且 session 仍保留为 active。至此 Task 10 所需的 inactive 删除收敛与 active delete guard 真实链路均已验证完成。

- [x] **Step 5: 记录验证结果并 commit**

```bash
git add hub/src/web/routes/sessions.test.ts web/src/hooks/useSSE.test.ts web/src/hooks/mutations/useSessionActions.test.ts
git commit -m "test(web): verify bulk delete session convergence"
```

---

## Task 11: 建立 `#461` 的 baseline 测量与统一协议草案

**Files:**
- Create: `cli/src/runner/sharedRuntime/workerProtocol.ts`
- Create: `cli/src/runner/sharedRuntime/baseline.ts` 或 `cli/scripts/measure-shared-runtime.ts`
- Modify: `cli/src/runner/run.ts`
- Test: `cli/src/runner/sharedRuntime/workerProtocol.test.ts`

- [ ] **Step 1: 写 worker protocol 的失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { WorkerCommandSchema, WorkerEventSchema } from '../sharedRuntime/workerProtocol'

describe('worker protocol', () => {
    it('accepts start-session commands', () => {
        const parsed = WorkerCommandSchema.parse({
            type: 'start-session',
            sessionId: 'session-1',
            flavor: 'claude',
            payload: { cwd: '/tmp/project' }
        })

        expect(parsed.type).toBe('start-session')
    })

    it('accepts failed events with scoped error metadata', () => {
        const parsed = WorkerEventSchema.parse({
            type: 'failed',
            sessionId: 'session-1',
            scope: 'worker',
            recoverable: false,
            error: 'spawn failed'
        })

        expect(parsed.scope).toBe('worker')
    })
})
```

- [ ] **Step 2: 写 baseline harness 的失败测试或快照**

```ts
it('records rss samples for single and multiple sessions', async () => {
    const result = await measureRuntimeBaseline({
        flavor: 'claude',
        sessionCounts: [1, 3],
        sampleWindowMs: 5_000
    })

    expect(result.samples.singleSession.rssBytes).toBeGreaterThan(0)
    expect(result.samples.multiSession['3'].rssBytes).toBeGreaterThan(0)
})
```

- [ ] **Step 3: 运行 CLI shared runtime 测试确认失败**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/workerProtocol.test.ts`
Expected: FAIL，协议与基线测量代码尚不存在。

- [ ] **Step 4: 定义最小 command/event/error/health schema**

```ts
export const WorkerCommandSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('start-session'), sessionId: z.string(), flavor: z.enum(['claude', 'codex', 'cursor', 'gemini', 'opencode']), payload: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal('resume-session'), sessionId: z.string(), flavor: z.enum(['claude', 'codex', 'cursor', 'gemini', 'opencode']), payload: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal('send-message'), sessionId: z.string(), payload: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal('abort'), sessionId: z.string() }),
    z.object({ type: z.literal('terminate'), sessionId: z.string() }),
    z.object({ type: z.literal('update-config'), sessionId: z.string(), payload: z.record(z.string(), z.unknown()) })
])

export const WorkerEventSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('started'), sessionId: z.string() }),
    z.object({ type: z.literal('active'), sessionId: z.string() }),
    z.object({ type: z.literal('thinking'), sessionId: z.string() }),
    z.object({ type: z.literal('message-emitted'), sessionId: z.string(), payload: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal('tool-call-requested'), sessionId: z.string(), payload: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal('completed'), sessionId: z.string() }),
    z.object({ type: z.literal('failed'), sessionId: z.string(), scope: z.enum(['worker', 'host', 'adapter']), recoverable: z.boolean(), error: z.string() }),
    z.object({ type: z.literal('terminated'), sessionId: z.string() }),
    z.object({ type: z.literal('heartbeat'), sessionId: z.string(), rssBytes: z.number().nonnegative() }),
    z.object({ type: z.literal('idle-timeout-reached'), sessionId: z.string() }),
    z.object({ type: z.literal('reclaim-completed'), sessionId: z.string() })
])
```

- [ ] **Step 5: 实现最小 baseline 测量 harness**

```ts
export async function measureRuntimeBaseline(options: {
    flavor: 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
    sessionCounts: number[]
    sampleWindowMs: number
}) {
    return {
        flavor: options.flavor,
        sampleWindowMs: options.sampleWindowMs,
        samples: {
            singleSession: { rssBytes: process.memoryUsage().rss },
            multiSession: Object.fromEntries(options.sessionCounts.map((count) => [String(count), { rssBytes: process.memoryUsage().rss }]))
        }
    }
}
```

说明：首版先把采样口径固定下来；后续再把真实 session orchestration 接进去。

- [ ] **Step 6: 再跑 shared runtime 协议测试确认通过**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/workerProtocol.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add cli/src/runner/sharedRuntime/workerProtocol.ts cli/src/runner/sharedRuntime/workerProtocol.test.ts cli/src/runner/sharedRuntime/baseline.ts cli/src/runner/run.ts
git commit -m "feat(cli): define shared runtime protocol baseline"
```

---

## Task 12: 实现 shared runtime host / worker 基础设施

**Files:**
- Create: `cli/src/runner/sharedRuntime/host.ts`
- Create: `cli/src/runner/sharedRuntime/workerFactory.ts`
- Create: `cli/src/runner/sharedRuntime/resourcePolicy.ts`
- Modify: `cli/src/runner/run.ts`
- Test: `cli/src/runner/sharedRuntime/host.test.ts`

- [ ] **Step 1: 写 host 生命周期失败测试**

```ts
it('creates isolated workers per session and tracks them independently', async () => {
    const host = new SharedRuntimeHost({
        createWorker: vi.fn()
            .mockResolvedValueOnce(buildWorkerHandle('session-a'))
            .mockResolvedValueOnce(buildWorkerHandle('session-b')),
        resourcePolicy: buildResourcePolicy()
    })

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: { cwd: '/tmp/a' } })
    await host.startSession({ sessionId: 'session-b', flavor: 'codex', payload: { cwd: '/tmp/b' } })

    expect(host.getWorker('session-a')).toBeDefined()
    expect(host.getWorker('session-b')).toBeDefined()
    expect(host.getWorker('session-a')).not.toBe(host.getWorker('session-b'))
})
```

- [ ] **Step 2: 写 crash isolation 失败测试**

```ts
it('marks only the crashed session as failed when a worker crashes', async () => {
    const workerA = buildWorkerHandle('session-a')
    const workerB = buildWorkerHandle('session-b')
    const host = new SharedRuntimeHost({
        createWorker: vi.fn()
            .mockResolvedValueOnce(workerA)
            .mockResolvedValueOnce(workerB),
        resourcePolicy: buildResourcePolicy()
    })

    await host.startSession({ sessionId: 'session-a', flavor: 'claude', payload: {} })
    await host.startSession({ sessionId: 'session-b', flavor: 'claude', payload: {} })

    workerA.emit('failed', { sessionId: 'session-a', scope: 'worker', recoverable: false, error: 'boom' })

    expect(host.getSessionState('session-a')).toBe('failed')
    expect(host.getSessionState('session-b')).toBe('active')
})
```

- [ ] **Step 3: 运行 host 测试确认失败**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/host.test.ts`
Expected: FAIL，host/worker 基础设施尚不存在。

- [ ] **Step 4: 实现最小 SharedRuntimeHost**

```ts
export class SharedRuntimeHost {
    private readonly workers = new Map<string, WorkerHandle>()
    private readonly sessionStates = new Map<string, 'starting' | 'active' | 'idle' | 'failed' | 'terminated'>()

    constructor(private readonly deps: {
        createWorker: (command: WorkerStartCommand) => Promise<WorkerHandle>
        resourcePolicy: ResourcePolicy
    }) {}

    async startSession(command: WorkerStartCommand): Promise<void> {
        const worker = await this.deps.createWorker(command)
        this.workers.set(command.sessionId, worker)
        this.sessionStates.set(command.sessionId, 'starting')

        worker.on('event', (event) => {
            if (event.type === 'active') {
                this.sessionStates.set(event.sessionId, 'active')
            }
            if (event.type === 'failed') {
                this.sessionStates.set(event.sessionId, 'failed')
            }
            if (event.type === 'terminated') {
                this.sessionStates.set(event.sessionId, 'terminated')
                this.workers.delete(event.sessionId)
            }
        })
    }

    getWorker(sessionId: string): WorkerHandle | undefined {
        return this.workers.get(sessionId)
    }

    getSessionState(sessionId: string) {
        return this.sessionStates.get(sessionId)
    }
}
```

- [ ] **Step 5: 定义最小 resource policy**

```ts
export type ResourcePolicy = {
    maxWorkers: number
    idleTimeoutMs: number
    shouldReclaimIdleWorker: (worker: { sessionId: string; idleForMs: number; rssBytes: number }) => boolean
}

export function buildDefaultResourcePolicy(): ResourcePolicy {
    return {
        maxWorkers: 8,
        idleTimeoutMs: 10 * 60 * 1000,
        shouldReclaimIdleWorker: ({ idleForMs }) => idleForMs >= 10 * 60 * 1000
    }
}
```

- [ ] **Step 6: 再跑 host 测试确认通过**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/host.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add cli/src/runner/sharedRuntime/host.ts cli/src/runner/sharedRuntime/workerFactory.ts cli/src/runner/sharedRuntime/resourcePolicy.ts cli/src/runner/sharedRuntime/host.test.ts cli/src/runner/run.ts
git commit -m "feat(cli): add shared runtime host foundation"
```

---

## Task 13: 定义 flavor adapter 边界与 fallback 策略

**Files:**
- Create: `cli/src/runner/sharedRuntime/adapters/base.ts`
- Create: `cli/src/runner/sharedRuntime/adapters/{claude,codex,cursor,gemini,opencode}.ts`
- Modify: 各 flavor runner 入口文件
- Test: `cli/src/runner/sharedRuntime/adapters/*.test.ts`

- [ ] **Step 1: 写 adapter contract 失败测试**

```ts
it.each(['claude', 'codex', 'cursor', 'gemini', 'opencode'] as const)(
    'provides shared runtime adapter contract for %s',
    (flavor) => {
        const adapter = createFlavorAdapter(flavor)

        expect(adapter.startSession).toBeTypeOf('function')
        expect(adapter.resumeSession).toBeTypeOf('function')
        expect(adapter.sendMessage).toBeTypeOf('function')
        expect(adapter.abort).toBeTypeOf('function')
        expect(adapter.terminate).toBeTypeOf('function')
    }
)
```

- [ ] **Step 2: 写 fallback 测试**

```ts
it('falls back to standalone runtime for unsupported adapter capabilities', async () => {
    const adapter = createFlavorAdapter('cursor')
    vi.spyOn(adapter, 'supportsSharedRuntime').mockReturnValue(false)

    const result = await startSessionWithRuntimeSelection({ flavor: 'cursor', sessionId: 'session-1' })

    expect(result.runtimeMode).toBe('standalone')
})
```

- [ ] **Step 3: 运行 adapter 测试确认失败**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/adapters`
Expected: FAIL，adapter contract 尚不存在。

- [ ] **Step 4: 定义统一 adapter 接口**

```ts
export interface FlavorAdapter {
    flavor: 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'
    supportsSharedRuntime(): boolean
    startSession(payload: Record<string, unknown>): Promise<void>
    resumeSession(payload: Record<string, unknown>): Promise<void>
    sendMessage(payload: Record<string, unknown>): Promise<void>
    abort(): Promise<void>
    terminate(): Promise<void>
}
```

- [ ] **Step 5: 为各 flavor 提供最小 adapter 壳**

```ts
export class ClaudeFlavorAdapter implements FlavorAdapter {
    flavor = 'claude' as const

    supportsSharedRuntime(): boolean {
        return true
    }

    async startSession(payload: Record<string, unknown>): Promise<void> {
        await startClaudeSession(payload)
    }

    async resumeSession(payload: Record<string, unknown>): Promise<void> {
        await resumeClaudeSession(payload)
    }

    async sendMessage(payload: Record<string, unknown>): Promise<void> {
        await sendClaudeMessage(payload)
    }

    async abort(): Promise<void> {
        await abortClaudeSession()
    }

    async terminate(): Promise<void> {
        await terminateClaudeSession()
    }
}
```

说明：其余 flavor 先做同构壳；若某 flavor 尚不满足 shared runtime 条件，`supportsSharedRuntime()` 返回 `false`，保持 standalone fallback。

- [ ] **Step 6: 再跑 adapter 测试确认通过**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/adapters`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add cli/src/runner/sharedRuntime/adapters cli/src/runner/sharedRuntime/adapters/*.test.ts cli/src/claude cli/src/codex cli/src/cursor cli/src/gemini cli/src/opencode
git commit -m "feat(cli): define shared runtime flavor adapters"
```

---

## Task 14: 实现 idle reclaim 与 resume 边界

**Files:**
- Modify: `cli/src/runner/sharedRuntime/host.ts`
- Modify: `cli/src/runner/sharedRuntime/resourcePolicy.ts`
- Modify: `cli/src/api/apiMachine.ts`
- Test: `cli/src/runner/sharedRuntime/host.test.ts`

- [ ] **Step 1: 写 idle reclaim 失败测试**

```ts
it('reclaims only idle workers that exceed the reclaim threshold', async () => {
    const host = buildHostWithWorker('session-a', { idleForMs: 11 * 60 * 1000, rssBytes: 10 })
    const activeHost = buildHostWithWorker('session-b', { idleForMs: 0, rssBytes: 10 })

    await host.reclaimIdleWorkers()
    await activeHost.reclaimIdleWorkers()

    expect(host.getSessionState('session-a')).toBe('terminated')
    expect(activeHost.getSessionState('session-b')).toBe('active')
})
```

- [ ] **Step 2: 写 resume 语义测试**

```ts
it('uses adapter resume when a reclaimed session is resumed', async () => {
    const adapter = buildFlavorAdapter({ flavor: 'claude' })
    const host = buildHost({ adapter })

    await host.resumeSession({ sessionId: 'session-a', flavor: 'claude', payload: { claudeSessionId: 'resume-token' } })

    expect(adapter.resumeSession).toHaveBeenCalledWith({ claudeSessionId: 'resume-token' })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/host.test.ts`
Expected: FAIL，host 尚未处理 reclaim/resume。

- [ ] **Step 4: 实现最小 reclaim 逻辑**

```ts
async reclaimIdleWorkers(): Promise<void> {
    for (const [sessionId, worker] of this.workers.entries()) {
        const snapshot = worker.getResourceSnapshot()
        if (!this.deps.resourcePolicy.shouldReclaimIdleWorker(snapshot)) {
            continue
        }

        await worker.terminate()
        this.sessionStates.set(sessionId, 'terminated')
        this.workers.delete(sessionId)
    }
}
```

- [ ] **Step 5: 实现 resume contract**

```ts
async resumeSession(command: WorkerResumeCommand): Promise<void> {
    const adapter = this.deps.adapterRegistry.get(command.flavor)
    await adapter.resumeSession(command.payload)
}
```

- [ ] **Step 6: 再跑测试确认通过**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime/host.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add cli/src/runner/sharedRuntime/host.ts cli/src/runner/sharedRuntime/resourcePolicy.ts cli/src/api/apiMachine.ts cli/src/runner/sharedRuntime/host.test.ts
git commit -m "feat(cli): add idle reclaim and resume boundaries"
```

---

## Task 15: 对比 baseline 与 shared runtime，验证收益与回退

**Files:**
- Modify: `cli/src/runner/sharedRuntime/baseline.ts` 或 `cli/scripts/measure-shared-runtime.ts`
- Test: `cli/src/runner/sharedRuntime/*.test.ts`
- Optional docs: `docs/superpowers/plans/implementation-artifacts/shared-runtime-baseline.md`

- [ ] **Step 1: 写性能结果结构测试**

```ts
it('reports before-and-after rss snapshots for each sampled session count', async () => {
    const report = await compareSharedRuntimePerformance({
        flavor: 'claude',
        sessionCounts: [1, 3, 5]
    })

    expect(report.before['1'].rssBytes).toBeGreaterThan(0)
    expect(report.after['1'].rssBytes).toBeGreaterThan(0)
    expect(report.before['5'].rssBytes).toBeGreaterThan(0)
    expect(report.after['5'].rssBytes).toBeGreaterThan(0)
})
```

- [ ] **Step 2: 写 fallback 验证测试**

```ts
it('keeps non-migrated flavors on standalone runtime without regression', async () => {
    const report = await compareSharedRuntimePerformance({
        flavor: 'opencode',
        sessionCounts: [1]
    })

    expect(report.runtimeMode).toBe('standalone')
})
```

- [ ] **Step 3: 运行 shared runtime 测试**

Run: `cd cli && bunx vitest run src/runner/sharedRuntime`
Expected: PASS

- [ ] **Step 4: 运行基线测量脚本**

Run:
```bash
cd cli && bun run scripts/measure-shared-runtime.ts --flavor claude --sessions 1,3,5
```
Expected: 输出至少包含：
- 单 session RSS
- 3 session RSS
- 5 session RSS
- idle reclaim 前后对比
- shared host 固定开销

- [ ] **Step 5: 记录结果并判断是否达标**

```md
## Shared runtime comparison
- flavor: claude
- session counts: 1, 3, 5
- before:
  - 1: ...
  - 3: ...
  - 5: ...
- after:
  - 1: ...
  - 3: ...
  - 5: ...
- idle reclaim: ...
- fixed host overhead: ...
- fallback flavors unchanged: yes
```

- [ ] **Step 6: Commit**

```bash
git add cli/src/runner/sharedRuntime cli/scripts/measure-shared-runtime.ts docs/superpowers/plans/implementation-artifacts/shared-runtime-baseline.md
git commit -m "test(cli): measure shared runtime memory behavior"
```

---

## Final verification checklist

- [ ] `#444` shared schema、hub route、web API client、web approval UI、CLI permission handler 都已支持 `contextAction`。
- [ ] `clear_context` 只清 execution context，不清 session record。
- [ ] 普通工具审批行为不变。
- [ ] 批量删除仅允许 inactive session。
- [ ] 批量删除后列表、详情、query cache、SSE 收敛一致。
- [ ] partial failure 会返回明确的成功/失败摘要。
- [ ] `#461` 有可运行的 baseline、shared host / worker / adapter contract、idle reclaim、resume、fallback。
- [ ] 至少一个 direct-fit flavor 完成 shared runtime 接入验证。
- [ ] 未迁移 flavor 仍可保持 standalone runtime，不回归。

## Recommended execution order

1. Task 1-6：完成 `#444` 审批闭环
2. Task 7-10：完成批量删除 inactive sessions
3. Task 11-15：完成 `#461` shared runtime 基线、架构骨架、渐进接入与验证

## Self-review

- 本计划保持了 spec 的 3 个范围，没有顺带加入 bulk backend API、archive bulk、permission system rewrite、shared runtime 全量一次性交付等超范围内容。
- `#444` 中 `contextAction` 的边界已明确：只清 plan continuation 的临时执行上下文，不清 session history / metadata / approval record。
- 批量删除 v1 先复用单删 route，不发明 bulk 协议；若串行体验不足，再在实现阶段把内部执行替换为受控并发，但不改变用户可见 contract。
- `#461` 先交付统一架构 contract、baseline 与基础设施，再按 flavor 渐进接入；这与 spec 的“架构覆盖全量、落地允许渐进”保持一致。
