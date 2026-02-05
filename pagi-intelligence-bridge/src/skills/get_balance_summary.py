"""L5 Skill: get_balance_summary – Query current balance/trends from kb_finance.

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls SemanticSearch via gRPC
when available; otherwise returns stub summary. No real external APIs.
"""

from __future__ import annotations

from pydantic import BaseModel


class GetBalanceSummaryParams(BaseModel):
    period_days: int = 30
    kb_name: str = "kb_finance"


def run(params: GetBalanceSummaryParams) -> str:
    """Run semantic search on kb_finance for balance/trends, summarize."""
    query = f"balance summary transactions last {params.period_days} days"
    try:
        try:
            from src.main import _embed_content, _get_kb_stub
            from src.pagi_pb import pagi_pb2
        except ImportError:
            from pagi_intelligence_bridge.main import _embed_content, _get_kb_stub
            from pagi_intelligence_bridge.pagi_pb import pagi_pb2

        vector = _embed_content(query)
        req = pagi_pb2.SearchRequest(
            query=query,
            kb_name=params.kb_name,
            limit=20,
            query_vector=vector,
        )
        stub = _get_kb_stub()
        resp = stub.SemanticSearch(req, timeout=10.0)
        hits = list(resp.hits) if resp.hits else []
        if not hits:
            return "[get_balance_summary] Current balance: (no data in kb_finance)"
        parts = [f"[get_balance_summary] Current balance: {len(hits)} relevant entries."]
        for i, h in enumerate(hits[:3], 1):
            snippet = (h.content_snippet or "")[:150]
            parts.append(f"  {i}. {snippet}")
        if len(hits) > 3:
            parts.append(f"  ... and {len(hits) - 3} more")
        return "\n".join(parts)
    except Exception:
        return "[get_balance_summary] Current balance: (search unavailable; stub)"
