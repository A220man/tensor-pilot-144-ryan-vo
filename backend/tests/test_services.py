"""Service layer tests."""

import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch


class TestTTSService:
    """TTS service tests."""

    @pytest.mark.asyncio
    async def test_generate_speech_creates_job(self, db_session, test_user):
        from app.services.tts_service import tts_service, TTSService
        from app.schemas import TTSGenerationRequest
        from app.models import GenerationJob, GenerationJobStatus

        request = TTSGenerationRequest(
            text="Hello world",
            voice_profile_id=None,
            cfg_value=2.0,
            inference_timesteps=10,
            min_len=2,
            stream=False,
        )

        # Mock the model loading and generation
        with patch.object(tts_service, '_generate_audio_mock', return_value="/uploads/test.wav"):
            job = await tts_service.generate_speech(request, test_user, db_session)

        assert job is not None
        assert job.input_text == "Hello world"
        assert job.status == GenerationJobStatus.COMPLETED
        assert job.output_audio_path == "/uploads/test.wav"
        assert job.user_id == test_user.id

    @pytest.mark.asyncio
    async def test_generate_speech_with_voice_profile(self, db_session, test_user, test_voice_profile):
        from app.services.tts_service import tts_service
        from app.schemas import TTSGenerationRequest
        from app.models import GenerationJobStatus

        request = TTSGenerationRequest(
            text="Hello from voice profile",
            voice_profile_id=test_voice_profile.id,
            cfg_value=2.0,
            inference_timesteps=10,
            min_len=2,
            stream=False,
        )

        with patch.object(tts_service, '_generate_audio_mock', return_value="/uploads/test.wav"):
            job = await tts_service.generate_speech(request, test_user, db_session)

        assert job.status == GenerationJobStatus.COMPLETED
        assert job.voice_profile_id == test_voice_profile.id
        assert job.cfg_value == test_voice_profile.cfg_value

    @pytest.mark.asyncio
    async def test_list_jobs_pagination(self, db_session, test_user):
        from app.services.tts_service import tts_service
        from app.models import GenerationJob, GenerationJobStatus
        from datetime import datetime, timezone

        # Create multiple jobs
        for i in range(5):
            job = GenerationJob(
                user_id=test_user.id,
                status=GenerationJobStatus.COMPLETED,
                input_text=f"Text {i}",
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(job)
        await db_session.commit()

        # Test pagination
        jobs, total = await tts_service.list_jobs(db_session, test_user.id, page=1, page_size=2)
        assert total == 5
        assert len(jobs) == 2

        jobs, total = await tts_service.list_jobs(db_session, test_user.id, page=2, page_size=2)
        assert len(jobs) == 2

    @pytest.mark.asyncio
    async def test_get_job(self, db_session, test_user, test_generation_job):
        from app.services.tts_service import tts_service

        job = await tts_service.get_job(test_generation_job.id, db_session)
        assert job is not None
        assert job.id == test_generation_job.id

        # Test non-existent job
        job = await tts_service.get_job(uuid4(), db_session)
        assert job is None


class TestVoiceService:
    """Voice service tests."""

    @pytest.mark.asyncio
    async def test_list_profiles(self, db_session, test_user, test_voice_profile):
        from app.services.voice_service import voice_service

        profiles, total = await voice_service.list_profiles(test_user, db_session)
        assert total == 1
        assert len(profiles) == 1
        assert profiles[0].id == test_voice_profile.id

    @pytest.mark.asyncio
    async def test_list_profiles_pagination(self, db_session, test_user):
        from app.services.voice_service import voice_service
        from app.models import VoiceProfile

        # Create multiple profiles
        for i in range(5):
            profile = VoiceProfile(
                owner_id=test_user.id,
                name=f"Voice {i}",
                language="en",
                reference_audio_path=f"/uploads/voice{i}.wav",
            )
            db_session.add(profile)
        await db_session.commit()

        profiles, total = await voice_service.list_profiles(test_user, db_session, page=1, page_size=2)
        assert total == 5  # 5 new profiles
        assert len(profiles) == 2

    @pytest.mark.asyncio
    async def test_get_profile_for_user(self, db_session, test_user):
        from app.services.voice_service import voice_service
        from app.models import VoiceProfile

        # Create a private profile for this test
        private_profile = VoiceProfile(
            owner_id=test_user.id,
            name="Private Voice",
            language="en",
            reference_audio_path="/uploads/private.wav",
            is_public=False,
        )
        db_session.add(private_profile)
        await db_session.commit()
        await db_session.refresh(private_profile)

        # Owner can access
        profile = await voice_service.get_profile_for_user(private_profile.id, test_user, db_session)
        assert profile is not None

        # Other user cannot access private profile
        from app.models import User
        other_user = User(
            email="other@example.com",
            username="other",
            full_name="Other User",
            roles=["viewer"],
        )
        db_session.add(other_user)
        await db_session.commit()

        profile = await voice_service.get_profile_for_user(private_profile.id, other_user, db_session)
        assert profile is None

        # But can access public profile
        private_profile.is_public = True
        await db_session.commit()
        profile = await voice_service.get_profile_for_user(private_profile.id, other_user, db_session)
        assert profile is not None

    @pytest.mark.asyncio
    async def test_update_profile(self, db_session, test_user, test_voice_profile):
        from app.services.voice_service import voice_service
        from app.schemas import VoiceProfileUpdate

        update = VoiceProfileUpdate(name="Updated Name", description="New description")
        result = await voice_service.update_profile(test_voice_profile.id, test_user, update, db_session)

        assert result is not None
        assert result.name == "Updated Name"
        assert result.description == "New description"

        # Non-owner cannot update
        from app.models import User
        other_user = User(
            email="other@example.com",
            username="other",
            full_name="Other User",
            roles=["viewer"],
        )
        db_session.add(other_user)
        await db_session.commit()

        result = await voice_service.update_profile(test_voice_profile.id, other_user, update, db_session)
        assert result is None


class TestAuditService:
    """Audit service tests."""

    @pytest.mark.asyncio
    async def test_log_action(self, db_session, test_user):
        from app.services.audit_service import audit_service

        await audit_service.log_action(
            action="create",
            resource_type="voice_profile",
            resource_id="test-123",
            user=test_user,
            details={"name": "Test"},
            ip_address="127.0.0.1",
            db=db_session,
        )
        await db_session.commit()

        # Query the log
        from app.models import AuditLog
        from sqlalchemy import select
        result = await db_session.execute(select(AuditLog).where(AuditLog.resource_id == "test-123"))
        log = result.scalar_one_or_none()

        assert log is not None
        assert log.action == "create"
        assert log.resource_type == "voice_profile"
        assert log.details == {"name": "Test"}
        assert log.user_id == test_user.id

    @pytest.mark.asyncio
    async def test_log_action_no_db(self, test_user):
        from app.services.audit_service import audit_service
        # Should not raise when db is None
        await audit_service.log_action(
            action="test",
            resource_type="test",
            user=test_user,
            db=None,
        )