"""L5 Skill: query_email_history – Query email history/patterns from kb_email.

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls SemanticSearch via gRPC
when available; otherwise returns stub. No real IMAP.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class QueryEmailHistoryParams(BaseModel):
    keyword: Optional[str] = None
    sender: Optional[str] = None
    period_days: int = 30
    kb_name: str = "kb_email"


def run(params: QueryEmailHistoryParams) -> str:
    """Call SemanticSearch via gRPC with constructed query, summarize hits (e.g. most frequent contacts, topics)."""
    query = f"email history last {params.period_days} days"
    if params.keyword:
        query = f"{query} {params.keyword}"
    if params.sender:
        query = f"{query} from {params.sender}"
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
            return "[query_email_history] History summary: (no data in kb_email)"
        parts = [f"[query_email_history] History summary: {len(hits)} relevant entries."]
        for i, h in enumerate(hits[:5], 1):
            snippet = (h.content_snippet or "")[:120]
            parts.append(f"  {i}. {snippet}")
        if len(hits) > 5:
            parts.append(f"  ... and {len(hits) - 5} more")
        return "\n".join(parts)
    except Exception as e:
        return f"[query_email_history] (search unavailable): {e!s}"
