"""Authentication dependencies and user models."""

from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    validate_oidc_token,
    TokenPayload,
    get_jwks_client,
)
from app.models import User


settings = get_settings()
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user from token."""
    if settings.demo_mode:
        # In demo mode, always return demo user
        return await _get_or_create_demo_user(db)

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = await validate_oidc_token(credentials.credentials)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await _get_or_create_user_from_token(db, payload)
    return user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get current user if authenticated, otherwise None."""
    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None

async def _get_or_create_demo_user(db: AsyncSession) -> User:
    """Get or create demo user."""
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.email == "demo@example.com"))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email="demo@example.com",
            username="demo",
            full_name="Demo User",
            roles=["viewer", "operator", "admin"],
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


async def _get_or_create_user_from_token(
    db: AsyncSession,
    payload: TokenPayload,
) -> User:
    """Get or create user from OIDC token payload."""
    from sqlalchemy import select

    # Try to find by sub (Keycloak user ID)
    result = await db.execute(select(User).where(User.oauth_sub == payload.sub))
    user = result.scalar_one_or_none()

    if not user and payload.email:
        # Try to find by email
        result = await db.execute(select(User).where(User.email == payload.email))
        user = result.scalar_one_or_none()

    if not user:
        # Create new user
        roles = payload.realm_access.get("roles", ["viewer"])
        user = User(
            email=payload.email or f"{payload.sub}@example.com",
            username=payload.preferred_username or payload.sub,
            full_name=payload.name or payload.preferred_username or "Unknown",
            oauth_sub=payload.sub,
            roles=roles,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update user info
        user.full_name = payload.name or user.full_name
        user.username = payload.preferred_username or user.username
        user.roles = payload.realm_access.get("roles", user.roles)
        user.last_login = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return user


def require_roles(*required_roles: str):
    """Dependency factory for role-based access control."""
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        user_roles = set(user.roles)
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required roles: {required_roles}, user has: {user.roles}",
            )
        return user
    return role_checker


# Common role dependencies
require_viewer = require_roles("viewer", "operator", "admin")
require_operator = require_roles("operator", "admin")
require_admin = require_roles("admin")
# Session middleware for demo mode
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

