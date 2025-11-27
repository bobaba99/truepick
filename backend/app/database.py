"""
Database management module.
Manages the persistent state of the application using SQLAlchemy ORM.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Database configuration
SQLALCHEMY_DATABASE_URL = "sqlite:///./nopamine.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency injection provider for database sessions.

    Creates a thread-safe database session and guarantees closure
    after the request logic completes (even if errors occur).

    Yields:
        Generator: SQLAlchemy database session
    """
    pass


def init_db() -> None:
    """
    Idempotent initialization of the database.

    Checks for existence of tables and creates them if missing.
    Must be called on application startup.

    Returns:
        None
    """
    pass
