# Rewind V2 — 自定义弹窗与多模式回撤

## 概述

在已实现的 rewind 基础功能上，增加两个改进：
1. 用自定义弹窗替代 `window.confirm()` 系统弹窗
2. 支持用户选择回撤范围：会话+文件、仅会话、仅文件

## 约束

- 仅 Remote 模式可用（不变）
- 仅用户消息可作为回退点（不变）
- 三种模式的回撤范围和副作用各不相同，需要用户明确选择

## RewindMode 定义

```typescript
type RewindMode = 'session-and-files' | 'session-only' | 'files-only'
```

| 模式 | 截断 JSONL | 恢复文件 | 删除 DB 消息 | Abort 进程 | 发 SSE 事件 |
|---|---|---|---|---|---|
| `session-and-files` | 是 | 是 | 是 | 是 | `messages-rewound` |
| `session-only` | 是 | 否 | 是 | 是 | `messages-rewound` |
| `files-only` | 否 | 是 | 否 | 否 | `files-rewound` |

## 模块设计

### 1. Web 端

#### 新建 `web/src/components/RewindDialog.tsx`

基于现有 `Dialog` / `DialogContent` 基础组件，构建卡片式单选弹窗：

- 顶部 rewind 图标 + 标题「回撤到这条消息」+ 副标题「选择回撤范围」
- 三个 radio card 选项：
  1. **会话 + 文件**（默认选中）— 回撤消息和 AI 修改的文件
  2. **仅会话** — 清除消息，不恢复文件，不触发 AI 重新处理
  3. **仅文件** — 仅恢复 AI 修改的文件
- 底部取消 + 确认回撤按钮（destructive 样式）
- 确认按钮在 loading 时显示 loading 态，禁用交互

Props：
```typescript
{
  isOpen: boolean
  onClose: () => void
  onConfirm: (mode: RewindMode) => Promise<void>
  isPending: boolean
}
```

#### 修改 `web/src/components/AssistantChat/messages/UserMessage.tsx`

- 移除 `window.confirm()` 调用
- 点击 Rewind 按钮时，调用 `ctx.onRewindRequest(seq)` 打开弹窗（而非直接执行 rewind）

#### 修改 `web/src/components/AssistantChat/context.tsx`

- `onRewindMessage` 保留（直接执行 rewind 的回调）
- 新增 `onRewindRequest?: (seq: number) => void`（打开弹窗的回调）

#### 修改 `web/src/components/SessionChat.tsx`

- 新增 state：`rewindTargetSeq: number | null`，控制 RewindDialog 的开关
- 新增 `handleRewindRequest(seq)`：设置 `rewindTargetSeq` 打开弹窗
- 修改 `handleRewind`：接收 `RewindMode` 参数，根据 mode 调用 API
- 传递 `onRewindRequest` 到 HappyThread context
- 渲染 `RewindDialog` 组件

#### 修改 `web/src/hooks/mutations/useSessionActions.ts`

- `rewindMutation` 的 mutation 参数从 `number` 改为 `{ targetSeq: number, mode: RewindMode }`
- 调用 `api.rewindSession(sessionId, targetSeq, mode)`

#### 修改 `web/src/api/client.ts`

- `rewindSession` 签名扩展：`rewindSession(sessionId: string, targetSeq: number, mode: RewindMode)`
- 请求体：`{ targetSeq, mode }`

#### 修改 `web/src/hooks/useSSE.ts`

- 新增 `files-rewound` 事件处理：刷新 session 详情（触发文件列表重新加载）

### 2. Shared 协议

#### 修改 `shared/src/schemas.ts`

- 新增 `files-rewound` SSE 事件 schema：
```typescript
z.object({
  type: z.literal('files-rewound'),
  sessionId: z.string(),
  targetSeq: z.number()
})
```

### 3. Hub 端

#### 修改 `hub/src/web/routes/sessions.ts`

- 请求体 schema 扩展：`{ targetSeq: z.number(), mode: z.enum(['session-and-files', 'session-only', 'files-only']) }`
- 将 mode 传递给 `engine.rewindSession()`

#### 修改 `hub/src/sync/syncEngine.ts`

`rewindSession` 增加 `mode` 参数，按模式分支：

- `session-and-files`：现有逻辑不变
- `session-only`：
  1. 提取用户消息文本 + occurrence
  2. RPC 到 CLI 传 `{ mode: 'session-only', ... }`
  3. 删除 DB 消息（`deleteMessagesFromSeq`）
  4. 刷新 session，不 reactivate
  5. 发 `messages-rewound` 事件
- `files-only`：
  1. 提取用户消息文本 + occurrence
  2. RPC 到 CLI 传 `{ mode: 'files-only', ... }`
  3. 不删除 DB 消息
  4. 发 `files-rewound` 事件

#### 修改 `hub/src/sync/rpcGateway.ts`

- `rewindSession` params 增加 `mode` 字段

### 4. CLI 端

#### 修改 `cli/src/modules/common/remote/RemoteLauncherBase.ts`

- `RemoteLauncherRewindHandler.onRewind` params 增加 `mode` 字段
- RPC handler 透传 mode

#### 修改 `cli/src/claude/claudeRemoteLauncher.ts`

按 mode 分支处理：

- `session-and-files`：现有逻辑不变（abort → capture snapshots → truncate JSONL → restore files）
- `session-only`：abort → truncate JSONL，不恢复文件
- `files-only`：只做 snapshot 查找 + 文件恢复，不截断 JSONL，不 abort 当前查询

## 错误处理

| 场景 | 处理 |
|---|---|
| 弹窗打开期间收到新消息 | 不影响，rewind 操作只在确认后执行 |
| files-only 时 AI 正在编辑同一文件 | 静默恢复，可能出现冲突（用户主动选择） |
| session-only 后会话状态 | 会话停留在 idle，AI 不自动重新处理 |
| mode 参数缺失或无效 | Hub 返回 400 错误 |

## 需要修改的文件清单

| 层 | 文件 | 改动 |
|---|---|---|
| Web | `web/src/components/RewindDialog.tsx`（新建） | 卡片式单选弹窗组件 |
| Web | `web/src/components/AssistantChat/messages/UserMessage.tsx` | 移除 window.confirm，改用 onRewindRequest |
| Web | `web/src/components/AssistantChat/context.tsx` | 新增 onRewindRequest 类型 |
| Web | `web/src/components/SessionChat.tsx` | 新增 rewindTargetSeq state，渲染 RewindDialog |
| Web | `web/src/hooks/mutations/useSessionActions.ts` | mutation 参数扩展 mode |
| Web | `web/src/api/client.ts` | API 参数扩展 mode |
| Web | `web/src/hooks/useSSE.ts` | 新增 files-rewound 事件处理 |
| Shared | `shared/src/schemas.ts` | 新增 files-rewound 事件 schema |
| Hub | `hub/src/web/routes/sessions.ts` | 请求体增加 mode |
| Hub | `hub/src/sync/syncEngine.ts` | rewindSession 按 mode 分支 |
| Hub | `hub/src/sync/rpcGateway.ts` | 透传 mode |
| CLI | `cli/src/modules/common/remote/RemoteLauncherBase.ts` | 类型扩展增加 mode |
| CLI | `cli/src/claude/claudeRemoteLauncher.ts` | 按 mode 分支处理 |
