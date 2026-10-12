from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


class Operation(Base):
    __tablename__ = "mining_operations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))


class Area(Base):
    __tablename__ = "operational_areas"
    id: Mapped[int] = mapped_column(primary_key=True)
    operation_id: Mapped[int] = mapped_column(ForeignKey("mining_operations.id"))
    name: Mapped[str] = mapped_column(String(100))
    geometry: Mapped[dict] = mapped_column(JSON)


class Site(Base):
    __tablename__ = "network_sites"
    __table_args__ = (CheckConstraint("status in ('operational','degraded','offline','maintenance')"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    area_id: Mapped[int] = mapped_column(ForeignKey("operational_areas.id"), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="operational")
    scenario: Mapped[str] = mapped_column(String(40), default="normal")
    technology: Mapped[str] = mapped_column(String(20), default="Private LTE")
    band: Mapped[str] = mapped_column(String(30), default="B28 · synthetic")
    antenna_height: Mapped[float] = mapped_column(Float, default=35)
    power_dbm: Mapped[float] = mapped_column(Float, default=40)
    capacity_mbps: Mapped[float] = mapped_column(Float, default=150)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Cell(Base):
    __tablename__ = "lte_cells"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), index=True)
    sector: Mapped[int] = mapped_column(Integer)
    azimuth: Mapped[float] = mapped_column(Float)


class Equipment(Base):
    __tablename__ = "network_equipment"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(40))
    vendor: Mapped[str] = mapped_column(String(50), default="Synthetic Systems")
    model: Mapped[str] = mapped_column(String(40), default="DEMO-100")
    serial: Mapped[str] = mapped_column(String(50), unique=True)
    installed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    maintained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Application(Base):
    __tablename__ = "industrial_applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    category: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    area_id: Mapped[int] = mapped_column(ForeignKey("operational_areas.id"))
    owner: Mapped[str] = mapped_column(String(60), default="Demo operations team")
    criticality: Mapped[str] = mapped_column(String(20), default="High")


class Device(Base):
    __tablename__ = "connected_devices"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(40))
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), index=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("operational_areas.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="connected")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    route_phase: Mapped[float] = mapped_column(Float, default=0)
    rsrp: Mapped[float] = mapped_column(Float, default=-85)
    rsrq: Mapped[float] = mapped_column(Float, default=-10)
    sinr: Mapped[float] = mapped_column(Float, default=20)
    data_mb: Mapped[float] = mapped_column(Float, default=0)
    last_connection: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApplicationDevice(Base):
    __tablename__ = "application_devices"
    application_id: Mapped[int] = mapped_column(ForeignKey("industrial_applications.id"), primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("connected_devices.id"), primary_key=True)


class Position(Base):
    __tablename__ = "device_positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("connected_devices.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)


class Metric(Base):
    __tablename__ = "telemetry_samples"
    __table_args__ = (
        UniqueConstraint("site_id", "timestamp"),
        CheckConstraint("utilization >= 0 AND utilization <= 100"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    cpu: Mapped[float] = mapped_column(Float)
    memory: Mapped[float] = mapped_column(Float)
    latency: Mapped[float] = mapped_column(Float)
    packet_loss: Mapped[float] = mapped_column(Float)
    uplink: Mapped[float] = mapped_column(Float)
    downlink: Mapped[float] = mapped_column(Float)
    utilization: Mapped[float] = mapped_column(Float)
    users: Mapped[int] = mapped_column(Integer)
    available: Mapped[float] = mapped_column(Float)
    sample_count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class Alarm(Base):
    __tablename__ = "network_alarms"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), index=True)
    type: Mapped[str] = mapped_column(String(60))
    severity: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="Active")
    owner: Mapped[str] = mapped_column(String(60), default="Unassigned")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    alarm_id: Mapped[int | None] = mapped_column(ForeignKey("network_alarms.id"), nullable=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="Synthetic incident")
    severity: Mapped[str] = mapped_column(String(20))
    owner: Mapped[str] = mapped_column(String(60), default="Demo operator")
    status: Mapped[str] = mapped_column(String(20), default="Open")
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IncidentEvent(Base):
    __tablename__ = "incident_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    action: Mapped[str] = mapped_column(Text)


class Adoption(Base):
    __tablename__ = "adoption_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(140))
    type: Mapped[str] = mapped_column(String(40), default="New coverage")
    area_id: Mapped[int] = mapped_column(ForeignKey("operational_areas.id"))
    application_id: Mapped[int] = mapped_column(ForeignKey("industrial_applications.id"))
    requester: Mapped[str] = mapped_column(String(60), default="Demo planner")
    justification: Mapped[str] = mapped_column(Text, default="Synthetic connectivity expansion")
    expected_devices: Mapped[int] = mapped_column(Integer, default=25)
    priority: Mapped[str] = mapped_column(String(20), default="Medium")
    owner: Mapped[str] = mapped_column(String(60), default="Demo engineering")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    stage: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    desired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    activated_site_id: Mapped[int | None] = mapped_column(ForeignKey("network_sites.id"), nullable=True)


class AdoptionStage(Base):
    __tablename__ = "adoption_stages"
    __table_args__ = (UniqueConstraint("request_id", "number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("adoption_requests.id"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(60))
    planned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Coverage(Base):
    __tablename__ = "coverage_areas"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), unique=True)
    geometry: Mapped[dict] = mapped_column(JSON)
    quality: Mapped[str] = mapped_column(String(20), default="illustrative")


class Route(Base):
    __tablename__ = "simulation_routes"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("network_sites.id"), unique=True)
    geometry: Mapped[dict] = mapped_column(JSON)


class Scenario(Base):
    __tablename__ = "simulation_scenarios"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)


class Event(Base):
    __tablename__ = "simulation_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("network_sites.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    action: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class Audit(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    action: Mapped[str] = mapped_column(String(100))
    details: Mapped[dict] = mapped_column(JSON)
