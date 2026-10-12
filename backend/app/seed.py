import math
from datetime import timedelta

import numpy as np
from faker import Faker
from shapely.geometry import LineString, mapping
from sqlalchemy import func, select, text

from .db import utcnow
from .geospatial import site_coverage, site_position, area_geometry
from .models import (
    Adoption,
    AdoptionStage,
    Alarm,
    Application,
    ApplicationDevice,
    Area,
    Cell,
    Coverage,
    Device,
    Equipment,
    Incident,
    IncidentEvent,
    Metric,
    Operation,
    Setting,
    Site,
    Route,
    Scenario,
)

STAGES = [
    "Request",
    "Initial Assessment",
    "Coverage Analysis",
    "Technical Design",
    "Planning",
    "Deployment",
    "Validation",
    "Operational Handover",
]
APPLICATIONS = [
    "Fleet Management",
    "Industrial Telemetry",
    "Video Monitoring",
    "Dispatch System",
    "Environmental Monitoring",
    "Asset Tracking",
    "Predictive Maintenance",
    "Remote Inspection",
    "Worker Safety",
    "Equipment Diagnostics",
    "Mobile Operations",
    "IoT Connectivity",
]
CATEGORIES = [
    "Haul truck",
    "Excavator",
    "Drill rig",
    "Light vehicle",
    "Camera",
    "Sensor",
    "Industrial tablet",
    "IoT gateway",
]


def route_for(site):
    x, y = site.longitude, site.latitude
    return LineString(
        [
            (x - 0.00065, y - 0.00045),
            (x + 0.00065, y - 0.00045),
            (x + 0.00065, y + 0.00045),
            (x - 0.00065, y + 0.00045),
            (x - 0.00065, y - 0.00045),
        ]
    )


def add_site(db, code, name, area_id, longitude, latitude, identifier=None):
    site = Site(id=identifier, code=code, name=name, area_id=area_id, longitude=longitude, latitude=latitude)
    db.add(site)
    db.flush()
    db.add_all([Cell(site_id=site.id, sector=i + 1, azimuth=i * 120) for i in range(3)])
    db.add(Coverage(site_id=site.id, geometry=mapping(site_coverage(longitude, latitude))))
    db.add(Route(site_id=site.id, geometry=mapping(route_for(site))))
    return site


def stage_plan(db, request, days):
    for i, name in enumerate(STAGES):
        db.add(
            AdoptionStage(
                request_id=request.id,
                number=i,
                name=name,
                planned_at=request.created_at + timedelta(days=days * (i + 1)),
                completed_at=request.created_at + timedelta(days=i) if i < request.stage else None,
            )
        )


def sync_geometries(db):
    if db.bind.dialect.name != "postgresql":
        return
    for table in ["network_sites", "connected_devices"]:
        db.execute(text(f"UPDATE {table} SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)"))
    for table in ["operational_areas", "coverage_areas", "simulation_routes"]:
        db.execute(text(f"UPDATE {table} SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)"))


def seed(db):
    if db.scalar(select(func.count()).select_from(Site)):
        return
    rng = np.random.default_rng(2026)
    faker = Faker()
    faker.seed_instance(2026)
    now = utcnow()
    db.add(Operation(id=1, name="Aurora Mining · Synthetic Operations"))
    db.flush()
    names = ["North Pit", "Processing Plant", "Equipment Yard", "Logistics Hub"]
    for i, name in enumerate(names):
        db.add(Area(id=i + 1, operation_id=1, name=name, geometry=mapping(area_geometry(i + 1))))
    db.flush()
    for i, name in enumerate(APPLICATIONS):
        db.add(
            Application(
                id=i + 1,
                name=name,
                category=["Operations", "Telemetry", "Video"][i % 3],
                description=f"Original synthetic {name.lower()} application for the demo operation.",
                area_id=i % 4 + 1,
            )
        )
    db.flush()
    sites = []
    for i in range(24):
        area = i // 6
        x, y = site_position(i)
        sites.append(
            add_site(
                db, f"SITE-LTE-{i + 1:03}", f"{names[area]} / Sector {i % 6 + 1}", area + 1, x, y, identifier=i + 1
            )
        )
    db.flush()
    assignments = [14] * 42
    others = [s.id for s in sites if s.id != 14]
    assignments += [others[i % len(others)] for i in range(458)]
    for i, site_id in enumerate(assignments):
        site = sites[site_id - 1]
        point = route_for(site).interpolate((i % 100) / 100, normalized=True)
        app_id = (1 if i < 24 else 2 if i < 36 else 3) if i < 42 else i % 12 + 1
        device = Device(
            id=i + 1,
            name=f"{CATEGORIES[i % 8]} {i + 1:03}",
            category=CATEGORIES[i % 8],
            site_id=site_id,
            area_id=site.area_id,
            latitude=point.y,
            longitude=point.x,
            route_phase=(i % 100) / 100,
            rsrp=float(rng.uniform(-105, -70)),
            rsrq=float(rng.uniform(-14, -7)),
            sinr=float(rng.uniform(10, 28)),
            data_mb=float(rng.uniform(20, 900)),
        )
        db.add(device)
        db.flush()
        db.add(ApplicationDevice(application_id=app_id, device_id=device.id))
    for i in range(150):
        db.add(
            Equipment(
                site_id=i % 24 + 1,
                name=f"Infrastructure {i + 1:03}",
                category=["eNodeB", "Router", "Switch", "UPS", "Backhaul", "Antenna"][i % 6],
                serial=f"SYNTH-{faker.bothify('????-########')}",
            )
        )
    counts = {site.id: assignments.count(site.id) for site in sites}
    metrics = []
    for hour in range(168):
        timestamp = now - timedelta(hours=168 - hour)
        for site in sites:
            utilization = float(np.clip(42 + 18 * math.sin(hour / 5 + site.id) + rng.normal(0, 4), 8, 82))
            available = 0 if (hour + site.id * 7) % 121 == 0 else 1
            metrics.append(
                Metric(
                    site_id=site.id,
                    timestamp=timestamp,
                    cpu=utilization * 0.8,
                    memory=45 + site.id % 20,
                    latency=12 + utilization / 8,
                    packet_loss=0.15,
                    uplink=utilization * 0.22 * available,
                    downlink=utilization * 0.85 * available,
                    utilization=utilization if available else 0,
                    users=counts[site.id] * available,
                    available=available,
                )
            )
    db.add_all(metrics)
    for i in range(40):
        opened = now - timedelta(hours=160 - i * 3)
        incident = Incident(
            site_id=i % 24 + 1,
            title=f"Historical synthetic incident {i + 1:03}",
            severity=["Critical", "Major", "Minor", "Warning", "Info"][i % 5],
            status="Closed",
            opened_at=opened,
            resolved_at=opened + timedelta(minutes=15 + i * 2),
        )
        db.add(incident)
        db.flush()
        db.add(IncidentEvent(incident_id=incident.id, timestamp=opened, action="Opened in synthetic historical seed"))
        db.add(
            IncidentEvent(
                incident_id=incident.id, timestamp=incident.resolved_at, action="Resolved and closed in historical seed"
            )
        )
    for i in range(20):
        site = sites[i]
        request = Adoption(
            title=f"{names[i % 4]} connectivity extension {i + 1:02}",
            type=["New coverage", "Capacity expansion", "Application onboarding"][i % 3],
            area_id=site.area_id,
            application_id=i % 12 + 1,
            latitude=site.latitude,
            longitude=site.longitude,
            stage=i % 7,
            created_at=now - timedelta(days=i),
            desired_at=now + timedelta(days=16 - i),
            priority=["High", "Medium", "Low"][i % 3],
        )
        db.add(request)
        db.flush()
        stage_plan(db, request, 2)
    db.add_all(
        [
            Setting(key="simulation", value={"running": True, "speed": 1, "tick": 0, "seed": 2026}),
            Setting(key="preferences", value={"stage_days": 2, "retention_days": 14, "stale_seconds": 20}),
        ]
    )
    labels = {
        "offline": "Site Offline",
        "backhaul": "Backhaul Down",
        "power": "Power Failure",
        "congestion": "Capacity Congestion",
        "devices": "Device Growth",
        "signal": "Signal Degradation",
        "latency": "High Latency",
        "packet_loss": "Packet Loss",
        "telemetry": "Telemetry Unavailable",
        "recover": "Site Recovery",
    }
    for key, name in labels.items():
        db.add(Scenario(key=key, name=name, description=f"Original persisted synthetic {name.lower()} scenario"))
    db.flush()
    # Initial demo has one degraded site, and no fabricated outage for site 014.
    sites[5].status = "degraded"
    sites[5].scenario = "congestion"
    db.add(
        Alarm(
            site_id=6, type="Capacity congestion", severity="Major", description="Synthetic capacity threshold exceeded"
        )
    )
    sync_geometries(db)
    if db.bind.dialect.name == "postgresql":
        from .db import Base

        for table in Base.metadata.sorted_tables:
            if "id" in table.c:
                db.execute(
                    text(
                        f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), COALESCE((SELECT MAX(id) FROM {table.name}), 1), EXISTS(SELECT 1 FROM {table.name}))"
                    )
                )
    db.flush()
