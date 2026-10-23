# Changelog

## 1.0.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-23

### Added
- Initial project skeleton with FastAPI backend and React frontend
- SQLite database with User, VoiceProfile, GenerationJob, AuditLog models
- OIDC Keycloak authentication with demo mode fallback
- Voice profile management (CRUD, audio upload, public/private)
- TTS generation API with async/sync endpoints
- Generation job tracking with status, audio playback, download
- LoRA fine-tuning job management (UI + API stubs)
- React 18 + TypeScript + Vite frontend with:
  - Dashboard with stats and recent activity
  - Voice profiles grid with search/filter/pagination
  - TTS generation form with language presets
  - Audio player with progress, volume, download
  - Jobs table with filtering and modal player
  - Fine-tuning configuration wizard
  - Settings page with profile, security, notifications
  - Login/OIDC callback pages
- Dockerfiles for backend (Python 3.12) and frontend (Node 24 + nginx)
- Docker Compose with PostgreSQL, Redis, Keycloak (dev profile)
- GitHub Actions CI workflow (backend tests, frontend tests, Docker builds)
- Comprehensive README with architecture diagram, API reference, setup guide
- Portfolio.json manifest

### Security
- JWT tokens with RS256 (HS256 in demo)
- HttpOnly SameSite cookies for session management
- PKCE for OIDC authorization code flow
- CORS restricted to configured frontend origin
- Input validation on all endpoints
- Audit logging for all mutations

### Known Limitations
- VoxCPM2 model integration is mocked (silent audio output)
- Demo mode uses in-memory authentication
- Fine-tuning jobs are simulated
- No real benchmark numbers yet
- Polish/Turkish quality reflects base model limitations

## [Unreleased]

### Planned
- Real VoxCPM2 model loading and inference
- Streaming audio response
- WebSocket progress updates for generation
- Reference audio preprocessing (normalization, trimming)
- Batch generation support
- Model caching and GPU memory management
- Prometheus metrics export
- SAML identity broker documentation
- Comprehensive test coverage (>80%)
- Automated release with version tagging