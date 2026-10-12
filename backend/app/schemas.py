from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ScenarioInput(BaseModel):
    site_id: int = Field(gt=0)
    scenario: Literal[
        "offline",
        "backhaul",
        "power",
        "congestion",
        "devices",
        "signal",
        "latency",
        "packet_loss",
        "telemetry",
        "recover",
    ]


class ControlInput(BaseModel):
    action: Literal["start", "pause", "resume", "reset", "speed"]
    speed: float = Field(default=1, ge=0.25, le=10)


class IncidentInput(BaseModel):
    alarm_id: int = Field(gt=0)
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(default="Synthetic operational incident", max_length=2000)
    owner: str = Field(default="Demo operator", min_length=1, max_length=60)


class IncidentUpdate(BaseModel):
    status: Literal["Open", "Investigating", "Mitigating", "Resolved", "Closed"]
    note: str = Field(default="", max_length=2000)


class AdoptionInput(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    type: Literal[
        "New coverage",
        "Capacity expansion",
        "Application onboarding",
        "New devices",
        "Performance improvement",
        "Area expansion",
    ] = "New coverage"
    area_id: int = Field(ge=1)
    application_id: int = Field(ge=1)
    requester: str = Field(default="Demo planner", min_length=1, max_length=60)
    justification: str = Field(min_length=3, max_length=2000)
    expected_devices: int = Field(default=25, ge=1, le=500)
    priority: Literal["High", "Medium", "Low"] = "Medium"
    latitude: float = Field(ge=-20.23, le=-20.145)
    longitude: float = Field(ge=-43.54, le=-43.45)
    desired_at: datetime


class PreferencesInput(BaseModel):
    stage_days: int = Field(ge=1, le=30)
    retention_days: int = Field(ge=7, le=90)
    stale_seconds: int = Field(ge=10, le=120)
