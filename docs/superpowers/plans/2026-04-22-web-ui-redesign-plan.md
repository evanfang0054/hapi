# Web UI 全量改版实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Claude/Anthropic 暖色设计系统，对 web 工作区进行全量 UI 改版，包括设计令牌替换、路由重构、所有页面重建和新功能对接。

**Architecture:** 采用分层渐进式全量重写。先建立设计系统和基础组件层，再重构路由和 Shell 布局，然后按页面复杂度从低到高逐个重建。保留 assistant-ui 核心、xterm.js 终端、文件树和 diff 的内部实现，只重新包裹样式。

**Tech Stack:** React 19 + TanStack Router + TanStack Query + Tailwind CSS v4 + assistant-ui + Radix UI + Vitest

**Spec:** `docs/superpowers/specs/2026-04-22-web-ui-redesign-design.md`

**分支:** `feat/interfaceRevamp`

---

## 总览：5 个子计划

| # | 子计划 | 核心任务 | 依赖 |
|---|--------|---------|------|
| 1 | 设计系统 + 基础组件 | CSS 变量替换、Button/Card/Dialog/Badge 重写、确认对话框、Toast | 无 |
| 2 | 路由 + Shell 布局 | 路由树重构、桌面顶栏、移动端 Tab Bar、导航守卫 | 子计划 1 |
| 3 | 独立页面 | LoginPage、SettingsPage、MachinesPage、HistoryPage | 子计划 2 |
| 4 | 会话页面 | SessionList、NewSession(Modal)、ChatPage（含 ToolCard/Composer） | 子计划 2 + 3 |
| 5 | 沿用页面壳样式 | FilesPage、FilePage、TerminalPage 外层壳重设计 | 子计划 2 |

每个子计划完成后都能独立运行和测试。

---

# 子计划 1：设计系统 + 基础组件

**Goal:** 替换 CSS 设计令牌为 Claude 暖色系统，重写 Button/Card/Dialog/Badge 等基础组件，创建 ConfirmDialog 和 Toast 组件。

**设计稿对照文件：**
- CSS 变量 → `web/design/DESIGN.md` 第 2 节 Color Palette
- Button → `web/design/DESIGN.md` 第 4 节 Buttons
- Card → `web/design/DESIGN.md` 第 4 节 Cards & Containers
- 深度系统 → `web/design/DESIGN.md` 第 6 节 Depth & Elevation
- 预览 → `web/design/preview.html` 和 `web/design/preview-dark.html`

**开发纪律：** 对照 DESIGN.md 中定义的每个颜色值、圆角、阴影规范，确保 CSS 变量值精确匹配。

### Task 1.1: 更新 CSS 设计令牌

**Files:**
- Modify: `web/src/index.css`

**观察：** 现有 `index.css` 已经采用了暖色调变量（`--app-bg: #f5f4ed`、`--app-link: #c96442` 等），非常接近设计稿。需要微调补充设计稿中新增的变量。

- [ ] **Step 1: 对比现有变量与设计稿，列出需要新增/修改的变量**

当前已有（保持不变）：
- `--app-bg: #f5f4ed` ✅
- `--app-fg: #141413` ✅
- `--app-hint: #5e5d59` ✅（设计稿叫 `--app-fg-secondary`）
- `--app-link: #c96442` ✅（设计稿叫 `--app-accent`）
- `--app-border: #ebe7dc` ≈ 设计稿 `#f0eee6`（微调）
- `--app-subtle-bg: #e8e6dc` ✅（设计稿叫 `--app-surface-warm`）
- `--app-panel-bg: #faf9f5` ✅
- `--app-font-serif` / `--app-font-sans` / `--app-font-mono` ✅
- `--app-radius-panel: 28px` / `--app-radius-control: 18px` / `--app-radius-pill: 999px` ✅
- Diff/Git/Badge 色完整 ✅
- Dark mode 变量完整 ✅

需要新增的变量（设计稿有但现有缺失）：
- `--app-fg-tertiary: #87867f`（三级文字色）
- `--app-fg-dark: #3d3d3a`（强调二级文字）
- `--app-accent-light: #d97757`（浅强调色）
- `--app-error: #b53333`（错误红）
- `--app-focus: #3898ec`（焦点蓝）
- `--app-border-strong: #e8e6dc`（强边框）
- `--app-ring-warm: #d1cfc5`（ring 阴影色）
- `--app-shadow-whisper: rgba(0,0,0,0.05) 0px 4px 24px`（微弱阴影）
- `--app-radius-sm: 4px` / `--app-radius-md: 8px` / `--app-radius-lg: 12px` / `--app-radius-xl: 16px` / `--app-radius-2xl: 24px`（圆角梯度）

- [ ] **Step 2: 在 `web/src/index.css` 的 `:root` 块末尾添加新变量**

在现有 `:root` 中 `--app-font-scale: 1;` 之后追加：

```css
    /* Additional design tokens from redesign spec */
    --app-fg-tertiary: #87867f;
    --app-fg-dark: #3d3d3a;
    --app-accent-light: #d97757;
    --app-error: #b53333;
    --app-focus: #3898ec;
    --app-border-strong: #e8e6dc;
    --app-ring-warm: #d1cfc5;
    --app-shadow-whisper: rgba(0, 0, 0, 0.05) 0px 4px 24px;

    --app-radius-sm: 4px;
    --app-radius-md: 8px;
    --app-radius-lg: 12px;
    --app-radius-xl: 16px;
    --app-radius-2xl: 24px;
```

- [ ] **Step 3: 在 `[data-theme="dark"]` 块末尾添加对应的暗色变量**

在现有 `[data-theme="dark"]` 中 `--app-ring` 之后追加：

```css
    --app-fg-tertiary: #87867f;
    --app-fg-dark: #d1cfc5;
    --app-accent-light: #e8956e;
    --app-error: #e05a5a;
    --app-focus: #3898ec;
    --app-border-strong: #3d3d3a;
    --app-ring-warm: #4d4c48;
    --app-shadow-whisper: rgba(0, 0, 0, 0.2) 0px 4px 24px;
```

- [ ] **Step 4: 微调现有边框色**

将 `--app-border` 从 `#ebe7dc` 调整为 `#f0eee6`（Border Cream，与设计稿一致）：
```
:root 中 --app-border: #f0eee6;
dark 中 --app-border: rgba(245, 241, 232, 0.1); （保持不变，已经合适）
```

- [ ] **Step 5: 运行 typecheck 和 dev 验证无破坏**

Run: `cd web && bunx tsc --noEmit && bun run dev:web`

Expected: 编译无错误，页面正常显示

- [ ] **Step 6: Commit**

```bash
git add web/src/index.css
git commit -m "style(web): 补充设计系统令牌，新增圆角梯度、ring 阴影、三级文字色等变量"
```

### Task 1.2: 重写 Button 组件变体

**Files:**
- Modify: `web/src/components/ui/button.tsx`

**观察：** 现有 Button 已有 `default`/`secondary`/`outline`/`destructive`/`inverted` 变体。设计稿需要 `warm-sand`/`terracotta`/`dark-charcoal`/`outline` 四种。映射关系：`default`≈terracotta, `secondary`≈warm-sand, `inverted`≈dark-charcoal。

- [ ] **Step 1: 更新 button.tsx 的变体定义**

将现有 `buttonVariants` 的 variants 更新为：

```tsx
const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--app-radius-lg)] text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
    {
        variants: {
            variant: {
                default: 'border border-transparent bg-[var(--app-button)] text-[var(--app-button-text)] shadow-[0_0_0_1px_var(--app-ring-warm)] hover:brightness-[0.98]',
                secondary: 'bg-[var(--app-subtle-bg)] text-[var(--app-fg)] shadow-[0_0_0_1px_var(--app-ring-warm)] hover:bg-[var(--app-panel-muted-bg)]',
                outline: 'border border-[var(--app-border)] bg-transparent text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]',
                destructive: 'border border-transparent bg-[var(--app-error)] text-white hover:opacity-90',
                inverted: 'border border-[var(--app-border)] bg-[var(--app-fg)] text-[var(--app-bg)] hover:opacity-90',
                ghost: 'text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]',
            },
            size: {
                default: 'h-10 px-4',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-11 px-6',
                icon: 'h-8 w-8',
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
)
```

- [ ] **Step 2: 运行 typecheck 确认 Button 变更不破坏现有使用**

Run: `cd web && bunx tsc --noEmit`

Expected: 无类型错误

- [ ] **Step 3: 启动 dev 验证所有使用 Button 的页面外观正常**

Run: `cd web && bun run dev:web`

Expected: 登录页、会话列表、聊天页等页面的按钮样式正确

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ui/button.tsx
git commit -m "style(web): 更新 Button 组件变体，对齐 Claude 暖色设计系统"
```

### Task 1.3: 更新 Card 和 Dialog 组件

**Files:**
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/ui/dialog.tsx`

**观察：** 现有 Card/Dialog 已经使用了 CSS 变量（`--app-radius-panel`, `--app-border` 等），与设计系统基本一致。只需要微调圆角和阴影。

- [ ] **Step 1: 更新 Card 组件添加 shadow-whisper 变体支持**

现有 Card 已经正确使用 `--app-radius-panel` 和 `--app-panel-bg`。保持不变即可，因为 CSS 变量会在子计划 1 的 Task 1.1 中更新。

验证 Card 无需代码改动。

- [ ] **Step 2: 更新 Dialog 的圆角和遮罩**

现有 Dialog 使用 `rounded-[28px]` 和 `shadow-[var(--app-shadow-md)]`，与设计稿的 20px 圆角 + whisper shadow 接近。保持不变。

验证 Dialog 无需代码改动。

- [ ] **Step 3: 运行 typecheck 确认**

Run: `cd web && bunx tsc --noEmit`

Expected: 无错误

- [ ] **Step 4: Commit（如果有改动）**

如果 Card/Dialog 无需改动，跳过此步。

### Task 1.4: 验证 ConfirmDialog 和 Toast 组件

**Files:**
- Read: `web/src/components/ui/ConfirmDialog.tsx`
- Read: `web/src/components/ui/Toast.tsx`
- Read: `web/src/components/ToastContainer.tsx`

**观察：** 现有代码已有 ConfirmDialog 和 Toast。检查是否需要调整样式。

- [ ] **Step 1: 读取 ConfirmDialog.tsx 确认样式**

现有 ConfirmDialog 使用 `Card` + `Button` 组件，已使用 CSS 变量。设计稿要求圆角 20px 卡片 + 图标 + 标题 + 描述 + Cancel/Danger 按钮。

如果现有样式与设计稿差距大，则需要调整。

- [ ] **Step 2: 读取 Toast.tsx 确认样式**

设计稿要求：底部居中、border-radius 12px、0.3s 滑入动画。

- [ ] **Step 3: 如需调整则修改并 Commit**

### Task 1.5: 运行完整测试套件

- [ ] **Step 1: 运行 web 测试**

Run: `cd web && bunx vitest run`

Expected: 所有测试通过

- [ ] **Step 2: 运行 typecheck**

Run: `cd web && bunx tsc --noEmit`

Expected: 无类型错误

- [ ] **Step 3: Commit 所有设计系统变更（如有未提交的）**

```bash
git add -A
git commit -m "style(web): 完成设计系统基础层更新，CSS 变量 + 基础组件对齐 Claude 暖色设计系统"
```

---

# 子计划 2：路由 + Shell 布局

**Goal:** 重构路由树，创建桌面端顶栏导航和移动端底部 Tab Bar，实现响应式双模式 Shell 布局。

**设计稿对照文件：**
- Tab Bar → `web/design/redesign-ab-hybrid.html` 底部 Tab Bar 结构
- 导航模式 → `web/design/DESIGN.md` 第 4 节 Navigation
- 响应式 → `web/design/DESIGN.md` 第 8 节 Responsive Behavior

**开发纪律：** 对照所有 redesign-*.html 中共享的 Tab Bar 和导航结构，确保 5 个 Tab 的图标、间距、badge 样式一致。

### Task 2.1: 创建新路由树

**Files:**
- Modify: `web/src/router.tsx`
- Create: `web/src/components/layout/AppShell.tsx`
- Create: `web/src/components/layout/DesktopNav.tsx`
- Create: `web/src/components/layout/MobileTabBar.tsx`
- Create: `web/src/components/layout/SessionsShell.tsx`

- [ ] **Step 1: 创建 `AppShell` 组件 — 顶层布局容器**

桌面端：顶栏 + 内容区
移动端：内容区 + 底部 Tab Bar

- [ ] **Step 2: 创建 `DesktopNav` — 桌面端顶栏**

Logo + 导航链接（Sessions / Machines / History / Settings）+ 主题切换按钮

- [ ] **Step 3: 创建 `MobileTabBar` — 移动端底部 Tab Bar**

5 个 Tab：Sessions（badge）/ Machines / FAB(+New) / History / Settings

- [ ] **Step 4: 创建 `SessionsShell` — Sessions 双栏/单栏自适应**

桌面端：左栏 SessionList（~420px）+ 右栏 Outlet
移动端：全宽内容

- [ ] **Step 5: 重构 `router.tsx` 路由树**

```
/ → 重定向 /sessions
/login → LoginPage
/sessions → SessionsShell
  /sessions/$sessionId → ChatPage
  /sessions/$sessionId/terminal → TerminalPage
  /sessions/$sessionId/files → FilesPage
  /sessions/$sessionId/file → FilePage
/machines → MachinesPage
/history → HistoryPage
/settings → SettingsPage
```

移除 `/sessions/new` 独立路由，改为 state 驱动的 Modal。

- [ ] **Step 6: 验证导航守卫**

未登录 → 重定向 `/login`，`/sessions/$sessionId/*` 移动端隐藏 Tab Bar

- [ ] **Step 7: Commit**

```bash
git add web/src/router.tsx web/src/components/layout/
git commit -m "feat(web): 重构路由树，新增 AppShell 双模式布局和移动端 Tab Bar"
```

### Task 2.2: 保留 SSE / Banner / PWA 等平台级功能

**Files:**
- Modify: `web/src/components/layout/AppShell.tsx`（集成 OfflineBanner / SyncingBanner / ReconnectingBanner / InstallPrompt / VoiceErrorBanner）

- [ ] **Step 1: 在 AppShell 中集成所有现有 Banner 组件**

使用新样式包裹：OfflineBanner、SyncingBanner、ReconnectingBanner、InstallPrompt、VoiceErrorBanner

- [ ] **Step 2: 验证 Telegram Mini App 适配**

确认 TG 环境下 Tab Bar 隐藏、BackButton 管理正常

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): 在 AppShell 中集成平台级功能（SSE/Banner/PWA/TG 适配）"
```

---

# 子计划 3：独立页面

**Goal:** 重建 LoginPage、SettingsPage、MachinesPage，新建 HistoryPage。

**设计稿对照文件：**
- Login → `web/design/redesign-login.html`
- Settings → `web/design/redesign-settings.html`
- Machines → `web/design/redesign-machines.html`
- History → `web/design/redesign-history.html`

**开发纪律：** 每个页面实现时，打开对应的 `redesign-*.html`，逐区域比对 HTML 结构和 CSS 样式。改写前先列出现有组件的全部功能清单，改写后逐一核对。

### Task 3.1: LoginPage 重建

**Files:**
- Rewrite: `web/src/components/LoginPrompt.tsx`
- Add i18n keys: `web/src/lib/locales/en.ts`, `web/src/lib/locales/zh-CN.ts`

- [ ] 按设计稿 `redesign-login.html` 重写 LoginPrompt
- [ ] 保留：Access Token 输入、Hub Server 配置对话框、语言切换、主题切换
- [ ] 新样式：Serif 标题 "Welcome Back"、Terracotta 渐变 "Sign In" 按钮、居中卡片
- [ ] Commit

### Task 3.2: SettingsPage 重建

**Files:**
- Rewrite: `web/src/routes/settings/index.tsx`

- [ ] 按设计稿 `redesign-settings.html` 重写
- [ ] 保留：语言切换、Dark Mode、字体缩放、终端字号、语音语言
- [ ] 新增：Voice Assistant 开关、Notifications 区域（Push/Telegram）、Server 信息区、About 链接、Danger Zone 登出
- [ ] Commit

### Task 3.3: MachinesPage 新建

**Files:**
- Create: `web/src/routes/machines/index.tsx`
- Create: `web/src/components/MachineCard.tsx`
- Create: `web/src/components/MachineDetailDrawer.tsx`

- [ ] 按设计稿 `redesign-machines.html` 新建
- [ ] 功能：机器卡片列表 + 在线状态 + 详情 Drawer + New Session 按钮 + Runner Error 显示 + 空状态 + 骨架屏
- [ ] Commit

### Task 3.4: HistoryPage 新建

**Files:**
- Create: `web/src/routes/history/index.tsx`
- Create: `web/src/components/HistoryList.tsx`
- Add i18n keys

- [ ] 按设计稿 `redesign-history.html` 新建
- [ ] 功能：搜索 + 筛选 Chips + 统计栏 + 时间分组列表 + 操作（Restore/Archive/Delete）
- [ ] 复用现有 `useSessionActions` hook 和 hub API
- [ ] Commit

---

# 子计划 4：会话页面

**Goal:** 重建 SessionList、NewSession Modal、ChatPage（最复杂的部分）。

**设计稿对照文件：**
- SessionList → `web/design/redesign-ab-hybrid.html`
- NewSession → `web/design/redesign-new-session.html`
- ChatPage → `web/design/redesign-chat.html`

**开发纪律：** ChatPage 是最复杂的页面，设计稿 ~3500 行 HTML。实现时按 3.3 的 10 个子节逐一对照。改写每个子组件前先读现有代码列出完整功能清单。

### Task 4.1: SessionList 重建

**Files:**
- Rewrite: `web/src/components/SessionList.tsx`
- Create: `web/src/components/SessionGroup.tsx`
- Create: `web/src/components/SessionCard.tsx`
- Create: `web/src/components/BatchActionBar.tsx`

- [ ] 按设计稿 `redesign-ab-hybrid.html` 重写
- [ ] 保留：按项目分组、状态指示灯、批量删除、右键菜单、重命名/归档/删除对话框
- [ ] 新增：折叠 GroupCard、Duplicate 菜单项、Select Multiple、批量 Archive
- [ ] Commit

### Task 4.2: NewSession Modal 重建

**Files:**
- Rewrite: `web/src/components/NewSession/index.tsx`
- Rewrite: `web/src/components/NewSession/MachineSelector.tsx`
- Rewrite: `web/src/components/NewSession/AgentSelector.tsx`
- Rewrite: `web/src/components/NewSession/ModelSelector.tsx`
- Rewrite: `web/src/components/NewSession/ClaudeEffortSelector.tsx`
- Rewrite: `web/src/components/NewSession/ReasoningEffortSelector.tsx`
- Rewrite: `web/src/components/NewSession/DirectorySection.tsx`
- Rewrite: `web/src/components/NewSession/SessionTypeSelector.tsx`
- Rewrite: `web/src/components/NewSession/YoloToggle.tsx`
- Rewrite: `web/src/components/NewSession/ActionButtons.tsx`

- [ ] 按设计稿 `redesign-new-session.html` 重写为 Modal/Sheet 形式
- [ ] 保留所有现有功能：5 种 Agent、动态 Model、Effort、Worktree、YOLO、路径补全、Spawn Session
- [ ] Commit

### Task 4.3: ChatPage 重建 — Header + 状态横幅

**Files:**
- Rewrite: `web/src/components/SessionHeader.tsx`

- [ ] 按设计稿 `redesign-chat.html` 重写 Header
- [ ] 保留：返回按钮、标题、状态点、操作菜单（Rename/Archive/Delete）、TG 隐藏
- [ ] 新样式：磨砂玻璃、Terracotta 状态点、pill badge
- [ ] Commit

### Task 4.4: ChatPage 重建 — 消息线程

**Files:**
- Rewrite: `web/src/components/AssistantChat/HappyThread.tsx`
- Rewrite: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`
- Rewrite: `web/src/components/AssistantChat/messages/UserMessage.tsx`
- Rewrite: `web/src/components/AssistantChat/messages/SystemMessage.tsx`

- [ ] 用新样式重写消息气泡：用户消息（暖色渐变背景）、助手消息（Ivory 面板 + 边框）、系统消息（居中胶囊）
- [ ] 保留：自动滚动、加载更多、滚动位置恢复、新消息指示器、骨架屏、Copy 按钮、CLI Output
- [ ] Commit

### Task 4.5: ChatPage 重建 — ToolCard

**Files:**
- Rewrite: `web/src/components/ToolCard/ToolCard.tsx`

- [ ] 用新样式重写 ToolCard 容器
- [ ] 保留所有 `knownTools` 注册表（25+ 种工具）
- [ ] 保留 PermissionFooter、AskUserQuestionFooter、RequestUserInputFooter
- [ ] 保留所有 views：EditView、MultiEditView、WriteView、CodexDiffView、CodexPatchView、TodoWriteView、ExitPlanModeView、UpdatePlanView、AskUserQuestionView、RequestUserInputView
- [ ] Commit

### Task 4.6: ChatPage 重建 — Composer + StatusBar

**Files:**
- Rewrite: `web/src/components/AssistantChat/HappyComposer.tsx`
- Rewrite: `web/src/components/AssistantChat/ComposerButtons.tsx`
- Rewrite: `web/src/components/AssistantChat/StatusBar.tsx`

- [ ] 用新样式重写 Composer 容器、输入框、按钮栏
- [ ] 保留所有功能：附件、图片粘贴、自动补全（@/$//）、设置浮层（权限/协作/模型/effort）、全屏编辑、草稿保存、Continue Hint、Codex 命令校验、语音按钮、UnifiedButton
- [ ] 保留 StatusBar：连接状态（5 种）、Context 用量、后台任务、权限/协作模式标签
- [ ] Commit

### Task 4.7: ChatPage — SessionChat 整合

**Files:**
- Rewrite: `web/src/components/SessionChat.tsx`
- Rewrite: `web/src/components/TeamPanel.tsx`（新样式）

- [ ] 整合新 Header + HappyThread + HappyComposer
- [ ] 保留：消息处理管线、权限/协作/模型/effort 切换 handler、语音集成、TeamPanel、非活跃/网络恢复横幅
- [ ] Commit

---

# 子计划 5：沿用页面壳样式

**Goal:** 更新 FilesPage、FilePage、TerminalPage 的外层容器和 Header 样式，内部组件沿用。

**设计稿对照文件：**
- Files → `web/design/redesign-files.html`
- File → `web/design/redesign-file.html`
- Terminal → `web/design/redesign-terminal.html`

**开发纪律：** 这三个页面只改外层壳（容器 + Header + 状态提示），内部组件（xterm.js / 文件树 / DiffView / Git 操作逻辑）完全沿用。对照设计稿时重点关注 Header 布局、容器圆角和配色、Quick Input 栏等外层元素。

### Task 5.1: FilesPage 外层壳重设计

**Files:**
- Rewrite: `web/src/routes/sessions/files.tsx`（Header + 容器部分）

- [ ] 新外层容器：全屏卡片（margin 8px, radius 24px, `--app-panel-bg`）
- [ ] 新 Header：圆形返回按钮 + serif 标题 + meta 行 + Refresh pill + 搜索 pill + Tab pill 切换
- [ ] 新文件行样式：file-icon + file-name + mono path + +绿-红统计 + status pill badge
- [ ] 新 section header：`--app-subtle-bg` 背景
- [ ] 新确认对话框和 Toast
- [ ] 沿用内部：DirectoryTree、Git 操作、文件搜索逻辑
- [ ] Commit

### Task 5.2: FilePage 外层壳重设计

**Files:**
- Rewrite: `web/src/routes/sessions/file.tsx`（Header + 容器部分）

- [ ] 新外层容器和 Header（同 FilesPage 风格）
- [ ] Diff/File 模式切换按钮（pill 形态）
- [ ] 新代码容器：圆角 20px + Copy pill 按钮
- [ ] 新 Diff 容器：圆角 12px
- [ ] 沿用内部：DiffView、Shiki 代码高亮
- [ ] Commit

### Task 5.3: TerminalPage 外层壳重设计

**Files:**
- Rewrite: `web/src/routes/sessions/terminal.tsx`（Header + 容器 + Quick Input 部分）

- [ ] 新外层容器和 Header（连接状态灯 + Paste 按钮）
- [ ] 新终端区域：黑底 + 圆角 8px
- [ ] 新 Quick Input 栏：两行快捷键网格 + 命令输入框 + Send 按钮
- [ ] 新粘贴对话框：圆角 20px Modal
- [ ] 沿用内部：xterm.js、WebSocket 管理、终端逻辑
- [ ] Commit

---

## 执行顺序与依赖图

```
子计划 1（设计系统）
    ↓
子计划 2（路由 + Shell）
    ↓
    ├── 子计划 3（独立页面）
    ├── 子计划 5（沿用页面壳）  ← 可与子计划 3 并行
    ↓
子计划 4（会话页面）  ← 依赖子计划 3 的 Login 和 Settings
```

**推荐执行顺序：** 1 → 2 → 3 → 5 → 4

每个子计划完成后运行：
```bash
cd web && bunx tsc --noEmit && bunx vitest run
```

---

## 开发纪律

每个 Task 执行时必须遵循以下两条规则：

1. **对齐设计稿：** 开发每个页面/组件时，必须对照 `web/design/redesign-*.html` 中的 HTML 原型，逐一比对样式（颜色、圆角、间距、字体）、布局（flex/grid 结构、间距比例）和交互（hover/active 状态、动画、响应式断点）。设计稿中的每个 UI 细节都要落地到代码中。

2. **不遗漏旧功能：** 改写每个组件前，先完整阅读现有代码，列出该组件的全部功能点。改写后逐一核对，确保每个功能都有对应实现。如果发现 spec 和本计划中未提及的现有功能，主动补充，不得丢弃。

---

## Spec 覆盖检查

| Spec 章节 | 对应任务 | 状态 |
|-----------|---------|------|
| 1. 设计系统（CSS 变量） | Task 1.1 | ✅ |
| 1.3 基础组件（Button/Card/Dialog） | Task 1.2-1.4 | ✅ |
| 2. 路由结构 | Task 2.1 | ✅ |
| 2.2 Shell 布局 | Task 2.1-2.2 | ✅ |
| 3.1 LoginPage | Task 3.1 | ✅ |
| 3.2 SessionList | Task 4.1 | ✅ |
| 3.3 ChatPage（10 个子节） | Task 4.3-4.7 | ✅ |
| 3.4 NewSession | Task 4.2 | ✅ |
| 3.5 SettingsPage | Task 3.2 | ✅ |
| 3.6 MachinesPage | Task 3.3 | ✅ |
| 3.7 HistoryPage | Task 3.4 | ✅ |
| 3.8 FilesPage | Task 5.1 | ✅ |
| 3.9 FilePage | Task 5.2 | ✅ |
| 3.10 TerminalPage | Task 5.3 | ✅ |
| 4.1 功能保留（27 项） | 各 Task 中保留 | ✅ |
| 4.2 新增功能（18 项） | 各 Task 中对接 | ✅ |
| 5. 开发原则 | 全程遵循 | ✅ |
