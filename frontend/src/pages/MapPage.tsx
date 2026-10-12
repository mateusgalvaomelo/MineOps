import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request, useData } from "../api";
import type { Adoption, Device, Page, Site, SiteDetail } from "../types";
import { NetworkMap } from "../components/NetworkMap";
import { ImpactPanel } from "../components/ImpactPanel";
import { Badge } from "../components/ui";
import { Button } from "../components/ui";

export function MapPage({
  onSite,
  onDevice,
}: {
  onSite: (id: number) => void;
  onDevice: (id: number) => void;
}) {
  const [selected, setSelected] = useState<number>(14);
  const [sector, setSector] = useState<number | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const selectSite = (id: number) => {
    setSelected(id);
    setSector(null);
  };
  const client = useQueryClient();
  const sites = useData<Page<Site>>("/sites");
  const devices = useData<Page<Device>>("/devices?limit=1500");
  const geography = useData<GeoJSON.FeatureCollection>("/coverage");
  const adoption = useData<Adoption[]>("/adoption");
  const detail = useData<SiteDetail>(`/sites/${selected}`);
  const mutation = useMutation({
    mutationFn: (scenario: string) =>
      request("/simulation/scenario", "POST", { site_id: selected, scenario }),
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <>
      <div className="map-toolbar">
        <Button variant="secondary" onClick={() => setMapVisible(!mapVisible)}>
          {mapVisible ? "Hide map" : "Show map"}
        </Button>
        <span>
          <i className="dot green-bg" />
          Synthetic operation
        </span>
        <span>
          {sites.data?.total || 0} LTE sites · {devices.data?.total || 0}{" "}
          industrial devices
        </span>
        <label>
          Inspect site{" "}
          <select
            aria-label="Inspect site"
            value={selected}
            onChange={(e) => selectSite(Number(e.target.value))}
          >
            {sites.data?.items.map((s) => (
              <option value={s.id} key={s.id}>
                {s.code} · {s.area}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="sector-toolbar">
        <div>
          <strong>{detail.data?.site.code || "LTE site"}</strong>
          <small>Directional coverage · synthetic antenna sectors</small>
        </div>
        <button
          className={sector === null ? "active" : ""}
          onClick={() => setSector(null)}
        >
          All sectors
        </button>
        {detail.data?.cells.map((cell) => (
          <button
            key={cell.id}
            className={sector === cell.sector ? "active" : ""}
            onClick={() => setSector(cell.sector)}
          >
            Sector {cell.sector}
            <small>{cell.azimuth}° azimuth · 900 m nominal</small>
          </button>
        ))}
        <span className="muted small">
          {detail.data?.site.status === "offline"
            ? "Offline footprint · no active service"
            : "Simulated RSRP bands"}
        </span>
      </div>
      {(sites.error || detail.error || mutation.error) && (
        <div role="alert" className="error">
          {sites.error?.message ||
            detail.error?.message ||
            mutation.error?.message}
        </div>
      )}
      <div className="map-layout">
        {mapVisible ? (
          <NetworkMap
            sites={(sites.data?.items || []).map((site) =>
              site.id === selected && detail.data ? detail.data.site : site,
            )}
            devices={devices.data?.items || []}
            geography={geography.data}
            adoption={adoption.data || []}
            selected={selected}
            onSite={selectSite}
            activeSector={sector}
            onDevice={onDevice}
            affected={detail.data?.impact.device_ids || []}
          />
        ) : (
          <div className="card empty">
            <h3>Map hidden</h3>
            <p>Site details and Impact Analysis remain available.</p>
            <Button variant="secondary" onClick={() => setMapVisible(true)}>
              Show operational map
            </Button>
          </div>
        )}
        <ImpactPanel
          detail={detail.data}
          impact={detail.data?.impact}
          onScenario={(s) => mutation.mutate(s)}
          pending={mutation.isPending}
          onDetails={() => onSite(selected)}
        />
      </div>
      <div className="area-strip">
        {[
          "North Pit",
          "Processing Plant",
          "Equipment Yard",
          "Logistics Hub",
        ].map((name, i) => (
          <div key={name}>
            <span className="eyebrow">
              AREA {String(i + 1).padStart(2, "0")}
            </span>
            <strong>{name}</strong>
            <Badge status="operational">
              {sites.data?.items.filter((s) => s.area_id === i + 1).length || 0}{" "}
              sites
            </Badge>
          </div>
        ))}
      </div>
    </>
  );
}
