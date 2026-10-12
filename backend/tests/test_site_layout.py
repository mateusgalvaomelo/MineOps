from shapely.geometry import Point, shape
from app.geospatial import mine_boundary, site_position


def test_distributed_sites_and_routes_stay_inside_mine_and_assigned_area(client):
    sites = client.get("/api/sites").json()["items"]
    areas = {area["id"]: shape(area["geometry"]) for area in client.get("/api/areas").json()}
    perimeter = mine_boundary()
    assert len(sites) == 24
    assert len({round(site["latitude"], 6) for site in sites}) > 10
    for site in sites:
        point = Point(site["longitude"], site["latitude"])
        assert perimeter.covers(point)
        assert areas[site["area_id"]].covers(point)
        assert (site["longitude"], site["latitude"]) == site_position(site["id"] - 1)
    geography = client.get("/api/coverage").json()["features"]
    for road in [f for f in geography if f["properties"]["kind"] == "road"]:
        site = next(s for s in sites if s["id"] == road["properties"]["site_id"])
        assert areas[site["area_id"]].covers(shape(road["geometry"]))
