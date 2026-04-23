# UI 交互改进与功能增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复终端乱码、对齐空状态样式、支持文件编辑保存、Chat刷新菜单、Resume继承权限模式

**Architecture:** 5个独立任务，Task 1-3 纯前端，Task 4 前端小改动，Task 5 跨 hub+cli 改动。按优先级顺序实施。

**Tech Stack:** React 19, xterm.js, CodeMirror 6, TanStack Query, Hono (hub), SQLite (hub), Socket.IO RPC (hub↔cli)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `web/src/components/Terminal/TerminalView.tsx` | 修复 convertEol 和 customGlyphs |
| Modify | `web/src/routes/sessions/files.tsx:815-838` | 空状态样式对齐设计稿 |
| Modify | `web/src/routes/sessions/file.tsx` | 添加编辑/保存 UI |
| Create | `web/src/components/SessionFiles/FileEditor.tsx` | CodeMirror 编辑器组件 |
| Modify | `web/src/api/client.ts` | 新增 writeSessionFile 方法 |
| Modify | `cli/src/modules/common/handlers/files.ts` | writeFile 无 hash 时改为覆盖而非报错 |
| Modify | `hub/src/sync/rpcGateway.ts` | 新增 writeFile RPC 中转 |
| Modify | `hub/src/web/routes/git.ts` | 新增 PUT file 路由 |
| Modify | `hub/src/sync/syncEngine.ts` | 新增 writeSessionFile + resume 传 permissionMode |
| Modify | `hub/src/store/sessions.ts` | DB 新增 permission_mode 列 + 持久化 |
| Modify | `hub/src/store/types.ts` | StoredSession 新增 permissionMode |
| Modify | `hub/src/sync/sessionCache.ts` | 心跳持久化 + mergeSessions 继承 |
| Modify | `web/src/components/SessionActionMenu.tsx` | 添加刷新菜单项 |
| Modify | `web/src/lib/locales/en.ts` | 新增翻译 key |
| Modify | `web/src/lib/locales/zh-CN.ts` | 新增翻译 key |

---

## Task 1: 终端乱码修复

**Files:**
- Modify: `web/src/components/Terminal/TerminalView.tsx:47-58,106-109`

- [ ] **Step 1: 移除 convertEol 并延迟启用 customGlyphs**

在 `web/src/components/Terminal/TerminalView.tsx` 中，将 Terminal 构造参数中的 `convertEol: true` 删除，`customGlyphs` 改为 `false`:

```tsx
// 第 47-59 行，修改为：
const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: fontProvider.getFontFamily(),
    fontSize,
    theme: {
        background,
        foreground,
        cursor,
        selectionBackground
    },
    customGlyphs: false
})
```

然后在 `ensureBuiltinFontLoaded` 回调中，字体加载成功后启用 `customGlyphs`:

```tsx
// 第 106-109 行，修改为：
void ensureBuiltinFontLoaded().then(loaded => {
    if (!loaded) return
    refreshFont(true)
    if (!abortController.signal.aborted) {
        terminal.options.customGlyphs = true
        if (terminal.rows > 0) {
            terminal.refresh(0, terminal.rows - 1)
        }
    }
})
```

- [ ] **Step 2: 验证终端显示正常**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/Terminal/ --reporter=verbose 2>&1 | tail -20`
Expected: 所有终端相关测试通过

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Terminal/TerminalView.tsx
git commit -m "fix(web): 修复终端文字重复和乱码问题

移除 convertEol 避免双倍换行，延迟启用 customGlyphs 等字体加载完成"
```

---

## Task 2: 空状态样式对齐设计稿

**Files:**
- Modify: `web/src/routes/sessions/files.tsx:815-838`
- Modify: `web/src/lib/locales/en.ts` — 新增 `sessionFiles.noChangesDesc`
- Modify: `web/src/lib/locales/zh-CN.ts` — 新增 `sessionFiles.noChangesDesc`

- [ ] **Step 1: 添加翻译 key**

在 `web/src/lib/locales/en.ts` 中 `sessionFiles.noChangesDetected` 行后面添加:

```ts
'sessionFiles.noChangesDesc': 'Your working directory is clean. Make some changes and they\'ll appear here.',
```

在 `web/src/lib/locales/zh-CN.ts` 中 `sessionFiles.noChangesDetected` 行后面添加:

```ts
'sessionFiles.noChangesDesc': '工作目录是干净的。做一些修改后会出现在这里。',
```

- [ ] **Step 2: 重写空状态 HTML 对齐设计稿**

将 `web/src/routes/sessions/files.tsx` 第 815-838 行替换为:

```tsx
{gitStatus && gitStatus.stagedFiles.length === 0 && gitStatus.unstagedFiles.length === 0 ? (
    <div className="flex flex-col items-center py-12 px-6 text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-[var(--app-subtle-bg)] flex items-center justify-center mb-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-[var(--app-hint)]">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
        </div>
        <div className="text-[18px] font-medium text-[var(--app-fg)]" style={{ fontFamily: 'var(--app-font-serif)' }}>
            {t('sessionFiles.noChangesDetected')}
        </div>
        <div className="text-[13px] text-[var(--app-hint)] max-w-[280px] leading-relaxed">
            {t('sessionFiles.noChangesDesc')}
        </div>
        <button
            type="button"
            onClick={() => handleTabChange('directories')}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-4 py-2 text-[13px] font-medium text-[var(--app-fg)] transition-colors hover:bg-[var(--app-panel-muted-bg)]"
        >
            <svg className="w-4 h-4 text-[var(--app-hint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {t('sessionFiles.tab.directories')}
        </button>
    </div>
) : null}
```

- [ ] **Step 3: 运行测试验证**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/routes/sessions/files.test.tsx --reporter=verbose 2>&1 | tail -20`
Expected: 测试通过

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/sessions/files.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "style(web): 对齐文件页面空状态样式至设计稿"
```

---

## Task 3: Chat 头部菜单添加刷新选项

**Files:**
- Modify: `web/src/components/SessionActionMenu.tsx:12-22,108-152,253-308`
- Modify: `web/src/components/SessionHeader.tsx:84-92,107-111`
- Modify: `web/src/lib/locales/en.ts` — 新增 `session.action.refresh`
- Modify: `web/src/lib/locales/zh-CN.ts` — 新增 `session.action.refresh`

- [ ] **Step 1: 添加翻译 key**

在 `web/src/lib/locales/en.ts` 中 `session.action.rename` 行后面添加:

```ts
'session.action.refresh': 'Refresh',
```

在 `web/src/lib/locales/zh-CN.ts` 中 `session.action.rename` 行后面添加:

```ts
'session.action.refresh': '刷新数据',
```

- [ ] **Step 2: 在 SessionActionMenu 中添加刷新图标和菜单项**

在 `web/src/components/SessionActionMenu.tsx` 中:

1. 在 `SessionActionMenuProps` 类型（第 12-22 行）中添加 `onRefresh`:

```tsx
type SessionActionMenuProps = {
    isOpen: boolean
    onClose: () => void
    sessionActive: boolean
    onRefresh: () => void
    onRename: () => void
    onArchive: () => void
    onDelete: () => void
    onSelectMultiple?: () => void
    anchorPoint: { x: number; y: number }
    menuId?: string
}
```

2. 在 `SelectMultipleIcon` 组件（第 88 行）之后添加 `RefreshIcon`:

```tsx
function RefreshIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
        </svg>
    )
}
```

3. 在解构 props 的位置（第 116-126 行）添加 `onRefresh`:

```tsx
const {
    isOpen,
    onClose,
    sessionActive,
    onRefresh,
    onRename,
    onArchive,
    onDelete,
    onSelectMultiple,
    anchorPoint,
    menuId
} = props
```

4. 在 `handleRename` 函数前添加 `handleRefresh`:

```tsx
const handleRefresh = () => {
    onClose()
    onRefresh()
}
```

5. 在菜单项列表中，在 Rename 按钮之前插入 Refresh 按钮:

```tsx
<button
    type="button"
    role="menuitem"
    className={`${baseItemClassName} hover:bg-[var(--app-subtle-bg)]`}
    onClick={handleRefresh}
>
    <RefreshIcon className="text-[var(--app-hint)]" />
    {t('session.action.refresh')}
</button>
```

- [ ] **Step 3: 在 SessionHeader 中传递 onRefresh prop**

在 `web/src/components/SessionHeader.tsx` 中，找到 `SessionActionMenu` 的渲染位置，添加 `onRefresh={props.onRefresh}` prop。

在 SessionHeader 的 props 中确认 `onRefresh` 已存在（第 87 行），然后在 `<SessionActionMenu>` 组件上传递它:

```tsx
<SessionActionMenu
    isOpen={menuOpen}
    onClose={() => setMenuOpen(false)}
    sessionActive={session.active}
    onRefresh={() => props.onRefresh?.()}
    onRename={() => setRenameOpen(true)}
    onArchive={() => setArchiveOpen(true)}
    onDelete={() => setDeleteOpen(true)}
    onSelectMultiple={undefined}
    anchorPoint={menuAnchorPoint}
    menuId={menuId}
/>
```

- [ ] **Step 4: 验证 SessionHeader 传递 onRefresh 到 SessionActionMenu**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bunx vitest run src/components/SessionActionMenu.test.tsx src/components/SessionHeader.test.tsx --reporter=verbose 2>&1 | tail -20`
Expected: 测试通过（如果测试文件存在且包含 refresh 相关断言需要更新）

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SessionActionMenu.tsx web/src/components/SessionHeader.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "feat(web): 在会话更多菜单中添加刷新数据选项"
```

---

## Task 4: 文件编辑与保存

### Task 4a: 安装 CodeMirror 依赖

- [ ] **Step 1: 安装 CodeMirror 包**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/web && bun add @codemirror/view @codemirror/state @codemirror/language @codemirror/lang-javascript @codemirror/lang-css @codemirror/lang-html @codemirror/lang-python @codemirror/lang-json @codemirror/lang-markdown @codemirror/theme-one-dark`

### Task 4b: 创建 FileEditor 组件

**Files:**
- Create: `web/src/components/SessionFiles/FileEditor.tsx`

- [ ] **Step 2: 创建 FileEditor 组件**

```tsx
import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, type Extension } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'

const MAX_EDITABLE_FILE_BYTES = 1_000_000

function getLanguageExtension(lang: string | undefined) {
    if (!lang) return []
    const l = lang.toLowerCase()
    if (l === 'javascript' || l === 'typescript' || l === 'jsx' || l === 'tsx') return [javascript({ jsx: true, typescript: l.includes('typescript') || l.includes('tsx') })]
    if (l === 'css' || l === 'scss' || l === 'less') return [css()]
    if (l === 'html' || l === 'xml' || l === 'svg') return [html()]
    if (l === 'python' || l === 'py') return [python()]
    if (l === 'json' || l === 'jsonc') return [json()]
    if (l === 'markdown' || l === 'md') return [markdown()]
    return []
}

function getEditorTheme(): Extension {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--app-code-bg').trim() || '#1e1e2e'
    const fg = getComputedStyle(document.documentElement).getPropertyValue('--app-fg').trim() || '#cdd6f4'
    const gutterBg = getComputedStyle(document.documentElement).getPropertyValue('--app-subtle-bg').trim() || '#181825'
    const gutterFg = getComputedStyle(document.documentElement).getPropertyValue('--app-hint').trim() || '#6c7086'
    const activeLine = getComputedStyle(document.documentElement).getPropertyValue('--app-subtle-bg').trim() || '#2a2a3c'

    return EditorView.theme({
        '&': { backgroundColor: bg, color: fg, fontSize: '13px' },
        '.cm-content': { fontFamily: 'var(--app-font-mono), monospace', caretColor: fg },
        '.cm-cursor': { borderLeftColor: fg },
        '.cm-gutters': { backgroundColor: gutterBg, color: gutterFg, border: 'none' },
        '.cm-activeLine': { backgroundColor: activeLine },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
            backgroundColor: 'rgba(255, 255, 255, 0.15) !important'
        },
    }, { dark: true })
}

interface FileEditorProps {
    content: string
    language: string | undefined
    onChange: (content: string) => void
}

export function FileEditor(props: FileEditorProps) {
    const { content, language, onChange } = props
    const containerRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const langExts = getLanguageExtension(language)
        const state = EditorState.create({
            doc: content,
            extensions: [
                lineNumbers(),
                highlightActiveLine(),
                history(),
                bracketMatching(),
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
                getEditorTheme(),
                oneDark,
                ...langExts,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChangeRef.current(update.state.doc.toString())
                    }
                }),
                EditorView.lineWrapping,
            ]
        })

        const view = new EditorView({
            state,
            parent: container,
        })

        viewRef.current = view

        // Handle virtual keyboard on mobile
        const handleResize = () => {
            if (document.activeElement && container.contains(document.activeElement as Node)) {
                view.requestMeasure()
            }
        }
        if (typeof visualViewport !== 'undefined') {
            visualViewport.addEventListener('resize', handleResize)
        }

        return () => {
            if (typeof visualViewport !== 'undefined') {
                visualViewport.removeEventListener('resize', handleResize)
            }
            view.destroy()
            viewRef.current = null
        }
    }, []) // Only create once

    return (
        <div
            ref={containerRef}
            className="overflow-auto rounded-[20px] border border-[var(--app-border)] shadow-[var(--app-shadow-sm)] [&_.cm-editor]:!h-auto [&_.cm-scroller]:!max-h-[60vh] [&_.cm-scroller]:overflow-auto"
        />
    )
}

export { MAX_EDITABLE_FILE_BYTES }
```

### Task 4c: CLI — 修改 writeFile 支持覆盖已有文件

**Files:**
- Modify: `cli/src/modules/common/handlers/files.ts:75-85`

- [ ] **Step: 修改 writeFile handler 无 hash 时直接覆盖**

将 `cli/src/modules/common/handlers/files.ts` 第 75-85 行的 else 分支（检查文件不存在）改为直接写入（跳过检查）:

原代码:
```ts
} else {
    try {
        await stat(data.path)
        return rpcError('File already exists but was expected to be new')
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException
        if (nodeError.code !== 'ENOENT') {
            throw error
        }
    }
}
```

替换为:
```ts
}
// No hash provided — allow overwriting existing files (used by web file editor)
```

### Task 4d: 后端 — 添加 writeFile RPC 中转

**Files:**
- Modify: `hub/src/sync/rpcGateway.ts:12-17,227-229`

- [ ] **Step 3: 添加 RpcWriteFileResponse 类型和 writeFile 方法**

在 `hub/src/sync/rpcGateway.ts` 第 17 行后添加:

```ts
export type RpcWriteFileResponse = {
    success: boolean
    hash?: string
    error?: string
}
```

在 `readSessionFile` 方法（第 227-229 行）后添加:

```ts
async writeSessionFile(sessionId: string, path: string, content: string): Promise<RpcWriteFileResponse> {
    return await this.sessionRpc(sessionId, 'writeFile', { path, content }) as RpcWriteFileResponse
}
```

- [ ] **Step 4: 在 SyncEngine 中暴露 writeSessionFile**

在 `hub/src/sync/syncEngine.ts` 中，在 `readSessionFile` 方法附近添加:

```ts
async writeSessionFile(sessionId: string, path: string, content: string): Promise<RpcWriteFileResponse> {
    return await this.rpcGateway.writeSessionFile(sessionId, path, content)
}
```

同时在文件顶部的 re-export 中添加 `RpcWriteFileResponse`:

```ts
export type {
    RpcCommandResponse,
    RpcDeleteUploadResponse,
    RpcListDirectoryResponse,
    RpcPathExistsResponse,
    RpcReadFileResponse,
    RpcWriteFileResponse,
    RpcUploadFileResponse
} from './rpcGateway'
```

### Task 4e: 后端 — 添加 HTTP 路由

- [ ] **Step 5: 添加 PUT /sessions/:id/file 路由**

在 `hub/src/web/routes/git.ts` 中，在 `readFile` GET 路由之后添加:

```ts
app.put('/sessions/:id/file', async (c) => {
    const engine = requireSyncEngine(c, getSyncEngine)
    if (engine instanceof Response) return engine

    const sessionResult = requireSessionFromParam(c, engine)
    if (sessionResult instanceof Response) return sessionResult

    const body = await c.req.json<{ path?: string; content?: string }>()
    if (!body.path || body.content === undefined) {
        return c.json({ success: false, error: 'path and content are required' }, 400)
    }

    const result = await runRpc(() => engine.writeSessionFile(sessionResult.sessionId, body.path!, body.content!))
    return c.json(result)
})
```

### Task 4f: 前端 — API Client + 编辑 UI

**Files:**
- Modify: `web/src/api/client.ts:286-289`
- Modify: `web/src/routes/sessions/file.tsx:1-15,186-196,338-361`

- [ ] **Step 6: 添加 writeSessionFile API 方法**

在 `web/src/api/client.ts` 中 `readSessionFile` 方法后添加:

```ts
async writeSessionFile(sessionId: string, path: string, content: string): Promise<{ success: boolean; hash?: string; error?: string }> {
    return await this.request(`/api/sessions/${encodeURIComponent(sessionId)}/file`, {
        method: 'PUT',
        body: JSON.stringify({ path, content })
    })
}
```

- [ ] **Step 7: 添加翻译 key**

在 `web/src/lib/locales/en.ts` 中 `sessionFileDetail` 部分添加:

```ts
'sessionFileDetail.action.edit': 'Edit',
'sessionFileDetail.action.save': 'Save',
'sessionFileDetail.action.cancel': 'Cancel',
'sessionFileDetail.action.saving': 'Saving…',
'sessionFileDetail.toast.saved': 'File saved',
'sessionFileDetail.toast.saveFailed': 'Failed to save file',
```

在 `web/src/lib/locales/zh-CN.ts` 中对应位置添加:

```ts
'sessionFileDetail.action.edit': '编辑',
'sessionFileDetail.action.save': '保存',
'sessionFileDetail.action.cancel': '取消',
'sessionFileDetail.action.saving': '保存中…',
'sessionFileDetail.toast.saved': '文件已保存',
'sessionFileDetail.toast.saveFailed': '文件保存失败',
```

- [ ] **Step 8: 在 file.tsx 中添加编辑/保存 UI**

在 `web/src/routes/sessions/file.tsx` 中:

1. 在文件顶部 import 区域添加:

```tsx
import { FileEditor, MAX_EDITABLE_FILE_BYTES as MAX_EDITABLE_FILE_BYTES } from '@/components/SessionFiles/FileEditor'
```

2. 删除或保留 `MAX_COPYABLE_FILE_BYTES` 常量（编辑模式复用同一限制），添加一个别名:

```tsx
const MAX_COPYABLE_FILE_BYTES = 1_000_000
```

3. 在 `displayMode` state 下方添加 `isEditing` state:

```tsx
const [isEditing, setIsEditing] = useState(false)
const [isSaving, setIsSaving] = useState(false)
const [editedContent, setEditedContent] = useState<string | null>(null)
```

4. 计算 `canEdit` 条件:

```tsx
const canEdit = canCopyContent && contentSizeBytes <= MAX_EDITABLE_FILE_BYTES
```

5. 添加保存处理函数（在 return 之前）:

```tsx
const handleSave = async () => {
    if (!api || !sessionId || !filePath || editedContent === null) return
    setIsSaving(true)
    try {
        const encoded = btoa(unescape(encodeURIComponent(editedContent)))
        const result = await api.writeSessionFile(sessionId, filePath, encoded)
        if (result.success) {
            setIsEditing(false)
            setEditedContent(null)
            fileQuery.refetch()
            diffQuery.refetch()
            addToast({ title: t('sessionFileDetail.toast.saved'), body: '' })
        } else {
            addToast({ title: t('sessionFileDetail.toast.saveFailed'), body: result.error ?? '' })
        }
    } catch {
        addToast({ title: t('sessionFileDetail.toast.saveFailed'), body: '' })
    } finally {
        setIsSaving(false)
    }
}

const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent(null)
}
```

6. 在"复制"按钮旁边（第 341-351 行），添加"编辑"按钮（仅非编辑模式时显示）:

```tsx
{canCopyContent ? (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        {!isEditing && canEdit ? (
            <button
                type="button"
                onClick={() => { setIsEditing(true); setEditedContent(decodedContent) }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1 text-[11px] text-[var(--app-hint)] shadow-[var(--app-shadow-sm)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]"
                title={t('sessionFileDetail.action.edit')}
            >
                <EditFileIcon />
                <span>{t('sessionFileDetail.action.edit')}</span>
            </button>
        ) : null}
        {!isEditing ? (
            <button
                type="button"
                onClick={() => { copyContent(decodedContent); addToast({ title: t('button.copy'), body: '' }) }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-2.5 py-1 text-[11px] text-[var(--app-hint)] shadow-[var(--app-shadow-sm)] transition-colors hover:bg-[var(--app-panel-muted-bg)] hover:text-[var(--app-fg)]"
                title={t('sessionFileDetail.copyFileContent')}
            >
                {contentCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                <span>{contentCopied ? t('sessionFileDetail.copied') : t('button.copy')}</span>
            </button>
        ) : null}
    </div>
) : null}
```

7. 在 file content 渲染区域（第 339-358 行），添加编辑模式分支:

```tsx
: displayMode === 'file' ? (
    decodedContent ? (
        isEditing ? (
            <div>
                <FileEditor
                    content={editedContent ?? decodedContent}
                    language={language}
                    onChange={setEditedContent}
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="inline-flex min-h-9 items-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-2 text-sm font-medium text-[var(--app-hint)] transition-colors hover:bg-[var(--app-panel-muted-bg)]"
                    >
                        {t('sessionFileDetail.action.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex min-h-9 items-center rounded-full bg-[var(--app-link)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                        {isSaving ? t('sessionFileDetail.action.saving') : t('sessionFileDetail.action.save')}
                    </button>
                </div>
            </div>
        ) : (
            <div className="relative">
                {/* 复制+编辑按钮区域（Step 6 中描述的） */}
                <pre className="shiki overflow-auto rounded-[20px] border border-[var(--app-border)] bg-[var(--app-code-bg)] p-4 pr-12 text-xs font-mono shadow-[var(--app-shadow-sm)]">
                    <code>{highlighted ?? decodedContent}</code>
                </pre>
            </div>
        )
    ) : (
        <div className="text-sm text-[var(--app-hint)]">{t('sessionFileDetail.fileEmpty')}</div>
    )
)
```

8. 添加 `EditFileIcon` 组件（在文件底部的 helper 组件区域）:

```tsx
function EditFileIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
        </svg>
    )
}
```

- [ ] **Step 9: 运行测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:web 2>&1 | tail -10`
Expected: 类型检查通过

- [ ] **Step 10: Commit**

```bash
git add web/src/components/SessionFiles/FileEditor.tsx web/src/routes/sessions/file.tsx web/src/api/client.ts web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts web/package.json hub/src/sync/rpcGateway.ts hub/src/sync/syncEngine.ts hub/src/web/routes/git.ts
git commit -m "feat(web,hub): 支持文件编辑与保存

前端使用 CodeMirror 6 编辑器，后端通过 RPC 调用 CLI writeFile handler"
```

---

## Task 5: Resume 继承权限模式

### Task 5a: DB 层 — 持久化 permissionMode

**Files:**
- Modify: `hub/src/store/types.ts`
- Modify: `hub/src/store/sessions.ts`

- [ ] **Step 1: 在 StoredSession 类型中添加 permissionMode**

在 `hub/src/store/types.ts` 的 `StoredSession` 类型中，`effort` 字段后添加:

```ts
permissionMode: string | null
```

- [ ] **Step 2: 在 DbSessionRow 和 toStoredSession 中添加 permission_mode**

在 `hub/src/store/sessions.ts` 中:

1. `DbSessionRow` 类型（第 8-28 行）中，`effort` 字段后添加:

```ts
permission_mode: string | null
```

2. `toStoredSession` 函数中添加:

```ts
permissionMode: row.permission_mode,
```

3. `getOrCreateSession` 的 INSERT 语句中，在 `effort` 列和值之后添加 `permission_mode`:

INSERT 列列表中添加:
```sql
permission_mode,
```

VALUES 中添加:
```sql
NULL,
```

run 参数中无需添加（默认 NULL）。

4. 添加 `setSessionPermissionMode` 函数:

```ts
export function setSessionPermissionMode(
    db: Database,
    id: string,
    permissionMode: string | null,
    namespace: string,
    options?: { touchUpdatedAt?: boolean }
): StoredSession | null {
    const now = Date.now()
    const touchUpdatedAt = options?.touchUpdatedAt !== false

    const result = db.prepare(`
        UPDATE sessions
        SET permission_mode = @permission_mode,
            updated_at = CASE WHEN @touch_updated_at = 1 THEN @updated_at ELSE updated_at END
        WHERE id = @id AND namespace = @namespace
    `).run({
        id,
        namespace,
        permission_mode: permissionMode,
        updated_at: now,
        touch_updated_at: touchUpdatedAt ? 1 : 0
    })

    if (result.changes === 0) return null
    return getSession(db, id)
}
```

5. 添加 DB migration: 在 hub 启动时检查并添加列。找到现有的 migration/schema 初始化代码，添加:

```sql
ALTER TABLE sessions ADD COLUMN permission_mode TEXT DEFAULT NULL
```

需要用 try/catch 包裹（列可能已存在）。

- [ ] **Step 3: 在 sessionCache 心跳处理中持久化 permissionMode**

在 `hub/src/sync/sessionCache.ts` 的 `handleSessionAlive` 方法中（第 181-183 行），在 `session.permissionMode = payload.permissionMode` 之后添加:

```ts
if (payload.permissionMode !== undefined && payload.permissionMode !== previousPermissionMode) {
    this.store.sessions.setSessionPermissionMode(
        payload.sid,
        payload.permissionMode,
        session.namespace,
        { touchUpdatedAt: false }
    )
}
```

- [ ] **Step 4: 在 refreshSession 中从 DB 读取 permissionMode**

在 `hub/src/sync/sessionCache.ts` 的 `refreshSession` 中，`session` 对象构造处（第 138 行），改为:

```ts
permissionMode: existing?.permissionMode ?? (typeof stored.permissionMode === 'string' ? stored.permissionMode as PermissionMode : existing?.permissionMode),
```

### Task 5b: spawn 时传递 permissionMode

**Files:**
- Modify: `hub/src/sync/rpcGateway.ts:114-131`
- Modify: `hub/src/sync/syncEngine.ts:405-416`

- [ ] **Step 5: spawnSession 方法添加 permissionMode 参数**

在 `hub/src/sync/rpcGateway.ts` 的 `spawnSession` 方法签名中，`effort` 参数后添加:

```ts
permissionMode?: string
```

在 RPC payload 中添加:

```ts
permissionMode,
```

完整的 `spawnSession` 签名变为:

```ts
async spawnSession(
    machineId: string,
    directory: string,
    agent: 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode' = 'claude',
    model?: string,
    modelReasoningEffort?: string,
    yolo?: boolean,
    sessionType?: 'simple' | 'worktree',
    worktreeName?: string,
    resumeSessionId?: string,
    effort?: string,
    permissionMode?: string
): Promise<{ type: 'success'; sessionId: string } | { type: 'error'; message: string }> {
    try {
        const result = await this.machineRpc(
            machineId,
            'spawn-happy-session',
            { type: 'spawn-in-directory', directory, agent, model, modelReasoningEffort, yolo, sessionType, worktreeName, resumeSessionId, effort, permissionMode }
        )
        // ... rest unchanged
    }
}
```

- [ ] **Step 6: resumeSession 调用时传递 permissionMode**

在 `hub/src/sync/syncEngine.ts` 的 `resumeSession` 方法中（第 405-416 行），将 `spawnSession` 调用改为传入 `permissionMode`:

```ts
const spawnResult = await this.rpcGateway.spawnSession(
    targetMachine.id,
    metadata.path,
    flavor,
    session.model ?? undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    resumeToken,
    session.effort ?? undefined,
    session.permissionMode ?? undefined
)
```

### Task 5c: mergeSessions 继承 permissionMode

**Files:**
- Modify: `hub/src/sync/sessionCache.ts:358-441`

- [ ] **Step 7: 在 mergeSessions 中添加 permissionMode 继承**

在 `hub/src/sync/sessionCache.ts` 的 `mergeSessions` 方法中，在 effort 继承逻辑（第 401-408 行）之后添加:

```ts
// Inherit permissionMode from old session
if (!newStored.permissionMode && oldStored.permissionMode) {
    this.store.sessions.setSessionPermissionMode(
        newSessionId,
        oldStored.permissionMode,
        namespace,
        { touchUpdatedAt: false }
    )
}
```

- [ ] **Step 8: 运行 hub 类型检查和测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck:hub 2>&1 | tail -10`
Expected: 类型检查通过

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi/hub && bun test 2>&1 | tail -20`
Expected: 测试通过

- [ ] **Step 9: Commit**

```bash
git add hub/src/store/types.ts hub/src/store/sessions.ts hub/src/sync/sessionCache.ts hub/src/sync/rpcGateway.ts hub/src/sync/syncEngine.ts
git commit -m "feat(hub): Resume 会话继承原会话权限模式

持久化 permissionMode 到 SQLite，心跳时同步写入，
mergeSessions 和 spawnSession 传递原会话的 permissionMode"
```

---

## Task 6: 最终验证

- [ ] **Step 1: 全量类型检查**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run typecheck 2>&1 | tail -20`
Expected: 全部通过

- [ ] **Step 2: 全量测试**

Run: `cd /Users/arwen/Desktop/Arwen/evanfang/hapi && bun run test 2>&1 | tail -30`
Expected: 全部通过

- [ ] **Step 3: 修复任何失败的测试**

如果有测试因新的 props（如 `onRefresh`）或新的 DB 列而失败，更新测试代码使其通过。
