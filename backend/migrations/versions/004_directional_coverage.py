"""Replace circular coverage with the union of three directional cell lobes."""

import json
from alembic import op
from sqlalchemy import text
from shapely.geometry import mapping
from app.geospatial import site_coverage

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    for row in connection.execute(text("SELECT id, longitude, latitude FROM network_sites")).mappings():
        geometry = json.dumps(mapping(site_coverage(row["longitude"], row["latitude"])))
        value = "CAST(:geometry AS JSON)" if connection.dialect.name == "postgresql" else ":geometry"
        connection.execute(
            text(f"UPDATE coverage_areas SET geometry = {value} WHERE site_id = :id"),
            {"geometry": geometry, "id": row["id"]},
        )
    if connection.dialect.name == "postgresql":
        op.execute("UPDATE coverage_areas SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326)")


def downgrade():
    # The previous circular model can be reconstructed, without touching inventory.
    from shapely.geometry import Point

    connection = op.get_bind()
    for row in connection.execute(text("SELECT id, longitude, latitude FROM network_sites")).mappings():
        geometry = json.dumps(mapping(Point(row["longitude"], row["latitude"]).buffer(0.007)))
        value = "CAST(:geometry AS JSON)" if connection.dialect.name == "postgresql" else ":geometry"
        connection.execute(
            text(f"UPDATE coverage_areas SET geometry = {value} WHERE site_id = :id"),
            {"geometry": geometry, "id": row["id"]},
        )
    if connection.dialect.name == "postgresql":
        op.execute("UPDATE coverage_areas SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326)")
