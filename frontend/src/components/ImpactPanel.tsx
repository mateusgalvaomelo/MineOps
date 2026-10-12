import { Activity, ArrowUpRight, RadioTower, ShieldAlert } from "lucide-react";
import type { Impact, SiteDetail } from "../types";
import { Badge, Button, fmt } from "./ui";
import { Trend } from "./Charts";
export function ImpactPanel({
  detail,
  impact,
  onScenario,
  pending,
  onDetails,
}: {
  detail?: SiteDetail;
  impact?: Impact;
  onScenario: (scenario: string) => void;
  pending: boolean;
  onDetails: () => void;
}) {
  if (!detail || !impact)
    return (
      <aside className="impact-panel">
        <div className="empty">
          <RadioTower size={36} />
          <h3>Select an LTE site</h3>
          <p>
            Inspect network health and its dependencies across industrial
            operations.
          </p>
        </div>
      </aside>
    );
  const site = detail.site;
  return (
    <aside className="impact-panel">
      <div className="panel-site">
        <div className="flex between">
          <span className="eyebrow">SELECTED SITE</span>
          <Badge status={site.status}>{site.status}</Badge>
        </div>
        <h3>
          <RadioTower size={19} />
          {site.code}
        </h3>
        <p className="muted small">{site.name}</p>
        <div className="site-metrics">
          <div>
            <strong>{fmt(site.metrics?.utilization || 0, 1)}%</strong>
            <small>Utilization</small>
          </div>
          <div>
            <strong>{site.devices}</strong>
            <small>Linked devices</small>
          </div>
          <div>
            <strong>
              {site.metrics?.latency || 0}
              <em> ms</em>
            </strong>
            <small>Latency</small>
          </div>
        </div>
        <Button variant="ghost" onClick={onDetails}>
          View site details <ArrowUpRight size={14} />
        </Button>
      </div>
      <div className="impact-body">
        <div className="flex between">
          <h3>
            <ShieldAlert size={18} />
            Impact Analysis
          </h3>
          <span className="simulation-tag">SIMULATED</span>
        </div>
        <p className="muted small">Operational dependencies of this site</p>
        <div
          className={`incident-card ${impact.affected_devices ? "active" : ""}`}
        >
          <span className="eyebrow">INCIDENT CONDITION</span>
          <div className="flex between">
            <strong>{impact.incident}</strong>
            <Badge status={impact.severity}>{impact.severity}</Badge>
          </div>
          <small>{site.code}</small>
        </div>
        <div className="impact-counts">
          <div>
            <strong>{impact.affected_devices}</strong>
            <small>Affected devices</small>
          </div>
          <div>
            <strong>{impact.affected_applications}</strong>
            <small>Applications</small>
          </div>
          <div>
            <strong>{impact.affected_areas}</strong>
            <small>Areas</small>
          </div>
        </div>
        <h4>Impact by application</h4>
        {impact.applications.length ? (
          impact.applications.map((app) => (
            <div className="app-impact" key={app.id}>
              <div className="flex between">
                <span>{app.name}</span>
                <small>{app.devices} devices</small>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${(app.devices / Math.max(1, impact.affected_devices)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="muted small">No applications currently affected.</p>
        )}
        {impact.areas.map((area) => (
          <Badge key={area.id} status="degraded">
            {area.name}
          </Badge>
        ))}
        <div className="impact-actions">
          <Button
            disabled={pending}
            variant="danger"
            onClick={() => onScenario("backhaul")}
          >
            <Activity size={15} />
            Simulate backhaul failure
          </Button>
          <Button
            disabled={pending || site.status === "operational"}
            variant="secondary"
            onClick={() => onScenario("recover")}
          >
            Recover site
          </Button>
        </div>
        <p className="disclaimer">
          Estimated from synthetic site–device–application relationships.
          Demonstration only.
        </p>
      </div>
      <div className="panel-chart">
        <span className="eyebrow">24H SITE UTILIZATION (%)</span>
        <Trend data={detail.history} field="utilization" height={120} />
      </div>
    </aside>
  );
}
