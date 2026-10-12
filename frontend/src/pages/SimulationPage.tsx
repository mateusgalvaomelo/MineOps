import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Signal,
  Truck,
  Zap,
} from "lucide-react";
import { request, useData } from "../api";
import type { Impact, Page, Simulation, Site } from "../types";
import { Badge, Button, date, Modal } from "../components/ui";

export function SimulationPage({ onSite }: { onSite: (id: number) => void }) {
  const [site, setSite] = useState(14);
  const [reset, setReset] = useState(false);
  const client = useQueryClient();
  const sites = useData<Page<Site>>("/sites");
  const simulation = useData<Simulation>("/simulation");
  const impact = useData<Impact>(`/sites/${site}/impact`);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) =>
      request(path, "POST", body),
    onSuccess: () => {
      client.invalidateQueries();
      setReset(false);
    },
  });
  const scenarios = [
    {
      id: "backhaul",
      title: "Backhaul Down",
      text: "Disconnect a serving site and expose industrial dependencies.",
      icon: ShieldAlert,
    },
    {
      id: "offline",
      title: "Site Offline",
      text: "Generate a critical alarm and disconnect linked equipment.",
      icon: Signal,
    },
    {
      id: "congestion",
      title: "Capacity Congestion",
      text: "Raise utilization and latency to degrade service quality.",
      icon: Activity,
    },
    {
      id: "power",
      title: "Power Failure",
      text: "Simulate loss of site infrastructure power.",
      icon: Zap,
    },
    {
      id: "devices",
      title: "Device Growth",
      text: "Add 25 persisted IoT devices and stress site capacity.",
      icon: Truck,
    },
    {
      id: "recover",
      title: "Site Recovery",
      text: "Restore connectivity and clear the technical alarm.",
      icon: RotateCcw,
    },
    {
      id: "signal",
      title: "Signal Degradation",
      text: "Reduce device RSRP, RSRQ and SINR.",
      icon: Signal,
    },
    {
      id: "latency",
      title: "High Latency",
      text: "Raise site latency above the demo threshold.",
      icon: Activity,
    },
    {
      id: "packet_loss",
      title: "Packet Loss",
      text: "Simulate packet delivery degradation.",
      icon: Activity,
    },
    {
      id: "telemetry",
      title: "Telemetry Unavailable",
      text: "Stop site samples and observe the stale telemetry indicator.",
      icon: Pause,
    },
  ];
  return (
    <>
      <section className="card simulation-controls">
        <div>
          <span className="eyebrow">
            DETERMINISTIC ENGINE · SEED {simulation.data?.seed}
          </span>
          <h3>Control your operational scenario</h3>
          <p>All changes are processed and persisted by the backend.</p>
        </div>
        <div className="flex wrap">
          <Badge
            status={simulation.data?.running ? "operational" : "maintenance"}
          >
            {simulation.data?.running ? "Running" : "Paused"}
          </Badge>
          <Button
            variant="secondary"
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: "/simulation/control",
                body: { action: simulation.data?.running ? "pause" : "resume" },
              })
            }
          >
            {simulation.data?.running ? (
              <Pause size={14} />
            ) : (
              <Play size={14} />
            )}{" "}
            {simulation.data?.running ? "Pause" : "Resume"}
          </Button>
          <select
            aria-label="Simulation speed"
            value={simulation.data?.speed || 1}
            onChange={(e) =>
              action.mutate({
                path: "/simulation/control",
                body: { action: "speed", speed: Number(e.target.value) },
              })
            }
          >
            {[0.25, 1, 2, 5, 10].map((n) => (
              <option value={n} key={n}>
                {n}× movement
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={() => setReset(true)}>
            <RotateCcw size={14} />
            Reset demo
          </Button>
        </div>
      </section>
      <div className="resource-toolbar">
        <label>
          Target site{" "}
          <select
            aria-label="Target site"
            value={site}
            onChange={(e) => setSite(Number(e.target.value))}
          >
            {sites.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.area}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={() => onSite(site)}>
          Inspect dependencies
        </Button>
        <span className="muted">Tick {simulation.data?.tick || 0}</span>
      </div>
      {action.error && (
        <div className="error" role="alert">
          {action.error.message}
        </div>
      )}
      <div className="scenario-grid">
        {scenarios.map((s) => (
          <section className="card scenario-card" key={s.id}>
            <s.icon
              size={25}
              className={s.id === "recover" ? "green" : "blue"}
            />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <Button
              variant={s.id === "recover" ? "secondary" : "default"}
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  path: "/simulation/scenario",
                  body: { site_id: site, scenario: s.id },
                })
              }
            >
              {s.id === "recover" ? "Recover site" : "Run scenario"}
            </Button>
          </section>
        ))}
      </div>
      {impact.data && (
        <div className="impact-summary">
          <strong>Current estimated impact</strong>
          <span>{impact.data.affected_devices} devices</span>
          <span>{impact.data.affected_applications} applications</span>
          <span>{impact.data.affected_areas} areas</span>
          <Badge status={impact.data.severity}>{impact.data.incident}</Badge>
        </div>
      )}
      <section className="card">
        <div className="card-title">
          <div>
            <h3>Simulation event log</h3>
            <p>Persisted and auditable scenario history</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {simulation.data?.events.map((e) => (
                <tr key={e.id}>
                  <td>{date(e.timestamp)}</td>
                  <td>{e.action.replaceAll("_", " ")}</td>
                  <td>
                    {e.site_id
                      ? `SITE-LTE-${String(e.site_id).padStart(3, "0")}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!simulation.data?.events.length && (
            <div className="empty">
              Run a scenario to generate your first event.
            </div>
          )}
        </div>
      </section>
      <Modal
        open={reset}
        onClose={() => setReset(false)}
        title="Restore the initial demo scenario"
      >
        <p>
          This removes demo operational changes, incidents and expansion
          requests, then recreates the original synthetic dataset. Audit logs
          are preserved.
        </p>
        <Button
          variant="danger"
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              path: "/simulation/control",
              body: { action: "reset" },
            })
          }
        >
          Restore synthetic seed
        </Button>
      </Modal>
    </>
  );
}
