"""API routes for TTS generation."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID
import os

from app.core.database import get_db
from app.core.auth import get_current_user, require_operator
from app.schemas import (
    TTSGenerationRequest,
    TTSGenerationResponse,
    GenerationJobResponse,
    GenerationJobStatus,
    PaginatedResponse,
)
from app.models import User, GenerationJob
from app.services.tts_service import tts_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/v1/tts", tags=["tts"])


@router.post("/generate", response_model=TTSGenerationResponse)
async def generate_speech(
    request: TTSGenerationRequest,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> TTSGenerationResponse:
    """Generate speech from text (async job)."""
    # Validate voice profile if provided
    if request.voice_profile_id:
        from app.services.voice_service import voice_service
        profile = await voice_service.get_profile_for_user(request.voice_profile_id, user, db)
        if not profile:
            raise HTTPException(status_code=404, detail="Voice profile not found")

    # Submit generation job
    job = await tts_service.generate_speech(request, user, db)

    await audit_service.log_action(
        action="generate",
        resource_type="generation_job",
        resource_id=str(job.id),
        user=user,
        details={
            "text_length": len(request.text),
            "voice_profile_id": str(request.voice_profile_id) if request.voice_profile_id else None,
            "language": request.language,
        },
        db=db,
    )

    return TTSGenerationResponse(
        job_id=job.id,
        status=job.status,
        message="Generation started",
        audio_url=f"/api/v1/tts/jobs/{job.id}/audio" if job.status == "completed" else None,
    )


@router.post("/generate-sync", response_model=GenerationJobResponse)
async def generate_speech_sync(
    request: TTSGenerationRequest,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> GenerationJobResponse:
    """Generate speech synchronously (waits for completion)."""
    # Validate voice profile if provided
    if request.voice_profile_id:
        from app.services.voice_service import voice_service
        profile = await voice_service.get_profile_for_user(request.voice_profile_id, user, db)
        if not profile:
            raise HTTPException(status_code=404, detail="Voice profile not found")

    job = await tts_service.generate_speech(request, user, db)

    await audit_service.log_action(
        action="generate_sync",
        resource_type="generation_job",
        resource_id=str(job.id),
        user=user,
        details={"text_length": len(request.text)},
        db=db,
    )

    return job


@router.get("/jobs", response_model=PaginatedResponse[GenerationJobResponse])
async def list_generation_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[GenerationJobStatus] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[GenerationJobResponse]:
    """List generation jobs for the current user."""
    jobs, total = await tts_service.list_jobs(db, user.id, status, page, page_size)

    return PaginatedResponse(
        items=[GenerationJobResponse.model_validate(j) for j in jobs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/jobs/{job_id}", response_model=GenerationJobResponse)
async def get_generation_job(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerationJobResponse:
    """Get a generation job by ID."""
    job = await tts_service.get_job(job_id, db)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if job.user_id != user.id and not user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    return GenerationJobResponse.model_validate(job)


@router.get("/jobs/{job_id}/audio")
async def get_generation_audio(
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Download generated audio file."""
    job = await tts_service.get_job(job_id, db)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if job.user_id != user.id and not user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    if job.status != GenerationJobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Generation not completed")
    if not job.output_audio_path or not os.path.exists(job.output_audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        job.output_audio_path,
        media_type="audio/wav",
        filename=f"generation_{job_id}.wav",
    )


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_generation_job(
    job_id: UUID,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a generation job and its audio file."""
    job = await tts_service.get_job(job_id, db)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if job.user_id != user.id and not user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete audio file
    if job.output_audio_path and os.path.exists(job.output_audio_path):
        try:
            os.unlink(job.output_audio_path)
        except Exception:
            pass

    await db.delete(job)
    await db.commit()

    await audit_service.log_action(
        action="delete",
        resource_type="generation_job",
        resource_id=str(job_id),
        user=user,
        db=db,
    )