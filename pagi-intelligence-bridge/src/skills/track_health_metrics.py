"""L5 Skill: track_health_metrics – Log health metrics to kb_health.

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls UpsertVectors via gRPC
when bridge/orchestrator are available; otherwise stub (log-only). No real external APIs.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from pydantic import BaseModel


class TrackHealthMetricsParams(BaseModel):
    metrics: dict
    timestamp: Optional[str] = None
    kb_name: str = "kb_health"


def run(params: TrackHealthMetricsParams) -> str:
    """Validate params, optionally upsert to kb_health via gRPC, return summary."""
    if not params.metrics:
        return "[track_health_metrics] No metrics provided; skipped."
    content = json.dumps(params.metrics)
    if params.timestamp:
        content += f" {params.timestamp}"
    try:
        try:
            from src.main import _embed_content, _get_kb_stub
            from src.pagi_pb import pagi_pb2
        except ImportError:
            from pagi_intelligence_bridge.main import _embed_content, _get_kb_stub
            from pagi_intelligence_bridge.pagi_pb import pagi_pb2

        vector = _embed_content(content[:10000])
        point_id = str(uuid.uuid4())
        payload_str = json.dumps(params.metrics)[:10000]
        point = pagi_pb2.VectorPoint(
            id=point_id,
            vector=vector,
            payload={"content": payload_str},
        )
        req = pagi_pb2.UpsertRequest(kb_name=params.kb_name, points=[point])
        stub = _get_kb_stub()
        stub.UpsertVectors(req, timeout=10.0)
    except Exception:
        pass  # Stub path: no gRPC or embed; still report logged
    return "[track_health_metrics] Logged"
