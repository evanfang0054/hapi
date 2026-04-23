# UI 交互优化与功能补全 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7 个独立的 UI/交互改进任务，涵盖样式优化、终端配色、聊天体验、目录浏览、分支显示、确认弹窗和批量操作。

**Architecture:** 各任务独立，可并行实施。涉及 web（React + Tailwind）、cli（TypeScript/Bun）两个工作区。

**Tech Stack:** React 19, TanStack Router/Query, @assistant-ui/react, Tailwind CSS, xterm.js, Bun

---

## 任务 1：文件页面空状态样式优化

**Files:**
- Modify: `web/src/routes/sessions/files.tsx:815-829`

- [ ] **Step 1: 调用 huashu-design skill 生成优化 mockup**

使用 huashu-design skill 为"未检测到变更"空状态生成优化后的 HTML 设计，改善图标、文字排版、间距和视觉层次。生成后参考 mockup 样式迁移到组件代码中。

- [ ] **Step 2: 更新 files.tsx 空状态组件**

修改 `web/src/routes/sessions/files.tsx` 第 815-829 行的空状态区域，采用 mockup 的设计。改动要点：
- 优化图标容器尺寸和背景
- 改善主标题和副标题的字体、颜色、间距
- 添加"切换到目录"和"搜索"的可点击引导链接
- 确保暗色模式下视觉效果正常

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/sessions/files.tsx
git commit -m "style(web): 优化文件页面空状态样式"
```

---

## 任务 2：终端字体颜色修复

**Files:**
- Modify: `web/src/components/Terminal/TerminalView.tsx:10-16`

- [ ] **Step 1: 修改 resolveThemeColors 函数**

在 `web/src/components/Terminal/TerminalView.tsx` 第 10-16 行，将 foreground 从 CSS 变量改为固定高对比色：

```ts
function resolveThemeColors(): { background: string; foreground: string; cursor: string; selectionBackground: string } {
    const background = '#1a1a1a'
    const foreground = '#e0e0e0'
    const cursor = '#e0e0e0'
    const selectionBackground = 'rgba(255, 255, 255, 0.2)'
    return { background, foreground, cursor, selectionBackground }
}
```

同时更新第 47-59 行 Terminal 配置，使用返回的 cursor 字段：

```ts
theme: {
    background,
    foreground,
    cursor,
    selectionBackground
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Terminal/TerminalView.tsx
git commit -m "fix(web): 修复终端字体颜色在浅色主题下不可见的问题"
```

---

## 任务 3a：回到底部按钮改进

**Files:**
- Modify: `web/src/components/AssistantChat/HappyThread.tsx:14-31, 376`

- [ ] **Step 1: 修改 NewMessagesIndicator 组件**

在 `web/src/components/AssistantChat/HappyThread.tsx` 第 14-31 行，将 `NewMessagesIndicator` 改为 `ScrollToBottomButton`，去掉 count 判断：

```tsx
function ScrollToBottomButton(props: { visible: boolean; onClick: () => void }) {
    const { t } = useTranslation()
    if (!props.visible) {
        return null
    }

    return (
        <button
            onClick={props.onClick}
            className="fixed bottom-[84px] right-3 z-10 h-9 w-9 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] shadow-[var(--app-shadow-sm)] flex items-center justify-center text-[var(--app-hint)] transition-all hover:text-[var(--app-fg)] md:bottom-6 md:right-5 md:h-10 md:w-10"
            aria-label={t('misc.scrollToBottom')}
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
            </svg>
        </button>
    )
}
```

- [ ] **Step 2: 更新使用处**

将第 376 行的 `<NewMessagesIndicator count={props.pendingCount} onClick={scrollToBottom} />` 改为：

```tsx
<ScrollToBottomButton visible={!autoScrollEnabled} onClick={scrollToBottom} />
```

- [ ] **Step 3: 添加 locale key**

在 `web/src/lib/locales/en.ts` 和 `web/src/lib/locales/zh-CN.ts` 的 misc 部分添加：
- en: `'misc.scrollToBottom': 'Scroll to bottom'`
- zh-CN: `'misc.scrollToBottom': '滚动到底部'`

- [ ] **Step 4: Commit**

```bash
git add web/src/components/AssistantChat/HappyThread.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "feat(web): 聊天页面滚动离开底部时始终显示回到底部按钮"
```

---

## 任务 3b：AI 思考中 loading 指示器

**Files:**
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx:65-89`

- [ ] **Step 1: 在 AssistantMessage 中添加 thinking indicator**

在 `web/src/components/AssistantChat/messages/AssistantMessage.tsx` 中，检测消息是否处于 running 状态（最后一条 assistant 消息 + isRunning），如果是则渲染 thinking indicator。

使用 `useAssistantState` 获取 `thread.isRunning` 和当前消息状态：

```tsx
import { useAssistantState } from '@assistant-ui/react'

// 在 HappyAssistantMessage 内部添加
const isRunning = useAssistantState(({ thread }) => thread.isRunning)
const isLastAssistant = useAssistantState(({ thread, message }) => {
    const messages = thread.messages
    const lastMsg = messages[messages.length - 1]
    return lastMsg?.id === message.id && message.role === 'assistant'
})
const showThinking = isRunning && isLastAssistant
```

当 `showThinking` 为 true 且消息内容为空（纯 tool-call 或刚开始思考）时，在消息气泡内渲染 thinking indicator：

```tsx
function ThinkingIndicator() {
    return (
        <div className="flex items-center gap-2 px-1 py-0.5">
            <div className="thinking-dots flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-focus)] animate-[dot-bounce_1.4s_ease-in-out_infinite]" />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-focus)] animate-[dot-bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-focus)] animate-[dot-bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
            <span className="text-[13px] text-[var(--app-hint)]">{t('assistant.thinking')}</span>
        </div>
    )
}
```

在 `index.css` 或 `HappyThread.tsx` 的 style 中添加 keyframe：

```css
@keyframes dot-bounce {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1.2); }
}
```

- [ ] **Step 2: 添加 locale key**

- en: `'assistant.thinking': 'Thinking...'`
- zh-CN: `'assistant.thinking': '正在思考...'`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AssistantChat/messages/AssistantMessage.tsx web/src/index.css web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "feat(web): AI 思考中时在消息卡片内显示 loading 指示器"
```

---

## 任务 4：创建会话浏览目录改为内部页面

**Files:**
- Create: `web/src/components/NewSession/DirectoryPickerModal.tsx`
- Modify: `web/src/components/NewSession/DirectorySection.tsx:25-33, 68-77`

- [ ] **Step 1: 创建 DirectoryPickerModal 组件**

新建 `web/src/components/NewSession/DirectoryPickerModal.tsx`，基于 Dialog 组件实现目录选择 modal：

```tsx
import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ApiClient } from '@/api/client'
import { useTranslation } from '@/lib/use-translation'

type DirectoryEntry = {
    name: string
    path: string
    isDirectory: boolean
}

export function DirectoryPickerModal(props: {
    isOpen: boolean
    onClose: () => void
    onConfirm: (path: string) => void
    machineId: string | null
    api: ApiClient | null
    initialPath?: string
}) {
    const { t } = useTranslation()
    const [currentPath, setCurrentPath] = useState(props.initialPath ?? '/')
    const [entries, setEntries] = useState<DirectoryEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadDirectory = useCallback(async (path: string) => {
        if (!props.api || !props.machineId) return
        setIsLoading(true)
        try {
            const result = await props.api.listMachineDirectory(props.machineId, path)
            setCurrentPath(path)
            setEntries(result.entries
                .filter((e: DirectoryEntry) => e.isDirectory)
                .sort((a: DirectoryEntry, b: DirectoryEntry) => a.name.localeCompare(b.name)))
        } catch {
            // show error state
        } finally {
            setIsLoading(false)
        }
    }, [props.api, props.machineId])

    useEffect(() => {
        if (props.isOpen && props.machineId) {
            loadDirectory(props.initialPath ?? '/')
        }
    }, [props.isOpen, props.machineId, props.initialPath, loadDirectory])

    const handleEntryClick = (entry: DirectoryEntry) => {
        loadDirectory(entry.path)
    }

    const handleConfirm = () => {
        props.onConfirm(currentPath)
        props.onClose()
    }

    return (
        <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('newSession.directoryPicker.title')}</DialogTitle>
                </DialogHeader>
                {/* Current path breadcrumb */}
                <div className="text-xs font-mono text-[var(--app-hint)] px-1 py-2 truncate border-b border-[var(--app-border)]">
                    {currentPath}
                </div>
                {/* Directory list */}
                <div className="flex-1 overflow-y-auto min-h-0 py-2 app-scroll-y">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-[var(--app-hint)]">
                            {t('misc.loading')}
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-[var(--app-hint)]">
                            {t('newSession.directoryPicker.empty')}
                        </div>
                    ) : (
                        entries.map(entry => (
                            <button
                                key={entry.path}
                                type="button"
                                onClick={() => handleEntryClick(entry)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)] rounded-lg transition-colors"
                            >
                                <svg className="w-4 h-4 text-[var(--app-hint)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                <span className="truncate">{entry.name}</span>
                            </button>
                        ))
                    )}
                </div>
                {/* Action buttons */}
                <div className="flex gap-3 pt-3 border-t border-[var(--app-border)]">
                    <button
                        type="button"
                        onClick={props.onClose}
                        className="flex-1 h-11 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[13px] font-medium text-[var(--app-fg)]"
                    >
                        {t('button.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 h-11 rounded-[16px] border border-[var(--app-link)] bg-[var(--app-link)] text-[13px] font-medium text-[#faf9f5]"
                    >
                        {t('newSession.directoryPicker.confirm')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
```

- [ ] **Step 2: 修改 DirectorySection 使用 DirectoryPickerModal**

在 `web/src/components/NewSession/DirectorySection.tsx` 中：
1. 添加 props: `machineId: string | null`, `api: import('@/api/client').ApiClient | null`
2. 添加 state: `const [pickerOpen, setPickerOpen] = useState(false)`
3. 将 Browse 按钮从 `showDirectoryPicker` 条件渲染改为始终显示（或改为通用浏览）
4. Browse 按钮点击打开 `DirectoryPickerModal`
5. Modal 确认后回调 `props.onDirectoryChange(selectedPath)`

```tsx
// 替换第 25-33 行的 handleBrowse
const handleBrowse = useCallback(() => {
    setPickerOpen(true)
}, [])
```

```tsx
// 替换第 68-77 行的 Browse 按钮渲染
<button
    type="button"
    onClick={handleBrowse}
    disabled={props.isDisabled || !props.machineId}
    className="shrink-0 px-3 py-1.5 rounded-[8px] text-[13px] border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] transition-colors hover:bg-[var(--app-panel-muted-bg)] disabled:opacity-50"
>
    {t('newSession.browse')}
</button>

<DirectoryPickerModal
    isOpen={pickerOpen}
    onClose={() => setPickerOpen(false)}
    onConfirm={props.onDirectoryChange}
    machineId={props.machineId}
    api={props.api}
    initialPath={props.directory || undefined}
/>
```

- [ ] **Step 3: 更新 NewSession 组件传递 props**

在 `web/src/components/NewSession/index.tsx` 中，确保 `DirectorySection` 接收到 `machineId` 和 `api` props。

- [ ] **Step 4: 添加 locale keys**

- en: `'newSession.directoryPicker.title'`, `'newSession.directoryPicker.empty'`, `'newSession.directoryPicker.confirm'`
- zh-CN: 对应中文翻译

- [ ] **Step 5: Commit**

```bash
git add web/src/components/NewSession/DirectoryPickerModal.tsx web/src/components/NewSession/DirectorySection.tsx web/src/components/NewSession/index.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "feat(web): 创建会话浏览目录改为使用内部目录选择页面"
```

---

## 任务 5：会话卡片显示当前分支

**Files:**
- Modify: `cli/src/utils/worktreeEnv.ts:38-86`

- [ ] **Step 1: 扩展 readWorktreeFromGit 支持普通 git 仓库**

修改 `cli/src/utils/worktreeEnv.ts` 中的 `readWorktreeFromGit()` 函数。当前逻辑只在 gitDir ≠ gitCommonDir（即 worktree）时返回数据。扩展为：即使不在 worktree 中，只要是 git 仓库，也返回 branch 信息。

在 worktree 检测失败后（第 57-59 行），添加普通 git 仓库的 branch 检测：

```ts
function readWorktreeFromGit(): WorktreeInfo | null {
    // ... existing code ...
    const resolvedGitDir = normalizePath(gitDir, cwd)
    const resolvedGitCommonDir = normalizePath(gitCommonDir, cwd)

    // 原有 worktree 检测逻辑
    if (resolvedGitDir !== resolvedGitCommonDir) {
        // ... existing worktree logic ...
    }

    // 新增：普通 git 仓库也获取 branch
    const branch = runGit(['symbolic-ref', '--short', 'HEAD'], cwd)
        ?? runGit(['rev-parse', '--short', 'HEAD'], cwd)
    if (!branch) {
        return null
    }

    const worktreeRoot = runGit(['rev-parse', '--show-toplevel'], cwd)
    if (!worktreeRoot) {
        return null
    }
    const worktreePath = normalizePath(worktreeRoot, cwd)

    return {
        basePath: worktreePath,
        branch,
        name: basename(worktreePath),
        worktreePath,
        createdAt: readCreatedAt(worktreePath)
    }
}
```

注意：`WorktreeInfo` 类型定义在 `cli/src/runner/worktree.ts`，确保结构兼容。

- [ ] **Step 2: 验证**

在本地运行 CLI 启动一个 session，检查 metadata.worktree.branch 是否包含当前分支名。

- [ ] **Step 3: Commit**

```bash
git add cli/src/utils/worktreeEnv.ts
git commit -m "feat(cli): 普通git仓库也采集branch信息，支持会话卡片显示分支"
```

---

## 任务 6：历史页面删除确认弹窗

**Files:**
- Modify: `web/src/routes/history/index.tsx:89-113, 181-253`

- [ ] **Step 1: 引入 ConfirmDialog 和 state**

在 `web/src/routes/history/index.tsx` 顶部添加 import：

```ts
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
```

在 `HistorySessionItem` 组件中，替换 `confirmAndAct` 逻辑为 state 驱动的弹窗：

```ts
// 删除 confirmAndAct 函数（第 109-113 行）
// 添加 state
const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: 'archive' | 'delete' | 'permanentDelete'
    action: () => Promise<void>
}>({ isOpen: false, type: 'delete', action: async () => {} })

const [isConfirmPending, setIsConfirmPending] = useState(false)

const handleConfirm = async () => {
    setIsConfirmPending(true)
    try {
        await confirmDialog.action()
    } catch {}
    setIsConfirmPending(false)
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    setActionsOpen(false)
}
```

- [ ] **Step 2: 替换按钮点击事件**

将所有使用 `confirmAndAct` 的地方改为 `setConfirmDialog`：

```tsx
// 归档按钮（约第 197 行）
onClick={(e) => {
    e.stopPropagation()
    setConfirmDialog({
        isOpen: true,
        type: 'archive',
        action: archiveSession
    })
}}

// 删除按钮（约第 221 行）
onClick={(e) => {
    e.stopPropagation()
    setConfirmDialog({
        isOpen: true,
        type: 'delete',
        action: deleteSession
    })
}}

// 永久删除按钮（约第 244 行）
onClick={(e) => {
    e.stopPropagation()
    setConfirmDialog({
        isOpen: true,
        type: 'permanentDelete',
        action: deleteSession
    })
}}
```

- [ ] **Step 3: 添加 ConfirmDialog 组件到 JSX**

在 `HistorySessionItem` 的 return 中，在 action buttons 区域之后添加：

```tsx
<ConfirmDialog
    isOpen={confirmDialog.isOpen}
    onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
    title={confirmDialog.type === 'archive'
        ? `Archive "${session.name}"?`
        : confirmDialog.type === 'permanentDelete'
            ? `Permanently delete "${session.name}"?`
            : `Delete "${session.name}"?`
    }
    description={confirmDialog.type === 'archive'
        ? 'This session will be moved to archive.'
        : 'This action cannot be undone.'
    }
    confirmLabel={confirmDialog.type === 'archive' ? 'Archive' : 'Delete'}
    confirmingLabel={confirmDialog.type === 'archive' ? 'Archiving...' : 'Deleting...'}
    onConfirm={handleConfirm}
    isPending={isConfirmPending}
    destructive={confirmDialog.type !== 'archive'}
    accent={confirmDialog.type === 'archive' ? 'archive' : 'default'}
/>
```

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/history/index.tsx
git commit -m "fix(web): 历史页面删除/归档操作改为使用自定义确认弹窗"
```

---

## 任务 7：批量选择操作逻辑优化

**Files:**
- Modify: `web/src/components/SessionList.tsx:493-511, 729-782`

- [ ] **Step 1: 移除 toggleSelected 中的 active 限制**

修改 `web/src/components/SessionList.tsx` 第 500-511 行的 `toggleSelected` 函数：

```ts
const toggleSelected = (sessionId: string, _active: boolean) => {
    setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(sessionId)) {
            next.delete(sessionId)
        } else {
            next.add(sessionId)
        }
        return next
    })
}
```

同时修改第 493-498 行的 `enterSelectionMode`，进入时也选中当前项（不区分 active）：

```ts
const enterSelectionMode = (sessionId: string) => {
    setSelectionMode(true)
    setIsBatchBarClosing(false)
    setSelectedIds(new Set([sessionId]))
    setBulkDeleteOpen(false)
}
```

- [ ] **Step 2: 修改批量操作栏动态显示按钮**

替换第 729-782 行的批量操作栏，根据选中会话的状态动态显示按钮：

```tsx
{(selectionMode || isBatchBarClosing) && !bulkDeleteOpen ? (
    <div className={`batch-bar fixed bottom-20 left-0 right-0 z-[95] mx-auto w-fit rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-2.5 shadow-[var(--app-shadow-md)] ${isBatchBarClosing ? 'animate-batch-bar-out pointer-events-none' : 'animate-batch-bar-in'}`}>
        <div className="batch-bar-inner flex items-center gap-3">
            <span className="batch-count text-[13px] font-medium text-[var(--app-fg)] pr-3 border-r border-[var(--app-border)]">
                {selectedCount}
            </span>
            <div className="batch-actions flex items-center gap-2">
                {/* 归档按钮：仅当选中包含活跃会话时显示 */}
                {activeSelectedCount > 0 && (
                    <button
                        type="button"
                        className="batch-action-btn flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-medium border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] transition-colors hover:bg-[var(--app-panel-elevated-bg)] disabled:opacity-50"
                        onClick={async () => {
                            const ids = Array.from(selectedIds).filter(id => {
                                const session = props.sessions.find(s => s.id === id)
                                return session?.active
                            })
                            for (const id of ids) {
                                try { await api?.archiveSession(id) } catch { /* skip */ }
                            }
                            cancelSelectionMode()
                        }}
                        disabled={isBatchBarClosing}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="20" height="5" x="2" y="3" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                            <path d="M10 12h4" />
                        </svg>
                        {t('session.action.archive')} ({activeSelectedCount})
                    </button>
                )}
                {/* 删除按钮：仅当选中包含非活跃会话时显示 */}
                {inactiveSelectedCount > 0 && (
                    <button
                        type="button"
                        className="batch-action-btn flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-medium border border-[rgba(181,51,51,0.3)] bg-[rgba(181,51,51,0.08)] text-[var(--app-error)] transition-colors hover:bg-[rgba(181,51,51,0.15)] disabled:opacity-50 [html[data-theme=dark]_&]:border-[rgba(224,140,114,0.3)] [html[data-theme=dark]_&]:bg-[rgba(224,140,114,0.1)]"
                        onClick={() => setBulkDeleteOpen(true)}
                        disabled={isBatchBarClosing}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        {t('dialog.delete.confirm')} ({inactiveSelectedCount})
                    </button>
                )}
            </div>
            <button
                type="button"
                className="batch-cancel-btn rounded-[8px] p-2 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                onClick={cancelSelectionModeWithAnimation}
                aria-label={t('button.cancel')}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    </div>
) : null}
```

需要在组件中计算 `activeSelectedCount` 和 `inactiveSelectedCount`：

```ts
const activeSelectedCount = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
        const session = props.sessions.find(s => s.id === id)
        return session?.active
    }).length
}, [selectedIds, props.sessions])

const inactiveSelectedCount = selectedIds.size - activeSelectedCount
```

同时修改 `confirmBulkDelete`，只删除非活跃会话：

```ts
const confirmBulkDelete = async () => {
    const sessionIds = Array.from(selectedIds).filter(id => {
        const session = props.sessions.find(s => s.id === id)
        return !session?.active
    })
    // ... rest stays the same
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SessionList.tsx
git commit -m "feat(web): 批量选择支持活跃会话，操作按钮按类型动态显示"
```

---

## 执行依赖关系

任务 1-7 相互独立，可并行实施。唯一注意事项：
- 任务 3a 和 3b 都修改 locale 文件，合并时注意不冲突
- 任务 4 和任务 6 都涉及 Dialog 组件使用，但不同文件
