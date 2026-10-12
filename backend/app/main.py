import asyncio
import io
import logging
import os
import zipfile
from contextlib import asynccontextmanager, suppress

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select, text

from .db import Base, Session, engine, utcnow
from .models import (
    Adoption,
    Alarm,
    Application,
    Area,
    Cell,
    Coverage,
    Device,
    Equipment,
    Event,
    Incident,
    IncidentEvent,
    Metric,
    Setting,
    Site,
    Route,
    Scenario,
)
from .schemas import AdoptionInput, ControlInput, IncidentInput, IncidentUpdate, PreferencesInput, ScenarioInput
from .seed import seed, stage_plan
from .services import (
    adoption_rows,
    advance,
    application_rows,
    audit,
    device_rows,
    get,
    impact,
    overview,
    scenario,
    serialize,
    site_rows,
    spatial_assessment,
    telemetry,
)

logger = logging.getLogger("mineops")
write_lock = asyncio.Lock()
clients: set[WebSocket] = set()


def database():
    with Session() as db:
        yield db


async def broadcast(kind="update"):
    for client in list(clients):
        try:
            await client.send_json({"type": kind, "timestamp": utcnow().isoformat()})
        except Exception:
            clients.discard(client)


async def simulation_loop():
    while True:
        await asyncio.sleep(float(os.getenv("SIMULATION_INTERVAL", "5")))
        try:
            async with write_lock:
                with Session() as db:
                    if get(db, Setting, "simulation").value["running"]:
                        telemetry(db)
                        db.commit()
            await broadcast()
        except Exception:
            logger.exception("Simulation tick failed")


@asynccontextmanager
async def lifespan(app):
    # Docker performs Alembic first; SQLite is a convenient test-only fallback.
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)
    with Session() as db:
        seed(db)
        telemetry(db)
        db.commit()
    task = asyncio.create_task(simulation_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    for client in list(clients):
        with suppress(Exception):
            await client.close()


app = FastAPI(title="MineOps · Synthetic Private LTE Operations", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health(db=Depends(database)):
    db.execute(text("SELECT 1"))
    return {"status": "healthy", "database": db.bind.dialect.name, "synthetic": True}


@app.get("/api/overview")
def get_overview(
    hours: int = Query(24, ge=1, le=168),
    site_id: int | None = None,
    area_id: int | None = None,
    severity: str | None = None,
    db=Depends(database),
):
    return overview(db, hours, site_id, area_id, severity)


@app.get("/api/sites")
def sites(
    search: str = "",
    status: str | None = None,
    area_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db=Depends(database),
):
    rows = [
        s
        for s in site_rows(db)
        if search.lower() in (s["code"] + s["name"]).lower()
        and (not status or s["status"] == status)
        and (not area_id or s["area_id"] == area_id)
    ]
    return {"items": rows[offset : offset + limit], "total": len(rows)}


@app.get("/api/sites/{site_id}")
def site_detail(site_id: int, db=Depends(database)):
    get(db, Site, site_id)
    return {
        "site": next(s for s in site_rows(db) if s["id"] == site_id),
        "devices": device_rows(db, site_id),
        "impact": impact(db, site_id),
        "history": overview(db, site_id=site_id)["history"],
        "alarms": [
            serialize(a) for a in db.scalars(select(Alarm).where(Alarm.site_id == site_id).order_by(Alarm.id.desc()))
        ],
        "cells": [serialize(c) for c in db.scalars(select(Cell).where(Cell.site_id == site_id))],
    }


@app.get("/api/sites/{site_id}/impact")
def site_impact(site_id: int, db=Depends(database)):
    return impact(db, site_id)


@app.get("/api/devices")
def devices(
    site_id: int | None = None,
    search: str = "",
    status: str | None = None,
    area_id: int | None = None,
    category: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1500),
    db=Depends(database),
):
    rows = device_rows(db, site_id, search, status, area_id)
    if category:
        rows = [r for r in rows if r["category"] == category]
    return {"items": rows[offset : offset + limit], "total": len(rows)}


@app.get("/api/devices/{device_id}")
def device_detail(device_id: int, db=Depends(database)):
    device = get(db, Device, device_id)
    return {
        **next(d for d in device_rows(db, device.site_id) if d["id"] == device_id),
        "site": serialize(get(db, Site, device.site_id)),
        "area": serialize(get(db, Area, device.area_id)),
    }


@app.get("/api/applications")
def applications(db=Depends(database)):
    return application_rows(db)


@app.get("/api/areas")
def areas(db=Depends(database)):
    return [serialize(a) for a in db.scalars(select(Area))]


@app.get("/api/inventory")
def inventory(
    search: str = "",
    category: str | None = None,
    site_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db=Depends(database),
):
    query = select(Equipment).where(Equipment.name.ilike(f"%{search}%"))
    if site_id:
        query = query.where(Equipment.site_id == site_id)
    if category:
        query = query.where(Equipment.category == category)
    rows = list(db.scalars(query.order_by(Equipment.id)))
    return {"items": [serialize(e) for e in rows[offset : offset + limit]], "total": len(rows)}


@app.get("/api/cells")
def cells(site_id: int | None = None, db=Depends(database)):
    query = select(Cell)
    if site_id:
        query = query.where(Cell.site_id == site_id)
    return [serialize(c) for c in db.scalars(query)]


@app.get("/api/alarms")
def alarms(
    status: str | None = None,
    severity: str | None = None,
    site_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(database),
):
    query = select(Alarm).order_by(Alarm.id.desc())
    for field, value in [("status", status), ("severity", severity), ("site_id", site_id)]:
        if value:
            query = query.where(getattr(Alarm, field) == value)
    rows = list(db.scalars(query))
    return {"items": [serialize(a) for a in rows[offset : offset + limit]], "total": len(rows)}


@app.post("/api/alarms/{alarm_id}/acknowledge")
async def acknowledge(alarm_id: int, db=Depends(database)):
    async with write_lock:
        alarm = get(db, Alarm, alarm_id)
        if alarm.status == "Cleared":
            raise HTTPException(409, "Technical condition already cleared")
        if not alarm.acknowledged_at:
            alarm.acknowledged_at = utcnow()
        alarm.status, alarm.owner = "Acknowledged", "Demo operator"
        audit(db, "alarm.acknowledge", {"alarm_id": alarm_id})
        db.commit()
    await broadcast()
    return serialize(alarm)


@app.get("/api/incidents")
def incidents(
    status: str | None = None,
    severity: str | None = None,
    site_id: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(database),
):
    query = select(Incident).order_by(Incident.id.desc())
    for field, value in [("status", status), ("severity", severity), ("site_id", site_id)]:
        if value:
            query = query.where(getattr(Incident, field) == value)
    rows = list(db.scalars(query))
    return {"items": [serialize(i) for i in rows[offset : offset + limit]], "total": len(rows)}


@app.get("/api/incidents/{incident_id}")
def incident_detail(incident_id: int, db=Depends(database)):
    incident = get(db, Incident, incident_id)
    return {
        **serialize(incident),
        "events": [
            serialize(e)
            for e in db.scalars(
                select(IncidentEvent).where(IncidentEvent.incident_id == incident_id).order_by(IncidentEvent.id)
            )
        ],
        "impact": impact(db, incident.site_id),
    }


@app.post("/api/incidents", status_code=201)
async def create_incident(body: IncidentInput, db=Depends(database)):
    async with write_lock:
        alarm = get(db, Alarm, body.alarm_id)
        if alarm.status == "Cleared":
            raise HTTPException(409, "Cannot open incident from a cleared alarm")
        if db.scalar(
            select(Incident).where(Incident.alarm_id == alarm.id, Incident.status.not_in(["Resolved", "Closed"]))
        ):
            raise HTTPException(409, "This alarm already has an active incident")
        incident = Incident(**body.model_dump(), site_id=alarm.site_id, severity=alarm.severity)
        db.add(incident)
        db.flush()
        db.add(IncidentEvent(incident_id=incident.id, action="Opened by demo operator"))
        audit(db, "incident.create", {"incident_id": incident.id})
        db.commit()
    await broadcast()
    return serialize(incident)


@app.patch("/api/incidents/{incident_id}")
async def update_incident(incident_id: int, body: IncidentUpdate, db=Depends(database)):
    transitions = {
        "Open": ["Investigating"],
        "Investigating": ["Mitigating", "Resolved"],
        "Mitigating": ["Resolved"],
        "Resolved": ["Closed"],
        "Closed": [],
    }
    async with write_lock:
        incident = get(db, Incident, incident_id)
        if body.status not in transitions[incident.status]:
            raise HTTPException(409, "Invalid incident workflow transition")
        if body.status == "Resolved" and get(db, Site, incident.site_id).status != "operational":
            raise HTTPException(409, "Recover the simulated site before resolving its incident")
        incident.status = body.status
        if body.status == "Resolved":
            incident.resolved_at = utcnow()
        db.add(
            IncidentEvent(incident_id=incident_id, action=f"{body.status}: {body.note or 'Updated by demo operator'}")
        )
        audit(db, "incident.transition", {"incident_id": incident_id, "status": body.status})
        db.commit()
    await broadcast()
    return serialize(incident)


@app.get("/api/coverage")
def coverage(db=Depends(database)):
    from .geospatial import coverage_features, mine_scene

    features = [
        {"type": "Feature", "properties": {"kind": "area", "id": a.id, "name": a.name}, "geometry": a.geometry}
        for a in db.scalars(select(Area))
    ]
    features += mine_scene()
    features += coverage_features({s.id: s for s in db.scalars(select(Site))}, list(db.scalars(select(Cell))))
    features += [
        {"type": "Feature", "properties": {"kind": "road", "site_id": r.site_id}, "geometry": r.geometry}
        for r in db.scalars(select(Route))
    ]
    return {"type": "FeatureCollection", "features": features}


@app.get("/api/coverage/assess")
def assess(
    longitude: float = Query(ge=-43.54, le=-43.45), latitude: float = Query(ge=-20.23, le=-20.145), db=Depends(database)
):
    return spatial_assessment(db, longitude, latitude)


@app.get("/api/coverage/probe")
def signal_probe(
    longitude: float = Query(ge=-43.54, le=-43.45), latitude: float = Query(ge=-20.23, le=-20.145), db=Depends(database)
):
    from shapely.geometry import Point, shape
    from .geospatial import coverage_features

    features = coverage_features({s.id: s for s in db.scalars(select(Site))}, list(db.scalars(select(Cell))))
    point = Point(longitude, latitude)
    matches = [f["properties"] for f in features if shape(f["geometry"]).covers(point)]
    active = sorted([m for m in matches if m["status"] != "offline"], key=lambda m: m["estimated_rsrp"], reverse=True)
    best = active[0] if active else None
    return {
        "longitude": longitude,
        "latitude": latitude,
        "estimated": True,
        "quality": best["band"] if best else "No active coverage",
        "estimated_rsrp": best["estimated_rsrp"] if best else None,
        "site_code": best["code"] if best else None,
        "sector": best["sector"] if best else None,
        "azimuth": best["azimuth"] if best else None,
        "site_status": best["status"] if best else None,
        "covering_sites": len({m["site_id"] for m in active}),
        "offline_footprints": len({m["site_id"] for m in matches if m["status"] == "offline"}),
        "method": "Synthetic sector geometry; not a field measurement or terrain-aware RF prediction.",
    }


@app.get("/api/adoption")
def adoptions(db=Depends(database)):
    return adoption_rows(db)


@app.post("/api/adoption", status_code=201)
async def create_adoption(body: AdoptionInput, db=Depends(database)):
    from .services import aware

    if aware(body.desired_at) < utcnow():
        raise HTTPException(422, "Desired date must be in the future")
    async with write_lock:
        area = get(db, Area, body.area_id)
        get(db, Application, body.application_id)
        from shapely.geometry import Point, shape

        if not shape(area.geometry).covers(Point(body.longitude, body.latitude)):
            raise HTTPException(422, "Selected point must be inside the chosen operational area")
        request = Adoption(**body.model_dump())
        db.add(request)
        db.flush()
        stage_plan(db, request, get(db, Setting, "preferences").value["stage_days"])
        audit(db, "adoption.create", {"request_id": request.id})
        db.commit()
    await broadcast()
    return serialize(request)


@app.post("/api/adoption/{request_id}/advance")
async def advance_adoption(request_id: int, db=Depends(database)):
    async with write_lock:
        result = advance(db, request_id)
        db.commit()
    await broadcast()
    return result


@app.get("/api/simulation")
def simulation(db=Depends(database)):
    return {
        **get(db, Setting, "simulation").value,
        "scenarios": [serialize(s) for s in db.scalars(select(Scenario))],
        "events": [serialize(e) for e in db.scalars(select(Event).order_by(Event.id.desc()).limit(50))],
    }


@app.post("/api/simulation/scenario")
async def run_scenario(body: ScenarioInput, db=Depends(database)):
    async with write_lock:
        result = scenario(db, body.site_id, body.scenario)
        db.commit()
    await broadcast("scenario")
    return result


@app.post("/api/simulation/control")
async def simulation_control(body: ControlInput, db=Depends(database)):
    async with write_lock:
        if body.action == "reset":
            audit(db, "simulation.reset", {"note": "Restored original synthetic seed"})
            # Preserve audit records, erase only demo operational state.
            for table in reversed(Base.metadata.sorted_tables):
                if table.name != "audit_logs":
                    db.execute(delete(table))
            seed(db)
            telemetry(db)
        else:
            setting = get(db, Setting, "simulation")
            setting.value = {
                **setting.value,
                **({"speed": body.speed} if body.action == "speed" else {"running": body.action != "pause"}),
            }
            audit(db, "simulation.control", body.model_dump())
        db.commit()
        result = get(db, Setting, "simulation").value
    await broadcast("reset" if body.action == "reset" else "control")
    return result


@app.get("/api/analytics")
def analytics(
    hours: int = Query(24, ge=1, le=168),
    site_id: int | None = None,
    area_id: int | None = None,
    severity: str | None = None,
    db=Depends(database),
):
    result = overview(db, hours, site_id, area_id, severity)
    result["applications"] = application_rows(db, site_id, area_id)
    result["adoption"] = [r for r in adoption_rows(db) if not area_id or r["area_id"] == area_id]
    result["incidents"] = [
        serialize(i)
        for i in db.scalars(
            select(Incident)
            .join(Site, Site.id == Incident.site_id)
            .where(
                Incident.opened_at >= utcnow() - pd.Timedelta(hours=hours).to_pytimedelta(),
                Site.id == site_id if site_id else True,
                Site.area_id == area_id if area_id else True,
                Incident.severity == severity if severity else True,
            )
        )
    ]
    return result


@app.get("/api/settings")
def settings(db=Depends(database)):
    return get(db, Setting, "preferences").value


@app.put("/api/settings")
async def put_settings(body: PreferencesInput, db=Depends(database)):
    async with write_lock:
        get(db, Setting, "preferences").value = body.model_dump()
        audit(db, "settings.update", body.model_dump())
        db.commit()
    await broadcast()
    return body.model_dump()


@app.get("/api/export")
def export(db=Depends(database)):
    tables = {
        "sites": site_rows(db),
        "devices": device_rows(db),
        "applications": application_rows(db),
        "equipment": [serialize(e) for e in db.scalars(select(Equipment))],
        "cells": [serialize(c) for c in db.scalars(select(Cell))],
        "areas": [serialize(a) for a in db.scalars(select(Area))],
        "coverage": [serialize(c) for c in db.scalars(select(Coverage))],
        "adoption": adoption_rows(db),
        "incidents": [serialize(i) for i in db.scalars(select(Incident))],
        "alarms": [serialize(a) for a in db.scalars(select(Alarm))],
        "telemetry": [serialize(m) for m in db.scalars(select(Metric).order_by(Metric.timestamp))],
    }
    dictionaries = [
        {
            "table": table.name,
            "column": c.name,
            "type": str(c.type),
            "nullable": c.nullable,
            "description": "Synthetic demo field; see docs/database.md",
        }
        for table in Base.metadata.sorted_tables
        for c in table.columns
    ]
    tables["data_dictionary"] = dictionaries
    output, workbook = io.BytesIO(), io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
            for name, rows in tables.items():
                frame = pd.DataFrame(jsonable_encoder(rows))
                # JSON columns stay clearly serialized and formulas are never executed.
                for column in frame.columns:
                    frame[column] = frame[column].map(
                        lambda v: (
                            str(v)
                            if isinstance(v, (dict, list))
                            else ("'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@")) else v)
                        )
                    )
                archive.writestr(f"{name}.csv", frame.to_csv(index=False))
                frame.to_excel(writer, sheet_name=name[:31], index=False)
        archive.writestr("mineops-demo.xlsx", workbook.getvalue())
        archive.writestr(
            "NOTICE.txt", "All data is synthetic. Not a real mine, network, RF study, SLA or operational diagnosis."
        )
    output.seek(0)
    return StreamingResponse(
        output, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=mineops-demo.zip"}
    )


@app.websocket("/api/ws")
async def websocket(socket: WebSocket):
    await socket.accept()
    clients.add(socket)
    await socket.send_json({"type": "connected", "timestamp": utcnow().isoformat()})
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(socket)
