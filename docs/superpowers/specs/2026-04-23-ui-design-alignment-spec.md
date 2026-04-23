# UI Design Alignment Spec — Full Coverage

**Date**: 2026-04-23
**Scope**: Align all web pages with design mockups in `web/design/`
**Priority**: All differences must be resolved unless explicitly noted as "keep implementation"

---

## Overview

10 design mockup pages compared against current implementation. ~150+ individual differences identified across layout, styling, typography, color, spacing, icons, and interactive behavior.

### Design mockup files
- `redesign-index.html` — Sessions list (home)
- `redesign-ab-hybrid.html` — Sessions list variant
- `redesign-login.html` — Login page
- `redesign-chat.html` — Chat/session detail
- `redesign-new-session.html` — New session creation
- `redesign-machines.html` — Machines management
- `redesign-history.html` — Session history
- `redesign-files.html` — File browser
- `redesign-file.html` — File detail/diff viewer
- `redesign-terminal.html` — Terminal view
- `redesign-settings.html` — Settings page

---

## Cross-Page Fixes (Apply Globally)

### G-01: FAB gradient and hover
- **Current**: Solid `bg-[var(--app-link)]`, shadow `0 4px 12px rgba(201,100,66,0.3)`, only `active:scale-95`
- **Target**: `background: linear-gradient(135deg, var(--app-link) 0%, #d97757 100%)`, shadow `0 4px 16px rgba(201,100,66,0.35)`, hover: `scale(1.08)` + `0 6px 24px rgba(201,100,66,0.45)`
- **Files**: `web/src/components/layout/MobileTabBar.tsx`

### G-02: Tab bar shadow removal
- **Current**: `shadow-[0_-4px_20px_rgba(0,0,0,0.06)]` + dark variant
- **Target**: No shadow
- **Files**: `MobileTabBar.tsx`

### G-03: Active tab label weight
- **Current**: `font-600` (semibold) when active
- **Target**: `font-500` (medium) — same as inactive
- **Files**: `MobileTabBar.tsx`

### G-04: Shadow CSS variable values
- **Current (dark)**: `--app-shadow-sm: 0 2px 8px rgba(0,0,0,0.3)`, `--app-shadow-md: 0 12px 32px rgba(0,0,0,0.32)`
- **Current (light)**: `--app-shadow-md: 0 10px 30px rgba(30,24,17,0.06)`
- **Target (dark)**: `--app-shadow-sm: 0 2px 8px rgba(0,0,0,0.2)`, `--app-shadow-md: 0 8px 24px rgba(0,0,0,0.3)`
- **Target (light)**: `--app-shadow-md: 0 8px 24px rgba(30,24,17,0.08)`
- **Files**: `web/src/index.css`

### G-05: FAB margin-top
- **Current**: `-mt-6` (-24px)
- **Analysis**: Mockups use both -24px (ab-hybrid, machines, settings) and -20px (history, mobile breakpoints). Current -24px is acceptable.
- **Resolution**: No change needed

---

## Page-by-Page Fixes

### P-01: Index / Sessions List (SessionList.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| S-01 | Session card layout: flexbox instead of CSS Grid 3-col (10px/1fr/auto) with right column | Restructure card to use grid with right column for time pill + agent label + more button |
| S-02 | Branch display: tag pill instead of dedicated `⎇ feat/xxx` line | Add dedicated branch line with branch icon character |
| S-03 | Missing "Duplicate" context menu option | Add Duplicate action to SessionActionMenu |
| S-04 | Page side padding: 12px (mobile) instead of 24px | Change `px-3` to `px-6` on mobile |
| S-05 | Batch bar Archive/Delete buttons missing icons | Add archive and trash SVG icons |
| S-06 | No `@media (hover: hover)` guard on card hover effects | Add `@media (hover: hover)` wrapper in CSS or use `@hover:` Tailwind plugin |
| S-07 | No `:active` scale effect on session cards | Add `active:scale-[0.98]` |
| S-08 | Group header padding: 12px/16px vs 14px/20px | Change to `px-5 py-[14px]` |
| S-09 | Session card padding: 16px/16px vs 14px/18px | Change to `px-[18px] py-[14px]` |
| S-10 | Dynamic `font-${isActive ? '600' : '500'}` may not compile | Use conditional class names with full Tailwind class names |

### P-02: Login (LoginPrompt.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| L-01 | Dialog title: "Hub URL" should be "Hub Server" | Update locale string |
| L-02 | Dialog description: different text | Update locale string |
| L-03 | Dialog slide-up animation missing (`translateY(20px)` on open) | Add CSS animation to DialogContent |
| L-04 | Placeholder opacity missing (0.7) | Add `placeholder:opacity-70` |
| L-05 | Page background transition missing | Add `transition: background 0.3s ease, color 0.3s ease` to body/wrapper |
| L-06 | Custom hub badge color: no link color change for custom URL | Add conditional `text-[var(--app-link)]` when custom URL is set |
| L-07 | Dialog title font-style: italic should be normal | Remove `fontStyle: 'italic'` from DialogTitle |
| L-08 | Dialog secondary/cancel button: transparent+border vs filled subtle-bg | Add Cancel button with `bg-[var(--app-subtle-bg)]` filled style |
| L-09 | Footer text: "by Epoch2023" should be "for developers" | Update locale string |
| L-10 | Input transition: `transition-colors` should be `transition-all` | Change to `transition-all duration-200` |

### P-03: Chat (SessionChat.tsx + related)

**Note**: Requires further detailed investigation to produce precise fix list. Key areas:
- Message bubble styling vs design
- Input/composer area layout
- Header elements alignment
- Sidebar session list alignment with index page

### P-04: New Session (NewSession/index.tsx + sub-components)

| ID | Issue | Fix |
|----|-------|-----|
| N-01 | Machine icon: no server/rack icon differentiation | Add conditional icon based on machine type |
| N-02 | Section labels: 4 components use normal-case + medium weight | Change DirectorySection, ModelSelector, ClaudeEffortSelector, ReasoningEffortSelector to uppercase + semibold |
| N-03 | Directory input: separate input + browse button instead of unified container | Restructure into single bordered container with icon + input + browse inline |
| N-04 | Recent path text color: `--app-fg` (full) should be `--app-hint` (muted) | Change `text-[var(--app-fg)]` to `text-[var(--app-hint)]` |
| N-05 | Browse button background: `panel-elevated-bg` should be `subtle-bg` | Change to `bg-[var(--app-subtle-bg)]` |
| N-06 | "Opencode" should be "OpenCode" | Fix capitalization in AgentSelector |
| N-07 | Model/Effort labels: "(optional)" suffix not in design | Remove "(optional)" text |
| N-08 | "Recent:" label above recent paths not in design | Remove explicit label |

### P-05: Machines (machines/index.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| M-01 | Drawer session list completely missing | Add session list section to MachineDrawer |
| M-02 | Stats row: not in mockup normal state but has CSS definition | Keep (enhancement) — design CSS defines the styles |
| M-03 | "X machines online" placement: sticky header vs content section-title | Move to content area as section-title |
| M-04 | Drawer overlay dark mode: 0.4 opacity should be 0.6 | Add dark mode variant `dark:bg-black/60` |
| M-05 | Drawer handle: `--app-border` should be `--app-subtle-bg` | Change to `bg-[var(--app-subtle-bg)]` |
| M-06 | Drawer close animation missing | Keep drawer mounted during close, use CSS transition |
| M-07 | Body scroll lock when drawer open | Add `document.body.style.overflow = 'hidden'` on open |
| M-08 | Refresh icon: different SVG paths | Update to match design mockup SVG |
| M-09 | Stat card padding (mobile): 12px should be 16px | Change to `p-4` without responsive override |
| M-10 | Stat value font size (mobile): 24px should be 28px | Change to `text-[28px]` without responsive override |

### P-06: History (history/index.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| H-01 | Card click: opens session instead of toggling action buttons | Change card click to toggle actions; add separate click target for opening session |
| H-02 | Meta content: shows agent/model instead of message count | Change to show "X messages" |
| H-03 | Restore functionality: disabled in implementation | Enable restore action for archived/deleted items |
| H-04 | No confirmation dialogs for destructive actions | Add confirm dialogs for archive, delete, permanent delete |
| H-05 | Search not debounced (200ms in design) | Add debounce |
| H-06 | Search placeholder: "Search sessions..." should be "Search history..." | Update locale string |
| H-07 | Content max-width: 600px constrained, should be full-width | Remove `max-w-[600px]` |
| H-08 | Header sticky: not in mockup | Remove `sticky top-0 z-10` |
| H-09 | Avg duration stat: "---" hardcoded, should calculate real value | Implement calculation |
| H-10 | Archive icon SVG: different paths | Update to match design mockup |
| H-11 | SVG stroke-width: 1.5 should be 2 | Change to `strokeWidth="2"` |
| H-12 | Header padding: 20px horizontal should be 16px | Change to `px-4` |
| H-13 | Preview margin-top: 2px should be 4px | Change to `mt-1` |
| H-14 | Meta row margin-top: 4px should be 8px | Change to `mt-2` |
| H-15 | Filter panel padding: 10px vertical should be 12px | Change to `py-3` |

### P-07: Files (sessions/files.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| F-01 | Top safe-area padding: 16px should be 8px | Change paddingTop calculation |
| F-02 | Card border-radius: shadcn default should be 24px | Add `rounded-[24px]` to Card |
| F-03 | Header title: text-3xl (30px) should be 24px, with italic | Change to `text-[24px] italic` |
| F-04 | Header label: 11px/0.16em should be 10px/0.5px | Change to `text-[10px] tracking-[0.5px]` |
| F-05 | Header description: text-sm (14px) should be 13px | Change to `text-[13px]` |
| F-06 | File icon coloring: extension-based should be git-status-based | Add git status color logic |
| F-07 | Diff text color: uses darker vars should use `--app-fg` | Change to `text-[var(--app-fg)]` |
| F-08 | Renamed file arrow: "→ " between paths should be "← " before old path only | Change arrow direction and display |
| F-09 | Section header bg: `panel-muted-bg` should be `subtle-bg` | Change to `bg-[var(--app-subtle-bg)]` |

### P-08: File Detail (sessions/file.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| FD-01 | Top safe-area padding: 16px should be 8px | Same as F-01 |
| FD-02 | Card border-radius: should be 24px | Same as F-02 |
| FD-03 | Header title: text-3xl (30px) should be 28px | Change to `text-[28px]` |
| FD-04 | Header title line-height: leading-none should be 1.2 | Change to `leading-[1.2]` |
| FD-05 | Header description: text-sm (14px) should be 13px | Change to `text-[13px]` |
| FD-06 | Path badge: no monospace font, wrong padding | Add `font-mono`, change to `py-[6px]` |
| FD-07 | Mode tabs: padding 8px vertical should be 10px | Change to `py-[10px]` |
| FD-08 | Mode tabs desktop: absolute positioning vs flex layout | Consider absolute positioning for desktop |
| FD-09 | Diff warning: hardcoded amber should use CSS variables | Use `--app-warning` variable |
| FD-10 | Code block bg: `code-bg` should be `subtle-bg` | Change to `bg-[var(--app-subtle-bg)]` |
| FD-11 | Skeleton border-radius: `rounded-md` should be 20px | Change to `rounded-[20px]` |
| FD-12 | Empty state icon: 56px should be 64px | Change to `w-16 h-16` |

### P-09: Terminal (sessions/terminal.tsx)

**Note**: Requires further detailed investigation. Key areas:
- 720px max-width constraint
- Terminal background color in dark mode
- Header path font (sans-serif vs monospace)
- Quick-input title visibility on mobile

### P-10: Settings (settings/index.tsx)

| ID | Issue | Fix |
|----|-------|-----|
| ST-01 | No mobile responsive breakpoints | Add `@media (max-width: 640px)` adjustments for header, title, content, avatar |
| ST-02 | User name font-size: 16px should be 17px | Change to `text-[17px]` |
| ST-03 | Theme icon: dynamic sun/moon vs always sun | Change to always show sun icon (design intent) |
| ST-04 | Documentation icon: book should be file-with-fold-corner | Replace SVG |
| ST-05 | GitHub icon: filled should be outline stroke | Replace SVG |
| ST-06 | No `overflow: hidden` on card | Add `overflow-hidden` |
| ST-07 | Server status color: `--app-git-staged-color` should use dedicated success var | Consider adding `--app-success` or use existing |

---

## Items to Keep (Implementation Enhancement)

These are intentional improvements over the design and should NOT be reverted:
- i18n internationalization
- Voice assistant settings section
- Terminal font size setting
- Directory autocomplete suggestions
- Directory existence validation
- Agent/machine preference persistence (localStorage)
- Accessibility improvements (ARIA roles, focus traps, screen reader labels)
- ConfirmDialog on settings logout
- Loading states and error banners
- Syntax highlighting (Shiki) in file viewer
- Copy-to-clipboard with visual feedback
- Dynamic copyright year

---

## Out of Scope

- Desktop-only layouts (two-panel sidebar) — these are enhancements beyond the mobile-first design mockups
- Functional API integration differences (design mockups are static HTML demos)
- Chat page: needs separate detailed investigation before fixes can be scoped
- Terminal page: needs separate detailed investigation before fixes can be scoped
