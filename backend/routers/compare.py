"""POST /compare — accept two portraits + context, compare them head-to-head."""
from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from models.compare import compare_faces, Context

logger = logging.getLogger(__name__)
router = APIRouter(tags=["compare"])

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/webp"}


class CompareResponse(BaseModel):
    winner: Literal["A", "B"]
    photo_a: dict
    photo_b: dict
    verdict: str
    context: str


@router.post("/compare", response_model=CompareResponse)
async def compare(
    file_a: Annotated[UploadFile, File(description="First portrait photo")],
    file_b: Annotated[UploadFile, File(description="Second portrait photo")],
    context: Annotated[Context, Form(description="Scoring context")] = "professional",
):
    settings = get_settings()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    for label, f in [("Photo A", file_a), ("Photo B", file_b)]:
        if f.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=422, detail=f"{label}: unsupported type '{f.content_type}'.")

    raw_a = await file_a.read()
    raw_b = await file_b.read()

    for label, raw in [("Photo A", raw_a), ("Photo B", raw_b)]:
        if len(raw) > max_bytes:
            raise HTTPException(status_code=413, detail=f"{label} too large. Max {settings.max_upload_size_mb}MB.")

    # Preprocess both images
    from utils.image_processing import FaceProcessingError, preprocess_image, to_bytes

    loop = asyncio.get_event_loop()
    try:
        processed_a, _ = await loop.run_in_executor(None, preprocess_image, raw_a)
        bytes_a = await loop.run_in_executor(None, to_bytes, processed_a)
    except FaceProcessingError as e:
        raise HTTPException(status_code=422, detail=f"Photo A: {e}")

    try:
        processed_b, _ = await loop.run_in_executor(None, preprocess_image, raw_b)
        bytes_b = await loop.run_in_executor(None, to_bytes, processed_b)
    except FaceProcessingError as e:
        raise HTTPException(status_code=422, detail=f"Photo B: {e}")

    try:
        result = await asyncio.wait_for(
            compare_faces(bytes_a, bytes_b, context),
            timeout=settings.analysis_timeout_seconds,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Comparison timed out. Please try again.")
    except Exception as e:
        logger.exception(f"Compare error: {e}")
        raise HTTPException(status_code=500, detail="Comparison failed.")

    return CompareResponse(
        winner=result.winner,
        photo_a=result.photo_a,
        photo_b=result.photo_b,
        verdict=result.verdict,
        context=context,
    )
