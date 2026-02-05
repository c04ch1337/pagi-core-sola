# PAGI Core Sola: Backend Integration Guide

## 1. Overview
This guide defines the communication protocols between the PAGI Core Sola (Sola) UI and the Intelligence Bridge (Orchestrator). The architecture follows a **Bare Metal AGI** philosophy: low-latency, direct IPC/WebSocket streams, and a tiered memory system.

### Security note: LLM calls are backend-mediated

The UI must not call OpenRouter (or any LLM provider) directly. Route chat completions through the bridge:

- `POST http://127.0.0.1:8000/llm-gateway`
- Key is loaded from backend env: `PAGI_OPENROUTER_API_KEY`
- Outbound is gated by `PAGI_ALLOW_OUTBOUND=true`

## 2. API/IPC for 8 Knowledge Bases
The orchestrator manages 8 distinct vector silos:
- Names: `kb_core`, `kb_skills`, `kb_1`...`kb_6`.
- Protocol: gRPC `SemanticSearch` and `UpsertVectors`.
- Note: KB access goes through the orchestrator; the bridge acts as the client.

## 3. WebSocket Events (`ws://127.0.0.1:8000/ws/agent`)
The agent communicates reasoning sequences via a persistent stream.

| Event Kind | Description | Payload |
|------------|-------------|---------|
| `session_started` | Initialization of reasoning | `{ model_id }` |
| `thought` | Chain-of-thought node | `{ text }` |
| `action_planned` | Skill/Tool call queued | `{ tool_name, args }` |
| `search_issued` | Vector lookup initiated | `{ query, targets }` |
| `converged` | Final deterministic response | `{ text }` |
| `session_ended` | Cleanup and teardown | `{ duration_ms }` |

## 4. Short-term vs Long-term Memory
- **L1/L2**: High-frequency registers (DashMap/Redis).
- **L3-L7**: Cold storage and project-level stubs.
- **L4 (Semantic)**: Qdrant-backed vector storage (1536-dim, cosine).

## 5. Bare Metal First
- For frontend development without the full Rust stack, use `mock_provider.py` (or the TS equivalent `mockBackendService.ts`).
- Optional Docker Compose is provided for the **Qdrant** service only.
