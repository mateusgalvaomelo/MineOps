Backend domain, API and WebSocket tests are in `backend/tests`. They run against isolated SQLite by default, or a dedicated `mineops_test*` PostgreSQL/PostGIS database using `TEST_DATABASE_URL`.

Browser journeys live in `frontend/tests`, use Playwright, and exercise the actual Docker environment including PostGIS. These tests reset the local demo before and after the suite; use a dedicated demonstration environment, not records you want to preserve. Screenshots are saved to `docs/screenshots`.
