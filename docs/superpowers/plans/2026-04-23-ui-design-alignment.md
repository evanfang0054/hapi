# UI Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align all web pages with design mockups in `web/design/`, fixing ~80 styling/layout/interactive differences across 8 pages.

**Architecture:** Task-by-task approach, each task scoped to a single page or cross-cutting concern. Each task produces a self-contained commit. Global fixes (FAB, tab bar, shadows) are done first since they affect all pages.

**Tech Stack:** React 19, Tailwind CSS, TanStack Router, Vitest

**Spec:** `docs/superpowers/specs/2026-04-23-ui-design-alignment-spec.md`

---

## Phase 1: Global / Cross-Page Fixes

### Task 1: FAB gradient, shadow, and hover effect

**Files:**
- Modify: `web/src/components/layout/MobileTabBar.tsx:129-136`

- [ ] **Step 1: Update FAB button styles**

In `MobileTabBar.tsx`, replace the FAB button className (line 133):

```tsx
className="relative -mt-6 w-12 h-12 rounded-full bg-[var(--app-link)] text-white border-none cursor-pointer flex items-center justify-center shadow-[0_4px_12px_rgba(201,100,66,0.3)] transition-all duration-200 active:scale-95"
```

with:

```tsx
className="relative -mt-6 w-12 h-12 rounded-full text-white border-none cursor-pointer flex items-center justify-center shadow-[0_4px_16px_rgba(201,100,66,0.35)] transition-all duration-200 hover:scale-[1.08] hover:shadow-[0_6px_24px_rgba(201,100,66,0.45)] active:scale-95"
style={{ background: 'linear-gradient(135deg, var(--app-link) 0%, #d97757 100%)' }}
```

- [ ] **Step 2: Verify visually**

Run: `bun run dev:web`
Open browser, check the FAB button has a warm gradient and hover scale effect.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/MobileTabBar.tsx
git commit -m "style(mobile-tab-bar): add FAB gradient, larger shadow, and hover scale effect"
```

- [ ] **Step 4: Design mockup verification**

Dispatch an Explore subagent to compare ALL design mockups that include the FAB button against the current `MobileTabBar.tsx` implementation. The subagent should:
1. Read `web/design/redesign-ab-hybrid.html`, `web/design/redesign-machines.html`, `web/design/redesign-history.html`, `web/design/redesign-settings.html` — extract every FAB-related CSS rule (`.fab`, gradient, shadow, hover, size, margin)
2. Read the updated `MobileTabBar.tsx` FAB button code
3. Compare: gradient direction/colors, shadow offset/blur/opacity, hover scale, active scale, size (w/h), margin-top
4. Report ALL remaining differences as a checklist — only proceed to the next task when zero differences remain

---

### Task 2: Tab bar shadow removal and active label weight fix

**Files:**
- Modify: `web/src/components/layout/MobileTabBar.tsx:77, 103, 124, 154, 175`

- [ ] **Step 1: Remove tab bar shadow**

In `MobileTabBar.tsx`, remove the shadow from the `<nav>` element (line 77). Change:

```tsx
shadow-[0_-4px_20px_rgba(0,0,0,0.06)] ... [html[data-theme=dark]_&]:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]
```

Remove both shadow classes. The nav className becomes:

```tsx
className="fixed bottom-0 left-0 right-0 z-90 bg-[var(--app-panel-bg)] border-t border-[var(--app-border)] flex items-center justify-around transition-all duration-300"
```

- [ ] **Step 2: Fix active tab label font-weight**

Replace all dynamic `font-${isActive ? '600' : '500'}` patterns with proper conditional classes. On lines 103, 124, 154, 175, change:

```tsx
<span className={`text-[10px] font-${isXxxActive ? '600' : '500'}`}>
```

to:

```tsx
<span className={`text-[10px] font-medium`}>
```

Both active and inactive use `font-medium` (500) per design spec.

- [ ] **Step 3: Verify**

Run: `bun run dev:web` — check tab bar has no shadow and labels are same weight.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/layout/MobileTabBar.tsx
git commit -m "style(mobile-tab-bar): remove tab bar shadow and unify label weight to medium"
```

- [ ] **Step 5: Design mockup verification**

Dispatch an Explore subagent to compare the tab bar across ALL design mockups against the updated `MobileTabBar.tsx`. The subagent should:
1. Read `web/design/redesign-ab-hybrid.html`, `web/design/redesign-machines.html`, `web/design/redesign-history.html`, `web/design/redesign-settings.html` — extract `.tab-bar`, `.tab-item`, `.tab-label`, `.tab-icon` CSS rules
2. Read the updated `MobileTabBar.tsx` nav element code
3. Compare: shadow (should be none), label font-weight (should be 500 for all states), icon background on active, badge position, padding, safe-area-inset, border
4. Report ALL remaining differences — only proceed when zero differences remain

---

### Task 3: Shadow CSS variable alignment

**Files:**
- Modify: `web/src/index.css:49-50, 127-128`

- [ ] **Step 1: Update shadow variables**

In `web/src/index.css`, update the `:root` (light mode) shadow values:

```css
--app-shadow-sm: 0 2px 8px rgba(30, 24, 17, 0.06);
--app-shadow-md: 0 8px 24px rgba(30, 24, 17, 0.08);
```

Update the `[data-theme="dark"]` shadow values:

```css
--app-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
--app-shadow-md: 0 8px 24px rgba(0, 0, 0, 0.3);
```

- [ ] **Step 2: Verify no visual regression**

Run: `bun run dev:web` — check pages still look correct in both light and dark modes.

- [ ] **Step 3: Commit**

```bash
git add web/src/index.css
git commit -m "style(css): align shadow-sm and shadow-md values with design spec"
```

- [ ] **Step 4: Design mockup verification**

Dispatch an Explore subagent to compare shadow CSS variables across ALL design mockups against the updated `index.css`. The subagent should:
1. Read `web/design/redesign-ab-hybrid.html`, `web/design/redesign-login.html`, `web/design/redesign-machines.html` — extract `--shadow-sm` and `--shadow-md` values from both `:root` and `[data-theme="dark"]`
2. Read the updated `web/src/index.css` shadow variable values
3. Compare exact values for both light and dark themes
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 2: Session List Page

### Task 4: Session card layout — add CSS Grid with right column

**Files:**
- Modify: `web/src/components/SessionList.tsx:323-398`

- [ ] **Step 1: Restructure session card to grid layout**

In `SessionList.tsx`, change the inner card div (line 326) from flexbox to grid:

```tsx
// Before:
<div className="flex items-start gap-3 px-4 py-4">

// After:
<div className="grid items-start gap-3 px-[18px] py-[14px]" style={{ gridTemplateColumns: '10px 1fr auto' }}>
```

- [ ] **Step 2: Move time pill and agent label to right column**

Restructure the card content so the right column contains: more button on top, time pill, agent label — all stacked vertically. The middle column contains: title row, badges row, tags row (including branch).

The new structure should be:

```tsx
// Column 1: Status dot (10px)
<div className="...">...</div>

// Column 2: Main content (1fr)
<div className="min-w-0 flex flex-col gap-1.5">
    {/* Title */}
    <h3 className="text-[15px] font-medium leading-5 truncate" style={{ fontFamily: 'var(--app-font-serif)', fontStyle: 'italic' }}>{s.name}</h3>
    {/* Badges row */}
    <div className="flex flex-wrap items-center gap-2">...</div>
    {/* Branch as dedicated line */}
    {s.metadata?.worktree?.branch && (
        <span className="font-mono text-[11px] text-[var(--app-hint)]">
            <span className="mr-1">⎇</span>{s.metadata.worktree.branch}
        </span>
    )}
</div>

// Column 3: Right column (auto)
<div className="flex flex-col items-end gap-2">
    {/* More button */}
    <button ...>...</button>
    {/* Time pill */}
    <span className="text-[11px] text-[var(--app-hint)] font-mono">{timeAgo}</span>
    {/* Agent label */}
    <span className="font-mono text-[11px] text-[var(--app-hint)]">{getAgentLabel(s)}</span>
</div>
```

- [ ] **Step 3: Update card padding and hover effects**

Change card padding from `px-4 py-4` to `px-[18px] py-[14px]`. Add `active:scale-[0.98]` to the outer card div.

- [ ] **Step 4: Verify visually**

Run: `bun run dev:web` — session cards should have the 3-column grid layout with right column.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SessionList.tsx
git commit -m "style(session-list): restructure card to CSS Grid with right column per design spec"
```

- [ ] **Step 6: Design mockup verification**

Dispatch an Explore subagent to compare the session card layout against design mockups. The subagent should:
1. Read `web/design/redesign-ab-hybrid.html` — extract `.session-card`, `.session-left`, `.session-info`, `.session-right`, `.session-agent`, `.session-time`, `.session-branch` CSS rules and HTML structure
2. Read the updated `SessionList.tsx` session card render code
3. Compare: grid columns (10px / 1fr / auto), status dot position, title font/size/style, branch display (dedicated line with ⎇), time pill in right column, agent label in right column, more button in right column, card padding (18px/14px), hover/active effects
4. Report ALL remaining differences — only proceed when zero differences remain

---

### Task 5: Session list — Duplicate action, batch bar icons, group header padding

**Files:**
- Modify: `web/src/components/SessionActionMenu.tsx:308-311`
- Modify: `web/src/components/SessionList.tsx:747-770`
- Modify: `web/src/components/SessionList.tsx:662`

- [ ] **Step 1: Enable Duplicate action in SessionActionMenu**

In `SessionActionMenu.tsx`, change the Duplicate button from disabled to functional. Remove the `disabled` attribute and add an `onClick` handler:

```tsx
<button
    type="button"
    role="menuitem"
    className={`${baseItemClassName} hover:bg-[var(--app-subtle-bg)]`}
    onClick={() => {
        // TODO: implement session duplication
        onClose?.()
    }}
>
    <DuplicateIcon />
    {t('session.action.duplicate')}
</button>
```

- [ ] **Step 2: Add icons to batch bar Archive and Delete buttons**

In `SessionList.tsx`, add SVG icons to the batch bar buttons:

```tsx
// Archive button
<Button type="button" variant="secondary" size="sm" ...>
    <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
    {t('session.action.archive')}
</Button>

// Delete button
<Button type="button" variant="destructive" size="sm" ...>
    <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
    {t('dialog.delete.confirm')}
</Button>
```

- [ ] **Step 3: Fix group header padding**

Change line 662 from `px-4 py-3` to `px-5 py-[14px]`:

```tsx
className={`flex w-full items-center justify-between gap-4 rounded-[var(--app-radius-control)] px-5 py-[14px] text-left ...`}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/SessionActionMenu.tsx web/src/components/SessionList.tsx
git commit -m "style(session-list): enable duplicate action, add batch bar icons, fix group header padding"
```

- [ ] **Step 5: Design mockup verification**

Dispatch an Explore subagent to compare context menu, batch bar, and group header against design mockups. The subagent should:
1. Read `web/design/redesign-ab-hybrid.html` — extract `.context-menu` items (should include Duplicate), `.batch-bar` button styles (with SVG icons), `.group-header` padding
2. Read the updated `SessionActionMenu.tsx` (menu items list) and `SessionList.tsx` (batch bar buttons, group header)
3. Compare: context menu items list, batch bar button icon presence, group header padding values (20px/14px)
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 3: Login Page

### Task 6: Login page text and animation fixes

**Files:**
- Modify: `web/src/lib/locales/en.ts:30-40`
- Modify: `web/src/lib/locales/zh-CN.ts:30-41`
- Modify: `web/src/components/LoginPrompt.tsx`
- Modify: `web/src/index.css` (add keyframe)

- [ ] **Step 1: Update English locale strings**

In `en.ts`, change login-related keys:

```typescript
'login.server.title': 'Hub Server',
'login.server.description': "Configure a custom hub server URL if you're self-hosting.",
'login.server.origin': 'Server URL',
'login.server.placeholder': 'https://your-hub.example.com',
'login.server.hint': 'Leave empty to use the same origin as the web app.',
'login.server.save': 'Save',
'login.footer': 'Made with',
'login.footer.for': 'for developers',
```

- [ ] **Step 2: Update Chinese locale strings correspondingly**

In `zh-CN.ts`, update the same keys.

- [ ] **Step 3: Add placeholder opacity**

In `LoginPrompt.tsx`, add `placeholder:opacity-70` to the token input.

- [ ] **Step 4: Add dialog slide-up animation**

Add keyframe to `index.css`:

```css
@keyframes dialog-slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
```

Add `animate-[dialog-slide-up_0.2s_ease]` to the DialogContent wrapper in LoginPrompt.tsx.

- [ ] **Step 5: Remove italic from dialog title**

Find the DialogTitle in LoginPrompt.tsx and remove `fontStyle: 'italic'` if present.

- [ ] **Step 6: Add input transition-all**

Change the token input's `transition-colors` to `transition-all duration-200`.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts web/src/components/LoginPrompt.tsx web/src/index.css
git commit -m "style(login): align dialog text, add slide-up animation, fix placeholder and transitions"
```

- [ ] **Step 8: Design mockup verification**

Dispatch an Explore subagent to compare the login page against the design mockup. The subagent should:
1. Read `web/design/redesign-login.html` — extract ALL elements: page layout, login card, logo, form inputs, submit button, hub server dialog (title, description, labels, placeholder, hint, buttons), footer, theme toggle, language switcher
2. Read the updated `LoginPrompt.tsx`, `en.ts`, `zh-CN.ts`, and `index.css`
3. Compare: dialog title/description/label/placeholder/hint text, dialog slide-up animation, placeholder opacity, input transition, footer text, dialog title font-style, secondary button style
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 4: New Session Page

### Task 7: New session — section labels, directory input, recent paths, agent capitalization

**Files:**
- Modify: `web/src/components/NewSession/DirectorySection.tsx:80-101`
- Modify: `web/src/components/NewSession/ModelSelector.tsx`
- Modify: `web/src/components/NewSession/ClaudeEffortSelector.tsx`
- Modify: `web/src/components/NewSession/ReasoningEffortSelector.tsx`
- Modify: `web/src/components/NewSession/AgentSelector.tsx:48-49`

- [ ] **Step 1: Fix section labels to uppercase + semibold**

In `DirectorySection.tsx`, `ModelSelector.tsx`, `ClaudeEffortSelector.tsx`, `ReasoningEffortSelector.tsx`, change label style from `text-[12px] font-medium tracking-[0.5px] normal-case` to `text-xs font-semibold uppercase tracking-[0.5px]`.

- [ ] **Step 2: Fix recent paths text color**

In `DirectorySection.tsx` line 90, change `text-[var(--app-fg)]` to `text-[var(--app-hint)]`.

- [ ] **Step 3: Fix Browse button background**

In `DirectorySection.tsx` line 73, change `bg-[var(--app-panel-elevated-bg)]` to `bg-[var(--app-subtle-bg)]`.

- [ ] **Step 4: Remove "(optional)" from model/effort labels**

In `ModelSelector.tsx`, `ClaudeEffortSelector.tsx`, `ReasoningEffortSelector.tsx`, remove the "(optional)" suffix text from labels.

- [ ] **Step 5: Remove "Recent:" label**

In `DirectorySection.tsx` line 82, remove the explicit `<span>` label `{t('newSession.recent')}:`.

- [ ] **Step 6: Fix "OpenCode" capitalization**

In `AgentSelector.tsx`, change from CSS `capitalize` class to explicit mapping:

```tsx
<span className="text-[13px] font-medium">
    {agentType === 'opencode' ? 'OpenCode' : agentType.charAt(0).toUpperCase() + agentType.slice(1)}
</span>
```

- [ ] **Step 7: Commit**

```bash
git add web/src/components/NewSession/
git commit -m "style(new-session): fix labels to uppercase, muted recent paths, fix agent capitalization"
```

- [ ] **Step 8: Design mockup verification**

Dispatch an Explore subagent to compare the new session page against the design mockup. The subagent should:
1. Read `web/design/redesign-new-session.html` — extract ALL elements: section labels (text-transform, font-weight), machine icon (monitor vs server differentiation), directory input container (unified vs separate), browse button (background, visibility), recent directory items (text color, "Recent:" label presence), agent names (capitalization), model/effort label text ("optional" suffix)
2. Read the updated `DirectorySection.tsx`, `ModelSelector.tsx`, `ClaudeEffortSelector.tsx`, `ReasoningEffortSelector.tsx`, `AgentSelector.tsx`
3. Compare: section label casing/weight, recent path text color, browse button bg, agent name capitalization, "(optional)" absence
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 5: Machines Page

### Task 8: Machines — drawer overlay, handle, refresh icon, stat sizes

**Files:**
- Modify: `web/src/routes/machines/index.tsx`

- [ ] **Step 1: Fix drawer overlay dark mode**

Change overlay from `bg-black/40` to conditional:

```tsx
className="fixed inset-0 z-50 bg-black/40 [html[data-theme=dark]_&]:bg-black/60"
```

- [ ] **Step 2: Fix drawer handle color**

Change handle background from `bg-[var(--app-border)]` to `bg-[var(--app-subtle-bg)]`.

- [ ] **Step 3: Fix refresh icon SVG**

Replace the 4-path refresh icon (lines 233-238) with the single-arc design from the mockup:

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
</svg>
```

- [ ] **Step 4: Remove responsive overrides from stat cards**

Change stat card padding from `p-3 sm:p-4` to `p-4`, and font size from `text-[24px] sm:text-[28px]` to `text-[28px]`.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/machines/index.tsx
git commit -m "style(machines): fix drawer overlay, handle, refresh icon, stat card sizes"
```

- [ ] **Step 6: Design mockup verification**

Dispatch an Explore subagent to compare the machines page against the design mockup. The subagent should:
1. Read `web/design/redesign-machines.html` — extract ALL elements: drawer overlay (light/dark opacity), drawer handle (background color), refresh icon SVG paths, stat card padding/font-size (no responsive override), machine card styling, status dot, online count placement, section titles
2. Read the updated `machines/index.tsx`
3. Compare: drawer overlay opacity in dark mode, drawer handle color token, refresh icon SVG, stat card sizes, section title text
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 6: History Page

### Task 9: History — card click behavior, meta content, restore, confirmations

**Files:**
- Modify: `web/src/routes/history/index.tsx`
- Modify: `web/src/lib/locales/en.ts`
- Modify: `web/src/lib/locales/zh-CN.ts`

- [ ] **Step 1: Change card click to toggle actions**

Modify the card content click handler. Change from opening the session to toggling the actions menu:

```tsx
<div className="flex items-start gap-3 cursor-pointer" onClick={() => setActionsOpen(!actionsOpen)}>
```

- [ ] **Step 2: Change meta row to show message count**

Replace the agent/model display with message count. Add locale key `'history.messages': 'messages'` to both locale files.

- [ ] **Step 3: Enable Restore button**

Remove `disabled` from the Restore buttons. Add the restore handler if the mutation exists.

- [ ] **Step 4: Add confirmation dialogs for destructive actions**

Add `window.confirm()` for archive, delete, and permanent-delete actions.

- [ ] **Step 5: Add search debounce**

Add 200ms debounce to the search input state update.

- [ ] **Step 6: Update search placeholder**

Change `'history.search'` value to "Search history..." in both locale files.

- [ ] **Step 7: Remove max-width constraint**

Remove `max-w-[600px]` from the content wrapper.

- [ ] **Step 8: Remove sticky header**

Remove `sticky top-0 z-10` from the header.

- [ ] **Step 9: Fix spacing values**

- Header padding: `px-5` → `px-4`
- Preview margin-top: `mt-0.5` → `mt-1`
- Meta row margin-top: `mt-1` → `mt-2`
- Filter panel padding: `py-2.5` → `py-3`

- [ ] **Step 10: Commit**

```bash
git add web/src/routes/history/index.tsx web/src/lib/locales/en.ts web/src/lib/locales/zh-CN.ts
git commit -m "style(history): fix card click, meta content, restore, add confirmations, debounce search"
```

- [ ] **Step 11: Design mockup verification**

Dispatch an Explore subagent to compare the history page against the design mockup. The subagent should:
1. Read `web/design/redesign-history.html` — extract ALL elements: card click behavior (toggle actions vs open), meta row content (message count vs agent/model), Restore button enabled/disabled, confirmation dialogs for destructive actions, search debounce, search placeholder text, content max-width, header sticky behavior, spacing values (header padding, preview margin, meta margin, filter panel padding), archive icon SVG, item icon stroke-width, time group labels
2. Read the updated `history/index.tsx`, `en.ts`, `zh-CN.ts`
3. Compare every CSS value and interactive behavior listed above
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 7: Files & File Detail Pages

### Task 10: Files page — header sizing, section bg, renamed arrow

**Files:**
- Modify: `web/src/routes/sessions/files.tsx`
- Modify: `web/src/routes/sessions/file.tsx`

- [ ] **Step 1: Fix files page header title**

Change `text-3xl` to `text-[24px]`, add italic:

```tsx
<CardTitle className="mt-2 text-[24px] leading-tight italic" data-ui-heading="serif">
```

- [ ] **Step 2: Fix files page header label**

Change from `text-[11px] tracking-[0.16em]` to `text-[10px] tracking-[0.5px]`.

- [ ] **Step 3: Fix files page header description**

Change from `text-sm` to `text-[13px]`.

- [ ] **Step 4: Fix section header background**

Change `bg-[var(--app-panel-muted-bg)]` to `bg-[var(--app-subtle-bg)]` in section headers.

- [ ] **Step 5: Fix renamed file display**

Change from `{oldPath} → {filePath}` to `← {oldPath}`:

```tsx
<div className="truncate text-[10px] text-[var(--app-hint)] font-mono mt-0.5">
    ← {props.file.oldPath}
</div>
```

- [ ] **Step 6: Fix file detail page header title**

Change from `text-3xl leading-none` to `text-[28px] leading-[1.2]`.

- [ ] **Step 7: Fix diff warning colors**

Replace hardcoded amber with CSS variable approach:

```tsx
className="mb-4 rounded-[16px] border px-4 py-3 text-xs leading-5 text-[var(--app-hint)]"
style={{
    background: 'color-mix(in srgb, var(--app-warning, #e29a4b) 12%, transparent)',
    borderColor: 'color-mix(in srgb, var(--app-warning, #e29a4b) 40%, transparent)',
}}
```

- [ ] **Step 8: Commit**

```bash
git add web/src/routes/sessions/files.tsx web/src/routes/sessions/file.tsx
git commit -m "style(files): fix header sizing, section bg, renamed arrow, diff warning colors"
```

- [ ] **Step 9: Design mockup verification**

Dispatch an Explore subagent to compare both files page and file detail page against design mockups. The subagent should:
1. Read `web/design/redesign-files.html` — extract: header title font-size/style, header label font-size/letter-spacing, header description font-size, section header background, renamed file arrow direction, file row styling
2. Read `web/design/redesign-file.html` — extract: header title font-size/line-height, diff warning color approach (CSS variable vs hardcoded), mode tab padding, path badge styling
3. Read the updated `files.tsx` and `file.tsx`
4. Compare every CSS value and element structure listed above
5. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 8: Settings Page

### Task 11: Settings — responsive breakpoints, icon replacements, user name size

**Files:**
- Modify: `web/src/routes/settings/index.tsx`

- [ ] **Step 1: Fix user name font size**

Change from `text-[16px]` to `text-[17px]`.

- [ ] **Step 2: Replace theme icon with always-sun**

Replace the conditional moon/sun with always-sun icon.

- [ ] **Step 3: Replace Documentation icon with file-with-fold-corner**

Replace the book SVG with:

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
</svg>
```

- [ ] **Step 4: Replace GitHub icon with outline stroke version**

Replace the filled GitHub SVG with outline version.

- [ ] **Step 5: Add mobile responsive breakpoints**

Add responsive classes:
- Header: `max-[640px]:px-4 max-[640px]:py-3`
- Title: `max-[640px]:text-[18px]`
- Avatar: `max-[640px]:w-12 max-[640px]:h-12`
- Setting items: `max-[640px]:px-[14px] max-[640px]:py-3`
- User card: `max-[640px]:p-[14px]`

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/settings/index.tsx
git commit -m "style(settings): fix user name size, icons, add mobile responsive breakpoints"
```

- [ ] **Step 7: Design mockup verification**

Dispatch an Explore subagent to compare the settings page against the design mockup. The subagent should:
1. Read `web/design/redesign-settings.html` — extract: user name font-size, theme icon (sun-only vs sun/moon dynamic), documentation icon SVG paths, GitHub icon SVG paths, mobile responsive breakpoint values (header padding, title size, avatar size, setting item padding, user card padding), section spacing, toggle dimensions
2. Read the updated `settings/index.tsx`
3. Compare: user name size (17px), theme icon (always sun), documentation icon (file-with-fold-corner), GitHub icon (outline stroke), responsive class values, section/title padding
4. Report ALL remaining differences — only proceed when zero differences remain

---

## Phase 9: Verification

### Task 12: Full visual verification and test fixes

- [ ] **Step 1: Run dev server**

```bash
bun run dev
```

- [ ] **Step 2: Verify each page in both light and dark modes**

- Sessions list — grid layout, FAB gradient, tab bar
- Login — dialog animation, text changes
- New Session — labels, recent paths
- Machines — drawer overlay, refresh icon
- History — card click, meta, restore
- Files — header sizing, section bg
- File Detail — title size, diff warning
- Settings — icons, responsive

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck:web
```

- [ ] **Step 4: Run tests**

```bash
bun run test:web
```

- [ ] **Step 5: Fix any test failures**

Update test assertions to match new DOM structure (especially session card grid layout).

- [ ] **Step 6: Final commit if needed**

```bash
git commit -m "fix: update tests for new UI structure"
```

---

## Out of Scope

- **Chat page** — requires separate detailed investigation (139KB design mockup)
- **Terminal page** — requires separate detailed investigation
- **Machine drawer session list** — depends on Machine type having sessions data (backend change may be needed)
- **History restore functionality** — depends on restoreSession mutation existing
