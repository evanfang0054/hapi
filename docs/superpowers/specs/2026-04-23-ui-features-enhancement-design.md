# UI 交互改进与功能增强设计

日期: 2026-04-23

## 概述

本设计覆盖5个独立的 UI/功能改进任务，均发生在 `web/` 和 `hub/` 工作区。

---

## Task 1: 终端乱码修复

### 问题

终端页面出现乱码符号和文字重复。

### 根因分析

1. **文字重复**: `convertEol: true` 将 `\n` 转换为 `\r\n`，但远程终端服务端已经发送了正确的 `\r\n` 行结束符，导致双重换行
2. **乱码符号**: `customGlyphs: true` 在 Nerd Font 尚未加载完成时启用，导致 box drawing 等特殊字符渲染异常

### 方案

**文件**: `web/src/components/Terminal/TerminalView.tsx`

1. 移除 `convertEol: true` — 远程终端服务端负责正确的行结束符，客户端不应二次转换
2. `customGlyphs` 默认设为 `false`，在 `ensureBuiltinFontLoaded()` 成功后再通过 `terminal.options.customGlyphs = true` 启用
3. 不改变主题色逻辑

### 影响范围

- `web/src/components/Terminal/TerminalView.tsx`（约3行改动）

---

## Task 2: 文件页面空状态样式对齐设计稿

### 现状

`files.tsx` 第815-838行的"未检测到变更"空状态与设计稿不一致：标题字号偏大（20px vs 18px）、缺少描述文字、间距不同。

### 设计稿规范

```css
.empty-state {
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}
.empty-icon {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: var(--subtle-bg); /* 映射到 --app-subtle-bg */
    display: flex; align-items: center; justify-content: center;
    color: var(--hint); /* 映射到 --app-hint */
    margin-bottom: 8px;
}
.empty-title {
    font-family: var(--font-serif); /* 映射到 --app-font-serif */
    font-size: 18px;
    font-weight: 500;
    color: var(--fg); /* 映射到 --app-fg */
}
.empty-desc {
    font-size: 13px;
    color: var(--hint); /* 映射到 --app-hint */
    max-width: 280px;
    line-height: 1.5;
}
```

设计稿中的文案: "Your working directory is clean. Make some changes and they'll appear here."

### 方案

**文件**: `web/src/routes/sessions/files.tsx`

1. 将空状态区域改为使用设计稿的 `.empty-state` 结构：`empty-icon` + `empty-title` + `empty-desc`
2. 图标改为设计稿的文件夹图标（`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`）
3. 标题字号改为 18px，添加描述文字
4. CSS 变量映射: `--subtle-bg` → `var(--app-subtle-bg)`、`--hint` → `var(--app-hint)`、`--fg` → `var(--app-fg)`、`--font-serif` → `var(--app-font-serif)`
5. 保留现有的"切换到目录浏览"操作按钮

### 影响范围

- `web/src/routes/sessions/files.tsx`（空状态区域，约20行改动）
- `web/src/lib/locales/en.ts`、`web/src/lib/locales/zh-CN.ts`（新增翻译 key）

---

## Task 3: 文件编辑与保存

### 现状

文件详情页 (`file.tsx`) 在 `displayMode === 'file'` 模式下只支持查看和复制，不支持编辑。

### 方案

#### 前端

**依赖**: 新增 `@codemirror/view`、`@codemirror/state`、`@codemirror/language`、`@codemirror/lang-javascript`、`@codemirror/lang-css`、`@codemirror/lang-html`、`@codemirror/lang-python`、`@codemirror/lang-json`、`@codemirror/lang-markdown`

**文件**: `web/src/routes/sessions/file.tsx`

1. 添加 `isEditing` state，默认 `false`
2. 只读模式下显示"编辑"按钮（与现有"复制"按钮并列），仅对非二进制文件且大小 ≤ 1MB 时显示
3. 点击"编辑"后切换到 CodeMirror 编辑器：
   - 使用 `EditorView` 和 `EditorState.create()` 初始化
   - 根据文件扩展名加载对应语言包
   - 主题适配 `--app-*` CSS 变量（背景、前景、行号、选区等）
   - 支持行号显示、基本编辑操作
4. 编辑模式下底部显示"保存"和"取消"按钮
5. 保存调用 `api.writeSessionFile(sessionId, path, content)`
6. 保存成功后切回只读视图并刷新文件内容
7. 取消直接切回只读视图，不保存

**移动端/H5 兼容**:
- CodeMirror 6 原生支持触摸事件
- 监听 `visualViewport` resize 事件，虚拟键盘弹出时自动调整编辑区高度，避免内容被遮挡
- 设置文件大小上限 1MB，超过此限制不提供编辑功能（避免移动端性能问题）
- 禁用移动端的触摸缩放（编辑区域内），避免与 CodeMirror 的滚动手势冲突

**新增组件**: `web/src/components/SessionFiles/FileEditor.tsx`
- 封装 CodeMirror 编辑器初始化、语言加载、主题配置
- 接收 `content: string`、`language: string`、`onChange: (content: string) => void` props
- 管理 CodeMirror 实例生命周期（创建、销毁）

#### 后端

**文件**: `hub/src/web/routes/sessions.ts`

新增路由 `PUT /api/sessions/:id/file`:
- 接收 `{ path: string, content: string }` body（content 为 base64 编码）
- 校验 session 存在且有权限
- 通过 `rpcGateway.writeFile(sessionId, path, content)` 转发到 CLI 端已有的 `writeFile` RPC handler（`cli/src/modules/common/handlers/files.ts`）
- CLI 端支持 hash 乐观锁校验，写入成功返回文件 SHA-256 hash
- 返回 `{ type: 'success' }`

**文件**: `hub/src/sync/rpcGateway.ts`

新增 `writeFile(sessionId, path, content)` 方法，通过 `sessionRpc(sessionId, 'writeFile', { path, content })` 转发。

**文件**: `web/src/api/client.ts`

新增 `writeSessionFile(sessionId: string, path: string, content: string)` 方法。

### 影响范围

- `web/src/routes/sessions/file.tsx`（编辑/保存 UI，约80行新增）
- `web/src/components/SessionFiles/FileEditor.tsx`（新文件，约100行）
- `web/src/api/client.ts`（新增1个方法）
- `hub/src/web/routes/sessions.ts`（新增1个路由）
- `hub/src/sync/rpcGateway.ts`（新增 writeFile RPC 中转方法）
- `web/src/lib/locales/en.ts`、`web/src/lib/locales/zh-CN.ts`（新增翻译 key）
- `web/package.json`（新增 CodeMirror 依赖）

---

## Task 4: Chat 头部菜单添加刷新选项

### 现状

Chat 页面没有手动刷新数据的方式，完全依赖 SSE 推送。如果 SSE 断连或数据不同步，用户无法手动获取最新数据。

### 方案

**文件**: `web/src/components/SessionActionMenu.tsx`

1. 在菜单项列表中添加"刷新数据"选项
2. 点击后调用 `queryClient.invalidateQueries({ queryKey: ['session', sessionId] })` 和消息 store 的 `refetch()`
3. 位置：放在菜单顶部（在归档/删除等操作之前），因为这是一个高频、安全的操作
4. 图标使用刷新图标（循环箭头）

**数据流**: 刷新按钮 → invalidate session query + refetch messages → UI 自动更新

### 影响范围

- `web/src/components/SessionActionMenu.tsx`（新增1个菜单项，约15行）
- `web/src/lib/locales/en.ts`、`web/src/lib/locales/zh-CN.ts`（新增翻译 key）

---

## Task 5: Resume 继承权限模式

### 现状

从归档会话重新发起时，新会话不继承原会话的 `permissionMode`。原因是：
1. `permissionMode` 未持久化到 SQLite（仅在内存中通过 CLI 心跳上报）
2. `spawnSession` RPC 不传递 `permissionMode`
3. `mergeSessions` 不合并 `permissionMode`

### 方案

分3层修复：

#### Layer 1: 持久化 permissionMode

**文件**: `hub/src/store/sessions.ts`
- SQLite `sessions` 表新增 `permission_mode TEXT` 列
- `getOrCreateSession` 的 INSERT 语句加入 `permission_mode`
- `getSession` 的 SELECT 结果映射中包含 `permissionMode`

**文件**: `hub/src/store/types.ts`
- `DbSessionRow` 和 `StoredSession` 类型添加 `permissionMode` 字段

**文件**: `hub/src/sync/sessionCache.ts`
- `handleSessionAlive` 心跳处理时，同时将 `permissionMode` 写入数据库（通过 `store.sessions.updateSession`）
- `refreshSession` 从 DB 行读取 `permissionMode`

#### Layer 2: spawn 时传递 permissionMode

**文件**: `hub/src/sync/rpcGateway.ts`
- `spawnSession` 方法新增 `permissionMode` 参数
- RPC payload 中传递 `permissionMode`

**文件**: `hub/src/sync/syncEngine.ts`
- `resumeSession` 中调用 `spawnSession` 时传入原会话的 `permissionMode`

**文件**: `cli/` 中的 spawn handler
- 接收 `permissionMode` 参数，在启动新 CLI 进程时应用

#### Layer 3: mergeSessions 继承

**文件**: `hub/src/sync/sessionCache.ts`
- `mergeSessions` 中增加 `permissionMode` 的合并逻辑：如果新会话没有 `permissionMode`，从原会话继承

### 影响范围

- `hub/src/store/sessions.ts`（DB schema + 读写逻辑）
- `hub/src/store/types.ts`（类型定义）
- `hub/src/sync/sessionCache.ts`（心跳持久化 + mergeSessions 继承）
- `hub/src/sync/syncEngine.ts`（spawnSession 调用）
- `hub/src/sync/rpcGateway.ts`（RPC 参数扩展）
- `cli/` spawn handler（接收 permissionMode 参数）
- 可能涉及 `shared/` protocol 类型更新

---

## 任务优先级建议

1. **Task 1**（终端乱码）— 影响使用体验，改动最小，优先修复
2. **Task 2**（空状态样式）— 纯 UI 对齐，改动小
3. **Task 4**（Chat 刷新）— 改动小，功能价值高
4. **Task 5**（权限继承）— 需要跨 hub + cli 改动，但逻辑清晰
5. **Task 3**（文件编辑）— 改动量最大，涉及新依赖和前后端联动
