"""
Feedback API endpoints
"""
from fastapi import APIRouter, Depends
from typing import List

from app.services.feedback_service import FeedbackService
from app.models.feedback_model import FeedbackResponse, FeedbackCreate

router = APIRouter()


@router.get("/", response_model=List[FeedbackResponse])
async def get_feedback(
    skip: int = 0,
    limit: int = 50,
    service: FeedbackService = Depends()
):
    """Get all feedback entries"""
    return await service.get_feedback(skip=skip, limit=limit)


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback_by_id(feedback_id: int, service: FeedbackService = Depends()):
    """Get a specific feedback entry by ID"""
    return await service.get_feedback_by_id(feedback_id)


@router.post("/", response_model=FeedbackResponse)
async def create_feedback(feedback: FeedbackCreate, service: FeedbackService = Depends()):
    """Submit new feedback"""
    return await service.create_feedback(feedback)


@router.get("/alert/{alert_id}")
async def get_alert_feedback(alert_id: int, service: FeedbackService = Depends()):
    """Get feedback for a specific alert"""
    return await service.get_feedback_by_alert(alert_id)


@router.get("/stats/summary")
async def get_feedback_stats(service: FeedbackService = Depends()):
    """Get feedback statistics"""
    return await service.get_feedback_statistics()
