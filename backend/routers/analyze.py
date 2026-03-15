"""POST /analyze — accept portrait + context, run async pipeline."""
from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from models.scoring import score_face, Context
from utils.image_processing import FaceProcessingError, preprocess_image, to_bytes

settings = get_settings()
if settings.storage_mode == "supabase":
    from utils.supabase_client import save_result, update_status, upload_image
else:
    from utils.local_storage import save_result, update_status, upload_image

logger = logging.getLogger(__name__)
router = APIRouter(tags=["analyze"])

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/webp"}


class AnalyzeResponse(BaseModel):
    id: str
    status: str
    message: str


async def run_pipeline(job_id: str, raw_bytes: bytes, context: Context) -> None:
    """Background task: preprocess → score → persist."""
    loop = asyncio.get_event_loop()
    settings = get_settings()
    try:
        await update_status(job_id, "processing", progress=5, step="detecting")

        async def _pipeline() -> None:
            # Step 1 — face detection & pre-processing (CPU-bound)
            await update_status(job_id, "processing", progress=10, step="detecting")
            processed_bgr, face_meta = await loop.run_in_executor(
                None, preprocess_image, raw_bytes
            )
            await update_status(job_id, "processing", progress=25, step="enhancing")
            processed_bytes = await loop.run_in_executor(None, to_bytes, processed_bgr)

            # Step 2 — upload pre-processed image to storage
            await update_status(job_id, "processing", progress=35, step="uploading")
            image_url = await upload_image(job_id, processed_bytes)

            # Step 3 — AI scoring (longest step)
            await update_status(job_id, "processing", progress=45, step="scoring")
            scoring = await score_face(processed_bytes, context)

            # Step 4 — persist result
            await update_status(job_id, "processing", progress=90, step="finalizing")
            await save_result(job_id, {
                "status": "ready",
                "context": context,
                "image_url": image_url,
                "face_detection_confidence": face_meta.get("score"),
                **scoring.to_dict(),
            })

            logger.info(f"Pipeline complete [{job_id}] overall={scoring.overall} context={context}")

        await asyncio.wait_for(_pipeline(), timeout=settings.analysis_timeout_seconds)

    except FaceProcessingError as e:
        logger.warning(f"Face detection failed [{job_id}]: {e}")
        await update_status(job_id, "failed", str(e))
    except asyncio.TimeoutError:
        logger.error(f"Timeout [{job_id}]")
        await update_status(job_id, "failed", "Analysis timed out. Please try again.")
    except Exception as e:
        logger.exception(f"Unexpected error [{job_id}]: {e}")
        await update_status(job_id, "failed", "An unexpected error occurred.")


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: Annotated[UploadFile, File(description="Portrait photo (JPEG/PNG, max 10MB)")],
    context: Annotated[Context, Form(description="Scoring context: professional | dating | social")] = "professional",
):
    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail=f"Unsupported type '{file.content_type}'. Use JPEG or PNG.")

    raw = await file.read()
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.max_upload_size_mb}MB.")

    from nanoid import generate
    job_id = generate(size=21)
    await update_status(job_id, "queued")

    asyncio.create_task(run_pipeline(job_id, raw, context))

    return AnalyzeResponse(id=job_id, status="queued", message="Analysis started.")
