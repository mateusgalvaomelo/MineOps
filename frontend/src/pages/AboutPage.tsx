import { Database, Map, RadioTower, Workflow } from "lucide-react";
export function AboutPage() {
  return (
    <>
      <section className="card about-hero">
        <span className="eyebrow">ORIGINAL ENGINEERING PORTFOLIO</span>
        <h2>
          Telecom infrastructure.
          <br />
          <span>Industrial consequences.</span>
        </h2>
        <p>
          MineOps connects a synthetic private LTE network to the equipment,
          applications and operational areas that depend on it.
        </p>
        <div className="flex wrap">
          <a className="button primary" href="/api/export">
            Download synthetic dataset
          </a>
          <a
            className="button secondary"
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
          >
            Explore OpenAPI
          </a>
        </div>
      </section>
      <div className="scenario-grid">
        {[
          {
            icon: Map,
            title: "Interactive operational map",
            text: "Inspect sites, industrial devices, approximate coverage and planned expansions in a local MapLibre scene.",
          },
          {
            icon: RadioTower,
            title: "Real-time incident simulation",
            text: "Backend scenarios persist network faults, update connected devices and surface industrial application dependencies.",
          },
          {
            icon: Workflow,
            title: "Planning into operations",
            text: "Advance an original connectivity workflow and activate a synthetic LTE site into inventory, telemetry and the map.",
          },
          {
            icon: Database,
            title: "Data engineering pipeline",
            text: "Seeded telemetry is ingested, validated, persisted, aggregated and exposed through API-backed dashboards.",
          },
        ].map((c) => (
          <section className="card scenario-card" key={c.title}>
            <c.icon size={27} className="blue" />
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </section>
        ))}
      </div>
      <section className="card about-note">
        <h3>Fictional by design</h3>
        <p>
          Aurora Mining, all site locations, routes, device records, application
          relationships, sample SLAs and workflows are fictional and
          independently implemented. No corporate customer data or proprietary
          implementation is included.
        </p>
        <p>
          This application does not monitor a real LTE network. Coverage is
          simplified geometry, impact is a simulation estimate and analytics are
          derived from artificial telemetry. It is unsuitable for real
          operational or RF engineering decisions.
        </p>
        <p>
          Stack: React · TypeScript · Vite · Tailwind · Radix/shadcn-style UI ·
          TanStack Query · MapLibre · Recharts · FastAPI · SQLAlchemy · Alembic
          · PostgreSQL/PostGIS · Shapely · NumPy · Pandas · Docker.
        </p>
      </section>
    </>
  );
}
