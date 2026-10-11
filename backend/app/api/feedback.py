"""
Feedback API endpoints — auth-protected.
SECURITY FIX: every route previously allowed unauthenticated access, and
analyst_name could be spoofed by the caller.
"""
from fastapi import APIRouter, Depends, Query
from typing import List

from app.api.auth import get_current_user
from app.services.feedback_service import FeedbackService
from app.models.feedback_model import FeedbackResponse, FeedbackCreate

router = APIRouter()


@router.get("/", response_model=List[FeedbackResponse])
async def get_feedback(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    service: FeedbackService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    """Get all feedback entries"""
    return await service.get_feedback(skip=skip, limit=limit)


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback_by_id(
    feedback_id: int,
    service: FeedbackService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    """Get a specific feedback entry by ID"""
    return await service.get_feedback_by_id(feedback_id)


@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    feedback: FeedbackCreate,
    service: FeedbackService = Depends(),
    user: dict = Depends(get_current_user),            # AUTH GUARD — use real analyst name
):
    """Submit new feedback"""
    feedback = feedback.model_copy(update={"analyst_name": user.get("name")})
    return await service.create_feedback(feedback)


@router.get("/alert/{alert_id}")
async def get_alert_feedback(
    alert_id: int,
    service: FeedbackService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    """Get feedback for a specific alert"""
    return await service.get_feedback_by_alert(alert_id)


@router.get("/stats/summary")
async def get_feedback_stats(
    service: FeedbackService = Depends(),
    _user: dict = Depends(get_current_user),           # AUTH GUARD
):
    """Get feedback statistics"""
    return await service.get_feedback_statistics()
