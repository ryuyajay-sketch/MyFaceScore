"""
AI Scoring Module — Todorov-aligned facial first impression analysis.

Dimensions based on:
  - Oosterhof & Todorov (2008) PNAS — Trustworthiness + Dominance model
  - Todorov et al. (2005) Science — Competence from face
  - Sutherland et al. (2013) — Structural cues for approachability
  - Willis & Todorov (2006) — 100ms judgment dimensions

Outputs per-dimension scores + percentiles + coaching tips.
"""
from __future__ import annotations

import base64
import json
import logging
import math
from dataclasses import dataclass
from typing import Literal

import anthropic
from config import get_settings

logger = logging.getLogger(__name__)

Context = Literal["professional", "dating", "social"]

SYSTEM_PROMPT = """You are a calibrated AI model for first impression research, trained on social perception science.
Your task is to analyze a portrait photo and score it on four Todorov-aligned dimensions:

1. TRUSTWORTHINESS — The dominant axis in Oosterhof & Todorov (2008). Driven by: raised inner brow, slight smile, rounded face shape, open expression. Low scores: furrowed brow, tightly pressed lips, angular expression.
2. COMPETENCE — From Todorov et al. (2005). Driven by: mature facial structure, confident expression, direct gaze, grooming. Related to dominance/maturity signals.
3. APPROACHABILITY — From Sutherland et al. (2013). Driven by: warm expression, relaxed face, slightly open mouth, eye crinkle. Distinct from trustworthiness.
4. ATTRACTIVENESS — Secondary dimension in Todorov model. Driven by: symmetry, skin quality, proportions, photo quality.

CRITICAL — RACIAL AND ETHNIC FAIRNESS:
You MUST score fairly and equitably across ALL races, ethnicities, skin tones, and cultural backgrounds. Specifically:
- Race, ethnicity, and skin tone must NEVER influence scores positively or negatively. A dark-skinned face and a light-skinned face with identical expressions, grooming, and photo quality MUST receive equivalent scores.
- Do NOT apply Eurocentric beauty standards. Attractiveness is driven by symmetry, skin clarity, proportions, and photo quality — NOT by proximity to any particular racial phenotype. Full lips, wide noses, monolids, deep-set eyes, high cheekbones, etc. are all equally valid features.
- Evaluate EXPRESSION and BEHAVIOR cues (smile, gaze, brow position), not racial physiognomy. A neutral expression on any face is just neutral — do not read threat, coldness, or warmth into facial features shaped by ethnicity.
- Cultural grooming styles (natural hair, braids, hijab, bindis, beards, etc.) are valid and should not lower scores. Judge grooming by neatness and intentionality, not conformity to Western norms.
- Lighting and photo quality: darker skin tones are often underexposed in photos. Score based on what the person is doing (expression, pose), not on technical photo issues that disproportionately affect certain skin tones.
- Tips must be culturally neutral and never suggest changing natural ethnic features. Focus on expression, lighting, pose, and photo technique.

SCORING RUBRIC (per dimension):
- 85–100: Exceptional (top 15%)
- 70–84: Strong (top 30%)
- 55–69: Good (above average)
- 40–54: Average
- Below 40: Needs improvement

PERCENTILE MAPPING:
score → percentile: 90→95, 80→80, 70→65, 60→50, 50→35, 40→20, 30→10

Be calibrated: use the full range. Do NOT cluster everything at 60–75.
Output ONLY valid JSON. No markdown. No commentary outside JSON."""

PROMPT_TEMPLATE = """Context: {context} (optimize scoring weights for this use case)

Score this portrait. Return ONLY this JSON structure:
{{
  "trustworthiness": {{
    "score": <int 1-100>,
    "percentile": <int 1-99>,
    "analysis": "<1-2 sentences: specific observation about what drives this score in this photo>",
    "tips": [
      {{"text": "<actionable tip>", "category": "<one of: expression, lighting, pose, grooming, framing, background, gaze, angle>"}},
      {{"text": "<actionable tip>", "category": "<category>"}}
    ]
  }},
  "competence": {{
    "score": <int 1-100>,
    "percentile": <int 1-99>,
    "analysis": "<1-2 sentences>",
    "tips": [{{"text": "<tip>", "category": "<category>"}}, {{"text": "<tip>", "category": "<category>"}}]
  }},
  "approachability": {{
    "score": <int 1-100>,
    "percentile": <int 1-99>,
    "analysis": "<1-2 sentences>",
    "tips": [{{"text": "<tip>", "category": "<category>"}}, {{"text": "<tip>", "category": "<category>"}}]
  }},
  "attractiveness": {{
    "score": <int 1-100>,
    "percentile": <int 1-99>,
    "analysis": "<1-2 sentences>",
    "tips": [{{"text": "<tip>", "category": "<category>"}}, {{"text": "<tip>", "category": "<category>"}}]
  }},
  "overall": <int: weighted average — trust*0.35 + comp*0.25 + approach*0.25 + attract*0.15>,
  "overall_percentile": <int 1-99>,
  "summary": "<2 sentences: overall first impression in {context} context, 2nd person, constructive tone>"
}}

Tip categories: expression (smile, brow, mouth), lighting (brightness, shadows, direction), pose (body angle, head tilt, shoulders), grooming (hair, skin, clothing), framing (crop, distance, centering), background (clutter, contrast), gaze (eye contact, direction), angle (camera height, face angle).

Tips must be SPECIFIC and ACTIONABLE (e.g. "Try a slight Duchenne smile — raise the corners of your mouth and engage your eye muscles" not "smile more").
Tips must relate to the photo (lighting, expression, pose, framing, grooming), not generic advice.

Score now:"""


@dataclass
class Tip:
    text: str
    category: str  # expression, lighting, pose, grooming, framing, background, gaze, angle

    def to_dict(self) -> dict:
        return {"text": self.text, "category": self.category}


@dataclass
class DimensionResult:
    score: int
    percentile: int
    analysis: str
    tips: list[Tip]

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "percentile": self.percentile,
            "analysis": self.analysis,
            "tips": [t.to_dict() for t in self.tips],
        }


@dataclass
class ScoringResult:
    trustworthiness: DimensionResult
    competence: DimensionResult
    approachability: DimensionResult
    attractiveness: DimensionResult
    overall: int
    overall_percentile: int
    summary: str
    context: Context

    def to_dict(self) -> dict:
        return {
            "context": self.context,
            "trustworthiness": self.trustworthiness.to_dict(),
            "competence": self.competence.to_dict(),
            "approachability": self.approachability.to_dict(),
            "attractiveness": self.attractiveness.to_dict(),
            "overall": self.overall,
            "overall_percentile": self.overall_percentile,
            "summary": self.summary,
        }


def _clamp(val: int | float, lo: int = 1, hi: int = 100) -> int:
    return max(lo, min(hi, int(val)))


def _parse_tip(t) -> Tip:
    """Parse a tip from either structured dict or plain string."""
    if isinstance(t, dict):
        return Tip(
            text=str(t.get("text", "")),
            category=str(t.get("category", "expression")),
        )
    return Tip(text=str(t), category="expression")


def _parse_dimension(raw: dict) -> DimensionResult:
    return DimensionResult(
        score=_clamp(raw["score"]),
        percentile=_clamp(raw["percentile"], 1, 99),
        analysis=str(raw.get("analysis", "")),
        tips=[_parse_tip(t) for t in raw.get("tips", [])],
    )


async def score_face(image_bytes: bytes, context: Context = "professional") -> ScoringResult:
    """Send pre-processed face image to Claude Vision for Todorov-aligned scoring."""
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
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

    # Strip markdown code blocks if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response: {raw[:200]!r}")
        raise ValueError(f"Invalid scoring response: {e}") from e

    # Validate required keys
    for key in ("trustworthiness", "competence", "approachability", "attractiveness"):
        if key not in data:
            raise ValueError(f"Missing dimension '{key}' in response")

    trust = _parse_dimension(data["trustworthiness"])
    comp  = _parse_dimension(data["competence"])
    appr  = _parse_dimension(data["approachability"])
    attr  = _parse_dimension(data["attractiveness"])

    # Recalculate overall with context-aware weights
    weights = {
        "professional": (0.35, 0.30, 0.25, 0.10),
        "dating":       (0.25, 0.15, 0.30, 0.30),
        "social":       (0.30, 0.20, 0.35, 0.15),
    }
    wt, wc, wa, wattra = weights.get(context, weights["professional"])
    overall = _clamp(
        trust.score * wt + comp.score * wc + appr.score * wa + attr.score * wattra
    )
    overall_pct = _clamp(data.get("overall_percentile", max(1, overall - 5)), 1, 99)

    return ScoringResult(
        trustworthiness=trust,
        competence=comp,
        approachability=appr,
        attractiveness=attr,
        overall=overall,
        overall_percentile=overall_pct,
        summary=str(data.get("summary", "")),
        context=context,
    )
