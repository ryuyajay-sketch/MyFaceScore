"""POST /chat — follow-up Q&A about a scored photo."""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

import anthropic
from config import get_settings
from models.scoring import Context

settings = get_settings()
if settings.storage_mode == "supabase":
    from utils.supabase_client import get_result
else:
    from utils.local_storage import get_result

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])
limiter = Limiter(key_func=get_remote_address)


class ChatRequest(BaseModel):
    job_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str


CHAT_SYSTEM = """You are an AI photo coach. The user already received a first impression score on their photo.
You have access to their full scoring results below. Answer their questions with specific, actionable advice.

Be brutally honest but constructive — the same tone as the original scoring.
Keep answers concise (2-4 sentences unless they ask for detail).
If they ask something unrelated to their photo or first impressions, gently redirect.
Do not repeat the full scoring — they can already see it. Focus on answering their specific question."""


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(request: Request, body: ChatRequest):
    row = await get_result(body.job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Results not found.")
    if row.get("status") != "ready":
        raise HTTPException(status_code=400, detail="Results not ready yet.")

    # Build context from stored results
    context = row.get("context", "professional")
    summary = row.get("summary", "")
    dimensions = []
    for dim in ("trustworthiness", "competence", "approachability", "attractiveness"):
        d = row.get(dim, {})
        if isinstance(d, dict):
            dimensions.append(f"- {dim}: {d.get('score', '?')}/100 — {d.get('analysis', '')}")

    results_context = f"""Photo context: {context}
Overall score: {row.get('overall', '?')}/100
Summary: {summary}

Dimension breakdown:
{chr(10).join(dimensions)}"""

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=f"{CHAT_SYSTEM}\n\n--- SCORING RESULTS ---\n{results_context}",
        messages=[{"role": "user", "content": body.message}],
    )

    reply = message.content[0].text.strip()
    return ChatResponse(reply=reply)
