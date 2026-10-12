import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request, useData } from "../api";
import { Button } from "../components/ui";
type Settings = {
  stage_days: number;
  retention_days: number;
  stale_seconds: number;
};
export function SettingsPage() {
  const data = useData<Settings>("/settings");
  const [values, setValues] = useState<Settings>({
    stage_days: 2,
    retention_days: 14,
    stale_seconds: 20,
  });
  const client = useQueryClient();
  useEffect(() => {
    if (data.data) setValues(data.data);
  }, [data.data]);
  const save = useMutation({
    mutationFn: () => request("/settings", "PUT", values),
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <section className="card settings">
      <div className="card-title">
        <div>
          <h3>Demonstration preferences</h3>
          <p>Original, configurable parameters for synthetic operations.</p>
        </div>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Planned duration per adoption stage (days)
          <input
            type="number"
            min={1}
            max={30}
            value={values.stage_days}
            onChange={(e) =>
              setValues({ ...values, stage_days: Number(e.target.value) })
            }
          />
          <small>
            Applies to new requests. Existing plans retain their original dates.
          </small>
        </label>
        <label>
          Telemetry retention (days)
          <input
            type="number"
            min={7}
            max={90}
            value={values.retention_days}
            onChange={(e) =>
              setValues({ ...values, retention_days: Number(e.target.value) })
            }
          />
          <small>
            Samples older than 24 hours are aggregated hourly; older than
            retention are removed.
          </small>
        </label>
        <label>
          Stale telemetry threshold (seconds)
          <input
            type="number"
            min={10}
            max={120}
            value={values.stale_seconds}
            onChange={(e) =>
              setValues({ ...values, stale_seconds: Number(e.target.value) })
            }
          />
        </label>
        {save.error && <div className="error">{save.error.message}</div>}
        {save.isSuccess && (
          <div className="success" role="status">
            Preferences saved.
          </div>
        )}
        <Button disabled={save.isPending} type="submit">
          Save preferences
        </Button>
      </form>
      <div className="about-note">
        Local demo profile: Demo Operator. Actions are available to all users of
        this local environment.
      </div>
    </section>
  );
}
