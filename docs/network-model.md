# Original network and impact model

Aurora Mining is a fictional operation using a simplified private LTE inventory. Coordinates are numerically consistent WGS84 values generated for a synthetic scene; they do not describe a real mine or antenna installation. There are no imported sites, corporate equipment IDs, private topologies or customer documents.

Each initial site has three synthetic cells, configurable demo capacity, a fictional B28 band label, antenna height and transmit power. These are illustrative parameters, not frequency authorization or real RF configuration guidance.

Site infrastructure metrics: CPU, memory, latency, packet loss, aggregate uplink/downlink, capacity utilization and current simulated users. Device measurements: RSRP (dBm), RSRQ (dB), SINR (dB), traffic consumption and connection state. Measurements are deliberately kept at their relevant entity level. Cell inventory contains sector identifiers and azimuths; it does not pretend to measure a real cell radio interface.

Coverage polygons are the Shapely union of three directional antenna lobes, with a nominal 900m outer radius and azimuths from cell inventory. Three nested display bands illustrate strong, moderate and edge signal. The valid union is persisted and indexed in PostGIS; the same footprint powers expansion overlap through `ST_Covers`. Distances shown in nearby-site assessment remain approximate planar conversions (`coordinate distance × 105000 m`), explicitly labeled. The directional shapes and RSRP bands do not establish real RF coverage, capacity or deployment feasibility. See [map experience](map-experience.md).

The impact graph is `site → currently associated devices → application_devices → industrial applications`. A site outage disconnects its devices; a degraded site affects service quality. Impact counts distinct affected device IDs, distinct applications linked to them, and distinct device area IDs. Multi-application devices count once globally but can appear in several application rows, so application subtotals may overlap after onboarding.

The seeded site 014 is associated with 42 devices in Equipment Yard: 24 Fleet Management, 12 Industrial Telemetry, 6 Video Monitoring. After a fault, the panel shows 42/3/1 by querying those relationships. Recovery makes the current impact zero; the incident timeline remains historical. The panel is a current dependency estimate, not a saved point-in-time incident impact snapshot.

No automatic handover or redundancy is assumed. An adjacent illustrative coverage buffer does not silently reconnect devices. Serving-site reassignment, failover, packet traces, actual alarms, propagation modeling, subscriber data and hardware management are outside this demo. Only use generated or public appropriately licensed future additions; never add real customer coordinates or confidential workflows.
