"""
Database configuration and connection management.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

# Convert sqlite:/// → sqlite+aiosqlite:///
database_url = settings.DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///")

engine = create_async_engine(
    database_url,
    echo=settings.DEBUG,
    future=True,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables registered on Base.metadata."""
    # Import ORM models so SQLAlchemy registers them before create_all
    from app.models.log_model import LogORM  # noqa: F401 — registers logs table
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
