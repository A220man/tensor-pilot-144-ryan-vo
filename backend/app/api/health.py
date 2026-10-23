"""API routes for health and system info."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import get_db
from app.schemas import HealthResponse

router = APIRouter(prefix="/v1", tags=["health"])
settings = get_settings()


@router.get("/healthz", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    """Health check endpoint."""
    # Check database
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.app_version,
        environment=settings.environment,
        demo_mode=settings.demo_mode,
        database=db_status,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/ready")
async def readiness_check() -> dict:
    """Readiness check for Kubernetes."""
    return {"status": "ready"}


@router.get("/version")
async def version_info() -> dict:
    """Version information."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


from datetime import datetime, timezone