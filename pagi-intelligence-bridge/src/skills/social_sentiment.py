"""L5 Skill: social_sentiment – Analyze sentiment of logged social content.

Stub: keyword-based positive/negative/neutral. No real external API calls.
Gated by PAGI_ALLOW_LOCAL_DISPATCH and personal vertical.
"""

from __future__ import annotations

from pydantic import BaseModel


class SocialSentimentParams(BaseModel):
    content: str
    kb_name: str = "kb_social"


def run(params: SocialSentimentParams) -> str:
    """Stub sentiment analysis (keyword-based: positive/negative/neutral)."""
    content = (params.content or "").lower()
    positive = any(w in content for w in ("good", "great", "love", "happy", "awesome", "thanks", "amazing"))
    negative = any(w in content for w in ("bad", "hate", "sad", "angry", "terrible", "awful", "worst"))
    if positive and not negative:
        sentiment = "positive"
    elif negative and not positive:
        sentiment = "negative"
    else:
        sentiment = "neutral"
    return f"[social_sentiment] Overall: {sentiment}"
