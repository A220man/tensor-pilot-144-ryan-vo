"""Voice profile management service."""

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import VoiceProfile, User
from app.schemas import VoiceProfileCreate, VoiceProfileUpdate, VoiceProfileResponse, PaginationParams
from app.core.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class VoiceService:
    """Service for managing voice profiles."""

    def __init__(self):
        self.upload_dir = Path(settings.upload_dir) / "references"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def create_profile(
        self,
        user: User,
        profile_data: VoiceProfileCreate,
        db: AsyncSession,
    ) -> VoiceProfileResponse:
        """Create a new voice profile."""
        # Copy reference audio to upload directory
        src_path = Path(profile_data.reference_audio_path)
        if not src_path.exists():
            raise ValueError(f"Reference audio not found: {src_path}")

        # Generate unique filename
        ext = src_path.suffix.lower()
        if ext not in ['.wav', '.mp3', '.flac', '.ogg', '.m4a']:
            raise ValueError(f"Unsupported audio format: {ext}")

        dest_filename = f"{user.id}_{uuid.uuid4().hex}{ext}"
        dest_path = self.upload_dir / dest_filename

        shutil.copy2(src_path, dest_path)

        # Get audio duration (mocked)
        duration = profile_data.reference_audio_duration or 10.0

        # Create profile
        profile = VoiceProfile(
            owner_id=user.id,
            name=profile_data.name,
            description=profile_data.description,
            language=profile_data.language,
            reference_audio_path=str(dest_path),
            reference_audio_duration=duration,
            reference_text=profile_data.reference_text,
            sample_rate=profile_data.sample_rate,
            cfg_value=profile_data.cfg_value,
            inference_timesteps=profile_data.inference_timesteps,
            min_len=profile_data.min_len,
            is_public=profile_data.is_public,
            tags=profile_data.tags,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

        logger.info("voice_profile_created", profile_id=str(profile.id), user_id=str(user.id))
        return VoiceProfileResponse.model_validate(profile)

    async def get_profile(
        self,
        profile_id: UUID,
        db: AsyncSession,
    ) -> Optional[VoiceProfile]:
        """Get voice profile by ID."""
        result = await db.execute(select(VoiceProfile).where(VoiceProfile.id == profile_id))
        return result.scalar_one_or_none()

    async def get_profile_for_user(
        self,
        profile_id: UUID,
        user: User,
        db: AsyncSession,
    ) -> Optional[VoiceProfile]:
        """Get voice profile by ID, ensuring user owns it or it's public."""
        profile = await self.get_profile(profile_id, db)
        if not profile:
            return None
        if profile.owner_id != user.id and not profile.is_public:
            return None
        return profile

    async def list_profiles(
        self,
        user: User,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        language: Optional[str] = None,
        public_only: bool = False,
    ) -> tuple[List[VoiceProfile], int]:
        """List voice profiles for a user."""
        query = select(VoiceProfile)

        if public_only:
            query = query.where(VoiceProfile.is_public == True)
        else:
            # User's own profiles + public profiles
            query = query.where(
                (VoiceProfile.owner_id == user.id) | (VoiceProfile.is_public == True)
            )

        if language:
            query = query.where(VoiceProfile.language == language)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        # Paginate
        query = query.order_by(VoiceProfile.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        profiles = list(result.scalars().all())

        return profiles, total

    async def update_profile(
        self,
        profile_id: UUID,
        user: User,
        update_data: VoiceProfileUpdate,
        db: AsyncSession,
    ) -> Optional[VoiceProfileResponse]:
        """Update voice profile."""
        profile = await self.get_profile(profile_id, db)
        if not profile:
            return None
        if profile.owner_id != user.id and not user.has_role("admin"):
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(profile, field, value)

        profile.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(profile)

        logger.info("voice_profile_updated", profile_id=str(profile.id))
        return VoiceProfileResponse.model_validate(profile)

    async def delete_profile(
        self,
        profile_id: UUID,
        user: User,
        db: AsyncSession,
    ) -> bool:
        """Delete voice profile and its reference audio."""
        profile = await self.get_profile(profile_id, db)
        if not profile:
            return False
        if profile.owner_id != user.id and not user.has_role("admin"):
            return False

        # Delete reference audio file
        try:
            audio_path = Path(profile.reference_audio_path)
            if audio_path.exists():
                audio_path.unlink()
        except Exception as e:
            logger.warning("failed_to_delete_audio", profile_id=str(profile_id), error=str(e))

        await db.delete(profile)
        await db.commit()

        logger.info("voice_profile_deleted", profile_id=str(profile_id))
        return True

    async def save_uploaded_audio(
        self,
        user: User,
        file_content: bytes,
        filename: str,
    ) -> str:
        """Save uploaded audio file and return path."""
        # Validate extension
        ext = Path(filename).suffix.lower()
        if ext not in ['.wav', '.mp3', '.flac', '.ogg', '.m4a']:
            raise ValueError(f"Unsupported audio format: {ext}")

        # Generate unique filename
        dest_filename = f"{user.id}_{uuid.uuid4().hex}{ext}"
        dest_path = self.upload_dir / dest_filename

        # Write file
        dest_path.write_bytes(file_content)

        return str(dest_path)


voice_service = VoiceService()