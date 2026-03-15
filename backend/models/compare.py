"""
AI Comparison Module — side-by-side portrait comparison using Claude Vision.

Sends both images in a single call for direct relative judgment.
"""
from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from typing import Literal

import anthropic
from config import get_settings

logger = logging.getLogger(__name__)

Context = Literal["professional", "dating", "social"]

SYSTEM_PROMPT = """You are a calibrated AI model for first impression research, specializing in photo comparison.
You will receive TWO portrait photos (Photo A and Photo B) and must compare them for a specific context.

Score each photo on the four Todorov-aligned dimensions:
1. TRUSTWORTHINESS — Driven by: expression openness, smile, brow position, face shape cues.
2. COMPETENCE — Driven by: confident expression, direct gaze, grooming, mature structure.
3. APPROACHABILITY — Driven by: warmth, relaxed expression, eye crinkle, openness.
4. ATTRACTIVENESS — Driven by: symmetry, skin quality, proportions, photo quality.

CRITICAL — RACIAL AND ETHNIC FAIRNESS:
Score fairly across ALL races, ethnicities, and skin tones. Race and skin tone must NEVER influence scores.
Do NOT apply Eurocentric beauty standards. Evaluate expression and behavior, not racial features.
Cultural grooming styles (natural hair, braids, hijab, etc.) are valid. Tips must never suggest changing ethnic features.

COMPARISON GUIDELINES:
- Judge each photo ON ITS OWN MERITS, then determine which is stronger for the given context.
- Consider: expression, lighting, pose, framing, background, grooming, and overall photo quality.
- The winner is whichever photo creates a stronger FIRST IMPRESSION for the specified context.
- Be specific about WHY one photo is stronger — don't just restate scores.

Output ONLY valid JSON. No markdown. No commentary outside JSON."""

PROMPT_TEMPLATE = """Context: {context}

Compare these two portraits. Return ONLY this JSON:
{{
  "photo_a": {{
    "overall": <int 1-100>,
    "trustworthiness": <int 1-100>,
    "competence": <int 1-100>,
    "approachability": <int 1-100>,
    "attractiveness": <int 1-100>,
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"]
  }},
  "photo_b": {{
    "overall": <int 1-100>,
    "trustworthiness": <int 1-100>,
    "competence": <int 1-100>,
    "approachability": <int 1-100>,
    "attractiveness": <int 1-100>,
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"]
  }},
  "winner": "<A or B>",
  "verdict": "<2-3 sentences explaining WHY the winner creates a stronger first impression for this context. Be specific about what makes the difference.>"
}}

Score now:"""


@dataclass
class CompareResult:
    winner: str  # "A" or "B"
    photo_a: dict
    photo_b: dict
    verdict: str


async def compare_faces(
    image_a_bytes: bytes,
    image_b_bytes: bytes,
    context: Context = "professional",
) -> CompareResult:
    """Send two pre-processed face images to Claude Vision for comparison."""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    b64_a = base64.standard_b64encode(image_a_bytes).decode("utf-8")
    b64_b = base64.standard_b64encode(image_b_bytes).decode("utf-8")

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Photo A:"},
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64_a},
                    },
                    {"type": "text", "text": "Photo B:"},
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64_b},
                    },
                    {
                        "type": "text",
                        "text": PROMPT_TEMPLATE.format(context=context),
                    },
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse compare response: {raw[:200]!r}")
        raise ValueError(f"Invalid comparison response: {e}") from e

    return CompareResult(
        winner=data.get("winner", "A"),
        photo_a=data.get("photo_a", {}),
        photo_b=data.get("photo_b", {}),
        verdict=data.get("verdict", ""),
    )
