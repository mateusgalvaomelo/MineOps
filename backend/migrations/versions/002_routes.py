"""Persisted deterministic routes and scenario catalog."""

from alembic import op
from sqlalchemy import inspect
from app.models import Route, Scenario

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    Route.__table__.create(connection, checkfirst=True)
    Scenario.__table__.create(connection, checkfirst=True)
    if connection.dialect.name == "postgresql":
        if "geom" not in [column["name"] for column in inspect(connection).get_columns("simulation_routes")]:
            op.execute("ALTER TABLE simulation_routes ADD COLUMN geom geometry(LineString, 4326)")
            op.execute("CREATE INDEX ix_simulation_routes_geom ON simulation_routes USING GIST (geom)")
        op.execute(
            "INSERT INTO simulation_routes (site_id, geometry) SELECT id, json_build_object('type','LineString','coordinates',json_build_array(json_build_array(longitude-.002,latitude-.001),json_build_array(longitude+.002,latitude-.001),json_build_array(longitude+.002,latitude+.001),json_build_array(longitude-.002,latitude+.001),json_build_array(longitude-.002,latitude-.001))) FROM network_sites ON CONFLICT (site_id) DO NOTHING"
        )
        op.execute("UPDATE simulation_routes SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)")


def downgrade():
    Scenario.__table__.drop(op.get_bind())
    Route.__table__.drop(op.get_bind())
