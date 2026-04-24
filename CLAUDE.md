# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库概览

HAPI 是一个基于 Bun 的 monorepo，用来在本地运行 AI 编码会话，并通过 Web / PWA / Telegram Mini App 进行远程控制。

核心工作区：

- `cli/` — 启动和管理 agent 会话（Claude Code、Codex、Cursor Agent、Gemini、OpenCode）
- `hub/` — 提供 HTTP API、Socket.IO、SSE、Telegram 集成和 SQLite 持久化
- `web/` — React PWA / Mini App，用于会话控制、文件浏览、终端和权限审批
- `shared/` — 跨包共享的协议类型、消息结构、模式定义和公共契约

次要工作区：

- `docs/` — 文档站点内容
- `website/` — 官网构建，同时承载构建后的文档

跨包配置：

- `cli/.cursorrules` — 符号链接到根 CLAUDE.md，Cursor 编辑器自动读取

## 包管理与工具链

- 包管理器：`bun`
- Monorepo：根目录 `package.json` 中声明的 Bun workspaces
- Web：React 19 + Vite + TanStack Router + TanStack Query + Vitest
- Hub 运行时：Bun + Hono + Socket.IO + SQLite
- 共享契约：`shared/src/*`

## 常用命令

默认都在仓库根目录执行。

### 安装依赖

```bash
bun install
```

### 本地开发

```bash
bun run dev          # 同时启动 hub 和 web
bun run dev:hub      # 仅启动 hub
bun run dev:web      # 仅启动 web
```

### 构建

```bash
bun run build                # 构建 cli + hub + web
bun run build:cli            # 构建 cli 包
bun run build:hub            # 构建 hub 包
bun run build:web            # 构建 web 包
bun run build:single-exe     # 构建内嵌 web 资源的单文件可执行产物
bun run build:single-exe:all # 构建所有打包目标
bun run build:site           # 构建 website + docs
```

### 类型检查（无 lint/format 配置，这是唯一的代码质量门禁）

```bash
bun run typecheck
bun run typecheck:cli
bun run typecheck:hub
bun run typecheck:web
```

### 运行测试

```bash
bun run test
bun run test:cli
bun run test:hub
bun run test:web
```

### 运行单个测试

```bash
cd cli && bunx vitest run src/path/to/test.test.ts
cd web && bunx vitest run src/path/to/test.test.tsx
cd hub && bun test src/path/to/test.test.ts
```

### 其他常用命令

```bash
bun run clean-session   # 清理 hub 会话相关数据/脚本状态
bun run release-all     # 从 cli 包发起 release 流程
```

## 高层架构

整个产品采用 hub-and-clients 模型：

1. `cli/` 在开发者机器上启动或恢复编码 agent 会话。
2. `hub/` 充当协调中心，接收 CLI 连接，保存会话与消息状态，对 `web` 暴露 HTTP API，并通过 SSE / Socket.IO 推送实时更新。
3. `web/` 是用户侧控制界面，用于查看会话、收发消息、审批权限、浏览文件、查看 git diff 和打开终端。
4. `shared/` 保持跨包协议一致，确保 CLI、hub 和 web 对消息、会话、事件的数据结构理解一致。

### 数据流总览

- CLI 通过 Socket.IO 连接 hub，并上报会话状态和机器状态。
- Hub 将会话、消息、机器以及相关元数据持久化到 SQLite。
- Web 先通过 hub 的 HTTP 路由获取初始数据，再通过 SSE 订阅实时更新。
- 终端交互通过 hub 的 Socket.IO handler 转发。
- Web 中的文件和 git 操作由 hub 路由提供，必要时再通过 RPC 回到 CLI 侧执行。

## 建议优先阅读的入口

### CLI

- `cli/src/index.ts` — CLI 顶层入口
- `cli/src/commands/runCli.ts` — 命令分发入口
- `cli/src/configuration.ts` — 环境变量与配置定义
- `cli/src/claude/` — Claude Code 集成
- `cli/src/codex/`、`cli/src/cursor/`、`cli/src/gemini/`、`cli/src/opencode/` — 各类 agent runner / 集成实现
- `cli/src/agent/` — 通用 agent 框架，含 `backends/acp/`（ACP SDK 传输层）和 `AgentRegistry` 会话注册
- `cli/src/runner/` — 后台 runner 管理
- `cli/src/api/` — hub API 客户端、会话注册、RPC 通道

### Hub

- `hub/src/index.ts` — hub 启动入口
- `hub/src/configuration.ts` — 服务端配置与环境变量处理
- `hub/src/sync/syncEngine.ts` — 会话 / 消息 / 机器的核心编排逻辑
- `hub/src/sync/teams.ts`、`hub/src/sync/todos.ts` — 团队状态和 Todo 进度追踪
- `hub/src/sync/rpcGateway.ts` — RPC 网关
- `hub/src/web/routes/` — web 和 CLI 使用的 HTTP API
- `hub/src/web/middleware/auth.ts` — 认证中间件
- `hub/src/socket/handlers/cli/` — CLI 连接的实时事件处理
- `hub/src/store/` — SQLite 持久化层
- `hub/src/notifications/` — 通知中心（事件解析、会话信息）
- `hub/src/push/` — Web Push 推送服务
- `hub/src/sse/sseManager.ts` — SSE 连接管理
- `hub/src/visibility/visibilityTracker.ts` — 页面可见性追踪
- `hub/src/tunnel/` — Relay 模式隧道（TLS gateway）
- `hub/src/telegram/` — Telegram Bot 与 Mini App 集成

### Web

- `web/src/router.tsx` — 路由树与页面顶层组合
- `web/src/routes/history/` — 会话历史（搜索、筛选、归档、删除）
- `web/src/routes/machines/` — 机器列表与新建会话
- `web/src/routes/sessions/files.tsx` — 文件浏览与 git 状态页面
- `web/src/routes/sessions/file.tsx` — 文件查看与 diff 页面
- `web/src/routes/sessions/terminal.tsx` — 终端页面
- `web/src/routes/settings/` — 设置页（深色模式、语言、字号、语音、通知）
- `web/src/components/SessionList.tsx` — 会话列表 UI
- `web/src/components/SessionChat.tsx` — 聊天与会话控制 UI
- `web/src/components/NewSession/` — 新建会话流程
- `web/src/hooks/queries/` 和 `web/src/hooks/mutations/` — TanStack Query 数据层
- `web/src/hooks/useSSE.ts` — 实时订阅与缓存失效处理
- `web/src/api/client.ts` — web 侧 hub API 客户端

### Shared 契约

- `shared/src/index.ts` — 主导出入口
- `shared/src/messages.ts`、`shared/src/types.ts`、`shared/src/modes.ts`、`shared/src/socket.ts` — 协议核心构件
- `shared/src/schemas.ts` — Zod schema 定义，覆盖会话、消息、同步事件、团队状态、Todo 等
- `shared/src/sessionSummary.ts` — 会话摘要结构与转换
- `shared/src/voice.ts` — 语音相关共享协议

## 各工作区职责

### `cli/`

当任务涉及以下内容时，优先看这个包：

- 启动或恢复 agent 会话
- 适配 Claude / Codex / Cursor / Gemini / OpenCode 的差异
- 本地模式与远程模式切换
- 后台 runner 生命周期
- 认证辅助、诊断信息或 MCP bridge 逻辑
- 新增 agent 集成：使用 `AgentRegistry` 注册 runner，参考 `cli/src/agent/backends/acp/` 实现 ACP 传输

### `hub/`

当任务涉及以下内容时，优先看这个包：

- 会话与消息持久化
- 权限审批 / 拒绝流程
- 机器在线状态与新建会话
- HTTP 路由行为
- 实时更新（SSE / Socket.IO）、事件分发、RPC 路由
- 推送通知（Web Push）
- Telegram 通知或 Mini App 绑定
- Relay 模式（通过隧道暴露本地 hub）
- 团队状态和 Todo 进度同步

### `web/`

当任务涉及以下内容时，优先看这个包：

- 会话列表 / 聊天界面体验
- 权限控制、模型选择、设置页
- 新建会话流程
- 文件浏览 / git diff / 终端页面
- PWA 行为和浏览器侧认证

### `shared/`

如果一个功能需要跨包修改协议或类型，先检查 `shared/`。这里的改动通常意味着 `hub` 与 `web` 需要同步更新，有时 `cli` 也要一起改。

## 测试说明

- `web` 使用 Vitest + `jsdom`，测试初始化文件是 `web/src/test/setup.ts`。
- `cli` 使用 Vitest，运行环境是 Node。
- `hub` 使用 `bun test`。
- 如果改动跨越多个包，先跑受影响包的测试，再根据需要执行根目录的 `bun run test`。

## 这个仓库里几个重要事实

- `hapi server` 仍然是 `hapi hub` 的别名。
- `build:single-exe` 的流程是：先构建 `web`，再在 `hub` 中生成内嵌 web 资源，最后构建打包后的 CLI 可执行文件。
- `web/dist` 是最终前端产物，既可由 `hub` 直接提供，也可被嵌入单文件可执行产物中。
- 认证核心围绕 `CLI_API_TOKEN`；浏览器登录可能使用 `CLI_API_TOKEN:<namespace>`，Telegram 认证通过 hub 的相关路由完成。

## 平台优先级：H5 移动端为主

**Web 界面以 H5（移动端浏览器 / PWA / Telegram Mini App）为主要目标平台，PC 端也需兼容但不是优先级。**

开发 UI 时的关键原则：

- **交互设计以触摸优先**：不能用 hover-only 的交互（移动端没有 hover）。需要 hover 效果时，用 `md:opacity-0 md:group-hover/xxx:opacity-100` 让移动端始终可见、桌面端 hover 显示。
- **视口和布局以移动端为基准**：先确保窄屏（375px+）体验正确，再用 `md:` / `lg:` 断点适配桌面。
- **触摸手势兼容**：终端等组件需要 `touch-action` 正确设置（如 `touch-pan-y` 允许垂直滚动），避免 `touch-none` 阻止正常滚动。
- **复制、长按等操作**：需要提供明确的 UI 按钮而非依赖右键菜单或 hover 菜单。

## 给未来 Claude 实例的协作建议

- 修改某个工作区的行为前，优先先读对应 README：
  - `cli/README.md`
  - `hub/README.md`
  - `web/README.md`
- 遇到多包联动改动时，先看 `shared/`，确认现有契约是否已经覆盖，或者是否应该先改协议层。
- 保持改动简单且局部化。这个仓库的包边界已经比较清晰，优先沿着现有边界扩展，不要轻易新增横切式抽象。
