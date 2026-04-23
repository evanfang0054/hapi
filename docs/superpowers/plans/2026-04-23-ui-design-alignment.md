# UI 对齐计划：设计稿 vs 实现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 web/ 所有页面实现与 `web/design/` 设计稿 HTML 逐一视觉对齐

**Architecture:** 按全局 → 组件 → 页面顺序修复。全局 CSS 变量优先，共享组件其次，最后各页面独立差异。保留桌面端分栏布局和 Voice/Nerd Font/Autocomplete 等合理新增功能。

**Tech Stack:** React 19 + Tailwind CSS v4 + CSS 变量设计系统

---

## Task 0: 全局样式修复

**Files:**
- Modify: `web/src/index.css`

- [x] **G1**: `--app-border` light 值从 `#f0eee6` 改为 `#ebe7dc`
- [x] **G2**: `--app-font-sans` 改为 `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- [x] **G3**: body 背景移除径向渐变，改为纯色 `var(--app-bg)`
- [x] **G4**: `--app-button-text` dark 值从 `#141413` 改为 `#faf9f5`
- [x] **G5**: `--app-error` dark 值从 `#e05a5a` 改为 `#e08c72`

---

## Task 1: Index / Sessions 页

**Files:**
- Modify: `web/src/components/SessionList.tsx`
- Modify: `web/src/components/layout/MobileTabBar.tsx`
- Modify: `web/src/components/layout/DesktopNav.tsx`

- [x] **S1**: Session 卡片时间戳添加胶囊背景
- [x] **S2**: 复选框自定义样式
- [x] **S3**: 分组标题字号从 `text-sm`(14px) 改为 `text-[15px]`
- [x] **S4**: Badge 字号从 `text-[10px]` 改为 `text-[11px]`
- [x] **S5**: MobileTabBar FAB 从 `w-14 h-14`(56px) 渐变 改为 `w-12 h-12`(48px) 纯色 `bg-[var(--app-link)]`
- [x] **S6**: FAB shadow 从 `0_4px_16px_rgba(201,100,66,0.35)` 改为 `0_4px_12px_rgba(201,100,66,0.3)`
- [x] **S7**: Tab bar shadow 改为 `shadow-[0_-4px_20px_rgba(0,0,0,0.06)]`

---

## Task 2: Chat 聊天页

**Files:**
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/components/AssistantChat/ComposerButtons.tsx`
- Modify: `web/src/components/AssistantChat/messages/UserMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`
- Modify: `web/src/components/SessionHeader.tsx`
- Modify: `web/src/components/AssistantChat/StatusBar.tsx`

- [x] **C1**: Composer 外层容器从圆角卡片改为扁平底部 — 移除 `rounded-[20px] border`，改为 `border-t border-[var(--app-border)] bg-[var(--app-panel-bg)]`
- [x] **C2**: 输入框内 composer-inner 添加胶囊包裹 — `rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-[16px] py-[8px]`
- [x] **C3**: 输入框字号从 `text-[15px]` 改为 `text-[14px]`，行高改为 `leading-6`(24px/1.5)
- [x] **C4**: 发送按钮图标从垂直向上箭头改为斜角飞镖 `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`
- [x] **C5**: 工具按钮尺寸从 `h-8 w-8`(32px) 改为 `h-9 w-9`(36px)
- [x] **C6**: 附件按钮添加 `bg-[var(--app-subtle-bg)]` 背景 + `text-[var(--app-hint)]` 颜色
- [x] **C7**: UserMessage 气泡下方添加时间戳 — `<div className="text-[10px] text-[var(--app-hint)] mt-1 text-right">{formatTime(msg.createdAt)}</div>`
- [x] **C8**: UserMessage 操作按钮移至气泡外下方，添加 "Copy" 文字标签
- [x] **C9**: AssistantMessage 同 C7 添加时间戳（左对齐）
- [x] **C10**: AssistantMessage 同 C8 调整操作按钮位置
- [x] **C11**: SessionHeader meta 行添加连接状态文字描述（如 "Thinking"）
- [x] **C12**: StatusBar 所有硬编码颜色改为 CSS 变量 — `#007AFF` → `var(--app-focus)`、`#999` → `var(--app-hint)`、`#FF9500` → `var(--app-warning)`、`#34C759` → `var(--app-success)`

---

## Task 3: New Session 新建页

**Files:**
- Modify: `web/src/components/NewSession/DirectorySection.tsx`
- Modify: `web/src/components/NewSession/ModelSelector.tsx`（如有）
- Modify: `web/src/components/NewSession/EffortSelector.tsx`（如有）
- Modify: `web/src/components/NewSession/index.tsx`

- [x] **N1**: 目录输入框圆角从 `rounded-[18px]` 改为 `rounded-[14px]`
- [x] **N2**: 目录输入框字体添加 `font-mono`
- [x] **N3**: 移除 `shadow-[var(--app-shadow-sm)]`
- [x] **N4**: 添加 Browse 按钮 — `<button className="px-3 py-1.5 rounded-[8px] text-[13px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)]">Browse</button>`
- [x] **N5**: 最近目录从 pill tag 改为列表行 — `<button className="flex items-center gap-2 p-[10px_12px] rounded-[10px] font-mono text-[12px] hover:bg-[var(--app-subtle-bg)]">` + 时钟 SVG 图标
- [x] **N6**: Model/Effort select 圆角从 `rounded-[18px]` 改为 `rounded-[12px]`
- [x] **N7**: focus 样式从 `ring` 改为 `focus:border-[var(--app-link)] focus:outline-none`
- [x] **N8**: 移除 select 的 `shadow-[var(--app-shadow-sm)]`
- [x] **N9**: label 样式对齐为 `text-[12px] font-medium tracking-[0.5px] text-[var(--app-hint)]`
- [x] **N10**: 移动端 Model/Effort 行添加 `flex-col` 响应式（`flex flex-col sm:flex-row`）

---

## Task 4: Terminal 终端页

**Files:**
- Modify: `web/src/routes/sessions/terminal.tsx`
- Modify: `web/src/components/Terminal/TerminalView.tsx`

- [x] **T1**: xterm 容器背景改为 `bg-[#1a1a1a]`（不随主题变化）
- [x] **T2**: TerminalView `resolveThemeColors()` 中 background 改为 `#1a1a1a`
- [x] **T3**: CardTitle 添加 `italic`
- [x] **T4**: 命令输入框添加 `font-mono`
- [x] **T5**: 退出覆盖层背景从 `bg-[var(--app-bg)]/80` 改为 `bg-[rgba(26,26,26,0.9)]`，文字色改为 `text-[#888]`
- [x] **T6**: Quick Input 标题字号从 `11px` 改为 `10px`，letter-spacing 从 `0.16em` 改为 `0.5px`
- [x] **T7**: 快捷键/命令输入框圆角从 `rounded-[var(--app-radius-control)]`(16px) 改为 `rounded-[12px]`
- [x] **T8**: 修饰键激活态文字色从 `text-[var(--app-bg)]` 改为 `text-white`
- [x] **T9**: Quick Input 底栏 padding 对齐 — `p-[12px_16px]`，移动端 `p-[10px_12px]`
- [x] **T10**: Quick Input 底栏添加 `pb-[calc(12px+env(safe-area-inset-bottom))]`
- [x] **T11**: 连接状态点颜色对齐设计稿 — connected `bg-[var(--app-success)]`、connecting `bg-[var(--app-warning)]`、idle `bg-[var(--app-hint)]`

---

## Task 5: Machines 机器页

**Files:**
- Modify: `web/src/routes/machines/index.tsx`

- [x] **M1**: 机器图标暗色模式背景 — 在在线图标容器上添加 `dark:bg-[rgba(138,176,141,0.15)]`
- [x] **M2**: 离线状态点移除 `opacity-40`
- [x] **M3**: 统计卡片圆角从 `rounded-[12px]` 改为 `rounded-[16px]`
- [x] **M4**: Runner Error 颜色偏橙改偏红 — `bg-[rgba(181,51,51,0.08)] border-[rgba(181,51,51,0.2)] text-[var(--app-error)]`
- [x] **M5**: 抽屉圆角从 `rounded-t-[24px]` 改为 `rounded-t-[20px]`
- [x] **M6**: 手柄宽度从 `w-7`(28px) 改为 `w-9`(36px)，圆角从 `rounded-full` 改为 `rounded-[2px]`
- [x] **M7**: 抽屉动画从 `ease-out` 改为 `cubic-bezier(0.32, 0.72, 0, 1)`
- [x] **M8**: 主要按钮 hover 从 `opacity-90` 改为 `hover:bg-[#d97757]`

---

## Task 6: History 历史页

**Files:**
- Modify: `web/src/routes/history/index.tsx`

- [x] **H1**: 操作按钮添加 SVG 图标 — Restore 用 `RotateCcw`、Archive 用 `Archive`、Delete 用 `Trash2`
- [x] **H2**: 元信息行添加消息数量 — `· {session.messageCount ?? 0} messages`
- [x] **H3**: 非活跃筛选芯片文字色从 `text-[var(--app-fg)]` 改为 `text-[var(--app-hint)]`
- [x] **H4**: 搜索关键词添加高亮 — 创建 `highlightText(text, query)` 函数，返回带 `<mark className="bg-[rgba(201,100,66,0.2)] rounded-[2px] px-[2px]">` 的 JSX
- [x] **H5**: 预览文字 line-height 从 `leading-snug`(1.375) 改为 `leading-[1.4]`
- [x] **H6**: meta 行 gap 从 `gap-1.5`(6px) 改为 `gap-2`(8px)
- [x] **H7**: 空状态标题从 `text-[18px] font-medium` + serif 改为 `text-[16px] font-medium`（移除 serif 字体和 font-family inline style）

---

## Task 7: Settings 设置页

**Files:**
- Modify: `web/src/routes/settings/index.tsx`
- Modify: i18n 文件（搜索 `settings.display.title` key）

- [x] **SE1**: About 区添加 GitHub 链接 — `<a href="https://github.com/nicepkg/hapi" className="...">` + GitHub SVG 图标
- [x] **SE2**: 分区标题 i18n key 从 `settings.display.title` 改为 `settings.appearance.title`，值 "Appearance"
- [x] **SE3**: Toggle 滑块位移从 `translate-x-[22px]` 改为 `translate-x-[20px]`
- [x] **SE4**: Log Out 区移除 "Danger Zone" section-title，让 Log Out 卡片直接放在最后
- [x] **SE5**: 选择器图标从 `ChevronDownIcon` 改为 `ChevronRightIcon`

---

## Task 8: Files 文件页

**Files:**
- Modify: `web/src/routes/sessions/files.tsx`
- Modify: `web/src/routes/sessions/file.tsx`
- Modify: `web/src/components/SessionFiles/DirectoryTree.tsx`

- [x] **F1**: 文件行 padding 从 `px-3 py-2` 改为 `px-4 py-[10px]`
- [x] **F2**: Section header 水平 padding 从 `px-5 sm:px-6` 改为 `px-4`
- [x] **F3**: 文件路径添加 `font-mono`
- [x] **F4**: 文件操作按钮圆角从 `rounded`(4px) 改为 `rounded-[6px]`
- [x] **F5**: 搜索高亮从硬编码 `bg-[rgba(201,100,66,0.25)]` 改为 `bg-[color-mix(in_srgb,var(--app-link)_25%,transparent)]`
- [x] **F6**: Diff 容器圆角从 `rounded-md`(6px) 改为 `rounded-[12px]`
- [x] **F7**: 代码块右侧 padding 从 `pr-10`(40px) 改为 `pr-12`(48px)
- [x] **F8**: Diff 行添加 `leading-[1.6]`
- [x] **F9**: 状态图标（empty/binary/error）从 `w-16 h-16`(64px) 改为 `w-14 h-14`(56px)
- [x] **F10**: 目录树行添加 `rounded-[8px]`
- [x] **F11**: 目录树行 gap 从 `gap-3`(12px) 改为 `gap-2`(8px)
- [x] **F12**: 空目录文字添加 `italic`，字号从 `text-sm` 改为 `text-xs`
- [x] **F13**: files.tsx + file.tsx 添加 `env(safe-area-inset-top)` 顶部安全区

---

## Task 9: Login 登录页

**Files:**
- Modify: `web/src/components/LoginPrompt.tsx`
- Modify: `web/src/components/ui/dialog.tsx`

- [x] **L1**: Spinner 速度从 `animate-spin`(1s) 改为 `animate-[spin_0.8s_linear_infinite]`
- [x] **L2**: DialogContent 圆角从硬编码 `rounded-[24px]` 改为 `rounded-[var(--app-radius-panel)]`
- [x] **L3**: 副标题 line-height 从 `leading-relaxed`(1.625) 改为 `leading-[1.5]`

---

## Task 10: 全局组件清理

**Files:**
- Modify: `web/src/components/AssistantChat/ComposerButtons.tsx`
- Modify: `web/src/components/layout/MobileTabBar.tsx`

- [x] **U1**: UnifiedButton 禁用色从 `bg-[#C0C0C0]` 改为 `bg-[var(--app-subtle-bg)]`
- [x] **U2**: Mute 按钮颜色从 `bg-gray-200 text-gray-600 hover:bg-gray-300` 改为 `bg-[var(--app-subtle-bg)] text-[var(--app-hint)] hover:bg-[var(--app-panel-muted-bg)]`

---

## 执行顺序

1. Task 0 (已完成) → Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10

## 验证

每个 Task 完成后：
- `bun run typecheck:web` — 无类型错误
- `bun run test:web` — 无测试回归

最终全量验证：
- `bun run typecheck && bun run test && bun run build:web`
