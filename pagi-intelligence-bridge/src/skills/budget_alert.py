"""L5 Skill: budget_alert – Generate budget alerts/reminders.

Stub: log-only; compare spending vs limit in intent only. No real external APIs.
Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical.
"""

from __future__ import annotations

from pydantic import BaseModel


class BudgetAlertParams(BaseModel):
    category: str
    limit: float
    kb_name: str = "kb_finance"


def run(params: BudgetAlertParams) -> str:
    """Stub: log alert intent (category, limit); return confirmation. No outbound calls."""
    _ = (params.category, params.limit, params.kb_name)
    return f"[budget_alert] Alert set for {params.category}"
