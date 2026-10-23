"""Audit logging service."""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, User

logger = structlog.get_logger()


class AuditService:
    """Service for audit logging."""

    async def log_action(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        user: Optional[User] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        db: Optional[AsyncSession] = None,
    ) -> None:
        """Log an audit event."""
        if db is None:
            # Fire-and-forget logging without DB session
            logger.info(
                "audit",
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                user_id=str(user.id) if user else None,
                details=details or {},
                ip_address=ip_address,
            )
            return

        audit_log = AuditLog(
            user_id=user.id if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.now(timezone.utc),
        )
        db.add(audit_log)
        # Don't commit here - let the caller commit

    async def get_logs(
        self,
        db: AsyncSession,
        user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[AuditLog], int]:
        """Get audit logs with filtering."""
        from sqlalchemy import select, func

        query = select(AuditLog)

        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action == action)
        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar_one()

        # Paginate
        query = query.order_by(AuditLog.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        logs = list(result.scalars().all())

        return logs, total


audit_service = AuditService()