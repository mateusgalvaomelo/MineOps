"""Original synthetic mine scene and directional LTE geometry, not RF prediction."""

import math

from shapely import affinity
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union


def reference_point(x, y):
    # Public imagery reference extent, not a surveyed mine or real network inventory.
    return -43.54 + x * 0.09 / 1000, -20.154 - y * 0.072 / 800


REFERENCE_AREAS = [
    [(245, 40), (430, 0), (685, 8), (785, 55), (780, 110), (660, 140), (540, 125), (455, 205), (310, 230), (250, 180)],
    [(500, 205), (620, 200), (625, 260), (580, 310), (565, 390), (510, 420), (470, 355), (475, 270)],
    [
        (335, 415),
        (450, 405),
        (480, 435),
        (545, 455),
        (545, 525),
        (495, 555),
        (485, 625),
        (385, 670),
        (245, 660),
        (220, 590),
        (265, 475),
    ],
    [(580, 465), (715, 460), (790, 510), (940, 560), (945, 655), (890, 720), (765, 745), (620, 705), (570, 600)],
]


def area_geometry(area_id):
    return Polygon([reference_point(x, y) for x, y in REFERENCE_AREAS[area_id - 1]])


def mine_boundary():
    return unary_union([area_geometry(i) for i in range(1, 5)])


def site_position(index):
    """Distributed perimeter/access positions within the assigned operational area."""
    area, local = divmod(index, 6)
    anchors = [
        [(340, 90), (435, 40), (635, 70), (330, 175), (440, 150), (560, 115)],
        [(535, 250), (570, 230), (560, 290), (505, 340), (535, 385), (510, 290)],
        [(325, 520), (345, 600), (435, 480), (485, 490), (455, 580), (395, 635)],
        [(630, 580), (710, 575), (835, 610), (765, 680), (655, 655), (850, 680)],
    ]
    return reference_point(*anchors[area][local])


def sector_polygon(longitude, latitude, azimuth, radius=900):
    """Rounded lobe with north-clockwise bearing, using local meter conversion."""
    origin = (longitude, latitude)
    points = [origin]
    for step in range(65):
        offset = -55 + step * 110 / 64
        distance = radius * max(0, math.cos(math.radians(offset * 90 / 55))) ** 0.7
        bearing = math.radians(azimuth + offset)
        points.append(
            (
                longitude + distance * math.sin(bearing) / (111320 * math.cos(math.radians(latitude))),
                latitude + distance * math.cos(bearing) / 111320,
            )
        )
    points.append(origin)
    return Polygon(points).buffer(0)


def site_coverage(longitude, latitude, azimuths=(0, 120, 240)):
    # A small hub joins the three lobes into a valid single Polygon for PostGIS.
    return unary_union(
        [Point(longitude, latitude).buffer(0.0001), *[sector_polygon(longitude, latitude, a) for a in azimuths]]
    )


def feature(kind, geometry, **properties):
    return {"type": "Feature", "geometry": mapping(geometry), "properties": {"kind": kind, **properties}}


def coverage_features(sites, cells):
    features = []
    for cell in cells:
        site = sites[cell.site_id]
        for band, radius, signal in [("edge", 900, -110), ("moderate", 620, -95), ("strong", 340, -80)]:
            features.append(
                feature(
                    "coverage",
                    sector_polygon(site.longitude, site.latitude, cell.azimuth, radius),
                    site_id=site.id,
                    cell_id=cell.id,
                    sector=cell.sector,
                    azimuth=cell.azimuth,
                    band=band,
                    radius_m=radius,
                    estimated_rsrp=signal,
                    status=site.status,
                    code=site.code,
                )
            )
    return features


def mine_scene():
    from shapely.geometry import LineString

    features = [feature("mine-boundary", mine_boundary(), name="Illustrative excavation footprint")]
    features.append(feature("land", box(-43.54, -20.23, -43.45, -20.145)))
    for identifier in range(1, 5):
        area = area_geometry(identifier)
        center = area.centroid
        for ring in range(6):
            features.append(
                feature(
                    "contour", center.buffer(0.007 + ring * 0.0015, quad_segs=36).boundary, elevation=680 + ring * 20
                )
            )
        for bench in range(8):
            features.append(
                feature(
                    "pit",
                    affinity.scale(area, xfact=1 - bench * 0.095, yfact=1 - bench * 0.095),
                    bench=bench,
                    name="Synthetic excavation benches",
                )
            )
        for offset in range(3):
            pad = box(
                center.x - 0.0009 + offset * 0.0006,
                center.y - 0.0004,
                center.x - 0.0005 + offset * 0.0006,
                center.y + 0.0004,
            )
            features.append(feature("building", pad, name="Fictional support facility"))
        points = [site_position((identifier - 1) * 6 + i) for i in range(6)]
        features.append(feature("haul-road", LineString(points), name="Illustrative internal access"))
        features.append(feature("poi", center, name=f"Operational zone {identifier}", category="pit"))
    features.append(feature("water", Point(*reference_point(315, 620)).buffer(0.0008), name="Synthetic settling pond"))
    return features
