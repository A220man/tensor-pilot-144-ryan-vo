# TensorPilot — Ryan Vo

> Work in progress. This checkpoint may be incomplete or fail tests. See PLAN.md and STATUS.md before use.


**TensorPilot** — VoxCPM2 TTS Platform for Multilingual Speech Generation, Creative Voice Design, and True-to-Life Cloning

Ryan Vo | AI & Machine Learning | ryandtvo@gmail.com

## Overview

TensorPilot is a developer platform built around **VoxCPM2** — a tokenizer-free text-to-speech model for multilingual speech generation. It provides a complete workflow for voice cloning, speech synthesis, and LoRA fine-tuning through a modern web interface and REST API.

### Key Features

- **Voice Cloning**: Upload reference audio to create voice profiles for zero-shot TTS
- **Multilingual TTS**: Generate speech in English, Chinese, Polish, Turkish, and more
- **Real-time Generation**: Stream or batch synthesize speech with configurable parameters
- **LoRA Fine-tuning**: Adapt VoxCPM2 to new voices/languages with low-rank adaptation
- **Job Management**: Track generation history with status, audio playback, and downloads
- **OIDC Authentication**: Secure Keycloak integration with demo mode for development
- **Audit Logging**: Full audit trail for compliance and debugging

### Architecture

```mermaid
graph TB
    subgraph "Frontend (React + TypeScript + Vite)"
        UI[Web UI]
        API_CLIENT[Typed API Client]
    end

    subgraph "Backend (FastAPI + Python)"
        AUTH[OIDC Auth]
        TTS[TTS Service]
        VOICE[Voice Service]
        FINETUNE[Finetune Service]
        DB[(SQLite/PostgreSQL)]
        REDIS[(Redis)]
    end

    subgraph "Infrastructure"
        KEYCLOAK[Keycloak OIDC]
        MODEL[VoxCPM2 Model]
    end

    UI --> API_CLIENT
    API_CLIENT --> AUTH
    API_CLIENT --> TTS
    API_CLIENT --> VOICE
    API_CLIENT --> FINETUNE
    AUTH --> KEYCLOAK
    TTS --> MODEL
    TTS --> DB
    VOICE --> DB
    FINETUNE --> DB
    TTS --> REDIS
</mermaid>

## Quick Start

### Prerequisites

- Docker 24+ and Docker Compose
- Node.js 24+ (for frontend development)
- Python 3.12+ (for backend development)
- NVIDIA GPU with CUDA 12+ (for GPU acceleration)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/A220man/tensor-pilot-144-ryan-vo.git
cd tensor-pilot-144-ryan-vo

# Copy environment template
cp .env.example .env

# Start all services (including Keycloak for auth)
docker compose --profile dev up -d

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Keycloak Admin: http://localhost:8080 (admin/admin)
```

### Manual Development Setup

#### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Edit .env as needed
python -m pytest tests/
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173 with API proxy to backend
```

### Production Deployment

```bash
# Use production compose (no Keycloak dev profile)
docker compose up -d

# Configure Keycloak separately for production OIDC
# Set environment variables in .env for production
```

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/config` | Get OIDC configuration |
| GET | `/api/v1/auth/login` | Initiate OIDC login |
| GET | `/api/v1/auth/callback` | OIDC callback handler |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/validate-token` | Validate token |
| POST | `/api/v1/auth/demo-token` | Get demo token (dev only) |

### Voice Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/voices` | Create voice profile (multipart) |
| GET | `/api/v1/voices` | List voice profiles |
| GET | `/api/v1/voices/{id}` | Get voice profile |
| PATCH | `/api/v1/voices/{id}` | Update voice profile |
| DELETE | `/api/v1/voices/{id}` | Delete voice profile |

### TTS Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tts/generate` | Generate speech (async) |
| POST | `/api/v1/tts/generate-sync` | Generate speech (sync) |
| GET | `/api/v1/tts/jobs` | List generation jobs |
| GET | `/api/v1/tts/jobs/{id}` | Get job details |
| GET | `/api/v1/tts/jobs/{id}/audio` | Download generated audio |
| DELETE | `/api/v1/tts/jobs/{id}` | Delete job |

### Fine-tuning

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/finetune/jobs` | Create fine-tuning job |
| GET | `/api/v1/finetune/jobs` | List fine-tuning jobs |
| GET | `/api/v1/finetune/jobs/{id}` | Get job details |
| POST | `/api/v1/finetune/jobs/{id}/cancel` | Cancel job |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/healthz` | Health check |
| GET | `/api/v1/ready` | Readiness check |
| GET | `/api/v1/version` | Version info |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `sqlite+aiosqlite:///./tensorpilot.db` |
| `SECRET_KEY` | JWT secret key | Required in production |
| `OIDC_ISSUER_URL` | Keycloak realm URL | `http://localhost:8080/realms/tensorpilot` |
| `OIDC_CLIENT_ID` | OIDC client ID | `tensorpilot-backend` |
| `OIDC_CLIENT_SECRET` | OIDC client secret | Required for production |
| `LLM_API_KEY` | LLM provider API key | Required for real model |
| `LLM_PROVIDER` | Provider type | `openai-compatible` |
| `LLM_MODEL` | Model identifier | `voxcpm2` |
| `VOXCPM_MODEL_PATH` | Local model path | Auto-download from HF |
| `VOXCPM_DEVICE` | Compute device | `cuda` |
| `DEMO_MODE` | Enable demo auth | `true` |

### Supported LLM Providers

- **OpenAI-compatible**: LiteLLM, OpenRouter, Ollama, vLLM
- **Anthropic**: Messages API
- **Gemini**: generateContent API
- **Ollama**: Local inference

## AI/ML Evaluation

TensorPilot implements VoxCPM2 for tokenizer-free multilingual TTS. The platform addresses common issues reported in the VoxCPM community:

### Known Issues & Mitigations

| Issue | Description | Mitigation |
|-------|-------------|------------|
| **Voice cutoff (Polish)** | Final syllable truncated | Increased `min_len`, adjusted `cfg_value` |
| **Short utterance hallucination** | Extra words on single-word inputs | Prefix dash wrapping, length-ratio retry |
| **10-second cutoff (Turkish)** | Generation stops at 10s | Reference audio validation, chunking |
| **Distortion at start** | Audio artifacts | Reference audio preprocessing |

### Evaluation Baseline

```bash
# Run evaluation (requires VoxCPM2 model and test dataset)
python -m backend.app.services.eval \
  --model openbmb/VoxCPM2 \
  --dataset data/eval_polish.jsonl \
  --metrics wer,cer,mos
```

**Results** (to be populated after evaluation):
- WER (Word Error Rate): TBD
- CER (Character Error Rate): TBD
- MOS (Mean Opinion Score): TBD

### Limitations

- Demo mode uses mocked TTS (silent audio output)
- Real VoxCPM2 integration requires GPU and model weights
- Fine-tuning requires significant VRAM (24GB+ recommended)
- Polish/Turkish quality lower than English/Chinese (model limitation)

## Development

### Running Tests

```bash
# Backend tests
cd backend
.venv/bin/python -m pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

### Code Quality

```bash
# Backend linting
cd backend
.venv/bin/ruff check app/

# Frontend linting
cd frontend
npm run lint
```

### Adding Features

1. Create feature branch from `main`
2. Implement backend API in `backend/app/api/`
3. Add frontend components in `frontend/src/components/`
4. Write tests for new functionality
5. Update documentation
6. Submit PR

## Security

- **Authentication**: OIDC Authorization Code flow with PKCE
- **Tokens**: JWT with RS256, short-lived access tokens
- **Cookies**: HttpOnly, SameSite=Lax, Secure (production)
- **CORS**: Restricted to configured frontend origin
- **Rate Limiting**: Per-user limits on generation endpoints
- **Audit Logs**: All mutations logged with user, IP, timestamp

### Demo Mode Limitations

- In-memory token validation (no Keycloak)
- No token refresh or revocation
- SQLite database (no PostgreSQL)
- Mocked TTS and fine-tuning

## Backup & Restore

```bash
# Backup database
docker exec tensorpilot-db pg_dump -U tensorpilot tensorpilot > backup.sql

# Restore database
docker exec -i tensorpilot-db psql -U tensorpilot tensorpilot < backup.sql

# Backup uploads
docker run --rm -v tensorpilot_backend_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz /data
```

## License

MIT License — Copyright (c) 2024 Ryan Vo <ryandtvo@gmail.com>

## References

- [VoxCPM Repository](https://github.com/OpenBMB/VoxCPM)
- [VoxCPM2 Paper](https://arxiv.org/abs/2406.02609)
- [Keycloak Documentation](https://www.keycloak.org/documentation)