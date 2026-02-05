"""L5 Skill: query_health_trends – Query trends from kb_health.

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls SemanticSearch via gRPC
when available; otherwise returns stub summary. No real external APIs.
"""

from __future__ import annotations

from pydantic import BaseModel


class QueryHealthTrendsParams(BaseModel):
    query: str
    period_days: int = 30
    kb_name: str = "kb_health"


def run(params: QueryHealthTrendsParams) -> str:
    """Run semantic search on kb_health, summarize hits as trends."""
    if not (params.query or "").strip():
        return "[query_health_trends] Trends: (no query)"
    try:
        try:
            from src.main import _embed_content, _get_kb_stub
            from src.pagi_pb import pagi_pb2
        except ImportError:
            from pagi_intelligence_bridge.main import _embed_content, _get_kb_stub
            from pagi_intelligence_bridge.pagi_pb import pagi_pb2

        vector = _embed_content(params.query.strip())
        req = pagi_pb2.SearchRequest(
            query=params.query.strip(),
            kb_name=params.kb_name,
            limit=20,
            query_vector=vector,
        )
        stub = _get_kb_stub()
        resp = stub.SemanticSearch(req, timeout=10.0)
        hits = list(resp.hits) if resp.hits else []
        if not hits:
            return "[query_health_trends] Trends: no hits (empty or no match)."
        parts = [f"[query_health_trends] Trends ({len(hits)} hits):"]
        for i, h in enumerate(hits[:5], 1):
            snippet = (h.content_snippet or "")[:200]
            parts.append(f"  {i}. score={getattr(h, 'score', 0):.2f} {snippet}")
        if len(hits) > 5:
            parts.append(f"  ... and {len(hits) - 5} more")
        return "\n".join(parts)
    except Exception:
        return "[query_health_trends] Trends: (search unavailable; stub)"
