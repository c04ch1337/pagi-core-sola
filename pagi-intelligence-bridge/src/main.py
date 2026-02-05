"""FastAPI entrypoint for pagi-intelligence-bridge (sidecar to Rust orchestrator)."""

import os
import traceback
import uuid
from collections.abc import Iterator
from typing import Any, Literal
import json

import grpc

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

load_dotenv()  # Load .env from cwd if present (reproducible L5 verification)

# Startup debug: confirm effective env for real vs mock LLM path
print(f"Effective PAGI_MOCK_MODE: {os.getenv('PAGI_MOCK_MODE')}")
print(f"Effective PAGI_ALLOW_OUTBOUND: {os.getenv('PAGI_ALLOW_OUTBOUND')}")
print(f"LLM key present: {'yes' if os.getenv('PAGI_OPENROUTER_API_KEY') else 'no'}")

from .recursive_loop import (
    MAX_RECURSION_DEPTH,
    RLMQuery,
    RLMSummary,
    _report_self_heal,
    recursive_loop,
)


def _env_truthy(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


def _allow_kb_routes() -> bool:
    """Gate L4 KB routes: allow when local dispatch or vertical is personal."""
    allow = os.environ.get("PAGI_ALLOW_LOCAL_DISPATCH", "").strip().lower() in ("1", "true", "yes", "y", "on")
    vertical = (os.environ.get("PAGI_VERTICAL_USE_CASE") or "").strip().lower()
    return allow or vertical == "personal"


_embed_model = None


def _get_embed_model():
    """Lazy-load Sentence Transformer for L4 embed (reuse existing dep)."""
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer(os.environ.get("PAGI_EMBED_MODEL", "all-MiniLM-L6-v2"))
    return _embed_model


def _grpc_addr() -> str:
    port = os.environ.get("PAGI_GRPC_PORT", "50051")
    return f"[::1]:{port}"


def _get_grpc_stub():
    """Return gRPC Pagi stub (Rust orchestrator)."""
    from .pagi_pb import pagi_pb2_grpc

    channel = grpc.insecure_channel(_grpc_addr())
    return pagi_pb2_grpc.PagiStub(channel)


def _get_kb_stub():
    """Return gRPC Pagi stub for UpsertVectors / SemanticSearch (Rust MemoryManager)."""
    return _get_grpc_stub()


def _embed_content(text: str) -> list[float]:
    from .embed_and_upsert import _embedding_dim
    model = _get_embed_model()
    vec = model.encode(text).tolist()
    dim = _embedding_dim()
    if len(vec) < dim:
        vec = vec + [0.0] * (dim - len(vec))
    elif len(vec) > dim:
        vec = vec[:dim]
    return vec


class RLMMultiTurnRequest(RLMQuery):
    """RLM query with optional max_turns, per-request vertical, and feature_flags for /rlm-multi-turn."""

    max_turns: int = 5
    vertical_use_case: str | None = None  # e.g. research, codegen, code_review, personal; overrides env for this request
    feature_flags: dict | None = None  # e.g. {"health": True, "finance": True}; passed to RLMQuery for personal vertical


app = FastAPI(title="pagi-intelligence-bridge", version="0.1.0")

# Frontend dev server (Vite) calls into bridge from a different origin.
# Keep permissive defaults for local bare-metal, but allow tightening via env.
_cors_origins = os.environ.get("PAGI_CORS_ORIGINS", "*")
allow_origins = ["*"] if _cors_origins.strip() == "*" else [o.strip() for o in _cors_origins.split(",") if o.strip()]
allow_credentials = allow_origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    # Starlette cannot use wildcard origins with credentials.
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LLMGatewayMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class LLMGatewayRequest(BaseModel):
    """Browser → bridge request. Optional api_key from UI Settings; otherwise bridge uses PAGI_OPENROUTER_API_KEY."""

    model: str | None = None
    temperature: float | None = None
    messages: list[LLMGatewayMessage]
    stream: bool = True
    api_key: str | None = None  # Optional: from UI Settings; when set, overrides env for this request


def _grpc_gate_llm_gateway(model: str) -> None:
    """Policy gate for outbound LLM calls via Rust orchestrator.

    When `PAGI_ACTIONS_VIA_GRPC=true`, the bridge asks the orchestrator to approve
    LLM gateway usage (authority stays in Rust). No provider secrets are sent.
    """

    from .pagi_pb import pagi_pb2

    stub = _get_grpc_stub()
    req = pagi_pb2.ActionRequest(
        skill_name="llm_gateway",
        params={"model": model},
        depth=0,
        reasoning_id=str(uuid.uuid4()),
        mock_mode=True,
        allow_list_hash="",
        timeout_ms=0,
    )
    resp = stub.ExecuteAction(req, timeout=2.0)
    if not resp.success:
        raise HTTPException(status_code=403, detail=resp.error or "LLM gateway denied by orchestrator")


@app.get("/health")
def health() -> dict:
    return {
        "status": "operational",
        "service": "pagi-intelligence-bridge",
        "depth_cap": MAX_RECURSION_DEPTH,
    }


@app.get("/health/env")
def health_env() -> dict:
    """Return current PAGI env state for debugging (L5 verification checklist)."""
    return {
        "PAGI_ALLOW_LOCAL_DISPATCH": os.environ.get("PAGI_ALLOW_LOCAL_DISPATCH"),
        "PAGI_MOCK_MODE": os.environ.get("PAGI_MOCK_MODE"),
        "PAGI_ACTIONS_VIA_GRPC": os.environ.get("PAGI_ACTIONS_VIA_GRPC"),
        "PAGI_AGENT_ACTIONS_LOG": os.environ.get("PAGI_AGENT_ACTIONS_LOG"),
        "PAGI_RLM_STUB_JSON": (
            "(set)" if os.environ.get("PAGI_RLM_STUB_JSON") else None
        ),
        "PAGI_PROJECT_ROOT": os.environ.get("PAGI_PROJECT_ROOT"),
        "PAGI_ALLOW_OUTBOUND": os.environ.get("PAGI_ALLOW_OUTBOUND"),
        "PAGI_ALLOW_REAL_DISPATCH": os.environ.get("PAGI_ALLOW_REAL_DISPATCH"),
        "PAGI_VERTICAL_USE_CASE": os.environ.get("PAGI_VERTICAL_USE_CASE"),
    }


_ALLOWED_UI_CONFIG_KEYS = frozenset({
    "PAGI_PROJECT_ROOT",
    "PAGI_ALLOW_OUTBOUND",
    "PAGI_ALLOW_LOCAL_DISPATCH",
    "PAGI_ACTIONS_VIA_GRPC",
    "PAGI_ALLOW_REAL_DISPATCH",
    "PAGI_VERTICAL_USE_CASE",
})


class ConfigOverridesBody(BaseModel):
    """POST /api/config: optional runtime overrides from UI (gated by PAGI_ALLOW_UI_CONFIG_OVERRIDE)."""
    overrides: dict[str, str | bool]


def _allow_ui_config_override() -> bool:
    return os.environ.get("PAGI_ALLOW_UI_CONFIG_OVERRIDE", "").strip().lower() in ("1", "true", "yes", "y", "on")


@app.post("/api/config")
def api_config(body: ConfigOverridesBody) -> dict:
    """Apply runtime env overrides from UI. Only when PAGI_ALLOW_UI_CONFIG_OVERRIDE=true. Keys restricted to allowed list."""
    if not _allow_ui_config_override():
        raise HTTPException(
            status_code=403,
            detail="UI config overrides disabled. Set PAGI_ALLOW_UI_CONFIG_OVERRIDE=true in the bridge environment.",
        )
    applied = {}
    for k, v in (body.overrides or {}).items():
        if k in _ALLOWED_UI_CONFIG_KEYS:
            val = "true" if v is True else ("false" if v is False else str(v))
            os.environ[k] = val
            applied[k] = val
    return {"success": True, "applied": applied}


@app.post("/debug")
def debug_trigger(data: dict) -> dict:
    """Stub to simulate error → self-heal flow; logs to agent_actions.log when PAGI_SELF_HEAL_LOG set."""
    if data.get("trigger_error"):
        try:
            raise ValueError("Simulated error for self-heal test")
        except ValueError:
            error_trace = traceback.format_exc()
            _report_self_heal(error_trace, "python_skill")
            return {"status": "simulated_error_logged", "message": "Self-heal flow triggered; check agent_actions.log"}
    return {"status": "no error"}


@app.post("/rlm", response_model=RLMSummary)
def handle_rlm(query: RLMQuery) -> RLMSummary:
    """Run one RLM step: peek / delegate / synthesize. Delegation guarded by Rust via gRPC in production."""
    return recursive_loop(query)


@app.post("/rlm-multi-turn")
def handle_rlm_multi_turn(body: RLMMultiTurnRequest) -> list[dict]:
    """Run multi-turn RLM: loop recursive_loop, inject summary as context until converged or max_turns. Returns list of RLMSummary dicts. Optional vertical_use_case and feature_flags override/env for this request."""
    summaries: list[dict] = []
    query = RLMQuery(
        query=body.query,
        context=body.context,
        depth=body.depth,
        feature_flags=body.feature_flags,
        mock_mode=body.mock_mode,
    )
    prev_vertical = os.environ.get("PAGI_VERTICAL_USE_CASE")
    if body.vertical_use_case:
        os.environ["PAGI_VERTICAL_USE_CASE"] = body.vertical_use_case.strip().lower()
    try:
        for _ in range(body.max_turns):
            out = recursive_loop(query)
            summaries.append(out.model_dump())
            if out.converged:
                break
            query = RLMQuery(
                query=body.query,
                context=(query.context + "\n" + out.summary).strip(),
                depth=query.depth,
                feature_flags=body.feature_flags,
                mock_mode=body.mock_mode,
            )
        return summaries
    finally:
        if body.vertical_use_case is not None:
            if prev_vertical is None:
                os.environ.pop("PAGI_VERTICAL_USE_CASE", None)
            else:
                os.environ["PAGI_VERTICAL_USE_CASE"] = prev_vertical


class KBMemoryBody(BaseModel):
    """POST /api/memory: upsert text to L4 KB via Rust gRPC UpsertVectors."""
    kb_name: str = "kb_personal"
    content: str


@app.post("/api/memory")
def api_memory_upsert(body: KBMemoryBody) -> dict:
    """Upsert text to personal KB (L4). Proxies to Rust gRPC UpsertVectors. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        from .pagi_pb import pagi_pb2
        point_id = str(uuid.uuid4())
        vector = _embed_content(body.content)
        point = pagi_pb2.VectorPoint(
            id=point_id,
            vector=vector,
            payload={"content": body.content[:10000]},
        )
        req = pagi_pb2.UpsertRequest(kb_name=body.kb_name, points=[point])
        stub = _get_kb_stub()
        resp = stub.UpsertVectors(req)
        return {"success": resp.success, "id": point_id, "upserted_count": resp.upserted_count}
    except grpc.RpcError as e:
        raise HTTPException(status_code=503, detail=f"gRPC L4 upsert failed: {e.code()} {e.details()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class HealthTrackBody(BaseModel):
    """POST /api/health/track: log metrics to kb_health (L4)."""
    metrics: dict


@app.post("/api/health/track")
def api_health_track(body: HealthTrackBody) -> dict:
    """Log health metrics to kb_health. Proxies to UpsertVectors. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Health KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        from .pagi_pb import pagi_pb2
        point_id = str(uuid.uuid4())
        content = json.dumps(body.metrics)[:10000]
        vector = _embed_content(content)
        point = pagi_pb2.VectorPoint(
            id=point_id,
            vector=vector,
            payload={"content": content},
        )
        req = pagi_pb2.UpsertRequest(kb_name="kb_health", points=[point])
        stub = _get_kb_stub()
        resp = stub.UpsertVectors(req)
        return {"success": resp.success, "id": point_id}
    except grpc.RpcError as e:
        raise HTTPException(status_code=503, detail=f"gRPC L4 health upsert failed: {e.code()} {e.details()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health/trends")
def api_health_trends(
    query: str,
    period_days: int = 30,
) -> dict:
    """Semantic search over kb_health for trends. Proxies to SemanticSearch. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Health KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        from .pagi_pb import pagi_pb2
        vector = _embed_content(query)
        req = pagi_pb2.SearchRequest(
            query=query,
            kb_name="kb_health",
            limit=min(max(20, 1), 100),
            query_vector=vector,
        )
        stub = _get_kb_stub()
        resp = stub.SemanticSearch(req)
        hits = [
            {"content": h.content_snippet, "score": float(h.score), "metadata": {"document_id": h.document_id}}
            for h in resp.hits
        ]
        return {"trends": hits}
    except grpc.RpcError as e:
        raise HTTPException(status_code=503, detail=f"gRPC L4 health search failed: {e.code()} {e.details()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FinanceTrackBody(BaseModel):
    """POST /api/finance/track: log transactions to kb_finance (L4)."""
    transactions: list[dict]


@app.post("/api/finance/track")
def api_finance_track(body: FinanceTrackBody) -> dict:
    """Log financial transactions to kb_finance. Proxies to UpsertVectors. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Finance KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        from .pagi_pb import pagi_pb2
        content = json.dumps(body.transactions)[:10000]
        vector = _embed_content(content)
        point_id = str(uuid.uuid4())
        point = pagi_pb2.VectorPoint(
            id=point_id,
            vector=vector,
            payload={"content": content},
        )
        req = pagi_pb2.UpsertRequest(kb_name="kb_finance", points=[point])
        stub = _get_kb_stub()
        resp = stub.UpsertVectors(req)
        return {"success": resp.success, "upserted_count": resp.upserted_count}
    except grpc.RpcError as e:
        raise HTTPException(status_code=503, detail=f"gRPC L4 finance upsert failed: {e.code()} {e.details()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/finance/summary")
def api_finance_summary(
    query: str,
    period_days: int = 30,
) -> dict:
    """Semantic search over kb_finance for balance/trends summary. Proxies to SemanticSearch. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Finance KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        from .pagi_pb import pagi_pb2
        vector = _embed_content(query)
        req = pagi_pb2.SearchRequest(
            query=query,
            kb_name="kb_finance",
            limit=min(max(20, 1), 100),
            query_vector=vector,
        )
        stub = _get_kb_stub()
        resp = stub.SemanticSearch(req)
        hits = [
            {"content": h.content_snippet, "score": float(h.score), "metadata": {"document_id": h.document_id}}
            for h in resp.hits
        ]
        return {"summary": hits}
    except grpc.RpcError as e:
        raise HTTPException(status_code=503, detail=f"gRPC L4 finance search failed: {e.code()} {e.details()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SocialTrackBody(BaseModel):
    """POST /api/social/track: log social activity via track_social_activity skill."""
    platform: str
    action: str  # post, like, follow
    content_summary: str
    timestamp: str | None = None


def _run_l5_skill(skill_name: str, params: dict) -> str:
    """Load and run an L5 skill by name; return observation string."""
    from pathlib import Path
    import importlib.util
    skill_path = Path(__file__).resolve().parent / "skills" / f"{skill_name}.py"
    if not skill_path.exists():
        raise ValueError(f"Skill not found: {skill_name}")
    spec = importlib.util.spec_from_file_location(skill_name, skill_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Invalid skill module: {skill_name}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    params_cls = getattr(mod, "".join(w.capitalize() for w in skill_name.split("_")) + "Params", None)
    if params_cls is None:
        raise ValueError(f"Params class not found for {skill_name}")
    obj = params_cls.model_validate(params)
    return mod.run(obj)


@app.post("/api/social/track")
def api_social_track(body: SocialTrackBody) -> dict:
    """Log social activity to kb_social via track_social_activity skill. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Social KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        params = {
            "platform": body.platform,
            "action": body.action,
            "content_summary": body.content_summary,
            "kb_name": "kb_social",
        }
        if body.timestamp is not None:
            params["timestamp"] = body.timestamp
        result = _run_l5_skill("track_social_activity", params)
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/social/trends")
def api_social_trends(
    period_days: int = 30,
    platform: str | None = None,
) -> dict:
    """Query social trends via query_social_trends skill. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Social KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        params = {"period_days": period_days, "kb_name": "kb_social"}
        if platform:
            params["platform"] = platform
        result = _run_l5_skill("query_social_trends", params)
        return {"trends": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SocialSentimentBody(BaseModel):
    """POST /api/social/sentiment: analyze sentiment via social_sentiment skill."""
    content: str


@app.post("/api/social/sentiment")
def api_social_sentiment(body: SocialSentimentBody) -> dict:
    """Analyze sentiment of content via social_sentiment skill. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Social KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        result = _run_l5_skill("social_sentiment", {"content": body.content, "kb_name": "kb_social"})
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EmailTrackBody(BaseModel):
    """POST /api/email/track: log email event via track_email skill."""
    action: str  # sent, received, draft
    subject: str
    sender: str | None = None
    recipient: str | None = None
    summary: str
    timestamp: str | None = None


@app.post("/api/email/track")
def api_email_track(body: EmailTrackBody) -> dict:
    """Log email event to kb_email via track_email skill. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Email KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        params = {
            "action": body.action,
            "subject": body.subject,
            "summary": body.summary,
            "kb_name": "kb_email",
        }
        if body.sender is not None:
            params["sender"] = body.sender
        if body.recipient is not None:
            params["recipient"] = body.recipient
        if body.timestamp is not None:
            params["timestamp"] = body.timestamp
        result = _run_l5_skill("track_email", params)
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/email/history")
def api_email_history(
    keyword: str | None = None,
    sender: str | None = None,
    period_days: int = 30,
) -> dict:
    """Query email history via query_email_history skill. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Email KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        params = {"period_days": period_days, "kb_name": "kb_email"}
        if keyword:
            params["keyword"] = keyword
        if sender:
            params["sender"] = sender
        result = _run_l5_skill("query_email_history", params)
        return {"history": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EmailDraftBody(BaseModel):
    """POST /api/email/draft: generate draft via email_draft skill."""
    recipient: str
    subject: str
    body: str


@app.post("/api/email/draft")
def api_email_draft(body: EmailDraftBody) -> dict:
    """Generate email draft via email_draft skill (log-only). Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Email KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        result = _run_l5_skill("email_draft", {
            "recipient": body.recipient,
            "subject": body.subject,
            "body": body.body,
            "kb_name": "kb_email",
        })
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CalendarTrackBody(BaseModel):
    """POST /api/calendar/track: log calendar event via track_calendar_event skill."""
    title: str
    start_time: str
    end_time: str
    description: str | None = None
    location: str | None = None
    recurring: str | None = None  # daily, weekly, none
    reminder_minutes: int | None = None


@app.post("/api/calendar/track")
def api_calendar_track(body: CalendarTrackBody) -> dict:
    """Log calendar event to kb_calendar via track_calendar_event skill. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="Calendar KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        params = {
            "title": body.title,
            "start_time": body.start_time,
            "end_time": body.end_time,
            "kb_name": os.environ.get("PAGI_PERSONAL_CALENDAR_KB", "kb_calendar"),
        }
        if body.description is not None:
            params["description"] = body.description
        if body.location is not None:
            params["location"] = body.location
        if body.recurring is not None:
            params["recurring"] = body.recurring
        if body.reminder_minutes is not None:
            params["reminder_minutes"] = body.reminder_minutes
        result = _run_l5_skill("track_calendar_event", params)
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search")
def api_search(
    query: str,
    kb_name: str = "kb_personal",
    limit: int = 20,
) -> dict:
    """Semantic search over L4 KB. Proxies to Rust gRPC SemanticSearch. Gated by PAGI_ALLOW_LOCAL_DISPATCH or vertical personal."""
    if not _allow_kb_routes():
        raise HTTPException(status_code=403, detail="KB routes disabled. Set PAGI_ALLOW_LOCAL_DISPATCH=true or PAGI_VERTICAL_USE_CASE=personal.")
    try:
        from .pagi_pb import pagi_pb2
        vector = _embed_content(query)
        req = pagi_pb2.SearchRequest(
            query=query,
            kb_name=kb_name,
            limit=min(max(limit, 1), 100),
            query_vector=vector,
        )
        stub = _get_kb_stub()
        resp = stub.SemanticSearch(req)
        hits = [
            {"content": h.content_snippet, "score": float(h.score), "metadata": {"document_id": h.document_id}}
            for h in resp.hits
        ]
        return {"hits": hits}
    except grpc.RpcError as e:
        raise HTTPException(status_code=503, detail=f"gRPC L4 search failed: {e.code()} {e.details()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _chunk_text(delta: Any) -> str:
    """Best-effort extraction of streamed token text across provider/litellm versions."""
    try:
        # OpenAI-style
        return (delta.choices[0].delta.content or "")  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        # dict-style
        return str(delta.get("choices", [{}])[0].get("delta", {}).get("content") or "")
    except Exception:
        return ""


@app.post("/llm-gateway")
def llm_gateway(req: LLMGatewayRequest):
    """Backend-mediated LLM gateway.

    Security:
    - API keys are loaded from backend env (PAGI_OPENROUTER_API_KEY)
    - outbound calls are gated behind PAGI_ALLOW_OUTBOUND=true
    """

    # If the bridge is configured to route actions through Rust, require the orchestrator
    # to approve LLM gateway usage (policy gate).
    if _env_truthy("PAGI_ACTIONS_VIA_GRPC", default=False):
        try:
            _grpc_gate_llm_gateway(
                (req.model or os.environ.get("PAGI_OPENROUTER_MODEL") or "openrouter/auto").strip()
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Orchestrator gate unavailable: {e!s}") from e

    if not _env_truthy("PAGI_ALLOW_OUTBOUND", default=False):
        raise HTTPException(
            status_code=403,
            detail="Outbound LLM calls are disabled. Set PAGI_ALLOW_OUTBOUND=true in the bridge environment.",
        )

    # Use API key from request (UI Settings) when provided, else from bridge env
    api_key = (req.api_key or "").strip() or os.environ.get("PAGI_OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Missing API key. Set it in Settings (API Key) or in bridge .env as PAGI_OPENROUTER_API_KEY.",
        )

    model = (req.model or os.environ.get("PAGI_OPENROUTER_MODEL") or "openrouter/auto").strip()
    temperature = float(req.temperature) if req.temperature is not None else 0.7

    try:
        import litellm  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"litellm is not available: {e!s}") from e

    messages = [m.model_dump() for m in req.messages]

    if not req.stream:
        try:
            resp = litellm.completion(
                model=model,
                messages=messages,
                api_key=api_key,
                temperature=temperature,
            )
            content = ""
            try:
                content = resp.choices[0].message.content or ""
            except Exception:
                content = str(resp)
            return JSONResponse({"content": content})
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LLM completion failed: {e!s}") from e

    def _iter_sse() -> Iterator[str]:
        try:
            stream = litellm.completion(
                model=model,
                messages=messages,
                api_key=api_key,
                temperature=temperature,
                stream=True,
            )

            # Some litellm versions might return a non-iterable response even with stream=True.
            if not hasattr(stream, "__iter__"):
                full = ""
                try:
                    full = stream.choices[0].message.content or ""  # type: ignore[attr-defined]
                except Exception:
                    full = str(stream)
                payload = {"choices": [{"delta": {"content": full}}]}
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            for delta in stream:
                text = _chunk_text(delta)
                if not text:
                    continue
                payload = {"choices": [{"delta": {"content": text}}]}
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            err = {"error": {"message": f"LLM stream failed: {e!s}"}}
            yield f"data: {json.dumps(err, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(_iter_sse(), media_type="text/event-stream")
