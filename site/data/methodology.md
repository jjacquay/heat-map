# Heat Map Heat Map — methods and data dictionary

Research snapshot: October 20, 2026. Independent atlas; no DoD endorsement.

## Release 02 additions (21 October 2026): GIS layers

The record transcription above is unchanged (pipeline/build_records.py reproduces release 01 byte for byte). Release 02 adds open GIS layers built by pipeline/build_gis.py and checked by pipeline/validate.py. Every download's URL, retrieval date and SHA-256 checksum is listed in provenance.json.

| Layer | Source | Use and limits |
|---|---|---|
| Japan prefecture polygons | Natural Earth 10m Admin-1, v5.1.2 (public domain) | Joined on ISO 3166-2 code (47/47). Simplified (~400 m tolerance). |
| Japan severity and age | FDMA 2025 report, Table 4-2 (same table as the transport totals) | Re-extracted from the PDF with pdftotext; every prefecture total matches the release 01 transcription. Severity is the hospital's initial-diagnosis category (death; severe = ≥3 weeks' admission; moderate = admitted; mild = not admitted; other = no physician diagnosis or unknown). 65+ is the FDMA 高齢者 group. |
| Japan denominators | Statistics Bureau of Japan, population estimates at 1 Oct 2024, Tables 2 and 3 (thousands) | “2025 transports per 100,000 residents (2024 population)” = transports ÷ (population × 1,000) × 100,000. The 65+ rate uses the 65+ population. Crude rates: not incidence, not age-adjusted. Transports are counted per event by prefectural fire services, so repeat transports count again; the report does not state residence, so visitors are probably included (inference). A 2025 population table was not yet published at build time. |
| India state polygons | Natural Earth 10m Admin-1 | 28 states joined by name; union territories not mapped. De facto boundaries; no position on disputed territory. Counts are drawn as symbols, not a choropleth, because no denominator is loaded. |
| Maricopa County polygon | U.S. Census 2023 cartographic boundary, counties 1:5m | GEOID 04013. Reporting unit outline only. |
| Spain polygon | Natural Earth 50m Admin-0 | Reporting unit outline for the national figures. |
| Military installation footprints | DoD MIRTA boundaries via the Esri U.S. Federal Datasets mirror | 32 site footprints for the named U.S. reporting areas. Context only: AFHSD counts are by diagnosis/report location, never split across footprints, and footprints carry no counts. Every U.S. display anchor lies within 15 km of its footprint (most inside). No MIRTA coverage for Okinawa, Germany or Korea; Parris Island is not in the extract, so only Beaufort footprints are drawn for that combined area. |
| Climate context | ERA5 reanalysis (Copernicus C3S, CC BY 4.0) via the Open-Meteo historical API, model `era5` | Daily 2 m maximum/minimum air temperature for the grid cell nearest each military anchor (~25 km). Days per year with Tmax ≥ 32.2 °C and mean June–August Tmax for each heat window; nights per season with Tmin ≤ 0 °C and ≤ −17.8 °C for July 2020–June 2025. Not WBGT; not conditions at the time of any case. See climate-context.csv. |
| Land-surface temperature | NASA GIBS WMTS, layer MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day, EPSG:3857, GoogleMapsCompatible_Level6 | Streamed live; not stored. Identifier, monthly time range, tile template and colour map (kelvin; transparent = no data) are read from GIBS GetCapabilities at build time, and the month control is limited to that range. Skin temperature of the ground, not air temperature or heat stress. |
| Basemap | OpenFreeMap vector tiles (OpenStreetMap contributors, ODbL) | Cartographic context only. If it fails, simplified Natural Earth outlines shipped with the site are used. |

Optional stages (MIRTA, ERA5, GIBS) fail soft: the previous output is kept, or the layer is omitted, and the status is recorded in atlas.json under `pipeline`. Network fetches use finite retries with exponential backoff and honour Retry-After.

CDC Environmental Public Health Tracking was probed for state heat-related ED visits. The public API returned data for some calls and HTTP 429 (“too many non-token requests”) for others during the build; the API help page returned 404 and the CDC documentation page was blocked from the build environment, so whether a token is required for routine use could not be confirmed. Measure 440 (age-adjusted ED visit rate) returned 16 states for 2023. Because the case definition and month coverage could not be confirmed from CDC documentation, no CDC rows were imported in this release.

## Included data

260 geographic observations: 43 named military heat location/window records; 23 cold location records; 47 Japanese prefecture transport records; 140 Indian state/year mortality records; five Maricopa County mortality records; one observed Spanish mortality record and one modeled Spanish mortality record. An additional 60 branch/year/outcome military observations provide published counts and rates. The source register distinguishes extracted data from references and unimported sources.

Military heat: Table 3 in the June 2025 and May 2026 MSMR reports. The windows overlap. One heat illness per person per year, prioritized by severity. Locations are diagnosis/report areas, not verified exposure coordinates. Counts cannot support installation risk rankings without population/exposure denominators. Combined reporting areas are preserved. Unnamed overseas and other cases are retained separately in atlas.json and not geocoded. Deployed in-theater statistics are not merged into these tables.

Military cold: July 2020–June 2025, Figure 4 and geographic-results narrative in the December 2025 MSMR. Five exact five-season totals are stated in the narrative. For 18 further locations, only the inclusion threshold (at least 25 over five seasons) is stored; annual chart bars have not been digitized. Null is not zero. Cold definitions include unspecified effects of reduced temperature. The source's HTML incorrectly expands AK to Arkansas in one paragraph; the PDF figure labels AK and these Alaska installations are mapped in Alaska.

Military trends: 2026 MSMR Table 2, not image alt text. Some web image descriptions conflict with the PDF data. No earlier vintage has been mixed into this trend series. Source Table 2 Navy heat-stroke rate declines from 12.8 to 9.6, while the prose reports a different percentage decrease; use tabulated rates rather than reproducing that prose percentage. Published rates are unadjusted cases per 100,000 person-years. Space Force is not separately available before 2023; Coast Guard is included in the published Armed Forces population.

Civilian data preserve their source definitions. Japan is ambulance transport for heat illness, May–September 2025; Indian state counts are NCRB-recorded heat/sunstroke deaths, 2018–2022 (union territories excluded); Maricopa includes heat-caused and heat-contributed deaths including nonresidents; Spain clinical deaths and MoMo modeled attribution are separate layers. No universal undercount multiplier is calculated. France's approximate national estimates are discussed in the source register, not stored as exact point values.

## Geography and display

Coordinates are manually assigned approximate installation, area, prefecture-capital or state display anchors. They are cartographic conveniences, not source-provided case coordinates, authoritative boundaries, or individual event locations. GeoJSON uses WGS84 longitude, latitude order. Source names and historical installation aliases are retained in each reporting vintage. Release 01 supplied no boundary geometry; release 02 adds reporting-unit and installation boundaries for context (see above). Anchors remain the coordinates in the CSV and GeoJSON.

Circle areas scale with counts with a minimum visible size; hollow circles mean threshold-only. Optional concentration shading (a MapLibre heatmap layer) uses kernels at anchors, with a fixed screen-pixel radius and within-selection normalization. It changes with zoom and selection. It does not estimate illness in unobserved places, represent population-adjusted risk, or measure environmental temperature. Threshold-only records are excluded. Layers and periods are not mixed.

## Fields

| Field | Meaning |
|---|---|
| id | Stable identifier within this release |
| layer | Outcome/source group used by the explorer |
| name | Published reporting-area name, translated where needed |
| count | Exact source count; null where only threshold known |
| lower_bound | Published minimum, only for threshold-only records |
| lat / lon | Approximate display anchor |
| period | Source-defined reporting period |
| source | Source register key, resolved in sources.csv or atlas.json |
| region | Navigation grouping; CONUS means contiguous U.S. here |
| measure | Counted outcome; not interchangeable across layers |
| geocoding | Coordinate provenance qualifier |
| note | Row-specific definition and limitations |

## Validation

Military heat named locations sum to 9,839 (2021–2025) and 9,624 (2020–2024). Adding source residual groups reproduces 13,047 and 12,430. Japan's 47 prefectures sum to 100,510. India's 28 states sum to 890, 1,274, 530, 374 and 729 for 2018–2022; the national 2022 total is 730 because union territories are excluded here. Null cold counts remain null in CSV and GeoJSON.

## Gaps and next extraction priorities

1. DCPH-A provisional monthly 2026 charts: located, PDF retrieval incomplete; do not mix with final annual counts.
2. CDC and Florida county ED, inpatient and mortality series: catalogued, not imported. Preserve suppression and indicator-specific coverage.
3. Civilian cold mortality: official methods located; records not yet imported.
4. Exact cold chart seasonal values: digitization and verification required.
5. Environmental rasters: NASA GIBS and CDC exposure tools linked; no raster imported. Satellite land-surface temperature, ambient temperature, heat index, and WBGT must remain distinct.
6. Longer military archives and other overseas areas: retain publication thresholds and report-vintage definitions; never distribute unnamed totals among bases.

Claude's supplied evidence brief and visible conversation were used for discovery. Primary official sources were checked before numeric incorporation; uncertain India 2024, global extrapolation, World Cup casualty, and secondary-report claims were not adopted.

## Files

observations.csv and observations.geojson contain all map records. military-trends.csv contains service/year/outcome rates and counts. sources.csv contains the source register. atlas.json combines these with the unmapped residual totals. All data are static snapshots; external basemap and library services require connectivity. Imported rows are reproduced from cited public aggregate statistics; release 02 software uses MapLibre GL JS 4.7.1 (BSD-3-Clause) with OpenFreeMap/OpenStreetMap attribution on the map.
