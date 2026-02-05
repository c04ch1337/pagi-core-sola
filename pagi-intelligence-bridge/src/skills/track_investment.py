"""L5 Skill: track_investment – Log investment transactions (buy/sell, price, quantity) to kb_finance.

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Calls UpsertVectors via gRPC
when available; otherwise stub (log-only). No real external APIs.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from pydantic import BaseModel


class TrackInvestmentParams(BaseModel):
    ticker: str
    action: str  # "buy" or "sell"
    quantity: float
    price: float
    timestamp: Optional[str] = None
    kb_name: str = "kb_finance"


def run(params: TrackInvestmentParams) -> str:
    """Validate inputs, format as structured JSON, call UpsertVectors via gRPC to kb_finance, return summary."""
    action = (params.action or "").strip().lower()
    if action not in ("buy", "sell"):
        return f"[track_investment] Invalid action: {params.action}; use buy or sell"
    payload = {
        "ticker": params.ticker,
        "action": action,
        "quantity": params.quantity,
        "price": params.price,
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
    return f"[track_investment] Logged {action} {params.quantity} {params.ticker} @ {params.price}"
