import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { request, useData } from "../api";
import type { Adoption, Application, Area, Page, Site } from "../types";
import { NetworkMap } from "../components/NetworkMap";
import { Badge, Button, date, Modal } from "../components/ui";

const schema = z.object({
  title: z.string().min(3).max(140),
  type: z.enum([
    "New coverage",
    "Capacity expansion",
    "Application onboarding",
    "New devices",
    "Performance improvement",
    "Area expansion",
  ]),
  area_id: z.number().int().positive(),
  application_id: z.number().int().positive(),
  requester: z.string().min(1),
  justification: z.string().min(3),
  expected_devices: z.number().int().min(1).max(500),
  priority: z.enum(["High", "Medium", "Low"]),
  latitude: z.number().min(-20.23).max(-20.145),
  longitude: z.number().min(-43.54).max(-43.45),
  desired_at: z.string().min(1),
});
type Values = z.infer<typeof schema>;
export function AdoptionPage({ onSite }: { onSite: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Adoption | null>(null);
  const [filter, setFilter] = useState("");
  const client = useQueryClient();
  const requests = useData<Adoption[]>("/adoption");
  const sites = useData<Page<Site>>("/sites");
  const areas = useData<Area[]>("/areas");
  const apps = useData<Application[]>("/applications");
  const geo = useData<GeoJSON.FeatureCollection>("/coverage");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "New coverage",
      area_id: 1,
      application_id: 1,
      requester: "Demo planner",
      justification: "",
      expected_devices: 25,
      priority: "Medium",
      latitude: -20.1657,
      longitude: -43.4995,
      desired_at: new Date(Date.now() + 86400000 * 14)
        .toISOString()
        .slice(0, 10),
    },
  });
  const lon = form.watch("longitude");
  const lat = form.watch("latitude");
  const assessment = useData<{
    coverage: string;
    recommendation: string;
    nearest_sites: { code: string; distance_m_approx: number }[];
  }>(
    `/coverage/assess?longitude=${lon}&latitude=${lat}`,
    open && Number.isFinite(lon) && Number.isFinite(lat),
  );
  const mutation = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      request(path, "POST", body),
    onSuccess: () => {
      client.invalidateQueries();
      setOpen(false);
      setSelected(null);
    },
  });
  const active = requests.data?.filter((r) => r.stage < 8).length || 0;
  return (
    <>
      <div className="resource-toolbar">
        <span className="muted">
          {active} active ·{" "}
          {requests.data?.filter((r) => r.stage === 8).length || 0} completed
        </span>
        <select
          aria-label="Filter expansion"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All requests</option>
          <option value="active">In progress</option>
          <option value="complete">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <Button
          onClick={() => {
            mutation.reset();
            setOpen(true);
          }}
        >
          <Plus size={15} />
          New connectivity request
        </Button>
      </div>
      {(mutation.error || requests.error) && (
        <div className="error" role="alert">
          {mutation.error?.message || requests.error?.message}
        </div>
      )}
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Current stage</th>
                <th>Progress</th>
                <th>Desired date</th>
                <th>Schedule</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.data
                ?.filter(
                  (r) =>
                    !filter ||
                    (filter === "active" && r.stage < 8) ||
                    (filter === "complete" && r.stage === 8) ||
                    (filter === "overdue" && r.overdue),
                )
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(r)}
                      >
                        {r.title}
                        <small className="mono block">
                          REQ-{String(r.id).padStart(3, "0")}
                        </small>
                      </button>
                    </td>
                    <td>{r.type}</td>
                    <td>
                      <Badge status={r.priority === "High" ? "Major" : "Info"}>
                        {r.priority}
                      </Badge>
                    </td>
                    <td>{r.stage_name}</td>
                    <td>
                      <div className="utilization">
                        <div className="progress">
                          <i style={{ width: `${r.progress}%` }} />
                        </div>
                        {r.progress}%
                      </div>
                    </td>
                    <td>{date(r.desired_at)}</td>
                    <td>
                      <Badge status={r.overdue ? "Warning" : "operational"}>
                        {r.overdue
                          ? `${r.deviation_days}d overdue`
                          : "On track"}
                      </Badge>
                    </td>
                    <td>
                      {r.stage < 8 ? (
                        <Button
                          variant="secondary"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({
                              path: `/adoption/${r.id}/advance`,
                            })
                          }
                        >
                          {r.stage === 7 && r.type === "New coverage"
                            ? "Activate site"
                            : "Advance stage"}
                        </Button>
                      ) : r.activated_site_id ? (
                        <Button
                          variant="ghost"
                          onClick={() => onSite(r.activated_site_id!)}
                        >
                          Open new site
                        </Button>
                      ) : (
                        <Badge status="operational">Completed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="muted small">
        Original demonstration workflow and configurable sample stage durations.
        New coverage requests activate a site at Operational Handover.
      </p>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New connectivity request"
      >
        <form
          className="form"
          onSubmit={form.handleSubmit((v) =>
            mutation.mutate({
              path: "/adoption",
              body: {
                ...v,
                desired_at: new Date(v.desired_at + "T23:59:00").toISOString(),
              },
            }),
          )}
        >
          <div className="form-grid">
            <label>
              Request title
              <input
                {...form.register("title")}
                placeholder="North Pit · new haul road"
              />
            </label>
            <label>
              Type
              <select {...form.register("type")}>
                {[
                  "New coverage",
                  "Capacity expansion",
                  "Application onboarding",
                  "New devices",
                  "Performance improvement",
                  "Area expansion",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Operational area
              <select {...form.register("area_id", { valueAsNumber: true })}>
                {areas.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Application
              <select
                {...form.register("application_id", { valueAsNumber: true })}
              >
                {apps.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Requester
              <input {...form.register("requester")} />
            </label>
            <label>
              Expected devices
              <input
                type="number"
                {...form.register("expected_devices", { valueAsNumber: true })}
              />
            </label>
            <label>
              Priority
              <select {...form.register("priority")}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <label>
              Desired date
              <input type="date" {...form.register("desired_at")} />
            </label>
          </div>
          <label>
            Business justification
            <textarea
              {...form.register("justification")}
              placeholder="Why is connectivity needed?"
            />
          </label>
          <h4>Select a point inside the chosen area</h4>
          <NetworkMap
            compact
            sites={sites.data?.items || []}
            devices={[]}
            geography={geo.data}
            onSite={() => {}}
            adoption={[
              { id: 0, stage: 0, latitude: lat, longitude: lon } as Adoption,
            ]}
            onPoint={(x, y) => {
              form.setValue("longitude", Number(x.toFixed(6)));
              form.setValue("latitude", Number(y.toFixed(6)));
            }}
          />
          <div className="form-grid">
            <label>
              Longitude
              <input
                type="number"
                step="any"
                {...form.register("longitude", { valueAsNumber: true })}
              />
            </label>
            <label>
              Latitude
              <input
                type="number"
                step="any"
                {...form.register("latitude", { valueAsNumber: true })}
              />
            </label>
          </div>
          {assessment.data && (
            <div className="assessment">
              <strong>{assessment.data.coverage}</strong>
              <div>
                {assessment.data.nearest_sites.map((s) => (
                  <small key={s.code}>
                    {s.code}: ~{s.distance_m_approx} m{" "}
                  </small>
                ))}
              </div>
              <p>{assessment.data.recommendation}</p>
            </div>
          )}
          {Object.entries(form.formState.errors).map(([key, error]) => (
            <div key={key} className="error">
              {key}: {error.message}
            </div>
          ))}
          {mutation.error && (
            <div className="error">{mutation.error.message}</div>
          )}
          <Button disabled={mutation.isPending} type="submit">
            Create connectivity request
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || "Request"}
      >
        {selected && (
          <>
            <p>{selected.justification}</p>
            <dl className="details">
              <dt>Requester</dt>
              <dd>{selected.requester}</dd>
              <dt>Owner</dt>
              <dd>{selected.owner}</dd>
              <dt>Expected devices</dt>
              <dd>{selected.expected_devices}</dd>
              <dt>Location</dt>
              <dd>
                {selected.latitude}, {selected.longitude}
              </dd>
            </dl>
            <div className="timeline">
              {selected.stages.map((s) => (
                <div key={s.number}>
                  <i className={s.completed_at ? "green-bg" : ""} />
                  <strong>{s.name}</strong>
                  <small>
                    Planned {date(s.planned_at)} · Completed{" "}
                    {date(s.completed_at)}
                  </small>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
