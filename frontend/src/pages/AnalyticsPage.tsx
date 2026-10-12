import { useState } from "react";
import { useData } from "../api";
import type { Adoption, Application, Incident, Overview } from "../types";
import { Badge, fmt } from "../components/ui";
import { Bars, Trend } from "../components/Charts";

export function AnalyticsPage({
  hours,
  siteFilter,
  areaFilter,
  severityFilter,
}: {
  hours: number;
  siteFilter: string;
  areaFilter: string;
  severityFilter: string;
}) {
  const [tab, setTab] = useState("Network");
  const data = useData<
    Overview & {
      applications: Application[];
      adoption: Adoption[];
      incidents: Incident[];
    }
  >(
    `/analytics?hours=${hours}${siteFilter ? "&site_id=" + siteFilter : ""}${areaFilter ? "&area_id=" + areaFilter : ""}${severityFilter ? "&severity=" + severityFilter : ""}`,
  );
  if (data.error) return <div className="error">{data.error.message}</div>;
  if (!data.data)
    return <div className="loading">Aggregating synthetic telemetry…</div>;
  const result = data.data;
  return (
    <>
      <div className="tabs">
        {["Network", "Traffic", "Incidents", "Devices", "Adoption"].map((t) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="kpi-grid analytics-kpis">
        {[
          {
            label: "Sampled availability",
            value: fmt(result.availability, 2) + "%",
          },
          {
            label: "Average utilization",
            value: fmt(result.utilization, 1) + "%",
          },
          {
            label: "MTTR (resolved in period)",
            value: result.mttr_minutes + " min",
          },
          {
            label: "MTTA (alarms in period)",
            value: result.mtta_minutes + " min",
          },
          { label: "Mean latency", value: result.latency + " ms" },
          { label: "Stale site telemetry", value: result.stale_sites },
        ].map((k) => (
          <div className="kpi" key={k.label}>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        {tab === "Network" && (
          <>
            <section className="card">
              <div className="card-title">
                <h3>Availability · sampled %</h3>
              </div>
              <Trend
                data={result.history}
                field="availability"
                color="#22c55e"
              />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Site status distribution</h3>
              </div>
              <Bars data={result.status_distribution} />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Capacity utilization by area</h3>
              </div>
              <Bars data={result.area_utilization} />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Mean site latency · ms</h3>
              </div>
              <Trend data={result.history} field="latency" color="#f59e0b" />
            </section>
          </>
        )}
        {tab === "Traffic" && (
          <>
            <section className="card">
              <div className="card-title">
                <h3>Uplink · Mbps</h3>
              </div>
              <Trend data={result.history} field="uplink" color="#22c55e" />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Downlink · Mbps</h3>
              </div>
              <Trend data={result.history} field="downlink" color="#a78bfa" />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Total throughput · Mbps</h3>
              </div>
              <Trend data={result.history} />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Capacity utilization · %</h3>
              </div>
              <Trend
                data={result.history}
                field="utilization"
                color="#a78bfa"
              />
            </section>
            <section className="card wide">
              <div className="card-title">
                <h3>Application data consumption · MB</h3>
              </div>
              <Bars
                height={390}
                data={result.applications.map((a) => ({
                  name: a.name,
                  value: Math.round(a.data_mb),
                }))}
              />
            </section>
          </>
        )}
        {tab === "Incidents" && (
          <>
            <section className="card">
              <div className="card-title">
                <h3>Active alarms by severity</h3>
              </div>
              <Bars data={result.alarm_distribution} />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Incidents opened in selected period</h3>
              </div>
              <Bars
                data={["Critical", "Major", "Minor", "Warning", "Info"].map(
                  (s) => ({
                    name: s,
                    value: result.incidents.filter((i) => i.severity === s)
                      .length,
                  }),
                )}
              />
            </section>
            <section className="card wide">
              <div className="card-title">
                <h3>Incident trend · opened per day</h3>
              </div>
              <Bars
                data={Array.from(
                  new Set(
                    result.incidents.map((i) => i.opened_at.slice(0, 10)),
                  ),
                )
                  .sort()
                  .map((day) => ({
                    name: day,
                    value: result.incidents.filter((i) =>
                      i.opened_at.startsWith(day),
                    ).length,
                  }))}
              />
            </section>
          </>
        )}
        {tab === "Devices" && (
          <>
            <section className="card wide">
              <div className="card-title">
                <h3>Connected users over time · hourly samples</h3>
              </div>
              <Trend data={result.history} field="users" />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Devices by category</h3>
              </div>
              <Bars height={300} data={result.device_distribution} />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Linked devices by application</h3>
              </div>
              <Bars
                height={390}
                data={result.applications.map((a) => ({
                  name: a.name,
                  value: a.devices,
                }))}
              />
            </section>
          </>
        )}
        {tab === "Adoption" && (
          <>
            <section className="card">
              <div className="card-title">
                <h3>Expansion workflow</h3>
              </div>
              <Bars
                data={[
                  {
                    name: "In progress",
                    value: result.adoption.filter((a) => a.stage < 8).length,
                  },
                  {
                    name: "Completed",
                    value: result.adoption.filter((a) => a.stage === 8).length,
                  },
                  {
                    name: "Overdue",
                    value: result.adoption.filter((a) => a.overdue).length,
                  },
                ]}
              />
            </section>
            <section className="card">
              <div className="card-title">
                <h3>Demand by request type</h3>
              </div>
              <Bars
                data={Array.from(
                  new Set(result.adoption.map((a) => a.type)),
                ).map((type) => ({
                  name: type,
                  value: result.adoption.filter((a) => a.type === type).length,
                }))}
              />
            </section>
          </>
        )}
      </div>
      <p className="muted small">
        <Badge status="Info">Synthetic analytics</Badge> Availability is the
        average of hourly site sample fractions. MTTR and MTTA use persisted UTC
        event timestamps. See docs/data-engineering.md for formulas and limits.
      </p>
    </>
  );
}
