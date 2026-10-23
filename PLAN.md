# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

project-skeleton

## Roadmap

### project-skeleton — FastAPI/React project skeleton with core infrastructure

Status: in_progress

Acceptance:
- Backend: FastAPI app with health endpoint, SQLite models, pytest config
- Frontend: React+TypeScript+Vite with build/test scripts
- Docker: backend/frontend Dockerfiles, compose.yaml with Keycloak
- CI: GitHub Actions workflow for backend/frontend tests and Docker builds
- Auth: OIDC Keycloak integration with demo mode

### tts-generation-api — TTS generation API with VoxCPM2 integration

Status: planned

Acceptance:
- POST /api/v1/tts/generate endpoint accepting text, reference audio, params
- Integration with VoxCPM2 model (mocked in tests)
- Parameter validation and error handling
- Audio response streaming

### voice-cloning-workflow — Voice cloning workflow with reference audio management

Status: planned

Acceptance:
- Upload and manage reference audio files
- Voice profile creation with metadata
- Generate speech using saved voice profiles
- Frontend UI for voice management and generation

### multilingual-support — Multilingual TTS with language detection and optimization

Status: planned

Acceptance:
- Language detection for input text
- Per-language generation parameter presets
- Polish/Turkish/Chinese/English optimization profiles
- Short-utterance hallucination mitigation

### finetuning-dashboard — LoRA fine-tuning dashboard and job management

Status: planned

Acceptance:
- Training data upload and validation
- LoRA config UI with parameter presets
- Training job submission and monitoring
- Checkpoint management and inference testing

