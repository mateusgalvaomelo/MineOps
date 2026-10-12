# Technical decisions and operating limits

1. **Local Docker architecture.** The requested PostgreSQL/PostGIS and Python backend remain local services. A static hosted frontend would not satisfy the full backend requirements. Compose exposes only loopback ports 3000 and 8000; no database host port or paid API is required.
2. **Single backend simulation task.** The workload is deliberately small. FastAPI lifespan owns the loop and a process-local mutation lock. More than one server worker is unsupported without changing the scheduler/event architecture.
3. **Portable normalized models plus PostGIS projections.** GeoJSON supports API responses and SQLite test isolation. PostGIS geometry columns and GiST indexes support the real runtime spatial queries. Projections synchronize in the same transaction.
4. **Local mine scene by default.** Original benches, contours, facilities, roads and directional antenna lobes work without external services. Users can optionally enable attributed OpenStreetMap street geography; online tiles follow browser caching and OSMF policy, without prefetch or offline downloads. The mine assets remain fictional.
5. **Current impact from dependencies.** Site associations and application links determine the panel. Degradation is potential quality impact; an outage is disconnection. The MVP has no handover/redundancy engine or saved impact snapshot per incident.
6. **Explicit shared demo identity.** Demo Operator is not production authentication. Reset and mutations are available to local users. Real auth, access control and tenant isolation are future work, not represented as implemented.
7. **REST canonical state with WebSocket invalidation.** Notifications tell clients to refetch persisted state. Ten-second polling and exponential reconnection support temporary socket failures. Binary or high-volume telemetry streaming is unnecessary for the demo.
8. **Weighted hourly historical aggregation.** Sample counts prevent rollup bias; hour normalization avoids high-frequency live updates dominating past availability. Missing hours are omitted, and stale values are labeled rather than assumed healthy.
9. **Bounded synthetic data.** New device actions stop at 1,500 devices. Metric/position/event retention is configurable. Audit and human transaction records are deliberately retained. Large exports and historical scans are synchronous and have no claimed throughput benchmark.
10. **Local UI primitives.** Radix dialog/accessibility primitives, class-variance-authority and Tailwind-merge underpin shadcn-style Button/Badge/Dialog components. These components are maintained in this repository rather than installed as an opaque hosted UI service.

Configuration:

| Variable / setting | Default | Scope |
| --- | --- | --- |
| POSTGRES_DB / USER / PASSWORD | mineops / mineops / mineops_demo | Compose demonstration database |
| DATABASE_URL | Injected by Compose | Backend SQLAlchemy connection |
| SIMULATION_INTERVAL | 5 seconds | Automatic tick cadence |
| simulation speed | 1× | Movement and cumulative data increment per tick; bounded 0.25–10× |
| stage_days | 2 | Newly created adoption stage plans |
| retention_days | 14 | Metric, position and scenario-event retention |
| stale_seconds | 20 | UI/API newest-sample age threshold |

The Python image uses 3.12. `requirements.lock.txt` records the verified container dependency set; `requirements.txt` records supported version ranges for development. `frontend/package-lock.json` is used by `npm ci`. Native Windows Python 3.11 is not required for Docker execution.

Development: start the Docker backend/database, then run `npm ci` and `npm run dev` in `frontend`. Vite proxies `/api` and WebSocket traffic to localhost:8000. The built application uses Nginx in Compose. Build warnings about large map/chart chunks reflect real library size; no load-time benchmark is claimed.

Browser validation uses installed Edge on Windows and Playwright Chromium in Linux CI. Screenshots are actual browser renders. The GitHub Actions workflow is provided but is not claimed to have run remotely until the repository is pushed and Actions executes it.
