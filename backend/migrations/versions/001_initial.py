"""Initial normalized schema and indexed PostGIS projections."""

from alembic import op
from app.db import Base
from app import models  # noqa: F401

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    Base.metadata.create_all(connection)
    if connection.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        for table, kind in [
            ("network_sites", "Point"),
            ("connected_devices", "Point"),
            ("operational_areas", "Polygon"),
            ("coverage_areas", "Polygon"),
        ]:
            op.execute(f"ALTER TABLE {table} ADD COLUMN geom geometry({kind}, 4326)")
            op.execute(f"CREATE INDEX ix_{table}_geom ON {table} USING GIST (geom)")
        op.execute(
            "CREATE VIEW site_metrics AS SELECT DISTINCT ON (site_id) * FROM telemetry_samples ORDER BY site_id, timestamp DESC"
        )


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP VIEW IF EXISTS site_metrics")
    Base.metadata.drop_all(op.get_bind())
