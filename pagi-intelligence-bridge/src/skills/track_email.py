"""L5 Skill: track_email – Log email events (sent/received) to kb_email (log-only).

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls UpsertVectors via gRPC
when available; otherwise stub. No real SMTP/IMAP.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from pydantic import BaseModel


class TrackEmailParams(BaseModel):
    action: str  # "sent", "received", "draft"
    subject: str
    sender: Optional[str] = None
    recipient: Optional[str] = None
    summary: str
    timestamp: Optional[str] = None
    kb_name: str = "kb_email"


def run(params: TrackEmailParams) -> str:
    """Format log entry, call UpsertVectors via gRPC to kb_email, return summary."""
    action = (params.action or "").strip().lower()
    payload = {
        "action": action,
        "subject": params.subject,
        "summary": params.summary,
    }
    if params.sender is not None:
        payload["sender"] = params.sender
    if params.recipient is not None:
        payload["recipient"] = params.recipient
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
    return f"[track_email] Logged {action}: {params.subject}"
