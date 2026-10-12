"""Preserve sample weights when compacting hourly telemetry."""

from alembic import op
from sqlalchemy import inspect

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    if "sample_count" not in [column["name"] for column in inspect(connection).get_columns("telemetry_samples")]:
        op.execute("ALTER TABLE telemetry_samples ADD COLUMN sample_count INTEGER NOT NULL DEFAULT 1")
    if connection.dialect.name == "postgresql":
        op.execute(
            "CREATE OR REPLACE VIEW site_metrics AS SELECT DISTINCT ON (site_id) * FROM telemetry_samples ORDER BY site_id, timestamp DESC"
        )


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP VIEW site_metrics")
    op.drop_column("telemetry_samples", "sample_count")
