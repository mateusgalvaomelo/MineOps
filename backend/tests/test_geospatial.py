import math
import pytest

from shapely.geometry import shape, Point
from app.geospatial import sector_polygon, site_coverage


def test_directional_petals_are_valid_and_follow_azimuth():
    longitude, latitude = -43.5, -20.15
    north = sector_polygon(longitude, latitude, 0)
    assert north.is_valid and north.area > 0
    assert north.centroid.y > latitude
    east = sector_polygon(longitude, latitude, 90)
    assert east.centroid.x > longitude
    union = site_coverage(longitude, latitude)
    assert union.is_valid and union.geom_type == "Polygon"
    assert union.covers(Point(longitude, latitude))
    assert union.bounds[3] - latitude == pytest.approx(900 / 111320, rel=0.01)
    # A directional model leaves a gap between antenna lobes, unlike a circle.
    bearing = math.radians(60)
    gap = Point(
        longitude + 850 * math.sin(bearing) / (111320 * math.cos(math.radians(latitude))),
        latitude + 850 * math.cos(bearing) / 111320,
    )
    assert not union.covers(gap)


def test_map_api_has_72_sectors_and_three_signal_bands(client):
    features = client.get("/api/coverage").json()["features"]
    coverage = [f for f in features if f["properties"]["kind"] == "coverage"]
    assert len(coverage) == 216
    assert len({f["properties"]["cell_id"] for f in coverage}) == 72
    assert {f["properties"]["band"] for f in coverage} == {"strong", "moderate", "edge"}
    assert all(shape(f["geometry"]).is_valid for f in coverage)
    assert {"pit", "contour", "water", "building", "haul-road", "poi"} <= {f["properties"]["kind"] for f in features}
    client.post("/api/simulation/scenario", json={"site_id": 14, "scenario": "backhaul"})
    updated = client.get("/api/coverage").json()["features"]
    assert all(
        f["properties"]["status"] == "offline"
        for f in updated
        if f["properties"]["kind"] == "coverage" and f["properties"]["site_id"] == 14
    )


def test_signal_probe_uses_geometry_and_ignores_offline_service(client):
    site = client.get("/api/sites/14").json()["site"]
    query = f"longitude={site['longitude']}&latitude={site['latitude']}"
    response = client.get("/api/coverage/probe?" + query)
    assert response.status_code == 200
    assert response.json()["estimated"] is True
    assert response.json()["estimated_rsrp"] == -80
    client.post("/api/simulation/scenario", json={"site_id": 14, "scenario": "backhaul"})
    result = client.get("/api/coverage/probe?" + query).json()
    assert result["site_code"] != "SITE-LTE-014"
    assert result["offline_footprints"] >= 1
