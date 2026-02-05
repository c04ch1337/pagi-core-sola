"""L5 Skill: post_social – Post to social media (stub for safety).

Stub: log only, no real API. Saves to KB for audit; use /api/memory with kb_name for persistence.
Gated by PAGI_ALLOW_LOCAL_DISPATCH and allow-list. No outbound API calls.
"""

from __future__ import annotations

from pydantic import BaseModel


class PostSocialParams(BaseModel):
    content: str
    platform: str = "stub"
    kb_name: str = "kb_social"


def run(params: PostSocialParams) -> str:
    """Stub: log post (no real API). Return confirmation; persist via /api/memory with kb_name."""
    logged = f"[post_social stub] platform={params.platform} content_len={len(params.content or '')}"
    return f"Post logged to {params.kb_name}: {logged}. Use POST /api/memory with kb_name={params.kb_name} to persist. No real post sent."
