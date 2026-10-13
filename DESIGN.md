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

The product looks like a personal briefing desk, not a shared war room. Light slate paper, a white work surface, and one indigo signal color that marks the next action. Login can feel like a softer SaaS product (split hero, generous type). Once inside, the UI is a workbench: one 56px top bar (no sidebar) and a live floor where speaking hints lead and the transcript sits beside them as reference. The user is in a room, glancing down for one or two seconds at a time; every live-screen decision is judged by what that glance returns.

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
- **Paper** (`{colors.paper}`): app bar, panels, inputs.
- **Slate Canvas** (`{colors.slate-canvas}` / `{colors.slate-canvas-deep}`): page background and inset wells.
- **Hairline** (`{colors.hairline}`): app bar, panel, divider.
- **Ink** (`{colors.ink}` / `{colors.ink-secondary}` / `{colors.ink-muted}` / `{colors.ink-quiet}`): title → body → meta → kicker.

### Named Rules
**The One Signal Rule.** Indigo fill is for the one action that advances the session (Start, Save settings, Ask). Everything else is secondary, ghost, or a semantic wash.

**The Semantic Wash Rule.** Success, warning, and danger use matching wash + ink + border. Never invent a fourth accent family for “visual interest.”

## Typography

**Display Font:** Inter (PingFang SC, Microsoft YaHei, Noto Sans SC, Segoe UI)
**Body Font:** same stack
**Label/Mono Font:** none; labels are Inter at 12px / 11px

**Character:** Neutral product sans. Chinese and English share one rhythm. The login hero's `Meeting Assistant` kicker is the only tracked-uppercase gesture; panels inside the app do not carry English kickers.

### Hierarchy
- **Display** (600, 2.25rem / `text-4xl`): login title 「会议智能助手」 only.
- **Page title** (600, 1.25rem / `text-xl`): 「准备开始会议」, 「模型设置」, history session title (`text-lg`).
- **Glance line** (500, 1.125rem / `text-lg`, `leading-8`): the 「现在开口」 sentence on the live floor. The one place body copy is enlarged, because it is read in a one-second glance.
- **Hint body** (400, 15px, `leading-7`): the 15 / 30 / 60 秒 lines on the live floor.
- **Panel title** (600, 0.875rem / `text-sm`): panel headers such as 发言建议, 转写.
- **Body** (400, 0.875rem / `text-sm`, line-height ~1.625): transcript, settings, buttons.
- **Meta** (400–600, 0.75rem / `text-xs`): timestamps, counts, speaker names in the transcript.

### Named Rules
**The One Voice Type Rule.** Do not add a second display serif or a mono “terminal” face. Kickers may track; body copy never shouts in all caps.

## Layout

App chrome is a single column: one `{spacing.appbar}` top bar, then the main area (padding `1rem`, `1.25rem` from `md`). There is no sidebar; horizontal space belongs to the work. Pages that fill the viewport use `lg:h-full` and scroll internally; prep and settings scroll with the page.

### Live page: three states, one route
The 会议 view is derived from store state, never from a separate flag:
- **会前准备** (`!isStreaming && liveSegments.length === 0`): one centered card (`max-w-3xl`) with readiness (语音转写 / 文本分析 dots + 前往模型设置), the scenario radio chips, topic and role fields, then the data-path sentence and a large 开始会议. There are no per-field 应用 buttons; 开始会议 applies the drafts.
- **会中** (`isStreaming`, including paused): two columns at `lg` (≥1024px). The **copilot column leads** (default 60%): one-line phase strip, then 发言建议 (`flex 3`), then the 共识分歧 / AI 问答 tab stack (`flex 2`). The transcript column is reference (40%). One vertical divider adjusts the split (drag, arrow keys, double-click reset), stored as `copilotRatio` in `live-layout`. Fixed ratios inside the copilot column are deliberate: the hints panel must not change height as content updates, so the user's eye finds it in the same place every glance. Below `lg` the copilot column stacks above the transcript.
- **会后** (`!isStreaming && liveSegments.length > 0`): a 会议已结束 banner (duration, segment count, 已自动保存) carries the post-meeting actions: 生成总结与纪要 (primary, generates both), 思维导图 (opens the full-screen overlay), 在历史会话中查看, 开始新会议. The copilot column becomes tabs 总结与纪要 / 共识分歧 / AI 问答; the transcript stays.

Speaking hints refresh automatically during a meeting (after a phase analysis, only when there is new final speech, at most every 20 s). The header shows 「N 秒前更新」, an 自动更新 toggle (users pay for their own model calls, so it can be turned off), and 刷新. Shortcuts while live: `M` marks the latest segment, `R` refreshes hints; both are ignored while typing.

Only errors and the unstable-speaker warning surface as a runtime strip on the live floor. Routine status messages (「发言建议已刷新」) are not shown; the hints header already states freshness.

### History
Master-detail at `lg`: a 260px session list (search + rows: title, scenario, date, duration) and the detail. The detail header carries title, meta, an 导出 menu (Markdown / JSON) and 删除. Tabs: 总结与纪要 (default when the session has a summary or minutes, otherwise 时间线回放), 时间线回放 (scrubber + transcript + phase strip and hints at that moment, one vertical divider stored as `transcriptRatio` in `replay-layout`), 共识分歧 and 思维导图 (end-of-meeting result). Below `lg` the list sits above the detail with a capped height.

### Shared rules
Panels rendered inside a tab stack are **embedded**: the tab label is the panel title, so they drop their own headline and pad `1rem`.

Rhythm: `gap-3` between stacked live/history blocks, `gap-2` in the top-bar action row, `0.25rem` inside the tab list. Login is a 960px split: hero hidden below that breakpoint.

### CSS layering
Custom element resets live in `@layer base` and component classes (`.btn-*`, `.panel-card`, `.status-badge`, `.tabs-*`, `.theme-*`) in `@layer components` in `shared/ui/index.css`. Tailwind utilities must be able to override them (`btn-secondary text-xs` really is 12px). Never add unlayered class rules; they silently beat every utility.

## Elevation & Depth

Chrome (the top bar) is flat: fill + 1px hairline, no drop shadow. Implemented panels use `--shadow-sm` (`0 1px 2px rgba(15, 23, 42, 0.06)`). Overlay drawers and popovers already use `--shadow-md` (`0 4px 12px rgba(15, 23, 42, 0.08)`).

**Confirmed direction for new work:** analysis and briefing cards should read as lifted sheets via `--shadow-md` at rest. Do not add blur, glow, or glass. Dark theme only deepens the same two shadows (`0.35` / `0.4` black).

### Shadow Vocabulary
- **Hairline rest** (`box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06)`): default `.panel-card` today; keep for tight chrome-adjacent blocks.
- **Lifted sheet** (`box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08)`): drawers, status popover, and new briefing/analysis cards.
- **Focus ring** (`0 0 0 3px rgba(79, 70, 229, 0.35)`): inputs on focus. Global `:focus-visible` is a 2px outline in the same indigo.

### Named Rules
**The Lifted Sheet Rule.** The work product (transcript, phase, hints, consensus) may lift. The desk itself (top bar, page canvas) stays flat.

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
One 56px white top bar. Left: product name, then a segmented control 会议 | 历史会话 (tab-well styling). Center: while a meeting runs, a recording indicator (pulsing red dot, or amber when paused, plus elapsed time and the scenario badge); it stays visible on other views and clicking it returns to the meeting. Right: live controls only while recording (会议背景, 标记, 暂停/继续, 结束会议 as a danger wash), then a status dot that opens the system-status popover, then the avatar menu (模型设置, 退出登录). Settings is reached from the avatar menu, not the main nav.

Popovers and menus close on outside click and Escape. Row-level menus inside scroll containers render `position: fixed` so they are never clipped.

### Tabs
Inset well (slate canvas, 8px, 1px hairline) with 4px inner gap. Active trigger is a paper chip with `--shadow-sm`. Inactive is muted ink, no border.

### Auth split (signature)
At ≥960px, left pane is the only large indigo gradient in the product. Right pane is the same paper desk as the app. Do not copy the hero gradient into Live Assist.

## Do's and Don'ts

### Do:
- **Do** lead the live floor with speaking hints; the transcript is reference, not the headline.
- **Do** keep the phase read-out as a one-line strip in both modes.
- **Do** keep panel positions stable while content updates; a glance must land in the same place.
- **Do** save automatically at meaningful moments (meeting end, after generating summary, minutes or mind map); never make the user remember to click 保存.
- **Do** let the tab label be the panel title: no kicker + headline repeated inside a tab.
- **Do** open mind maps in the full-screen overlay, not a cramped inline preview.
- **Do** say a runtime condition once — a setup callout and a status strip must not repeat the same sentence.
- **Do** use Indigo Signal for at most one primary action in a cluster.
- **Do** lift briefing cards with `--shadow-md`; keep the top bar flat.
- **Do** mark live/system state with semantic washes and 8px dots, not decorative charts.
- **Do** write UI in Chinese; name the vendor data path where live capture starts.

### Don't:
- **Don't** build a neon command-center, dark glass panels, or rainbow status bars.
- **Don't** introduce a second accent (magenta, cyan, gold) for “energy.” Magenta button tokens already alias to indigo.
- **Don't** put the login hero gradient on workbench chrome.
- **Don't** add a display serif or a terminal mono as the product voice.
- **Don't** turn every control into a pill; 6–10px is the form language.
- **Don't** add more drag dividers or a 重置布局 button to fix a layout; fix the default instead. One divider per page, double-click resets it.
- **Don't** nest cards inside tinted cards; separate list items with hairlines and use colored dots for section meaning.
