# Heat Map / Heat Map

**Heat and cold illness, mapped from public records.** A field atlas of thermal extremes: military heat and cold injury worldwide, with civilian transports and deaths kept as separate datasets, drawn on open boundaries with satellite and reanalysis context. A companion scrollytelling essay, *The Recorded and the Real*, is built on the same data.

- `site/` — the static website (no build step). `index.html` is the atlas; `story/` is the essay.
- `site/data/` — every number the site shows, as JSON/CSV/GeoJSON, plus `methodology.md` and `provenance.json`.
- `pipeline/` — reproducible data build and validation.

## Run locally

```sh
python3 -m http.server 8765 --directory site
# open http://localhost:8765 (atlas) and http://localhost:8765/story/
```

The map library (MapLibre GL JS 4.7.1, from unpkg with SRI), web fonts, OpenFreeMap tiles and NASA GIBS imagery load from the internet. If any of them fail, the page says so and the full record table, downloads and sources still work; a failed basemap falls back to Natural Earth outlines shipped in `site/data/gis/`.

## Rebuild the data

```sh
pip install -r pipeline/requirements.txt   # shapely, pyshp, openpyxl; also needs poppler's pdftotext
python pipeline/build_records.py   # transcribed primary-source records (release 01, unchanged)
python pipeline/build_gis.py       # boundaries, Japan rates, DoD footprints, ERA5 context, GIBS metadata
python pipeline/validate.py        # totals, joins, missingness and separation checks
```

`build_gis.py` caches downloads in `pipeline/cache/` (git-ignored) and records URL, retrieval date and SHA-256 for each in `site/data/provenance.json`. The MIRTA, ERA5 and GIBS stages are optional: if a provider is down, the previous output is kept or the layer is omitted, and the status is written to `atlas.json` → `pipeline`.

## Open tools and data

MapLibre GL JS · OpenFreeMap / OpenStreetMap · Natural Earth · U.S. Census cartographic boundaries · DoD MIRTA · NASA GIBS (MODIS land-surface temperature) · Copernicus ERA5 via Open-Meteo · Statistics Bureau of Japan · primary health sources listed in `site/data/sources.csv`.

## Deploy

`.github/workflows/site.yml` validates the data and scripts on every pull request and uploads `site/` as a Pages artifact; pushes to `main` deploy it with GitHub Pages. Pages must be enabled for the repository with **Source: GitHub Actions** (Settings → Pages).

## Reading rules

Counts are not risk. Military location counts have no denominators and are never shown as rates. Overlapping five-year windows are never added. Threshold-only cold locations stay “at least 25”. Recorded and modeled deaths stay in separate datasets. Installation boundaries and temperature layers are context, not evidence of individual exposure. Details: `site/data/methodology.md` and the atlas's Field guide.
