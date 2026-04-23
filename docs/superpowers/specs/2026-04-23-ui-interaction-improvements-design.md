# UI 交互优化与功能补全设计

日期：2026-04-23
范围：web + cli + hub

## 概述

7 个独立的 UI/交互改进任务，涵盖文件页面样式、终端配色、聊天体验、目录浏览、分支显示、确认弹窗和批量操作。

---

## 任务 1：文件页面空状态样式优化

**现状**：`files.tsx` 第 815-829 行，"未检测到变更" 区域结构简单（圆形图标 + 两行文字），视觉效果不佳。

**方案**：
- 调用 huashu-design skill 生成高保真 HTML mockup
- 改善视觉层次：图标区域、文字排版、间距
- 保持现有功能不变（显示切换到目录的提示 + 搜索提示）
- 最终将 mockup 样式迁移到 `files.tsx` 组件中

**涉及文件**：`web/src/routes/sessions/files.tsx`、locale 文件

---

## 任务 2：终端字体颜色修复

**现状**：`TerminalView.tsx` 的 xterm foreground 取 `--app-fg` CSS 变量。浅色主题下 `--app-fg` 是深色，而终端背景固定 `#1a1a1a`，导致文字看不清。

**方案**：
- xterm 的 foreground 不再跟随 `--app-fg`
- 改为固定使用高对比色（如 `#e0e0e0` 或白色），因为终端背景始终是深色
- 同时调整 cursor 和 selectionBackground 确保在深色背景下可见

**涉及文件**：`web/src/components/Terminal/TerminalView.tsx`

---

## 任务 3a：回到底部按钮改进

**现状**：`HappyThread.tsx` 中 `NewMessagesIndicator` 仅在有 pending 新消息且用户不在底部时显示。

**方案**：
- 去掉"有新消息"的条件判断
- 改为：用户向上滚动离开底部时（`autoScrollEnabled === false`），始终显示回到底部按钮
- 按钮样式保持现有的圆形向下箭头
- 点击后滚动到底部并恢复 `autoScrollEnabled`

**涉及文件**：`web/src/components/AssistantChat/HappyThread.tsx`

---

## 任务 3b：AI 思考中 loading 指示器

**现状**：AI 响应时的 thinking 状态只在 StatusBar（输入框上方）以文字 + 脉冲圆点显示，消息流中没有视觉反馈。

**目标**：参考 `web/design/redesign-chat.html` 的 thinking-indicator 设计，在消息卡片中显示加载状态。

**方案**：
- 在 AI 消息气泡中，当处于 thinking 状态时，渲染 thinking indicator
- 样式：圆角卡片 + 三个弹跳圆点动画 + 状态文字（如 "正在思考..."、"正在编辑文件..."）
- 圆点颜色使用 accent 色（`--app-focus`）
- 文字颜色使用 hint 色（`--app-hint`）
- 动画：`dot-bounce 1.4s ease-in-out infinite`，三个点依次延迟
- StatusBar 中的 thinking 显示保持不变（作为补充信息）

**涉及文件**：`web/src/components/AssistantChat/messages/AssistantMessage.tsx`、新增 thinking indicator 样式

---

## 任务 4：创建会话浏览目录改为内部页面

**现状**：`DirectorySection.tsx` 的 Browse 按钮使用浏览器原生 `window.showDirectoryPicker()`，只能选择本地目录，无法浏览远端机器的文件系统。

**方案**：
- 点击浏览按钮 → 打开一个全屏 modal/drawer
- modal 内嵌已有的文件目录浏览组件（复用 files 页面的目录浏览能力）
- 用户可以自由导航目录结构
- 选中目标目录后点击"确认"按钮 → 关闭 modal → 回填路径到创建会话的目录输入框
- 需要新增一个"选择目录"模式给文件浏览组件，增加确认按钮

**涉及文件**：
- `web/src/components/NewSession/DirectorySection.tsx` — 修改浏览按钮逻辑
- `web/src/routes/sessions/files.tsx` — 提取可复用的目录浏览组件，或新增目录选择 modal
- 可能新增 `DirectoryPickerModal` 组件

**数据流**：
1. 用户点击 Browse → 打开 DirectoryPickerModal（传入 machineId）
2. Modal 内展示远端机器的目录结构（通过 hub API）
3. 用户导航并点选某个目录
4. 点击确认 → modal 关闭，回调 `onDirectoryChange(selectedPath)`

---

## 任务 5：会话卡片显示当前分支

**现状**：CLI 的 `readWorktreeEnv()` 只在 git worktree 场景下采集 branch（检测 gitDir ≠ gitCommonDir），普通 git 仓库的分支信息不采集。前端 SessionItem 已有 branch 渲染逻辑但无数据。

**方案**：
- 在 CLI 侧扩展分支采集：当不在 worktree 但在 git 仓库内时，也获取当前分支名
- 在 metadata 中添加一个通用 branch 字段（不限于 worktree）
- 两种实现思路：
  - **思路 A**：扩展 `readWorktreeEnv()`，当非 worktree 时也返回 branch 信息（简化字段，只含 basePath + branch）
  - **思路 B**：在 metadata 中新增独立的 `branch` 字段，与 worktree 分离
- 推荐 **思路 A**：复用 WorktreeMetadata 结构，非 worktree 场景只填充 basePath 和 branch，其他字段可选。这样前端代码不需要改动（已经有渲染 worktree.branch 的逻辑）

**具体改动**：
- `cli/src/utils/worktreeEnv.ts`：修改 `readWorktreeFromGit()`，当不在 worktree 时也获取 branch，返回精简的 WorktreeInfo
- 前端无需改动（已有 branch 渲染逻辑）

**涉及文件**：`cli/src/utils/worktreeEnv.ts`

---

## 任务 6：历史页面删除确认弹窗

**现状**：History 页面 `routes/history/index.tsx` 使用 `window.confirm()` 做删除/归档确认，与主页面 SessionList 的 `ConfirmDialog` 风格不一致。

**方案**：
- 引入 `ConfirmDialog` 组件替换 `window.confirm()`
- 删除操作使用 `destructive` 模式（红色警告图标）
- 归档操作使用 `accent="archive"` 模式
- 异步操作期间显示 loading 状态
- 删除原有的 `confirmAndAct` 辅助函数，改为 state 驱动的弹窗

**涉及文件**：`web/src/routes/history/index.tsx`

---

## 任务 7：批量选择操作逻辑优化

**现状**：`SessionList.tsx` 中 `toggleSelected()` 有 `if (active) return` 限制，活跃会话不可选。批量归档对非活跃会话无意义，反而对活跃会话有需求。

**方案**：
- 移除 `toggleSelected` 中对 active 会话的限制，允许选择所有会话
- 批量操作栏按钮根据选中会话状态动态显示：
  - 选中包含活跃会话 → 显示"归档"按钮
  - 选中包含非活跃会话 → 显示"删除"按钮
  - 混合选中 → 两个按钮都显示
- 归档操作仅对活跃会话生效，删除操作仅对非活跃会话生效
- 按钮文案可提示将影响的数量，如"归档 (3)"、"删除 (2)"

**涉及文件**：`web/src/components/SessionList.tsx`

---

## 不在范围内

- 不涉及 hub/shared 协议变更（除了任务 5 的 CLI metadata 扩展，但复用现有结构）
- 不涉及新建路由或页面
- 不涉及测试文件的编写（实现完成后按需补充）
