from shapely.geometry import Point
from app.geospatial import area_geometry, site_position


def test_reference_footprints_are_valid_and_all_sites_inside_excavation_zones():
    for index in range(24):
        area = area_geometry(index // 6 + 1)
        assert area.is_valid
        assert area.covers(Point(*site_position(index)))
