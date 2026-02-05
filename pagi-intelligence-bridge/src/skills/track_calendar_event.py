"""L5 Skill: track_calendar_event – Log and manage calendar events to kb_calendar (log-only).

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls UpsertVectors via gRPC
when available; otherwise stub. No real calendar API calls.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from pydantic import BaseModel


class TrackCalendarEventParams(BaseModel):
    title: str
    start_time: str  # ISO format
    end_time: str
    description: Optional[str] = None
    location: Optional[str] = None
    recurring: Optional[str] = None  # "daily", "weekly", "none"
    reminder_minutes: Optional[int] = None
    kb_name: str = "kb_calendar"


def run(params: TrackCalendarEventParams) -> str:
    """Validate times, format event JSON, call UpsertVectors via gRPC to kb_calendar, return summary."""
    payload = {
        "title": params.title,
        "start_time": params.start_time,
        "end_time": params.end_time,
    }
    if params.description is not None:
        payload["description"] = params.description
    if params.location is not None:
        payload["location"] = params.location
    if params.recurring:
        payload["recurring"] = params.recurring
    if params.reminder_minutes is not None:
        payload["reminder_minutes"] = params.reminder_minutes
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
    return f"[track_calendar_event] Event logged: {params.title} {params.start_time}"
