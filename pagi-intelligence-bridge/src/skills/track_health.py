"""L5 Skill: track_health – Track health metrics to KB.

Stub: formats metrics and returns summary; use /api/memory with kb_name for persistence.
Gated by PAGI_ALLOW_LOCAL_DISPATCH and allow-list. No outbound API calls.
"""

from __future__ import annotations

from pydantic import BaseModel


class TrackHealthParams(BaseModel):
    metrics: dict
    kb_name: str = "kb_health"


def run(params: TrackHealthParams) -> str:
    """Stub: record health metrics for KB; return summary. Persist via UpsertVectors (/api/memory)."""
    content = "; ".join(f"{k}: {v}" for k, v in (params.metrics or {}).items()) or "no metrics"
    summary = f"Tracked to {params.kb_name} (stub): {content}. Use POST /api/memory with kb_name={params.kb_name} to persist."
    return summary
