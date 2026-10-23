"""Database model tests."""

import pytest
from uuid import uuid4
from datetime import datetime, timezone


class TestUserModel:
    """User model tests."""

    @pytest.mark.asyncio
    async def test_create_user(self, db_session):
        from app.models import User
        user = User(
            email="test@example.com",
            username="testuser",
            full_name="Test User",
            roles=["viewer"],
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.roles == ["viewer"]
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None

    @pytest.mark.asyncio
    async def test_user_has_role(self, db_session):
        from app.models import User
        user = User(
            email="test@example.com",
            username="testuser",
            full_name="Test User",
            roles=["viewer", "operator"],
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        assert user.has_role("viewer") is True
        assert user.has_role("operator") is True
        assert user.has_role("admin") is False
        assert user.has_role("viewer", "admin") is True

    @pytest.mark.asyncio
    async def test_user_unique_email(self, db_session):
        from app.models import User
        user1 = User(
            email="test@example.com",
            username="user1",
            full_name="User 1",
            roles=["viewer"],
        )
        user2 = User(
            email="test@example.com",
            username="user2",
            full_name="User 2",
            roles=["viewer"],
        )
        db_session.add(user1)
        await db_session.commit()

        db_session.add(user2)
        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()
        await db_session.rollback()


class TestVoiceProfileModel:
    """VoiceProfile model tests."""

    @pytest.mark.asyncio
    async def test_create_voice_profile(self, db_session, test_user):
        from app.models import VoiceProfile
        profile = VoiceProfile(
            owner_id=test_user.id,
            name="My Voice",
            description="A test voice",
            language="en",
            reference_audio_path="/uploads/voice.wav",
            reference_audio_duration=15.5,
            reference_text="Reference text",
            sample_rate=16000,
            cfg_value=2.0,
            inference_timesteps=10,
            min_len=2,
            is_public=True,
            tags=["test", "english"],
        )
        db_session.add(profile)
        await db_session.commit()
        await db_session.refresh(profile)

        assert profile.id is not None
        assert profile.name == "My Voice"
        assert profile.language == "en"
        assert profile.is_public is True
        assert profile.tags == ["test", "english"]
        assert profile.owner_id == test_user.id

    @pytest.mark.asyncio
    async def test_voice_profile_defaults(self, db_session, test_user):
        from app.models import VoiceProfile
        profile = VoiceProfile(
            owner_id=test_user.id,
            name="Minimal Voice",
            language="zh",
            reference_audio_path="/uploads/voice.wav",
        )
        db_session.add(profile)
        await db_session.commit()
        await db_session.refresh(profile)

        assert profile.cfg_value == 2.0
        assert profile.inference_timesteps == 10
        assert profile.min_len == 2
        assert profile.is_public is False
        assert profile.tags == []
        assert profile.sample_rate == 16000


class TestGenerationJobModel:
    """GenerationJob model tests."""

    @pytest.mark.asyncio
    async def test_create_generation_job(self, db_session, test_user, test_voice_profile):
        from app.models import GenerationJob, GenerationJobStatus
        job = GenerationJob(
            user_id=test_user.id,
            voice_profile_id=test_voice_profile.id,
            status=GenerationJobStatus.PENDING,
            input_text="Hello world",
            cfg_value=2.5,
            inference_timesteps=12,
            min_len=3,
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)

        assert job.id is not None
        assert job.status == GenerationJobStatus.PENDING
        assert job.input_text == "Hello world"
        assert job.cfg_value == 2.5
        assert job.user_id == test_user.id
        assert job.voice_profile_id == test_voice_profile.id
        assert job.created_at is not None

    @pytest.mark.asyncio
    async def test_generation_job_status_enum(self, db_session, test_user):
        from app.models import GenerationJob, GenerationJobStatus
        for status in GenerationJobStatus:
            job = GenerationJob(
                user_id=test_user.id,
                status=status,
                input_text="Test",
            )
            db_session.add(job)
            await db_session.commit()
            assert job.status == status


class TestAuditLogModel:
    """AuditLog model tests."""

    @pytest.mark.asyncio
    async def test_create_audit_log(self, db_session, test_user):
        from app.models import AuditLog
        log = AuditLog(
            user_id=test_user.id,
            action="create",
            resource_type="voice_profile",
            resource_id=str(uuid4()),
            details={"name": "Test Voice"},
            ip_address="127.0.0.1",
            user_agent="Test Agent",
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        assert log.id is not None
        assert log.action == "create"
        assert log.resource_type == "voice_profile"
        assert log.details == {"name": "Test Voice"}
        assert log.ip_address == "127.0.0.1"
        assert log.user_id == test_user.id

    @pytest.mark.asyncio
    async def test_audit_log_without_user(self, db_session):
        from app.models import AuditLog
        log = AuditLog(
            user_id=None,
            action="login_failed",
            resource_type="auth",
            resource_id=None,
            details={"reason": "invalid_credentials"},
            ip_address="127.0.0.1",
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        assert log.user_id is None
        assert log.action == "login_failed"


class TestRelationships:
    """Model relationship tests."""

    @pytest.mark.asyncio
    async def test_user_voice_profiles_relationship(self, db_session, test_user, test_voice_profile):
        from app.models import User
        # Refresh user with relationships
        await db_session.refresh(test_user, ["voice_profiles"])
        assert len(test_user.voice_profiles) == 1
        assert test_user.voice_profiles[0].id == test_voice_profile.id

    @pytest.mark.asyncio
    async def test_user_generation_jobs_relationship(self, db_session, test_user, test_generation_job):
        from app.models import User
        await db_session.refresh(test_user, ["generation_jobs"])
        assert len(test_user.generation_jobs) == 1
        assert test_user.generation_jobs[0].id == test_generation_job.id

    @pytest.mark.asyncio
    async def test_voice_profile_generation_jobs(self, db_session, test_voice_profile, test_generation_job):
        from app.models import VoiceProfile
        await db_session.refresh(test_voice_profile, ["generation_jobs"])
        assert len(test_voice_profile.generation_jobs) == 1
        assert test_voice_profile.generation_jobs[0].id == test_generation_job.id


class TestTimestampBehavior:
    """Timestamp auto-update tests."""

    @pytest.mark.asyncio
    async def test_updated_at_on_change(self, db_session, test_user):
        from app.models import User
        original_updated = test_user.updated_at
        # Small delay to ensure timestamp changes
        import asyncio
        await asyncio.sleep(0.01)

        test_user.full_name = "Updated Name"
        await db_session.commit()
        await db_session.refresh(test_user)

        assert test_user.updated_at > original_updated
        assert test_user.full_name == "Updated Name"