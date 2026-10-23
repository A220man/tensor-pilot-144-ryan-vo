"""API routes for voice profiles."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.auth import get_current_user, require_operator
from app.schemas import (
    VoiceProfileCreate,
    VoiceProfileUpdate,
    VoiceProfileResponse,
    PaginationParams,
    PaginatedResponse,
)
from app.models import User
from app.services.voice_service import voice_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/v1/voices", tags=["voices"])


@router.post("", response_model=VoiceProfileResponse, status_code=201)
async def create_voice_profile(
    name: str = Form(...),
    language: str = Form(...),
    description: Optional[str] = Form(None),
    reference_text: Optional[str] = Form(None),
    cfg_value: float = Form(2.0),
    inference_timesteps: int = Form(10),
    min_len: int = Form(2),
    is_public: bool = Form(False),
    tags: str = Form(""),  # comma-separated
    reference_audio: UploadFile = File(...),
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> VoiceProfileResponse:
    """Create a new voice profile with reference audio upload."""
    # Validate file
    if not reference_audio.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = reference_audio.filename.split(".")[-1].lower()
    if ext not in ["wav", "mp3", "flac", "ogg", "m4a"]:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}")

    # Save uploaded file
    file_content = await reference_audio.read()
    if len(file_content) > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    audio_path = await voice_service.save_uploaded_audio(user, file_content, reference_audio.filename)

    # Parse tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    # Create profile
    profile_data = VoiceProfileCreate(
        name=name,
        language=language,
        description=description,
        reference_text=reference_text,
        cfg_value=cfg_value,
        inference_timesteps=inference_timesteps,
        min_len=min_len,
        is_public=is_public,
        tags=tag_list,
        reference_audio_path=audio_path,
    )

    profile = await voice_service.create_profile(user, profile_data, db)

    await audit_service.log_action(
        action="create",
        resource_type="voice_profile",
        resource_id=str(profile.id),
        user=user,
        details={"name": name, "language": language},
        db=db,
    )

    return profile


@router.get("", response_model=PaginatedResponse[VoiceProfileResponse])
async def list_voice_profiles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    language: Optional[str] = Query(None),
    public_only: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[VoiceProfileResponse]:
    """List voice profiles accessible to the user."""
    profiles, total = await voice_service.list_profiles(
        user, db, page, page_size, language, public_only
    )

    return PaginatedResponse(
        items=[VoiceProfileResponse.model_validate(p) for p in profiles],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{profile_id}", response_model=VoiceProfileResponse)
async def get_voice_profile(
    profile_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VoiceProfileResponse:
    """Get a voice profile by ID."""
    profile = await voice_service.get_profile_for_user(profile_id, user, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")

    return VoiceProfileResponse.model_validate(profile)


@router.patch("/{profile_id}", response_model=VoiceProfileResponse)
async def update_voice_profile(
    profile_id: UUID,
    update_data: VoiceProfileUpdate,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> VoiceProfileResponse:
    """Update a voice profile."""
    profile = await voice_service.update_profile(profile_id, user, update_data, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found or access denied")

    await audit_service.log_action(
        action="update",
        resource_type="voice_profile",
        resource_id=str(profile_id),
        user=user,
        details=update_data.model_dump(exclude_unset=True),
        db=db,
    )

    return profile


@router.delete("/{profile_id}", status_code=204)
async def delete_voice_profile(
    profile_id: UUID,
    user: User = Depends(require_operator),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a voice profile."""
    success = await voice_service.delete_profile(profile_id, user, db)
    if not success:
        raise HTTPException(status_code=404, detail="Voice profile not found or access denied")

    await audit_service.log_action(
        action="delete",
        resource_type="voice_profile",
        resource_id=str(profile_id),
        user=user,
        db=db,
    )