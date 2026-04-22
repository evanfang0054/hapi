# Session Rewind (消息回撤与文件恢复) 设计规范

## 概述

实现 Web 端会话回撤功能，允许用户将会话回滚到指定的用户消息点，同时恢复文件到该时间点的快照状态。

## 问题背景

用户在使用 Claude Code 进行编码时，有时需要撤销 AI 的操作：
- AI 修改的文件不符合预期
- 想尝试不同的实现路径
- 需要回到某个"已知正确"的状态重新开始

## 功能范围

### In Scope
- 文件回滚：恢复到指定消息点的文件快照
- 消息截断：删除指定消息之后的所有消息记录
- 仅支持 Remote 模式（Web 端控制的会话）

### Out of Scope
- Local 模式（终端交互模式）不支持
- Bash 命令执行的副作用无法回滚（Claude Code SDK 限制）
- Git 操作无法回滚

## 技术约束

### Claude Code SDK File Checkpointing

官方文档描述的功能：
- 启用方式：`enableFileCheckpointing: true`
- 恢复 API：`await query.rewindFiles(userMessageUuid)`
- **限制**：仅跟踪 Write/Edit/NotebookEdit 工具产生的文件变更，不包括 Bash 命令

### Claude Code Control Protocol

Claude Code CLI 支持通过 stdin/stdout 的 stream-json 协议发送控制请求。

**rewind_files 请求格式：**
```json
{
  "type": "control_request",
  "request_id": "unique-id",
  "request": {
    "subtype": "rewind_files",
    "user_message_id": "message-uuid",
    "dry_run": false
  }
}
```

**响应格式：**
```json
{
  "type": "control_response",
  "response": {
    "subtype": "success",
    "request_id": "xxx",
    "response": {
      "canRewind": true,
      "filesChanged": ["file1.ts"],
      "insertions": 10,
      "deletions": 5
    }
  }
}
```

### File Checkpointing 启用条件

Claude Code 内部通过环境变量控制 SDK 模式下的文件检查点：
- `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1` 启用
- `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING=1` 禁用

HAPI 需要在 spawn 时设置环境变量启用此功能。

### 现有架构依赖

- Hub 通过 Socket.IO RPC 调用 CLI
- CLI 通过 SDK `query()` 与 Claude Code 交互
- 消息存储在 Hub 的 SQLite 数据库

## 架构设计

### 数据流

```
Web UI
  │ POST /api/sessions/:id/rewind
  ▼
Hub REST API
  │ 1. 验证会话和消息
  │ 2. RPC 调用 CLI
  ▼
CLI RPC Handler (rewind-session)
  │ 调用 SDK rewindFiles()
  ▼
Claude Code SDK
  │ 恢复文件快照
  ▼
Hub
  │ 删除消息记录
  ▼
Web UI (SSE 通知更新)
```

### 组件职责

| 组件 | 职责 |
|------|------|
| Web | 触发回撤、展示确认对话框、接收 SSE 更新 |
| Hub API | 验证请求、协调 RPC 和数据库操作 |
| Hub Store | 删除指定消息之后的记录 |
| CLI RPC | 调用 SDK `rewindFiles()` |
| SDK | 执行文件恢复 |

## API 设计

### Hub REST Endpoint

```
POST /api/sessions/:id/rewind
Content-Type: application/json

Request:
{
  "messageLocalId": "string"  // 回滚到此消息的 local_id（保留此消息，删除之后的）
}

Response 200:
{
  "success": true,
  "deletedCount": 5,       // 删除的消息数量
  "rewindedToMessage": {   // 保留的最后一条消息
    "uuid": "...",
    "content": "..."
  }
}

Response 400:
{
  "error": "MESSAGE_NOT_FOUND" | "NOT_USER_MESSAGE" | "SESSION_NOT_ACTIVE"
}
```

### CLI RPC Handler

```typescript
// RPC 名称: rewind-session
// 请求参数:
interface RewindSessionRequest {
    sessionId: string
    userMessageUuid: string
}

// 响应:
interface RewindSessionResponse {
    success: boolean
    error?: string
}
```

## 实现细节

### 1. CLI 端启用 File Checkpointing

`cli/src/claude/sdk/query.ts` 中 spawn 时添加环境变量：

```typescript
const spawnEnv = {
    ...withBunRuntimeEnv(process.env, { allowBunBeBun: false }),
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1',  // 新增
}
```

### 2. 添加 rewindFiles 方法

`cli/src/claude/sdk/query.ts` 的 `Query` 类中添加：

```typescript
async rewindFiles(userMessageId: string, dryRun = false): Promise<RewindFilesResponse> {
    if (!this.childStdin) {
        throw new Error('rewindFiles requires --input-format stream-json')
    }
    
    const response = await this.request({
        subtype: 'rewind_files',
        user_message_id: userMessageId,
        dry_run: dryRun,
    }, this.childStdin)
    
    return response.response as RewindFilesResponse
}
```

类型定义：
```typescript
interface RewindFilesResponse {
    canRewind: boolean
    error?: string
    filesChanged?: string[]
    insertions?: number
    deletions?: number
}
```

### 3. UUID 映射（已调研确认）

**调研结论：** HAPI 已经存储了 Claude Code SDK 的 message UUID！

| Claude Code 端 | HAPI 端 | 说明 |
|---------------|---------|------|
| `message.uuid` | `local_id` | SDK 输出 user message 时包含 `uuid` 字段 |
| `createUserMessage({ uuid })` | - | Claude Code 内部为每条消息生成 UUID |
| `fileHistoryMakeSnapshot(messageId)` | - | File History 快照与 message.uuid 关联 |

**数据流：**
```
Claude Code SDK 输出 → body.uuid → CLI 作为 localId 发送 → Hub 存储到 local_id
```

**关键代码位置：**
- Claude Code: `src/utils/messages.ts:513` - `uuid: (uuid as UUID) || randomUUID()`
- Claude Code: `src/utils/handlePromptSubmit.ts:528` - `fileHistoryMakeSnapshot(..., message.uuid)`
- HAPI CLI: `cli/src/api/apiSession.ts:391` - `localId = body.uuid`
- HAPI Hub: `hub/src/store/messages.ts:27` - 存储 `localId` 到 `local_id` 字段

**Rewind 调用时：** 使用 Hub 存储的 `local_id` 作为 `user_message_id` 发送给 Claude Code。

### 5. Hub 消息删除

```typescript
// hub/src/store/messages.ts
deleteMessagesAfter(sessionId: string, localId: string): {
    deletedCount: number
    targetMessage: StoredMessage | null
} {
    // 1. 查找目标消息
    // 2. 验证是用户消息（type === 'user'）
    // 3. 删除该消息之后的所有消息
    // 返回删除数量和目标消息
}
```

### 5.1 并发控制

对同一会话的回撤请求需要加锁，防止并发操作导致数据不一致：

```typescript
// hub/src/sync/syncEngine.ts
private rewindLocks = new Map<string, Promise<void>>()

async rewindSession(sessionId: string, localId: string) {
    // 1. 获取会话锁
    const existingLock = this.rewindLocks.get(sessionId)
    if (existingLock) {
        await existingLock  // 等待前一个操作完成
    }
    
    // 2. 创建新锁
    let releaseLock: () => void
    const lock = new Promise<void>(resolve => { releaseLock = resolve })
    this.rewindLocks.set(sessionId, lock)
    
    try {
        // 3. 执行回撤逻辑
    } finally {
        // 4. 释放锁
        releaseLock!()
        this.rewindLocks.delete(sessionId)
    }
}
```

### 6. SSE 通知

回撤完成后广播事件，通知 Web 刷新会话数据：

```typescript
// 新增 SSE 事件类型（定义在 shared/src/types.ts）
export type SessionRewoundEvent = {
    type: 'session-rewound'
    sessionId: string
    rewindToLocalId: string
    deletedCount: number
}
```

## 用户交互

### Web UI 流程

1. 用户在消息上点击「回撤到此处」
2. 显示确认对话框：
   - "将删除此消息之后的 N 条消息"
   - "文件将恢复到此时的状态"
   - "Bash 命令的副作用无法回滚"
3. 确认后调用 API
4. 显示加载状态
5. 完成后刷新消息列表

### Web UI 实现细节

**文件结构：**
- `web/src/api/client.ts` - 添加 `rewindSession()` 方法
- `web/src/hooks/mutations/useRewindSession.ts` - 新增 mutation hook
- `web/src/hooks/useSSE.ts` - 处理 `session-rewound` 事件
- `web/src/components/AssistantChat/messages/UserMessage.tsx` - 添加回撤按钮
- `web/src/types/api.ts` - 添加 `RewindSessionResponse` 类型

**API Client 方法：**
```typescript
async rewindSession(sessionId: string, messageLocalId: string): Promise<RewindSessionResponse> {
    return await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/rewind`, {
        method: 'POST',
        body: JSON.stringify({ messageLocalId })
    })
}
```

**SSE 事件处理：**
```typescript
if (event.type === 'session-rewound') {
    // 清除该 session 的消息缓存，触发重新加载
    void queryClient.invalidateQueries({ queryKey: queryKeys.messages(event.sessionId) })
}
```

**回撤按钮位置：**
在 `UserMessage.tsx` 组件中，hover 时显示回撤图标（类似现有的消息操作菜单）。

### 限制与警告

UI 需要明确告知用户：
- 只能回撤用户消息（不能选择 AI 消息）
- Bash 命令执行的文件变更不会恢复
- Git 提交等操作不会回滚

## 错误处理

| 场景 | HTTP Status | 错误码 | 说明 |
|------|-------------|--------|------|
| 消息不存在 | 400 | `MESSAGE_NOT_FOUND` | local_id 对应的消息不存在 |
| 选择的是 AI 消息 | 400 | `NOT_USER_MESSAGE` | 只能回撤到用户消息 |
| 会话不在 Remote 模式 | 400 | `SESSION_NOT_ACTIVE` | 会话未激活或不在 remote 模式 |
| 非 Claude 会话 | 400 | `UNSUPPORTED_FLAVOR` | 只支持 Claude 会话 |
| CLI 断开连接 | 503 | `CLI_UNAVAILABLE` | RPC 调用超时或 socket 断开 |
| SDK rewindFiles 失败 | 500 | `REWIND_FAILED` | 保留消息不删除 |

### 用户消息验证

Hub 在执行 `deleteMessagesAfter` 前需验证目标消息类型：

```typescript
// 从消息 content 中解析类型
const content = targetMessage.content
if (content?.type !== 'user') {
    return { success: false, error: 'NOT_USER_MESSAGE' }
}
```

## 实现顺序

1. **CLI SDK:** 添加环境变量 `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1`
2. **CLI SDK:** 添加 `Query.rewindFiles()` 方法（发送 control_request）
3. **CLI SDK:** 添加 `RewindFilesResponse` 类型定义
4. **CLI RPC:** 添加 `rewind-session` handler
5. **Hub API:** 添加 `POST /api/sessions/:id/rewind` endpoint
6. **Hub Store:** 添加 `deleteMessagesAfter()` 方法
7. **SSE:** 添加 `session-rewound` 事件类型
8. **Web API Client:** 添加 `rewindSession()` 方法
9. **Web Types:** 添加 `RewindSessionResponse` 类型
10. **Web Mutation:** 添加 `useRewindSession` hook
11. **Web SSE:** 处理 `session-rewound` 事件
12. **Web UI:** 在 `UserMessage` 组件添加回撤按钮

> **注：** UUID 映射调研已完成（见"3. UUID 映射"章节），确认 HAPI 已存储 SDK 的 `message.uuid` 到 Hub 的 `local_id` 字段。

## 测试策略

### 单元测试
- Hub Store: `deleteMessagesAfter` 正确删除记录
- API: 请求验证逻辑

### 集成测试
- 完整回撤流程（需要 mock SDK）
- 错误场景覆盖

### 手动测试
- 实际文件恢复验证
- Bash 命令场景验证（确认不恢复）

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| ~~SDK 消息 UUID 与 Hub UUID 不一致~~ | ~~无法正确定位快照~~ | ✅ 已确认：SDK `uuid` → Hub `local_id` |
| 用户误解 Bash 限制 | 用户期望所有操作都可回滚 | UI 明确警告 |
| 并发回撤请求 | 数据不一致 | 对同一会话的回撤加锁 |
| File Checkpointing 未启用 | 无快照可恢复 | 检查环境变量设置 |
