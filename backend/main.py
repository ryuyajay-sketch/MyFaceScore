"""First Impression API — FastAPI entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from fastapi import Request
from fastapi.responses import Response

from config import get_settings
from routers import analyze, compare, results

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("First Impression API starting up…")
    yield
    logger.info("First Impression API shutting down.")


settings = get_settings()

app = FastAPI(
    title="First Impression API",
    version="1.0.0",
    description="AI-powered facial first impression analysis",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Routers
app.include_router(analyze.router)
app.include_router(compare.router)
app.include_router(results.router)


@app.get("/healthz", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["root"])
async def root():
    return {"message": "First Impression API", "docs": "/docs"}


# Serve locally stored images (only in local storage mode)
if settings.storage_mode == "local":
    from utils.local_storage import get_image_bytes

    @app.get("/images/{job_id}/{filename}", tags=["images"])
    async def serve_image(job_id: str, filename: str):
        path = f"{job_id}/{filename}"
        data = get_image_bytes(path)
        if not data:
            return Response(status_code=404)
        return Response(content=data, media_type="image/jpeg")
