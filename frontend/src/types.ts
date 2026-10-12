export interface Metric {
  timestamp: string;
  cpu: number;
  memory: number;
  latency: number;
  packet_loss: number;
  uplink: number;
  downlink: number;
  utilization: number;
  users: number;
  available: number;
}
export interface Site {
  id: number;
  code: string;
  name: string;
  area_id: number;
  area: string;
  latitude: number;
  longitude: number;
  status: string;
  scenario: string;
  technology: string;
  band: string;
  antenna_height: number;
  capacity_mbps: number;
  devices: number;
  alarms: number;
  metrics: Metric | null;
}
export interface Device {
  id: number;
  name: string;
  category: string;
  site_id: number;
  area_id: number;
  latitude: number;
  longitude: number;
  status: string;
  rsrp: number;
  rsrq: number;
  sinr: number;
  data_mb: number;
  applications: string[];
  last_connection: string;
}
export interface Area {
  id: number;
  name: string;
  geometry: GeoJSON.Polygon;
}
export interface Impact {
  site_id: number;
  site_code: string;
  scenario: string;
  status: string;
  severity: string;
  incident: string;
  affected_devices: number;
  affected_applications: number;
  affected_areas: number;
  applications: { id: number; name: string; devices: number }[];
  areas: Area[];
  device_ids: number[];
  estimated: boolean;
}
export interface History {
  time: string;
  availability: number;
  throughput: number;
  utilization: number;
  latency: number;
}
export interface Overview {
  total_sites: number;
  operational: number;
  degraded: number;
  offline: number;
  maintenance: number;
  availability: number;
  connected_devices: number;
  total_devices: number;
  active_alarms: number;
  critical_incidents: number;
  utilization: number;
  throughput: number;
  latency: number;
  adoption_pending: number;
  mttr_minutes: number;
  mtta_minutes: number;
  stale_sites: number;
  updated_at: string;
  history: History[];
  status_distribution: { name: string; value: number }[];
  alarm_distribution: { name: string; value: number }[];
  device_distribution: { name: string; value: number }[];
  area_utilization: { name: string; value: number }[];
  top_sites: Site[];
}
export interface Alarm {
  id: number;
  site_id: number;
  type: string;
  severity: string;
  description: string;
  status: string;
  owner: string;
  started_at: string;
  acknowledged_at: string | null;
  cleared_at: string | null;
}
export interface Incident {
  id: number;
  alarm_id: number | null;
  site_id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  owner: string;
  opened_at: string;
  resolved_at: string | null;
  events?: { id: number; timestamp: string; action: string }[];
}
export interface Application {
  id: number;
  name: string;
  description: string;
  category: string;
  area_id: number;
  owner: string;
  criticality: string;
  devices: number;
  affected_devices: number;
  status: string;
  site_ids: number[];
  data_mb: number;
}
export interface Adoption {
  id: number;
  title: string;
  type: string;
  area_id: number;
  application_id: number;
  requester: string;
  justification: string;
  expected_devices: number;
  priority: string;
  owner: string;
  latitude: number;
  longitude: number;
  stage: number;
  stage_name: string;
  progress: number;
  overdue: boolean;
  deviation_days: number;
  desired_at: string;
  activated_site_id: number | null;
  stages: {
    number: number;
    name: string;
    planned_at: string;
    completed_at: string | null;
  }[];
}
export interface Simulation {
  running: boolean;
  speed: number;
  tick: number;
  seed: number;
  events: {
    id: number;
    site_id: number | null;
    timestamp: string;
    action: string;
  }[];
}
export interface Equipment {
  id: number;
  site_id: number;
  name: string;
  category: string;
  vendor: string;
  model: string;
  serial: string;
  installed_at: string;
  maintained_at: string;
}
export interface SiteDetail {
  site: Site;
  devices: Device[];
  impact: Impact;
  history: History[];
  alarms: Alarm[];
  cells: { id: number; sector: number; azimuth: number }[];
}
export interface Page<T> {
  items: T[];
  total: number;
}
