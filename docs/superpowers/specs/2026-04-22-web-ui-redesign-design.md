# Web UI 全量改版设计文档

**日期**: 2026-04-22
**分支**: `feat/interfaceRevamp`
**状态**: 待实现

## 概述

基于 `web/design/` 目录下的 11 个 HTML 设计稿（Claude/Anthropic 风格暖色设计系统），对 `web/` 工作区进行全量 UI 改版。采用全量重写策略，从设计系统底层开始一次性替换，在 `feat/interfaceRevamp` 分支上开发。

## 不做的事

- 不改动 `cli/`、`hub/`、`shared/` 的代码
- 不重构终端（xterm.js）、文件目录树、文件 diff 的内部实现
- 不新增后端 API（History 页面复用现有 hub API）
- 不删除任何现有功能（见第 4 节功能保留清单）
- 不移除 Telegram Mini App 适配、国际化、PWA 安装提示等平台级功能

## 关键决策

| # | 决策 | 理由 |
|---|------|------|
| 1 | 响应式双模式：桌面端 master-detail 双栏 + 移动端底部 Tab Bar | 保留桌面端高效工作流，移动端符合设计稿 |
| 2 | 完全采用 Claude 暖色设计系统（parchment/terracotta/serif） | 设计稿已完备，视觉一致性优先 |
| 3 | 路由完全重新设计 | 匹配设计稿的页面结构（独立 Machines/History/Settings 页） |
| 4 | 聊天组件保留 assistant-ui 核心，重新定制渲染 | 避免重写消息处理管线，只调整视觉层 |
| 5 | 终端/文件目录/文件 diff 沿用现有封装，只换外层壳样式 | 降低风险，聚焦视觉改版 |
| 6 | NewSession 以 Modal/Sheet 形式打开 | 符合设计稿，不占独立路由 |

---

## 1. 设计系统

### 1.1 CSS 变量体系

替换 `web/src/index.css` 中的设计令牌：

#### 亮色主题（默认）

```css
:root {
  /* Surface */
  --app-bg: #f5f4ed;           /* Parchment */
  --app-panel-bg: #faf9f5;     /* Ivory */
  --app-surface: #ffffff;       /* Pure White */
  --app-surface-warm: #e8e6dc;  /* Warm Sand */

  /* Text */
  --app-fg: #141413;            /* Anthropic Near Black */
  --app-fg-secondary: #5e5d59;  /* Olive Gray */
  --app-fg-tertiary: #87867f;   /* Stone Gray */
  --app-fg-dark: #3d3d3a;       /* Dark Warm */
  --app-fg-on-dark: #b0aea5;    /* Warm Silver */

  /* Brand */
  --app-accent: #c96442;        /* Terracotta Brand */
  --app-accent-light: #d97757;  /* Coral Accent */
  --app-error: #b53333;         /* Error Crimson */
  --app-focus: #3898ec;         /* Focus Blue */

  /* Border */
  --app-border: #f0eee6;        /* Border Cream */
  --app-border-strong: #e8e6dc; /* Border Warm */

  /* Shadow / Ring */
  --app-ring: #d1cfc5;          /* Ring Warm */
  --app-ring-subtle: #dedcd1;   /* Ring Subtle */
  --app-ring-deep: #c2c0b6;     /* Ring Deep */
  --app-shadow-whisper: rgba(0,0,0,0.05) 0px 4px 24px;

  /* Radius */
  --app-radius-sm: 4px;
  --app-radius-md: 8px;
  --app-radius-lg: 12px;
  --app-radius-xl: 16px;
  --app-radius-2xl: 24px;
  --app-radius-pill: 999px;

  /* Typography */
  --app-font-serif: Georgia, 'Times New Roman', serif;
  --app-font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --app-font-mono: ui-monospace, SFMono-Regular, monospace;
}
```

#### 暗色主题

```css
[data-theme="dark"] {
  --app-bg: #141413;           /* Deep Dark */
  --app-panel-bg: #1a1a18;     /* Slightly lighter */
  --app-surface: #30302e;      /* Dark Surface */
  --app-surface-warm: #3a3a37;

  --app-fg: #faf9f5;           /* Ivory */
  --app-fg-secondary: #b0aea5; /* Warm Silver */
  --app-fg-tertiary: #87867f;  /* Stone Gray */
  --app-fg-dark: #d1cfc5;
  --app-fg-on-dark: #141413;

  --app-accent: #d97757;       /* Coral Accent (brighter for dark) */
  --app-accent-light: #e8956e;

  --app-border: #30302e;
  --app-border-strong: #3d3d3a;

  --app-ring: #4d4c48;
  --app-shadow-whisper: rgba(0,0,0,0.2) 0px 4px 24px;
}
```

### 1.2 字体层级

| 角色 | 字体 | 大小 | 字重 | 行高 |
|------|------|------|------|------|
| 页面标题 | Serif | 25-32px | 500 | 1.20 |
| 区域标题 | Serif | 20-25px | 500 | 1.20 |
| 卡片标题 | Serif | 16-20px | 500 | 1.20 |
| 正文 | Sans | 16px | 400 | 1.60 |
| 正文小号 | Sans | 15px | 400 | 1.50 |
| 说明/元信息 | Sans | 14px | 400 | 1.43 |
| 标签 | Sans | 12px | 500 | 1.25 |
| 代码 | Mono | 15px | 400 | 1.60 |

### 1.3 基础组件样式

**Button 变体：**
- `warm-sand`：背景 `#e8e6dc`，文字 `#4d4c48`，8px 圆角
- `terracotta`：背景 `#c96442`，文字 `#faf9f5`，8-12px 圆角（主 CTA）
- `dark-charcoal`：背景 `#30302e`，文字 `#faf9f5`，8px 圆角
- `outline`：透明背景，`#f0eee6` 边框，8px 圆角

**Card：**
- 背景 `#faf9f5`（亮）/ `#30302e`（暗）
- 边框 `1px solid #f0eee6`（亮）/ `1px solid #30302e`（暗）
- 圆角 8px（标准）/ 16px（featured）
- Shadow: `rgba(0,0,0,0.05) 0px 4px 24px`（elevated）

**深度系统：**
- Level 0（Flat）：无 shadow/border — 背景色本身
- Level 1（Contained）：`1px solid var(--app-border)`
- Level 2（Ring）：`0px 0px 0px 1px var(--app-ring)`
- Level 3（Whisper）：`var(--app-shadow-whisper)`
- Level 4（Inset）：`inset 0px 0px 0px 1px rgba(0,0,0,0.15)`

---

## 2. 路由结构

### 2.1 新路由树

```
/                          → 重定向 /sessions
/login                     → LoginPage
/sessions                  → SessionsShell（双栏/单栏自适应）
  /sessions/$sessionId     → ChatPage（默认子路由）
  /sessions/$sessionId/terminal → TerminalPage
  /sessions/$sessionId/files    → FilesPage
  /sessions/$sessionId/file     → FilePage
/machines                  → MachinesPage
/history                   → HistoryPage
/settings                  → SettingsPage
```

- `/sessions/new` 取消独立路由，改为 Modal/Sheet 触发
- `/sessions/$sessionId/*` 在移动端隐藏 Tab Bar（聊天沉浸模式）

### 2.2 Shell 布局

**桌面端（`>= lg`）：**
- 顶栏：Logo + 导航链接（Sessions / Machines / History / Settings）+ 主题切换
- `/sessions`：左栏 SessionList（固定 ~420px）+ 右栏内容区
- 其他页面：居中内容区（max-width ~800px）

**移动端（`< lg`）：**
- 底部固定 Tab Bar：Sessions / Machines / FAB(+New) / History / Settings
- 所有页面单栏全屏
- Sessions Tab 显示活跃会话数 badge
- FAB 按钮为 Terracotta 渐变色圆形 "+"

---

## 3. 页面设计

### 3.1 LoginPage (`/login`)

参考：`redesign-login.html`

- 全屏居中卡片
- Logo（字母 "E" 渐变圆角方形）+ "Welcome Back" 标题（Serif）
- Access Token 输入框（password 类型，12px 圆角）
- "Sign In" 按钮（Terracotta 渐变背景）
- Hub Server 配置对话框（Dialog overlay）
- 顶部：主题切换 + 语言切换
- 底部：版权信息

### 3.2 SessionList（Sessions 主页）

参考：`redesign-ab-hybrid.html`

- 会话按项目目录分组（`groupSessionsByDirectory`），每组可折叠
- 分组卡片：项目名 + 机器名 + 路径 + 活跃会话数 badge
- 会话卡片（网格布局）：
  - 状态指示灯（active=绿 / thinking=蓝动画 / inactive=灰）
  - 会话名 + Git 分支
  - Tags：thinking / pending / todo / model
  - 时间 + Agent 名
- 批量选择模式：长按/右键进入，底部固定操作栏（Archive/Delete）
- 右键菜单：Rename / Archive / Duplicate / Select Multiple / Delete
- 空状态 + 加载骨架屏

### 3.3 ChatPage (`/sessions/$sessionId`)

参考：`redesign-chat.html`

保留 `assistant-ui` 核心（`AssistantRuntimeProvider` / 消息处理管线），重新定制渲染层。

#### 3.3.1 Header（SessionHeader）

- 返回按钮（移动端显示）
- 会话标题（agent badge + model badge + worktree branch）
- 连接状态点（online=绿 / thinking=蓝脉冲 / permission=黄脉冲 / offline=灰）
- 更多操作菜单：Rename / Archive / Delete（使用 ConfirmDialog）
- 磨砂玻璃效果（`backdrop-blur`）
- Telegram 环境下不渲染（TG 自带 header）

#### 3.3.2 状态横幅（Header 下方）

- **Session 非活跃提示：** "Session is inactive. Sending will resume it automatically."
- **网络恢复失败提示：** "网络恢复失败，当前显示的是缓存内容" + 重试按钮
- **完全无法加载提示：** 居中卡片 + "当前无法刷新会话内容" + 重试按钮
- **消息警告：** `messagesWarning` 黄色边框提示条
- **TeamPanel：** 当 `session.teamState` 存在时显示团队协作面板

#### 3.3.3 消息线程（HappyThread）

- 可滚动消息区，最大宽度 960px
- **自动滚动：** 用户在底部时自动跟随新消息，向上滚动时暂停自动滚动
- **加载更多历史消息：** 顶部 IntersectionObserver 触发，带 spinner 的 "Load Older" 按钮
- **滚动位置恢复：** 切换 session 后恢复到上次浏览位置（`sessionViewState`）
- **新消息指示器：** 底部浮动按钮（显示新消息数量），点击滚动到底部
- **骨架屏：** 首次加载时显示消息骨架（交替左右对齐的灰色条）
- **消息组件：**
  - `HappyUserMessage`：用户消息气泡
  - `HappyAssistantMessage`：助手消息（含 Copy 按钮 + tool-call 渲染）
  - `HappySystemMessage`：系统消息（居中胶囊）

#### 3.3.4 助手消息（AssistantMessage）

- 面板背景 + 边框气泡（`--app-panel-elevated-bg`，24px 圆角）
- **Copy 按钮：** 右下角，hover 显示，点击后变为 Check 图标
- **Content Parts 渲染：**
  - `Text` → `MarkdownText`（支持代码块、链接、列表等 Markdown 语法）
  - `Reasoning` → `Reasoning` 可折叠推理块
  - `ReasoningGroup` → `ReasoningGroup` 推理分组
  - `tool-call` → `HappyToolMessage`（ToolCard 渲染）
- **CLI Output 特殊渲染：** `kind === 'cli-output'` 时使用 `CliOutputBlock`（等宽字体终端输出块）
- **纯工具消息：** 当消息只包含 tool-call 时，不显示气泡边框（工具卡片自带边框）

#### 3.3.5 工具卡片（ToolCard）

每个工具调用渲染为可折叠卡片，包含：图标 + 标题 + 副标题 + 状态（running/done/error）+ 耗时 + 展开详情。

**已知工具列表（`knownTools`）：**

| 工具 | 图标 | 标题逻辑 | 特殊视图 |
|------|------|---------|---------|
| Task | 🚀 | Agent 名 / description | 子任务摘要 |
| TeamCreate / TeamDelete | 👥 | Team 名 | — |
| SendMessage | 💬 | Broadcast / Message: recipient | — |
| Bash / shell_command | ⌨️ | Terminal | — |
| Glob | 🔍 | pattern | — |
| Grep | 👁 | grep(pattern) | — |
| LS | 🔍 | 路径 | — |
| CodexBash | 动态 | Terminal / 路径（read 时） | — |
| CodexPermission | ❓ | Permission: tool | — |
| Read | 👁 | 文件路径 | — |
| Edit / MultiEdit | 📝 | 文件路径（MultiEdit 显示编辑数） | `EditView` / diff |
| Write | 📝 | 文件路径 + 行数 | `WriteView` |
| WebFetch | 🌐 | URL hostname | — |
| WebSearch | 🌐 | query | — |
| NotebookRead | 👁 | notebook 路径 | — |
| NotebookEdit | 📝 | notebook 路径 + mode | — |
| TodoWrite | 💡 | "Todo list" + item 数 | `TodoWriteView`（checklist） |
| update_plan | 📋 | "Plan" + step 数 | `UpdatePlanView`（checklist） |
| CodexReasoning | 💡 | title | — |
| CodexPatch | 📝 | "Apply changes" + 文件名 | `CodexPatchView` |
| CodexDiff | 📝 | "Diff" + 文件名 | `CodexDiffView` |
| ExitPlanMode / exit_plan_mode | 📋 | "Plan proposal" | `ExitPlanModeView` |
| AskUserQuestion / ask_user_question | ❓ | header / "Question" | `AskUserQuestionView`（选项列表） |
| request_user_input | ❓ | id / "Question" | `RequestUserInputView` |
| MCP 工具（mcp__*） | 🧩 | "MCP: server tool" | — |
| 其他未知工具 | 🔧 | toolName + 自动提取副标题 | — |

**权限审批 Footer（PermissionFooter）：**
- 当 `agentState.requests` 存在时显示
- Approve / Deny 按钮 + Approve All 批量操作
- 权限请求详情展开

**AskUserQuestion Footer：**
- 选项列表（radio 选择）
- Submit 按钮

**RequestUserInput Footer：**
- 问题输入区域

**工具结果视图（`_results.tsx`）：**
- 渲染工具调用结果，支持文本和错误展示

#### 3.3.6 Composer（HappyComposer）

- 底部固定，最大宽度 960px，圆角面板容器
- **输入框：** 自适应高度 textarea（max 4 行），Enter 发送，Shift+Enter 换行
- **附件区：** 附件列表（`AttachmentItem`），显示上传进度和状态
- **图片粘贴：** 支持从剪贴板粘贴图片作为附件
- **自动补全系统：**
  - 前缀触发：`@`（用户提及）、`/`（slash 命令）、`$`（技能）
  - `Autocomplete` 浮层组件：建议列表 + 键盘导航（↑↓ 选择，Enter/Tab 确认，Esc 关闭）
  - `FloatingOverlay` 浮层容器
- **设置浮层（Settings Overlay）：**
  - 协作模式选择（Codex Plan 模式）
  - 权限模式选择（default / plan / auto-edit / full-auto 等，按 agent flavor 过滤）
  - 模型选择（Claude: Opus/Sonnet/Haiku 等，按 agent flavor 动态变化）
  - Effort 选择（Auto / Medium / High / Max，仅 Claude）
  - 快捷键：`Shift+Tab` 切换权限模式，`Cmd/Ctrl+M` 切换模型
- **全屏编辑模式（Fullscreen Dialog）：**
  - Dialog 形式，更大的 textarea（max 18 行）
  - Cancel / Send 按钮
  - 自动聚焦到文末
- **草稿自动保存：** 输入文本 150ms 后自动存入 localStorage，切换 session 时恢复
- **Continue Hint：** 从 local 切换到 remote 后显示 "Type a message to continue..." 提示
- **Codex Slash 命令校验：** 发送前检查是否为不支持的命令，弹出 Toast 提示

#### 3.3.7 Composer 按钮栏（ComposerButtons）

- **左侧按钮组：**
  - 附件按钮（`AddAttachment`）
  - 全屏展开按钮（`Expand`）
  - 设置按钮（`Settings`，当有可切换选项时显示）
  - 终端按钮（`Terminal`，跳转到终端页）
  - 终止按钮（`Abort`，发送中时可用，带旋转动画）
  - 切换到远程按钮（`SwitchToRemote`，local 模式时显示）
  - 麦克风静音按钮（语音连接中时显示）
- **右侧：**
  - `UnifiedButton`：统一发送/语音/停止按钮
    - 有文本 + 非语音 → 发送（Send 图标）
    - 无文本 + 语音可用 → 启动语音（VoiceAssistant 图标）
    - 语音连接中 → 停止语音（Stop 图标）
    - 语音连接中 → Loading 图标
    - 不可用时灰色

#### 3.3.8 状态栏（StatusBar）

- Composer 面板顶部
- **左侧：**
  - 连接状态点 + 文字：
    - Voice connecting → 蓝色脉冲 + "Connecting"
    - Offline → 灰色 + "Offline"
    - Permission required → 黄色脉冲 + "Permission required"
    - Thinking → 蓝色脉冲 + 随机 vibing 消息（如 "Baking…"、"Pondering…"）
    - Online → 绿色 + "Online"
  - Context 使用量百分比（剩余 ≤10% 黄色，≤5% 红色）
- **右侧：**
  - 后台任务数量
  - 协作模式标签（Codex Plan 模式，蓝色）
  - 权限模式标签（按 tone 着色：neutral/info/warning/danger）

#### 3.3.9 语音助手集成（ElevenLabs）

- 由 Settings 页面的 "Voice Assistant" 开关控制是否启用
- 关闭时：`useVoiceOptional` 返回 null，Composer 中 UnifiedButton 不显示语音选项
- 开启时：
  - `RealtimeVoiceSession` 组件（不渲染 UI，初始化 WebRTC 连接）
  - `useVoiceOptional` hook 管理语音状态
  - 语音事件追踪：新消息通知、thinking 停止通知、权限请求通知
  - 语音状态通过 ComposerButtons 的 UnifiedButton 控制
  - `VoiceErrorBanner` 显示语音错误

#### 3.3.10 消息处理管线

- `DecryptedMessage` → `normalizeDecryptedMessage` → `reduceChatBlocks` → `reconcileChatBlocks`
- 缓存优化：`normalizedCacheRef` 避免重复标准化，`blocksByIdRef` 复用已渲染块
- Session 切换时自动清空缓存

### 3.4 NewSession（Modal/Sheet）

参考：`redesign-new-session.html`

- 全屏 Modal/Sheet 形式打开（非独立路由）
- 横向滚动 Machine 选择卡片（显示在线/离线状态）
- 工作目录输入 + 最近目录快捷选择
- 横向滚动 Agent 选择（Claude / Codex / Gemini / Cursor / OpenCode）
- Model & Effort 下拉选择（根据 Agent 动态变化）
- Session Type：Simple / Git Worktree
- YOLO 模式开关（带 "Dangerous" badge）

### 3.5 SettingsPage (`/settings`)

参考：`redesign-settings.html`

- 居中窄栏（max-width 600px）分组卡片式列表
- **User Card：** 头像 + 姓名 + Email
- **Appearance：** Dark Mode 开关 + 语言选择 + 字体大小
- **Notifications：** Push / Telegram 开关（UI 先就位）
- **Voice Assistant：** 语音助手开关（控制 ElevenLabs 语音功能的启用/禁用，关闭后 Composer 中不显示语音按钮）
- **Server：** Hub URL + 连接状态 + 版本号
- **About：** Documentation + GitHub 链接
- **Danger Zone：** Log Out 按钮（Error Crimson 色）

### 3.6 MachinesPage (`/machines`)

参考：`redesign-machines.html`

- 机器卡片列表：名称 + 在线状态灯 + ID + 平台 + CLI 版本
- 点击展开详情 Drawer（底部弹出）：
  - Host / Platform / CLI Version 详情
  - "New Session" 按钮（跳转 NewSession Modal）
- 空状态："No machines available"
- 骨架屏加载

### 3.7 HistoryPage (`/history`)

参考：`redesign-history.html`

- 搜索框 + 筛选 Chips（All / Archived / Deleted）
- 统计栏：总会话数 / 本周数 / 平均时长
- 按时间分组列表（Today / Yesterday / This Week / Earlier）
- 历史条目：图标 + 标题 + 摘要 + 元信息（时间/消息数/状态 badge）
- 点击展开操作：Restore / Open / Archive / Delete / Permanent Delete
- 无结果提示

### 3.8 FilesPage (`/sessions/$sessionId/files`)

参考：`redesign-files.html`

**沿用的内部组件：** 文件树（DirectoryTree）、Git 操作逻辑（Stage/Unstage/Discard）、文件搜索逻辑

**需要重新设计的部分：**

- **外层容器：** 全屏卡片容器（margin 8px, border-radius 24px, `--panel-bg` 背景, 1px border）
- **Header：**
  - 左侧：圆形返回按钮（36x36）+ 标题区（label "Repository" + serif 标题 "Session Files" + 描述 + meta 行：monospace 路径 + pill badge 分支名 + 统计文字）
  - 右侧：Refresh 按钮（pill 形态）+ 搜索框（pill 形态）
  - Tab 切换：Changes / Directories（pill 按钮组，active 态 `--app-accent` 边框 + 12% 混合背景）
- **Changes Tab：**
  - Staged / Unstaged 分区，各带 section header（`--app-surface-warm` 背景 + 统计数字 + "Stage All"/"Unstage All"/"Discard All" 操作按钮）
  - 文件行：file-icon + file-name + file-path(monospace) + 增删行统计(+绿-红) + status badge(pill) + 操作按钮（28x28）
  - Status badge 类型：M/A/D/R/?/U，各有对应颜色
- **Directories Tab：**
  - 树形行：chevron + folder icon + 名称，hover 变 `--app-surface-warm`
  - 缩进层级，展开/折叠
- **搜索结果：** 高亮匹配文字（`--app-accent` 25% 混合背景）
- **确认对话框：** 居中卡片（border-radius 20px），含图标 + 标题 + 描述 + 文件列表 + Cancel/Danger 按钮
- **Toast 通知：** 底部居中，border-radius 12px，0.3s 滑入动画
- **状态：** 骨架屏加载 + 错误横幅 + 空状态
- **响应式（<640px）：** margin 缩至 4px，搜索框全宽

### 3.9 FilePage (`/sessions/$sessionId/file`)

参考：`redesign-file.html`

**沿用的内部组件：** DiffView、代码高亮（Shiki）

**需要重新设计的部分：**

- **外层容器：** 与 FilesPage 相同的全屏卡片容器
- **Header：**
  - 左侧：圆形返回按钮 + 标题区（label "File Viewer" + serif 标题 + 描述 + meta 行：path badge(pill, monospace 路径) + "Copy Path" 按钮）
  - 右侧（桌面端 absolute 定位右上角，移动端在 meta 下方）：Diff / File 模式切换按钮
- **Diff 模式：** 外层 `.diff-container`（border 1px, border-radius 12px, `--app-bg` 背景）
- **File 模式：** 外层 `.code-container`（border 1px, border-radius 20px, `--app-surface-warm` 背景），右上角 Copy 按钮（pill, absolute 定位）
- **特殊状态：** 二进制文件提示（居中 icon + 标题 + 描述）、骨架屏、错误状态
- **Toast 通知：** 与 FilesPage 相同
- **响应式（<480px）：** header padding 缩小，标题 22px

### 3.10 TerminalPage (`/sessions/$sessionId/terminal`)

参考：`redesign-terminal.html`

**沿用的内部组件：** xterm.js 终端渲染、WebSocket 连接管理（`useTerminalSocket`）、终端输入逻辑

**需要重新设计的部分：**

- **外层容器：** 与 FilesPage 相同的全屏卡片容器
- **Header：**
  - 左侧：圆形返回按钮 + 标题区（serif italic "Terminal" + monospace 工作路径）
  - 右侧：连接状态指示灯（8px 圆形，connected=绿 / connecting=黄脉冲 / 默认=灰）+ "Paste" 按钮
  - 可选 badge 行：状态标签（pill badge）
- **消息/错误提示（Header 内）：** `--app-surface-warm` 背景 + border-radius 12px（如 "Session is inactive"），错误态红色系
- **终端区域：** 黑底（`#1a1a1a`），margin 0 16px，border-radius 8px，min-height 200px
- **退出覆盖层：** 黑色半透明底，居中退出码（pill badge），error 态红字
- **Quick Input 栏（底部）：**
  - 标题 "Quick Input"（10px 大写）+ 描述
  - 命令输入框（border-radius 12px）+ Send 按钮（`--app-accent` 底白字）
  - 快捷键面板：两行按钮网格（Esc/Tab/Ctrl/Alt/方向键/Home/End/PgUp/PgDn），Ctrl/Alt 互斥切换态
  - 底部 safe-area-inset 适配
- **粘贴对话框（Modal）：** 居中卡片（border-radius 20px），textarea + Cancel/Paste 按钮
- **Windows 不支持状态：** 居中 icon + 标题 + 描述
- **响应式（<640px）：** margin 4px，快捷键按钮缩小

---

## 4. 功能保留与补充

### 4.1 必须保留的现有功能（设计稿未体现）

以下功能在现有代码中已有完整实现，改版时**必须保留**，并用新设计系统重新包裹样式：

| # | 功能 | 当前代码位置 | 改版处理方式 |
|---|------|-------------|-------------|
| 1 | **SSE 实时连接 + 断线重连** | `hooks/useSSE.ts` | 保留 SSE 逻辑，在 Shell 层添加断线/重连状态提示条 |
| 2 | **离线横幅 (OfflineBanner)** | `components/OfflineBanner.tsx` | 用新样式重写，保留功能 |
| 3 | **同步中横幅 (SyncingBanner)** | `components/SyncingBanner.tsx` | 用新样式重写，保留功能 |
| 4 | **SSE 重连横幅 (ReconnectingBanner)** | `components/ReconnectingBanner.tsx` | 用新样式重写，保留功能 |
| 5 | **语音助手 (ElevenLabs Voice)** | `api/voice.ts`, `realtime/`, `VoiceErrorBanner.tsx` | 保留语音连接逻辑，在 Composer 中添加麦克风按钮（新样式），保留 VoiceErrorBanner |
| 6 | **PWA 安装提示 (InstallPrompt)** | `components/InstallPrompt.tsx`, `hooks/usePWAInstall.ts` | 用新样式重写，保留 Chrome/iOS 安装引导流程 |
| 7 | **国际化 (i18n)** | `lib/i18n-context.tsx`, `locales/` | 保留所有 `t()` 翻译机制，新页面补充中英文翻译 key |
| 8 | **团队协作面板 (TeamPanel)** | `components/TeamPanel.tsx` | 保留组件逻辑，用新样式重写 UI |
| 9 | **Telegram Mini App 适配** | `hooks/useTelegram.ts`, `hooks/usePlatform.ts` | 保留所有 TG 适配逻辑（BackButton、MainButton、Haptic、主题获取） |
| 10 | **草稿自动保存 (Draft Store)** | `lib/session-draft-store.ts` | 保留 localStorage 草稿机制，在 Composer 中添加草稿保存指示器 |
| 11 | **消息加载更多（历史消息翻页）** | `hooks/queries/useMessages.ts` (loadMore) | 在消息区顶部保留 "加载更多" 触发器 |
| 12 | **Slash 命令自动补全** | `hooks/queries/useSlashCommands.ts`, `ChatInput/Autocomplete.tsx` | 在 Composer 中用新样式实现 `/` 命令建议列表 |
| 13 | **运行中权限模式切换** | `api/client.ts:366`, `StatusBar.tsx:33-146` | 在 Chat Settings Sheet 中添加权限模式选择控件 |
| 14 | **运行中协作模式切换 (Codex)** | `api/client.ts:373`, `StatusBar.tsx:147-149` | 在 Chat Settings Sheet 中添加协作模式选择控件（Codex session 时显示） |
| 15 | **运行中模型切换** | `api/client.ts` (updateModel) | 在 Chat Settings Sheet 中添加模型切换控件 |
| 16 | **运行中 Effort 切换** | `api/client.ts` (updateEffort) | 在 Chat Settings Sheet 中添加 effort 切换控件 |
| 17 | **文件上传 (Attachment Adapter)** | `lib/attachmentAdapter.ts` | 保留文件选择 + 上传进度 + 取消 + 预览 URL 逻辑，用新样式渲染 |
| 18 | **Context Window 使用量指示** | `StatusBar.tsx:95-107` | 在 Chat Header 或 Settings Sheet 中保留 context 使用百分比显示 |
| 19 | **字体缩放 (Font Scale)** | `hooks/useFontScale.ts` | 保留 5 档字体缩放，在 Settings 中用新样式呈现 |
| 20 | **Push Notification 订阅管理** | `hooks/usePushNotifications.ts` | 保留 VAPID 订阅流程，在 Settings Notifications 开关中对接 |
| 21 | **长按检测 (Long Press)** | `hooks/useLongPress.ts` | 保留长按进入批量选择模式的交互 |
| 22 | **Copy to Clipboard** | `hooks/useCopyToClipboard.ts` | 保留剪贴板复制 hook |
| 23 | **目录路径自动补全** | `hooks/useDirectorySuggestions.ts`, `hooks/useActiveWord.ts` | 在 NewSession 目录输入和 Composer 中保留路径建议 |
| 24 | **Spawn Session (远程创建)** | `components/SpawnSession.tsx`, `hooks/mutations/useSpawnSession.ts` | 保留远程创建会话逻辑，集成到 NewSession 流程中 |
| 25 | **消息附件渲染** | `AssistantChat/messages/MessageAttachments.tsx`, `AttachmentItem.tsx` | 保留附件渲染逻辑，用新样式呈现 |
| 26 | **Reasoning 折叠块** | `assistant-ui/reasoning.tsx` | 保留可折叠推理展示，用新样式呈现 |
| 27 | **Notification 去重** | `lib/notification-dedupe.ts` | 保留通知去重逻辑 |

### 4.2 新增功能对接（设计稿新增、代码已有基础）

以下功能在现有代码中有部分实现或 API 支持，改版时需要补齐 UI 和完整流程：

| # | 功能 | 设计稿位置 | 代码基础 | 对接工作 |
|---|------|-----------|---------|---------|
| 1 | **统一 Tab Bar 导航** | 所有页面 | 无 | 新建 TabBar 组件，移动端底部固定，桌面端顶栏导航 |
| 2 | **Session 按项目分组折叠** | redesign-ab-hybrid | `groupSessionsByDirectory` 已有 | 新建 GroupCard 可折叠 UI 组件 |
| 3 | **Session 批量操作** | redesign-ab-hybrid | `useSessionActions` 有 deleteSessions | 新建 BatchActionBar + checkbox 选择 UI |
| 4 | **Agent 多选器** | redesign-new-session | `AgentSelector.tsx` 已有 | 用新样式重写横向滚动选择器，保持 5 种 Agent |
| 5 | **多 Agent Model 下拉** | redesign-new-session | `ModelSelector.tsx` 已有 | 用新样式重写，保持根据 Agent 动态变化 |
| 6 | **Effort / Reasoning 下拉** | redesign-new-session | `ClaudeEffortSelector.tsx`, `ReasoningEffortSelector.tsx` 已有 | 用新样式重写 |
| 7 | **机器选择器卡片** | redesign-new-session | `MachineSelector.tsx` 已有 | 用新样式重写横向滚动卡片 |
| 8 | **最近目录快捷选择** | redesign-new-session | `useRecentPaths` 已有 | 在目录输入下方添加最近目录列表 |
| 9 | **YOLO 模式开关** | redesign-new-session | `YoloToggle.tsx` 已有 | 用新样式重写，保留 Dangerous badge |
| 10 | **History 独立页面** | redesign-history | hub API 支持 archive/delete | 新建 HistoryPage 路由 + 组件 |
| 11 | **Machines 详情 Drawer** | redesign-machines | `MachineList.tsx` 已有 | 新建 MachineDetailDrawer 组件 |
| 12 | **Machines Runner Error 显示** | redesign-machines | `SpawnSession.tsx` 有 formatRunnerSpawnError | 在机器卡片上显示 lastSpawnError |
| 13 | **Chat Settings Sheet** | redesign-chat | `StatusBar.tsx` 有权限/模型/effort 数据 | 新建 Settings Sheet，集成运行中切换控件 |
| 14 | **Composer 全屏编辑模式** | redesign-chat | `HappyComposer.tsx` | 添加全屏展开/收起功能 |
| 15 | **Files 底部 Sheet** | redesign-chat | `SessionFiles/` 已有 | 新建 BottomSheet 组件包装文件列表 |
| 16 | **More 操作网格菜单** | redesign-chat | 无 | 新建 MoreMenu 网格组件（Terminal/Files/Rewind/Compact 等） |
| 17 | **消息失败 + 重试 UI** | redesign-chat | 无 | 添加失败消息气泡样式 + 重试按钮 |
| 18 | **Runner Error 在 Machines 页** | redesign-machines | hub API 返回 runnerState | 在机器卡片上展示 lastSpawnError 信息 |

---

## 5. 开发原则

- **不遗漏旧功能：** 开发过程中如果发现现有代码中的功能在本文档中没有被提及，必须主动适配补充到新设计中，不得丢弃任何已有功能。
- **设计稿为视觉参考：** 设计稿定义了视觉风格和交互模式，但不代表全部功能边界。实际功能范围以现有代码为准，设计稿未覆盖的功能用新设计系统的样式包裹即可。

## 6. 未知项

无。所有页面和组件的设计稿已完备，现有功能代码可复用，新增功能对接点已明确。
