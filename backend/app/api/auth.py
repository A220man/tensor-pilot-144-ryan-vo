"""API routes for authentication."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import secrets

from app.core.config import get_settings
from app.core.database import get_db
from app.core.auth import (
    get_current_user,
    get_current_user_optional,
    require_admin,
)
from app.core.security import (
    build_authorization_url,
    exchange_code_for_tokens,
    generate_pkce_pair,
    create_access_token,
    validate_oidc_token,
)
from app.schemas import UserResponse, TokenResponse, OIDCConfigResponse
from app.models import User
from app.services.audit_service import audit_service

router = APIRouter(prefix="/v1/auth", tags=["auth"])
settings = get_settings()


class LoginRequest(BaseModel):
    redirect_uri: str


class TokenValidateRequest(BaseModel):
    token: str


@router.get("/config", response_model=OIDCConfigResponse)
async def oidc_config() -> OIDCConfigResponse:
    """Get OIDC configuration for frontend."""
    return OIDCConfigResponse(
        issuer=settings.oidc_issuer_url,
        authorization_endpoint=f"{settings.oidc_issuer_url}/protocol/openid-connect/auth",
        token_endpoint=f"{settings.oidc_issuer_url}/protocol/openid-connect/token",
        jwks_uri=settings.oidc_jwks_uri or f"{settings.oidc_issuer_url}/protocol/openid-connect/certs",
        client_id=settings.oidc_client_id,
    )


@router.get("/login")
async def login(redirect_uri: str, request: Request) -> RedirectResponse:
    """Initiate OIDC login flow."""
    # Generate PKCE pair
    code_verifier, code_challenge = generate_pkce_pair()
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    # Store in session (in production, use Redis or secure cookies)
    request.session["oidc_state"] = state
    request.session["oidc_nonce"] = nonce
    request.session["oidc_code_verifier"] = code_verifier
    request.session["oidc_redirect_uri"] = redirect_uri

    auth_url = build_authorization_url(redirect_uri, state, code_challenge, nonce)
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def callback(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle OIDC callback."""
    if error:
        raise HTTPException(status_code=400, detail=f"OIDC error: {error_description}")

    # Validate state
    stored_state = request.session.get("oidc_state")
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    code_verifier = request.session.get("oidc_code_verifier")
    redirect_uri = request.session.get("oidc_redirect_uri")

    if not code_verifier or not redirect_uri:
        raise HTTPException(status_code=400, detail="Missing session data")

    try:
        # Exchange code for tokens
        tokens = await exchange_code_for_tokens(code, redirect_uri, code_verifier)

        # Validate ID token
        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(status_code=400, detail="No ID token received")

        payload = await validate_oidc_token(id_token)

        # Create or get user
        from app.core.auth import _get_or_create_user_from_token
        user = await _get_or_create_user_from_token(db, payload)

        # Create access token for our API
        access_token = create_access_token({"sub": str(user.id), "roles": user.roles})

        # Store tokens in session
        request.session["access_token"] = access_token
        request.session["refresh_token"] = tokens.get("refresh_token")
        request.session["user_id"] = str(user.id)

        # Clear OIDC session data
        for key in ["oidc_state", "oidc_nonce", "oidc_code_verifier", "oidc_redirect_uri"]:
            request.session.pop(key, None)

        # Audit log
        await audit_service.log_action(
            action="login",
            resource_type="user",
            resource_id=str(user.id),
            user=user,
            details={"method": "oidc"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            db=db,
        )

        # Redirect to frontend with token
        frontend_url = f"{settings.frontend_url}/auth/callback?token={access_token}"
        return RedirectResponse(url=frontend_url)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")


@router.post("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Logout user."""
    user_id = request.session.get("user_id")
    if user_id:
        from uuid import UUID
        user = await db.get(User, UUID(user_id))
        if user:
            await audit_service.log_action(
                action="logout",
                resource_type="user",
                resource_id=user_id,
                user=user,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                db=db,
            )

    request.session.clear()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: User = Depends(get_current_user)) -> UserResponse:
    """Get current user info."""
    return UserResponse.model_validate(user)


@router.post("/validate-token", response_model=UserResponse)
async def validate_token(
    request: TokenValidateRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Validate a token and return user info (for frontend)."""
    payload = await validate_oidc_token(request.token)
    from app.core.auth import _get_or_create_user_from_token
    user = await _get_or_create_user_from_token(db, payload)
    return UserResponse.model_validate(user)


@router.post("/demo-token")
async def demo_token() -> TokenResponse:
    """Get a demo token (demo mode only)."""
    if not settings.demo_mode:
        raise HTTPException(status_code=403, detail="Demo mode disabled")

    token = create_access_token({"sub": "demo", "roles": ["viewer", "operator", "admin"]})
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


# Add session middleware support
class SessionMiddleware:
    """Simple session middleware for demo."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Parse cookies
            headers = dict(scope.get("headers", []))
            cookie_header = headers.get(b"cookie", b"").decode()
            session = {}
            for cookie in cookie_header.split(";"):
                cookie = cookie.strip()
                if cookie.startswith("session="):
                    # In production, decrypt and verify session cookie
                    session = {"demo": True}
                    break
            scope["session"] = session
        await self.app(scope, receive, send)