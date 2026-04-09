# hapi Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有功能逻辑、路由结构和后端接口的前提下，基于 `web/design/DESIGN.md` 为整个 `web` 项目完成一次 Claude 风格的系统性 UI 重设计，并完整保留当前已展示的信息。

**Architecture:** 先重建 `web/src/index.css` 中现有 `--app-*` token 的 light/dark 语义映射，再统一 `ui` 基础组件的容器、按钮、badge、dialog、toast 语言，最后按页面骨架层和聊天细节层逐步替换样式。整个改动只触碰前端表现层与局部结构层级，不改数据流、状态模型、路由和 API 调用。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS 4、TanStack Router、TanStack Query、Radix Dialog、class-variance-authority、assistant-ui、xterm.js、Vitest、Testing Library

---

## File Structure

### Global theme and tokens
- Modify: `web/src/index.css` — 重映射 light/dark `--app-*` 变量、全局字体角色、卡片/边框/阴影/token、页面背景层级、markdown/code 容器视觉
- Verify: `web/src/hooks/useTheme.ts` — 只确认主题切换仍依赖现有 `data-theme` 机制；除非 token 接口不兼容，否则不改逻辑

### Shared UI primitives
- Modify: `web/src/components/ui/button.tsx` — Primary / Secondary / Outline / Destructive / Inverted 按钮语法统一
- Modify: `web/src/components/ui/card.tsx` — 全站 panel/card shell 统一为暖色容器风格
- Modify: `web/src/components/ui/badge.tsx` — 状态 badge/pill 统一
- Modify: `web/src/components/ui/dialog.tsx` — overlay、content、header/footer 统一
- Modify: `web/src/components/ui/Toast.tsx` — toast/banner 的容器、色阶、边框统一
- Modify: `web/src/components/ui/ConfirmDialog.tsx` — 对齐新的 dialog/button/badge 语法

### Sessions list and chat shell
- Modify: `web/src/components/SessionList.tsx` — 首页 header、group card、session item 卡片、空状态、状态信息层级
- Modify: `web/src/components/SessionHeader.tsx` — 聊天页顶部工作栏
- Modify: `web/src/components/SessionChat.tsx` — 聊天主壳层与 team panel / inactive banner / thread / composer 的层级关系

### Chat details
- Modify: `web/src/components/AssistantChat/HappyThread.tsx` — thread viewport、warning、load older、new message indicator、容器留白
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx` — composer 主容器、附件区、状态栏、按钮区
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/UserMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/SystemMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/ToolMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/MessageAttachments.tsx`
- Modify: `web/src/components/AssistantChat/messages/MessageStatusIndicator.tsx`
- Modify: `web/src/components/ToolCard/ToolCard.tsx` — 工具卡、权限卡、问题卡统一壳层
- Verify/adjust if needed: `web/src/components/ToolCard/views/*.tsx` — 只修局部 className/spacing，不改渲染逻辑

### New session page
- Modify: `web/src/components/NewSession/index.tsx` — 创建入口页骨架与 section card
- Modify: `web/src/components/NewSession/DirectorySection.tsx` — 目录输入、最近路径、状态提示
- Modify as needed: `web/src/components/NewSession/MachineSelector.tsx`
- Modify as needed: `web/src/components/NewSession/AgentSelector.tsx`
- Modify as needed: `web/src/components/NewSession/ModelSelector.tsx`
- Modify as needed: `web/src/components/NewSession/ClaudeEffortSelector.tsx`
- Modify as needed: `web/src/components/NewSession/ReasoningEffortSelector.tsx`
- Modify as needed: `web/src/components/NewSession/SessionTypeSelector.tsx`
- Modify as needed: `web/src/components/NewSession/YoloToggle.tsx`
- Modify as needed: `web/src/components/NewSession/ActionButtons.tsx`

### Files / file viewer / terminal / settings
- Modify: `web/src/routes/sessions/files.tsx` — header、search、tabs、summary、列表壳层
- Modify: `web/src/routes/sessions/file.tsx` — 文件与 diff 外围容器、切换控件、元信息区
- Modify: `web/src/routes/sessions/terminal.tsx` — terminal 外围 header、状态、控制区
- Modify: `web/src/routes/settings/index.tsx` — section 节奏、selector/card 统一

### Tests
- Modify: `web/src/routes/settings/index.test.tsx` — 设置页信息仍完整展示
- Modify: `web/src/routes/sessions/terminal.test.tsx` — terminal 主要状态/控件仍存在
- Modify: `web/src/components/ToolCard/checklist.test.tsx` — ToolCard 重构后仍正常渲染 checklist 视图
- Create if missing: `web/src/components/SessionList.test.tsx` — 校验 session item 关键信息未丢失
- Create if missing: `web/src/components/SessionHeader.test.tsx` — 校验 header 中 title/flavor/model/worktree 仍显示
- Create if missing: `web/src/components/NewSession/index.test.tsx` — 校验新建页关键字段与提示仍存在

---

### Task 1: 重建全局 token 与主题语义

**Files:**
- Modify: `web/src/index.css`
- Verify: `web/src/hooks/useTheme.ts`
- Test: `web/src/routes/settings/index.test.tsx`

**Completed:** 已为 settings 页补充“信息仍完整展示”的回归测试，修复 About 标题断言不稳定问题，并将 `web/src/index.css` 的 light/dark `--app-*` token 重映射为 Claude 风格的暖色语义，同时补齐 serif/sans/mono 字体角色和 markdown inline code 基础样式。已通过 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" test -- src/routes/settings/index.test.tsx` 与 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" typecheck` 验证。

- [x] **Step 1: 写一个失败测试，锁定 theme 切换后设置页核心信息仍在**

```tsx
import { render, screen } from '@testing-library/react'
import { SettingsRoute } from './index'

describe('SettingsRoute', () => {
  it('keeps visible settings labels after theme token refresh', () => {
    render(<SettingsRoute />)

    expect(screen.getByText(/Language/i)).toBeInTheDocument()
    expect(screen.getByText(/Appearance/i)).toBeInTheDocument()
    expect(screen.getByText(/Font size/i)).toBeInTheDocument()
    expect(screen.getByText(/Voice Assistant/i)).toBeInTheDocument()
    expect(screen.getByText(/About/i)).toBeInTheDocument()
  })
})
```

- [x] **Step 2: 运行测试确认基线通过，作为后续 UI 改造回归保护**

Run: `pnpm --dir web test -- web/src/routes/settings/index.test.tsx`
Expected: PASS，说明后续 token 改造可以依赖这条回归线验证“信息未丢失”。

- [x] **Step 3: 在 `web/src/index.css` 重映射 light/dark token 到 Claude 风格语义**

```css
:root {
    --app-bg: #f5f4ed;
    --app-fg: #141413;
    --app-hint: #5e5d59;
    --app-link: #c96442;
    --app-button: #c96442;
    --app-button-text: #faf9f5;
    --app-banner-bg: #1f1d1a;
    --app-banner-text: #faf9f5;
    --app-secondary-bg: #faf9f5;
    --app-subtle-bg: #e8e6dc;
    --app-border: #ebe7dc;
    --app-divider: rgba(20, 20, 19, 0.08);
    --app-code-bg: #f3f0e8;
    --app-inline-code-bg: rgba(92, 83, 71, 0.08);

    --app-panel-bg: #faf9f5;
    --app-panel-elevated-bg: #ffffff;
    --app-panel-muted-bg: #f0ede3;
    --app-shadow-sm: 0 1px 2px rgba(30, 24, 17, 0.04);
    --app-shadow-md: 0 10px 30px rgba(30, 24, 17, 0.06);
    --app-ring: 0 0 0 1px rgba(113, 92, 69, 0.08);

    --app-font-serif: Georgia, 'Times New Roman', serif;
    --app-font-sans: 'ui-sans-serif', 'SF Pro Text', 'Helvetica Neue', sans-serif;
    --app-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

[data-theme="dark"] {
    --app-bg: #141413;
    --app-fg: #f5f1e8;
    --app-hint: #b0aea5;
    --app-link: #d97757;
    --app-button: #d97757;
    --app-button-text: #141413;
    --app-banner-bg: #30302e;
    --app-banner-text: #f5f1e8;
    --app-secondary-bg: #1d1c1a;
    --app-subtle-bg: #30302e;
    --app-border: rgba(245, 241, 232, 0.1);
    --app-divider: rgba(245, 241, 232, 0.08);
    --app-code-bg: #22211f;
    --app-inline-code-bg: rgba(245, 241, 232, 0.08);

    --app-panel-bg: #1d1c1a;
    --app-panel-elevated-bg: #252422;
    --app-panel-muted-bg: #30302e;
    --app-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.28);
    --app-shadow-md: 0 12px 32px rgba(0, 0, 0, 0.32);
    --app-ring: 0 0 0 1px rgba(245, 241, 232, 0.06);
}

body {
    font-family: var(--app-font-sans);
    background:
        radial-gradient(circle at top, rgba(201, 100, 66, 0.05), transparent 32%),
        var(--app-bg);
    color: var(--app-fg);
}
```

- [x] **Step 4: 补齐全局基础语法，让标题/正文/代码角色分离**

```css
h1, h2, h3, [data-ui-heading="serif"] {
    font-family: var(--app-font-serif);
    letter-spacing: -0.02em;
}

code, pre, .shiki, .xterm {
    font-family: var(--app-font-mono);
}

.markdown-content code {
    background: var(--app-inline-code-bg);
    border: 1px solid var(--app-border);
    border-radius: 8px;
}
```

- [x] **Step 5: 重新运行设置页测试与类型检查**

Run: `pnpm --dir web test -- web/src/routes/settings/index.test.tsx && pnpm --dir web typecheck`
Expected: PASS，说明主题 token 替换未影响现有结构与类型。

- [ ] **Step 6: Commit**

```bash
git add web/src/index.css web/src/routes/settings/index.test.tsx
git commit -m "feat(web): remap app tokens to claude-style theme"
```

### Task 2: 统一共享 UI primitive 外观语法

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/components/ui/card.tsx`
- Modify: `web/src/components/ui/badge.tsx`
- Modify: `web/src/components/ui/dialog.tsx`
- Modify: `web/src/components/ui/Toast.tsx`
- Modify: `web/src/components/ui/ConfirmDialog.tsx`
- Test: `web/src/components/ToolCard/checklist.test.tsx`

**Completed:** 已统一 `button/card/badge/dialog/toast/ConfirmDialog` 的 Claude 风格共享外观语法：按钮改为 rounded-full 的 primary/secondary/outline/destructive/inverted 体系，card/badge/toast 改为暖色面板与 token 化状态色，dialog 增加统一 footer 与 overlay/content 节奏，ConfirmDialog 复用新的 dialog/button 语法且保留原确认逻辑不变。同时为 `ChecklistList` 增加回归测试并修正为匹配实际 `☑ keep info` 输出，已通过 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" test -- src/components/ToolCard/checklist.test.tsx` 与 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" typecheck` 验证。

- [x] **Step 1: 写一个失败测试，确保 ToolCard 在新 card/badge 语法下仍渲染 checklist 内容**

```tsx
import { render, screen } from '@testing-library/react'
import { ToolCard } from './ToolCard'

it('renders checklist rows after ui primitive refresh', () => {
  render(<ToolCard toolName="TodoWrite" result={{ todos: [{ content: 'keep info', status: 'completed' }] }} />)
  expect(screen.getByText('keep info')).toBeInTheDocument()
})
```

- [x] **Step 2: 运行测试确认当前基线正常**

Run: `pnpm --dir web test -- web/src/components/ToolCard/checklist.test.tsx`
Expected: PASS。

- [x] **Step 3: 把按钮统一为 Claude 风格的 primary / secondary / outline / destructive / inverted**

```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-[background,color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-link)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'border border-transparent bg-[var(--app-button)] text-[var(--app-button-text)] shadow-[var(--app-ring)] hover:brightness-[0.98]',
        secondary: 'border border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)] hover:bg-[var(--app-panel-muted-bg)]',
        outline: 'border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-fg)] hover:bg-[var(--app-subtle-bg)]',
        destructive: 'border border-transparent bg-[var(--app-badge-error-text)] text-white hover:opacity-92',
        inverted: 'border border-[var(--app-border)] bg-[var(--app-fg)] text-[var(--app-bg)] hover:opacity-92'
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6'
      }
    }
  }
)
```

- [x] **Step 4: 把 card / badge / dialog / toast 统一成暖色容器语言**

```tsx
// card.tsx
className={cn(
  'rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)] ring-1 ring-black/0',
  className
)}

// badge.tsx
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]',
  {
    variants: {
      variant: {
        default: 'border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)]',
        warning: 'border-[var(--app-badge-warning-border)] bg-[var(--app-badge-warning-bg)] text-[var(--app-badge-warning-text)]',
        success: 'border-[var(--app-badge-success-border)] bg-[var(--app-badge-success-bg)] text-[var(--app-badge-success-text)]',
        destructive: 'border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] text-[var(--app-badge-error-text)]'
      }
    }
  }
)

// dialog.tsx
<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(20,20,19,0.38)] backdrop-blur-[2px]" />
<DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] p-5 shadow-[var(--app-shadow-md)]" />

// Toast.tsx
const toastVariants = cva(
  'pointer-events-auto w-full max-w-sm rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] text-[var(--app-fg)] shadow-[var(--app-shadow-md)]'
)
```

- [ ] **Step 5: 调整 ConfirmDialog 以复用新的 button/dialog 节奏，不改确认逻辑**

```tsx
<DialogFooter className="mt-4 flex gap-2">
  <Button variant="secondary" onClick={onClose}>Cancel</Button>
  <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={isPending}>
    {isPending ? confirmingLabel : confirmLabel}
  </Button>
</DialogFooter>
```

- [ ] **Step 6: 运行 ToolCard 测试与类型检查**

Run: `pnpm --dir web test -- web/src/components/ToolCard/checklist.test.tsx && pnpm --dir web typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ui/button.tsx web/src/components/ui/card.tsx web/src/components/ui/badge.tsx web/src/components/ui/dialog.tsx web/src/components/ui/Toast.tsx web/src/components/ui/ConfirmDialog.tsx web/src/components/ToolCard/checklist.test.tsx
git commit -m "feat(web): unify shared ui primitives"
```

### Task 3: 重做 sessions 列表页为 workspace 首页

**Files:**
- Modify: `web/src/components/SessionList.tsx`
- Create: `web/src/components/SessionList.test.tsx`

**Completed:** 已将 sessions 列表重做为更完整的 workspace 首页壳层：顶部改为正式 page header，加入 Workspace 标题、会话统计与 Refresh/New session 操作；group 容器改成暖色卡片并保留 machine、目录、更新时间；session item 改成分层信息卡片，继续完整展示 title、path、thinking、todo、pending、updated、flavor、model、worktree 等字段。并新增 `web/src/components/SessionList.test.tsx` 锁定这些信息不丢失，已通过 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" test -- src/components/SessionList.test.tsx` 与 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" typecheck` 验证。

- [x] **Step 1: 写失败测试，锁定 session item 当前关键信息全部保留**

```tsx
import { render, screen } from '@testing-library/react'
import { SessionList } from './SessionList'

it('keeps session summary, path, todo, pending, flavor, model and worktree visible', () => {
  render(
    <SessionList
      sessions={[{
        id: 'sess-1',
        active: true,
        thinking: true,
        pendingRequestsCount: 3,
        updatedAt: Date.now(),
        todoProgress: { completed: 1, total: 4 },
        metadata: {
          name: 'Design sync',
          path: '/Users/arwen/hapi/web',
          flavor: 'claude',
          worktree: { branch: 'feat/redesign' },
          model: 'sonnet'
        }
      } as any]}
      onSelect={() => {}}
      onNewSession={() => {}}
      onRefresh={() => {}}
      isLoading={false}
      api={null}
    />
  )

  expect(screen.getByText('Design sync')).toBeInTheDocument()
  expect(screen.getByText('/Users/arwen/hapi/web')).toBeInTheDocument()
  expect(screen.getByText(/1\/4/)).toBeInTheDocument()
  expect(screen.getByText(/pending 3/i)).toBeInTheDocument()
  expect(screen.getByText(/claude/i)).toBeInTheDocument()
  expect(screen.getByText(/worktree/i)).toBeInTheDocument()
})
```

- [x] **Step 2: 运行新测试确认通过或按真实文案修正断言**

Run: `pnpm --dir web test -- web/src/components/SessionList.test.tsx`
Expected: PASS；如果因 i18n 文案不同失败，只调整断言文本，不删信息字段。

- [x] **Step 3: 把列表页顶部从工具条升级成正式 page header**

```tsx
<div className="mx-auto w-full max-w-content px-3 pb-3 pt-4 md:px-5 md:pt-6">
  <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-5 py-5 shadow-[var(--app-shadow-sm)]">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-hint)]">Workspace</p>
        <h1 className="text-3xl leading-none" data-ui-heading="serif">hapi</h1>
        <p className="max-w-2xl text-sm text-[var(--app-hint)]">Sessions、状态与当前工作上下文都保留在同一首页里。</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={props.onRefresh}>Refresh</Button>
        <Button onClick={props.onNewSession}>New session</Button>
      </div>
    </div>
  </div>
</div>
```

- [x] **Step 4: 把 group 与 session item 改成统一内容卡片，不删现有信息**

```tsx
<div className="rounded-[26px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-2 shadow-[var(--app-shadow-sm)]">
  <button className="flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left hover:bg-[var(--app-subtle-bg)]">
    <div>
      <div className="text-sm font-medium">{group.displayName}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--app-hint)]">
        <span>{resolveMachineLabel(group.machineId)}</span>
        <span>{group.sessions.length} sessions</span>
        <span>{formatRelativeTime(group.latestUpdatedAt, t)}</span>
      </div>
    </div>
    <ChevronIcon collapsed={isCollapsed} className="h-4 w-4 text-[var(--app-hint)]" />
  </button>

  <div className="mt-2 space-y-2">
    <button className="session-list-item flex w-full flex-col gap-2 rounded-[20px] border border-transparent bg-[var(--app-panel-elevated-bg)] px-4 py-4 text-left hover:border-[var(--app-border)] hover:bg-[var(--app-subtle-bg)]">
      {/* 保留原 title / path / thinking / todo / pending / updated / flavor / model / worktree */}
    </button>
  </div>
</div>
```

- [x] **Step 5: 为空状态与 loading 状态补齐正式产品化外观**

```tsx
{groups.length === 0 ? (
  <div className="rounded-[28px] border border-dashed border-[var(--app-border)] bg-[var(--app-panel-bg)] px-6 py-10 text-center">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-subtle-bg)] text-[var(--app-link)]">
      <PlusIcon className="h-5 w-5" />
    </div>
    <h2 className="text-xl" data-ui-heading="serif">Start a new workspace</h2>
    <p className="mt-2 text-sm text-[var(--app-hint)]">当前没有 session，但创建入口、说明和主 CTA 都保持清晰。</p>
    <Button className="mt-5" onClick={props.onNewSession}>New session</Button>
  </div>
) : null}
```

- [x] **Step 6: 运行列表测试与类型检查**

Run: `pnpm --dir web test -- web/src/components/SessionList.test.tsx && pnpm --dir web typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add web/src/components/SessionList.tsx web/src/components/SessionList.test.tsx
git commit -m "feat(web): redesign sessions list workspace shell"
```

### Task 4: 重做聊天页壳层与顶部工作栏

**Files:**
- Modify: `web/src/components/SessionHeader.tsx`
- Modify: `web/src/components/SessionChat.tsx`
- Create: `web/src/components/SessionHeader.test.tsx`

**Completed:** 已新增 `web/src/components/SessionHeader.test.tsx`，锁定聊天页 header 中 title、flavor、model、worktree 关键信息继续展示；并将 `SessionHeader` 重做为更稳定的工作栏卡片，保留返回、查看文件、更多菜单、重命名、归档、删除等原有行为不变。`SessionChat` 也已调整为统一工作台壳层：team panel 收敛到主容器内，inactive banner 收敛到聊天卡片顶部，thread 与 composer 共享同一暖色面板容器。已通过 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" test -- src/components/SessionHeader.test.tsx` 与 `pnpm --dir "/Users/arwen/Desktop/Arwen/evanfang/hapi/web" typecheck` 验证。

- [x] **Step 1: 写失败测试，锁定 header 中标题、flavor、model、worktree 仍显示**

```tsx
import { render, screen } from '@testing-library/react'
import { SessionHeader } from './SessionHeader'

it('keeps title flavor model and worktree in the session header', () => {
  render(
    <SessionHeader
      session={{
        id: 'sess-1',
        active: true,
        metadata: {
          name: 'Release prep',
          flavor: 'claude',
          worktree: { branch: 'feat/redesign' },
          model: 'sonnet'
        }
      } as any}
      onBack={() => {}}
      api={null}
    />
  )

  expect(screen.getByText('Release prep')).toBeInTheDocument()
  expect(screen.getByText(/claude/i)).toBeInTheDocument()
  expect(screen.getByText(/worktree/i)).toBeInTheDocument()
})
```

- [x] **Step 2: 运行 header 测试确认基线**

Run: `pnpm --dir web test -- web/src/components/SessionHeader.test.tsx`
Expected: PASS。

- [x] **Step 3: 重做 `SessionHeader` 为稳定工作栏，不改菜单/删除/归档行为**

```tsx
<div className="border-b border-[var(--app-divider)] bg-[var(--app-bg)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
  <div className="mx-auto flex w-full max-w-content items-start gap-3 px-3 py-3 md:px-5">
    <button className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-hint)] hover:text-[var(--app-fg)]" />
    <div className="min-w-0 flex-1 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-3 shadow-[var(--app-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xl leading-tight" data-ui-heading="serif">{title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--app-hint)]">
            <Badge variant="default">{session.metadata?.flavor?.trim() || 'unknown'}</Badge>
            {modelLabel ? <span>{t(modelLabel.key)}: {modelLabel.value}</span> : null}
            {worktreeBranch ? <span>{t('session.item.worktree')}: {worktreeBranch}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* files button + more button 保持原逻辑 */}
        </div>
      </div>
    </div>
  </div>
</div>
```

- [x] **Step 4: 调整 `SessionChat` 壳层，给 thread/composer 一个统一工作台容器**

```tsx
<div className="flex min-h-0 flex-1 flex-col bg-[var(--app-bg)]">
  <SessionHeader ... />
  <div className="mx-auto flex min-h-0 w-full max-w-content flex-1 flex-col px-3 pb-3 md:px-5 md:pb-5">
    {props.session.teamState ? <TeamPanel teamState={props.session.teamState} /> : null}
    <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-[30px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-[var(--app-shadow-sm)]">
      <HappyThread ... />
      <HappyComposer ... />
    </div>
  </div>
</div>
```

- [x] **Step 5: 如果存在 inactive banner / pending approvals / summary 侧块，统一收敛到壳层内部的辅助区域**

```tsx
<div className="border-b border-[var(--app-divider)] bg-[var(--app-panel-muted-bg)] px-4 py-3 text-sm text-[var(--app-hint)]">
  {bannerContent}
</div>
```

- [x] **Step 6: 运行 header 测试与类型检查**

Run: `pnpm --dir web test -- web/src/components/SessionHeader.test.tsx && pnpm --dir web typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add web/src/components/SessionHeader.tsx web/src/components/SessionChat.tsx web/src/components/SessionHeader.test.tsx
git commit -m "feat(web): redesign session chat shell"
```

### Task 5: 统一消息块、ToolCard 与 composer 表现

**Files:**
- Modify: `web/src/components/AssistantChat/HappyThread.tsx`
- Modify: `web/src/components/AssistantChat/HappyComposer.tsx`
- Modify: `web/src/components/AssistantChat/messages/AssistantMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/UserMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/SystemMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/ToolMessage.tsx`
- Modify: `web/src/components/AssistantChat/messages/MessageAttachments.tsx`
- Modify: `web/src/components/AssistantChat/messages/MessageStatusIndicator.tsx`
- Modify: `web/src/components/ToolCard/ToolCard.tsx`
- Verify/adjust if needed: `web/src/components/ToolCard/views/*.tsx`
- Test: `web/src/components/ToolCard/checklist.test.tsx`

- [x] **Step 1: 复跑 ToolCard 测试，确保后续消息系统改动有回归保护**

Run: `pnpm --dir web test -- web/src/components/ToolCard/checklist.test.tsx`
Expected: PASS。

- [x] **Step 2: 为 thread viewport 建立统一阅读节奏与消息容器边距**

```tsx
<div ref={viewportRef} className="app-scroll-y min-h-0 flex-1 overflow-x-hidden bg-transparent">
  <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col px-3 py-4 md:px-6 md:py-6">
    {showLoadOlder ? <div className="mb-4 self-center"><Button variant="secondary" size="sm">Load older</Button></div> : null}
    <div className="happy-thread-messages flex flex-col gap-4">
      <ThreadPrimitive.Messages components={THREAD_MESSAGE_COMPONENTS} />
    </div>
  </div>
</div>
```

- [x] **Step 3: 把不同消息类型统一到同一布局系统，只通过壳层区分语义**

```tsx
// UserMessage
<div className="ml-auto max-w-[min(78ch,85%)] rounded-[22px] border border-transparent bg-[var(--app-subtle-bg)] px-4 py-3 text-[var(--app-fg)]">
  {content}
</div>

// AssistantMessage
<div className="mr-auto max-w-[min(82ch,100%)] rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-3 shadow-[var(--app-shadow-sm)]">
  {content}
</div>

// SystemMessage
<div className="mx-auto max-w-[72ch] rounded-full border border-[var(--app-border)] bg-[var(--app-panel-muted-bg)] px-4 py-2 text-xs text-[var(--app-hint)]">
  {content}
</div>
```

- [x] **Step 4: 重做 `ToolCard` 为统一工具结果卡，但保留 title/body/footer/permission 闭环**

```tsx
<Card className="overflow-hidden rounded-[24px] border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] shadow-[var(--app-shadow-sm)]">
  <CardHeader className="border-b border-[var(--app-divider)] px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-[var(--app-hint)]">{subtitle}</div> : null}
      </div>
      {statusBadge}
    </div>
  </CardHeader>
  {hasBody ? <CardContent className="px-4 py-3">{body}</CardContent> : null}
</Card>
```

- [x] **Step 5: 把 composer 升级成页面核心控件，保留附件、slash/model/effort/mode 等控制信息**

```tsx
<div className="border-t border-[var(--app-divider)] bg-[var(--app-panel-bg)] p-3 md:p-4">
  <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] shadow-[var(--app-shadow-sm)]">
    <StatusBar ... />
    {attachments.length > 0 ? <div className="flex flex-wrap gap-2 border-b border-[var(--app-divider)] px-4 py-3"><ComposerPrimitive.Attachments ... /></div> : null}
    <div className="flex items-end gap-3 px-4 py-4">
      <ComposerPrimitive.Input className="min-h-[84px] flex-1 resize-none bg-transparent text-[15px] leading-7 text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none" />
      <ComposerButtons ... />
    </div>
  </div>
</div>
```

- [x] **Step 6: 对 `ToolCard/views/*.tsx` 只做密度和 className 对齐，不改字段与交互逻辑**

```tsx
<div className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-3 py-2 text-sm">
  {existingViewContent}
</div>
```

- [x] **Step 7: 运行 ToolCard 测试与类型检查**

Run: `pnpm --dir web test -- web/src/components/ToolCard/checklist.test.tsx && pnpm --dir web typecheck`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add web/src/components/AssistantChat/HappyThread.tsx web/src/components/AssistantChat/HappyComposer.tsx web/src/components/AssistantChat/messages/AssistantMessage.tsx web/src/components/AssistantChat/messages/UserMessage.tsx web/src/components/AssistantChat/messages/SystemMessage.tsx web/src/components/AssistantChat/messages/ToolMessage.tsx web/src/components/AssistantChat/messages/MessageAttachments.tsx web/src/components/AssistantChat/messages/MessageStatusIndicator.tsx web/src/components/ToolCard/ToolCard.tsx web/src/components/ToolCard/views/*.tsx web/src/components/ToolCard/checklist.test.tsx
git commit -m "feat(web): unify chat messages and tool cards"
```

### Task 6: 重做新建会话页为创建入口页

**Files:**
- Modify: `web/src/components/NewSession/index.tsx`
- Modify: `web/src/components/NewSession/DirectorySection.tsx`
- Modify as needed: `web/src/components/NewSession/MachineSelector.tsx`
- Modify as needed: `web/src/components/NewSession/AgentSelector.tsx`
- Modify as needed: `web/src/components/NewSession/ModelSelector.tsx`
- Modify as needed: `web/src/components/NewSession/ClaudeEffortSelector.tsx`
- Modify as needed: `web/src/components/NewSession/ReasoningEffortSelector.tsx`
- Modify as needed: `web/src/components/NewSession/SessionTypeSelector.tsx`
- Modify as needed: `web/src/components/NewSession/YoloToggle.tsx`
- Modify as needed: `web/src/components/NewSession/ActionButtons.tsx`
- Create: `web/src/components/NewSession/index.test.tsx`

- [x] **Step 1: 写失败测试，锁定新建页已有字段、最近路径和状态提示不丢失**

```tsx
import { render, screen } from '@testing-library/react'
import { NewSession } from './index'

it('keeps machine directory model effort worktree and error messaging visible', () => {
  render(<NewSession />)

  expect(screen.getByText(/Machine/i)).toBeInTheDocument()
  expect(screen.getByText(/Directory/i)).toBeInTheDocument()
  expect(screen.getByText(/Agent/i)).toBeInTheDocument()
  expect(screen.getByText(/Model/i)).toBeInTheDocument()
  expect(screen.getByText(/Effort/i)).toBeInTheDocument()
})
```

- [x] **Step 2: 运行测试确认基线**

Run: `pnpm --dir web test -- web/src/components/NewSession/index.test.tsx`
Expected: PASS。

- [x] **Step 3: 重组页面骨架为 header + section cards + CTA 区**

```tsx
<div className="mx-auto w-full max-w-content px-3 py-4 md:px-5 md:py-6">
  <div className="mb-4 rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-5 py-5 shadow-[var(--app-shadow-sm)]">
    <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-hint)]">Create session</p>
    <h1 className="mt-2 text-3xl leading-none" data-ui-heading="serif">Start a new workspace</h1>
    <p className="mt-3 max-w-2xl text-sm text-[var(--app-hint)]">先确定机器与目录，再选择 agent、model、effort、session type 与 worktree 相关设置。</p>
  </div>

  <div className="grid gap-4">
    <Card className="p-4">{machineSection}</Card>
    <Card className="p-4">{directorySection}</Card>
    <Card className="p-4">{runtimeSection}</Card>
    <Card className="p-4">{worktreeSection}</Card>
    <Card className="p-4">{actionsSection}</Card>
  </div>
</div>
```

- [x] **Step 4: 把 `DirectorySection` 输入、最近路径、状态提示对齐到统一语法**

```tsx
<input
  type="text"
  className="w-full rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-3 text-sm text-[var(--app-fg)] shadow-[var(--app-shadow-sm)] focus:outline-none focus:ring-2 focus:ring-[color:var(--app-link)]"
/>
<div className="mt-3 flex flex-wrap gap-2">
  {props.recentPaths.map((path) => (
    <button className="rounded-full border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-1.5 text-xs text-[var(--app-fg)]">{path}</button>
  ))}
</div>
{props.statusMessage ? (
  <div className="mt-3 rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel-muted-bg)] px-3 py-2 text-xs text-[var(--app-hint)]">
    {props.statusMessage}
  </div>
) : null}
```

- [x] **Step 5: 对各 selector 子组件只收敛外观，不改 value / onChange / 校验逻辑**

```tsx
<label className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--app-hint)]">{label}</label>
<button className="flex min-h-11 w-full items-center justify-between rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 py-3 text-left shadow-[var(--app-shadow-sm)]">
  <span>{currentLabel}</span>
  <ChevronIcon className="h-4 w-4 text-[var(--app-hint)]" />
</button>
```

- [x] **Step 6: 运行新建页测试与类型检查**

Run: `pnpm --dir web test -- web/src/components/NewSession/index.test.tsx && pnpm --dir web typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add web/src/components/NewSession/index.tsx web/src/components/NewSession/DirectorySection.tsx web/src/components/NewSession/MachineSelector.tsx web/src/components/NewSession/AgentSelector.tsx web/src/components/NewSession/ModelSelector.tsx web/src/components/NewSession/ClaudeEffortSelector.tsx web/src/components/NewSession/ReasoningEffortSelector.tsx web/src/components/NewSession/SessionTypeSelector.tsx web/src/components/NewSession/YoloToggle.tsx web/src/components/NewSession/ActionButtons.tsx web/src/components/NewSession/index.test.tsx
git commit -m "feat(web): redesign new session entry flow"
```

### Task 7: 覆盖 files、file viewer、terminal、settings 四类页面

**Files:**
- Modify: `web/src/routes/sessions/files.tsx`
- Modify: `web/src/routes/sessions/file.tsx`
- Modify: `web/src/routes/sessions/terminal.tsx`
- Modify: `web/src/routes/settings/index.tsx`
- Test: `web/src/routes/sessions/terminal.test.tsx`
- Test: `web/src/routes/settings/index.test.tsx`

- [ ] **Step 1: 先跑现有 terminal/settings 测试作为回归保护**

Run: `pnpm --dir web test -- web/src/routes/sessions/terminal.test.tsx web/src/routes/settings/index.test.tsx`
Expected: PASS。

- [ ] **Step 2: 重做 files 列表页 header、search、tabs 和 summary 容器**

```tsx
<div className="mx-auto w-full max-w-content px-3 py-4 md:px-5">
  <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 shadow-[var(--app-shadow-sm)]">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-hint)]">Repository</p>
        <h1 className="mt-2 text-3xl leading-none" data-ui-heading="serif">Files</h1>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--app-hint)]">{subtitle}{branchLabel}{gitSummary}</div>
      </div>
      <input className="h-11 w-full rounded-full border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-4 md:max-w-sm" placeholder="Search files" />
    </div>
    <div className="mt-4 flex gap-2">{changesTab}{directoriesTab}</div>
  </div>
</div>
```

- [ ] **Step 3: 让 file viewer 的外围 Claude 化，但保持 diff/code 专业密度**

```tsx
<div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 shadow-[var(--app-shadow-sm)]">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="text-sm font-medium">{displayPath}</div>
      <div className="mt-1 text-xs text-[var(--app-hint)]">{modeMeta}</div>
    </div>
    <div className="flex gap-2">{diffToggle}{fileToggle}{copyButtons}</div>
  </div>
  <div className="overflow-hidden rounded-[20px] border border-[var(--app-border)] bg-[var(--app-code-bg)]">
    {codeOrDiffView}
  </div>
</div>
```

- [x] **Step 4: 重做 terminal 页外围容器与控制区，不动 terminal viewport 行为**

```tsx
<div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 shadow-[var(--app-shadow-sm)]">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-hint)]">Embedded tool</p>
      <h1 className="mt-2 text-3xl leading-none" data-ui-heading="serif">Terminal</h1>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--app-hint)]"><ConnectionIndicator status={status} />{subtitle}</div>
    </div>
    <div className="flex flex-wrap gap-2">{quickButtons}{pasteButton}</div>
  </div>
  <div className="overflow-hidden rounded-[24px] border border-[var(--app-border)] bg-[#191816]">{terminalViewport}</div>
  <div className="mt-3 rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-muted-bg)] p-3">{quickInputRows}</div>
</div>
```

- [x] **Step 5: 把 settings 页改成偏好中心 section layout，不折叠现有设置项**

```tsx
<div className="mx-auto w-full max-w-content px-3 py-4 md:px-5">
  <div className="mb-4 rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-[var(--app-shadow-sm)]">
    <p className="text-xs uppercase tracking-[0.16em] text-[var(--app-hint)]">Preferences</p>
    <h1 className="mt-2 text-3xl leading-none" data-ui-heading="serif">Settings</h1>
  </div>
  <div className="grid gap-4">
    <Card className="p-4">{languageSection}</Card>
    <Card className="p-4">{appearanceSection}</Card>
    <Card className="p-4">{voiceSection}</Card>
    <Card className="p-4">{aboutSection}</Card>
  </div>
</div>
```

- [x] **Step 6: 运行 terminal/settings 测试与类型检查**

Run: `pnpm --dir web test -- web/src/routes/sessions/terminal.test.tsx web/src/routes/settings/index.test.tsx && pnpm --dir web typecheck`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add web/src/routes/sessions/files.tsx web/src/routes/sessions/file.tsx web/src/routes/sessions/terminal.tsx web/src/routes/settings/index.tsx web/src/routes/sessions/terminal.test.tsx web/src/routes/settings/index.test.tsx
git commit -m "feat(web): redesign files terminal and settings surfaces"
```

### Task 8: 最终打磨、全量回归与验收

**Files:**
- Modify: `web/src/index.css`
- Modify: any files touched above that need spacing/token follow-up
- Test: all impacted tests in `web/src/**/*test*`

**Completed:** 已逐页核对 sessions/chat/new session/files/terminal/settings 六类核心页面的展示信息未丢失：sessions 仍展示 title/summary/todo/pending/flavor/model/path/machine/worktree/更新时间；chat 仍展示 header、消息内容、tool output、permission、slash、model、effort、mode；new session 仍展示 machine、directory、recent paths、worktree、errors、create CTA；files 仍展示 git 状态、search、path、diff、file content；terminal 仍展示 tabs/pane/连接状态/错误/输入/辅助按钮；settings 仍展示全部设置项与当前值。并完成收尾样式微调：在 `web/src/index.css` 增加 `--app-radius-panel/control/pill` token，并把 `SessionList`、`SessionHeader`、`SessionChat`、`NewSession`、`terminal`、`settings` 等页面残余硬编码圆角收口到 token 化 panel/control/pill 体系，继续保持 light/dark 主题兼容且不改逻辑。

- [x] **Step 1: 逐页人工核对六类核心页面的“信息未丢失”约束**

Checklist:

```text
sessions: title / summary / todo / pending / flavor / model / path / machine / worktree / 更新时间
chat: header / 消息内容 / tool output / permission / slash / model / effort / mode
new session: machine / directory / recent paths / worktree / errors / create CTA
files: git 状态 / search / path / diff / file content
terminal: tabs / pane / 连接状态 / 错误 / 输入 / 辅助按钮
settings: 全部设置项与当前值
```

- [x] **Step 2: 修正收尾样式，只做 token、spacing、border、shadow、typography 微调**

```css
:root {
  --app-radius-panel: 28px;
  --app-radius-control: 18px;
  --app-radius-pill: 999px;
}
```

- [x] **Step 3: 运行受影响测试**

Run: `pnpm --dir web test -- web/src/components/SessionList.test.tsx web/src/components/SessionHeader.test.tsx web/src/components/NewSession/index.test.tsx web/src/components/ToolCard/checklist.test.tsx web/src/routes/sessions/terminal.test.tsx web/src/routes/settings/index.test.tsx`
Expected: PASS。

- [x] **Step 4: 运行全量测试、类型检查和构建**

Run: `pnpm --dir web test && pnpm --dir web typecheck && pnpm --dir web build`
Expected: 全部 PASS，Vite 构建成功。

- [ ] **Step 5: Commit**

```bash
git add web/src/index.css web/src/components web/src/routes
git commit -m "feat(web): finish claude-inspired redesign rollout"
```

---

## Self-Review

### Spec coverage
- 全局 token/light-dark 语义：Task 1
- 统一按钮/输入/卡片/badge/dialog/menu/toast：Task 2、Task 6、Task 7
- sessions / chat / new session 三个主骨架：Task 3、Task 4、Task 6
- files / file viewer / terminal / settings：Task 7
- message blocks / tool cards / composer：Task 5
- “不能丢失当前已展示信息”硬约束：Task 3、Task 4、Task 6、Task 7、Task 8 都有测试或人工验收清单覆盖
- 只改 UI 表现层、不改逻辑/API/路由：所有任务均明确限制为 className、容器结构、token 与视觉层级改造

### Placeholder scan
- 没有 `TODO`、`TBD`、`implement later` 之类占位符
- “Modify as needed” 仅用于已知 selector 文件集合，具体动作限定为统一外观，不引入新逻辑
- 每个任务都附了明确命令和预期输出

### Type consistency
- 统一使用现有 `--app-*` token 体系，而不是引入新 token API
- 一直使用 `Button` / `Card` / `Badge` 这些现有组件名
- 始终强调保留 `flavor`、`model`、`worktree`、`pendingRequestsCount`、`todoProgress` 等现有字段

### Notes
- 计划中的测试文件名如 `SessionList.test.tsx`、`SessionHeader.test.tsx`、`NewSession/index.test.tsx` 当前若不存在，则在对应任务中创建
- `git add web/src/components/ToolCard/views/*.tsx` 需在 shell 中保持 glob 可展开；若 shell 配置不支持，执行时改为逐文件 `git add`
