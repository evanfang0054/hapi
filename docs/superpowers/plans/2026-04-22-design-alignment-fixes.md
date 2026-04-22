# 设计稿对齐修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 9 页面设计稿对比中发现的全部 P0/P1/P2 差异，使 React 实现与设计稿一致。

**Architecture:** 按子系统/页面分为多个独立可提交的任务。Task 1-7 已完成，剩余 Task 9/10/11 及新增 Task 12-17 待执行。

**Tech Stack:** React 19, TanStack Router/Query, Tailwind CSS, Vitest, i18n (en.ts/zh-CN.ts)

---

## 执行顺序

```
Task 9 (NewSession 改页面+全面对齐) → Task 10 (Chat 全面对齐) → Task 11 (下拉框遮挡修复)
→ Task 12 (Sessions List 细节对齐) → Task 13 (Login Server Dialog 修复)
→ Task 14 (Terminal 全面对齐) → Task 15 (Files Confirm Dialog 对齐)
→ Task 16 (Machines 细节对齐) → Task 17 (History 细节对齐)
```

Task 9-11 相互独立可并行。Task 12-17 为第二轮对齐，相互独立可并行。

---

## 已完成任务 (Task 1-7)

### Task 1: 全局 CSS 设计令牌 + Shimmer 动画 ✅
- Commit: `fd3a9c0` — `--app-radius-panel: 24px`, `--app-radius-control: 16px`, shadow 增强, 全局 shimmer 动画

### Task 2: Login 品牌回退 + UI 微调 ✅
- Commit: `cff0764` — z-index z-100, subtitle leading-relaxed, error icon w-3.5, disabled cursor, heart #e25555, CSS spinner

### Task 3: Files 页 Toast + Empty State + Renamed oldPath + 图标 ✅
- Commit: `01d1f7b` — toast 集成, empty state 圆形图标, renamed oldPath, trash icon, monospace 字体, search highlight

### Task 4: Files 确认对话框 + File Viewer Binary/Error/Toast ✅
- Commit: `bc205ae` — confirm dialog 文件列表, binary/error 圆形图标状态, copy toast

### Task 5: History 过滤功能修复 ✅
- Commit: `f77540f` — metadata archived/deleted 提取, filter-specific 空状态

### Task 6: Machines 页修复 ✅
- Commit: `ac14236` — runner error, active machines section title

### Task 7: Terminal 标题 + Settings 图标 + Sessions 主题切换 ✅
- Commit: `cbcbe85` — terminal title, settings dark mode icon, sessions theme toggle

### Task 8 (已合并到 Task 9) ✅
- Commit: `09260e9` — directory folder icon, effort selector alignment

### Bug fix ✅
- Commit: `6eb501a` — addToast body field type fix

---

## 第二轮全面对比结果摘要

8 个并行 agent 逐页对比设计稿与 React 实现后，发现以下新差异（排除已修复项）：

| 页面 | P0 | P1 | P2 | 核心问题 |
|------|----|----|-----|---------|
| Login | 2 | 7 | 7 | Server Dialog overlay/按钮样式、CSS 变量色差 |
| Sessions List | 4 | 11 | 11 | 卡片 grid 布局、tag 形状(rounded-full vs 6px)、inactive dot opacity、agent 标签无背景 |
| NewSession | 5 | 13 | 14 | 全页面 vs Dialog、header 结构、directory input、recent paths、select 圆角 |
| Chat | 1 | 6 | 1 | timestamps 缺失、composer 形态、back button、scroll-to-bottom |
| Machines | 0 | 4 | 4 | session badges 缺失、dark mode 细节、stats bar |
| History | 1 | 4 | 4 | preview content 语义(摘要 vs 路径)、filter chip 图标、action icons |
| Settings | 2 | 4 | 4 | overflow-hidden 裁剪 dropdown、section 内容差异 |
| Files+Terminal | 5 | 10 | 15 | confirm dialog 居中/按钮布局、终端背景色、状态指示器颜色、终端圆角 |

---

## Task 9: NewSession 从 Dialog 改为独立页面路由 + 全面对齐设计稿

**问题:** 设计稿是全页面，React 当前是 Radix Dialog 弹窗。需改为独立页面路由，并对齐所有布局、样式、交互差异。

**对比发现:** 5 P0 / 13 P1 / 14 P2

**Files:**
- Create: `web/src/routes/new-session.tsx`
- Modify: `web/src/router.tsx`
- Modify: `web/src/components/layout/AppShell.tsx`
- Modify: `web/src/components/NewSession/index.tsx`
- Modify: `web/src/components/NewSession/DirectorySection.tsx`
- Modify: `web/src/components/NewSession/ModelSelector.tsx`
- Modify: `web/src/components/NewSession/ClaudeEffortSelector.tsx`
- Modify: `web/src/components/NewSession/ReasoningEffortSelector.tsx`

### 核心差异

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| 容器 | 全页面 body flex-col | Radix Dialog modal | P0 |
| Header | sticky: Cancel(左) + serif italic 标题(中) + Create(右) | 无 header, ActionButtons 在底部 | P0 |
| Directory input | folder icon + input + Browse 按钮 | 只有 input (已有 folder icon) | P0 |
| Recent paths | 垂直列表 + clock icon | 横向 pill chips | P0 |
| Select 圆角 | 12px | 18px (rounded-[18px]) | P1 |
| Select 焦点 | border-color: var(--link) | ring-2 ring-[var(--app-link)] | P1 |
| Select 阴影 | 无 | shadow-[var(--app-shadow-sm)] | P2 |
| Section 分组 | 扁平: Machine/Working Directory/Agent/Session Type/Behavior | 分组: Workspace/Runtime/Behavior | P1 |
| Section label | 12px, font-weight 600, tracking 0.5px | 11px, tracking 0.14em | P1 |
| 控件 min-h | 由 padding 决定 (~38px) | min-h-12 (48px) | P1 |
| Directory 字体 | font-mono | sans-serif | P1 |

### 实施步骤

- [ ] **Step 1: 创建新路由文件** `web/src/routes/new-session.tsx`
- [ ] **Step 2: 注册路由** `web/src/router.tsx`
- [ ] **Step 3: 修改 AppShell** — 移除 Dialog, 改用 `navigate('/new-session')`
- [ ] **Step 4: 重构 NewSession/index.tsx** — 全页面布局 + sticky header (Cancel + serif italic 标题 + Create)
- [ ] **Step 5: 扁平 Section 布局** — 移除 Workspace/Runtime/Behavior 分组, 改为独立 section labels
- [ ] **Step 6: Select 圆角和焦点样式** — `rounded-[18px]` → `rounded-xl (12px)`, 移除 shadow, focus 改 border-color
- [ ] **Step 7: Directory Section** — 添加 Browse 按钮, input font-mono, 圆角 14px
- [ ] **Step 8: Recent paths** — 从横向 pills 改为垂直列表 + clock icon + font-mono
- [ ] **Step 9: 控件 min-h** — `min-h-12` → 移除或减小
- [ ] **Step 10: 添加 i18n keys** (newSession.cancel, section labels, browse)
- [ ] **Step 11: 运行测试和构建**
- [ ] **Step 12: 提交**

---

## Task 10: Chat 页全面对齐设计稿

**问题:** Chat 页标题字体、back button、timestamps、composer 形状等多处差异。

**对比发现:** 1 P0 / 6 P1 / 1 P2

**Files:**
- Modify: `web/src/components/SessionHeader.tsx`
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/components/AssistantChat/ComposerButtons.tsx`
- Modify: `web/src/components/AssistantChat/HappyThread.tsx` (scroll-to-bottom)
- Modify: `web/src/components/AssistantChat/messages/UserMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`

### 核心差异

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| Message timestamps | 每条消息有时间 (10px, hint color) | 无 | P0 |
| Chat panel wrapper | 无 panel, 消息直接在 bg 上 | bordered elevated panel (960px) | P1* |
| Header title | serif italic, 16px, weight 500 | sans-serif semibold | P1 |
| Back button | 36x36 icon-only, fg color | text link + "Back" label | P1 |
| Action buttons | 36x36, 18px icons | 32x32, 16px icons | P2 |
| Composer | pill 单行 (radius 20px) | 多段 panel (radius 24px) | P1 |
| Send/Abort | 36x36, 复用同一按钮位置 | 32x32, 独立按钮 | P1 |
| Scroll-to-bottom | 右下角 fixed 40x40 circle | 居中 pill + 文字 | P1 |

> *P1: 保留 React 的 panel wrapper (提供更好的视觉层次)，仅对齐内部样式

### 实施步骤

- [ ] **Step 1: Header title** — serif italic, `font-medium italic` + `fontFamily: 'var(--app-font-serif)'`
- [ ] **Step 2: Back button** — 改为 36x36 icon-only, fg color, 无文字
- [ ] **Step 3: Action buttons 尺寸** — `h-8 w-8` → `w-9 h-9`, 图标 `w-[18px] h-[18px]`
- [ ] **Step 4: Message timestamps** — 在 UserMessage/AssistantMessage 中添加时间显示 (10px, hint color)
- [ ] **Step 5: Composer 形状** — `rounded-[var(--app-radius-panel)]` → `rounded-[20px]`, 移除 shadow
- [ ] **Step 6: Send button 尺寸** — `h-8 w-8` → `w-9 h-9`
- [ ] **Step 7: Scroll-to-bottom** — 从居中 pill 改为右下角 fixed circle
- [ ] **Step 8: 运行测试和构建**
- [ ] **Step 9: 提交**

---

## Task 11: 下拉框遮挡问题修复

**问题:** 多处下拉菜单被父容器 `overflow-hidden` 裁剪。

**对比发现:** 2 P0 (Settings), 2 P0 (Chat)

**Files:**
- Modify: `web/src/routes/settings/index.tsx` (SettingsCard overflow-hidden)
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx` (composer overflow-hidden)
- Modify: `web/src/components/SessionChat.tsx` (chat panel overflow-hidden)
- Modify: `web/src/components/SessionActionMenu.tsx` (z-index)

### 问题清单

| # | 严重度 | 组件 | 问题 |
|---|--------|------|------|
| 1 | P0 | Settings SettingsCard | `overflow-hidden` 裁剪 DropdownMenu |
| 2 | P0 | HappyComposer | `overflow-hidden` 裁剪 settings panel/autocomplete |
| 3 | P0 | SessionChat | `overflow-hidden` 进一步裁剪 (双重裁剪) |
| 4 | MEDIUM | SessionActionMenu | z-50 被 MobileTabBar z-90 遮挡 |

### 实施步骤

- [ ] **Step 1: Settings** — 移除 SettingsCard overflow-hidden, 用 `first:`/`last:` 圆角替代
- [ ] **Step 2: Composer** — 将 overlay 从 overflow-hidden 区域移出或用 Portal
- [ ] **Step 3: SessionActionMenu** — z-50 → z-100
- [ ] **Step 4: 运行测试和构建**
- [ ] **Step 5: 提交**

---

## Task 12: Sessions List 细节对齐

**问题:** 卡片内部布局、tag 形状、badge 样式等多处差异。

**对比发现:** 4 P0 / 11 P1 / 11 P2

**Files:**
- Modify: `web/src/components/SessionList.tsx`

### 核心差异 (仅列出 P0/P1)

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| 卡片布局 | CSS Grid 三列 (10px + 1fr + auto) | Flexbox (flex items-start gap-3) | P0 |
| 右侧面板 | 独立 flex-col (more + time + agent) 垂直排列 | 时间在顶部, more 在右侧, agent 在底部 tag 行 | P0 |
| Inactive dot | opacity 0.4 | 无 opacity | P0 |
| Tag 形状 | rounded-[6px] 小圆角矩形 | rounded-full 药丸形 | P0 |
| Tag 字体 | font-mono, 10px | sans-serif, 12px | P1 |
| Thinking badge | `● thinking` (带圆点前缀) | 纯文本 | P1 |
| Pending tag | warning 色系 (rgba(197,138,58,...)) | badge-warning CSS 变量 | P1 |
| Todo tag | success/green 色系 | 中性色 (border + panel-bg) | P1 |
| Model tag | fg 色文字 | hint 色文字 | P1 |
| Agent 标签 | 无背景纯文本, font-mono 10px | rounded-full tag + ❖ 图标 | P1 |
| Group header | 展开时有 border-bottom | 无 | P1 |
| Session time | font-mono 11px | sans-serif + pill 背景 | P1 |

### 实施步骤

- [x] **Step 1: Tag 形状** — `rounded-full` → `rounded-[6px]`, padding `3px 8px`
- [x] **Step 2: Tag 字体** — 添加 `font-mono text-[10px]`
- [x] **Step 3: Inactive dot** — 添加 `opacity-40`
- [x] **Step 4: Thinking badge** — 添加 `●` 圆点前缀
- [x] **Step 5: Todo tag 颜色** — 改为 success/green 色系
- [x] **Step 6: Agent 标签** — 改为无背景纯文本, font-mono 10px
- [x] **Step 7: Session time** — font-mono 11px, 移除 pill 背景
- [x] **Step 8: Group header** — 展开时添加 border-bottom
- [x] **Step 9: 运行测试和构建**
- [x] **Step 10: 提交**

---

## Task 13: Login Server Dialog 修复

**问题:** Server Dialog (Hub Default 弹窗) 样式与设计稿不一致。

**对比发现:** 2 P0 / 7 P1 / 7 P2 (仅列出 Server Dialog 相关)

**Files:**
- Modify: `web/src/components/LoginPrompt.tsx` (server dialog 部分)
- Modify: `web/src/components/ui/dialog.tsx` (共用 Dialog 组件)

### 核心差异

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| Dialog overlay | `rgba(0,0,0,0.4)` 纯黑半透明, 无模糊 | `rgba(20,20,19,0.38)` + `backdrop-blur-[2px]` | P0 |
| Dialog 按钮样式 | secondary: subtle-bg + border + fg; primary: link + white | shadcn/ui Button (外观差距明显) | P0 |
| Dialog 圆角 | 24px (radius-panel) | 28px | P1 |
| Dialog 面板背景 | panel-bg | panel-elevated-bg | P1 |
| Dialog max-width | 420px | 448px (max-w-md) | P1 |
| Dialog title | serif, weight 500 | sans-serif, weight 600 | P1 |
| Dialog padding | 24px | 20px | P2 |
| Actions gap | 12px | 8px | P2 |
| Dialog 动画 | translateY(20px) → 0 + overlay opacity | 无动画 | P1 |

### 实施步骤

- [x] **Step 1: Dialog overlay** — 移除 `backdrop-blur`, 改为 `rgba(0,0,0,0.4)`, dark 模式 `rgba(0,0,0,0.6)`
- [x] **Step 2: Dialog 圆角** — `rounded-[28px]` → `rounded-[24px]`
- [x] **Step 3: Dialog 面板背景** — panel-elevated-bg → panel-bg
- [x] **Step 4: Dialog max-width** — max-w-xl → max-w-[420px]
- [x] **Step 5: Dialog title** — 添加 serif italic + weight 500
- [x] **Step 6: Dialog padding** — p-5 → p-6
- [ ] **Step 7: Dialog 按钮样式** — secondary: subtle-bg + border + fg 12px radius; primary: link + white 12px radius
- [ ] **Step 8: Dialog 滑入动画** — 添加 translateY + opacity 过渡
- [x] **Step 9: 运行测试和构建**
- [x] **Step 10: 提交**

---

## Task 14: Terminal 全面对齐

**问题:** 终端背景色、连接状态指示器颜色、终端区域圆角、Quick Input 样式差异。

**对比发现:** 3 P0 / 5 P1 / 6 P2

**Files:**
- Modify: `web/src/routes/sessions/terminal.tsx`
- Modify: `web/src/index.css` (终端相关 CSS 变量)

### 核心差异

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| 终端背景色 | 固定深色 `#1a1a1a` | light 模式 `#f3f0e8` (浅色!) | P0 |
| 连接状态指示器 | `--success` / `--warning` CSS 变量 | 硬编码 Tailwind `emerald-500` / `amber-400` | P0 |
| 终端区域圆角 | 8px | 无圆角 | P0 |
| Header title | 18px, italic, serif, weight 500 | 16px/20px, 无 italic | P1 |
| Quick Input 外框 | border-top, 无圆角/阴影 | rounded-[24px] + shadow + border | P1 |
| Send 按钮 | background: var(--link), 无 ring | Button default + ring-warm shadow | P1 |
| 指示器尺寸 | 8px | 10px (h-2.5 w-2.5) | P2 |
| Paste 按钮 | 8px 圆角, panel-elevated-bg | 12px 圆角, subtle-bg | P2 |

### 实施步骤

- [x] **Step 1: 终端背景色** — light 模式下改为固定深色或使用独立 CSS 变量 (使用 --app-code-bg)
- [x] **Step 2: 连接状态指示器** — `bg-emerald-500` → `bg-[var(--app-badge-success-text)]`, `bg-amber-400` → `bg-[var(--app-badge-warning-text)]`
- [x] **Step 3: 终端区域圆角** — 添加 `rounded-lg` (8px)
- [x] **Step 4: Header title** — 已使用 data-ui-heading="serif"
- [x] **Step 5: Quick Input** — 移除 rounded/shadow, 改为 border-top
- [x] **Step 6: Send 按钮** — 使用 link 色背景 12px radius
- [x] **Step 7: 指示器尺寸** — `h-2.5 w-2.5` → `h-2 w-2` (8px)
- [x] **Step 8: 运行测试和构建**
- [x] **Step 9: 提交**

---

## Task 15: Files Confirm Dialog 对齐

**问题:** Confirm dialog 对齐方式、按钮布局、danger 图标、warning 提示块缺失。

**对比发现:** 2 P0 / 2 P1 (dialog 相关部分)

**Files:**
- Modify: `web/src/components/ConfirmDialog.tsx` 或 `web/src/components/ui/dialog.tsx`

### 核心差异

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| 对齐方式 | 居中 (text-align: center) | 左对齐 (sm:text-left) | P0 |
| 按钮布局 | 两侧等宽 flex:1 | 右对齐 | P0 |
| Danger 图标 | 56px 圆形 + danger 色图标 | 无 | P1 |
| Delete 警告块 | 黄色 warning 提示 | 无 | P1 |
| 卡片圆角 | 20px | 28px | P2 |

### 实施步骤

- [x] **Step 1: Confirm dialog 居中对齐** — 添加 `text-center`
- [x] **Step 2: 按钮布局** — 改为等宽 `flex: 1`
- [x] **Step 3: Danger 图标** — 添加 56px 圆形 danger 色图标
- [x] **Step 4: Delete warning** — 添加黄色提示块
- [x] **Step 5: 运行测试和构建**
- [x] **Step 6: 提交**

---

## Task 16: Machines 细节对齐

**问题:** Session badges 缺失、dark mode 细节、skeleton 简化。

**对比发现:** 0 P0 / 4 P1 / 4 P2

**Files:**
- Modify: `web/src/routes/machines/index.tsx`

### 核心差异 (P1)

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| Session badges | `.machine-sessions` + `.session-badge` (含 active) | 无 | P1 |
| Runner error dark mode | 暖色系透明度 | 固定 rgba(181,51,51,...) | P1 |
| Dark mode 细节 | machine-icon/runner-error/drawer-overlay 各有 dark 覆盖 | 通用变量 | P1 |
| Skeleton 信息密度 | 额外顶部短条模拟 section | 仅两张 skeleton card | P2 |

### 实施步骤

- [x] **Step 1: Session badges** — Machine 类型不包含 sessions 数据，跳过
- [x] **Step 2: Runner error dark mode** — dark 模式使用 CSS 变量 badge-error-*
- [x] **Step 3: 运行测试和构建**
- [x] **Step 4: 提交**

---

## Task 17: History 细节对齐

**问题:** Preview content 语义、filter chip 图标、action icons。

**对比发现:** 1 P0 / 4 P1 / 4 P2

**Files:**
- Modify: `web/src/routes/history/index.tsx`

### 核心差异

| 差异 | 设计稿 | React | 级别 |
|------|--------|-------|------|
| Preview content | 会话内容摘要 (自然语言预览) | projectPath (路径文本) | P0 |
| Filter chip 图标 | Archived/Deleted chip 带图标 (14px) | 纯文本 | P1 |
| 会话卡片背景 | panel-elevated | panel-bg | P1 |
| Action buttons | 图标+文字 | 仅文字 | P1 |
| Meta 信息架构 | 时间 + message count | 时间 + agent + model | P1 |

### 实施步骤

- [x] **Step 1: Preview content** — 优先显示 summary.text, fallback 路径
- [x] **Step 2: Filter chip 图标** — 添加 Archived (archive icon) / Deleted (trash icon)
- [x] **Step 3: 卡片背景** — panel-bg → panel-elevated-bg
- [ ] **Step 4: Action buttons** — 添加 SVG 图标
- [x] **Step 5: 运行测试和构建**
- [x] **Step 6: 提交**

---

## 验证

所有任务完成后:

1. **类型检查**: `bun run typecheck:web`
2. **测试**: `cd web && bunx vitest run`
3. **构建**: `bun run build:web`
4. **视觉验证**: 启动 `bun run dev`，逐页检查:
   - Sessions 列表: tag 圆角矩形、inactive dot opacity、agent 无背景
   - Chat: timestamps、serif italic 标题、icon-only back button、composer 圆角
   - New Session: 全页面布局、扁平 section、directory Browse 按钮、vertical recent paths
   - Machines: session badges、dark mode 细节
   - History: preview content、filter chip 图标、action icons
   - Settings: 下拉框不被裁剪
   - Terminal: 固定深色背景、CSS 变量指示器、终端圆角
   - Files: confirm dialog 居中 + 等宽按钮
   - Login: Server dialog overlay/按钮/圆角
   - 全局: 下拉框无遮挡

---

## 风险和注意事项

1. **Task 9 MobileTabBar**: NewSession 作为独立页面可能显示 MobileTabBar, 需在 AppShell 中检测 `/new-session` 并隐藏
2. **Task 10 Chat panel wrapper**: 保留 React 的 bordered panel (更好视觉层次), 仅对齐内部样式
3. **Task 11 overflow-hidden**: SettingsCard 用 overflow-hidden 让子元素圆角匹配, 移除后用 `first:`/`last:` 选择器
4. **Task 12 Tag 形状**: `rounded-full` → `rounded-[6px]` 影响所有 tag (thinking/pending/todo/agent/model/worktree), 需确保视觉统一
5. **Task 14 终端背景**: 改为固定深色可能影响 xterm 终端主题, 需同步修改 TerminalView 的 theme
6. **Task 15 Confirm Dialog**: 居中对齐影响所有使用 ConfirmDialog 的场景 (files + chat), 需确认无副作用
7. **Task 17 Preview content**: 后端 API 需提供消息摘要字段, 若无则需前端从最后一条消息提取
8. **Task 13 Dialog 组件共用**: dialog.tsx 被 Login 和 ConfirmDialog 共用, 修改需确保两者都受益或做 variant 区分
