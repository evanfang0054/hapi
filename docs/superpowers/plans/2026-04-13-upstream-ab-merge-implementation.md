# Upstream A/B 档功能融合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以当前项目实现为主，在不回退 continuity / visibility / notifications / i18n / UI 行为的前提下，分批融合 upstream 的 A 档稳定性增强与 B 档体验增强能力。

**Architecture:** 采用“迁移修复意图，不迁移 upstream 文件形态”的策略。A 档先处理安全、连接稳定性、认证、SSE 与上传兼容；B 档再扩展 markdown 渲染、消息复制、状态栏任务计数和 composer/mobile 体验。所有改动都沿用当前 monorepo 的既有边界：`cli/` 处理本地 runner 安全，`hub/` 处理 token/CORS/socket/server 行为，`web/` 处理 SSE、terminal socket、markdown、消息与状态栏 UI。

**Tech Stack:** Bun, Hono, Socket.IO, React 19, TanStack Query, assistant-ui, Vitest, bun:test, remark/rehype/KaTeX。

---

## File Structure

### A 档会修改的文件
- `cli/src/opencode/opencodeLocal.ts` — OpenCode 本地启动参数与 Windows `sessionId` 安全校验。
- `hub/src/socket/terminalRegistry.ts` — terminal register/re-register 规则与 stale entry 清理。
- `hub/src/socket/handlers/terminal.ts` — terminal quota 与 reconnect 场景的 handler 行为。
- `hub/src/socket/handlers/terminal.test.ts` — terminal reconnect、quota、stale entry 测试。
- `web/src/hooks/useTerminalSocket.ts` — terminal namespace 连接方式与 reconnect 保持。
- `hub/src/web/routes/auth.ts` — `/auth` JWT 生命周期。
- `hub/src/web/routes/bind.ts` — `/bind` JWT 生命周期。
- `web/src/hooks/useAuth.ts` — 继续沿用现有 refresh 机制，只校准与 server token TTL 的契合。
- `web/src/hooks/useSSE.ts` — visibility 恢复时的 stale reconnect 入口。
- `web/src/components/ReconnectingBanner.tsx` — `visibility-recovery` 原因文案映射。
- `web/src/lib/locales/en.ts` — 新增 reconnect reason 文案。
- `web/src/lib/locales/zh-CN.ts` — 新增 reconnect reason 文案。
- `hub/src/web/server.ts` — PATCH CORS 与请求体大小限制。

### B 档会修改的文件
- `web/src/components/assistant-ui/markdown-text.tsx` — KaTeX/LaTeX markdown 渲染插件接入点。
- `web/src/components/AssistantChat/messages/AssistantMessage.tsx` — assistant message copy action。
- `web/src/components/AssistantChat/StatusBar.tsx` — background task count 状态项。
- `web/src/components/SessionChat.tsx` — 为 composer/mobile 行为改造提供现有 send flow 入口。
- `web/src/components/AssistantChat/HappyComposer.tsx` — Enter / modifier+Enter / 运行中发送策略主入口。
- `web/src/lib/locales/en.ts` — B 档新增 UI 文案。
- `web/src/lib/locales/zh-CN.ts` — B 档新增 UI 文案。

### 预计新增文件
- `web/src/hooks/useTerminalSocket.test.ts` — terminal namespace / reconnect 行为单测。
- `web/src/hooks/useSSE.test.ts` — visibility stale recovery 单测。
- `web/src/components/assistant-ui/markdown-text.test.tsx` — 数学公式渲染与 fallback 测试。
- `web/src/components/AssistantChat/messages/AssistantMessage.test.tsx` — copy button 与复制文本测试。
- `web/src/components/AssistantChat/StatusBar.test.tsx` — background task count 展示测试。
- `web/src/components/AssistantChat/HappyComposer.test.tsx` — Enter / modifier+Enter / running 时发送策略测试。

### 执行时还需要对照阅读的文件
- `docs/superpowers/specs/2026-04-13-upstream-ab-merge-design.md`
- `web/src/hooks/useSSE.ts`
- `web/src/hooks/useAuth.ts`
- `hub/src/socket/handlers/terminal.ts`
- `web/src/components/AssistantChat/HappyThread.tsx`
- `web/src/types/api.ts`

---

### Task 1: A 档第 1 批——合入 Windows command injection 防护与 PATCH CORS 修复

**Files:**
- Modify: `cli/src/opencode/opencodeLocal.ts`
- Modify: `hub/src/web/server.ts`
- Test: `bun run typecheck:cli`
- Test: `bun run test:hub`

- [x] **Step 1: 先写出 Windows `sessionId` 校验测试或失败用例说明**

如果 `cli` 现有测试目录没有覆盖 `opencodeLocal`，先新增最小测试文件 `cli/src/opencode/opencodeLocal.test.ts`，至少覆盖 Windows 非法字符会抛错：

```ts
it('rejects unsafe sessionId on win32', async () => {
  const originalPlatform = process.platform
  Object.defineProperty(process, 'platform', { value: 'win32' })

  await expect(opencodeLocal({
    path: '/tmp/project',
    abort: new AbortController().signal,
    env: {},
    sessionId: 'abc&def'
  })).rejects.toThrow('Invalid sessionId')

  Object.defineProperty(process, 'platform', { value: originalPlatform })
})
```

- [x] **Step 2: 跑 CLI 定向测试或 typecheck，确认当前还没有防护**

Run: `bun run typecheck:cli`
Expected: PASS（如果先写测试则再跑对应测试，预期 FAIL，因为当前不会拒绝非法 `sessionId`）。

- [x] **Step 3: 在 `opencodeLocal.ts` 加入最小 Windows 特殊字符校验**

把现有：

```ts
if (opts.sessionId) {
    args.push('--session', opts.sessionId);
}
```

改为：

```ts
if (opts.sessionId) {
    if (process.platform === 'win32' && /[&|<>^()%!"\r\n]/u.test(opts.sessionId)) {
        throw new Error('Invalid sessionId');
    }
    args.push('--session', opts.sessionId);
}
```

- [x] **Step 4: 为 CORS allowMethods 增加 PATCH**

把 `hub/src/web/server.ts` 中：

```ts
allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
```

改为：

```ts
allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
```

- [x] **Step 5: 跑受影响校验**

Run: `bun run typecheck:cli && bun run test:hub`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add cli/src/opencode/opencodeLocal.ts hub/src/web/server.ts cli/src/opencode/opencodeLocal.test.ts
git commit -m "fix: harden opencode session ids and allow patch cors"
```

---

### Task 2: A 档第 2 批——融合 terminal reconnect re-register 与 namespace 连接修复

**Files:**
- Modify: `hub/src/socket/terminalRegistry.ts`
- Modify: `hub/src/socket/handlers/terminal.ts`
- Modify: `hub/src/socket/handlers/terminal.test.ts`
- Modify: `web/src/hooks/useTerminalSocket.ts`
- Create: `web/src/hooks/useTerminalSocket.test.ts`
- Test: `hub/src/socket/handlers/terminal.test.ts`
- Test: `web/src/hooks/useTerminalSocket.test.ts`

- [ ] **Step 1: 在 hub terminal handler 测试里先写 reconnect 场景**

向 `hub/src/socket/handlers/terminal.test.ts` 增加两个失败测试：

```ts
it('re-registers a terminal when same session reconnects with a new socket', () => {
  const registry = new TerminalRegistry({ idleTimeoutMs: 0 })

  const first = registry.register('terminal-1', 'session-1', 'socket-1', 'cli-1')
  expect(first).not.toBeNull()

  const second = registry.register('terminal-1', 'session-1', 'socket-2', 'cli-1')
  expect(second?.socketId).toBe('socket-2')
  expect(registry.get('terminal-1')?.socketId).toBe('socket-2')
})

it('keeps rejecting terminal reuse across different sessions', () => {
  const registry = new TerminalRegistry({ idleTimeoutMs: 0 })
  registry.register('terminal-1', 'session-1', 'socket-1', 'cli-1')

  const second = registry.register('terminal-1', 'session-2', 'socket-2', 'cli-1')
  expect(second).toBeNull()
})
```

- [ ] **Step 2: 跑 hub terminal 测试确认失败**

Run: `bun test hub/src/socket/handlers/terminal.test.ts`
Expected: FAIL，因为当前 `register()` 见到重复 `terminalId` 会直接返回 `null`。

- [ ] **Step 3: 在 `terminalRegistry.ts` 实现 stale entry 替换规则**

把 `register()` 改成三段逻辑：

```ts
const existing = this.terminals.get(terminalId)
if (existing) {
    if (existing.socketId === socketId) {
        this.scheduleIdle(existing)
        return existing
    }
    if (existing.sessionId === sessionId) {
        this.remove(terminalId)
    } else {
        return null
    }
}
```

然后再创建并索引新的 `entry`。不要改动索引结构、idle timeout 行为和对外类型。

- [ ] **Step 4: 在 `terminal.ts` 调整 reconnect 场景 quota 判断**

将 quota check 改成先取 existing entry，再在 same-session reconnect 时放行：

```ts
const existing = terminalRegistry.get(terminalId)
const isReconnectReplace = existing && existing.sessionId === sessionId && existing.socketId !== socket.id

if (!isReconnectReplace && terminalRegistry.countForSocket(socket.id) >= maxTerminalsPerSocket) {
  // emit existing too many terminals error
}
```

session 级 quota 同理：same-session stale reconnect 不应被旧 entry 误伤。

- [ ] **Step 5: 为 `useTerminalSocket` 先写 namespace 构造测试**

在 `web/src/hooks/useTerminalSocket.test.ts` 写最小测试，断言使用 `Manager(baseUrl).socket('/terminal')`，同时保留 `path: '/socket.io/'` 与现有 reconnect 参数：

```ts
expect(createSocketArgs).toEqual({
  namespace: '/terminal',
  baseUrl: 'http://localhost:3000',
  path: '/socket.io/'
})
```

- [ ] **Step 6: 修改 `useTerminalSocket.ts` 的 socket 创建方式**

把现有：

```ts
const socket = io(`${baseUrlRef.current}/terminal`, {
```

替换为：

```ts
const manager = new Manager(baseUrlRef.current, {
    path: '/socket.io/',
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['polling', 'websocket'],
    autoConnect: false,
    auth: { token }
})
const socket = manager.socket('/terminal', {
    auth: { token }
})
```

如果 `socket.io-client` 当前类型签名要求把大部分参数放在 `Manager` 上，只保留 namespace 级 `auth` 在 `socket()` 第二个参数里。不要改动外部 `connect/write/resize/disconnect/onOutput/onExit` API。

- [ ] **Step 7: 跑 terminal 相关测试**

Run: `bun test hub/src/socket/handlers/terminal.test.ts && bunx vitest run web/src/hooks/useTerminalSocket.test.ts`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add hub/src/socket/terminalRegistry.ts hub/src/socket/handlers/terminal.ts hub/src/socket/handlers/terminal.test.ts web/src/hooks/useTerminalSocket.ts web/src/hooks/useTerminalSocket.test.ts
git commit -m "fix: preserve terminal reconnects across stale sockets"
```

---

### Task 3: A 档第 3 批——调整 auth token 生命周期并增加 SSE visibility recovery

**Files:**
- Modify: `hub/src/web/routes/auth.ts`
- Modify: `hub/src/web/routes/bind.ts`
- Modify: `web/src/hooks/useAuth.ts`
- Modify: `web/src/hooks/useSSE.ts`
- Modify: `web/src/components/ReconnectingBanner.tsx`
- Modify: `web/src/lib/locales/en.ts`
- Modify: `web/src/lib/locales/zh-CN.ts`
- Create: `web/src/hooks/useSSE.test.ts`
- Test: `web/src/hooks/useSSE.test.ts`
- Test: `bun run typecheck:web`

- [ ] **Step 1: 先写 SSE visibility stale recovery 失败测试**

在 `web/src/hooks/useSSE.test.ts` 增加测试：页面从 hidden 切到 visible 且 `lastActivityAtRef` 超过阈值时，应触发 `requestReconnect('visibility-recovery')`。

```ts
it('reconnects immediately when page becomes visible and stream is stale', () => {
  // mount hook with mocked EventSource and stale last activity
  // dispatch visibilitychange to visible
  expect(onDisconnect).toHaveBeenCalledWith('visibility-recovery')
})
```

- [ ] **Step 2: 跑 web 定向测试确认失败**

Run: `bunx vitest run web/src/hooks/useSSE.test.ts`
Expected: FAIL，因为当前只有 watchdog 定时检查，没有 visibility 恢复入口。

- [ ] **Step 3: 把 `/auth` 与 `/bind` 的 JWT TTL 从 15m 调整到 4h**

在 `hub/src/web/routes/auth.ts` 与 `hub/src/web/routes/bind.ts` 都把：

```ts
.setExpirationTime('15m')
```

改为：

```ts
.setExpirationTime('4h')
```

- [ ] **Step 4: 保持 `useAuth.ts` 现有 refresh 结构，只确认恢复策略不被改坏**

在 `web/src/hooks/useAuth.ts` 中保留现有：

```ts
void refreshAuth({ minTtlMs: 60_000 })
```

如果 implementation 中发现有额外 `force: true` 或 focus 时无条件刷新，删掉它们，最终保留 `minTtlMs: 60_000`。不要覆盖 `refreshPromiseRef / tokenRef / onUnauthorized` 机制。

- [ ] **Step 5: 在 `useSSE.ts` 增加 `visibilitychange` 恢复入口**

在包含 `requestReconnect` 的 effect 内增加：

```ts
const handleVisibilityChange = () => {
    if (getVisibilityState() !== 'visible') {
        return
    }
    if (Date.now() - lastActivityAtRef.current < HEARTBEAT_STALE_MS) {
        return
    }
    requestReconnect('visibility-recovery')
}

document.addEventListener('visibilitychange', handleVisibilityChange)
return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    // existing cleanup...
}
```

- [ ] **Step 6: 给 banner 与 locale 增加 `visibility-recovery` 文案**

在 `web/src/components/ReconnectingBanner.tsx` 增加：

```ts
if (reason === 'visibility-recovery') {
    return t('reconnecting.reason.visibilityRecovery')
}
```

在 locale 中补齐：

```ts
'reconnecting.reason.visibilityRecovery': 'Recovered after returning to the page',
```

```ts
'reconnecting.reason.visibilityRecovery': '返回页面后恢复连接',
```

- [ ] **Step 7: 跑 web 校验**

Run: `bunx vitest run web/src/hooks/useSSE.test.ts && bun run typecheck:web`
Expected: PASS。

- [ ] **Step 8: 做真实回归验证**

Run: `bun run dev`
Expected: hub + web 都启动成功。然后手动验证：
1. 登录 Web。
2. 打开一个 session，确认 SSE 正常收消息。
3. 将 tab 切到后台超过 90 秒，再切回前台。
4. 观察 banner 显示 reconnect，随后自动恢复。
5. 登录态不应因为后台恢复而掉线。

- [ ] **Step 9: Commit**

```bash
git add hub/src/web/routes/auth.ts hub/src/web/routes/bind.ts web/src/hooks/useAuth.ts web/src/hooks/useSSE.ts web/src/hooks/useSSE.test.ts web/src/components/ReconnectingBanner.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "fix: stabilize auth expiry and sse foreground recovery"
```

---

### Task 4: A 档第 4 批——提升上传兼容性但不回退现有附件 UI

**Files:**
- Modify: `hub/src/web/server.ts`
- Inspect/Modify if needed: `web/src/components/AssistantChat/AttachmentItem.tsx`
- Test: `bun run test:hub`
- Test: `bun run typecheck:web`

- [ ] **Step 1: 先定位当前上传限制值**

检查 `hub/src/web/server.ts` 的：

```ts
maxRequestBodySize: socketHandler.maxRequestBodySize,
```

如果 upstream 仅通过 server 端放宽 body size，就在这里做最小覆盖，而不是改附件 UI。

- [ ] **Step 2: 写出要实现的最小 server 侧改动**

把 `maxRequestBodySize` 改成保底更大的值，例如：

```ts
maxRequestBodySize: Math.max(socketHandler.maxRequestBodySize, 1024 * 1024 * 20),
```

如果 upstream 提交中有明确数值，执行时使用 upstream 的数值；不要自行再扩展为配置项。

- [ ] **Step 3: 仅在前端确有兼容缺口时补最小逻辑**

若 `AttachmentItem` 或上传 flow 因服务端响应变化需要兼容，再写最小补丁；否则不改 UI、不重排附件卡片。

- [ ] **Step 4: 跑受影响校验**

Run: `bun run test:hub && bun run typecheck:web`
Expected: PASS。

- [ ] **Step 5: 做真实上传回归**

Run: `bun run dev`
Expected: 本地开发服务可用。然后手动上传一个明显大于之前阈值、但仍在合理范围内的附件，确认：
1. 上传成功；
2. 附件 UI 不变化；
3. session continuity / toast / push 不受影响。

- [ ] **Step 6: Commit**

```bash
git add hub/src/web/server.ts web/src/components/AssistantChat/AttachmentItem.tsx
git commit -m "fix: raise upload body limit without changing attachment ui"
```

---

### Task 5: B 档第 1 批——在当前 markdown renderer 链路接入 KaTeX/LaTeX

**Files:**
- Modify: `web/src/components/assistant-ui/markdown-text.tsx`
- Modify: `web/package.json`
- Create: `web/src/components/assistant-ui/markdown-text.test.tsx`
- Test: `web/src/components/assistant-ui/markdown-text.test.tsx`
- Test: `bun run typecheck:web`

- [ ] **Step 1: 先写消息公式渲染测试**

在 `web/src/components/assistant-ui/markdown-text.test.tsx` 覆盖三类场景：

```tsx
it('renders inline math without breaking normal markdown', () => {
  // renders text with $a^2+b^2=c^2$
})

it('renders block math', () => {
  // renders $$\int_0^1 x dx$$
})

it('keeps code fences as code instead of math', () => {
  // renders ```$not-math$```
})
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `bunx vitest run web/src/components/assistant-ui/markdown-text.test.tsx`
Expected: FAIL，因为当前只有 `remarkGfm`。

- [ ] **Step 3: 安装并接入 remark/rehype KaTeX 插件**

在 `web/package.json` 增加依赖：

```json
{
  "remark-math": "latest",
  "rehype-katex": "latest",
  "katex": "latest"
}
```

在 `markdown-text.tsx` 把：

```ts
export const MARKDOWN_PLUGINS = [remarkGfm]
```

改为：

```ts
export const MARKDOWN_PLUGINS = [remarkGfm, remarkMath]
```

并把 `MarkdownTextPrimitive` 改为：

```tsx
<MarkdownTextPrimitive
  remarkPlugins={MARKDOWN_PLUGINS}
  rehypePlugins={[rehypeKatex]}
  components={defaultComponents}
  className={cn('aui-md min-w-0 max-w-full break-words text-base')}
/>
```

同时在 web 入口或该组件旁引入：

```ts
import 'katex/dist/katex.min.css'
```

- [ ] **Step 4: 为渲染失败保留可读 fallback**

如果测试发现 KaTeX 异常会直接抛错，则在 markdown 渲染边界加最小 try/catch fallback，最终保证最差也显示原始文本，不要改消息数据结构。

- [ ] **Step 5: 跑 web 测试与 typecheck**

Run: `bunx vitest run web/src/components/assistant-ui/markdown-text.test.tsx && bun run typecheck:web`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/src/components/assistant-ui/markdown-text.tsx web/src/components/assistant-ui/markdown-text.test.tsx
git commit -m "feat: add katex support to markdown messages"
```

---

### Task 6: B 档第 2 批——在当前 `HappyAssistantMessage` 结构里增加 copy button

**Files:**
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`
- Create: `web/src/components/AssistantChat/messages/AssistantMessage.test.tsx`
- Modify: `web/src/lib/locales/en.ts`
- Modify: `web/src/lib/locales/zh-CN.ts`
- Test: `web/src/components/AssistantChat/messages/AssistantMessage.test.tsx`

- [ ] **Step 1: 先写复制行为测试**

在 `AssistantMessage.test.tsx` 覆盖：

```tsx
it('shows copy action for assistant text messages', () => {
  // render assistant message and assert copy button exists
})

it('copies readable assistant text without tool metadata', async () => {
  // click copy button and assert clipboard receives plain rendered text
})

it('does not break tool-only layout', () => {
  // render tool-only message and assert existing root class remains usable
})
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `bunx vitest run web/src/components/AssistantChat/messages/AssistantMessage.test.tsx`
Expected: FAIL，因为当前没有 copy action。

- [ ] **Step 3: 在 `AssistantMessage.tsx` 增加最小 copy action**

保持当前卡片结构不变，在 message card 右上角增加按钮，伪代码如下：

```tsx
<div className="relative w-full max-w-[min(82ch,100%)] ...">
  {copyableText ? (
    <button
      type="button"
      className="absolute right-3 top-3 ..."
      onClick={() => copy(copyableText)}
      aria-label={t('assistant.copy')}
      title={t('assistant.copy')}
    >
      {copied ? <CheckIcon ... /> : <CopyIcon ... />}
    </button>
  ) : null}
  <MessagePrimitive.Content components={MESSAGE_PART_COMPONENTS} />
</div>
```

其中 `copyableText` 只从文本 part 提取：

```ts
const copyableText = useAssistantState(({ message }) =>
  message.role !== 'assistant'
    ? ''
    : message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n\n')
)
```

- [ ] **Step 4: 增加文案**

在 locale 中补：

```ts
'assistant.copy': 'Copy assistant message'
```

```ts
'assistant.copy': '复制助手消息'
```

- [ ] **Step 5: 跑测试**

Run: `bunx vitest run web/src/components/AssistantChat/messages/AssistantMessage.test.tsx`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add web/src/components/AssistantChat/messages/AssistantMessage.tsx web/src/components/AssistantChat/messages/AssistantMessage.test.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "feat: add assistant message copy action"
```

---

### Task 7: B 档第 3 批——把 background task count 接入当前 StatusBar 信息体系

**Files:**
- Modify: `web/src/components/AssistantChat/StatusBar.tsx`
- Modify: `web/src/components/SessionChat.tsx`
- Create: `web/src/components/AssistantChat/StatusBar.test.tsx`
- Modify: `web/src/lib/locales/en.ts`
- Modify: `web/src/lib/locales/zh-CN.ts`
- Test: `web/src/components/AssistantChat/StatusBar.test.tsx`

- [ ] **Step 1: 先写状态栏计数测试**

在 `StatusBar.test.tsx` 增加：

```tsx
it('shows background task count as a secondary status item', () => {
  render(<StatusBar ... backgroundTaskCount={3} />)
  expect(screen.getByText('3 tasks')).toBeInTheDocument()
})

it('does not render task count when count is zero', () => {
  render(<StatusBar ... backgroundTaskCount={0} />)
  expect(screen.queryByText(/tasks/)).toBeNull()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bunx vitest run web/src/components/AssistantChat/StatusBar.test.tsx`
Expected: FAIL，因为当前 `StatusBar` 没有 `backgroundTaskCount` prop。

- [ ] **Step 3: 从 `SessionChat.tsx` 把现有 `pendingCount` 传给状态栏**

若当前 `pendingCount` 已表示后台任务/待处理数量，则直接透传，不新增数据源：

```tsx
<StatusBar
  ...
  backgroundTaskCount={props.pendingCount}
/>
```

如果 `pendingCount` 语义并不等于后台任务数，执行时再沿当前数据流向上追踪真实任务计数来源，但不要先重构状态树。

- [ ] **Step 4: 在 `StatusBar.tsx` 添加次级状态项**

新增 prop：

```ts
backgroundTaskCount?: number
```

并在右侧状态组中追加：

```tsx
{props.backgroundTaskCount && props.backgroundTaskCount > 0 ? (
  <span className="text-xs text-[var(--app-hint)]">
    {t('status.backgroundTasks', { count: props.backgroundTaskCount })}
  </span>
) : null}
```

放在 collaboration / permission 旁边，不替换连接状态，不改整体布局。

- [ ] **Step 5: 增加 locale**

```ts
'status.backgroundTasks': '{count} tasks'
```

```ts
'status.backgroundTasks': '{count} 个后台任务'
```

- [ ] **Step 6: 跑测试**

Run: `bunx vitest run web/src/components/AssistantChat/StatusBar.test.tsx`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add web/src/components/AssistantChat/StatusBar.tsx web/src/components/AssistantChat/StatusBar.test.tsx web/src/components/SessionChat.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "feat: surface background task count in status bar"
```

---

### Task 8: B 档第 4 批——最后评估并合入 composer / mobile keyboard 行为增强

**Files:**
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/components/SessionChat.tsx`
- Create: `web/src/components/AssistantChat/HappyComposer.test.tsx`
- Test: `web/src/components/AssistantChat/HappyComposer.test.tsx`
- Test: `bun run typecheck:web`

- [ ] **Step 1: 先把当前 composer 键盘行为测住**

在 `HappyComposer.test.tsx` 先写出三类测试：

```tsx
it('sends on Enter', async () => {
  // type text and press Enter
  expect(onSend).toHaveBeenCalledWith('hello')
})

it('inserts newline on modifier+Enter', async () => {
  // press Shift+Enter or Meta/Ctrl+Enter per current UX decision
  expect(textarea).toHaveValue('hello\n')
})

it('preserves draft persistence while agent is running', async () => {
  // rerender with thinking=true and verify draft is retained
})
```

- [ ] **Step 2: 运行测试确认当前行为基线**

Run: `bunx vitest run web/src/components/AssistantChat/HappyComposer.test.tsx`
Expected: 如果当前没有测试文件则先 FAIL；补完当前基线后再继续。

- [ ] **Step 3: 只实现已在 spec 中确认的行为规则**

按下列顺序做最小改动：
1. Enter 发送；
2. modifier+Enter 插入换行；
3. 如果设计确认允许 running 中继续发送，则只放开发送禁用条件，不动 draft persistence；
4. 如果有移动端键盘遮挡问题，再补 viewport/scroll 最小修复。

关键代码形态应类似：

```ts
if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
  event.preventDefault()
  submit()
  return
}
```

```ts
if (event.key === 'Enter' && (event.shiftKey || event.metaKey || event.ctrlKey)) {
  return
}
```

只在 `HappyComposer` 本地处理，不重写 `SessionChat` send flow。

- [ ] **Step 4: 跑测试与真实回归**

Run: `bunx vitest run web/src/components/AssistantChat/HappyComposer.test.tsx && bun run typecheck:web`
Expected: PASS。

手动验证：
1. 输入草稿后切 session 再切回，draft 仍在；
2. thinking 中若允许发送，新消息可发出；
3. 移动端模拟视口下输入区不被键盘遮挡。

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AssistantChat/HappyComposer.tsx web/src/components/AssistantChat/HappyComposer.test.tsx web/src/components/SessionChat.tsx
git commit -m "feat: refine composer keyboard behavior"
```

---

## Verification Checklist

### A 档完成后必须回归
- [ ] `bun run typecheck:cli`
- [ ] `bun run typecheck:web`
- [ ] `bun run test:hub`
- [ ] `bunx vitest run web/src/hooks/useTerminalSocket.test.ts web/src/hooks/useSSE.test.ts`
- [ ] 手动验证 terminal：刷新、断网、切后台恢复后可重连，且不再出现 `already in use`
- [ ] 手动验证 auth：长时间后台恢复不会轻易掉登录
- [ ] 手动验证 SSE：后台 stale 后切回前台能立即恢复
- [ ] 手动验证上传：较大附件上传成功且 UI 不变
- [ ] 手动回归 continuity / draft persistence / visibility tracking / toast / push / notification dedupe / i18n

### B 档完成后必须回归
- [ ] `bun run typecheck:web`
- [ ] `bunx vitest run web/src/components/assistant-ui/markdown-text.test.tsx web/src/components/AssistantChat/messages/AssistantMessage.test.tsx web/src/components/AssistantChat/StatusBar.test.tsx web/src/components/AssistantChat/HappyComposer.test.tsx`
- [ ] 手动验证公式渲染、代码块、tool card 不回退
- [ ] 手动验证 assistant copy 复制内容正确、布局不乱
- [ ] 手动验证 background task count 只作次级状态显示
- [ ] 手动验证 composer/mobile 行为不破坏 draft persistence 与 continuity

## Risk Notes
- `web/src/hooks/useSSE.ts`、`web/src/hooks/useAuth.ts`、`web/src/hooks/useTerminalSocket.ts` 都是当前仓库深度定制区，禁止整体覆盖 upstream 文件。
- `hub/src/socket/terminalRegistry.ts` 的索引结构与 idle timer 必须保留；只改 `register()` 判定。
- `web/src/components/AssistantChat/StatusBar.tsx` 只能追加状态项，不能改主状态信息优先级。
- `HappyComposer` 是 continuity / draft persistence 高耦合区，必须最后处理。
- 若某个 upstream patch 需要大段冲突解决，则改为手工移植，不要继续 cherry-pick。

## Self-Review
- Spec coverage：A1-A7 与 B1-B4 全部映射到 Task 1-8，无缺项。
- Placeholder scan：没有使用 TBD/TODO/“后续再说”之类占位描述。
- Type consistency：统一使用 `visibility-recovery`、`backgroundTaskCount`、`sessionId`、`terminalId` 等命名。
