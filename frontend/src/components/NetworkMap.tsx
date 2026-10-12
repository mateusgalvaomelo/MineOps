import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Crosshair,
  Layers,
  LocateFixed,
  Maximize,
  Minimize,
  Radar,
  X,
} from "lucide-react";
import { useData } from "../api";
import type { Adoption, Device, Site } from "../types";

maplibregl.setWorkerUrl(workerUrl);
const EMPTY_ADOPTION: Adoption[] = [];
const EMPTY_IDS: number[] = [];

function fitNetwork(
  instance: maplibregl.Map,
  sites: Site[],
  compact: boolean,
  duration = 0,
  geography?: GeoJSON.FeatureCollection,
) {
  instance.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  const bounds = new maplibregl.LngLatBounds();
  const extend = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number")
      bounds.extend([value[0], value[1]]);
    else value.forEach(extend);
  };
  geography?.features
    .filter((f) => f.properties?.kind === "mine-boundary")
    .forEach((f) => {
      if ("coordinates" in f.geometry) extend(f.geometry.coordinates);
    });
  if (bounds.isEmpty() && !sites.length) {
    bounds.extend([-43.525, -20.225]);
    bounds.extend([-43.45, -20.15]);
  }
  sites.forEach((site) => {
    bounds.extend([site.longitude - 0.003, site.latitude - 0.003]);
    bounds.extend([site.longitude + 0.003, site.latitude + 0.003]);
  });
  instance.fitBounds(bounds, {
    padding: compact
      ? { top: 65, bottom: 65, left: 25, right: 25 }
      : { top: 90, bottom: 90, left: 35, right: 40 },
    maxZoom: 14,
    pitch: 0,
    bearing: 0,
    duration,
  });
}

const colors = [
  "match",
  ["get", "status"],
  "operational",
  "#22c55e",
  "degraded",
  "#f59e0b",
  "offline",
  "#ef4444",
  "maintenance",
  "#94a3b8",
  "#38bdf8",
];
const collection = (
  features: GeoJSON.Feature[],
): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
export function NetworkMap({
  sites,
  devices,
  geography,
  adoption = EMPTY_ADOPTION,
  selected,
  onSite,
  onDevice,
  onPoint,
  compact = false,
  affected = EMPTY_IDS,
  activeSector = null,
}: {
  sites: Site[];
  devices: Device[];
  geography?: GeoJSON.FeatureCollection;
  adoption?: Adoption[];
  selected?: number | null;
  onSite: (id: number) => void;
  onDevice?: (id: number) => void;
  onPoint?: (lon: number, lat: number) => void;
  compact?: boolean;
  affected?: number[];
  activeSector?: number | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const geographyRef = useRef(geography);
  geographyRef.current = geography;
  const overviewCamera = useRef(true);
  const siteMarkers = useRef(new Map<number, maplibregl.Marker>());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [basemap, setBasemap] = useState(
    () => localStorage.getItem("mineops-basemap") || "mine",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLegends, setShowLegends] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<{
    longitude: number;
    latitude: number;
  } | null>(null);
  const probeResult = useData<{
    quality: string;
    estimated_rsrp: number | null;
    site_code: string | null;
    sector: number | null;
    azimuth: number | null;
    site_status: string | null;
    covering_sites: number;
    offline_footprints: number;
  }>(
    `/coverage/probe?longitude=${probe?.longitude}&latitude=${probe?.latitude}`,
    !!probe,
  );
  const [cursor, setCursor] = useState({
    longitude: -43.498,
    latitude: -20.142,
  });
  const lastCursorUpdate = useRef(0);
  const callbacks = useRef({ onSite, onDevice, onPoint, probing, setProbe });
  callbacks.current = { onSite, onDevice, onPoint, probing, setProbe };
  const [layers, setLayers] = useState({
    Sites: true,
    Coverage: false,
    Devices: false,
    Alarms: true,
    Areas: true,
    Roads: true,
    Expansion: true,
    Terrain: true,
  });
  useEffect(() => {
    if (activeSector !== null)
      setLayers((previous) => ({ ...previous, Coverage: true }));
  }, [activeSector]);
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#0c1824" },
            },
          ],
        },
        center: [-43.49, -20.185],
        zoom: 13.35,
        attributionControl: { compact: false },
      });
      map.current = instance;
      instance.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      instance.addControl(
        new maplibregl.ScaleControl({ unit: "metric", maxWidth: 100 }),
        "bottom-left",
      );
      instance.on("mousemove", (e) => {
        if (Date.now() - lastCursorUpdate.current > 100) {
          lastCursorUpdate.current = Date.now();
          setCursor({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
        }
      });
      instance.on("load", () => {
        fitNetwork(
          instance,
          sitesRef.current,
          compact,
          0,
          geographyRef.current,
        );
        for (const id of ["geography", "sites", "devices", "adoption"])
          instance.addSource(id, { type: "geojson", data: collection([]) });
        instance.addLayer({
          id: "land",
          type: "fill",
          source: "geography",
          filter: ["==", ["get", "kind"], "land"],
          paint: { "fill-color": "#233529" },
        });
        instance.addLayer({
          id: "contours",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "contour"],
          paint: {
            "line-color": "#768466",
            "line-width": 1,
            "line-opacity": 0.23,
          },
        });
        instance.addLayer({
          id: "pit",
          type: "fill",
          source: "geography",
          filter: ["==", ["get", "kind"], "pit"],
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "bench"],
              0,
              "#7d7257",
              3,
              "#5f5645",
              7,
              "#343b35",
            ],
            "fill-opacity": 0.95,
          },
        });
        instance.addLayer({
          id: "benches",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "pit"],
          paint: {
            "line-color": "#c7b98e",
            "line-width": 1,
            "line-opacity": 0.5,
          },
        });
        instance.addLayer({
          id: "water",
          type: "fill",
          source: "geography",
          filter: ["==", ["get", "kind"], "water"],
          paint: { "fill-color": "#285b69", "fill-opacity": 0.9 },
        });
        instance.addLayer({
          id: "pads",
          type: "fill",
          source: "geography",
          filter: ["==", ["get", "kind"], "facility-pad"],
          paint: { "fill-color": "#777465", "fill-opacity": 0.65 },
        });
        instance.addLayer({
          id: "buildings",
          type: "fill-extrusion",
          source: "geography",
          filter: ["==", ["get", "kind"], "building"],
          paint: {
            "fill-extrusion-color": "#a3acaa",
            "fill-extrusion-height": 18,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.9,
          },
        });
        instance.addLayer({
          id: "haul-roads-edge",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "haul-road"],
          paint: { "line-color": "#292c25", "line-width": 8 },
        });
        instance.addLayer({
          id: "haul-roads",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "haul-road"],
          paint: { "line-color": "#b2a17c", "line-width": 5 },
        });
        instance.addLayer({
          id: "areas",
          type: "fill",
          source: "geography",
          filter: ["==", ["get", "kind"], "area"],
          paint: {
            "fill-color": [
              "match",
              ["get", "id"],
              1,
              "#283128",
              2,
              "#23313b",
              3,
              "#282c36",
              "#26322f",
            ],
            "fill-opacity": 0.07,
          },
        });
        instance.addLayer({
          id: "area-borders",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "area"],
          paint: {
            "line-color": "#40505c",
            "line-width": 1,
            "line-dasharray": [4, 3],
          },
        });
        instance.addLayer({
          id: "mine-perimeter",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "mine-boundary"],
          paint: {
            "line-color": "#fbbf24",
            "line-width": 2,
            "line-dasharray": [5, 3],
            "line-opacity": 0.8,
          },
        });
        instance.addLayer({
          id: "coverage",
          type: "fill",
          source: "geography",
          filter: ["==", ["get", "kind"], "coverage"],
          paint: {
            "fill-color": [
              "match",
              ["get", "status"],
              "offline",
              "#ef4444",
              "degraded",
              "#f59e0b",
              [
                "match",
                ["get", "band"],
                "strong",
                "#22c55e",
                "moderate",
                "#38bdf8",
                "#818cf8",
              ],
            ],
            "fill-opacity": ["case", ["get", "selected"], 0.22, 0.065],
          },
        });
        instance.addLayer({
          id: "coverage-borders",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "coverage"],
          paint: {
            "line-color": [
              "match",
              ["get", "status"],
              "offline",
              "#f87171",
              "degraded",
              "#fbbf24",
              [
                "match",
                ["get", "band"],
                "strong",
                "#4ade80",
                "moderate",
                "#38bdf8",
                "#a5b4fc",
              ],
            ],
            "line-opacity": ["case", ["get", "selected"], 0.8, 0.2],
            "line-width": 1,
          },
        });
        instance.addLayer({
          id: "roads",
          type: "line",
          source: "geography",
          filter: ["==", ["get", "kind"], "road"],
          paint: {
            "line-color": "#7b7567",
            "line-width": 3,
            "line-opacity": 0.65,
          },
        });
        instance.addLayer({
          id: "devices",
          type: "circle",
          source: "devices",
          paint: {
            "circle-radius": ["case", ["get", "affected"], 4, 2.5],
            "circle-color": ["case", ["get", "affected"], "#ef4444", "#87a6b2"],
            "circle-opacity": 0.8,
          },
        });
        instance.addLayer({
          id: "alarm-halo",
          type: "circle",
          source: "sites",
          filter: [">", ["get", "alarms"], 0],
          paint: {
            "circle-radius": 19,
            "circle-color": "#ef4444",
            "circle-opacity": 0.14,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ef4444",
          },
        });
        instance.addLayer({
          id: "selection",
          type: "circle",
          source: "sites",
          filter: ["==", ["get", "selected"], true],
          paint: {
            "circle-radius": 17,
            "circle-color": "#38bdf8",
            "circle-opacity": 0.15,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#38bdf8",
          },
        });
        instance.addLayer({
          id: "sites",
          type: "circle",
          source: "sites",
          paint: {
            "circle-radius": 8,
            "circle-color": colors as maplibregl.ExpressionSpecification,
            "circle-stroke-width": 3,
            "circle-stroke-color": "#0b1220",
          },
        });
        instance.addLayer({
          id: "adoption",
          type: "circle",
          source: "adoption",
          paint: {
            "circle-radius": 6,
            "circle-color": "#a78bfa",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#e9d5ff",
          },
        });
        instance.on("click", "sites", (e) => {
          if (callbacks.current.probing) return;
          const id = Number(e.features?.[0]?.properties?.id);
          if (id) callbacks.current.onSite(id);
        });
        instance.on("click", "coverage", (e) => {
          if (callbacks.current.onPoint || callbacks.current.probing) return;
          const id = Number(e.features?.[0]?.properties?.site_id);
          if (id) callbacks.current.onSite(id);
        });
        instance.on("click", "devices", (e) => {
          if (callbacks.current.probing) return;
          const id = Number(e.features?.[0]?.properties?.id);
          if (id) callbacks.current.onDevice?.(id);
        });
        instance.on("click", (e) => {
          if (callbacks.current.probing) {
            callbacks.current.setProbe({
              longitude: Number(e.lngLat.lng.toFixed(6)),
              latitude: Number(e.lngLat.lat.toFixed(6)),
            });
            return;
          }
          if (callbacks.current.onPoint)
            callbacks.current.onPoint(e.lngLat.lng, e.lngLat.lat);
        });
        instance.on("mouseenter", "sites", () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", "sites", () => {
          instance.getCanvas().style.cursor = "";
        });
        setReady(true);
      });
      instance.on("movestart", (e) => {
        if (e.originalEvent) overviewCamera.current = false;
      });
      instance.on("error", (e) => setError(e.error.message));
      return () => {
        siteMarkers.current.forEach((marker) => marker.remove());
        siteMarkers.current.clear();
        instance.remove();
        map.current = null;
      };
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const instance = map.current;
    setError("");
    for (const id of ["osm", "satellite"])
      if (instance.getLayer(id))
        instance.setLayoutProperty(id, "visibility", "none");
    localStorage.setItem("mineops-basemap", basemap);
    if (basemap === "street" || basemap === "satellite") {
      const satellite = basemap === "satellite";
      const id = satellite ? "satellite" : "osm";
      if (!instance.getSource(id)) {
        instance.addSource(id, {
          type: "raster",
          tiles: [
            satellite
              ? "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: satellite
            ? 'Imagery © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri, Vantor, Earthstar Geographics & GIS User Community</a>'
            : '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
        });
        instance.addLayer(
          {
            id,
            type: "raster",
            source: id,
            paint: { "raster-opacity": 1 },
          },
          "land",
        );
      }
      instance.setLayoutProperty(id, "visibility", "visible");
      instance.setLayoutProperty("land", "visibility", "none");
      instance.setLayoutProperty("contours", "visibility", "none");
    } else {
      if (instance.getLayer("osm"))
        instance.setLayoutProperty("osm", "visibility", "none");
      instance.setLayoutProperty(
        "land",
        "visibility",
        layers.Terrain && basemap === "mine" ? "visible" : "none",
      );
      instance.setLayoutProperty(
        "contours",
        "visibility",
        layers.Terrain && basemap === "mine" ? "visible" : "none",
      );
      setError("");
    }
  }, [ready, basemap, layers.Terrain]);
  useEffect(() => {
    if (!ready || !map.current || !container.current) return;
    const instance = map.current;
    const observer = new ResizeObserver(() => {
      instance.resize();
      if (overviewCamera.current)
        fitNetwork(
          instance,
          sitesRef.current,
          compact,
          0,
          geographyRef.current,
        );
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [ready, compact]);
  const geometrySignature =
    sites
      .map((site) => `${site.id}:${site.longitude}:${site.latitude}`)
      .join("|") +
    JSON.stringify(
      geography?.features
        .filter((f) => f.properties?.kind === "mine-boundary")
        .map((f) => f.geometry),
    );
  useEffect(() => {
    if (ready && map.current && sitesRef.current.length) {
      overviewCamera.current = true;
      fitNetwork(
        map.current,
        sitesRef.current,
        compact,
        0,
        geographyRef.current,
      );
    }
  }, [ready, geometrySignature, compact]);
  useEffect(() => {
    if (!expanded && !menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else setExpanded(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded, menuOpen]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const active = new Set(sites.map((site) => site.id));
    siteMarkers.current.forEach((marker, id) => {
      if (!active.has(id) || !layers.Sites) {
        marker.remove();
        siteMarkers.current.delete(id);
      }
    });
    if (!layers.Sites) return;
    sites.forEach((site) => {
      let marker = siteMarkers.current.get(site.id);
      const button = marker
        ? (marker.getElement() as HTMLButtonElement)
        : document.createElement("button");
      button.className = `site-pin maplibregl-marker maplibregl-marker-anchor-center ${site.status} ${site.id === selected ? "selected" : ""}`;
      button.setAttribute("aria-label", `Inspect ${site.code}`);
      button.title = `${site.code} · ${site.status} · ${site.devices} devices`;
      if (!marker) {
        const icon = document.createElement("span");
        icon.className = "antenna-icon";
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "15");
        svg.setAttribute("height", "15");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "1.7");
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute(
          "d",
          "M12 6 6 22h12L12 6ZM8 17h8M10 11h4M5 4a10 10 0 0 0 0 10M19 4a10 10 0 0 1 0 10M8 6a6 6 0 0 0 0 6M16 6a6 6 0 0 1 0 6",
        );
        svg.append(path);
        icon.append(svg);
        const label = document.createElement("span");
        label.className = "site-pin-label";
        button.append(icon, label);
        marker = new maplibregl.Marker({ element: button, anchor: "center" })
          .setLngLat([site.longitude, site.latitude])
          .addTo(map.current!);
        siteMarkers.current.set(site.id, marker);
      }
      button.querySelector(".site-pin-label")!.textContent =
        site.id === selected ? site.code : site.code.replace("SITE-LTE-", "#");
      button.onclick = (e) => {
        e.stopPropagation();
        if (callbacks.current.probing) {
          callbacks.current.setProbe({
            longitude: site.longitude,
            latitude: site.latitude,
          });
          return;
        }
        callbacks.current.onSite(site.id);
      };
      marker.setLngLat([site.longitude, site.latitude]);
    });
  }, [ready, sites, selected, layers.Sites]);
  useEffect(() => {
    if (!ready || !map.current || !probe) return;
    const element = document.createElement("div");
    element.className = "probe-pin";
    element.textContent = "+";
    const marker = new maplibregl.Marker({ element })
      .setLngLat([probe.longitude, probe.latitude])
      .addTo(map.current);
    return () => {
      marker.remove();
    };
  }, [ready, probe]);
  useEffect(() => {
    if (!ready || !map.current || !layers.Areas) return;
    const markers: maplibregl.Marker[] = [];
    for (const feature of geography?.features || []) {
      if (
        feature.properties?.kind !== "area" ||
        feature.geometry.type !== "Polygon"
      )
        continue;
      const points = feature.geometry.coordinates[0];
      const lon =
        (Math.min(...points.map((p) => p[0])) +
          Math.max(...points.map((p) => p[0]))) /
        2;
      const lat = Math.max(...points.map((p) => p[1])) - 0.0015;
      const element = document.createElement("div");
      element.className = "map-area-label";
      element.textContent = String(feature.properties.name).toUpperCase();
      markers.push(
        new maplibregl.Marker({ element })
          .setLngLat([lon, lat])
          .addTo(map.current),
      );
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [ready, geography, layers.Areas]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const update = (id: string, data: GeoJSON.FeatureCollection) =>
      (map.current!.getSource(id) as GeoJSONSource).setData(data);
    update(
      "geography",
      collection(
        (geography?.features || []).map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            selected: feature.properties?.site_id === selected,
            status:
              sites.find((site) => site.id === feature.properties?.site_id)
                ?.status || feature.properties?.status,
          },
        })),
      ),
    );
    update(
      "sites",
      collection(
        sites.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
          properties: {
            id: s.id,
            status: s.status,
            alarms: s.alarms,
            selected: s.id === selected,
          },
        })),
      ),
    );
    const ids = new Set(affected);
    update(
      "devices",
      collection(
        devices.map((d) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [d.longitude, d.latitude] },
          properties: { id: d.id, affected: ids.has(d.id) },
        })),
      ),
    );
    update(
      "adoption",
      collection(
        adoption
          .filter((a) => a.stage < 8)
          .map((a) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
            properties: { id: a.id },
          })),
      ),
    );
  }, [ready, sites, devices, geography, adoption, selected, affected]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const mapping: Record<string, string[]> = {
      Sites: ["sites", "selection"],
      Coverage: ["coverage", "coverage-borders"],
      Devices: ["devices"],
      Alarms: ["alarm-halo"],
      Areas: ["areas", "area-borders", "mine-perimeter"],
      Roads: ["roads"],
      Expansion: ["adoption"],
      Terrain: ["pit", "benches", "water", "pads", "buildings"],
    };
    for (const [key, ids] of Object.entries(mapping))
      for (const id of ids)
        map.current.setLayoutProperty(
          id,
          "visibility",
          layers[key as keyof typeof layers] &&
            (key !== "Terrain" || basemap === "mine")
            ? "visible"
            : "none",
        );
  }, [ready, layers, basemap]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const filter: maplibregl.FilterSpecification =
      activeSector && selected
        ? [
            "all",
            ["==", ["get", "kind"], "coverage"],
            ["==", ["get", "site_id"], selected],
            ["==", ["get", "sector"], activeSector],
          ]
        : focused && selected
          ? [
              "all",
              ["==", ["get", "kind"], "coverage"],
              ["==", ["get", "site_id"], selected],
            ]
          : ["==", ["get", "kind"], "coverage"];
    for (const id of ["coverage", "coverage-borders"])
      map.current.setFilter(id, filter);
  }, [ready, focused, selected, activeSector]);
  return (
    <div
      className={`network-map ${compact ? "compact" : ""} ${expanded ? "expanded" : ""}`}
    >
      <div ref={container} className="map-canvas" />
      {error && (
        <div className="map-error">
          Map unavailable: {error}. Site list remains available below.
        </div>
      )}
      <div className="map-heading">
        <span className="eyebrow">AURORA / SYNTHETIC OPERATION</span>
        <strong>Aurora mine · LTE coverage</strong>
        <small>
          {basemap === "mine"
            ? "Mine terrain · original synthetic scene"
            : basemap === "satellite"
              ? "Satellite imagery · fictional LTE infrastructure"
              : basemap === "none"
                ? "Background hidden · fictional operation"
                : "Street geography · fictional mine overlay"}
        </small>
        <button
          className="fit-towers"
          onClick={() => {
            overviewCamera.current = true;
            if (map.current)
              fitNetwork(map.current, sites, compact, 400, geography);
          }}
        >
          Fit all towers · {sites.length} sites
        </button>
      </div>
      <button
        className="map-menu-toggle"
        aria-label="Map options"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <Layers size={15} />
        Map options
      </button>
      {menuOpen && (
        <div className="map-layers map-options-panel">
          <div className="flex between">
            <strong>Map & layers</strong>
            <button
              aria-label="Close map options"
              onClick={() => setMenuOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <select
            aria-label="Map background"
            value={basemap}
            onChange={(e) => setBasemap(e.target.value)}
          >
            <option value="mine">Mine terrain</option>
            <option value="street">OpenStreetMap · online</option>
            <option value="satellite">Satellite · Esri · online</option>
            <option value="none">No background</option>
          </select>
          <span>
            <Layers size={14} /> Layers
          </span>
          {Object.entries(layers).map(([name, value]) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={value}
                disabled={name === "Terrain" && basemap !== "mine"}
                onChange={() => setLayers({ ...layers, [name]: !value })}
              />
              {name}
            </label>
          ))}
          {selected && (
            <label>
              <input
                type="checkbox"
                checked={focused}
                onChange={(e) => setFocused(e.target.checked)}
              />
              Selected coverage only
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={showLegends}
              onChange={(e) => setShowLegends(e.target.checked)}
            />
            Show legends
          </label>
          <button
            className="map-clear-layers"
            onClick={() =>
              setLayers(
                Object.fromEntries(
                  Object.keys(layers).map((key) => [key, false]),
                ) as typeof layers,
              )
            }
          >
            Hide all layers
          </button>
        </div>
      )}
      {showLegends && (
        <div className="signal-legend">
          <strong>Directional LTE · 3 sectors / site</strong>
          <span>
            <i style={{ background: "#22c55e" }} />
            Strong · −80 dBm
          </span>
          <span>
            <i style={{ background: "#38bdf8" }} />
            Moderate · −95 dBm
          </span>
          <span>
            <i style={{ background: "#818cf8" }} />
            Edge · −110 dBm
          </span>
          <small>Illustrative RSRP bands, not measured signal</small>
        </div>
      )}
      <div className="map-tools">
        {!onPoint && (
          <button
            aria-label="Signal probe"
            aria-pressed={probing}
            className={probing ? "active" : ""}
            onClick={() => {
              setProbing(!probing);
              if (probing) setProbe(null);
            }}
          >
            <Radar size={17} />
          </button>
        )}
        <button
          aria-label="Focus selected site"
          disabled={!selected}
          onClick={() => {
            const site = sites.find((s) => s.id === selected);
            if (site) {
              overviewCamera.current = false;
              map.current?.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
              map.current?.flyTo({
                center: [site.longitude, site.latitude],
                zoom: 15,
                pitch: 35,
                duration: 700,
              });
            }
          }}
        >
          <Crosshair size={17} />
        </button>
        <button
          aria-label={expanded ? "Exit expanded map" : "Expand map"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize size={17} /> : <Maximize size={17} />}
        </button>
      </div>
      {probing && (
        <div className="probe-panel">
          <div className="flex between">
            <strong>Signal probe · simulated</strong>
            <button
              aria-label="Close signal probe"
              onClick={() => {
                setProbing(false);
                setProbe(null);
              }}
            >
              <X size={13} />
            </button>
          </div>
          {!probe ? (
            <p>Click the mine map or an antenna to inspect estimated signal.</p>
          ) : probeResult.data ? (
            <>
              <strong className="probe-value">
                {probeResult.data.estimated_rsrp === null
                  ? "No service"
                  : `${probeResult.data.estimated_rsrp} dBm`}
              </strong>
              <span>
                {probeResult.data.quality} ·{" "}
                {probeResult.data.site_code || "No active LTE site"}
              </span>
              <small>
                Sector {probeResult.data.sector || "—"} ·{" "}
                {probeResult.data.azimuth ?? "—"}° ·{" "}
                {probeResult.data.covering_sites} active footprints
              </small>
              <small>
                {probe.latitude.toFixed(5)}, {probe.longitude.toFixed(5)}
              </small>
              <p>Geometric estimate, not a field measurement.</p>
            </>
          ) : (
            <p>{probeResult.error?.message || "Inspecting signal…"}</p>
          )}
        </div>
      )}
      {showLegends && (
        <div className="map-legend">
          {["operational", "degraded", "offline", "maintenance"].map(
            (status) => (
              <span key={status}>
                <i
                  style={{
                    background:
                      status === "operational"
                        ? "#22c55e"
                        : status === "degraded"
                          ? "#f59e0b"
                          : status === "offline"
                            ? "#ef4444"
                            : "#94a3b8",
                  }}
                />
                {status} {sites.filter((s) => s.status === status).length}
              </span>
            ),
          )}
        </div>
      )}
      <button
        className="map-reset"
        aria-label="Reset map view"
        title="Fit all towers and mine boundary"
        onClick={() => {
          overviewCamera.current = true;
          if (map.current)
            fitNetwork(map.current, sites, compact, 500, geography);
        }}
      >
        <LocateFixed size={17} />
      </button>
      <div className="map-notice">
        {cursor.latitude.toFixed(5)}, {cursor.longitude.toFixed(5)} · WGS84 ·
        Illustrative RF coverage
      </div>
    </div>
  );
}
