"""L5 Skill: health_reminder – Generate health reminders.

Stub: log-only; no real scheduling or external calls. Gated by PAGI_ALLOW_LOCAL_DISPATCH
and personal vertical. Use for reminder type/frequency intent; persistence via kb_health optional.
"""

from __future__ import annotations

from pydantic import BaseModel


class HealthReminderParams(BaseModel):
    type: str
    frequency: str
    kb_name: str = "kb_health"


def run(params: HealthReminderParams) -> str:
    """Stub: log reminder intent; return confirmation. No outbound calls."""
    # Log-only: type and frequency recorded for observability; no real scheduler
    _ = (params.type, params.frequency, params.kb_name)
    return "[health_reminder] Reminder set"
