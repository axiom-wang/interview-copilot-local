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

Live Assist is `xl:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]` with `1rem` gaps. Transcript stays left; phase, hints, and tabbed analysis stay right. Columns want `min-h-[640px]`. Login is a 960px split: hero hidden below that breakpoint.

Rhythm: `gap-4` between workbench stacks, `gap-2` in the app-bar action row, `0.25rem` inside the tab list.

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
