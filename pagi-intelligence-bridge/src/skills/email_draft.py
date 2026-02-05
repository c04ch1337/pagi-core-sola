"""L5 Skill: email_draft – Generate email draft (log-only, no real send).

Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical. Stub: log content only.
"""

from __future__ import annotations

from pydantic import BaseModel


class EmailDraftParams(BaseModel):
    recipient: str
    subject: str
    body: str
    kb_name: str = "kb_email"


def run(params: EmailDraftParams) -> str:
    """Stub draft creation (log content), return confirmation."""
    _ = (params.subject, params.body, params.kb_name)
    return f"[email_draft] Draft generated for {params.recipient}"
