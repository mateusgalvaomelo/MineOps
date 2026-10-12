import { useData } from "../api";
import type { Overview, Page, Site, Simulation } from "../types";
import { Badge, Button, date, fmt } from "../components/ui";
import { Trend } from "../components/Charts";
export function NocPage({ onSite }: { onSite: (id: number) => void }) {
  const sites = useData<Page<Site>>("/sites");
  const overview = useData<Overview>("/overview");
  const simulation = useData<Simulation>("/simulation");
  return (
    <>
      <div className="noc-summary">
        <span>
          <i className="dot green-bg" /> Live synthetic telemetry
        </span>
        <strong>{overview.data?.operational || 0} operational</strong>
        <span className="amber">{overview.data?.degraded || 0} degraded</span>
        <span className="red">{overview.data?.offline || 0} offline</span>
        <span>{overview.data?.stale_sites || 0} stale</span>
      </div>
      {sites.error && <div className="error">{sites.error.message}</div>}
      <div className="noc-grid">
        {sites.data?.items.map((s) => (
          <button
            className={`card noc-site ${s.status}`}
            key={s.id}
            onClick={() => onSite(s.id)}
          >
            <div className="flex between">
              <strong className="mono">{s.code}</strong>
              <Badge status={s.status}>{s.status}</Badge>
            </div>
            <p>{s.area}</p>
            <div className="noc-numbers">
              <span>
                <strong>{fmt(s.metrics?.utilization || 0, 1)}%</strong>Capacity
              </span>
              <span>
                <strong>{s.metrics?.latency || 0} ms</strong>Latency
              </span>
              <span>
                <strong>{s.metrics?.packet_loss || 0}%</strong>Loss
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${s.metrics?.utilization || 0}%` }} />
            </div>
            <div className="flex between small muted">
              <span>CPU {fmt(s.metrics?.cpu || 0, 1)}%</span>
              <span>RAM {s.metrics?.memory || 0}%</span>
              <span>{s.metrics?.users || 0} users</span>
            </div>
          </button>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="card">
          <div className="card-title">
            <h3>Throughput · Mbps</h3>
          </div>
          <Trend data={overview.data?.history || []} />
        </section>
        <section className="card">
          <div className="card-title">
            <h3>Recent operational events</h3>
          </div>
          <div className="event-list">
            {simulation.data?.events.slice(0, 6).map((e) => (
              <div key={e.id}>
                <Badge
                  status={e.action === "recover" ? "operational" : "Warning"}
                >
                  {e.action}
                </Badge>
                <span>
                  {e.site_id
                    ? `SITE-LTE-${String(e.site_id).padStart(3, "0")}`
                    : "Expansion"}
                </span>
                <small>{date(e.timestamp)}</small>
              </div>
            ))}
            {!simulation.data?.events.length && (
              <p className="muted">No scenario events yet.</p>
            )}
          </div>
          <Button variant="ghost" onClick={() => onSite(14)}>
            Inspect demo site 014 →
          </Button>
        </section>
      </div>
    </>
  );
}
