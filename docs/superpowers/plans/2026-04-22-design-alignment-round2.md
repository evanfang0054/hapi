# 设计稿精确对齐计划（第二轮）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将所有页面与 web/design/ 下的设计稿 HTML 精确对齐，修复样式、交互和功能点差异。

**分支:** `feat/interfaceRevamp`

**设计稿对照:**
- Login → `web/design/redesign-login.html`
- Settings → `web/design/redesign-settings.html`
- Machines → `web/design/redesign-machines.html`
- History → `web/design/redesign-history.html`
- Chat → `web/design/redesign-chat.html`
- SessionList → `web/design/redesign-ab-hybrid.html`
- NewSession → `web/design/redesign-new-session.html`
- Files → `web/design/redesign-files.html`
- File → `web/design/redesign-file.html`
- Terminal → `web/design/redesign-terminal.html`

---

## Task 1: Login 页面对齐

**Files:**
- Modify: `web/src/components/LoginPrompt.tsx`
- Modify: `web/src/components/LanguageSwitcher.tsx`

**Changes:**
- [ ] 1.1 修正主题切换图标逻辑：浅色模式显示太阳图标，深色模式显示月亮图标（当前反了）
- [ ] 1.2 主题切换按钮背景色改为 `var(--app-panel-elevated-bg)`（当前用 `--app-subtle-bg`）
- [ ] 1.3 语言切换器改为药丸形带文字：地球图标 + "English"/"简体中文"，`rounded-full` + `bg-[var(--app-panel-elevated-bg)]`
- [ ] 1.4 服务器对话框输入框 focus 样式统一为 `focus:border-[var(--app-link)] focus:shadow-[0_0_0_3px_rgba(201,100,66,0.12)]`
- [ ] 1.5 帮助链接 hover 颜色改为 `hover:text-[var(--app-link)]`
- [ ] 1.6 form-hint 间距改为 `mt-2`（8px，当前 mt-1.5 = 6px）
- [ ] 1.7 添加 480px 响应式断点（卡片 padding 24px，logo 60px，标题 24px）

**Verify:** 对比 LoginPrompt.tsx 与 redesign-login.html 的视觉效果

---

## Task 2: Settings 页面对齐

**Files:**
- Modify: `web/src/routes/settings/index.tsx`

**Changes:**
- [ ] 2.1 添加用户卡片 section（头像圆形渐变+首字母+名字+邮箱+chevron）
- [ ] 2.2 Dark Mode 从下拉菜单改为 Toggle 开关，描述文字 "Follow system preference"
- [ ] 2.3 添加 Notifications section（Push Notifications toggle + Telegram toggle）

**Verify:** 对比 settings/index.tsx 与 redesign-settings.html

---

## Task 3: Machines 页面对齐

**Files:**
- Modify: `web/src/routes/machines/index.tsx`

**Changes:**
- [ ] 3.1 添加三栏统计行（在线/离线/总数卡片）
- [ ] 3.2 添加 Machine Drawer 组件（底部滑出面板：handle、header 图标+标题+ID、Machine Info grid、Close+New Session 按钮）
- [ ] 3.3 卡片点击改为打开 Drawer，Drawer 内 "New Session" 按钮触发 hapi:new-session
- [ ] 3.4 Skeleton 从 pulse 改为 shimmer 动画（linear-gradient 扫光）
- [ ] 3.5 SVG 图标 stroke-width 从 1.5 改为 2

**Verify:** 对比 machines/index.tsx 与 redesign-machines.html

---

## Task 4: History 页面对齐

**Files:**
- Modify: `web/src/routes/history/index.tsx`

**Changes:**
- [ ] 4.1 添加 `deleted` 筛选 chip（all/archived/deleted 三种）
- [ ] 4.2 卡片操作按钮按状态分流：normal→Open+Archive，archived→Restore+Delete，deleted→Restore+Permanent Delete
- [ ] 4.3 危险操作按钮添加红色态 `.danger` 样式
- [ ] 4.4 统计栏添加 avg duration 项
- [ ] 4.5 添加 deleted badge 样式（独立配色）
- [ ] 4.6 点击外部关闭动作区

**Note:** API 可能不支持 deleted/restore 功能，需要检查 API 层。如果 API 不支持，仅做 UI 层面的准备。

**Verify:** 对比 history/index.tsx 与 redesign-history.html

---

## Task 5: Chat 页面对齐

**Files:**
- Modify: `web/src/components/SessionHeader.tsx`
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/UserMessage.tsx`

**Changes:**
- [ ] 5.1 SessionHeader 从嵌套面板式改为扁平条状（去除圆角面板包裹，直接用 bg+border-bottom）
- [ ] 5.2 Header 标题去除 serif 字体，改为无衬线 font-weight:600
- [ ] 5.3 添加消息入场动画 `msg-in`：translateY(10px) → 0 + opacity，0.3s ease-out
- [ ] 5.4 ToolCard 圆角从 14px 改为 24px（`rounded-[24px]` 或 `rounded-[var(--app-radius-2xl)]`）
- [ ] 5.5 返回按钮从方形 Button 改为文字链接风格 "← 返回"
- [ ] 5.6 活跃状态指示器添加脉冲动画

**Verify:** 对比 Chat 相关组件与 redesign-chat.html

---

## Task 6: SessionList 页面对齐

**Files:**
- Modify: `web/src/components/SessionList.tsx`

**Changes:**
- [ ] 6.1 更多按钮从文字 "•••" 改为 SVG 三点图标
- [ ] 6.2 状态点从 8px 改为 10px，active 添加 glow
- [ ] 6.3 时间戳样式改为纯色背景胶囊（无 border）
- [ ] 6.4 批量操作栏添加入场动画
- [ ] 6.5 上下文菜单添加 Duplicate 和 Select Multiple 选项

**Verify:** 对比 SessionList.tsx 与 redesign-ab-hybrid.html

---

## Task 7: NewSession 页面对齐

**Files:**
- Modify: `web/src/components/NewSession/` 目录下相关文件

**Changes:**
- [ ] 7.1 Machine 选择器改为卡片式横向滚动（图标+名称+在线状态），选中高亮 border+bg
- [ ] 7.2 Agent 选择器改为带彩色 logo 方块的卡片（Claude=#d97757, Codex=#10a37f, Gemini=#4285f4, Cursor=#000/#fff, OpenCode=#6366f1）
- [ ] 7.3 Session Type 从垂直堆叠改为水平并排卡片布局
- [ ] 7.4 Yolo toggle active 色改为 warning 色（#c58a3a），添加 "Dangerous" badge
- [ ] 7.5 内容区 padding 从 px-1 py-2 改为 px-5 py-4（20px 16px）

**Verify:** 对比 NewSession 组件与 redesign-new-session.html

---

## Task 8: Files/File/Terminal 页面对齐

**Files:**
- Modify: `web/src/routes/sessions/files.tsx`
- Modify: `web/src/routes/sessions/file.tsx`
- Modify: `web/src/routes/sessions/terminal.tsx`

**Changes:**
- [ ] 8.1 Files: 搜索结果添加关键词高亮 `<mark>`
- [ ] 8.2 Files: 错误态完善（图标+错误文案+Retry 按钮）
- [ ] 8.3 Files: 刷新按钮添加 loading 旋转态
- [ ] 8.4 File: 长文件名标题从 truncate 改为 word-break: break-all
- [ ] 8.5 File: Diff/File tab 始终显示（设计稿中固定展示）
- [ ] 8.6 Terminal: 退出态改为覆盖层展示（exit code）
- [ ] 8.7 Terminal: Windows 不支持态完善（图标+标题+描述）

**Verify:** 对比三个页面与各自设计稿

---

## Task 9: 运行 typecheck + test + commit

**Steps:**
- [ ] 9.1 `bun run typecheck:web`
- [ ] 9.2 `bun run test:web`
- [ ] 9.3 修复所有类型错误和测试失败
- [ ] 9.4 提交所有改动

**Verify:** typecheck 通过，所有测试通过
