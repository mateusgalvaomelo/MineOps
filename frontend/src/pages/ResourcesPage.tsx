import { useState } from "react";
import { Search } from "lucide-react";
import { useData } from "../api";
import type { Application, Device, Equipment, Page, Site } from "../types";
import { Badge, Button, date, fmt, Modal } from "../components/ui";

export function ResourcesPage({
  kind,
  onSite,
  onDevice,
}: {
  kind: "sites" | "inventory" | "devices" | "applications";
  onSite: (id: number) => void;
  onDevice: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [app, setApp] = useState<Application | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const query = `?search=${encodeURIComponent(search)}&offset=${offset}&limit=50${status ? "&status=" + status : ""}${category ? "&category=" + encodeURIComponent(category) : ""}`;
  const sites = useData<Page<Site>>("/sites" + query, kind === "sites");
  const devices = useData<Page<Device>>("/devices" + query, kind === "devices");
  const inventory = useData<Page<Equipment>>(
    "/inventory" + query,
    kind === "inventory",
  );
  const applications = useData<Application[]>(
    "/applications",
    kind === "applications",
  );
  const error =
    sites.error || devices.error || inventory.error || applications.error;
  const total =
    kind === "sites"
      ? sites.data?.total
      : kind === "devices"
        ? devices.data?.total
        : inventory.data?.total;
  return (
    <>
      <div className="resource-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            placeholder={`Search ${kind}…`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        {["sites", "devices"].includes(kind) && (
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All statuses</option>
            {(kind === "sites"
              ? ["operational", "degraded", "offline", "maintenance"]
              : ["connected", "degraded", "disconnected"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {["devices", "inventory"].includes(kind) && (
          <select
            aria-label="Filter category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All categories</option>
            {(kind === "devices"
              ? [
                  "Haul truck",
                  "Excavator",
                  "Drill rig",
                  "Light vehicle",
                  "Camera",
                  "Sensor",
                  "Industrial tablet",
                  "IoT gateway",
                ]
              : ["eNodeB", "Router", "Switch", "UPS", "Backhaul", "Antenna"]
            ).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
        <a className="button secondary" href="/api/export">
          Download demo dataset
        </a>
      </div>
      {error && <div className="error">{error.message}</div>}
      {kind === "applications" ? (
        <div className="application-grid">
          {applications.data
            ?.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
            .map((a) => (
              <button
                className="card application-card"
                key={a.id}
                onClick={() => setApp(a)}
              >
                <div className="flex between">
                  <span className="app-icon">{a.name.charAt(0)}</span>
                  <Badge status={a.status}>{a.status}</Badge>
                </div>
                <h3>{a.name}</h3>
                <p>{a.description}</p>
                <div className="flex between">
                  <span>{a.devices} devices</span>
                  <span className={a.affected_devices ? "red" : "muted"}>
                    {a.affected_devices} affected
                  </span>
                </div>
                <div className="progress">
                  <i
                    style={{
                      width: `${(a.affected_devices / Math.max(1, a.devices)) * 100}%`,
                      background: "#ef4444",
                    }}
                  />
                </div>
              </button>
            ))}
        </div>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(kind === "sites"
                    ? [
                        "Site",
                        "Area",
                        "Status",
                        "Capacity",
                        "Utilization",
                        "Devices",
                        "Alarms",
                      ]
                    : kind === "devices"
                      ? [
                          "Device",
                          "Category",
                          "Application",
                          "Serving site",
                          "Status",
                          "RSRP",
                          "SINR",
                          "Data",
                        ]
                      : [
                          "Equipment",
                          "Category",
                          "Site",
                          "Vendor / Model",
                          "Serial",
                          "Installed",
                        ]
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kind === "sites" &&
                  sites.data?.items.map((s) => (
                    <tr
                      className="clickable"
                      key={s.id}
                      onClick={() => onSite(s.id)}
                    >
                      <td className="mono">{s.code}</td>
                      <td>{s.area}</td>
                      <td>
                        <Badge status={s.status}>{s.status}</Badge>
                      </td>
                      <td>{s.capacity_mbps} Mbps</td>
                      <td>{fmt(s.metrics?.utilization || 0, 1)}%</td>
                      <td>{s.devices}</td>
                      <td>{s.alarms}</td>
                    </tr>
                  ))}
                {kind === "devices" &&
                  devices.data?.items.map((d) => (
                    <tr
                      key={d.id}
                      className="clickable"
                      onClick={() => onDevice(d.id)}
                    >
                      <td>{d.name}</td>
                      <td>{d.category}</td>
                      <td>{d.applications.join(", ")}</td>
                      <td className="mono">
                        SITE-LTE-{String(d.site_id).padStart(3, "0")}
                      </td>
                      <td>
                        <Badge status={d.status}>{d.status}</Badge>
                      </td>
                      <td>{d.rsrp} dBm</td>
                      <td>{d.sinr} dB</td>
                      <td>{fmt(d.data_mb, 1)} MB</td>
                    </tr>
                  ))}
                {kind === "inventory" &&
                  inventory.data?.items.map((e) => (
                    <tr
                      key={e.id}
                      className="clickable"
                      onClick={() => setEquipment(e)}
                    >
                      <td>{e.name}</td>
                      <td>{e.category}</td>
                      <td className="mono">
                        SITE-LTE-{String(e.site_id).padStart(3, "0")}
                      </td>
                      <td>
                        {e.vendor} / {e.model}
                      </td>
                      <td className="mono">{e.serial}</td>
                      <td>{date(e.installed_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {total === 0 && <div className="empty">No matching records.</div>}
          </div>
          <div className="pagination">
            <span>
              {offset + 1}–{Math.min(offset + 50, total || 0)} of {total || 0}
            </span>
            <Button
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={offset + 50 >= (total || 0)}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </Button>
          </div>
        </section>
      )}
      <Modal
        open={!!app}
        onClose={() => setApp(null)}
        title={app?.name || "Application"}
      >
        {app && (
          <>
            <p>{app.description}</p>
            <dl className="details">
              <dt>Owner</dt>
              <dd>{app.owner}</dd>
              <dt>Criticality</dt>
              <dd>{app.criticality}</dd>
              <dt>Devices</dt>
              <dd>{app.devices}</dd>
              <dt>Affected</dt>
              <dd>{app.affected_devices}</dd>
              <dt>Data consumed</dt>
              <dd>{fmt(app.data_mb, 1)} MB</dd>
            </dl>
            <h4>Related LTE sites</h4>
            <div className="flex wrap">
              {app.site_ids.map((id) => (
                <Button key={id} variant="secondary" onClick={() => onSite(id)}>
                  SITE-LTE-{String(id).padStart(3, "0")}
                </Button>
              ))}
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={!!equipment}
        onClose={() => setEquipment(null)}
        title={equipment?.name || "Equipment"}
      >
        {equipment && (
          <>
            <dl className="details">
              {Object.entries(equipment).map(([k, v]) => (
                <div className="detail-pair" key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
            <Button onClick={() => onSite(equipment.site_id)}>
              Open serving site
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}
