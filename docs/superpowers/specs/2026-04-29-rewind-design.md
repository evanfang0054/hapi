# Rewind 功能设计文档

## 概述

在 HAPI Web 端实现 Claude Code 的 /rewind 功能，允许用户回退到对话历史中的某条用户消息，撤销之后的对话和文件变更。

## 约束

- **仅 Remote 模式**：Local 模式不支持 rewind
- **仅用户消息可作为回退点**：assistant 消息不能作为 rewind 目标
- **需要进程重启**：rewind 会短暂中断 Claude 进程（~2-3 秒）

## 方案

采用 **JSONL 截断 + --resume 重启** 方案：

1. 终止当前 Claude 进程
2. 截断 JSONL 文件到目标消息
3. 从 file-history-snapshot 恢复文件状态
4. 用 `--resume` 重启进程
5. 同步清理 Hub 中 rewind 之后的消息

## 模块设计

### CLI 端

#### 新增文件：`cli/src/claude/utils/rewind.ts`

职责：

- `buildMessageChain(jsonlPath)` — 读取 JSONL，构建 uuid/parentUuid 因果链
- `truncateJsonl(jsonlPath, targetUuid)` — 截断 JSONL 文件到目标消息（保留目标行）
- `findFileSnapshot(jsonlPath, targetUuid)` — 找到目标消息之前最近的 file-history-snapshot
- `applyFileSnapshot(snapshot)` — 将文件恢复到快照状态

#### RPC Handler 注册

在 `RemoteLauncherBase` 中新增 `rewind` handler 注册，与现有的 abort/switch 并列：

```
rpcHandlerManager.registerHandler('rewind', async (params) => {
    const { targetUuid } = params
    // 1. 设置 isRewinding = true（阻止新消息和权限请求）
    // 2. abort 当前 query iteration
    // 3. 等待进程停止
    // 4. 截断 JSONL 到 targetUuid
    // 5. 查找并应用 file-history-snapshot
    // 6. 设置 rewindTarget 标记
    // 7. 主循环自动重启（检测到 rewindTarget 后用 resume: sessionId 重启）
    // 8. isRewinding = false
})
```

#### 进程重启机制

复用 `claudeRemoteLauncher` 的主循环。主循环 `while (!this.exitReason)` 在 abort 后检测 `rewindTarget` 标记：
- 存在 → 用 `resume: sessionId` 调用 `claudeRemote()`，并传入截断后的 sessionId
- 不存在 → 正常退出

### Hub 端

#### 新增路由

```
POST /sessions/:id/rewind
Body: { targetSeq: number }
Guard: requireActive: true
```

#### SyncEngine 新增方法

```
rewindSession(sessionId, targetSeq):
    1. 查找 targetSeq 对应消息的 localId（即 JSONL 中的 uuid）
    2. 调用 rpcGateway.rewindSession(sessionId, targetUuid)
    3. 等待 RPC 成功
    4. 调用 deleteMessagesAfterSeq(db, sessionId, targetSeq)
    5. 更新 session.seq = targetSeq
    6. 清理 session.agentState.requests
    7. 推送 session-updated + messages-rewound sync event
```

#### RpcGateway 新增方法

```
rewindSession(sessionId, targetUuid):
    await sessionRpc(sessionId, 'rewind', { targetUuid })
```

#### 消息存储新增方法

`hub/src/store/messages.ts`:

```
deleteMessagesAfterSeq(db, sessionId, afterSeq):
    DELETE FROM messages WHERE session_id = ? AND seq > ?
```

### Web 端

#### API 客户端

`web/src/api/client.ts`:

```
rewindSession(sessionId, targetSeq):
    POST /api/sessions/${sessionId}/rewind
    Body: { targetSeq }
```

#### Mutation

`web/src/hooks/mutations/useRewindSession.ts`:

- 调用 `client.rewindSession(sessionId, targetSeq)`
- 成功后 invalidate `['messages', sessionId]` 查询缓存

#### UI 入口

在用户消息气泡上添加 rewind 按钮：
- 仅在 Remote 模式 + session 活跃时显示
- 移动端始终可见，桌面端 hover 显示（`md:opacity-0 md:group-hover:opacity-100`）
- 点击后弹出确认对话框："回退到这条消息？之后的对话和文件变更将被撤销。"
- Rewind 进行中显示 loading 状态

### Shared 协议

#### 新增 SyncEvent 类型

`shared/src/schemas.ts` 的 SyncEventSchema union 中新增：

```typescript
z.object({
    type: z.literal('messages-rewound'),
    sessionId: z.string(),
    targetSeq: z.number()
})
```

#### SSE 处理

`web/src/hooks/useSSE.ts` 新增 `messages-rewound` 事件处理：
- 清除当前消息缓存
- 从 targetSeq 开始重新获取消息

## 错误处理

| 场景 | 处理 |
|------|------|
| Claude 进程正在生成中 | 先 abort 等待停止，再执行 rewind |
| 有 pending 权限请求 | 先清理 pending requests，再执行 rewind |
| JSONL 文件不存在 | 返回错误，不执行 rewind |
| file-history-snapshot 不存在 | 只回退对话，跳过文件恢复（降级处理） |
| RPC 超时（30s） | 返回超时错误，状态不变 |
| Rewind 进行中收到新消息 | 拒绝消息 |

## 并发安全

- Rewind 操作期间设置 `isRewinding = true`
- 消息发送、权限审批等操作检查此标记，若为 true 则拒绝
- Rewind 完成后清除标记

## 需要修改的文件清单

| 层 | 文件 | 改动 |
|---|---|---|
| CLI | `cli/src/claude/utils/rewind.ts`（新建） | JSONL 截断 + 文件快照恢复 |
| CLI | `cli/src/modules/common/remote/RemoteLauncherBase.ts` | 注册 rewind RPC handler |
| CLI | `cli/src/claude/claudeRemoteLauncher.ts` | 主循环支持 rewind 重启 |
| CLI | `cli/src/claude/claudeRemote.ts` | 支持 rewind 触发的 resume |
| Hub | `hub/src/sync/rpcGateway.ts` | 新增 rewindSession 方法 |
| Hub | `hub/src/sync/syncEngine.ts` | 新增 rewindSession 方法 |
| Hub | `hub/src/web/routes/sessions.ts` | 新增 POST /sessions/:id/rewind |
| Hub | `hub/src/store/messages.ts` | 新增 deleteMessagesAfterSeq |
| Web | `web/src/api/client.ts` | 新增 rewindSession 方法 |
| Web | `web/src/hooks/mutations/useRewindSession.ts`（新建） | rewind mutation |
| Web | `web/src/hooks/useSSE.ts` | 处理 messages-rewound 事件 |
| Web | 聊天组件（消息气泡） | 添加 rewind 按钮 |
| Shared | `shared/src/schemas.ts` | 新增 messages-rewound sync event |
