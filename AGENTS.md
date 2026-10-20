# Project rules

## Product scope
Build a Web SaaS app (Netlify) for AI-assisted meetings — multi-person meetings and one-on-one interviews — with an optional Electron desktop shell.

Meeting scenarios (default: general meeting):
- general
- group-interview (preset: jd-tet)
- one-on-one-interview
- design-review
- brainstorm
- team-sync

Scenario-specific copy lives in `shared/meeting/scenarios/`. Do not hardcode group-interview or interview wording in prompts or UI.

Each scenario declares an `interactionModel`:
- `discussion`: continuous listening with discussion analysis (phase, consensus/disagreement, mind map, speaking hints)
- `qa`: no continuous listening; the user holds a key to capture the interviewer's question, and on release the AI answers it (answer key points). Requires a JD (`topicContextRequired`) before starting

Branch UI and analysis behavior on `interactionModel`, never on a specific scenario id.

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
- speaking hints (60s / 120s)
- mind map
- spoken meeting summary + structured meeting minutes
- timeline replay
- local persistence for sessions
- login gate + model settings before live use
- per-meeting scenario templates
- one-on-one interview Q&A assistance (`qa` interaction model, push-to-talk questions answered with the JD as context)

## Architecture rules
- One repository with independent `apps/desktop` (Electron) and `apps/web` (Netlify) entries
- Shared UI/state in `shared/ui`, meeting domain in `shared/meeting`, server/provider protocols in `shared/analysis`
- Neither application may import the other; shared modules must not import applications
- Inject runtime adapters at each application entry; shared UI must not access Electron IPC directly
- Desktop supports Codex and API analysis; web supports API analysis only
- Keep existing storage keys, session formats, and desktop user-data directory compatible
- Electron + React + TypeScript (desktop optional)
- Vite frontend, Netlify Functions for analysis proxy
- provider adapters for AST and LLM
- OpenAI Responses API for analysis (user-supplied keys)
- Volcengine streaming speech recognition 2.0 WebSocket adapter for transcript (user-supplied credentials)
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
