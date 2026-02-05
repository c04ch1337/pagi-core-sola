"""L5 Skill: get_portfolio_summary – Query current portfolio value and performance from kb_finance.

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls SemanticSearch via gRPC
when available; otherwise returns stub or prefixed error. No real external APIs.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class GetPortfolioSummaryParams(BaseModel):
    tickers: Optional[list[str]] = None
    period_days: int = 30
    kb_name: str = "kb_finance"


def run(params: GetPortfolioSummaryParams) -> str:
    """Call SemanticSearch via gRPC with query like portfolio performance {period_days}d, aggregate hits, return summary."""
    query = f"portfolio performance {params.period_days}d"
    if params.tickers:
        query = f"{query} tickers {', '.join(params.tickers)}"
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
            return "[get_portfolio_summary] Current value: (no data in kb_finance); gain/loss %: N/A; top holdings: none"
        parts = [f"[get_portfolio_summary] Current value: {len(hits)} relevant entries."]
        for i, h in enumerate(hits[:5], 1):
            snippet = (h.content_snippet or "")[:150]
            parts.append(f"  {i}. {snippet}")
        if len(hits) > 5:
            parts.append(f"  ... and {len(hits) - 5} more")
        return "\n".join(parts)
    except Exception as e:
        return f"[get_portfolio_summary] (search unavailable): {e!s}"
