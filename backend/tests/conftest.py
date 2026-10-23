"""Test configuration and fixtures."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings
from app.core.database import Base, get_db
from app.main import create_app
from app.models import User, VoiceProfile, GenerationJob, AuditLog, UserRole, GenerationJobStatus
from app.core.security import create_access_token


# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def test_settings():
    """Override settings for testing."""
    return Settings(
        database_url=TEST_DATABASE_URL,
        debug=True,
        environment="test",
        demo_mode=True,
        secret_key="test-secret-key",
        oidc_enabled=False,
        frontend_url="http://localhost:5173",
    )


@pytest_asyncio.fixture(scope="function")
async def db_engine(test_settings):
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine):
    """Create test database session."""
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

@pytest.fixture
def app(test_settings, db_session):
    """Create test FastAPI app."""
    from app.core.database import get_db

    app = create_app()

    # Override database dependency
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db_session):
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        roles=["viewer", "operator"],
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_voice_profile(db_session, test_user):
    """Create a test voice profile."""
    profile = VoiceProfile(
        owner_id=test_user.id,
        name="Test Voice",
        description="A test voice profile",
        language="en",
        reference_audio_path="/uploads/test.wav",
        reference_audio_duration=10.0,
        reference_text="This is a test reference.",
        sample_rate=16000,
        cfg_value=2.0,
        inference_timesteps=10,
        min_len=2,
        is_public=True,
        tags=["test"],
    )
    db_session.add(profile)
    await db_session.commit()
    await db_session.refresh(profile)
    return profile


@pytest.fixture
async def test_generation_job(db_session, test_user, test_voice_profile):
    """Create a test generation job."""
    job = GenerationJob(
        user_id=test_user.id,
        voice_profile_id=test_voice_profile.id,
        status=GenerationJobStatus.COMPLETED,
        input_text="Hello world",
        detected_language="en",
        cfg_value=2.0,
        inference_timesteps=10,
        min_len=2,
        output_audio_path="/uploads/generated/test.wav",
        output_duration=5.0,
        output_sample_rate=16000,
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


@pytest.fixture
def auth_headers(test_user):
    """Create auth headers for test user."""
    token = create_access_token({"sub": str(test_user.id), "roles": test_user.roles})
    return {"Authorization": f"Bearer {token}"}