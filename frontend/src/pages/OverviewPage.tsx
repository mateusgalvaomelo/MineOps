import {
  Activity,
  ArrowRight,
  RadioTower,
  ShieldAlert,
  Truck,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../api";
import type { Device, Overview, Page, Site } from "../types";
import { Badge, fmt } from "../components/ui";
import { Bars, Trend } from "../components/Charts";
import { NetworkMap } from "../components/NetworkMap";

export function OverviewPage({
  onSite,
  hours,
  siteFilter,
  areaFilter,
  severityFilter,
}: {
  onSite: (id: number) => void;
  hours: number;
  siteFilter: string;
  areaFilter: string;
  severityFilter: string;
}) {
  const { data, error } = useData<Overview>(
    `/overview?hours=${hours}${siteFilter ? "&site_id=" + siteFilter : ""}${areaFilter ? "&area_id=" + areaFilter : ""}${severityFilter ? "&severity=" + severityFilter : ""}`,
  );
  const sites = useData<Page<Site>>("/sites");
  const devices = useData<Page<Device>>("/devices?limit=1500");
  const geography = useData<GeoJSON.FeatureCollection>("/coverage");
  if (error)
    return (
      <div className="error">Unable to load overview: {error.message}</div>
    );
  if (!data) return <div className="loading">Loading operational data…</div>;
  return (
    <>
      <div className="kpi-grid">
        {[
          {
            label: "Network availability",
            value: `${fmt(data.availability, 2)}%`,
            note: `${hours}h sampled availability`,
            icon: Activity,
            color: "green",
          },
          {
            label: "LTE sites",
            value: data.total_sites,
            note: `${data.operational} operational · ${data.degraded} degraded`,
            icon: RadioTower,
            color: "blue",
          },
          {
            label: "Connected devices",
            value: fmt(data.connected_devices),
            note: `of ${fmt(data.total_devices)} deployed devices`,
            icon: Truck,
            color: "blue",
          },
          {
            label: "Active alarms",
            value: data.active_alarms,
            note: `${data.critical_incidents} critical incidents`,
            icon: ShieldAlert,
            color: "amber",
          },
          {
            label: "Network throughput",
            value: `${fmt(data.throughput, 1)}`,
            note: "Mbps · synthetic telemetry",
            icon: Zap,
            color: "blue",
          },
          {
            label: "Expansion requests",
            value: data.adoption_pending,
            note: "Network planning in progress",
            icon: ArrowRight,
            color: "purple",
          },
        ].map((k) => (
          <div className="kpi" key={k.label}>
            <div className="flex between">
              <span>{k.label}</span>
              <k.icon size={18} className={k.color} />
            </div>
            <strong>{k.value}</strong>
            <small>{k.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card map-card">
          <div className="card-title">
            <div>
              <h3>Network at a glance</h3>
              <p>Private LTE infrastructure & connected operations</p>
            </div>
            <Link to="/map">
              Open full map <ArrowRight size={14} />
            </Link>
          </div>
          <NetworkMap
            compact
            sites={sites.data?.items || []}
            devices={devices.data?.items || []}
            geography={geography.data}
            onSite={onSite}
          />
        </section>
        <section className="card">
          <div className="card-title">
            <div>
              <h3>Network traffic</h3>
              <p>Aggregated throughput · Mbps</p>
            </div>
            <Badge status="operational">Synthetic live</Badge>
          </div>
          <Trend data={data.history} />
          <div className="chart-footer">
            <span>
              <i className="dot blue-bg" />
              Total throughput
            </span>
            <strong>{fmt(data.throughput, 1)} Mbps</strong>
          </div>
        </section>
        <section className="card">
          <div className="card-title">
            <div>
              <h3>Availability trend</h3>
              <p>Sampled availability · %</p>
            </div>
          </div>
          <Trend
            data={data.history}
            field="availability"
            color="#22c55e"
            height={180}
          />
        </section>
        <section className="card">
          <div className="card-title">
            <div>
              <h3>Operational areas</h3>
              <p>Average capacity utilization · %</p>
            </div>
          </div>
          <Bars data={data.area_utilization} height={180} />
        </section>
      </div>
      <div className="noc-summary">
        <strong>{data.operational} operational sites</strong>
        <span className="amber">{data.degraded} degraded</span>
        <span className="red">{data.offline} offline</span>
        <span>{fmt(data.utilization, 1)}% utilization</span>
        <span>{fmt(data.latency, 1)} ms latency</span>
        <span>{data.critical_incidents} critical incidents</span>
      </div>
      <section className="card">
        <div className="card-title">
          <div>
            <h3>Sites to watch</h3>
            <p>Highest utilization across the operation</p>
          </div>
          <Link to="/sites">
            All sites <ArrowRight size={14} />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Area</th>
                <th>Status</th>
                <th>Utilization</th>
                <th>Devices</th>
                <th>Latency</th>
                <th>Alarms</th>
              </tr>
            </thead>
            <tbody>
              {data.top_sites.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSite(s.id)}
                  className="clickable"
                >
                  <td className="mono">{s.code}</td>
                  <td>{s.area}</td>
                  <td>
                    <Badge status={s.status}>{s.status}</Badge>
                  </td>
                  <td>
                    <div className="utilization">
                      <div className="progress">
                        <i
                          style={{ width: `${s.metrics?.utilization || 0}%` }}
                        />
                      </div>
                      {fmt(s.metrics?.utilization || 0, 1)}%
                    </div>
                  </td>
                  <td>{s.devices}</td>
                  <td>{s.metrics?.latency || 0} ms</td>
                  <td>{s.alarms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
