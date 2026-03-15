"""GET /results/{id} and GET /results/{id}/status."""
from __future__ import annotations

import logging
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import get_settings

_settings = get_settings()
if _settings.storage_mode == "supabase":
    from utils.supabase_client import get_result
else:
    from utils.local_storage import get_result

logger = logging.getLogger(__name__)
router = APIRouter(tags=["results"])

Context = Literal["professional", "dating", "social"]


class StatusResponse(BaseModel):
    id: str
    status: str
    progress: Optional[int] = None
    step: Optional[str] = None


class TipModel(BaseModel):
    text: str
    category: str = "expression"


class DimensionModel(BaseModel):
    score: int
    percentile: int
    analysis: str
    tips: list[TipModel]


class ResultsResponse(BaseModel):
    id: str
    context: Context
    trustworthiness: DimensionModel
    competence: DimensionModel
    approachability: DimensionModel
    attractiveness: DimensionModel
    overall: int
    overall_percentile: int
    summary: str
    image_url: Optional[str] = None
    created_at: Optional[str] = None


@router.get("/results/{job_id}/status", response_model=StatusResponse)
async def get_status(job_id: str):
    row = await get_result(job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")
    return StatusResponse(
        id=job_id,
        status=row.get("status", "processing"),
        progress=row.get("progress"),
        step=row.get("step"),
    )


@router.get("/results/{job_id}", response_model=ResultsResponse)
async def get_results(job_id: str):
    row = await get_result(job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Results not found.")

    status = row.get("status")
    if status in ("queued", "processing"):
        raise HTTPException(status_code=202, detail="Analysis in progress.")
    if status == "failed":
        raise HTTPException(status_code=422, detail=row.get("error", "Analysis failed."))
    if status != "ready":
        raise HTTPException(status_code=500, detail="Unexpected state.")

    def _dim(key: str) -> DimensionModel:
        raw = row.get(key, {})
        if isinstance(raw, dict):
            return DimensionModel(**raw)
        raise HTTPException(status_code=500, detail="Invalid response format.")

    return ResultsResponse(
        id=job_id,
        context=row.get("context", "professional"),
        trustworthiness=_dim("trustworthiness"),
        competence=_dim("competence"),
        approachability=_dim("approachability"),
        attractiveness=_dim("attractiveness"),
        overall=row["overall"],
        overall_percentile=row.get("overall_percentile", 50),
        summary=row["summary"],
        image_url=row.get("image_url"),
        created_at=str(row.get("created_at", "")),
    )
