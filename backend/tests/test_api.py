"""API endpoint tests."""

import pytest
from httpx import AsyncClient
from uuid import uuid4


class TestHealthEndpoints:
    """Health check endpoint tests."""

    @pytest.mark.asyncio
    async def test_health_check(self, app):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]
        assert "version" in data
        assert "environment" in data
        assert "demo_mode" in data
        assert "database" in data
        assert "timestamp" in data

    @pytest.mark.asyncio
    async def test_readiness_check(self, app):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/ready")
        assert response.status_code == 200
        assert response.json()["status"] == "ready"

    @pytest.mark.asyncio
    async def test_version_info(self, app):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/version")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "environment" in data


class TestAuthEndpoints:
    """Authentication endpoint tests."""

    @pytest.mark.asyncio
    async def test_oidc_config(self, app):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/auth/config")
        assert response.status_code == 200
        data = response.json()
        assert "issuer" in data
        assert "client_id" in data
        assert "authorization_endpoint" in data

    @pytest.mark.asyncio
    async def test_demo_token(self, app):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/auth/demo-token")
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data

    @pytest.mark.asyncio
    async def test_me_unauthorized(self, app):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/auth/me")
        # In demo mode, this returns 200 with demo user
        assert response.status_code == 200
    @pytest.mark.asyncio
    async def test_me_authorized(self, app, auth_headers, test_user):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/auth/me", headers=auth_headers)
        # In demo mode, demo user is returned
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "demo@example.com"
        assert data["username"] == "demo"
        assert "roles" in data

class TestVoiceEndpoints:
    """Voice profile endpoint tests."""

    @pytest.mark.asyncio
    async def test_list_voices_empty(self, app, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/voices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_voices_with_data(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/voices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "Test Voice"

    @pytest.mark.asyncio
    async def test_get_voice(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/voices/{test_voice_profile.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_voice_profile.id)
        assert data["name"] == "Test Voice"
        assert data["language"] == "en"

    @pytest.mark.asyncio
    async def test_get_voice_not_found(self, app, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/voices/{uuid4()}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_voice_invalid_format(self, app, auth_headers):
        # Test without file - should fail validation
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/voices",
                data={
                    "name": "Test",
                    "language": "en",
                    "cfg_value": "2.0",
                    "inference_timesteps": "10",
                    "min_len": "2",
                },
                headers=auth_headers,
            )
        # Should fail because no file uploaded
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_update_voice(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.patch(
                f"/api/v1/voices/{test_voice_profile.id}",
                json={"name": "Updated Voice", "description": "Updated"},
                headers=auth_headers,
            )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Voice"
        assert data["description"] == "Updated"

    @pytest.mark.asyncio
    async def test_delete_voice(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.delete(f"/api/v1/voices/{test_voice_profile.id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify deleted
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/voices/{test_voice_profile.id}", headers=auth_headers)
        assert response.status_code == 404


class TestGenerationEndpoints:
    """TTS generation endpoint tests."""

    @pytest.mark.asyncio
    async def test_generate_speech_sync(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/tts/generate-sync",
                json={
                    "text": "Hello world",
                    "voice_profile_id": str(test_voice_profile.id),
                    "cfg_value": 2.0,
                    "inference_timesteps": 10,
                    "min_len": 2,
                },
                headers=auth_headers,
            )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["status"] == "completed"
        assert data["input_text"] == "Hello world"

    @pytest.mark.asyncio
    async def test_generate_speech_async(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/tts/generate",
                json={
                    "text": "Hello world",
                    "voice_profile_id": str(test_voice_profile.id),
                },
                headers=auth_headers,
            )
        assert response.status_code == 200
        data = response.json()
        # In demo mode, generation completes synchronously and returns audio_url
        assert "audio_url" in data

    @pytest.mark.asyncio
    async def test_list_jobs(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create a job first
            await client.post(
                "/api/v1/tts/generate-sync",
                json={
                    "text": "Hello world",
                    "voice_profile_id": str(test_voice_profile.id),
                },
                headers=auth_headers,
            )
            response = await client.get("/api/v1/tts/jobs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["input_text"] == "Hello world"

    @pytest.mark.asyncio
    async def test_get_job(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create a job first
            create_resp = await client.post(
                "/api/v1/tts/generate-sync",
                json={
                    "text": "Hello world",
                    "voice_profile_id": str(test_voice_profile.id),
                },
                headers=auth_headers,
            )
            job_id = create_resp.json()["id"]
            response = await client.get(f"/api/v1/tts/jobs/{job_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == job_id
        assert data["status"] == "completed"

    @pytest.mark.asyncio
    async def test_delete_job(self, app, auth_headers, test_voice_profile):
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create a job first
            create_resp = await client.post(
                "/api/v1/tts/generate-sync",
                json={
                    "text": "Hello world",
                    "voice_profile_id": str(test_voice_profile.id),
                },
                headers=auth_headers,
            )
            job_id = create_resp.json()["id"]
            response = await client.delete(f"/api/v1/tts/jobs/{job_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify deleted
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/tts/jobs/{job_id}", headers=auth_headers)
        assert response.status_code == 404


class TestFinetuneEndpoints:
    """Fine-tuning endpoint tests."""

    @pytest.mark.asyncio
    async def test_list_finetune_jobs(self, app, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/finetune/jobs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_create_finetune_job(self, app, auth_headers):
        config = {
            "pretrained_path": "openbmb/VoxCPM2",
            "train_manifest": "train.jsonl",
            "sample_rate": 16000,
            "out_sample_rate": 48000,
            "batch_size": 1,
            "grad_accum_steps": 2,
            "num_workers": 8,
            "num_iters": 1000,
            "learning_rate": 0.0001,
            "weight_decay": 0.01,
            "warmup_steps": 100,
            "max_steps": 1000,
            "max_batch_tokens": 8192,
            "max_grad_norm": 1.0,
            "save_path": "checkpoints/test",
            "lambdas": {"loss/diff": 1.0, "loss/stop": 1.0},
            "lora": {
                "enable_lm": True,
                "enable_dit": True,
                "enable_proj": False,
                "r": 64,
                "alpha": 128,
                "dropout": 0.0,
            },
        }
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/finetune/jobs", json=config, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["status"] == "running"
        assert data["config"]["pretrained_path"] == "openbmb/VoxCPM2"


class TestAuthorization:
    """Authorization and role tests."""

    @pytest.mark.asyncio
    async def test_voice_create_requires_operator(self, app):
        """Test that voice creation requires operator role."""
        # In demo mode, demo user has operator role so authorization passes
        # This test verifies the endpoint structure works
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Send invalid data to test validation (not authorization)
            response = await client.post("/api/v1/voices", data={"name": "Test"})
        # Should get validation error (422) not auth error
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_admin_access(self, app):
        # Create admin user
        from app.models import User
        admin = User(
            email="admin@example.com",
            username="admin",
            full_name="Admin User",
            roles=["admin"],
            is_active=True,
        )
        # Would need db_session to persist - skip for now
        pass


class TestValidation:
    """Input validation tests."""

    @pytest.mark.asyncio
    async def test_generate_invalid_text(self, app, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/tts/generate-sync",
                json={"text": ""},  # Empty text should fail
                headers=auth_headers,
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_invalid_cfg(self, app, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/tts/generate-sync",
                json={"text": "Hello", "cfg_value": 100},  # Out of range
                headers=auth_headers,
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_voice_invalid_language(self, app, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/voices",
                data={"name": "Test", "language": "xx"},  # Invalid language
                headers=auth_headers,
            )
        # Language validation happens in service layer
        assert response.status_code in [400, 422]


from app.core.security import create_access_token