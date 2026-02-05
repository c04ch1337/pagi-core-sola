"""L5 Skill: manage_email – Manage email (read/send stub for safety).

Stub: log only, no real read/send. Saves to KB; use /api/memory with kb_name for persistence.
Gated by PAGI_ALLOW_LOCAL_DISPATCH and allow-list. No outbound API calls.
"""

from __future__ import annotations

from pydantic import BaseModel


class ManageEmailParams(BaseModel):
    action: str  # e.g. read, send
    content: str = ""
    kb_name: str = "kb_email"


def run(params: ManageEmailParams) -> str:
    """Stub: log email action (no real read/send). Return summary; persist via /api/memory with kb_name."""
    action = (params.action or "read").lower()
    summary = f"Email {action} stub for {params.kb_name}: content_len={len(params.content or '')}. Use POST /api/memory to persist. No real email accessed or sent."
    return summary
