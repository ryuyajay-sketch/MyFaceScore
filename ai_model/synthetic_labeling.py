"""
Synthetic Labeling Pipeline for First Impression Model Training.

Uses Claude Vision to generate synthetic labels for facial images from:
  - CFD (Chicago Face Database): https://www.chicagofaces.org/
  - KDEF (Karolinska Directed Emotional Faces): https://www.kdef.se/

Usage:
  python synthetic_labeling.py --input-dir ./images --output ./labels.jsonl --batch-size 10
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import logging
import time
from pathlib import Path
from typing import Iterator

import anthropic

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an AI calibrated for facial first impression research.
Score each face on three dimensions used in published social perception research.
Be calibrated: use the full range, not clustered around 50.
Output ONLY valid JSON. No markdown, no commentary."""

LABEL_PROMPT = """Score this face image for first impression research:
{
  "trustworthiness": <integer 1-100>,
  "attractiveness": <integer 1-100>,  
  "confidence": <integer 1-100>,
  "valence": <-1.0 to 1.0, emotional valence>,
  "notes": "<brief observation, max 20 words>"
}"""

RATE_LIMIT_RPM = 50  # Claude API rate limit (requests per minute)
RATE_LIMIT_SLEEP = 60.0 / RATE_LIMIT_RPM


def iter_image_paths(input_dir: Path, extensions: tuple = (".jpg", ".jpeg", ".png")) -> Iterator[Path]:
    for ext in extensions:
        yield from sorted(input_dir.rglob(f"*{ext}"))


def encode_image(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode("utf-8")


def detect_media_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png"}.get(ext.lstrip("."), "image/jpeg")


async def label_image(client: anthropic.Anthropic, image_path: Path) -> dict | None:
    """Send one image to Claude and parse the structured label response."""
    try:
        b64 = encode_image(image_path)
        media_type = detect_media_type(image_path)

        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                        {"type": "text", "text": LABEL_PROMPT},
                    ],
                }
            ],
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        label = json.loads(raw)
        label["image_path"] = str(image_path)
        label["model"] = "claude-opus-4-5"
        label["timestamp"] = int(time.time())

        # Clamp integer scores
        for key in ("trustworthiness", "attractiveness", "confidence"):
            label[key] = max(1, min(100, int(label[key])))
        label["valence"] = max(-1.0, min(1.0, float(label["valence"])))

        return label

    except json.JSONDecodeError as e:
        logger.error(f"Parse error for {image_path.name}: {e}")
        return None
    except anthropic.APIError as e:
        logger.error(f"API error for {image_path.name}: {e}")
        return None


async def run_labeling(
    input_dir: Path,
    output_path: Path,
    batch_size: int = 10,
    resume: bool = True,
    api_key: str | None = None,
) -> None:
    client = anthropic.Anthropic(api_key=api_key)
    images = list(iter_image_paths(input_dir))
    logger.info(f"Found {len(images)} images in {input_dir}")

    # Resume support: track already-labeled paths
    labeled_paths: set[str] = set()
    if resume and output_path.exists():
        with open(output_path) as f:
            for line in f:
                try:
                    labeled_paths.add(json.loads(line)["image_path"])
                except Exception:
                    pass
        logger.info(f"Resuming — {len(labeled_paths)} already labeled")

    pending = [p for p in images if str(p) not in labeled_paths]
    logger.info(f"{len(pending)} images to label")

    success = 0
    errors = 0

    with open(output_path, "a") as out_f:
        for i, path in enumerate(pending):
            label = await label_image(client, path)
            if label:
                out_f.write(json.dumps(label) + "\n")
                out_f.flush()
                success += 1
                logger.info(f"[{i+1}/{len(pending)}] {path.name} → trust={label['trustworthiness']} attract={label['attractiveness']} conf={label['confidence']}")
            else:
                errors += 1

            # Rate limiting
            await asyncio.sleep(RATE_LIMIT_SLEEP)

            # Progress checkpoint
            if (i + 1) % batch_size == 0:
                logger.info(f"Progress: {i+1}/{len(pending)} | success={success} errors={errors}")

    logger.info(f"Done. Success: {success}, Errors: {errors}, Output: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Synthetic labeling via Claude Vision")
    parser.add_argument("--input-dir", type=Path, required=True, help="Directory of face images (CFD/KDEF)")
    parser.add_argument("--output", type=Path, default=Path("labels.jsonl"), help="Output JSONL file")
    parser.add_argument("--batch-size", type=int, default=10, help="Progress checkpoint interval")
    parser.add_argument("--no-resume", action="store_true", help="Restart from scratch (don't resume)")
    parser.add_argument("--api-key", type=str, default=None, help="Anthropic API key (or set ANTHROPIC_API_KEY)")
    args = parser.parse_args()

    if not args.input_dir.exists():
        raise SystemExit(f"Input directory not found: {args.input_dir}")

    asyncio.run(
        run_labeling(
            input_dir=args.input_dir,
            output_path=args.output,
            batch_size=args.batch_size,
            resume=not args.no_resume,
            api_key=args.api_key,
        )
    )


if __name__ == "__main__":
    main()
