import os
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///./mineops.db"), pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)
