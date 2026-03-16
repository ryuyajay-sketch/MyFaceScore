"""Local in-memory storage — drop-in replacement for supabase_client for local dev."""
from __future__ import annotations

import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory stores
_results: dict[str, dict] = {}
_images: dict[str, bytes] = {}


async def upload_image(job_id: str, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """Store image in memory, return a local URL."""
    path = f"{job_id}/processed.jpg"
    _images[path] = image_bytes
    url = f"/images/{path}"
    return url


async def upload_original_image(job_id: str, image_bytes: bytes) -> str:
    """Store original (unprocessed) image in memory, return a local URL."""
    path = f"{job_id}/original.jpg"
    _images[path] = image_bytes
    url = f"/images/{path}"
    return url


async def save_result(job_id: str, result: dict) -> None:
    """Save analysis result in memory."""
    existing = _results.get(job_id, {})
    existing.update(result)
    existing["id"] = job_id
    _results[job_id] = existing


async def get_result(job_id: str) -> Optional[dict]:
    """Fetch analysis result by ID."""
    return _results.get(job_id)


async def update_status(
    job_id: str,
    status: str,
    error: Optional[str] = None,
    progress: Optional[int] = None,
    step: Optional[str] = None,
) -> None:
    """Update job processing status with optional progress info."""
    existing = _results.get(job_id, {"id": job_id})
    existing["status"] = status
    if error:
        existing["error"] = error
    if progress is not None:
        existing["progress"] = progress
    if step is not None:
        existing["step"] = step
    _results[job_id] = existing


def get_image_bytes(path: str) -> Optional[bytes]:
    """Get stored image bytes (for serving via API)."""
    return _images.get(path)
