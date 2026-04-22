# Project rules

## Product scope
Build a local-only Electron desktop app for AI-assisted group interviews.

Modes:
- Live Assist Mode
- Replay Mode

Do not build:
- user auth
- cloud sync
- multi-user collaboration
- deployment infra
- billing
- public SaaS features

## Core features
- real-time transcript
- discussion phase detection
- consensus and disagreement extraction
- speaking hints (15s / 30s / 60s)
- mind map
- timeline replay
- local persistence only

## Architecture rules
- Electron + React + TypeScript
- Vite frontend
- provider adapters for AST and LLM
- OpenAI Responses API for analysis
- ByteDance simultaneous interpretation 2.0 WebSocket adapter for transcript
- structured JSON outputs for all analysis tasks
- React Flow for mind map rendering
- Zustand for app state

## Coding rules
- Keep modules small and typed
- Prefer clear interfaces
- Add minimal comments only when useful
- Avoid overengineering
- Scaffold mock providers before real providers
- Keep persistence file-based or SQLite-friendly
