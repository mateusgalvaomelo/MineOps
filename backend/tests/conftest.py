import os

os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite://")
os.environ["SIMULATION_INTERVAL"] = "1000"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import text
from alembic import command
from alembic.config import Config

from app import main
from app import db as db_module
from app.db import Base


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("TEST_DATABASE_URL")
    if test_url:
        if not test_url.rsplit("/", 1)[-1].startswith("mineops_test"):
            raise RuntimeError("PostgreSQL tests require a dedicated mineops_test database")
        engine = create_engine(test_url)
        monkeypatch.setattr(db_module, "engine", engine)
        command.upgrade(Config("alembic.ini"), "head")
        with engine.begin() as connection:
            tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
            connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "Session", sessions)
    with TestClient(main.app) as test_client:
        yield test_client
    engine.dispose()
