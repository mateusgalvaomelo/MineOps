from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from .models import Metric


class TelemetrySample(BaseModel):
    site_id: int = Field(gt=0)
    timestamp: datetime
    cpu: float = Field(ge=0, le=100)
    memory: float = Field(ge=0, le=100)
    latency: float = Field(ge=0, le=10000)
    packet_loss: float = Field(ge=0, le=100)
    uplink: float = Field(ge=0, le=100000)
    downlink: float = Field(ge=0, le=100000)
    utilization: float = Field(ge=0, le=100)
    users: int = Field(ge=0, le=1500)
    available: float = Field(ge=0, le=1)

    @field_validator("timestamp")
    @classmethod
    def normalize_utc(cls, value):
        if value.tzinfo is None:
            raise ValueError("Timestamp requires a timezone")
        return value.astimezone(timezone.utc)


def ingest(db, values):
    sample = TelemetrySample.model_validate(values)
    existing = db.scalar(
        select(Metric.id).where(Metric.site_id == sample.site_id, Metric.timestamp == sample.timestamp)
    )
    if existing:
        return False
    db.add(Metric(**sample.model_dump()))
    return True
