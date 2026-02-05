"""L5 Skill: track_social_activity – Log social media activity (posts, likes, follows) to kb_social (log-only).

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls UpsertVectors via gRPC
when available; otherwise stub. No real external API calls.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from pydantic import BaseModel


class TrackSocialActivityParams(BaseModel):
    platform: str
    action: str  # "post", "like", "follow"
    content_summary: str
    timestamp: Optional[str] = None
    kb_name: str = "kb_social"


def run(params: TrackSocialActivityParams) -> str:
    """Format log entry, call UpsertVectors via gRPC to kb_social, return summary."""
    payload = {
        "platform": params.platform,
        "action": (params.action or "").strip().lower(),
        "content_summary": params.content_summary,
    }
    if params.timestamp:
        payload["timestamp"] = params.timestamp
    content = json.dumps(payload)
    try:
        try:
            from src.main import _embed_content, _get_kb_stub
            from src.pagi_pb import pagi_pb2
        except ImportError:
            from pagi_intelligence_bridge.main import _embed_content, _get_kb_stub
            from pagi_intelligence_bridge.pagi_pb import pagi_pb2

        vector = _embed_content(content[:10000])
        point_id = str(uuid.uuid4())
        payload_str = content[:10000]
        point = pagi_pb2.VectorPoint(
            id=point_id,
            vector=vector,
            payload={"content": payload_str},
        )
        req = pagi_pb2.UpsertRequest(kb_name=params.kb_name, points=[point])
        stub = _get_kb_stub()
        stub.UpsertVectors(req, timeout=10.0)
    except Exception:
        pass
    return f"[track_social_activity] Logged {params.action} on {params.platform}"
