"""Database models."""

from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    String,
    Text,
    DateTime,
    Boolean,
    Integer,
    ForeignKey,
    Index,
    JSON,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User roles."""
    VIEWER = "viewer"
    OPERATOR = "operator"
    ADMIN = "admin"


class User(Base):
    """User model."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    oauth_sub: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    roles: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    voice_profiles: Mapped[List["VoiceProfile"]] = relationship(
        "VoiceProfile", back_populates="owner", cascade="all, delete-orphan"
    )
    generation_jobs: Mapped[List["GenerationJob"]] = relationship(
        "GenerationJob", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="user", cascade="all, delete-orphan"
    )

    def has_role(self, *roles: str) -> bool:
        """Check if user has any of the given roles."""
        return any(role in self.roles for role in roles)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, roles={self.roles})>"


class VoiceProfile(Base):
    """Voice profile with reference audio."""

    __tablename__ = "voice_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    reference_audio_path: Mapped[str] = mapped_column(String(500), nullable=False)
    reference_audio_duration: Mapped[Optional[float]] = mapped_column(nullable=True)
    reference_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sample_rate: Mapped[int] = mapped_column(Integer, default=16000, nullable=False)
    # Generation parameters
    cfg_value: Mapped[float] = mapped_column(default=2.0, nullable=False)
    inference_timesteps: Mapped[int] = mapped_column(default=10, nullable=False)
    min_len: Mapped[int] = mapped_column(default=2, nullable=False)
    # Metadata
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="voice_profiles")
    generation_jobs: Mapped[List["GenerationJob"]] = relationship(
        "GenerationJob", back_populates="voice_profile", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_voice_profiles_owner_created", "owner_id", "created_at"),
        Index("ix_voice_profiles_language", "language"),
    )

    def __repr__(self) -> str:
        return f"<VoiceProfile(id={self.id}, name={self.name}, language={self.language})>"


class GenerationJobStatus(str, enum.Enum):
    """Generation job status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GenerationJob(Base):
    """TTS generation job."""

    __tablename__ = "generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    voice_profile_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("voice_profiles.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[GenerationJobStatus] = mapped_column(
        SQLEnum(GenerationJobStatus), default=GenerationJobStatus.PENDING, nullable=False
    )
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    detected_language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    # Generation parameters (can override voice profile defaults)
    cfg_value: Mapped[Optional[float]] = mapped_column(nullable=True)
    inference_timesteps: Mapped[Optional[int]] = mapped_column(nullable=True)
    min_len: Mapped[Optional[int]] = mapped_column(nullable=True)
    # Output
    output_audio_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_duration: Mapped[Optional[float]] = mapped_column(nullable=True)
    output_sample_rate: Mapped[Optional[int]] = mapped_column(nullable=True)
    # Error info
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="generation_jobs")
    voice_profile: Mapped[Optional["VoiceProfile"]] = relationship(
        "VoiceProfile", back_populates="generation_jobs"
    )

    __table_args__ = (
        Index("ix_generation_jobs_user_status", "user_id", "status"),
        Index("ix_generation_jobs_created", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<GenerationJob(id={self.id}, status={self.status}, text={self.input_text[:30]}...)>"


class AuditLog(Base):
    """Audit log for security and compliance."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_user_created", "user_id", "created_at"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action}, resource={self.resource_type})>"