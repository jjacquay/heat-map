"""Build the GIS layers for the atlas from open, citable sources.

Run after build_records.py:

    python pipeline/build_records.py
    python pipeline/build_gis.py

Downloads are cached in pipeline/cache/ (git-ignored). Every joined value is
checked against the transcribed records or the source's own totals; any
mismatch aborts the build rather than writing a silently different layer.
Requires: shapely, pyshp, openpyxl (pipeline/requirements.txt) and the
poppler `pdftotext` binary.
"""
import csv, hashlib, io, json, math, re, subprocess, time, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path

import openpyxl, shapefile
from shapely.geometry import mapping, shape, Point
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'pipeline' / 'cache'
OUT = ROOT / 'site' / 'data'
GIS = OUT / 'gis'
CACHE.mkdir(exist_ok=True)
GIS.mkdir(exist_ok=True)
ACCESSED = '2026-10-21'

NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'
URLS = {
    'admin1': NE + 'ne_10m_admin_1_states_provinces.geojson',
    'admin0': NE + 'ne_50m_admin_0_countries.geojson',
    'fdma': 'https://www.fdma.go.jp/disaster/heatstroke/items/r7/heatstroke_nenpou_r7.pdf',
    'jp_pop': 'https://www.stat.go.jp/data/jinsui/2024np/zuhyou/05k2024-2.xlsx',
    'jp_age': 'https://www.stat.go.jp/data/jinsui/2024np/zuhyou/05k2024-3.xlsx',
    'counties': 'https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_5m.zip',
    'mirta': 'https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/MIRTA_Polygons_A_view/FeatureServer/0/query',
    'era5': 'https://archive-api.open-meteo.com/v1/archive',
}


MANIFEST_PATH = CACHE / 'manifest.json'
MANIFEST = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}


def fetch(url, name, params=None, attempts=5, pause=0.4):
    """Download once into the cache; record URL, retrieval date and SHA-256.

    Retries are finite: network errors and 429/5xx back off exponentially,
    honouring Retry-After when the server sends one. Other HTTP errors fail
    immediately with their status so the cause is visible in the log.
    """
    path = CACHE / name
    full = url + ('?' + urllib.parse.urlencode(params) if params else '')
    if not path.exists():
        req = urllib.request.Request(full, headers={'User-Agent': 'heat-map-atlas-build/1.1'})
        for attempt in range(attempts):
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    body = r.read()
                break
            except urllib.error.HTTPError as e:
                retry = e.code == 429 or e.code >= 500
                print(f'  HTTP {e.code} for {name} (attempt {attempt + 1}/{attempts})')
                if not retry or attempt == attempts - 1:
                    raise
                wait = e.headers.get('Retry-After')
                time.sleep(int(wait) if wait and wait.isdigit() else 2 ** (attempt + 1))
            except OSError as e:
                print(f'  network error for {name}: {e} (attempt {attempt + 1}/{attempts})')
                if attempt == attempts - 1:
                    raise
                time.sleep(2 ** (attempt + 1))
        path.write_bytes(body)
        MANIFEST[name] = dict(url=full, retrieved=time.strftime('%Y-%m-%d'))
        time.sleep(pause)
    MANIFEST.setdefault(name, dict(url=full, retrieved='unknown'))['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    MANIFEST[name]['bytes'] = path.stat().st_size
    return path


def simplify(geom, tol, digits=4):
    g = geom.simplify(tol, preserve_topology=True)
    if g.is_empty:
        g = geom
    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], digits), round(c[1], digits)]
        return [rnd(x) for x in c]
    m = mapping(g)
    return {'type': m['type'], 'coordinates': rnd(m['coordinates'])}


def feature(geom, props, tol, digits=4):
    return {'type': 'Feature', 'geometry': simplify(geom, tol, digits), 'properties': props}


def label_point(geom):
    # Representative point is always inside the polygon (a centroid may fall
    # in the sea for archipelagos or crescent-shaped states).
    biggest = max(getattr(geom, 'geoms', [geom]), key=lambda g: g.area)
    p = biggest.representative_point()
    return [round(p.x, 4), round(p.y, 4)]


def haversine_km(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (a.x, a.y, b.x, b.y))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def write_geojson(name, features):
    (GIS / name).write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')))


atlas = json.loads((OUT / 'atlas.json').read_text())
records = atlas['records']
admin1 = json.loads(fetch(URLS['admin1'], 'ne_10m_admin_1.geojson').read_text())

# ---------------------------------------------------------------- Japan
pdf = fetch(URLS['fdma'], 'fdma_r7.pdf')
text = subprocess.run(['pdftotext', '-layout', '-f', '10', '-l', '10', str(pdf), '-'], capture_output=True, text=True, check=True).stdout
fdma = {}
for line in text.splitlines():
    m = re.match(r'^\s*(\d{1,2})\s+(\S+?[都道府県])\s+([\d,\s]+)$', line)
    if not m:
        continue
    nums = [int(n.replace(',', '')) for n in m.group(3).split()]
    assert len(nums) == 12, line
    newborn, infant, youth, adult, elderly, total, death, severe, moderate, mild, other, total2 = nums
    assert total == total2 == newborn + infant + youth + adult + elderly == death + severe + moderate + mild + other, line
    fdma[int(m.group(1))] = dict(name_ja=m.group(2), transports=total, age65=elderly, deaths=death, severe=severe, moderate=moderate, mild=mild, other=other)
assert len(fdma) == 47
assert sum(v['transports'] for v in fdma.values()) == 100510
assert sum(v['deaths'] for v in fdma.values()) == 117
assert sum(v['severe'] for v in fdma.values()) == 2217
assert sum(v['age65'] for v in fdma.values()) == 57433

# Cross-check the earlier hand transcription prefecture by prefecture (JIS order).
japan_records = [r for r in records if r['layer'] == 'japan']
for code, r in enumerate(japan_records, 1):
    assert r['count'] == fdma[code]['transports'], (r['name'], fdma[code])


def jp_table(path, col):
    out = {}
    for row in openpyxl.load_workbook(path, read_only=True).active.iter_rows(values_only=True):
        cells = [c for c in row if c is not None]
        if len(cells) > col and isinstance(cells[0], str) and re.fullmatch(r'\d\d', cells[0].strip()):
            out[int(cells[0])] = cells[col]
        elif cells and isinstance(cells[0], str) and cells[0].strip().startswith('全国'):
            out[0] = cells[col - 1]
    return out

pop = jp_table(fetch(URLS['jp_pop'], 'jp_pop_2024.xlsx'), 2)        # total population, thousands
pop65 = jp_table(fetch(URLS['jp_age'], 'jp_age_2024.xlsx'), 4)      # aged 65+, thousands
assert len(pop) == len(pop65) == 48 and pop[0] == 123802 and pop65[0] == 36243
assert abs(sum(pop[c] for c in range(1, 48)) - pop[0]) <= 47       # independent rounding per prefecture
assert pop[13] == 14178 and pop65[13] == 3215                       # Tokyo spot check

jp_features = []
by_iso = {f['properties']['iso_3166_2']: f for f in admin1['features']}
for code in range(1, 48):
    ne = by_iso[f'JP-{code:02d}']
    geom = shape(ne['geometry'])
    v = fdma[code]
    p = dict(
        iso=f'JP-{code:02d}', name=japan_records[code - 1]['name'].replace(' prefecture, Japan', ''), **v,
        pop_k=pop[code], pop65_k=pop65[code],
        rate=round(v['transports'] / (pop[code] * 1000) * 1e5, 1),
        rate65=round(v['age65'] / (pop65[code] * 1000) * 1e5, 1),
        severe_rate=round((v['severe'] + v['deaths']) / (pop[code] * 1000) * 1e5, 2),
        label=label_point(geom), record=japan_records[code - 1]['id'],
    )
    jp_features.append(feature(geom, p, 0.004))
write_geojson('japan-prefectures.geojson', jp_features)

# ---------------------------------------------------------------- India
india = {}
for r in (r for r in records if r['layer'] == 'india'):
    india.setdefault(r['name'].replace(', India', ''), {})[r['period']] = r['count']
by_name = {f['properties']['name']: f for f in admin1['features'] if f['properties']['adm0_a3'] == 'IND'}
in_features = []
for name, years in india.items():
    geom = shape(by_name[name]['geometry'])
    p = dict(name=name, iso=by_name[name]['properties']['iso_3166_2'], label=label_point(geom), total=sum(years.values()))
    p.update({f'y{y}': n for y, n in years.items()})
    in_features.append(feature(geom, p, 0.008))
assert len(in_features) == 28
assert [sum(f['properties'][f'y{y}'] for f in in_features) for y in range(2018, 2023)] == [890, 1274, 530, 374, 729]
write_geojson('india-states.geojson', in_features)

# ---------------------------------------------------------------- Civilian reporting units
admin0 = json.loads(fetch(URLS['admin0'], 'ne_50m_admin_0.geojson').read_text())
spain = next(f for f in admin0['features'] if f['properties']['ADM0_A3'] == 'ESP')
counties = fetch(URLS['counties'], 'cb_2023_us_county_5m.zip')
with zipfile.ZipFile(counties) as z:
    sf = shapefile.Reader(shp=io.BytesIO(z.read('cb_2023_us_county_5m.shp')), dbf=io.BytesIO(z.read('cb_2023_us_county_5m.dbf')))
    fields = [f[0] for f in sf.fields[1:]]
    maricopa = next(sr for sr in sf.iterShapeRecords() if dict(zip(fields, sr.record))['GEOID'] == '04013')
civil = [
    feature(shape(maricopa.shape.__geo_interface__), dict(name='Maricopa County, Arizona', unit='County (U.S. Census 2023 cartographic boundary)', layer='civilian-deaths'), 0.002),
    feature(shape(spain['geometry']), dict(name='Spain', unit='Country (Natural Earth 1:50m)', layer='civilian-deaths modeled-deaths'), 0.01),
]
write_geojson('civilian-units.geojson', civil)

# Offline-capable fallback basemap: country outlines, heavily simplified.
world = [feature(shape(f['geometry']), dict(name=f['properties']['NAME']), 0.08, 2) for f in admin0['features']]
write_geojson('world-fallback.geojson', world)

# ---------------------------------------------------------------- Optional stages
# Each optional stage is independent. If its provider is unavailable, the
# previous release's output is kept (if any) and the failure is recorded in
# atlas.json -> pipeline, so the core atlas still builds.
STATUS = {}


def optional(name, fn):
    saved = GIS / f'{name}.json'
    try:
        result = fn()
        saved.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
        STATUS[name] = dict(status='ok', built=ACCESSED)
        return result
    except Exception as e:  # noqa: BLE001 - surface any provider failure, keep going
        print(f'!! optional stage {name} failed: {type(e).__name__}: {e}')
        kept = json.loads(saved.read_text()) if saved.exists() else None
        STATUS[name] = dict(status='failed; previous output kept' if kept else 'failed; layer omitted', error=f'{type(e).__name__}: {e}', attempted=ACCESSED)
        return kept


military = [r for r in records if r['layer'].startswith('military')]


def stage_mirta():
    # Reporting-area name in the AFHSD tables -> MIRTA SITENAME(s). Combined
    # reporting areas map to several footprints; overseas areas are not in MIRTA.
    MIRTA_SITES = {
        'Fort Benning': ['Fort Benning'], 'Fort Bragg': ['Fort Bragg'],
        'Camp Lejeune': ['Marine Corps Base Camp Lejeune'],
        'Cherry Point': ['Marine Corps Air Station Cherry Point'],
        'San Antonio': ['Joint Base San Antonio'],
        'Beaufort': ['Marine Corps Air Station Beaufort', 'NAVSUPPFAC Beaufort SC'],
        'Fort Campbell': ['Fort Campbell'], 'Fort Polk': ['Fort Johnson'], 'Fort Johnson': ['Fort Johnson'],
        'MCRD San Diego': ['MCRD San Diego'], 'NB San Diego': ['Naval Base San Diego'],
        'Fort Hood': ['Fort Cavazos'], 'Fort Cavazos': ['Fort Cavazos'], 'Fort Jackson': ['Fort Jackson'],
        'Quantico': ['Marine Corps Base Quantico'], 'Camp Pendleton': ['Marine Corps Base Camp Pendleton'],
        'Fort Sill': ['Fort Sill'], 'Fort Stewart': ['Fort Stewart'], 'Fort Shafter': ['Fort Shafter'],
        'Twentynine Palms': ['Marine Corps Air Ground Combat Center Twentynine Palms'],
        'Fort Irwin': ['Fort Irwin'], 'Fort Leonard Wood': ['Fort Leonard Wood'], 'Pensacola': ['NAS Pensacola FL'],
        'Fort Bliss': ['Fort Bliss'], 'Annapolis': ['NAVSUPPACT Annapolis'],
        'Fort Wainwright': ['Fort Wainwright'], 'Elmendorf': ['Joint Base Elmendorf-Richardson'],
        'Fort Carson': ['Fort Carson'], 'Fort Drum': ['Fort Drum'], 'Lewis-McChord': ['Joint Base Lewis-McChord'],
        'Fort Riley': ['Fort Riley'], 'Fairchild': ['Fairchild Air Force Base'], 'Minot': ['Minot Air Force Base'],
    }
    wanted = sorted({s for v in MIRTA_SITES.values() for s in v})
    where = 'SITENAME IN (' + ','.join("'" + s.replace("'", "''") + "'" for s in wanted) + ')'
    mirta = json.loads(fetch(URLS['mirta'], 'mirta_selected.geojson', dict(where=where, outFields='SITENAME,FEATURENAME,STATENAMECODE,SITEREPORTINGCOMPONENT,ISJOINTBASE', outSR=4326, f='geojson')).read_text())
    footprints = {}
    for f in mirta['features']:
        a = f['properties']
        footprints.setdefault(a['SITENAME'], []).append((shape(f['geometry']), a))
    missing = set(wanted) - set(footprints)
    assert not missing, missing

    military = [r for r in records if r['layer'].startswith('military')]
    anchor_checks, site_areas = {}, {}
    for r in military:
        sites = sorted({s for key, v in MIRTA_SITES.items() if key in r['name'] for s in v})
        if not sites:
            anchor_checks[r['id']] = dict(sites=[], km=None)
            continue
        geom = unary_union([g for s in sites for g, _ in footprints[s]])
        pt = Point(r['lon'], r['lat'])
        km = 0.0 if geom.contains(pt) else haversine_km(pt, nearest_points(pt, geom)[1])
        anchor_checks[r['id']] = dict(sites=sites, km=round(km, 1))
        for s in sites:
            site_areas.setdefault(s, set()).add(r['name'])
    fp_features = []
    for s, parts in footprints.items():
        g = unary_union([g for g, _ in parts])
        a = parts[0][1]
        fp_features.append(feature(g, dict(site=s, component=a['SITEREPORTINGCOMPONENT'], state=a['STATENAMECODE'], reporting_areas=sorted(site_areas.get(s, []))), 0.0003, 5))
    write_geojson('installations.geojson', fp_features)
    far = {r['name']: anchor_checks[r['id']]['km'] for r in military if (anchor_checks[r['id']]['km'] or 0) > 15}
    print('Anchors more than 15 km from their MIRTA footprint:', far or 'none')
    return anchor_checks


# Days per year, not WBGT: thresholds 32.2 C (90 F) and -17.8 C (0 F) are
# conventional, easy-to-read markers. ERA5 cells are ~25 km; coastal anchors
# mix land and sea.
def stage_era5():
    climate = {}
    for key in sorted({(r['lat'], r['lon']) for r in military}):
        lat, lon = key
        raw = json.loads(fetch(URLS['era5'], f'era5_{lat}_{lon}.json', dict(latitude=lat, longitude=lon, start_date='2020-01-01', end_date='2025-12-31', daily='temperature_2m_max,temperature_2m_min', models='era5', timezone='GMT')).read_text())
        d = raw['daily']
        days = list(zip(d['time'], d['temperature_2m_max'], d['temperature_2m_min']))
        assert len(days) == 2192 and all(t is not None and n is not None for _, t, n in days), key
        def hot(y0, y1):
            return round(sum(1 for t, mx, _ in days if y0 <= int(t[:4]) <= y1 and mx >= 32.2) / (y1 - y0 + 1), 1)
        def summer(y0, y1):
            v = [mx for t, mx, _ in days if y0 <= int(t[:4]) <= y1 and t[5:7] in ('06', '07', '08')]
            return round(sum(v) / len(v), 1)
        season = [(t, mn) for t, _, mn in days if '2020-07-01' <= t <= '2025-06-30']
        climate[f'{lat:g},{lon:g}'] = {  # same text as JavaScript's String(number)
            'grid': [raw['latitude'], raw['longitude']],
            '2021–2025': dict(hot_days=hot(2021, 2025), jja_tmax=summer(2021, 2025)),
            '2020–2024': dict(hot_days=hot(2020, 2024), jja_tmax=summer(2020, 2024)),
            'Jul 2020–Jun 2025': dict(freeze_nights=round(sum(1 for _, mn in season if mn <= 0) / 5, 1), severe_cold_nights=round(sum(1 for _, mn in season if mn <= -17.8) / 5, 1)),
        }

    return climate


def stage_gibs():
    """Read the layer's real identifier, matrix set, time range and colour map."""
    layer = 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day'
    caps = fetch('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi', 'gibs_capabilities.xml', dict(SERVICE='WMTS', REQUEST='GetCapabilities')).read_text()
    i = caps.index(f'<ows:Identifier>{layer}</ows:Identifier>')
    block = caps[caps.rindex('<Layer>', 0, i):caps.index('</Layer>', i)]
    matrix = re.search(r'<TileMatrixSet>(.*?)</TileMatrixSet>', block).group(1)
    values = re.findall(r'<Value>(.*?)</Value>', block)
    assert len(values) == 1, values  # one continuous monthly range; otherwise the date control would offer gaps
    start, end, period = values[0].split('/')
    assert period == 'P1M'
    template = next(a['template'] for a in (dict(re.findall(r"(\w+)='([^']*)'", m)) for m in re.findall(r'<ResourceURL ([^>]*)/>', block)) if a.get('resourceType') == 'tile' and a.get('format') == 'image/png')
    metadata = [dict(re.findall(r"([\w:]+)='([^']*)'", m)) for m in re.findall(r'<ows:Metadata ([^>]*)/>', block)]
    cmap_url = next(m['xlink:href'] for m in metadata if m.get('xlink:role', '').endswith('colormap/1.3'))
    cmap = fetch(cmap_url, 'gibs_lst_colormap.xml').read_text()
    units = re.search(r'title="Land Surface Temperature" units="([^"]+)"', cmap).group(1)
    entries = re.findall(r'rgb="(\d+,\d+,\d+)" transparent="false" sourceValue="[^"]*" value="\[([\d.]+),([\d.]+)\)"', cmap)
    assert units == 'K' and len(entries) > 50
    entries = [e for e in entries if float(e[2]) - float(e[1]) < 5]  # drop open-ended catch-all classes
    stops = entries[::max(1, len(entries) // 12)] + [entries[-1]]
    zoom = int(re.search(r'Level(\d+)', matrix).group(1))
    return dict(layer=layer, title='Land Surface Temperature (L3, Monthly, Day, MODIS, Terra)', projection='EPSG:3857', matrix_set=matrix, max_zoom=zoom,
                tiles=template.replace('{Time}', '{time}').replace('{TileMatrixSet}', matrix).replace('{TileMatrix}', '{z}').replace('{TileRow}', '{y}').replace('{TileCol}', '{x}'),
                time_start=start[:7], time_end=end[:7], cadence='monthly', units=units, colormap=cmap_url,
                ramp=[dict(rgb=c, celsius=round((float(lo) + float(hi)) / 2 - 273.15, 1)) for c, lo, hi in stops],
                nodata='Transparent where the colour map marks no data: water, or no valid land retrieval that month (for example persistent cloud).')


anchor_checks = optional('mirta', stage_mirta) or {}
climate = optional('era5', stage_era5) or {}
gibs = optional('gibs', stage_gibs)

# ---------------------------------------------------------------- Sources and manifest
NEW_SOURCES = [
    ('ne', 'Natural Earth · Admin-0 and Admin-1 boundaries, v5.1.2', 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/', 'Geography · worldwide', 'Geometry', 'Public-domain boundaries for Japanese prefectures, Indian states and Spain. Simplified for web display. De facto boundaries; no position on disputed territory is implied.'),
    ('census', 'U.S. Census Bureau · 2023 cartographic boundary file, counties (1:5m)', URLS['counties'], 'Geography · United States', 'Geometry', 'Maricopa County, Arizona polygon (GEOID 04013).'),
    ('mirta', 'DoD · Military Installations, Ranges, and Training Areas (MIRTA) boundaries', 'https://www.arcgis.com/home/item.html?id=c7ebbc4daf1849e28e5ac2d0ba8c5d55', 'Geography · U.S. military sites', 'Geometry', 'Authoritative DoD site boundaries for planning, via the Esri U.S. Federal Datasets mirror. Used to draw footprints and test display anchors. Footprints are context: AFHSD counts are by diagnosis/report location, not by fence line. No overseas sites.'),
    ('jpop', 'Statistics Bureau of Japan · Population estimates, 1 Oct 2024, Tables 2–3', 'https://www.stat.go.jp/data/jinsui/2024np/index.html', 'Denominators · Japan', 'Extracted', 'Total and age-65+ population by prefecture (thousands). Denominator for transports per 100,000. Population date precedes the May–Sep 2025 transport window by seven months.'),
    ('fdma42', 'Japan FDMA · 2025 heat illness report, Table 4-2 (age and severity)', URLS['fdma'], 'Civilian · 47 prefectures', 'Extracted', 'Same table as the transport totals. Severity is the initial-diagnosis category at the hospital (death, severe, moderate, mild). Age 65+ is the FDMA 高齢者 group.'),
    ('era5', 'Copernicus ERA5 reanalysis via Open-Meteo Historical Weather API', 'https://open-meteo.com/en/docs/historical-weather-api', 'Climate context · military anchors', 'Derived', 'Daily 2 m max/min air temperature, ~25 km grid cell nearest each display anchor. Hersbach et al. (2020), CC BY 4.0. Context only: not WBGT, not exposure during training, and not a cause of any count.'),
    ('gibs', 'NASA GIBS · MODIS Terra monthly daytime land-surface temperature', 'https://nasa-gibs.github.io/gibs-api-docs/', 'Environmental raster · worldwide', 'Live layer', 'WMTS tiles streamed from NASA at view time; not stored here. Surface (skin) temperature of the ground, not air temperature or heat stress.'),
    ('osm', 'OpenFreeMap · OpenStreetMap vector basemap', 'https://openfreemap.org/', 'Basemap', 'Live layer', 'Open-source vector tiles from OpenStreetMap data (ODbL). Basemap boundaries are cartographic context, not data.'),
]
known = {s['id'] for s in atlas['sources']}
for sid, title, url, scope, status, notes in NEW_SOURCES:
    if sid not in known:
        atlas['sources'].append(dict(id=sid, title=title, url=url, scope=scope, status=status, notes=notes, accessed=ACCESSED))
atlas['anchor_checks'] = anchor_checks
atlas['climate'] = climate
atlas['raster'] = gibs
atlas['pipeline'] = STATUS
atlas['gis'] = {
    'japan': 'gis/japan-prefectures.geojson', 'india': 'gis/india-states.geojson',
    'civilian': 'gis/civilian-units.geojson', 'installations': 'gis/installations.geojson', 'fallback': 'gis/world-fallback.geojson',
}
(OUT / 'atlas.json').write_text(json.dumps(atlas, ensure_ascii=False, indent=2))
with (OUT / 'sources.csv').open('w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(atlas['sources'][0]))
    w.writeheader()
    w.writerows(atlas['sources'])
with (OUT / 'climate-context.csv').open('w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['lat', 'lon', 'era5_lat', 'era5_lon', 'period', 'days_tmax_ge_32_2C_per_year', 'mean_jja_tmax_C', 'nights_tmin_le_0C_per_season', 'nights_tmin_le_minus17_8C_per_season'])
    for key, c in climate.items():
        lat, lon = key.split(',')
        for period in ('2021–2025', '2020–2024'):
            w.writerow([lat, lon, *c['grid'], period, c[period]['hot_days'], c[period]['jja_tmax'], '', ''])
        w.writerow([lat, lon, *c['grid'], 'Jul 2020–Jun 2025', '', '', c['Jul 2020–Jun 2025']['freeze_nights'], c['Jul 2020–Jun 2025']['severe_cold_nights']])
MANIFEST_PATH.write_text(json.dumps(MANIFEST, indent=1, sort_keys=True))
(OUT / 'provenance.json').write_text(json.dumps({k: v for k, v in sorted(MANIFEST.items()) if not k.startswith('era5_')} | {'era5 (per-anchor files)': dict(count=sum(k.startswith('era5_') for k in MANIFEST), url=URLS['era5'])}, indent=1, ensure_ascii=False))
print(f'Wrote {len(jp_features)} prefectures, {len(in_features)} states, {len(climate)} climate anchors, stages {STATUS}, {len(atlas["sources"])} sources.')
