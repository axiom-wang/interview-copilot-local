# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is a meeting participant using a personal live assistant. They are in a live discussion (often with others talking over each other) and need to keep up and speak without losing the thread.

The product is not bound to one industry or to group interviews. Confirmed meeting types in the product: 通用会议 (default), 群面 / 小组面试, 需求与方案评审, 头脑风暴, 团队同步 / 站会.

Not the primary user: a facilitator, interviewer, or dedicated note-taker whose job is to run or archive the meeting for others.

## Product Purpose

会议智能助手 (English UI kicker: Meeting Assistant) helps one person hear the discussion, see where it is, and know what to say next.

Success is: during the meeting, the user can follow the transcript, current phase, consensus/disagreement, and speaking hints well enough to contribute in the moment. Replay, summaries, and minutes exist as follow-on of the same session, not as the primary job.

## Positioning

A personal, bring-your-own-model copilot sitting with one participant during a live conversation. Mechanism: continuous speech-to-text plus structured analysis (phase, consensus, hints, Q&A, mind map) on the user's own AST and LLM credentials. Neighboring products that are team recorders, shared meeting bots, or hosted AI that keep the conversation in the vendor's account cannot truthfully copy this combination of personal live assist + local sessions + user-owned keys.

## Operating Context

Typical flow: log in → configure and test speech (ByteDance AST 2.0) and analysis (OpenAI-compatible Responses API) → choose a meeting scenario and optional topic/role context → start listening → watch Live Assist (transcript, phase, consensus, 15s/30s/60s hints, AI Q&A, mind map) → save locally → Replay the timeline.

Runs as a Netlify-hosted web app; Electron is an optional desktop shell around the same web UI. Browser-only mode is for UI work and Replay demos; full live transcription and local credential use expect Electron when IPC-backed providers are required. Microphone is required for live capture.

## Capabilities and Constraints

Confirmed capabilities:

- Live Assist: realtime transcript, discussion phase detection, consensus and disagreement, speaking hints (15s / 30s / 60s), AI Q&A against recent transcript and context, React Flow mind map, meeting summary and minutes
- Replay: saved session timeline of transcript and analysis snapshots; export JSON, Markdown, or plain text
- Login gate (Netlify Identity in production; mock auth in local development) and per-user model settings with connection tests before live use
- Scenario profiles that retarget analyst role, phase language, hint style, and summary shape

Confirmed constraints:

- User supplies AST and LLM keys; settings live in browser-local storage (not a hosted model product)
- Sessions stay on the device; no cloud session sync, no multi-user realtime collaboration, no billing
- Audio goes to the configured ByteDance service; transcript text used for analysis goes to the configured OpenAI-compatible service. This is a data path, not a marketing claim
- Optional Electron wrapper does not make the product a native-OS design language; UI is designed as a web SaaS

Undecided: none recorded in this init.

## Brand Commitments

Product name in the shipped UI: 会议智能助手. English kicker: Meeting Assistant. Older README title 「会议辅助助手」 is not the live product name.

Voice in product copy is practical and operational (login, settings, live assist, replay), Chinese-first. Do not invent a brand personality beyond this.

## Evidence on Hand

- Runnable UI: login, settings, Live Assist, Replay (`src/pages/`, `src/modes/`)
- Scenario definitions: `src/scenarios/profiles.ts`
- Sample analysis payload: `src/sample/mockAnalysis.json`
- Architecture and out-of-scope list: `AGENTS.md`

Do not fabricate testimonials, customer logos, benchmarks, pricing, or compliance certifications. README still describes an older no-account Electron-only product; treat the live app and `AGENTS.md` as product truth where they conflict.

## Product Principles

1. Serve the person who has to speak next, not a shared room transcript.
2. Live understanding beats after-the-fact documentation; replay and minutes follow the same session.
3. User-owned models and local sessions are the product, not a temporary MVP limitation.
4. Scenario language must match the meeting type without turning the product into a single-industry interview coach.
5. Do not claim privacy or cloud features the architecture does not provide; name the vendor data path when live capture is on.
