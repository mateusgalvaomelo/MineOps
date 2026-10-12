"""Align fictional operation with visible excavation reference, preserve entity IDs."""

import json
from types import SimpleNamespace
from alembic import op
from sqlalchemy import text
from shapely.geometry import Point, mapping, shape
from app.geospatial import area_geometry, site_position, site_coverage
from app.seed import route_for

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    old = {
        r["id"]: shape(json.loads(r["geometry"]) if isinstance(r["geometry"], str) else r["geometry"])
        for r in connection.execute(text("SELECT id,geometry FROM operational_areas")).mappings()
    }
    cast = "CAST(:geometry AS JSON)" if connection.dialect.name == "postgresql" else ":geometry"

    def translate(x, y, area_id):
        a, b, c, d = old[area_id].bounds
        new = area_geometry(area_id)
        e, f, g, h = new.bounds
        point = Point(e + (x - a) / (c - a) * (g - e), f + (y - b) / (d - b) * (h - f))
        return point if new.buffer(-0.00015).covers(point) else new.representative_point()

    for row in connection.execute(text("SELECT id,code,area_id,longitude,latitude FROM network_sites")).mappings():
        if 1 <= row["id"] <= 24 and row["code"] == f"SITE-LTE-{row['id']:03}":
            x, y = site_position(row["id"] - 1)
        else:
            point = translate(row["longitude"], row["latitude"], row["area_id"])
            x, y = point.x, point.y
        route = route_for(SimpleNamespace(longitude=x, latitude=y))
        connection.execute(
            text("UPDATE network_sites SET longitude=:x,latitude=:y WHERE id=:id"), {"x": x, "y": y, "id": row["id"]}
        )
        for device in connection.execute(
            text("SELECT id,route_phase FROM connected_devices WHERE site_id=:id"), {"id": row["id"]}
        ).mappings():
            point = route.interpolate(device["route_phase"], normalized=True)
            connection.execute(
                text("UPDATE connected_devices SET longitude=:x,latitude=:y WHERE id=:id"),
                {"x": point.x, "y": point.y, "id": device["id"]},
            )
        for table, geometry in [("coverage_areas", site_coverage(x, y)), ("simulation_routes", route)]:
            connection.execute(
                text(f"UPDATE {table} SET geometry={cast} WHERE site_id=:id"),
                {"geometry": json.dumps(mapping(geometry)), "id": row["id"]},
            )
    for request in connection.execute(text("SELECT id,area_id,longitude,latitude FROM adoption_requests")).mappings():
        point = translate(request["longitude"], request["latitude"], request["area_id"])
        connection.execute(
            text("UPDATE adoption_requests SET longitude=:x,latitude=:y WHERE id=:id"),
            {"x": point.x, "y": point.y, "id": request["id"]},
        )
    for identifier in old:
        connection.execute(
            text(f"UPDATE operational_areas SET geometry={cast} WHERE id=:id"),
            {"geometry": json.dumps(mapping(area_geometry(identifier))), "id": identifier},
        )
    if connection.dialect.name == "postgresql":
        for table in ["network_sites", "connected_devices"]:
            connection.execute(text(f"UPDATE {table} SET geom=ST_SetSRID(ST_MakePoint(longitude,latitude),4326)"))
        for table in ["operational_areas", "coverage_areas", "simulation_routes"]:
            connection.execute(text(f"UPDATE {table} SET geom=ST_SetSRID(ST_GeomFromGeoJSON(geometry::text),4326)"))


def downgrade():
    raise RuntimeError("Imagery alignment updates spatial reference; restore a backup to reverse it.")
