"""
Feedback data models
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class FeedbackBase(BaseModel):
    """Base feedback model"""
    alert_id: Optional[int] = Field(None, description="Related alert ID")
    incident_id: Optional[int] = Field(None, description="Related incident ID")
    feedback_type: str = Field(..., description="Type of feedback (false_positive, true_positive, improvement)")
    rating: Optional[int] = Field(None, ge=1, le=5, description="Rating 1-5")
    comments: str = Field(..., description="Feedback comments")
    analyst_name: Optional[str] = Field(None, description="Analyst name")


class FeedbackCreate(FeedbackBase):
    """Model for creating feedback"""
    pass


class FeedbackResponse(FeedbackBase):
    """Model for feedback response"""
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
