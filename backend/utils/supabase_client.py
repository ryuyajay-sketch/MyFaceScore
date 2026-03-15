"""Supabase client utilities — storage + database ops."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from supabase import create_client, Client
from config import get_settings

logger = logging.getLogger(__name__)

BUCKET_NAME = "face-uploads"
RESULTS_TABLE = "analysis_results"


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def upload_image(job_id: str, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """Upload pre-processed image to Supabase Storage. Returns public URL."""
    client = get_supabase()
    path = f"{job_id}/processed.jpg"

    client.storage.from_(BUCKET_NAME).upload(
        path,
        image_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )

    url = client.storage.from_(BUCKET_NAME).get_public_url(path)
    return url


async def save_result(job_id: str, result: dict) -> None:
    """Insert or update analysis result in Supabase DB."""
    client = get_supabase()
    client.table(RESULTS_TABLE).upsert({"id": job_id, **result}).execute()


async def get_result(job_id: str) -> Optional[dict]:
    """Fetch analysis result by ID. Returns None if not found."""
    client = get_supabase()
    res = client.table(RESULTS_TABLE).select("*").eq("id", job_id).single().execute()
    return res.data if res.data else None


async def update_status(job_id: str, status: str, error: Optional[str] = None) -> None:
    """Update job processing status."""
    client = get_supabase()
    payload: dict = {"id": job_id, "status": status}
    if error:
        payload["error"] = error
    client.table(RESULTS_TABLE).upsert(payload).execute()
