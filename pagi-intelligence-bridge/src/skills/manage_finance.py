"""L5 Skill: manage_finance – Manage finance data to KB.

Stub: budgeting/calculation summary and KB summary; use /api/memory with kb_name for persistence.
Gated by PAGI_ALLOW_LOCAL_DISPATCH and allow-list. No outbound API calls.
"""

from __future__ import annotations

from pydantic import BaseModel


class ManageFinanceParams(BaseModel):
    data: dict
    kb_name: str = "kb_finance"


def run(params: ManageFinanceParams) -> str:
    """Stub: process finance data, return summary. Persist via UpsertVectors (/api/memory)."""
    data = params.data or {}
    total = data.get("total") or data.get("budget") or 0
    spent = data.get("spent") or data.get("expenses") or 0
    remainder = float(total) - float(spent) if (total is not None and spent is not None) else None
    parts = [f"Finance summary for {params.kb_name}: data keys={list(data.keys())}"]
    if remainder is not None:
        parts.append(f"remainder={remainder:.2f}")
    parts.append("(stub). Use POST /api/memory with kb_name to persist.")
    return " ".join(parts)
