"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, EmailStr, HttpUrl
from uuid import UUID
import enum


class UserRole(str, enum.Enum):
    VIEWER = "viewer"
    OPERATOR = "operator"
    ADMIN = "admin"


class GenerationJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=1, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    roles: List[UserRole] = [UserRole.VIEWER]


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    roles: Optional[List[UserRole]] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: UUID
    roles: List[UserRole]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


# Voice Profile schemas
class VoiceProfileBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    language: str = Field(..., min_length=2, max_length=10)
    reference_text: Optional[str] = None
    cfg_value: float = Field(default=2.0, ge=0.1, le=10.0)
    inference_timesteps: int = Field(default=10, ge=1, le=100)
    min_len: int = Field(default=2, ge=1, le=100)
    is_public: bool = False
    tags: List[str] = []


class VoiceProfileCreate(VoiceProfileBase):
    reference_audio_path: str
    reference_audio_duration: Optional[float] = None
    sample_rate: int = 16000


class VoiceProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    language: Optional[str] = Field(None, min_length=2, max_length=10)
    reference_text: Optional[str] = None
    cfg_value: Optional[float] = Field(None, ge=0.1, le=10.0)
    inference_timesteps: Optional[int] = Field(None, ge=1, le=100)
    min_len: Optional[int] = Field(None, ge=1, le=100)
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = None


class VoiceProfileResponse(VoiceProfileBase):
    id: UUID
    owner_id: UUID
    reference_audio_path: str
    reference_audio_duration: Optional[float] = None
    sample_rate: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Generation Job schemas
class GenerationJobCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_profile_id: Optional[UUID] = None
    cfg_value: Optional[float] = Field(None, ge=0.1, le=10.0)
    inference_timesteps: Optional[int] = Field(None, ge=1, le=100)
    min_len: Optional[int] = Field(None, ge=1, le=100)


class GenerationJobResponse(BaseModel):
    id: UUID
    user_id: UUID
    voice_profile_id: Optional[UUID] = None
    status: GenerationJobStatus
    input_text: str
    detected_language: Optional[str] = None
    cfg_value: Optional[float] = None
    inference_timesteps: Optional[int] = None
    min_len: Optional[int] = None
    output_audio_path: Optional[str] = None
    output_duration: Optional[float] = None
    output_sample_rate: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# TTS Generation request (direct, without job)
class TTSGenerationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_profile_id: Optional[UUID] = None
    reference_audio_path: Optional[str] = None
    reference_text: Optional[str] = None
    language: Optional[str] = Field(None, min_length=2, max_length=10)
    cfg_value: float = Field(default=2.0, ge=0.1, le=10.0)
    inference_timesteps: int = Field(default=10, ge=1, le=100)
    min_len: int = Field(default=2, ge=1, le=100)
    stream: bool = False


class TTSGenerationResponse(BaseModel):
    job_id: UUID
    status: GenerationJobStatus
    message: str
    audio_url: Optional[str] = None


# Health check
class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    demo_mode: bool
    database: str
    timestamp: datetime


# Audit log
class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: dict
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


from typing import Generic, TypeVar

T = TypeVar("T")


# Pagination
class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

# OIDC / Auth
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None


class OIDCConfigResponse(BaseModel):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    client_id: str
    scope: str = "openid profile email"


# Language detection
class LanguageDetectionResponse(BaseModel):
    language: str
    confidence: float
    alternatives: List[dict] = []


# Fine-tuning
class FineTuningConfig(BaseModel):
    pretrained_path: str
    train_manifest: str
    val_manifest: Optional[str] = None
    sample_rate: int = 16000
    out_sample_rate: int = 48000
    batch_size: int = 1
    grad_accum_steps: int = 2
    num_workers: int = 8
    num_iters: int = 1000
    log_interval: int = 10
    valid_interval: int = 500
    save_interval: int = 500
    learning_rate: float = 0.0001
    weight_decay: float = 0.01
    warmup_steps: int = 100
    max_steps: int = 1000
    max_batch_tokens: int = 8192
    max_grad_norm: float = 1.0
    save_path: str
    tensorboard: Optional[str] = None
    lambdas: dict = Field(default_factory=lambda: {"loss/diff": 1.0, "loss/stop": 1.0})
    lora: dict = Field(default_factory=lambda: {
        "enable_lm": True,
        "enable_dit": True,
        "enable_proj": False,
        "r": 64,
        "alpha": 128,
        "dropout": 0.0,
    })


class FineTuningJobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FineTuningJobResponse(BaseModel):
    id: UUID
    user_id: UUID
    config: FineTuningConfig
    status: FineTuningJobStatus
    current_step: int = 0
    total_steps: int
    current_loss: Optional[float] = None
    log_path: Optional[str] = None
    checkpoint_path: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True