import { useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Box,
  ChevronDown,
  CircleHelp,
  Cpu,
  Download,
  FlaskConical,
  LayoutDashboard,
  Map,
  Moon,
  RadioTower,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Truck,
  Workflow,
  X,
} from "lucide-react";
import { request, useData, useLive } from "./api";
import type {
  Area,
  Device,
  Overview,
  Page,
  Simulation,
  Site,
  SiteDetail,
} from "./types";
import { Badge, Button, date, fmt, Modal } from "./components/ui";
import { Trend } from "./components/Charts";
import { OverviewPage } from "./pages/OverviewPage";
import { MapPage } from "./pages/MapPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { SimulationPage } from "./pages/SimulationPage";
import { AdoptionPage } from "./pages/AdoptionPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { NocPage } from "./pages/NocPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AboutPage } from "./pages/AboutPage";
import { MineTruck } from "./components/MineTruck";

const navigation = [
  { path: "/", name: "Overview", icon: LayoutDashboard },
  { path: "/map", name: "Network Map", icon: Map },
  { path: "/noc", name: "NOC Monitoring", icon: Activity },
  { path: "/incidents", name: "Alarms & Incidents", icon: ShieldAlert },
  { path: "/sites", name: "LTE Sites", icon: RadioTower },
  { path: "/inventory", name: "Network Inventory", icon: Box },
  { path: "/devices", name: "Connected Devices", icon: Truck },
  { path: "/applications", name: "Industrial Applications", icon: Cpu },
  { path: "/adoption", name: "LTE Adoption", icon: Workflow },
  { path: "/analytics", name: "Analytics", icon: BarChart3 },
  { path: "/simulation", name: "Simulation Center", icon: FlaskConical },
  { path: "/settings", name: "Settings", icon: Settings },
  { path: "/about", name: "About MineOps", icon: CircleHelp },
];
const subtitles: Record<string, string> = {
  "/": "A complete view of connectivity across your mining operation.",
  "/map": "Explore the network. Understand its operational impact.",
  "/noc": "Live infrastructure health and synthetic network telemetry.",
  "/incidents":
    "From technical conditions to accountable operational response.",
  "/sites": "Private LTE infrastructure across the synthetic operation.",
  "/inventory": "Physical network assets, cells and infrastructure.",
  "/devices": "Industrial equipment and its serving-site dependencies.",
  "/applications": "The industrial services connected by your network.",
  "/adoption": "Bring network planning into operational delivery.",
  "/analytics": "Turn synthetic telemetry into engineering insight.",
  "/simulation":
    "Explore failures, dependencies and recovery in a controlled environment.",
  "/settings": "Configure the local demonstration environment.",
  "/about": "An original engineering portfolio connecting telecom and mining.",
};

export default function App() {
  const route = useLocation();
  const live = useLive();
  const [light, setLight] = useState(
    () => localStorage.getItem("mineops-theme") === "light",
  );
  const [hours, setHours] = useState(24);
  const [siteFilter, setSiteFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [device, setDevice] = useState<number | null>(null);
  const [profile, setProfile] = useState(false);
  const [search, setSearch] = useState("");
  const overview = useData<Overview>("/overview");
  const simulation = useData<Simulation>("/simulation");
  const sites = useData<Page<Site>>("/sites");
  const areas = useData<Area[]>("/areas");
  const detail = useData<SiteDetail>(`/sites/${selected}`, !!selected);
  const deviceDetail = useData<Device & { site: Site; area: Area }>(
    `/devices/${device}`,
    !!device,
  );
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (scenario: string) =>
      request("/simulation/scenario", "POST", { site_id: selected, scenario }),
    onSuccess: () => client.invalidateQueries(),
  });
  const current =
    navigation.find((n) => n.path === route.pathname) || navigation[0];
  const filters = { hours, siteFilter, areaFilter, severityFilter };
  const stale = overview.data?.stale_sites || 0;
  return (
    <div className={`app ${light ? "light" : ""}`}>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <MineTruck size={29} />
          </span>
          <div>
            Mine<span>Ops</span>
            <small>NETWORK OPERATIONS</small>
          </div>
        </Link>
        <div className="operation-select">
          <span className="operation-logo">A</span>
          <div>
            <strong>Aurora Mining</strong>
            <small>Synthetic operation</small>
          </div>
          <ChevronDown size={13} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {navigation.slice(0, 11).map((n, i) => (
            <NavLink to={n.path} end key={n.path}>
              <n.icon size={17} />
              <span>{n.name}</span>
              {n.path === "/incidents" && !!overview.data?.active_alarms && (
                <em>{overview.data.active_alarms}</em>
              )}
              {i === 7 && <span />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {navigation.slice(11).map((n) => (
            <NavLink to={n.path} key={n.path}>
              <n.icon size={17} />
              {n.name}
            </NavLink>
          ))}
          <div className="demo-banner">
            <FlaskConical size={17} />
            <div>
              <strong>Demonstration environment</strong>
              <small>100% synthetic data</small>
            </div>
          </div>
          <button className="profile" onClick={() => setProfile(true)}>
            <span>DO</span>
            <div>
              <strong>Demo Operator</strong>
              <small>Local demo profile</small>
            </div>
            <ChevronDown size={13} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="header">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{current.name}</strong>
          </div>
          <div className="header-right">
            <span
              className={`connection ${live === "Live" ? "green" : "amber"}`}
            >
              <i
                className={`dot ${live === "Live" ? "green-bg" : "amber-bg"}`}
              />
              {live}
            </span>
            <span className="sim-status">
              <FlaskConical size={13} />
              Simulator {simulation.data?.running ? "running" : "paused"}
            </span>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => {
                setLight(!light);
                localStorage.setItem(
                  "mineops-theme",
                  !light ? "light" : "dark",
                );
              }}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link
              className="notification"
              to="/incidents"
              aria-label="View notifications"
            >
              <Bell size={18} />
              {!!overview.data?.active_alarms && <i />}
            </Link>
            <button
              className="avatar"
              onClick={() => setProfile(true)}
              aria-label="View demo profile"
            >
              DO
            </button>
          </div>
        </header>
        <main>
          <div className="page-title">
            <div>
              <div className="eyebrow">MINING NETWORK OPERATIONS CENTER</div>
              <h1>{current.name}</h1>
              <p>{subtitles[current.path]}</p>
            </div>
            <div className="page-title-right">
              <Badge status="Info">LOCAL DEMO</Badge>
              <span className="muted small">
                Updated{" "}
                {overview.data?.updated_at
                  ? new Date(overview.data.updated_at).toLocaleTimeString()
                  : "—"}
              </span>
            </div>
          </div>
          {stale > 0 && (
            <div className="stale-banner" role="status">
              {stale} site(s) have stale telemetry. Check the simulator state or
              recover a telemetry scenario.
            </div>
          )}
          {["/", "/analytics"].includes(current.path) && (
            <div className="global-filters">
              <label>
                Period
                <select
                  aria-label="Period"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                >
                  {[6, 24, 72, 168].map((h) => (
                    <option key={h} value={h}>
                      Last {h === 168 ? "7 days" : h + " hours"}
                    </option>
                  ))}
                </select>
              </label>
              <select
                aria-label="Site filter"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
              >
                <option value="">All sites</option>
                {sites.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
              <select
                aria-label="Area filter"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                <option value="">All operational areas</option>
                {areas.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Severity filter"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="">All alarm severities</option>
                {["Critical", "Major", "Minor", "Warning", "Info"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <a className="text-button" href="/api/export">
                <Download size={14} />
                Export data
              </a>
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={<OverviewPage onSite={setSelected} {...filters} />}
            />
            <Route
              path="/map"
              element={<MapPage onSite={setSelected} onDevice={setDevice} />}
            />
            <Route path="/noc" element={<NocPage onSite={setSelected} />} />
            <Route
              path="/incidents"
              element={<IncidentsPage onSite={setSelected} />}
            />
            {(["sites", "inventory", "devices", "applications"] as const).map(
              (kind) => (
                <Route
                  key={kind}
                  path={"/" + kind}
                  element={
                    <ResourcesPage
                      kind={kind}
                      onSite={setSelected}
                      onDevice={setDevice}
                    />
                  }
                />
              ),
            )}
            <Route
              path="/adoption"
              element={<AdoptionPage onSite={setSelected} />}
            />
            <Route path="/analytics" element={<AnalyticsPage {...filters} />} />
            <Route
              path="/simulation"
              element={<SimulationPage onSite={setSelected} />}
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  Page not found. <Link to="/">Open overview</Link>
                </div>
              }
            />
          </Routes>
          <footer>
            <span>MineOps · Original synthetic engineering demonstration</span>
            <span>
              Aurora Mining is fictional · All times displayed locally
            </span>
          </footer>
        </main>
      </div>
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setSearch("");
          mutation.reset();
        }}
        title={detail.data?.site.code || "Site details"}
      >
        {detail.error && <div className="error">{detail.error.message}</div>}
        {detail.data && (
          <>
            <div className="flex between">
              <strong>{detail.data.site.name}</strong>
              <Badge status={detail.data.site.status}>
                {detail.data.site.status}
              </Badge>
            </div>
            <dl className="details">
              <dt>Technology / band</dt>
              <dd>
                {detail.data.site.technology} / {detail.data.site.band}
              </dd>
              <dt>Area / position</dt>
              <dd>
                {detail.data.site.area} · {detail.data.site.latitude},{" "}
                {detail.data.site.longitude}
              </dd>
              <dt>Antenna / capacity</dt>
              <dd>
                {detail.data.site.antenna_height} m /{" "}
                {detail.data.site.capacity_mbps} Mbps
              </dd>
              <dt>LTE cells</dt>
              <dd>
                {detail.data.cells
                  .map((c) => `Sector ${c.sector}: ${c.azimuth}°`)
                  .join(" · ")}
              </dd>
              <dt>Current traffic</dt>
              <dd>
                UL {fmt(detail.data.site.metrics?.uplink || 0, 1)} / DL{" "}
                {fmt(detail.data.site.metrics?.downlink || 0, 1)} Mbps
              </dd>
              <dt>Telemetry timestamp</dt>
              <dd>{date(detail.data.site.metrics?.timestamp)}</dd>
            </dl>
            <div className="impact-summary">
              <strong>Impact Analysis</strong>
              <span>{detail.data.impact.affected_devices} devices</span>
              <span>
                {detail.data.impact.affected_applications} applications
              </span>
              <span>{detail.data.impact.affected_areas} areas</span>
            </div>
            <Trend
              data={detail.data.history}
              field="utilization"
              height={150}
            />
            <div className="flex">
              <Button
                variant="danger"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate("backhaul")}
              >
                Simulate backhaul failure
              </Button>
              <Button
                variant="secondary"
                disabled={
                  mutation.isPending ||
                  detail.data.site.status === "operational"
                }
                onClick={() => mutation.mutate("recover")}
              >
                Recover site
              </Button>
            </div>
            {mutation.error && (
              <div className="error">{mutation.error.message}</div>
            )}
            <h4>Linked equipment ({detail.data.devices.length})</h4>
            <label className="search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search linked devices"
              />
            </label>
            <div className="table-wrap detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Application</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.devices
                    .filter((d) =>
                      d.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((d) => (
                      <tr
                        key={d.id}
                        className="clickable"
                        onClick={() => {
                          setDevice(d.id);
                          setSelected(null);
                        }}
                      >
                        <td>{d.name}</td>
                        <td>{d.applications.join(", ")}</td>
                        <td>
                          <Badge status={d.status}>{d.status}</Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <h4>Site alarms</h4>
            {detail.data.alarms.slice(0, 5).map((a) => (
              <div className="flex between alarm-line" key={a.id}>
                <span>{a.type}</span>
                <Badge status={a.severity}>{a.severity}</Badge>
                <span>{a.status}</span>
              </div>
            ))}
          </>
        )}
      </Modal>
      <Modal
        open={!!device}
        onClose={() => setDevice(null)}
        title={deviceDetail.data?.name || "Device details"}
      >
        {deviceDetail.data && (
          <>
            <Badge status={deviceDetail.data.status}>
              {deviceDetail.data.status}
            </Badge>
            <dl className="details">
              <dt>Category</dt>
              <dd>{deviceDetail.data.category}</dd>
              <dt>Applications</dt>
              <dd>{deviceDetail.data.applications.join(", ")}</dd>
              <dt>Area</dt>
              <dd>{deviceDetail.data.area.name}</dd>
              <dt>Position</dt>
              <dd>
                {deviceDetail.data.latitude.toFixed(6)},{" "}
                {deviceDetail.data.longitude.toFixed(6)}
              </dd>
              <dt>RSRP / RSRQ / SINR</dt>
              <dd>
                {deviceDetail.data.rsrp} dBm / {deviceDetail.data.rsrq} dB /{" "}
                {deviceDetail.data.sinr} dB
              </dd>
              <dt>Last connection</dt>
              <dd>{date(deviceDetail.data.last_connection)}</dd>
            </dl>
            <Button
              onClick={() => {
                setSelected(deviceDetail.data!.site_id);
                setDevice(null);
              }}
            >
              Open {deviceDetail.data.site.code}
            </Button>
          </>
        )}
      </Modal>
      <Modal
        open={profile}
        onClose={() => setProfile(false)}
        title="Demo Operator"
      >
        <p>
          This local demonstration uses a shared operator profile. Actions are
          persisted and audited with fictional records.
        </p>
        <Badge status="Info">Synthetic environment</Badge>
        <Button variant="ghost" onClick={() => setProfile(false)}>
          <X size={14} />
          Close profile
        </Button>
      </Modal>
    </div>
  );
}
