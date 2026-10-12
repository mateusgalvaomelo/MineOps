# Executed validation

Validated locally on **2026-10-12**, America/Sao_Paulo, using Docker Desktop, Python 3.12 in the backend image, Node in the frontend build image and installed Microsoft Edge for Playwright. This records actual commands/results; it does not imply a remote GitHub Actions run or a performance benchmark.

| Check | Actual result |
| --- | --- |
| `docker compose up -d --build --wait` | PostgreSQL/PostGIS, FastAPI and Nginx started; migrations and seed completed |
| Frontend production build | TypeScript and Vite passed |
| `docker compose run --rm backend ruff check app tests migrations scripts` | Passed |
| `npm run lint` | ESLint passed |
| `npm audit --audit-level=moderate` | 0 reported vulnerabilities at verification time |
| Pytest, isolated SQLite | **24 passed** |
| Pytest, dedicated `mineops_test_reference` PostgreSQL/PostGIS database | **24 passed** |
| `npm run test:e2e` | **7 passed**, including excavation alignment, menu/background/layer controls and map collapse |
| Fresh Compose project / new PostGIS volume | Clean migrations and seed passed |
| Initial fresh-environment smoke test (before directional-map revision) | 24 sites, 500 devices, 72 cells; fault impact 42/3/1, recovery and two repeated atomic resets passed |
| Final HTTP checks | Frontend HTTP 200; `/api/health` reports healthy PostgreSQL |

Domain/API checks cover seed idempotence, inventory counts, serving-site relationships, impact grouping, scenario idempotence, recovery, alarm acknowledgement timestamp idempotence, human incident transitions, MTTA, availability, weighted historical rollups, valid geometry, pagination, request validation, XLSX/CSV export, device growth/reset, audit preservation, UTC/bounds/deduplication ingestion, atomic reset rollback, WebSocket notifications and all eight adoption stages. Capacity, device and application adoption actions are separately exercised.

Browser checks exercise the actual Nginx/FastAPI/PostGIS stack: all pages, a 42/3/1 backhaul fault, acknowledgement, incident creation, investigation, recovery without automatic human resolution, explicit resolve/close, expansion activation into site 025/map, charts, theme switching and a 1024px tablet viewport without horizontal overflow.

Migration `006` is at head. Initial sites and routes are checked against the revised excavation-reference zones. Satellite captures were visually inspected to confirm that tower groups overlay exposed pit/bench areas instead of the earlier forest-side rectangle. These are visual reference checks, not a survey. Browser tests cover fitting/resizing, sectors, signal probe, opening/closing map options, disabling the background/all layers, Escape dismissal and hiding/restoring the entire map. Satellite image loading and visible attribution passed; OpenStreetMap was not requested by automated tests.

Actual screenshots:

- `screenshots/impact-analysis.png`: seeded site 014 during a backhaul failure.
- `screenshots/expansion.png`: new site selected after operational handover.
- `screenshots/overview.png`: dashboard during the demonstration journey.
- `screenshots/directional-map.png`: selected antenna with focused directional coverage in the updated mine scene.
- `screenshots/satellite-map.png`: real World Imagery beneath the fictional LTE and mine-boundary overlay, with attribution.
- `screenshots/distributed-sites.png`: distributed towers framed within the operation on a tablet viewport.

The E2E suite restores the original seed afterwards. The disposable fresh-stack containers/volume and dedicated domain-test database were removed after verification; the primary local demo remains running.

Observed non-fatal output: Starlette warns that its HTTPX-based test client is deprecated in favor of a newer client integration; tests still passed with the pinned dependencies. Vite reports large MapLibre/chart chunks and removes two unsupported annotations from Zod dependency comments. These are recorded as build/test output, not runtime failures. No real LTE hardware, real RF propagation, carrier integration, production authentication, load benchmark or remote GitHub workflow was tested or claimed.
