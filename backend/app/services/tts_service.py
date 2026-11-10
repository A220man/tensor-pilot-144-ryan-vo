"""TTS generation service with VoxCPM2 integration (mocked)."""

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, AsyncGenerator
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import User, VoiceProfile, GenerationJob, GenerationJobStatus
from app.schemas import TTSGenerationRequest, GenerationJobResponse
from app.core.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


class TTSService:
    """Service for TTS generation using VoxCPM2."""

    def __init__(self):
        self._model = None
        self._model_loaded = False

    async def load_model(self) -> None:
        """Load VoxCPM2 model (mocked)."""
        if self._model_loaded:
            return

        logger.info("loading_voxcpm_model", model_path=settings.voxcpm_model_path)
        # In real implementation:
        # from voxcpm import VoxCPM
        # self._model = VoxCPM.from_pretrained(settings.voxcpm_model_path or "openbmb/VoxCPM2")
        # self._model.to(settings.voxcpm_device)

        # Mock model loaded
        await asyncio.sleep(0.1)
        self._model_loaded = True
        logger.info("voxcpm_model_loaded")

    async def generate_speech(
        self,
        request: TTSGenerationRequest,
        user: User,
        db: AsyncSession,
    ) -> GenerationJobResponse:
        """Generate speech from text."""
        await self.load_model()

        # Create generation job
        job = GenerationJob(
            user_id=user.id,
            voice_profile_id=request.voice_profile_id,
            input_text=request.text,
            status=GenerationJobStatus.PROCESSING,
            cfg_value=request.cfg_value,
            inference_timesteps=request.inference_timesteps,
            min_len=request.min_len,
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        logger.info("generation_started", job_id=str(job.id), user_id=str(user.id))

        try:
            # Get voice profile if specified
            voice_profile = None
            if request.voice_profile_id:
                result = await db.execute(
                    select(VoiceProfile).where(VoiceProfile.id == request.voice_profile_id)
                )
                voice_profile = result.scalar_one_or_none()

            # Determine reference audio and text
            ref_audio = request.reference_audio_path
            ref_text = request.reference_text
            if voice_profile:
                ref_audio = voice_profile.reference_audio_path
                ref_text = voice_profile.reference_text
                # Use voice profile params as defaults
                cfg = request.cfg_value or voice_profile.cfg_value
                steps = request.inference_timesteps or voice_profile.inference_timesteps
                min_len = request.min_len or voice_profile.min_len
            else:
                cfg = request.cfg_value
                steps = request.inference_timesteps
                min_len = request.min_len

            # Mock language detection
            detected_lang = await self._detect_language(request.text, request.language)
            job.detected_language = detected_lang

            # Generate audio (mocked)
            output_path = await self._generate_audio_mock(
                text=request.text,
                reference_audio=ref_audio,
                reference_text=ref_text,
                cfg_value=cfg,
                inference_timesteps=steps,
                min_len=min_len,
                job_id=job.id,
            )

            # Update job with result
            job.status = GenerationJobStatus.COMPLETED
            job.output_audio_path = output_path
            job.output_duration = 5.0  # Mock duration
            job.output_sample_rate = 16000
            job.completed_at = datetime.now(timezone.utc)

            await db.commit()
            await db.refresh(job)

            logger.info("generation_completed", job_id=str(job.id))
            return GenerationJobResponse.model_validate(job)

        except Exception as e:
            job.status = GenerationJobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.error("generation_failed", job_id=str(job.id), error=str(e))
            raise

    async def _detect_language(self, text: str, hint: Optional[str] = None) -> str:
        """Detect language of input text (mocked)."""
        if hint:
            return hint

        # Simple heuristic: check for common characters
        if any('\u4e00' <= c <= '\u9fff' for c in text):
            return "zh"
        if any(c in 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ' for c in text):
            return "pl"
        if any(c in 'ğüşıöçĞÜŞİÖÇ' for c in text):
            return "tr"
        return "en"

    async def _generate_audio_mock(
        self,
        text: str,
        reference_audio: Optional[str],
        reference_text: Optional[str],
        cfg_value: float,
        inference_timesteps: int,
        min_len: int,
        job_id: UUID,
    ) -> str:
        """Mock audio generation - creates a placeholder WAV file."""
        # Simulate processing time
        await asyncio.sleep(0.5)

        # Create output directory
        output_dir = Path(settings.upload_dir) / "generated"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Create a minimal WAV file (silence)
        output_path = output_dir / f"{job_id}.wav"
        import wave
        import struct

        sample_rate = 16000
        duration = max(len(text) * 0.1, 1.0)  # Rough estimate
        num_samples = int(sample_rate * duration)

        with wave.open(str(output_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            # Write silence
            silence = struct.pack('<h', 0) * num_samples
            wav_file.writeframes(silence)

        return str(output_path)

    async def get_job(self, job_id: UUID, db: AsyncSession) -> Optional[GenerationJob]:
        """Get generation job by ID."""
        result = await db.execute(select(GenerationJob).where(GenerationJob.id == job_id))
        return result.scalar_one_or_none()

    async def list_jobs(
        self,
        db: AsyncSession,
        user_id: UUID,
        status: Optional[GenerationJobStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[GenerationJob], int]:
        """List generation jobs for a user."""
        from sqlalchemy import func

        query = select(GenerationJob).where(GenerationJob.user_id == user_id)
        if status:
            query = query.where(GenerationJob.status == status)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        # Paginate
        query = query.order_by(GenerationJob.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        jobs = list(result.scalars().all())

        return jobs, total


    async def generate_speech_stream(
        self,
        request: TTSGenerationRequest,
        user: User,
        db: AsyncSession,
    ) -> AsyncGenerator[bytes, None]:
        """Generate speech and stream audio chunks."""
        await self.load_model()

        # Create generation job
        job = GenerationJob(
            user_id=user.id,
            voice_profile_id=request.voice_profile_id,
            input_text=request.text,
            status=GenerationJobStatus.PROCESSING,
            cfg_value=request.cfg_value,
            inference_timesteps=request.inference_timesteps,
            min_len=request.min_len,
            started_at=datetime.now(timezone.utc),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        logger.info("streaming_generation_started", job_id=str(job.id), user_id=str(user.id))

        try:
            # Get voice profile if specified
            voice_profile = None
            if request.voice_profile_id:
                result = await db.execute(
                    select(VoiceProfile).where(VoiceProfile.id == request.voice_profile_id)
                )
                voice_profile = result.scalar_one_or_none()

            # Determine reference audio and text
            ref_audio = request.reference_audio_path
            ref_text = request.reference_text
            if voice_profile:
                ref_audio = voice_profile.reference_audio_path
                ref_text = voice_profile.reference_text
                cfg = request.cfg_value or voice_profile.cfg_value
                steps = request.inference_timesteps or voice_profile.inference_timesteps
                min_len = request.min_len or voice_profile.min_len
            else:
                cfg = request.cfg_value
                steps = request.inference_timesteps
                min_len = request.min_len

            # Mock language detection
            detected_lang = await self._detect_language(request.text, request.language)
            job.detected_language = detected_lang

            # Generate and save audio file (like non-streaming)
            output_path = await self._generate_audio_mock(
                text=request.text,
                reference_audio=ref_audio,
                reference_text=ref_text,
                cfg_value=cfg,
                inference_timesteps=steps,
                min_len=min_len,
                job_id=job.id,
            )

            # Update job with audio metadata
            job.output_audio_path = output_path
            job.output_duration = max(len(request.text) * 0.1, 1.0)
            job.output_sample_rate = 16000

            # Stream the saved audio file in chunks
            async for chunk in self._stream_audio_file(output_path):
                yield chunk

            # Update job with completion status
            job.status = GenerationJobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(job)

            logger.info("streaming_generation_completed", job_id=str(job.id))

        except Exception as e:
            job.status = GenerationJobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.error("streaming_generation_failed", job_id=str(job.id), error=str(e))
            raise

    async def _generate_audio_stream_mock(
        self,
        text: str,
        reference_audio: Optional[str],
        reference_text: Optional[str],
        cfg_value: float,
        inference_timesteps: int,
        min_len: int,
        job_id: UUID,
    ) -> AsyncGenerator[bytes, None]:
        """Mock streaming audio generation - yields WAV file in chunks."""
        # Generate complete WAV in memory first, then stream in chunks
        import wave
        import struct
        import math
        import io

        sample_rate = 16000
        total_duration = max(len(text) * 0.1, 2.0)
        num_samples = int(sample_rate * total_duration)
        channels = 1
        sampwidth = 2

        # Create WAV in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(sampwidth)
            wav_file.setframerate(sample_rate)
            # Generate sine wave audio data
            audio_data = []
            for i in range(num_samples):
                t = i / sample_rate
                frequency = 440.0
                value = int(32767 * 0.1 * math.sin(2 * math.pi * frequency * t))
                audio_data.append(struct.pack('<h', value))
            wav_file.writeframes(b''.join(audio_data))

        # Get complete WAV data
        wav_buffer.seek(0)
        wav_data = wav_buffer.read()

        # Simulate processing time
        await asyncio.sleep(0.2)

        # Stream in chunks (e.g., 4KB chunks)
        chunk_size = 4096
        for i in range(0, len(wav_data), chunk_size):
            await asyncio.sleep(0.01)  # Simulate network/chunk delay
            yield wav_data[i:i + chunk_size]

    async def _stream_audio_file(self, file_path: str) -> AsyncGenerator[bytes, None]:
        """Stream an audio file in chunks."""
        chunk_size = 4096
        with open(file_path, 'rb') as f:
            while chunk := f.read(chunk_size):
                await asyncio.sleep(0.01)  # Simulate network/chunk delay
                yield chunk
tts_service = TTSService()