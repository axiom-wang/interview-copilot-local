---
name: 会议智能助手
description: A personal live-meeting briefing desk — slate paper, indigo signals, Inter.
colors:
  indigo-signal: "#4f46e5"
  indigo-signal-hover: "#4338ca"
  indigo-wash: "#eef2ff"
  indigo-ink: "#3730a3"
  accent-border: "#c7d2fe"
  paper: "#ffffff"
  slate-canvas: "#f8fafc"
  slate-canvas-deep: "#f1f5f9"
  hairline: "#e2e8f0"
  input-stroke: "#cbd5e1"
  ink: "#0f172a"
  ink-secondary: "#334155"
  ink-muted: "#64748b"
  ink-quiet: "#94a3b8"
  success: "#059669"
  success-wash: "#ecfdf5"
  success-ink: "#065f46"
  warning: "#d97706"
  warning-wash: "#fffbeb"
  warning-ink: "#92400e"
  danger: "#dc2626"
  danger-wash: "#fef2f2"
  danger-ink: "#991b1b"
  auth-hero-start: "#312e81"
  auth-hero-end: "#6366f1"
  on-accent: "#ffffff"
typography:
  display:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  control: "6px"
  card: "8px"
  panel: "10px"
  pill: "999px"
spacing:
  control-y: "0.5rem"
  control-x: "0.875rem"
  panel: "1rem"
  workbench: "1.25rem"
  sidebar: "220px"
  appbar: "56px"
components:
  button-primary:
    backgroundColor: "{colors.indigo-signal}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.875rem"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.indigo-signal-hover}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.875rem"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.875rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.875rem"
  button-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.875rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.625rem 0.75rem"
  card-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  nav-item-active:
    backgroundColor: "{colors.indigo-wash}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.control}"
    padding: "0.625rem 0.75rem"
  status-badge:
    backgroundColor: "{colors.slate-canvas-deep}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  tabs-trigger-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0.5rem 0.75rem"
---

# Design System: 会议智能助手

## Overview

**Creative North Star: "The Briefing Desk"**

The product looks like a personal briefing desk, not a shared war room. Light slate paper, a white work surface, and one indigo signal color that marks the next action. Login can feel like a softer SaaS product (split hero, generous type). Once inside, the UI is a workbench: 220px sidebar, 56px app bar, and a two-column live floor so the transcript stays beside the hints.

The typeface is Inter plus system Chinese fallbacks — one family for UI and headings. Density is medium: 14px body, 8–10px radii, 16px panel padding. Personality is practical and Chinese-first. The user asked new work to feel **tactile and confident** (clear primary vs ghost, decisive hover color) and for **analysis cards to lift** using the existing medium shadow, while chrome stays flat.

**Confirmed visual rejection:** no neon command-center, no dark glassmorphism, no rainbow status bars.

**Key Characteristics:**
- One Inter stack for Latin and Chinese UI
- Slate paper canvas with white panels
- Indigo used as a scarce action signal
- Hairline slate borders; cards may lift with `--shadow-md`
- Status is semantic (green / amber / red washes), never a rainbow strip
- Dark theme exists as a token overlay on the same structure

## Colors

A cool slate paper field with a single indigo accent. Semantic greens, ambers, and reds are washes for state, not decoration.

### Primary
- **Indigo Signal** (`{colors.indigo-signal}`): primary buttons, input focus border, “start live” actions. Keep it scarce.
- **Indigo Signal Hover** (`{colors.indigo-signal-hover}`): primary hover only.
- **Indigo Wash / Ink / Border** (`{colors.indigo-wash}`, `{colors.indigo-ink}`, `{colors.accent-border}`): selected nav, soft info surfaces, badge-primary.

### Secondary
- **Auth Hero Indigo** (`{colors.auth-hero-start}` → `{colors.auth-hero-end}`): login left pane only (`linear-gradient(160deg, …)`). Do not reuse this gradient on the workbench.

### Neutral
- **Paper** (`{colors.paper}`): sidebar, app bar, panels, inputs.
- **Slate Canvas** (`{colors.slate-canvas}` / `{colors.slate-canvas-deep}`): page background and inset wells.
- **Hairline** (`{colors.hairline}`): sidebar, app bar, panel, divider.
- **Ink** (`{colors.ink}` / `{colors.ink-secondary}` / `{colors.ink-muted}` / `{colors.ink-quiet}`): title → body → meta → kicker.

### Named Rules
**The One Signal Rule.** Indigo fill is for the one action that advances the session (Start, Save settings, Ask). Everything else is secondary, ghost, or a semantic wash.

**The Semantic Wash Rule.** Success, warning, and danger use matching wash + ink + border. Never invent a fourth accent family for “visual interest.”

## Typography

**Display Font:** Inter (PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI)
**Body Font:** same stack
**Label/Mono Font:** none; labels are Inter at 12px / 11px with tracked uppercase kickers

**Character:** Neutral product sans. Chinese and English share one rhythm. Kickers (`Meeting Assistant`, `Session Prep`) are the only ornamental type gesture.

### Hierarchy
- **Display** (600, 2.25rem / `text-4xl`): login title 「会议智能助手」 only.
- **Headline** (600, 1.5rem / `text-2xl`): panel titles such as 「当前阶段」.
- **Title** (600, 1.125rem / `text-lg`): shell product name, drawer titles, section heads.
- **Body** (400, 0.875rem / `text-sm`, line-height ~1.625): transcript, hints, settings, buttons.
- **Label** (600, 0.75rem–11px, `letter-spacing: 0.08em`–`0.18em`, uppercase): `.kicker` and phase meta.

### Named Rules
**The One Voice Type Rule.** Do not add a second display serif or a mono “terminal” face. Kickers may track; body copy never shouts in all caps.

## Layout

App chrome is a two-column product grid: sidebar `{spacing.sidebar}` + fluid main. App bar is `{spacing.appbar}` with `1.25rem` horizontal padding. Main content pads `1rem` (`1.25rem` from `md`).

The sidebar is collapsible at ≥960px: a `«` ghost button in the sidebar header hides it entirely (`.app-shell[data-sidebar="collapsed"]`), and a `»` button appears at the far left of the app bar to bring it back. The state persists in `localStorage`. Below 960px the sidebar stays a drawer behind the 菜单 button.

Live Assist has two column counts, driven by the **measured width of the layout grid** (`ResizeObserver`, not a viewport media query) so collapsing the sidebar can gain a column. Below `1340px` of content width it is two columns; at or above it is three: 转写 / 阶段 + 发言建议 / 共识分歧 ↔ AI 问答 + 产出. 共识分歧 and AI 问答 always share one tab stack; the 产出 row stays under that stack. In three-column mode the middle column is only phase + hints. At `xl`, 10px drag rails replace the fixed gaps: vertical rails adjust column widths, and in two-column mode the horizontal rail adjusts 发言建议 against the tab stack. A rail must track the pointer one-to-one: column widths are ratios of the full grid width, but the hints height is stored in **pixels** inside its own flexible zone (`.live-resizable-zone` = hints / rail / `minmax(0, 1fr)`), because a ratio of the whole column would lag the cursor by the height of the phase and 产出 rows, and `minmax()` px floors would make the rail stick and jump. Arrow keys move a focused rail (Shift for a larger step), and double-click restores that rail. `重置布局` restores every track. Values persist in `localStorage`; the stored height is kept even when a short window has to clamp it, so it returns when there is room again. Below `xl`, rails disappear and panels return to the normal stacked page flow.

思维导图 and 会议总结 are **产出**, not panels: they live as buttons on one `产出` row at the bottom of the analysis column and open the existing full-screen overlay (which carries the view switcher and 重新生成). Never render them as a thumbnail inside a 420px column — a mind map at that size is unreadable.

Live Assist column proportions are user-adjustable rather than fixed. Transcript stays left, stacked `gap-3` under at most one notice: the setup callout is a single row (message + `前往模型设置`), and the runtime strip is suppressed while that callout already states what is missing. The live transcript uses the compact header (one row: `text-base` title, export, count badges — no `Transcript` kicker, no `text-2xl` headline). The right column is a compact phase strip (`shrink-0`), then speaking hints and tabbed analysis sharing the user-selected height with internal scroll; below `xl` the blocks stack at fixed `min-h` so the 15 / 30 / 60 cards stay visible without a nested scroll. Do not stack full briefing cards for phase and hints on the live floor. Live app-bar actions are state-switched: idle shows Session Prep + Start; listening shows Pause/Resume + Stop; Pin/Save appear only when there is transcript.

Compact speaking hints are a one-line header (title + function-type badge + stale badge + timestamp + `生成建议`), a single accent-labelled `现在开口` line, then the three timing cards at `leading-5`. The full-density version (kicker + headline + description + badge row) is for wide standalone use only.

Panels rendered inside a tab stack are **embedded**: the tab label is the panel title, so they drop their own kicker and `text-2xl` headline, pad `1rem` instead of `1.25rem`, and keep only their status badges and action button on the first row. This applies in both modes.

Replay uses the same two-column workbench: a one-line phase strip plus one tabbed analysis stack (共识分歧 / 会议总结 / 思维导图 / 发言建议) that owns the rest of the right column height with internal scroll. At `xl`, the divider between transcript and analysis adjusts their width, the divider below the phase strip adjusts the height shared with the active analysis panel, and the divider below the toolbar adjusts the height shared with the whole workbench. All dividers support pointer drag, arrow-key adjustment, double-click reset, and persist their proportions locally; the toolbar also exposes `重置布局`. Session picker, scrubber, and both export buttons sit on one toolbar row above the grid. The transcript search field lives inline in the transcript header beside the count badges. Below `xl` the two columns stack and the page scrolls normally. Login is a 960px split: hero hidden below that breakpoint.

Rhythm: `gap-4` between workbench stacks (`gap-3` inside the live right column), `gap-2` in the app-bar action row, `0.25rem` inside the tab list.

## Elevation & Depth

Chrome (sidebar, app bar) is flat: fill + 1px hairline, no drop shadow. Implemented panels use `--shadow-sm` (`0 1px 2px rgba(15, 23, 42, 0.06)`). Overlay drawers and popovers already use `--shadow-md` (`0 4px 12px rgba(15, 23, 42, 0.08)`).

**Confirmed direction for new work:** analysis and briefing cards should read as lifted sheets via `--shadow-md` at rest. Do not add blur, glow, or glass. Dark theme only deepens the same two shadows (`0.35` / `0.4` black).

### Shadow Vocabulary
- **Hairline rest** (`box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06)`): default `.panel-card` today; keep for tight chrome-adjacent blocks.
- **Lifted sheet** (`box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08)`): drawers, status popover, and new briefing/analysis cards.
- **Focus ring** (`0 0 0 3px rgba(79, 70, 229, 0.35)`): inputs on focus. Global `:focus-visible` is a 2px outline in the same indigo.

### Named Rules
**The Lifted Sheet Rule.** The work product (transcript, phase, hints, consensus) may lift. The desk itself (sidebar, app bar, page canvas) stays flat.

## Shapes

Small, reliable radii — a desk, not a candy app.

- **Controls** (6px): buttons, text inputs, nav items.
- **Cards / tabs** (8px): metric tiles, tab list, inner wells.
- **Panels** (10px): `.panel-card`, hero toolbar.
- **Pills** (999px): status badges only.

Borders are 1px solid hairline. Empty states are **dashed** hairline on slate canvas. A few large textareas use `rounded-xl` / `rounded-2xl`; treat that as content-field softness, not a new radius token. Do not push the whole system toward full pills except badges.

## Components

### Buttons
Short, 14px medium labels. Shared padding `0.5rem 0.875rem`, 6px radius, 160ms color/border/shadow. No translate on hover in the current CSS; confidence comes from fill contrast.

- **Primary:** indigo fill, white text. Hover: indigo-signal-hover. Disabled: 45% opacity.
- **Secondary:** paper fill, hairline border, secondary ink. Hover: slate-canvas-deep.
- **Ghost:** no border, transparent, secondary ink. Hover: slate canvas fill.
- **Danger:** danger wash + danger ink (not a solid red brick).

### Chips
`.status-badge` is a 12px pill with hairline. Tones: default slate, primary (indigo wash), active (success wash), warning, danger. Use for connection and listening state, not as a tag cloud.

### Cards / Containers
- **Corner:** 10px panels, 8px inner metric cards.
- **Background:** paper or slate-canvas-soft.
- **Border:** 1px `{colors.hairline}`; setup callouts may use `{colors.accent-border}` on indigo wash.
- **Shadow:** see Elevation.
- **Padding:** `{spacing.panel}` typical; drawers `1.25rem`.

### Inputs / Fields
Hairline stroke (`{colors.input-stroke}`), paper fill, 6px radius. Focus: indigo border + 3px indigo ring, no extra outline. Placeholder is muted ink.

### Navigation
220px white sidebar. Product kicker + title in the header. Nav items are 14px medium, 6px radius; active is indigo wash + indigo ink (never a solid indigo bar). Footer shows a 8px status dot (success or warning) plus user identity and ghost logout.

App bar is a 56px white strip: page title left, live transport actions right.

### Tabs
Inset well (slate canvas, 8px, 1px hairline) with 4px inner gap. Active trigger is a paper chip with `--shadow-sm`. Inactive is muted ink, no border.

### Auth split (signature)
At ≥960px, left pane is the only large indigo gradient in the product. Right pane is the same paper desk as the app. Do not copy the hero gradient into Live Assist.

## Do's and Don'ts

### Do:
- **Do** keep transcript on the left and analysis on the right at `xl`.
- **Do** keep the phase read-out as a one-line strip in both modes; give remaining right-column height to the tabbed analysis stack.
- **Do** let the tab label be the panel title: no kicker + headline repeated inside a tab.
- **Do** put "generate then read in full" products (mind map, summary) behind the 产出 row and its overlay, not in a cramped inline preview.
- **Do** measure the container, not the viewport, when a layout can gain space from the collapsing sidebar.
- **Do** say a runtime condition once — a setup callout and a status strip must not repeat the same sentence.
- **Do** use Indigo Signal for at most one primary action in a cluster.
- **Do** lift briefing cards with `--shadow-md`; keep sidebar and app bar flat.
- **Do** mark live/system state with semantic washes and 8px dots, not decorative charts.
- **Do** write UI in Chinese with short English kickers.

### Don't:
- **Don't** build a neon command-center, dark glass panels, or rainbow status bars.
- **Don't** introduce a second accent (magenta, cyan, gold) for “energy.” Magenta button tokens already alias to indigo.
- **Don't** put the login hero gradient on workbench chrome.
- **Don't** add a display serif or a terminal mono as the product voice.
- **Don't** turn every control into a pill; 6–10px is the form language.
