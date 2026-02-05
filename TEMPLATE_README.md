# PAGI Core Template

This repo is a **reusable CORE template** for new AGI apps: Rust orchestrator, Python intelligence bridge, tiered memory, self-healing, and bare-metal sovereignty. Clone and customize for your vertical.

## As First App: pagi-core-sola

The first concrete app built from this template is **pagi-core-sola**, targeting the **personal AGI** vertical: web dev/coding, personal KBs, and L5 skills. Use Settings → Vertical **personal** and the ChatView/SystemRegistry wiring for RLM multi-turn and KB upload/search. See main README for "Vertical: Personal AGI" and "Personal KB Integration". For new apps, replace **PAGI Core Sola** (and "Sola") with your own app name in the frontend (index.html title, metadata.json, docs, and persona strings).

## Template Checklist

Use this checklist when setting up or verifying a new app from this template:

- [ ] Clone repo
- [ ] `poetry install` in bridge (`pagi-intelligence-bridge`)
- [ ] `cargo build` in orchestrator (`pagi-core-orchestrator`)
- [ ] Source `.env` (copy from `.env.example`, set `PAGI_OPENROUTER_API_KEY` and others as needed)
- [ ] `make verify-all` (L4 bootstrap, health probes, Python/Rust self-heal assertions)
- [ ] Customize `PAGI_VERTICAL_USE_CASE` in `.env` (`research`, `codegen`, `code_review`, or extend)
- [ ] Add L5 skills / verticals under `pagi-intelligence-bridge/src/skills/` as needed

## Setup Instructions

1. **Clone the template**
   ```bash
   git clone <this-repo-url> my-app && cd my-app
   ```

2. **Install dependencies**
   - **Rust:** `cd pagi-core-orchestrator && cargo build --release`
   - **Python:** `cd pagi-intelligence-bridge && poetry install`
   - Run **`make template-smoke`** for quick CI verification (poetry install, cargo build, make verify-all).

3. **Configure**
   - Copy `.env.example` to `.env` and set `PAGI_OPENROUTER_API_KEY` (and other keys as needed).

4. **Run**
   ```bash
   make run
   ```
   Or run components separately: `make run-python` (bridge only) or start the orchestrator from `pagi-core-orchestrator` with `cargo run --release`.

## Customization

- **Vertical:** Set `PAGI_VERTICAL_USE_CASE` in `.env` to `research`, `codegen`, `code_review`, or `personal` (or extend with new verticals).
- **L5 skills:** Add Python modules under `pagi-intelligence-bridge/src/skills/` (e.g. `my_skill.py` with `run(params)` and a Pydantic params model); register in the bridge allow-list if using local dispatch.
- **Proto:** Extend `pagi-proto/pagi.proto` and regenerate stubs (Rust via `cargo build`, Python via `poetry run python scripts/peek_proto.py` from the bridge).

## Verification

From repo root (with `.env` loaded):

```bash
make verify-all
```

This runs L4 bootstrap (if Qdrant is available), health probes, and Python/Rust self-heal cycle assertions. For a quick check: `make test` (Rust + Python tests).

## Next Steps

- **Frontend integration:** Point your UI at the bridge HTTP API (`POST /rlm`, `POST /rlm-multi-turn`, `GET /health`) and optionally at the orchestrator gRPC port for direct memory/action calls.
- **New verticals:** Add a new `PAGI_VERTICAL_USE_CASE` value and implement the corresponding synthesis/write path in the RLM loop (see `recursive_loop.py` and existing verticals).
- **Production:** Enable `PAGI_ACTIONS_VIA_GRPC` and `PAGI_ALLOW_REAL_DISPATCH` only in trusted environments; keep HITL and self-heal gates as configured.
