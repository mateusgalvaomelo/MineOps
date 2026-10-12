import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request, useData } from "../api";
import type { Alarm, Incident, Page } from "../types";
import { Badge, Button, date, Modal } from "../components/ui";

export function IncidentsPage({ onSite }: { onSite: (id: number) => void }) {
  const [tab, setTab] = useState("alarms");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [newIncident, setNewIncident] = useState<Alarm | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState("Demo operator");
  const client = useQueryClient();
  const alarms = useData<Page<Alarm>>(
    `/alarms?limit=500${status ? "&status=" + status : ""}${severity ? "&severity=" + severity : ""}`,
    tab === "alarms",
  );
  const incidents = useData<Page<Incident>>(
    `/incidents?limit=500${status ? "&status=" + status : ""}${severity ? "&severity=" + severity : ""}`,
    tab === "incidents",
  );
  const detail = useData<Incident>(`/incidents/${selected}`, !!selected);
  const action = useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => request(path, method, body),
    onSuccess: () => {
      client.invalidateQueries();
      setNewIncident(null);
      setNote("");
    },
  });
  const transitions: Record<string, string[]> = {
    Open: ["Investigating"],
    Investigating: ["Mitigating", "Resolved"],
    Mitigating: ["Resolved"],
    Resolved: ["Closed"],
    Closed: [],
  };
  return (
    <>
      <div className="resource-toolbar">
        <div className="tabs">
          {["alarms", "incidents"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setStatus("");
              }}
            >
              {t === "alarms" ? "Network alarms" : "Incident management"}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {(tab === "alarms"
            ? ["Active", "Acknowledged", "Cleared"]
            : ["Open", "Investigating", "Mitigating", "Resolved", "Closed"]
          ).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="">All severities</option>
          {["Critical", "Major", "Minor", "Warning", "Info"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      {(action.error || alarms.error || incidents.error) && (
        <div className="error" role="alert">
          {action.error?.message ||
            alarms.error?.message ||
            incidents.error?.message}
        </div>
      )}
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{tab === "alarms" ? "Condition" : "Incident"}</th>
                <th>Site</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Started</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tab === "alarms"
                ? alarms.data?.items.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">
                        ALM-{String(a.id).padStart(3, "0")}
                      </td>
                      <td>{a.type}</td>
                      <td>
                        <button
                          className="text-button mono"
                          onClick={() => onSite(a.site_id)}
                        >
                          SITE-LTE-{String(a.site_id).padStart(3, "0")}
                        </button>
                      </td>
                      <td>
                        <Badge status={a.severity}>{a.severity}</Badge>
                      </td>
                      <td>
                        <Badge status={a.status}>{a.status}</Badge>
                      </td>
                      <td>{date(a.started_at)}</td>
                      <td>{a.owner}</td>
                      <td>
                        <div className="flex">
                          <Button
                            variant="secondary"
                            disabled={action.isPending || a.status !== "Active"}
                            onClick={() =>
                              action.mutate({
                                path: `/alarms/${a.id}/acknowledge`,
                              })
                            }
                          >
                            Acknowledge
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={
                              action.isPending || a.status === "Cleared"
                            }
                            onClick={() => {
                              setNewIncident(a);
                              setTitle(
                                `SITE-LTE-${String(a.site_id).padStart(3, "0")} — ${a.type}`,
                              );
                            }}
                          >
                            Create incident
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : incidents.data?.items.map((i) => (
                    <tr
                      key={i.id}
                      className="clickable"
                      onClick={() => setSelected(i.id)}
                    >
                      <td className="mono">
                        INC-{String(i.id).padStart(3, "0")}
                      </td>
                      <td>{i.title}</td>
                      <td>SITE-LTE-{String(i.site_id).padStart(3, "0")}</td>
                      <td>
                        <Badge status={i.severity}>{i.severity}</Badge>
                      </td>
                      <td>
                        <Badge status={i.status}>{i.status}</Badge>
                      </td>
                      <td>{date(i.opened_at)}</td>
                      <td>{i.owner}</td>
                      <td>View timeline →</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {(tab === "alarms" ? alarms.data?.total : incidents.data?.total) ===
            0 && <div className="empty">No records match these filters.</div>}
        </div>
      </section>
      <p className="muted small">
        Acknowledgement records human response. Clearing an alarm requires
        recovery of the simulated technical condition.
      </p>
      <Modal
        open={!!newIncident}
        onClose={() => setNewIncident(null)}
        title="Create operational incident"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newIncident)
              action.mutate({
                path: "/incidents",
                body: {
                  alarm_id: newIncident.id,
                  title,
                  owner,
                  description: note || newIncident.description,
                },
              });
          }}
          className="form"
        >
          <label>
            Title
            <input
              required
              minLength={3}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Responsible operator
            <input
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {action.error && <div className="error">{action.error.message}</div>}
          <Button disabled={action.isPending} type="submit">
            Create incident
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={detail.data?.title || "Incident details"}
      >
        {detail.data && (
          <>
            <div className="flex">
              <Badge status={detail.data.status}>{detail.data.status}</Badge>
              <Badge status={detail.data.severity}>
                {detail.data.severity}
              </Badge>
              <Button
                variant="ghost"
                onClick={() => onSite(detail.data!.site_id)}
              >
                Inspect site
              </Button>
            </div>
            <p>{detail.data.description}</p>
            <h4>Action timeline</h4>
            <div className="timeline">
              {detail.data.events?.map((e) => (
                <div key={e.id}>
                  <i />
                  <strong>{e.action}</strong>
                  <small>{date(e.timestamp)}</small>
                </div>
              ))}
            </div>
            <label className="form">
              Operator note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Investigation or mitigation notes"
              />
            </label>
            <div className="flex wrap">
              {transitions[detail.data.status]?.map((s) => (
                <Button
                  disabled={action.isPending}
                  key={s}
                  onClick={() =>
                    action.mutate({
                      path: `/incidents/${selected}`,
                      method: "PATCH",
                      body: { status: s, note },
                    })
                  }
                >
                  Move to {s}
                </Button>
              ))}
            </div>
            {action.error && (
              <div className="error" role="alert">
                {action.error.message}
              </div>
            )}
            <p className="muted small">
              Recovery clears technical alarms. Resolve and close incidents
              explicitly after investigation.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
