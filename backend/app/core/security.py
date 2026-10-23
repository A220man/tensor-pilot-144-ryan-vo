"""Security utilities: password hashing, token handling, OIDC validation."""

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlencode

import httpx
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError, JWTClaimsError
from pydantic import BaseModel, Field

from app.core.config import get_settings


settings = get_settings()


class TokenPayload(BaseModel):
    """JWT token payload structure."""
    sub: str
    email: Optional[str] = None
    name: Optional[str] = None
    preferred_username: Optional[str] = None
    realm_access: Dict[str, Any] = Field(default_factory=dict)
    resource_access: Dict[str, Any] = Field(default_factory=dict)
    exp: int
    iat: int
    aud: Optional[str] = None
    iss: Optional[str] = None
    nonce: Optional[str] = None
    session_state: Optional[str] = None
    scope: Optional[str] = None


class JWKSClient:
    """JWKS client for OIDC token validation."""

    def __init__(self, jwks_uri: str):
        self.jwks_uri = jwks_uri
        self._keys: Optional[Dict[str, Any]] = None
        self._fetched_at: float = 0
        self._cache_ttl = 3600  # 1 hour

    async def get_signing_key(self, kid: str) -> Optional[str]:
        """Get signing key by key ID."""
        keys = await self.get_keys()
        for key in keys.get("keys", []):
            if key.get("kid") == kid:
                return jwt.algorithms.RSAAlgorithm.from_jwk(key)
        return None

    async def get_keys(self) -> Dict[str, Any]:
        """Fetch and cache JWKS keys."""
        now = time.time()
        if self._keys and (now - self._fetched_at) < self._cache_ttl:
            return self._keys

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.jwks_uri)
            response.raise_for_status()
            self._keys = response.json()
            self._fetched_at = now
            return self._keys


_jwks_client: Optional[JWKSClient] = None


def get_jwks_client() -> Optional[JWKSClient]:
    """Get or create JWKS client."""
    global _jwks_client
    if settings.oidc_enabled and settings.oidc_jwks_uri:
        if _jwks_client is None:
            _jwks_client = JWKSClient(settings.oidc_jwks_uri)
        return _jwks_client
    return None


async def validate_oidc_token(token: str) -> TokenPayload:
    """Validate OIDC token and return payload."""
    if settings.demo_mode:
        # In demo mode, try demo token format first, then fall back to JWT
        if token.startswith("demo:"):
            return _validate_demo_token(token)
        # Try JWT validation (for tokens created with create_access_token)
        try:
            from jose import jwt
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=["HS256"],
                options={"verify_exp": True, "verify_aud": False, "verify_iss": False},
            )
            return TokenPayload(
                sub=payload.get("sub", "unknown"),
                email=payload.get("email"),
                name=payload.get("name"),
                preferred_username=payload.get("preferred_username"),
                realm_access={"roles": payload.get("roles", ["viewer"])},
                exp=payload.get("exp", 0),
                iat=payload.get("iat", 0),
                aud=settings.oidc_audience,
                iss=settings.oidc_issuer_url,
                scope="openid profile email",
            )
        except Exception:
            pass
        # Fall back to demo user
        return _validate_demo_token("demo:fallback")

    try:
        # Get unverified header to find kid
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise JWTError("Token missing kid")

        key = await jwks_client.get_signing_key(kid)
        if not key:
            raise JWTError(f"Signing key not found for kid: {kid}")

        # Validate token
        payload = jwt.decode(
            token,
            key,
            algorithms=[settings.algorithm],
            audience=settings.oidc_audience,
            issuer=settings.oidc_issuer_url,
            options={"verify_exp": True, "verify_aud": True, "verify_iss": True},
        )

        return TokenPayload(**payload)

    except ExpiredSignatureError:
        raise JWTError("Token expired")
    except JWTClaimsError as e:
        raise JWTError(f"Invalid token claims: {e}")
    except JWTError:
        raise
    except Exception as e:
        raise JWTError(f"Token validation failed: {e}")


def _validate_demo_token(token: str) -> TokenPayload:
    """Validate demo mode token (simple format: demo:<user_id>)."""
    if token.startswith("demo:"):
        user_id = token[5:]
        return TokenPayload(
            sub=user_id,
            email=f"{user_id}@test.local",
            name=f"Demo User {user_id}",
            preferred_username=user_id,
            realm_access={"roles": ["viewer", "operator"]},
            exp=int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
            iat=int(datetime.now(timezone.utc).timestamp()),
            aud=settings.oidc_audience,
            iss=settings.oidc_issuer_url,
            scope="openid profile email",
        )
    raise JWTError("Invalid demo token")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token (for demo mode only)."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return hashlib.pbkdf2_hmac("sha256", plain_password.encode(), b"salt", 100000).hex() == hashed_password


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return hashlib.pbkdf2_hmac("sha256", password.encode(), b"salt", 100000).hex()


def generate_pkce_pair() -> tuple[str, str]:
    """Generate PKCE code verifier and challenge."""
    code_verifier = secrets.token_urlsafe(32)
    code_challenge = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = (
        base64.urlsafe_b64encode(code_challenge).decode().rstrip("=")
    )
    return code_verifier, code_challenge


import base64


def build_authorization_url(
    redirect_uri: str,
    state: str,
    code_challenge: str,
    nonce: str,
) -> str:
    """Build OIDC authorization URL."""
    params = {
        "client_id": settings.oidc_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid profile email",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "nonce": nonce,
    }
    return f"{settings.oidc_issuer_url}/protocol/openid-connect/auth?{urlencode(params)}"


async def exchange_code_for_tokens(
    code: str,
    redirect_uri: str,
    code_verifier: str,
) -> Dict[str, Any]:
    """Exchange authorization code for tokens."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        data = {
            "grant_type": "authorization_code",
            "client_id": settings.oidc_client_id,
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        }
        if settings.oidc_client_secret:
            data["client_secret"] = settings.oidc_client_secret

        response = await client.post(
            f"{settings.oidc_issuer_url}/protocol/openid-connect/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        return response.json()