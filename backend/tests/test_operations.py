import io
import zipfile
from datetime import timedelta

import pytest
from pydantic import ValidationError

from sqlalchemy import func, select

from app import main
from app.db import utcnow
from app.models import Alarm, Audit, Metric, Site
from app.seed import seed
from app.services import overview, retain
from app.ingestion import ingest


def run(client, scenario="backhaul", site=14):
    response = client.post("/api/simulation/scenario", json={"site_id": site, "scenario": scenario})
    assert response.status_code == 200, response.text
    return response.json()


def test_seed_inventory_and_idempotence(client):
    assert client.get("/api/health").json()["status"] == "healthy"
    assert client.get("/api/sites").json()["total"] == 24
    assert client.get("/api/devices").json()["total"] == 500
    assert len(client.get("/api/cells").json()) == 72
    assert len(client.get("/api/applications").json()) == 12
    assert client.get("/api/inventory").json()["total"] == 150
    assert len(client.get("/api/adoption").json()) == 20
    assert client.get("/api/incidents").json()["total"] == 40
    with main.Session() as db:
        seed(db)
        assert db.scalar(select(func.count()).select_from(Site)) == 24
        assert db.scalar(select(func.count()).select_from(Metric)) >= 4032


def test_backhaul_impact_and_recovery(client):
    before = client.get("/api/sites/14/impact").json()
    assert before["affected_devices"] == 0
    impact = run(client)
    assert [impact["affected_devices"], impact["affected_applications"], impact["affected_areas"]] == [42, 3, 1]
    assert {a["name"]: a["devices"] for a in impact["applications"]} == {
        "Fleet Management": 24,
        "Industrial Telemetry": 12,
        "Video Monitoring": 6,
    }
    assert all(d["status"] == "disconnected" for d in client.get("/api/devices?site_id=14").json()["items"])
    assert sum(a["affected_devices"] for a in client.get("/api/applications").json()[:3]) >= 42
    # The same command must not create duplicate technical conditions.
    run(client)
    assert client.get("/api/alarms?site_id=14&status=Active").json()["total"] == 1
    assert run(client, "recover")["affected_devices"] == 0
    assert all(d["status"] == "connected" for d in client.get("/api/devices?site_id=14").json()["items"])


def test_incident_lifecycle_and_human_resolution(client):
    run(client)
    alarm = client.get("/api/alarms?site_id=14").json()["items"][0]
    ack = client.post(f"/api/alarms/{alarm['id']}/acknowledge")
    assert ack.json()["status"] == "Acknowledged"
    timestamp = ack.json()["acknowledged_at"]
    assert client.post(f"/api/alarms/{alarm['id']}/acknowledge").json()["acknowledged_at"] == timestamp
    body = {"alarm_id": alarm["id"], "title": "Original synthetic failure"}
    incident = client.post("/api/incidents", json=body)
    assert incident.status_code == 201
    assert client.post("/api/incidents", json=body).status_code == 409
    identifier = incident.json()["id"]
    assert client.patch(f"/api/incidents/{identifier}", json={"status": "Closed"}).status_code == 409
    assert client.patch(f"/api/incidents/{identifier}", json={"status": "Investigating"}).status_code == 200
    assert client.patch(f"/api/incidents/{identifier}", json={"status": "Resolved"}).status_code == 409
    run(client, "recover")
    assert client.get(f"/api/incidents/{identifier}").json()["status"] == "Investigating"
    assert (
        client.patch(
            f"/api/incidents/{identifier}", json={"status": "Mitigating", "note": "Recovery verified"}
        ).status_code
        == 200
    )
    assert client.patch(f"/api/incidents/{identifier}", json={"status": "Resolved"}).json()["resolved_at"]
    assert client.patch(f"/api/incidents/{identifier}", json={"status": "Closed"}).status_code == 200
    assert len(client.get(f"/api/incidents/{identifier}").json()["events"]) == 5


def test_adoption_full_activation_and_geometry(client):
    body = {
        "title": "Synthetic North Pit extension",
        "area_id": 1,
        "application_id": 1,
        "justification": "Connect fictional haul-road equipment",
        "latitude": -20.1657,
        "longitude": -43.4995,
        "desired_at": (utcnow() + timedelta(days=15)).isoformat(),
    }
    invalid = {**body, "area_id": 4}
    assert client.post("/api/adoption", json=invalid).status_code == 422
    request = client.post("/api/adoption", json=body)
    assert request.status_code == 201
    identifier = request.json()["id"]
    for stage in range(8):
        response = client.post(f"/api/adoption/{identifier}/advance")
        assert response.status_code == 200, response.text
        assert response.json()["stage"] == stage + 1
    site_id = response.json()["activated_site_id"]
    assert site_id is not None
    assert client.get("/api/sites").json()["total"] == 25
    detail = client.get(f"/api/sites/{site_id}").json()
    assert detail["site"]["status"] == "operational"
    assert detail["site"]["metrics"] is not None
    assert len(detail["cells"]) == 3
    features = client.get("/api/coverage").json()["features"]
    assert any(f["properties"].get("site_id") == site_id and f["properties"]["kind"] == "coverage" for f in features)
    assert client.get("/api/overview").json()["total_sites"] == 25
    assert client.post(f"/api/adoption/{identifier}/advance").status_code == 409


def test_device_growth_and_reset_preserve_audit(client):
    run(client, "devices")
    assert client.get("/api/devices").json()["total"] == 525
    assert client.get("/api/sites/14/impact").json()["affected_devices"] == 67
    run(client, "devices")
    assert client.get("/api/devices").json()["total"] == 525
    result = client.post("/api/simulation/control", json={"action": "reset"})
    assert result.status_code == 200, result.text
    assert client.get("/api/devices").json()["total"] == 500
    assert client.get("/api/sites/14/impact").json()["affected_devices"] == 0
    with main.Session() as db:
        assert db.scalar(select(func.count()).select_from(Audit)) >= 2


def test_signal_levels_and_congestion(client):
    run(client, "signal")
    device = client.get("/api/devices?site_id=14").json()["items"][0]
    assert [device["rsrp"], device["rsrq"], device["sinr"]] == [-120, -18, 2]
    run(client, "congestion")
    metric = client.get("/api/sites/14").json()["site"]["metrics"]
    assert metric["utilization"] > 90
    assert metric["latency"] > 100


def test_filters_pagination_and_invalid_inputs(client):
    assert client.get("/api/devices?site_id=14&limit=10&offset=10").json()["total"] == 42
    assert len(client.get("/api/devices?site_id=14&limit=10&offset=10").json()["items"]) == 10
    assert client.get("/api/sites?search=014").json()["total"] == 1
    assert client.get("/api/sites/999").status_code == 404
    assert client.get("/api/devices?limit=0").status_code == 422
    assert client.post("/api/simulation/scenario", json={"site_id": 14, "scenario": "unknown"}).status_code == 422
    assert client.get("/api/coverage/assess?longitude=-43.4995&latitude=-20.1657").json()["covering_sites"]
    assert client.get("/api/coverage/assess?longitude=0&latitude=0").status_code == 422


def test_export_workbook_and_dictionary(client):
    response = client.get("/api/export")
    assert response.status_code == 200
    archive = zipfile.ZipFile(io.BytesIO(response.content))
    assert {
        "sites.csv",
        "devices.csv",
        "telemetry.csv",
        "mineops-demo.xlsx",
        "data_dictionary.csv",
        "NOTICE.txt",
    } <= set(archive.namelist())
    assert b"SITE-LTE-014" in archive.read("sites.csv")
    workbook = zipfile.ZipFile(io.BytesIO(archive.read("mineops-demo.xlsx")))
    assert "xl/workbook.xml" in workbook.namelist()


def test_availability_and_retention(client):
    with main.Session() as db:
        db.execute(Metric.__table__.delete())
        now = utcnow()
        values = {
            "site_id": 14,
            "cpu": 1,
            "memory": 1,
            "latency": 1,
            "packet_loss": 0,
            "uplink": 1,
            "downlink": 1,
            "utilization": 1,
            "users": 1,
        }
        db.add_all(
            [
                Metric(**values, timestamp=now - timedelta(hours=1), available=1),
                Metric(**values, timestamp=now - timedelta(hours=2), available=0),
                Metric(**values, timestamp=now - timedelta(days=30), available=0),
            ]
        )
        db.commit()
        assert overview(db, site_id=14)["availability"] == 50
        retain(db)
        db.commit()
        assert db.scalar(select(func.count()).select_from(Metric)) == 2


def test_mtta_uses_acknowledgement_times(client):
    with main.Session() as db:
        now = utcnow()
        db.add(
            Alarm(
                site_id=14,
                type="Test",
                severity="Warning",
                description="Synthetic",
                started_at=now - timedelta(minutes=8),
                acknowledged_at=now - timedelta(minutes=3),
                status="Acknowledged",
            )
        )
        db.commit()
        assert overview(db, site_id=14)["mtta_minutes"] == 5


def test_websocket_and_control(client):
    with client.websocket_connect("/api/ws") as ws:
        assert ws.receive_json()["type"] == "connected"
        response = client.post("/api/simulation/control", json={"action": "pause"})
        assert response.json()["running"] is False
        assert ws.receive_json()["type"] == "control"
    assert client.post("/api/simulation/control", json={"action": "speed", "speed": 2}).json()["speed"] == 2
    assert client.post("/api/simulation/control", json={"action": "resume"}).json()["running"] is True


def test_preferences_validation(client):
    assert (
        client.put("/api/settings", json={"stage_days": 0, "retention_days": 1, "stale_seconds": 0}).status_code == 422
    )
    values = {"stage_days": 3, "retention_days": 10, "stale_seconds": 30}
    assert client.put("/api/settings", json=values).json() == values
    assert client.get("/api/settings").json() == values


def test_ingestion_bounds_timezone_and_deduplication(client):
    values = {
        "site_id": 14,
        "timestamp": utcnow(),
        "cpu": 50,
        "memory": 50,
        "latency": 12,
        "packet_loss": 0,
        "uplink": 20,
        "downlink": 50,
        "utilization": 45,
        "users": 42,
        "available": 1,
    }
    with main.Session() as db:
        assert ingest(db, values) is True
        db.flush()
        assert ingest(db, values) is False
        with pytest.raises(ValidationError):
            ingest(db, {**values, "utilization": 101})
        with pytest.raises(ValidationError):
            ingest(db, {**values, "timestamp": utcnow().replace(tzinfo=None)})


def test_hourly_normalization_prevents_live_sample_bias(client):
    with main.Session() as db:
        db.execute(Metric.__table__.delete())
        now = utcnow().replace(minute=30, second=0, microsecond=0)
        values = {
            "site_id": 14,
            "cpu": 1,
            "memory": 1,
            "latency": 1,
            "packet_loss": 0,
            "uplink": 10,
            "downlink": 20,
            "utilization": 1,
            "users": 1,
        }
        db.add(Metric(**values, timestamp=now - timedelta(hours=2), available=0))
        for i in range(10):
            db.add(Metric(**values, timestamp=now - timedelta(hours=1, seconds=i), available=1))
        db.commit()
        result = overview(db, site_id=14)
        assert result["availability"] == 50
        assert all(h["throughput"] == 30 for h in result["history"])


@pytest.mark.parametrize("request_type", ["Capacity expansion", "New devices", "Application onboarding"])
def test_non_site_adoption_applies_persisted_change(client, request_type):
    body = {
        "title": "Synthetic capacity change",
        "type": request_type,
        "area_id": 1,
        "application_id": 12,
        "justification": "Original demo expansion",
        "expected_devices": 5,
        "latitude": -20.1621,
        "longitude": -43.5094,
        "desired_at": (utcnow() + timedelta(days=10)).isoformat(),
    }
    identifier = client.post("/api/adoption", json=body).json()["id"]
    for _ in range(8):
        assert client.post(f"/api/adoption/{identifier}/advance").status_code == 200
    if request_type == "Capacity expansion":
        assert client.get("/api/sites/1").json()["site"]["capacity_mbps"] == 225
    elif request_type == "New devices":
        assert client.get("/api/devices").json()["total"] == 505
    else:
        assert all(
            "IoT Connectivity" in d["applications"] for d in client.get("/api/devices?site_id=1").json()["items"]
        )
    assert client.get("/api/sites").json()["total"] == 24


def test_rollup_preserves_weights(client):
    with main.Session() as db:
        db.execute(Metric.__table__.delete())
        hour = (utcnow() - timedelta(days=2)).replace(minute=0, second=0, microsecond=0)
        values = {
            "site_id": 14,
            "cpu": 1,
            "memory": 1,
            "latency": 1,
            "packet_loss": 0,
            "uplink": 10,
            "downlink": 20,
            "utilization": 1,
            "users": 1,
        }
        db.add(Metric(**values, timestamp=hour, available=0.5, sample_count=10))
        db.add(Metric(**values, timestamp=hour + timedelta(minutes=15), available=1, sample_count=1))
        db.commit()
        retain(db)
        db.commit()
        row = db.scalar(select(Metric))
        assert row.sample_count == 11
        assert row.available == pytest.approx(6 / 11)


def test_failed_reset_rolls_back_operational_data(client, monkeypatch):
    def fail_seed(db):
        raise RuntimeError("Artificial seed failure")

    monkeypatch.setattr(main, "seed", fail_seed)
    with pytest.raises(RuntimeError, match="Artificial seed failure"):
        client.post("/api/simulation/control", json={"action": "reset"})
    assert client.get("/api/sites").json()["total"] == 24
    assert client.get("/api/devices").json()["total"] == 500
