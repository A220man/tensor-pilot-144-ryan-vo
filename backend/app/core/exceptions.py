"""Custom exceptions and error handling."""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
import structlog

logger = structlog.get_logger()


class TensorPilotError(Exception):
    """Base exception for TensorPilot application."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR", details: dict = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(message)


class ValidationError(TensorPilotError):
    """Validation error."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "VALIDATION_ERROR", details)


class NotFoundError(TensorPilotError):
    """Resource not found error."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            f"{resource} not found: {identifier}",
            "NOT_FOUND",
            {"resource": resource, "identifier": identifier},
        )


class ConflictError(TensorPilotError):
    """Resource conflict error."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, "CONFLICT", details)


class UnauthorizedError(TensorPilotError):
    """Unauthorized error."""

    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, "UNAUTHORIZED")


class ForbiddenError(TensorPilotError):
    """Forbidden error."""

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, "FORBIDDEN")


class ExternalServiceError(TensorPilotError):
    """External service error."""

    def __init__(self, service: str, message: str, details: dict = None):
        super().__init__(
            f"{service} error: {message}",
            "EXTERNAL_SERVICE_ERROR",
            {"service": service, **(details or {})},
        )


async def tensorpilot_error_handler(request: Request, exc: TensorPilotError) -> JSONResponse:
    """Handle TensorPilot errors."""
    logger.error(
        "application_error",
        code=exc.code,
        message=exc.message,
        details=exc.details,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=400 if exc.code != "NOT_FOUND" else 404,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    logger.warning(
        "http_exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "HTTP_ERROR",
                "message": exc.detail,
                "details": {},
            }
        },
    )


async def validation_exception_handler(request: Request, exc: ValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    logger.warning(
        "validation_error",
        errors=exc.errors(),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": exc.errors()},
            }
        },
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle SQLAlchemy errors."""
    logger.error(
        "database_error",
        error=str(exc),
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "DATABASE_ERROR",
                "message": "A database error occurred",
                "details": {},
            }
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions."""
    logger.error(
        "unhandled_error",
        error=str(exc),
        type=type(exc).__name__,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred",
                "details": {},
            }
        },
    )