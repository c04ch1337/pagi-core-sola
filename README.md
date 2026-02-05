# PAGI Core Sola – Personal AGI App

High-level blueprint for a recursive AGI system with tiered memory, self-healing, and bare-metal sovereignty. First app: **pagi-core-sola** for personal AGI (web dev/coding, personal KBs/skills).

**Branding:** The UI reflects PAGI Core Sola (Sola) for the personal AGI use-case; app title and persona strings use "Sola" or "PAGI Core Sola". Customize **User Alias** in Settings (Sola uses it for chat greetings and labels). The default Sola logo lives in `pagi-frontend/src/assets/sola-logo.svg` and is served from `public/sola-logo.svg`; replace with your own via Settings → Custom Logo URL or by replacing the SVG file.

## Architecture

- **pagi-core-orchestrator** (Rust): Service backbone, 7-layer memory manager, watchdog with future SafetyGovernor (Blue Team wrapping on outbound calls).
- **pagi-intelligence-bridge** (Python): MIT RLM (recursive loop), Pydantic-typed data models, local embeddings (Sentence Transformers, 1536-dim cap), OpenRouter via LiteLLM.
- **pagi-proto**: Shared gRPC contracts (memory access, RLM delegation, self-heal signals).
- **pagi-skills**: Evolution registry; Git submodules for atomic rollbacks.

## Constraints

- No Docker; Rust/Cargo and Python 3.10+ on bare metal.
- Recursion depth circuit breaker at 5 levels; delegate to summarized JSON tree (L6) when exceeded.
- L4 semantic memory: Qdrant, local embeddings; cap 1536 dimensions for RAM balance.

## Blueprint Status: Complete

- **Pillars:** Rust backbone (orchestrator, Watchdog, SafetyGovernor, MemoryManager), Python intelligence (RLM, skills, LiteLLM), pagi-proto (gRPC contracts), L5 skills registry, self-evolution (ProposePatch/ApplyPatch, HITL, auto-evolve), verticals (research, codegen, code_review).
- **Gaps closed:** Bridge self-heal wired to orchestrator via gRPC (`PAGI_ALLOW_SELF_HEAL_GRPC`); error → ProposePatch → optional ApplyPatch (when `requires_hitl=false`) with log observability. No schema drift; HITL preserved for required patches.
- **Use as template:** Copy repo (e.g. via `scripts/init-new-app.sh` or clone), override verticals and L5 skills per app; see `TEMPLATE_README.md`.

## Configuration

Copy `.env.example` to `.env` and customize. Load before run: `source .env` (Unix) or set vars manually (Windows), or use `make run` (Makefile runs `load-env` and sources `.env` when present). Ports, depth cap, Qdrant URI, and self-evolution paths are configurable; see `.env.example` for all keys.

### Sovereign / full-access and always-on

To give the AGI **full control and broad access** (file system, OS, applications, network, outbound LLM, always-on), use the **opt-in sovereign profile**. This is intended only for a trusted, isolated machine where you accept the risk of the agent reading/writing files, running code, and calling external APIs.

| Goal | What to set |
|------|-------------|
| **File system** | Set `PAGI_PROJECT_ROOT=/` (Unix) or `PAGI_PROJECT_ROOT=C:\` (Windows). All allow-listed file skills (e.g. `read_entire_file_safe`, `write_file_safe`, `list_dir`, `search_codebase`) then operate under that root. |
| **OS / applications** | Same root allows the agent to see and work with any path under the drive. Running tests and code is already allowed via `run_tests` and `run_python_code_safe` when local or real dispatch is on. |
| **Shares / network** | Mount network shares under `PAGI_PROJECT_ROOT` so they are visible to file skills. Outbound HTTP (LLM, APIs) requires `PAGI_ALLOW_OUTBOUND=true`. |
| **Full internet (LLM)** | Set `PAGI_ALLOW_OUTBOUND=true` and provide `PAGI_OPENROUTER_API_KEY`. The bridge can then call OpenRouter/LiteLLM for real LLM responses. |
| **Unrestricted skill execution** | Set `PAGI_ALLOW_LOCAL_DISPATCH=true` (in-process allow-listed L5 skills). For Rust-mediated execution with timeout, also set `PAGI_ACTIONS_VIA_GRPC=true` and `PAGI_ALLOW_REAL_DISPATCH=true`. |
| **Always on** | Run the stack without `--reload` so the bridge and orchestrator stay up. Use `make run-always-on` (orchestrator + bridge, no reload; bridge bound to `0.0.0.0`), or run the bridge and orchestrator as a system service (e.g. systemd, PM2, Windows Service). |

In `.env.example`, a commented **Sovereign / full-access profile** block lists the suggested vars; uncomment and set them as needed. **Full internet browsing** (automated browser or scraping) is not included by default; add an L5 skill that uses requests/Playwright and gate it behind the same profile if you want the agent to drive a browser or fetch arbitrary URLs.

**Warning:** With full-access enabled, the agent can modify or delete files under `PAGI_PROJECT_ROOT`, run tests/code, and call external APIs. Use only in an environment you control and trust.

## Quick Start

```bash
make build
make test
# Phase 2: L4 semantic requires Qdrant on PAGI_QDRANT_URI (default localhost:6334) — see make qdrant
make run
```

## Frontend Integration

Copy your UI (e.g. from **Google AI Studio**) into `pagi-frontend/components/` (and `pagi-frontend/services/`), then run `make run-frontend` (or `cd pagi-frontend && npm run dev`). Point the frontend at the bridge and orchestrator: **HTTP** via `PAGI_HTTP_PORT` (default 8000) for `/rlm`, `/rlm-multi-turn`, `/health`, and the backend-mediated `/llm-gateway`; **gRPC** via `PAGI_GRPC_ADDR` (default `[::1]:50051`) for memory, actions, and self-heal. Secrets (OpenRouter keys) live only in the backend `.env` (no browser exposure).

**E2E verification:** Run `make verify-frontend-e2e` to start the bridge with `PAGI_ALLOW_LOCAL_DISPATCH=true` and `PAGI_VERTICAL_USE_CASE=personal`, send a sample `POST /rlm-multi-turn` request, and assert the response and log (EXECUTING/ACTION lines). Requires backend (bridge) running; use Git Bash on Windows for the script.

### Personal KB Integration

In the **System Registry** view, use the **Personal KB Integration** block to upload text and run semantic search. **UI tabs for features:** switch between **Personal**, **Health**, **Finance**, **Social**, and **Email** KBs; each tab uses the corresponding `kb_name` (`kb_personal`, `kb_health`, `kb_finance`, `kb_social`, `kb_email`) for upload and search. POST to bridge `/api/memory` with `kb_name` and `content`; GET `/api/search` with `query` and `kb_name`. Results are shown as hits with score and content. The backend proxies these to Rust gRPC **UpsertVectors** and **SemanticSearch** (L4 semantic memory). Routes are gated by `PAGI_ALLOW_LOCAL_DISPATCH=true` or `PAGI_VERTICAL_USE_CASE=personal`; the orchestrator must be running with L4/Qdrant for real persistence.

**Health KB:** Dedicated endpoints for kb_health: POST `/api/health/track` with body `{ "metrics": { "weight": 70, "steps": 5000 } }` to log metrics; GET `/api/health/trends?query=steps&period_days=30` to retrieve trends. **Health Tab UI:** In System Registry, the Health tab provides a metrics input (weight, steps) and a "Track" button that calls `healthTrack`; trends from `healthTrends` are shown in the search results. Same gating as above. Enable **Personal Health Tracking** in Settings (feature flag) to pass `feature_flags.health` to `/rlm-multi-turn` for health-aware RLM.

**Finance KB:** Dedicated endpoints for kb_finance: POST `/api/finance/track` with body `{ "transactions": [ { "amount": -50, "category": "food" } ] }` to log transactions; GET `/api/finance/summary?query=budget&period_days=30` to retrieve balance/trends summary. **Finance Tab UI:** In System Registry, the Finance tab provides transaction input (amount, category, date) and a "Track" button that calls `financeTrack`; balance summary from `financeSummary` is shown in the search results. Same gating as above. Enable **Personal Finance Tracking** in Settings (feature flag) to pass `feature_flags.finance` to `/rlm-multi-turn` for finance-aware RLM.

### Validate Proto (Python)

From `pagi-intelligence-bridge` with Poetry installed:

```bash
poetry install
poetry run python scripts/peek_proto.py
```

This compiles `pagi.proto` to Python stubs under `src/pagi_pb/` and prints generated message names.

## Testing Self-Healing

- Run the bridge: `make run-python` (ensure `PAGI_SELF_HEAL_LOG` is set in `.env`, e.g. to `agent_actions.log`).
- Test Python heal flow: `make test-self-heal`
  - Asserts log entry in `PAGI_SELF_HEAL_LOG` (default `agent_actions.log`).
  - Optional grpcurl: Simulates ProposePatch; install via `cargo install grpcurl` or brew/apt.
- Expected: Curl triggers error → `_report_self_heal` appends to log → grep succeeds; gRPC returns stub PatchResponse if orchestrator is running.
- When **PAGI_ALLOW_SELF_HEAL_GRPC=true**, bridge errors trigger ProposePatch/ApplyPatch via gRPC (optional auto-apply when `requires_hitl=false`).
- **Verify wiring:** `make verify-self-heal-grpc`

- Test Rust heal: `make test-rust-heal`
  - Requires orchestrator running (`make run` or run core-orchestrator separately). Triggers `SimulateError` → propose → poll for `PAGI_APPROVE_FLAG` (up to `PAGI_HITL_POLL_SECS`) → apply when flag present or after timeout (HITL denial); orchestrator appends "Heal cycle simulated" to `PAGI_SELF_HEAL_LOG`.
  - Asserts that log entry; use Git Bash on Windows for grep/sleep. To test apply with HITL: create `approve.patch` (or `PAGI_APPROVE_FLAG`) in the core dir before the poll window ends.
  - **On Windows:** run `cargo test -- --test-threads=1` (and set `PAGI_SKIP_APPLY_TEST=true` if needed) to avoid LNK1104/exe lock; some apply_patch tests are gated off on Windows via `#[cfg(not(target_os = "windows"))]`.
- Force test-failure path: `make test-fail-sim` (or `PAGI_FORCE_TEST_FAIL=true make test-rust-heal`)
  - With `PAGI_FORCE_TEST_FAIL=true`, `apply_patch` skips real tests and returns an internal error; `SimulateError` passes HITL so this path is exercised, still logs and returns Ok for assertion.

## Verifying L5 chaining (peek → execute → save)

With local dispatch enabled, the RLM can chain allow-listed skills via `execute_skill`. Run the steps below to observe the full Think → Act → Observe loop without Rust. **Request `mock_mode=false` overrides `PAGI_MOCK_MODE` env** — see `test_rlm_request_mock_mode_override_env` in `pagi-intelligence-bridge/tests/test_rlm.py`.

### Disable Mock Mode

To use the real LLM path globally and per request:

- **Globally:** In `pagi-intelligence-bridge/.env` set `PAGI_MOCK_MODE=false` (or remove/comment the line; default is false). Ensure `PAGI_ALLOW_OUTBOUND=true` and `PAGI_OPENROUTER_API_KEY=sk-or-v1-your-key` for real calls.
- **Per request:** Send `mock_mode: false` in the JSON body of `POST /rlm` (and `/rlm-multi-turn`); this overrides `PAGI_MOCK_MODE` for that request.
- **Confirm real LLM:** After restarting the bridge (`poetry run uvicorn src.main:app --port 8000`), check startup logs for `Effective PAGI_MOCK_MODE`, `Effective PAGI_ALLOW_OUTBOUND`, and `LLM key present: yes`. If mock is active, the bridge prints `Mock mode active – returning generic response`. Test with:  
  `curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" -d "{\"query\":\"what is your name\",\"mock_mode\":false}"`  
  You should get a non-generic reply (no "MockMode thought" in the summary).

**1. Start the bridge**

```bash
cd pagi-intelligence-bridge
poetry run uvicorn src.main:app --reload --port 8000
```

Verify env is loaded: `curl http://127.0.0.1:8000/health/env` — you should see `PAGI_ALLOW_LOCAL_DISPATCH`, `PAGI_MOCK_MODE`, etc. If vars are missing, put them in a `.env` in `pagi-intelligence-bridge/` or set them in the same shell before starting uvicorn.

**2. Set environment in the bridge process** (same terminal as step 1, or in `.env` if your runner loads it). The server must see these; setting them only in the terminal where you run `curl` is not enough.

```bash
export PAGI_ALLOW_LOCAL_DISPATCH=true
export PAGI_MOCK_MODE=true
export PAGI_ACTIONS_VIA_GRPC=false
export PAGI_AGENT_ACTIONS_LOG=agent_actions.log
```

- **Reproducible chain without an LLM:** set `PAGI_MOCK_MODE=false` and set `PAGI_RLM_STUB_JSON` to a JSON object with `thought`, `action` (e.g. `execute_skill` with `peek_file` in params), and `is_final`. The bridge will then run the think/act/observe path and log EXECUTING + observations.
- **With a real model:** keep `PAGI_MOCK_MODE=false` and, if the model doesn't chain naturally, use `PAGI_RLM_STUB_JSON` as above to force a structured step.

**3. Trigger the chain** (from another terminal; bridge on port 8000)

Basic chain (peek → execute_skill → save):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "First peek the beginning of README.md, then use execute_skill to save a new file called test_chained.py that prints the peeked content",
    "context": "",
    "depth": 0
  }'
```

Discovery chain (list_dir → peek → save); use with a real model or a stub that calls `list_dir` then follows up:

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "List files in current directory, peek the first README.md you find, then save a new file called discovered.py that prints a summary of what you saw",
    "context": "",
    "depth": 0
  }'
```

Expected discovery chain: `list_dir` → `peek_file` (on discovered path) → `save_skill` (discovered.py). To drive the first step with a stub (no LLM), set `PAGI_RLM_STUB_JSON` in the **same shell** as the bridge to a JSON with `"skill_name":"list_dir"` and `"params":{"path":".","pattern":"*.md","max_items":5}`; run uvicorn **without** `--reload` so the process inherits env, or use `make verify-l5-chain` (Unix) which passes stub env inline. The full chain in one shot (list_dir → peek → save) requires a real model or multiple requests with context from the previous step.

Full-file read with size cap (`read_entire_file_safe`):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Read the entire content of pagi.proto and summarize it",
    "context": "",
    "depth": 0
  }'
```

Use a stub with `"skill_name":"read_entire_file_safe"` and `"params":{"path":"pagi-proto/pagi.proto","max_size_bytes":1048576}` (or set path relative to bridge cwd). Observation will contain the file content (capped); summary is the thought unless the loop is extended to include it.

Read entire file and save summary (e.g. `read_entire_file_safe` then `save_skill`):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Read the entire pagi.proto file and save a summary as proto_summary.py",
    "context": "",
    "depth": 0
  }'
```

With a real model or a stub that chains `read_entire_file_safe` (path `pagi-proto/pagi.proto`) and `save_skill` (filename `proto_summary.py`), the observation from the read is used as context for the save step.

Chain list_dir → read_entire_file_safe → write_file_safe (list md files, read first fully, write to backup):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "List md files, read the first one fully, write its content to a backup file",
    "context": "",
    "depth": 0
  }'
```

With a real model or stubs that chain `list_dir` (e.g. `pattern":"*.md"`), then `read_entire_file_safe` on the chosen path, then `write_file_safe` (path e.g. `backup/README_backup.md`, content from observation, `overwrite: true` if needed), the loop performs discovery → full read → safe write. Ensure `PAGI_PROJECT_ROOT` includes the directory you write into.

Recursive discovery with `list_files_recursive` (e.g. list `.py` in skills dir, read first fully, write summary to `skills_summary.py`):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Recursively list py files in the skills directory, read the first one fully, then write a short summary to skills_summary.py",
    "context": "",
    "depth": 0
  }'
```

Use a stub or real model that chains `list_files_recursive` (e.g. `path": "src/skills"`, `pattern": "*.py"`, `max_depth": 2`, `max_items`: 50), then `read_entire_file_safe` on the first path from the listing, then `write_file_safe` for `skills_summary.py`.

Search codebase for patterns (`search_codebase`; e.g. keyword "panic" or regex):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Search codebase for panic keywords in the project",
    "context": "",
    "depth": 0
  }'
```

Use a stub with `"skill_name":"search_codebase"` and `"params":{"path":".","pattern":"panic","max_files":50,"mode":"keyword"}` to get file:line matches (or use `"mode":"regex"` for regex search).

Run tests in sandbox (`run_tests`; Python pytest or Rust cargo test):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Run Python tests in the bridge directory",
    "context": "",
    "depth": 0
  }'
```

Use a stub with `"skill_name":"run_tests"` and `"params":{"dir":"pagi-intelligence-bridge","type":"python","timeout_sec":30}` (or `"type":"rust"` and `"dir":"pagi-core-orchestrator"` for Rust tests).

Run a Python code snippet in sandbox (`run_python_code_safe`; restricted globals, timeout, captured stdout):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Run this Python code snippet",
    "context": "code: print(2 + 2)",
    "depth": 0
  }'
```

Use a stub with `"skill_name":"run_python_code_safe"` and `"params":{"code":"print(2 + 2)","timeout_sec":5,"max_output_len":4096}` to get the snippet output (e.g. `4`) or a prefixed error.

Personal vertical L5 skills (stubs; use with `PAGI_VERTICAL_USE_CASE=personal` and `PAGI_ALLOW_LOCAL_DISPATCH=true`):

- **track_health** – stub save health metrics to kb_health:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Track my health metrics","context":"","depth":0}'
# Stub: PAGI_RLM_STUB_JSON with "skill_name":"track_health","params":{"metrics":{"weight":70,"steps":5000},"kb_name":"kb_health"},"is_final":true
```

- **manage_finance** – stub budgeting to kb_finance:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Update my budget","context":"","depth":0}'
# Stub: "skill_name":"manage_finance","params":{"data":{"budget":2000,"spent":1200},"kb_name":"kb_finance"},"is_final":true
```

- **post_social** – stub post to kb_social (no real API):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Post to social","context":"","depth":0}'
# Stub: "skill_name":"post_social","params":{"content":"Hello","platform":"stub","kb_name":"kb_social"},"is_final":true
```

- **manage_email** – stub read/send to kb_email (no real API):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Check email","context":"","depth":0}'
# Stub: "skill_name":"manage_email","params":{"action":"read","content":"","kb_name":"kb_email"},"is_final":true
```

Analyze code snippet for errors (RCA primitive with `analyze_code`):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Analyze this code snippet for errors and propose fix",
    "context": "code: fn main() { panic!(\"oops\"); }",
    "depth": 0
  }'
```

Use a stub with `"skill_name":"analyze_code"` and `"params":{"code":"fn main() { panic!(\"oops\"); }","language":"rust","max_length":4096}` to get an RCA summary (e.g. panic! detected).

**4. What to look for**

- **Terminal:** THOUGHT → EXECUTING `execute_skill` (or `list_dir`) → EXECUTING `peek_file` → observation from peek → observation from save → final summary.
- **agent_actions.log:** ACTION lines with `reasoning_id` and observations.
- **Response body:** `RLMSummary` with `converged=true` and a synthesis that includes the chain result.

Once you see chained observations logged and returned, the local L5 chaining loop is verified. **Automated run:** from the project root, `make verify-l5-chain` (requires poetry, curl; optional jq) starts the bridge with stub env, triggers the chain, and greps `agent_actions.log` for EXECUTING/THOUGHT/OBSERVATION. If env is not visible to the bridge (e.g. reloader child on some setups), use `make verify-l5-chain-no-reload` instead — it runs uvicorn without `--reload` so the single process inherits env and the list_dir stub runs. Next options: add more primitive skills or wire real Rust-mediated dispatch (sandbox, timeout, allow-list from registry).

**UI Verification:** Run the frontend (`make run-frontend` or `cd pagi-frontend && npm run dev`), set Settings → Bridge URL to the bridge (e.g. `http://127.0.0.1:8000` if the bridge runs on `PAGI_HTTP_PORT=8000`). Send a multi-turn query in ChatView; the response shows each RLM turn (THOUGHT/ACTION/OBSERVATION) as chat bubbles, with "Continuing..." when the last turn has `converged=false`. Check the browser network tab for `POST …/rlm-multi-turn` and the bridge terminal for THOUGHT/EXECUTING lines.

### Multi-turn RLM session

Use the previous response’s `context` (or summary) as the next request’s `context` to chain reasoning across turns. Example: query1 → `list_dir`, query2 → `read_entire_file_safe` on the first path from context, query3 → `write_file_safe` with a summary. From the project root, `make verify-multi-turn` runs a 3-step chain (list_dir → read_entire_file_safe → write_file_safe) and asserts `converged=true` and three ACTION/EXECUTING lines in the log.

**Single-call multi-turn endpoint** (`POST /rlm-multi-turn`): run a context-chained session in one request. The bridge calls `recursive_loop` repeatedly, injecting each summary into the next turn's context until `converged` or `max_turns` is reached. Response is a list of `RLMSummary` dicts. Example for self-patch workflow (analyze → propose → test → apply, up to 4 turns):

```bash
curl -X POST http://127.0.0.1:8000/rlm-multi-turn \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Analyze error, propose fix, test, apply",
    "context": "error_trace: panic at main.rs:42",
    "depth": 0,
    "max_turns": 4
  }'
```

Context is capped by `PAGI_MULTI_TURN_CONTEXT_MAX_CHARS` (default 10000) to avoid unbounded growth.

### Complete local loop

The system supports **discovery → read → write** chaining locally (Python allow-list) or via Rust-mediated dispatch (allow-list, timeout, no shell, logging). L5 registry includes `list_dir`, `list_files_recursive`, `read_entire_file_safe`, `write_file_safe`, `peek_file`, `save_skill`, `execute_skill`. No schema changes required for multi-turn; optional `PAGI_MULTI_TURN_CONTEXT_MAX_TOKENS` caps accumulated context.

### Vertical use-case: self-patch codegen

With `PAGI_VERTICAL_USE_CASE=research`, the RLM prioritizes self-patch for errors: RCA → propose code → save to L5. Use with local or gRPC dispatch so `write_file_safe` can persist proposed fixes. When **PAGI_AUTO_EVOLVE_SKILLS=true**, a successful Python patch apply (in the Watchdog) triggers auto-evolve of a new L5 skill from the patch content: the orchestrator calls `evolve_skill_from_patch`, then commits the new skill in the bridge repo with message "Auto-evolved skill from self-patch". Example (bridge running with `PAGI_ALLOW_LOCAL_DISPATCH=true` and `PAGI_VERTICAL_USE_CASE=research`):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Analyze error_trace, propose Rust fix, save to patch.rs",
    "context": "error_trace: panic at main.rs:42",
    "depth": 0
  }'
```

With a real model or a stub that returns a thought containing the proposed fix and `is_final: true`, the vertical hook can write the fix to `PAGI_SELF_PATCH_DIR`/patch_rs.txt (default `patches/` under `PAGI_PROJECT_ROOT`). HITL remains required for Rust core patches: the orchestrator polls for `PAGI_APPROVE_FLAG` (e.g. `approve.patch`) in the core dir for up to `PAGI_HITL_POLL_SECS` after propose (SimulateError or real heal), then apply when the file is present. When `PAGI_AUTO_COMMIT_SELF_PATCH=true`, successful apply auto-commits the patch file to the registry Git (evolution traceability). When `PAGI_AUTO_EVOLVE_SKILLS=true`, a successful `python_skill` apply (and auto-commit) triggers auto-evolution: the orchestrator calls the bridge skill `evolve_skill_from_patch` with the patch content, then parses the returned `EVOLVED_PATH`, adds and commits that file in the bridge Git repo with commit message "Auto-evolved skill from self-patch".

### Vertical: AI codegen

With `PAGI_VERTICAL_USE_CASE=codegen`, the RLM biases toward generating code (snippets, tests, refactors). On convergence (`is_final: true`), the bridge forces a `write_file_safe` to `PAGI_CODEGEN_OUTPUT_DIR`/`<timestamp>.py` (default `codegen_output/` under `PAGI_PROJECT_ROOT`) with the thought content as generated code. Requires `PAGI_ALLOW_LOCAL_DISPATCH=true` or gRPC dispatch. Example (bridge with codegen vertical and local dispatch):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Generate a test for the analyze_code skill",
    "context": "",
    "depth": 0
  }'
```

Use a real model or `PAGI_RLM_STUB_JSON` with `is_final: true` and a `thought` containing code; the response summary will include "Codegen write" and the path under `codegen_output/`.

### Vertical: Personal AGI

With `PAGI_VERTICAL_USE_CASE=personal`, the RLM prioritizes web dev/coding, personal KB use, and code generation/run/save. Sub-features use dedicated KBs: **health** (`PAGI_PERSONAL_HEALTH_KB=kb_health`), **finance** (`PAGI_PERSONAL_FINANCE_KB=kb_finance`), **social** (`PAGI_PERSONAL_SOCIAL_KB=kb_social`), **email** (`PAGI_PERSONAL_EMAIL_KB=kb_email`). Use KB names in upload/search (e.g. `kb_name` in `/api/memory` and `/api/search`). On convergence (`is_final: true`), the bridge forces a chain: **search_codebase** → **analyze_code** → **run_tests** → **write_file_safe** to `codegen_output/personal_<timestamp>.py`. Requires `PAGI_ALLOW_LOCAL_DISPATCH=true` or gRPC dispatch.

Examples (bridge with personal vertical and local dispatch):

```bash
# Web dev / general
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{"query": "Generate a web dev script and test it", "context": "", "depth": 0}'

# Health KB: upload then search (use kb_name=kb_health)
curl -X POST http://127.0.0.1:8000/api/memory -H "Content-Type: application/json" \
  -d '{"kb_name": "kb_health", "content": "Weight 70kg, steps 5000 today"}'
curl "http://127.0.0.1:8000/api/search?query=steps%20today&kb_name=kb_health"

# Finance KB
curl -X POST http://127.0.0.1:8000/api/memory -H "Content-Type: application/json" \
  -d '{"kb_name": "kb_finance", "content": "Monthly budget 2000, spent 1200"}'
curl "http://127.0.0.1:8000/api/search?query=budget&kb_name=kb_finance"

# Social KB (stub)
curl -X POST http://127.0.0.1:8000/api/memory -H "Content-Type: application/json" \
  -d '{"kb_name": "kb_social", "content": "Posted: Hello world"}'
curl "http://127.0.0.1:8000/api/search?query=posts&kb_name=kb_social"
```

**Social Features** (L5 skills gated by personal vertical and `PAGI_ALLOW_LOCAL_DISPATCH=true`):

- **track_social_activity** – log social activity to kb_social (gRPC UpsertVectors when orchestrator is up):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Log a post on Twitter","context":"","depth":0}'
# Stub: "skill_name":"track_social_activity","params":{"platform":"Twitter","action":"post","content_summary":"Hello world","kb_name":"kb_social"},"is_final":true
# Or use dedicated route: POST /api/social/track with body {"platform":"Twitter","action":"post","content_summary":"Hello world"}
```

- **query_social_trends** – query social activity patterns from kb_social:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"What are my social trends","context":"","depth":0}'
# Stub: "skill_name":"query_social_trends","params":{"period_days":30,"kb_name":"kb_social"},"is_final":true
# Or: GET /api/social/trends?period_days=30
```

- **social_sentiment** – stub sentiment analysis (keyword-based positive/negative/neutral):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Analyze sentiment of this post","context":"","depth":0}'
# Stub: "skill_name":"social_sentiment","params":{"content":"I love this product","kb_name":"kb_social"},"is_final":true
# Or: POST /api/social/sentiment with body {"content":"I love this product"}
```

# Email KB (stub)
```bash
curl -X POST http://127.0.0.1:8000/api/memory -H "Content-Type: application/json" \
  -d '{"kb_name": "kb_email", "content": "Inbox summary: 3 unread"}'
curl "http://127.0.0.1:8000/api/search?query=inbox&kb_name=kb_email"
```

**Email Features** (L5 skills gated by personal vertical and `PAGI_ALLOW_LOCAL_DISPATCH=true`):

- **track_email** – log email events (sent/received/draft) to kb_email:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Log a sent email","context":"","depth":0}'
# Stub: "skill_name":"track_email","params":{"action":"sent","subject":"Hello","summary":"Brief","kb_name":"kb_email"},"is_final":true
# Or: POST /api/email/track with body {"action":"sent","subject":"Hello","summary":"Brief"}
```

- **query_email_history** – query email history/patterns from kb_email:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"What is my email history","context":"","depth":0}'
# Stub: "skill_name":"query_email_history","params":{"period_days":30,"kb_name":"kb_email"},"is_final":true
# Or: GET /api/email/history?period_days=30
```

- **email_draft** – generate draft (log-only, no send):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Draft an email to Bob","context":"","depth":0}'
# Stub: "skill_name":"email_draft","params":{"recipient":"Bob","subject":"Re:","body":"Hi","kb_name":"kb_email"},"is_final":true
# Or: POST /api/email/draft with body {"recipient":"Bob","subject":"Re:","body":"Hi"}
```

**Calendar Features** (L5 skill gated by personal vertical and `PAGI_ALLOW_LOCAL_DISPATCH=true`):

- **track_calendar_event** – log calendar events to kb_calendar (recurring, reminders; log-only):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Add a meeting tomorrow at 2pm","context":"","depth":0}'
# Stub: "skill_name":"track_calendar_event","params":{"title":"Meeting","start_time":"2025-02-05T14:00:00","end_time":"2025-02-05T15:00:00","kb_name":"kb_calendar"},"is_final":true
# Or: POST /api/calendar/track with body {"title":"Meeting","start_time":"2025-02-05T14:00:00","end_time":"2025-02-05T15:00:00"}
# Recent events: GET /api/search?query=events&kb_name=kb_calendar
```

**Health Features** (L5 skills gated by personal vertical and `PAGI_ALLOW_LOCAL_DISPATCH=true`):

- **track_health_metrics** – log metrics to kb_health (gRPC UpsertVectors when orchestrator is up):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Log my health metrics","context":"","depth":0}'
# Stub: PAGI_RLM_STUB_JSON with "skill_name":"track_health_metrics","params":{"metrics":{"weight":70,"steps":5000},"kb_name":"kb_health"},"is_final":true
```

- **query_health_trends** – semantic search over kb_health:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"What are my health trends","context":"","depth":0}'
# Stub: "skill_name":"query_health_trends","params":{"query":"steps weight","period_days":30,"kb_name":"kb_health"},"is_final":true
```

- **health_reminder** – stub set reminder (log-only):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Remind me to take vitamins daily","context":"","depth":0}'
# Stub: "skill_name":"health_reminder","params":{"type":"vitamins","frequency":"daily","kb_name":"kb_health"},"is_final":true
```

**Finance Features** (L5 skills gated by personal vertical and `PAGI_ALLOW_LOCAL_DISPATCH=true`):

- **track_transactions** – log transactions to kb_finance (gRPC UpsertVectors when orchestrator is up):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Log my transactions","context":"","depth":0}'
# Stub: PAGI_RLM_STUB_JSON with "skill_name":"track_transactions","params":{"transactions":[{"amount":50,"category":"food"}],"kb_name":"kb_finance"},"is_final":true
```

- **get_balance_summary** – query balance/trends from kb_finance:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"What is my balance summary","context":"","depth":0}'
# Stub: "skill_name":"get_balance_summary","params":{"period_days":30,"kb_name":"kb_finance"},"is_final":true
```

- **budget_alert** – stub set budget alert (log-only):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Alert me when food spending exceeds 500","context":"","depth":0}'
# Stub: "skill_name":"budget_alert","params":{"category":"food","limit":500,"kb_name":"kb_finance"},"is_final":true
```

- **track_investment** – log buy/sell to kb_finance (gRPC UpsertVectors when orchestrator is up):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Log a buy of 10 AAPL at 150","context":"","depth":0}'
# Stub: "skill_name":"track_investment","params":{"ticker":"AAPL","action":"buy","quantity":10,"price":150,"kb_name":"kb_finance"},"is_final":true
```

- **get_portfolio_summary** – query portfolio value/performance from kb_finance:
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"What is my portfolio summary for the last 30 days","context":"","depth":0}'
# Stub: "skill_name":"get_portfolio_summary","params":{"period_days":30,"kb_name":"kb_finance"},"is_final":true
```

- **investment_alert** – stub set price/position alert (log-only):
```bash
curl -X POST http://127.0.0.1:8000/rlm -H "Content-Type: application/json" \
  -d '{"query":"Alert me when AAPL goes above 200","context":"","depth":0}'
# Stub: "skill_name":"investment_alert","params":{"ticker":"AAPL","alert_type":"price_above","threshold":200,"kb_name":"kb_finance"},"is_final":true
```

Or use the frontend: set Settings → Vertical to **personal**, then send a code-dev query in ChatView; the multi-turn payload will send `vertical_use_case: "personal"` so the bridge uses the personal chain.

### Vertical: AI Code Review Agent

With `PAGI_VERTICAL_USE_CASE=code_review`, the RLM prioritizes code review: analyze for issues, propose fixes, run tests, save reviewed code. On convergence (`is_final: true`), the bridge forces a chain: **analyze_code** (on code from context or thought) → **run_tests** (Python in `PAGI_PROJECT_ROOT`) → **write_file_safe** to `PAGI_CODE_REVIEW_OUTPUT_DIR`/`reviewed_<timestamp>.py` (default `reviewed/` under `PAGI_PROJECT_ROOT`). Requires `PAGI_ALLOW_LOCAL_DISPATCH=true` or gRPC dispatch. Example (bridge with code_review vertical and local dispatch):

```bash
curl -X POST http://127.0.0.1:8000/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Review this code for issues and propose fixes",
    "context": "code: def add(a, b): return a + b",
    "depth": 0
  }'
```

Use a real model or a stub with `is_final: true` and a `thought` containing the proposed fix; the response summary will include "Code review", run_tests output, and the write_file_safe observation; the reviewed file is written under `reviewed/`.

### Verify Rust dispatch

Rust-mediated L5 execution is gated by `PAGI_ALLOW_REAL_DISPATCH` and uses an allow-list, timeout, and no-shell subprocess. From the project root:

- **Rust tests only:** `make test-rust` (or `cd pagi-core-orchestrator && cargo test`) — runs dispatch tests: mock observation when `PAGI_MOCK_MODE=true` or real disabled, unknown skill returns "Skill not in registry", timeout returns "Execution timed out".
- **Full dispatch verification:** `make verify-rust-dispatch` — starts orchestrator with `PAGI_ALLOW_REAL_DISPATCH=true` and bridge with `PAGI_ACTIONS_VIA_GRPC=true`, triggers `/rlm`, and asserts an ACTION line with `reasoning_id` in `agent_actions.log`. Expect mediated observation and log lines.

## Traceability

Design decisions and setup proposals are logged for L6 recursive memory and future evolutions.
