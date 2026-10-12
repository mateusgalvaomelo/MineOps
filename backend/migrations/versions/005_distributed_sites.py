"""Redistribute seeded towers while preserving devices and operational records."""

import json

from alembic import op
from sqlalchemy import text
from shapely.geometry import mapping
from app.geospatial import site_position, site_coverage
from app.seed import route_for
from types import SimpleNamespace

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def relocate(connection, original=False):
    for row in connection.execute(
        text("SELECT id,code,longitude,latitude FROM network_sites WHERE id BETWEEN 1 AND 24")
    ).mappings():
        if row["code"] != f"SITE-LTE-{row['id']:03}":
            continue
        index = row["id"] - 1
        area = index // 6
        x, y = (
            (
                -43.525 + (area % 2) * 0.034 + (index % 3) * 0.009,
                -20.165 + (area // 2) * 0.026 + ((index % 6) // 3) * 0.011,
            )
            if original
            else site_position(index)
        )
        delta = {"dx": x - row["longitude"], "dy": y - row["latitude"], "id": row["id"]}
        connection.execute(
            text("UPDATE connected_devices SET longitude=longitude+:dx, latitude=latitude+:dy WHERE site_id=:id"), delta
        )
        connection.execute(
            text("UPDATE network_sites SET longitude=:x,latitude=:y WHERE id=:id"), {"x": x, "y": y, "id": row["id"]}
        )
        value = "CAST(:geometry AS JSON)" if connection.dialect.name == "postgresql" else ":geometry"
        for table, geometry in [
            ("coverage_areas", site_coverage(x, y)),
            ("simulation_routes", route_for(SimpleNamespace(longitude=x, latitude=y))),
        ]:
            connection.execute(
                text(f"UPDATE {table} SET geometry={value} WHERE site_id=:id"),
                {"geometry": json.dumps(mapping(geometry)), "id": row["id"]},
            )
    if connection.dialect.name == "postgresql":
        for table in ["network_sites", "connected_devices"]:
            connection.execute(text(f"UPDATE {table} SET geom=ST_SetSRID(ST_MakePoint(longitude,latitude),4326)"))
        for table in ["coverage_areas", "simulation_routes"]:
            connection.execute(text(f"UPDATE {table} SET geom=ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326)"))


def upgrade():
    relocate(op.get_bind())


def downgrade():
    relocate(op.get_bind(), original=True)
