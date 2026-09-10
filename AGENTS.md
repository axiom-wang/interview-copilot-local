# Project rules

## Product scope
Build a Web SaaS app (Netlify) for AI-assisted multi-person meetings, with an optional Electron desktop shell.

Meeting scenarios (default: general meeting):
- general
- group-interview
- design-review
- brainstorm
- team-sync

Scenario-specific copy lives in `src/scenarios/`. Do not hardcode group-interview wording in prompts or UI.

Modes:
- Live Assist Mode
- Replay Mode

Also include:
- user auth (Netlify Identity)
- per-user model configuration (BYO keys, browser-local storage)
- settings and connection tests

Do not build:
- billing
- multi-user realtime collaboration
- cloud session sync (sessions stay local unless explicitly added later)

## Core features
- real-time transcript
- discussion phase detection
- consensus and disagreement extraction
- speaking hints (15s / 30s / 60s)
- mind map
- spoken meeting summary + structured meeting minutes
- timeline replay
- local persistence for sessions
- login gate + model settings before live use
- per-meeting scenario templates

## Architecture rules
- Electron + React + TypeScript (desktop optional)
- Vite frontend, Netlify Functions for analysis proxy
- provider adapters for AST and LLM
- OpenAI Responses API for analysis (user-supplied keys)
- ByteDance simultaneous interpretation 2.0 WebSocket adapter for transcript (user-supplied credentials)
- structured JSON outputs for all analysis tasks
- React Flow for mind map rendering
- Zustand for app state

## Coding rules
- Keep modules small and typed
- Prefer clear interfaces
- Add minimal comments only when useful
- Avoid overengineering
- Scaffold mock providers before real providers
- Keep persistence file-based or SQLite-friendly; browser localStorage is acceptable for SaaS MVP
