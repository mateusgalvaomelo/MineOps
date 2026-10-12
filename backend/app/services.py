import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from shapely.geometry import Point, shape
from sqlalchemy import delete, func, select, text

from .db import utcnow
from .ingestion import ingest
from .models import (
    Adoption,
    AdoptionStage,
    Alarm,
    Application,
    ApplicationDevice,
    Area,
    Audit,
    Device,
    Event,
    Incident,
    Metric,
    Position,
    Setting,
    Site,
    Route,
)
from .seed import STAGES, add_site, route_for, sync_geometries


def serialize(row):
    values = {column.name: getattr(row, column.name) for column in row.__table__.columns if column.name != "geom"}
    return {key: aware(value) if isinstance(value, datetime) else value for key, value in values.items()}


def get(db, model, identifier):
    row = db.get(model, identifier)
    if row is None:
        raise HTTPException(404, f"{model.__name__} not found")
    return row


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def audit(db, action, details):
    db.add(Audit(action=action, details=details))


def latest_metrics(db):
    latest = select(Metric.site_id, func.max(Metric.timestamp).label("timestamp")).group_by(Metric.site_id).subquery()
    return {
        row.site_id: row
        for row in db.scalars(
            select(Metric).join(latest, (Metric.site_id == latest.c.site_id) & (Metric.timestamp == latest.c.timestamp))
        )
    }


def site_rows(db):
    metrics = latest_metrics(db)
    areas = {a.id: a.name for a in db.scalars(select(Area))}
    counts = dict(db.execute(select(Device.site_id, func.count()).group_by(Device.site_id)).all())
    alarms = dict(
        db.execute(select(Alarm.site_id, func.count()).where(Alarm.status != "Cleared").group_by(Alarm.site_id)).all()
    )
    return [
        {
            **serialize(s),
            "area": areas[s.area_id],
            "devices": counts.get(s.id, 0),
            "alarms": alarms.get(s.id, 0),
            "metrics": serialize(metrics[s.id]) if s.id in metrics else None,
        }
        for s in db.scalars(select(Site).order_by(Site.id))
    ]


def impact(db, site_id):
    site = get(db, Site, site_id)
    devices = list(db.scalars(select(Device).where(Device.site_id == site_id)))
    # Degraded sites affect service quality; offline sites disconnect equipment.
    affected = devices if site.status in ["offline", "degraded"] else []
    ids = [d.id for d in affected]
    applications = []
    if ids:
        grouped = db.execute(
            select(Application.id, Application.name, func.count(func.distinct(ApplicationDevice.device_id)))
            .join(ApplicationDevice)
            .where(ApplicationDevice.device_id.in_(ids))
            .group_by(Application.id, Application.name)
        ).all()
        applications = [{"id": a, "name": name, "devices": count} for a, name, count in grouped]
    area_ids = sorted({d.area_id for d in affected})
    alarms = list(
        db.scalars(select(Alarm).where(Alarm.site_id == site_id, Alarm.status != "Cleared").order_by(Alarm.id.desc()))
    )
    return {
        "site_id": site_id,
        "site_code": site.code,
        "scenario": site.scenario,
        "status": site.status,
        "severity": alarms[0].severity if alarms else "Info",
        "incident": alarms[0].type if alarms else "No active condition",
        "affected_devices": len(affected),
        "affected_applications": len(applications),
        "affected_areas": len(area_ids),
        "applications": sorted(applications, key=lambda a: -a["devices"]),
        "areas": [serialize(get(db, Area, i)) for i in area_ids],
        "device_ids": ids,
        "estimated": True,
        "method": "Current serving-site dependency; quality degradation or disconnection, without automatic handover.",
    }


def application_rows(db, site_id=None, area_id=None):
    result = []
    for app in db.scalars(select(Application).order_by(Application.id)):
        devices = list(
            db.scalars(select(Device).join(ApplicationDevice).where(ApplicationDevice.application_id == app.id))
        )
        devices = [
            d for d in devices if (not site_id or d.site_id == site_id) and (not area_id or d.area_id == area_id)
        ]
        affected = sum(d.status != "connected" for d in devices)
        result.append(
            {
                **serialize(app),
                "devices": len(devices),
                "affected_devices": affected,
                "status": "Impacted" if affected else "Healthy",
                "site_ids": sorted({d.site_id for d in devices}),
                "data_mb": round(sum(d.data_mb for d in devices), 2),
            }
        )
    return result


def device_rows(db, site_id=None, search=None, status=None, area_id=None):
    query = select(Device)
    if site_id:
        query = query.where(Device.site_id == site_id)
    if search:
        query = query.where(Device.name.ilike(f"%{search}%"))
    if status:
        query = query.where(Device.status == status)
    if area_id:
        query = query.where(Device.area_id == area_id)
    links = {}
    for device_id, app_name in db.execute(
        select(ApplicationDevice.device_id, Application.name).join(
            Application, Application.id == ApplicationDevice.application_id
        )
    ):
        links.setdefault(device_id, []).append(app_name)
    return [{**serialize(d), "applications": links.get(d.id, [])} for d in db.scalars(query.order_by(Device.id))]


def telemetry(db, timestamp=None):
    state = get(db, Setting, "simulation")
    tick = state.value["tick"] + 1
    state.value = {**state.value, "tick": tick}
    now = timestamp or utcnow()
    sites = list(db.scalars(select(Site)))
    devices = list(db.scalars(select(Device)))
    counts = {}
    for device in devices:
        counts[device.site_id] = counts.get(device.site_id, 0) + 1
    for site in sites:
        if site.scenario == "telemetry":
            continue
        available = site.status != "offline"
        utilization = min(100, 42 + 16 * math.sin(tick / 7 + site.id) + max(0, counts.get(site.id, 0) - 25) * 0.35)
        if site.scenario in ["congestion", "devices"]:
            utilization = 94 + 3 * math.sin(tick)
        latency = 12 + utilization / 8 if available else 0
        loss = 0.15 if available else 100
        if site.scenario in ["congestion", "latency"]:
            latency = 130 + tick % 15
        if site.scenario == "packet_loss":
            loss = 12
        ingest(
            db,
            dict(
                site_id=site.id,
                timestamp=now,
                cpu=round(utilization * 0.8, 2),
                memory=45 + site.id % 20,
                latency=round(latency, 2),
                packet_loss=loss,
                uplink=round(utilization / 100 * site.capacity_mbps * 0.2, 2) if available else 0,
                downlink=round(utilization / 100 * site.capacity_mbps * 0.8, 2) if available else 0,
                utilization=round(utilization, 2) if available else 0,
                users=counts.get(site.id, 0) if available else 0,
                available=int(available),
            ),
        )
        site.updated_at = now
    by_id = {s.id: s for s in sites}
    routes = {r.site_id: shape(r.geometry) for r in db.scalars(select(Route))}
    for device in devices:
        site = by_id[device.site_id]
        device.status = (
            "disconnected" if site.status == "offline" else "degraded" if site.status == "degraded" else "connected"
        )
        device.rsrp = -120 if site.scenario == "signal" else -85 - device.id % 20
        device.rsrq = -18 if site.scenario == "signal" else -10
        device.sinr = 2 if site.scenario == "signal" else 20
        if device.status != "disconnected":
            device.last_connection = now
            device.data_mb = round(device.data_mb + 0.02 * state.value["speed"], 3)
        if device.category in ["Haul truck", "Excavator", "Drill rig", "Light vehicle"]:
            device.route_phase = (device.route_phase + 0.007 * state.value["speed"]) % 1
            point = routes.get(site.id, route_for(site)).interpolate(device.route_phase, normalized=True)
            device.latitude, device.longitude = point.y, point.x
            if tick % 12 == 0:
                db.add(Position(device_id=device.id, timestamp=now, latitude=point.y, longitude=point.x))
    db.flush()
    sync_geometries(db)
    if tick % 12 == 0:
        retain(db)


def retain(db):
    days = get(db, Setting, "preferences").value["retention_days"]
    cutoff = utcnow() - timedelta(days=days)
    db.execute(delete(Metric).where(Metric.timestamp < cutoff))
    db.execute(delete(Position).where(Position.timestamp < cutoff))
    db.execute(delete(Event).where(Event.timestamp < cutoff))
    # Operational transactions remain auditable; telemetry is downsampled after 24h.
    old = utcnow() - timedelta(hours=24)
    rows = list(db.scalars(select(Metric).where(Metric.timestamp < old).order_by(Metric.timestamp)))
    buckets = {}
    for row in rows:
        key = (row.site_id, aware(row.timestamp).replace(minute=0, second=0, microsecond=0))
        buckets.setdefault(key, []).append(row)
    for bucket in buckets.values():
        if len(bucket) < 2:
            continue
        first = bucket[0]
        for field in [
            "cpu",
            "memory",
            "latency",
            "packet_loss",
            "uplink",
            "downlink",
            "utilization",
            "users",
            "available",
        ]:
            value = sum(getattr(m, field) * m.sample_count for m in bucket) / sum(m.sample_count for m in bucket)
            # available stores sampled minutes as a fraction for aggregate availability.
            setattr(first, field, round(value) if field == "users" else value)
        first.sample_count = sum(m.sample_count for m in bucket)
        for row in bucket[1:]:
            db.delete(row)


def scenario(db, site_id, name):
    site = get(db, Site, site_id)
    existing = list(db.scalars(select(Alarm).where(Alarm.site_id == site_id, Alarm.status != "Cleared")))
    if name == "recover":
        site.status, site.scenario = "operational", "normal"
        for alarm in existing:
            alarm.status, alarm.cleared_at = "Cleared", utcnow()
    else:
        if site.scenario == name:
            return impact(db, site_id)
        for alarm in existing:
            alarm.status, alarm.cleared_at = "Cleared", utcnow()
        site.status = "offline" if name in ["offline", "backhaul", "power"] else "degraded"
        site.scenario = name
        labels = {
            "offline": "Site offline",
            "backhaul": "Backhaul Down",
            "power": "Power failure",
            "congestion": "Capacity congestion",
            "devices": "Device capacity exceeded",
            "signal": "Signal degradation",
            "latency": "High latency",
            "packet_loss": "High packet loss",
            "telemetry": "Telemetry unavailable",
        }
        db.add(
            Alarm(
                site_id=site_id,
                type=labels[name],
                severity="Critical"
                if site.status == "offline"
                else "Major"
                if name in ["congestion", "devices"]
                else "Minor"
                if name in ["signal", "packet_loss"]
                else "Warning",
                description=f"Synthetic {labels[name].lower()} at {site.code}",
            )
        )
        if name == "devices":
            if db.scalar(select(func.count()).select_from(Device)) + 25 > 1500:
                raise HTTPException(409, "Demo device limit reached; reset scenario")
            for i in range(25):
                device = Device(
                    name=f"Synthetic added device {site_id}/{i + 1}",
                    category="IoT gateway",
                    site_id=site_id,
                    area_id=site.area_id,
                    latitude=site.latitude,
                    longitude=site.longitude,
                )
                db.add(device)
                db.flush()
                db.add(ApplicationDevice(application_id=2, device_id=device.id))
    telemetry(db)
    db.add(Event(site_id=site_id, action=name, details={"site_code": site.code}))
    audit(db, "simulation.scenario", {"site_id": site_id, "scenario": name})
    db.flush()
    return impact(db, site_id)


def overview(db, hours=24, site_id=None, area_id=None, severity=None):
    sites = site_rows(db)
    sites = [s for s in sites if (not site_id or s["id"] == site_id) and (not area_id or s["area_id"] == area_id)]
    ids = [s["id"] for s in sites]
    samples = list(
        db.scalars(
            select(Metric)
            .where(Metric.timestamp >= utcnow() - timedelta(hours=hours), Metric.site_id.in_(ids))
            .order_by(Metric.timestamp)
        )
    )
    site_hours = {}
    for m in samples:
        hour = aware(m.timestamp).replace(minute=0, second=0, microsecond=0).isoformat()
        site_hours.setdefault((hour, m.site_id), []).append(m)
    buckets = {}
    for (hour, identifier), rows in site_hours.items():
        values = {
            field: sum(getattr(m, field) * m.sample_count for m in rows) / sum(m.sample_count for m in rows)
            for field in ["available", "uplink", "downlink", "utilization", "latency", "users"]
        }
        buckets.setdefault(hour, []).append(values)
    history = [
        {
            "time": key,
            "availability": round(sum(m["available"] for m in rows) / len(rows) * 100, 2),
            "throughput": round(sum(m["uplink"] + m["downlink"] for m in rows), 2),
            "uplink": round(sum(m["uplink"] for m in rows), 2),
            "downlink": round(sum(m["downlink"] for m in rows), 2),
            "users": round(sum(m["users"] for m in rows)),
            "utilization": round(sum(m["utilization"] for m in rows) / len(rows), 2),
            "latency": round(sum(m["latency"] for m in rows) / len(rows), 2),
        }
        for key, rows in sorted(buckets.items())
    ]
    normalized_availability = [
        sum(m.available * m.sample_count for m in rows) / sum(m.sample_count for m in rows)
        for rows in site_hours.values()
    ]
    alarms_query = select(Alarm).where(Alarm.site_id.in_(ids), Alarm.status != "Cleared")
    if severity:
        alarms_query = alarms_query.where(Alarm.severity == severity)
    alarms = list(db.scalars(alarms_query))
    incidents = list(db.scalars(select(Incident).where(Incident.site_id.in_(ids))))
    resolved = [i for i in incidents if i.resolved_at and aware(i.opened_at) >= utcnow() - timedelta(hours=hours)]
    acknowledged = [
        a
        for a in db.scalars(
            select(Alarm).where(
                Alarm.site_id.in_(ids),
                Alarm.acknowledged_at.is_not(None),
                Alarm.started_at >= utcnow() - timedelta(hours=hours),
            )
        )
    ]
    devices = list(db.scalars(select(Device).where(Device.site_id.in_(ids))))
    latest = [s["metrics"] for s in sites if s["metrics"]]
    stale = get(db, Setting, "preferences").value["stale_seconds"]
    return {
        "total_sites": len(sites),
        "operational": sum(s["status"] == "operational" for s in sites),
        "degraded": sum(s["status"] == "degraded" for s in sites),
        "offline": sum(s["status"] == "offline" for s in sites),
        "maintenance": sum(s["status"] == "maintenance" for s in sites),
        "availability": round(sum(normalized_availability) / len(normalized_availability) * 100, 2)
        if normalized_availability
        else 0,
        "connected_devices": sum(d.status != "disconnected" for d in devices),
        "total_devices": len(devices),
        "active_alarms": len(alarms),
        "critical_incidents": sum(
            i.severity == "Critical" and i.status not in ["Resolved", "Closed"] for i in incidents
        ),
        "utilization": round(sum(m["utilization"] for m in latest) / len(latest), 1) if latest else 0,
        "throughput": round(sum(m["uplink"] + m["downlink"] for m in latest), 1),
        "latency": round(sum(m["latency"] for m in latest) / len(latest), 1) if latest else 0,
        "adoption_pending": db.scalar(select(func.count()).select_from(Adoption).where(Adoption.stage < 8)),
        "mttr_minutes": round(
            sum((aware(i.resolved_at) - aware(i.opened_at)).total_seconds() / 60 for i in resolved) / len(resolved), 1
        )
        if resolved
        else 0,
        "mtta_minutes": round(
            sum((aware(a.acknowledged_at) - aware(a.started_at)).total_seconds() / 60 for a in acknowledged)
            / len(acknowledged),
            1,
        )
        if acknowledged
        else 0,
        "downtime_sample_hours": round(sum(1 - m for m in normalized_availability), 2),
        "history": history,
        "status_distribution": [
            {"name": name, "value": sum(s["status"] == name for s in sites)}
            for name in ["operational", "degraded", "offline", "maintenance"]
        ],
        "alarm_distribution": [
            {"name": name, "value": sum(a.severity == name for a in alarms)}
            for name in ["Critical", "Major", "Minor", "Warning", "Info"]
        ],
        "device_distribution": [
            {"name": name, "value": sum(d.category == name for d in devices)}
            for name in sorted({d.category for d in devices})
        ],
        "top_sites": sorted(sites, key=lambda s: -(s["metrics"] or {}).get("utilization", 0))[:10],
        "area_utilization": [
            {
                "name": area.name,
                "value": round(
                    sum((s["metrics"] or {}).get("utilization", 0) for s in sites if s["area_id"] == area.id)
                    / max(1, sum(s["area_id"] == area.id for s in sites)),
                    1,
                ),
            }
            for area in db.scalars(select(Area))
        ],
        "stale_sites": sum(
            not s["metrics"] or (utcnow() - aware(s["metrics"]["timestamp"])).total_seconds() > stale for s in sites
        ),
        "updated_at": max((m["timestamp"] for m in latest), default=None),
    }


def adoption_rows(db):
    rows = []
    for request in db.scalars(select(Adoption).order_by(Adoption.id.desc())):
        stages = list(
            db.scalars(
                select(AdoptionStage).where(AdoptionStage.request_id == request.id).order_by(AdoptionStage.number)
            )
        )
        current = stages[min(request.stage, 7)]
        deviation = (
            (aware(current.completed_at) if current.completed_at else utcnow()) - aware(current.planned_at)
        ).total_seconds() / 86400
        rows.append(
            {
                **serialize(request),
                "stage_name": STAGES[request.stage] if request.stage < 8 else "Completed",
                "progress": round(request.stage / 8 * 100),
                "overdue": deviation > 0 and request.stage < 8,
                "deviation_days": round(deviation, 1),
                "stages": [serialize(s) for s in stages],
            }
        )
    return rows


def advance(db, request_id):
    request = get(db, Adoption, request_id)
    if request.stage >= 8:
        raise HTTPException(409, "Request already completed")
    stage = db.scalar(
        select(AdoptionStage).where(AdoptionStage.request_id == request_id, AdoptionStage.number == request.stage)
    )
    stage.completed_at = utcnow()
    request.stage += 1
    if request.stage == 8 and request.type in ["New coverage", "Area expansion"]:
        next_id = (db.scalar(select(func.max(Site.id))) or 0) + 1
        site = add_site(
            db, f"SITE-LTE-{next_id:03}", request.title, request.area_id, request.longitude, request.latitude
        )
        request.activated_site_id = site.id
        telemetry(db)
    elif request.stage == 8:
        candidates = list(db.scalars(select(Site).where(Site.area_id == request.area_id)))
        if not candidates:
            raise HTTPException(409, "Area has no site for this request")
        nearest = min(
            candidates, key=lambda s: (s.latitude - request.latitude) ** 2 + (s.longitude - request.longitude) ** 2
        )
        if request.type in ["Capacity expansion", "Performance improvement"]:
            nearest.capacity_mbps = round(nearest.capacity_mbps * 1.5, 2)
        elif request.type == "Application onboarding":
            for device in db.scalars(select(Device).where(Device.site_id == nearest.id)):
                if not db.get(ApplicationDevice, (request.application_id, device.id)):
                    db.add(ApplicationDevice(application_id=request.application_id, device_id=device.id))
        elif request.type == "New devices":
            if db.scalar(select(func.count()).select_from(Device)) + request.expected_devices > 1500:
                raise HTTPException(409, "Demo device limit reached")
            for i in range(request.expected_devices):
                device = Device(
                    name=f"Expansion {request.id} / gateway {i + 1}",
                    category="IoT gateway",
                    site_id=nearest.id,
                    area_id=request.area_id,
                    latitude=request.latitude,
                    longitude=request.longitude,
                )
                db.add(device)
                db.flush()
                db.add(ApplicationDevice(application_id=request.application_id, device_id=device.id))
        telemetry(db)
        db.add(Event(action="adoption_completed", details={"request_id": request_id, "type": request.type}))
    audit(db, "adoption.advance", {"request_id": request_id, "stage": request.stage})
    db.flush()
    sync_geometries(db)
    return serialize(request)


def spatial_assessment(db, longitude, latitude):
    point = Point(longitude, latitude)
    sites = list(db.scalars(select(Site)))
    nearest = sorted(sites, key=lambda s: point.distance(Point(s.longitude, s.latitude)))[:3]
    from .models import Coverage

    covered = [c.site_id for c in db.scalars(select(Coverage)) if shape(c.geometry).covers(point)]
    if db.bind.dialect.name == "postgresql":
        covered = list(
            db.scalars(
                text(
                    "SELECT site_id FROM coverage_areas WHERE ST_Covers(geom, ST_SetSRID(ST_MakePoint(:x, :y), 4326))"
                ),
                {"x": longitude, "y": latitude},
            )
        )
    return {
        "nearest_sites": [
            {
                "id": s.id,
                "code": s.code,
                "distance_m_approx": round(point.distance(Point(s.longitude, s.latitude)) * 105000),
            }
            for s in nearest
        ],
        "covering_sites": covered,
        "coverage": "Illustrative overlap" if covered else "Illustrative coverage gap",
        "recommendation": "Perform a separate RF and field engineering study; this geometry does not establish feasibility.",
    }
