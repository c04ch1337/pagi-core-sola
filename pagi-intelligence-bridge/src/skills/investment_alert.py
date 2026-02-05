"""L5 Skill: investment_alert – Set or check price/position alerts.

Stub: log only, no real notifications. Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical.
"""

from __future__ import annotations

from pydantic import BaseModel


class InvestmentAlertParams(BaseModel):
    ticker: str
    alert_type: str  # "price_above", "price_below", "position_change"
    threshold: float
    kb_name: str = "kb_finance"


def run(params: InvestmentAlertParams) -> str:
    """Stub alert logic (log only, no real notifications)."""
    _ = (params.kb_name,)
    return f"[investment_alert] Alert set for {params.ticker} {params.alert_type} {params.threshold}"
