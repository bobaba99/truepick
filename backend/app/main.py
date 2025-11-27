"""
FastAPI Interface Layer.

Zero business logic - simply accepts requests, calls the Graph,
and returns responses.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from .database import get_db, init_db
from .models import QuizSubmission, PurchaseQuery, AnalysisReport


@asynccontextmanager
async def app_lifespan(app: FastAPI):
    """
    Context manager to run database initialization on startup.

    Handles application lifecycle events.

    Args:
        app: FastAPI application instance

    Yields:
        None: Control to the application
    """
    # Startup logic
    init_db()
    yield
    # Shutdown logic (if needed)


# Initialize FastAPI app
app = FastAPI(
    title="Nopamine - Smart Purchase Analyzer",
    description="AI-powered tool to detect and analyze irrational spending",
    version="1.0.0",
    lifespan=app_lifespan
)


@app.post("/quiz", response_model=dict)
async def submit_quiz(
    quiz_data: QuizSubmission,
    db: Session = Depends(get_db)
):
    """
    Receives user answers, runs node_profiler, and saves result to database.

    Args:
        quiz_data: User's quiz responses
        db: Database session

    Returns:
        dict: Confirmation message with profile ID
    """
    pass


@app.post("/consult", response_model=AnalysisReport)
async def consult_purchase(
    purchase: PurchaseQuery,
    db: Session = Depends(get_db)
):
    """
    Receives a purchase plan, triggers the agents workflow,
    and returns the analysis report.

    Args:
        purchase: Details of the planned purchase
        db: Database session

    Returns:
        AnalysisReport: Complete analysis with verdict and reasoning
    """
    pass


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.

    Returns:
        dict: Service status
    """
    pass
