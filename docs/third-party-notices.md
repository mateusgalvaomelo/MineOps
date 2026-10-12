# Third-party notices and provenance

The MIT license in the root applies to original MineOps source and documentation. Third-party libraries, container images and their bundled components retain their own copyright notices and licenses. Generated license metadata for the installed development environment is in [frontend-licenses.json](frontend-licenses.json) and [backend-licenses.json](backend-licenses.json); these are inventories, not replacement license texts.

| Component | License / upstream |
| --- | --- |
| MapLibre GL JS | BSD-3-Clause; [upstream license](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt) |
| React, FastAPI, SQLAlchemy, Tailwind, Vite, Recharts, Radix, Lucide and many UI utilities | Permissive licenses as recorded in installed package metadata; preserve package notices |
| NumPy / Pandas / Shapely | BSD-family licenses; Shapely distributions include separate GEOS notices |
| Psycopg / psycopg-binary | LGPL-3.0-only; [upstream source and license](https://github.com/psycopg/psycopg). Installed as unmodified replaceable Python dependencies; retain upstream distribution notices and source/license access |
| PostGIS service | GPLv2+; separate database service. [Official FAQ on applications using PostGIS](https://postgis.net/documentation/faq/gpl-license/) explains the application/database licensing separation |
| PostgreSQL service | [PostgreSQL License](https://www.postgresql.org/about/licence/) |
| Docker base images | Python, Node and Nginx images retain their distribution and bundled-library notices |

Source installs remain in third-party package directories with their upstream notices. For binary redistribution, preserve those notices and the relevant source/replacement provisions; this repository does not relicense dependency binaries as MIT. No third-party library has been modified in the project.

No external photos, map tiles, satellite imagery, corporate logos, proprietary RF models or paid assets are bundled. The MineOps haul-truck mark is an original SVG. Optional OpenStreetMap tiles are loaded directly by the browser only when enabled, with visible [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) and [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) compliance. The synthetic terrain, benches, facilities, areas, routes, parameters and workflows are independently authored. Documentation screenshots were captured from this application using Playwright.

The optional online satellite background uses [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), a separately licensed service under its upstream terms. Runtime attribution reflects the service copyright metadata: Esri, Vantor, Earthstar Geographics and the GIS User Community. This imagery is not relicensed as MIT or stored in a tile package. The local synthetic background remains the default.

Regenerate inventories after dependency changes with `node scripts/license-report.mjs` and `python backend/scripts/license_report.py` in the corresponding installed environments. The npm lockfile and Python lock snapshot identify the versions actually evaluated. License metadata is provided for transparency; inspect complete upstream notices when changing packaging or distributing container binaries.
