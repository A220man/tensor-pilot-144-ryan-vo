"""API routes for fine-tuning (placeholder)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.auth import get_current_user, require_operator
from app.schemas import FineTuningConfig, FineTuningJobResponse, FineTuningJobStatus, PaginatedResponse
from app.models import User

router = APIRouter(prefix="/v1/finetune", tags=["finetune"])


# In-memory storage for demo (replace with DB in production)
finetune_jobs: dict = {}


@router.post("/jobs", response_model=FineTuningJobResponse, status_code=201)
async def create_finetune_job(
    config: FineTuningConfig,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> FineTuningJobResponse:
    """Create a new fine-tuning job."""
    import uuid
    job_id = uuid.uuid4()

    job = FineTuningJobResponse(
        id=job_id,
        user_id=user.id,
        config=config,
        status=FineTuningJobStatus.PENDING,
        current_step=0,
        total_steps=config.max_steps,
        created_at=datetime.now(timezone.utc),
    )
    finetune_jobs[job_id] = job

    # In production, submit to training queue
    # For now, mark as running
    job.status = FineTuningJobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)

    return job


@router.get("/jobs", response_model=PaginatedResponse[FineTuningJobResponse])
async def list_finetune_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[FineTuningJobStatus] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[FineTuningJobResponse]:
    """List fine-tuning jobs for the current user."""
    user_jobs = [j for j in finetune_jobs.values() if j.user_id == user.id]
    if status:
        user_jobs = [j for j in user_jobs if j.status == status]

    user_jobs.sort(key=lambda j: j.created_at, reverse=True)
    total = len(user_jobs)
    start = (page - 1) * page_size
    end = start + page_size

    return PaginatedResponse(
        items=user_jobs[start:end],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/jobs/{job_id}", response_model=FineTuningJobResponse)
async def get_finetune_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FineTuningJobResponse:
    """Get a fine-tuning job by ID."""
    job = finetune_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Fine-tuning job not found")
    if job.user_id != user.id and not user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    return job


@router.post("/jobs/{job_id}/cancel", response_model=FineTuningJobResponse)
async def cancel_finetune_job(
    job_id: UUID,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> FineTuningJobResponse:
    """Cancel a fine-tuning job."""
    job = finetune_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Fine-tuning job not found")
    if job.user_id != user.id and not user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    job.status = FineTuningJobStatus.CANCELLED
    job.completed_at = datetime.now(timezone.utc)
    return job