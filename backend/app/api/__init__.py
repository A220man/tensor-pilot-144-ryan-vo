"""API router aggregation."""

from fastapi import APIRouter

from app.api import health, auth, voices, generation, finetune

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(voices.router)
api_router.include_router(generation.router)
api_router.include_router(finetune.router)