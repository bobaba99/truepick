"""
Data Transfer Objects (DTOs) and Database Schema.

Strict separation between:
- Pydantic models: API validation
- SQLAlchemy models: Database storage
"""

from typing import Optional
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


# ============================================================================
# Pydantic Schemas (API Validation)
# ============================================================================

class QuizSubmission(BaseModel):
    """
    Input data validation for the user's definition of irrationality.

    Represents the user's answers to the assessment quiz that defines
    their personal criteria for rational vs irrational spending.
    """
    pass


class PurchaseQuery(BaseModel):
    """
    Input data for the specific item the user wants to buy.

    Contains details about the planned purchase that will be analyzed
    by the agent system.
    """
    pass


class AnalysisReport(BaseModel):
    """
    The structured output containing the final verdict, reasoning,
    and psychological citation.

    This is returned to the user after the agent workflow completes.
    """
    pass


# ============================================================================
# SQLAlchemy Models (Database Storage)
# ============================================================================

class User(Base):
    """
    User table for storing primary key and metadata.

    Represents a user in the system with their basic information.
    """
    __tablename__ = "users"

    pass


class PsychographicProfile(Base):
    """
    Stores the summarized "Constitution" derived from the quiz.

    Example: "User is risk-averse but susceptible to scarcity tactics"

    This profile is used by agents to personalize the analysis.
    """
    __tablename__ = "psychographic_profiles"

    pass
