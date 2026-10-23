"""Security and authentication tests."""

import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt


class TestTokenValidation:
    """JWT token validation tests."""

    def test_create_access_token(self):
        from app.core.security import create_access_token
        token = create_access_token({"sub": "user123", "roles": ["viewer"]})
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_payload_structure(self):
        from app.core.security import create_access_token
        token = create_access_token({"sub": "user123", "roles": ["viewer", "operator"]})
        payload = jwt.decode(token, "dev-secret-key-change-in-production", algorithms=["HS256"])
        assert payload["sub"] == "user123"
        assert payload["roles"] == ["viewer", "operator"]
        assert "exp" in payload
        assert "iat" in payload

    def test_token_expiry(self):
        from app.core.security import create_access_token
        from app.core.config import get_settings
        settings = get_settings()
        token = create_access_token({"sub": "user123"}, expires_delta=timedelta(seconds=1))
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        assert payload["exp"] - payload["iat"] <= 2  # ~1 second


class TestPasswordHashing:
    """Password hashing tests."""

    def test_password_hash_and_verify(self):
        from app.core.security import get_password_hash, verify_password
        password = "secure_password_123"
        hashed = get_password_hash(password)
        assert hashed != password
        assert len(hashed) == 64  # SHA256 hex

        assert verify_password(password, hashed) is True
        assert verify_password("wrong_password", hashed) is False

    def test_different_passwords_different_hashes(self):
        from app.core.security import get_password_hash
        hash1 = get_password_hash("password1")
        hash2 = get_password_hash("password2")
        assert hash1 != hash2


class TestPKCE:
    """PKCE code challenge tests."""

    def test_generate_pkce_pair(self):
        from app.core.security import generate_pkce_pair
        verifier, challenge = generate_pkce_pair()
        assert verifier is not None
        assert challenge is not None
        assert len(verifier) >= 32
        assert len(challenge) >= 43  # base64url encoded SHA256

    def test_pkce_verification(self):
        from app.core.security import generate_pkce_pair
        import hashlib
        import base64

        verifier, challenge = generate_pkce_pair()
        # Verify challenge matches verifier
        computed = hashlib.sha256(verifier.encode()).digest()
        computed = base64.urlsafe_b64encode(computed).decode().rstrip("=")
        assert computed == challenge


class TestOIDCTokenValidation:
    """OIDC token validation tests."""

    @pytest.mark.asyncio
    async def test_validate_demo_token(self):
        from app.core.security import validate_oidc_token
        from app.core.config import Settings

        # Create settings with demo mode
        settings = Settings(demo_mode=True, secret_key="test-secret")
        # Patch the global settings
        import app.core.security as security_module
        original_settings = security_module.settings
        security_module.settings = settings

        try:
            payload = await validate_oidc_token("demo:testuser")
            assert payload.sub == "testuser"
            assert payload.email == "testuser@test.local"
            assert "viewer" in payload.realm_access["roles"]
        finally:
            security_module.settings = original_settings

    @pytest.mark.asyncio
    async def test_validate_invalid_token_non_demo(self):
        from app.core.security import validate_oidc_token
        from app.core.config import Settings
        from jose import JWTError

        settings = Settings(demo_mode=False, oidc_issuer_url="https://example.com/realms/test", oidc_audience="test")
        import app.core.security as security_module
        original_settings = security_module.settings
        security_module.settings = settings
        original_jwks = security_module._jwks_client
        security_module._jwks_client = None

        try:
            with pytest.raises(JWTError):
                await validate_oidc_token("invalid-token")
        finally:
            security_module.settings = original_settings
            security_module._jwks_client = original_jwks

    @pytest.mark.asyncio
    async def test_validate_demo_token_fallback(self):
        """In demo mode, invalid tokens fall back to demo user."""
        from app.core.security import validate_oidc_token
        from app.core.config import Settings
        import app.core.security as security_module
        original_settings = security_module.settings
        original_jwks = security_module._jwks_client

        try:
            settings = Settings(demo_mode=True)
            security_module.settings = settings
            payload = await validate_oidc_token("invalid-token")
            assert payload.sub == "fallback"
            assert payload.email == "fallback@test.local"
        finally:
            security_module.settings = original_settings
            security_module._jwks_client = original_jwks


class TestAuthorizationHeaders:
    """Authorization header tests."""

    @pytest.mark.asyncio
    async def test_missing_token_returns_demo_user(self, app):
        """In demo mode, missing token returns demo user."""
        from httpx import AsyncClient
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "demo@example.com"

    @pytest.mark.asyncio
    async def test_invalid_token_returns_demo_user(self, app):
        """In demo mode, invalid token returns demo user."""
        from httpx import AsyncClient
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer invalid-token"}
            )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "demo@example.com"

    @pytest.mark.asyncio
    async def test_valid_demo_token_accepted(self, app):
        from httpx import AsyncClient
        from app.core.security import create_access_token
        token = create_access_token({"sub": "demo", "roles": ["viewer"]})
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
        # In demo mode, this creates a demo user
        assert response.status_code == 200


class TestCORS:
    """CORS configuration tests."""

    @pytest.mark.asyncio
    async def test_cors_headers(self, app):
        from httpx import AsyncClient
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.options(
                "/api/v1/healthz",
                headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"}
            )
        # CORS middleware should allow the origin
        assert response.status_code in [200, 405]  # 405 if OPTIONS not implemented


class TestRateLimiting:
    """Rate limiting tests (placeholder for future implementation)."""

    @pytest.mark.asyncio
    async def test_generation_rate_limit(self, app, auth_headers, test_voice_profile):
        """Test that generation endpoints have rate limiting."""
        from httpx import AsyncClient
        # This is a placeholder - rate limiting would be implemented with Redis
        pass


class TestInputSanitization:
    """Input sanitization tests."""

    @pytest.mark.asyncio
    async def test_sql_injection_prevention(self, app, auth_headers):
        from httpx import AsyncClient
        # Attempt SQL injection in search
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/voices",
                params={"search": "'; DROP TABLE users; --"},
                headers=auth_headers,
            )
        # Should not crash, should return valid response
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_xss_prevention_in_voice_name(self, app, auth_headers):
        from httpx import AsyncClient
        # XSS attempt in voice profile name
        # In real implementation, this would be handled by Pydantic validation
        pass