"""Check the published data before it ships. Exits non-zero on any failure.

    python pipeline/validate.py

Covers totals against the sources, joins, missingness (null stays null),
dataset separation and the GIS layers the site loads.
"""
import csv, json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'site' / 'data'
failures = []


def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond:
        failures.append(msg)


atlas = json.loads((DATA / 'atlas.json').read_text())
recs = atlas['records']
by = lambda layer, period=None: [r for r in recs if r['layer'] == layer and (period is None or r['period'] == period)]
total = lambda rows: sum(r['count'] for r in rows if r['count'] is not None)

# Totals reproduce the sources
check(total(by('military-heat', '2021–2025')) == 9839, 'military heat 2021–2025 named locations = 9,839')
check(total(by('military-heat', '2020–2024')) == 9624, 'military heat 2020–2024 named locations = 9,624')
for p, t in (('2021–2025', 13047), ('2020–2024', 12430)):
    u = atlas['unmapped'][p]
    named = total(by('military-heat', p))
    check(named + u['overseas_excluding_okinawa'] + u['all_other_locations'] == u['total'] == t, f'{p}: named + residual groups = published {t:,}')
check(total(by('japan')) == 100510 and len(by('japan')) == 47, 'Japan: 47 prefectures, 100,510 transports')
check([total(by('india', str(y))) for y in range(2018, 2023)] == [890, 1274, 530, 374, 729], 'India state totals by year')
check(len(by('military-cold')) == 23, 'cold: all 23 Figure 4 locations present')

# Missingness: thresholds stay null with a lower bound, never 0 or 25
cold_null = [r for r in by('military-cold') if r['count'] is None]
check(len(cold_null) == 18 and all(r['lower_bound'] == 25 for r in cold_null), 'cold: 18 threshold-only rows are null with lower_bound 25')
check(all(r['lower_bound'] is None for r in recs if r['count'] is not None), 'lower_bound only on threshold rows')
with (DATA / 'observations.csv').open() as f:
    rows = {r['id']: r for r in csv.DictReader(f)}
check(all(rows[r['id']]['count'] == '' for r in cold_null), 'CSV keeps threshold counts blank, not zero')
geo = json.loads((DATA / 'observations.geojson').read_text())
check(all(f['properties']['count'] is None for f in geo['features'] if f['properties']['id'] in {r['id'] for r in cold_null}), 'GeoJSON keeps threshold counts null')

# Separation and integrity
check(all(r['source'] in {s['id'] for s in atlas['sources']} for r in recs), 'every record resolves to a registered source')
check(len({r['id'] for r in recs}) == len(recs), 'record ids unique')
check(all(-90 <= r['lat'] <= 90 and -180 <= r['lon'] <= 180 for r in recs), 'coordinates in range')
check({r['measure'] for r in by('modeled-deaths')} == {'Modeled heat-attributable deaths'} and all('Modeled' not in r['measure'] for r in by('civilian-deaths')), 'modeled and observed deaths kept in separate datasets')
windows = {}
for r in by('military-heat'):
    windows.setdefault((r['lat'], r['lon']), set()).add(r['period'])
check(all(len(v) <= 2 for v in windows.values()), 'each heat anchor has at most one record per window (no summed windows)')
okinawa = [r for r in by('military-heat') if 'Okinawa' in r['name']]
check(len(okinawa) == 2 and all('Combined reporting area' in r['note'] for r in okinawa), 'Okinawa kept as one combined reporting area per window')

# GIS layers
jp = json.loads((DATA / atlas['gis']['japan']).read_text())['features']
check(len(jp) == 47 and sum(f['properties']['transports'] for f in jp) == 100510, 'Japan polygons: 47 joins, 100,510 transports')
check(all(abs(f['properties']['rate'] - f['properties']['transports'] / (f['properties']['pop_k'] * 1000) * 1e5) < 0.051 for f in jp), 'Japan rate = transports / (pop_k*1000) * 100,000')
check({f['properties']['record'] for f in jp} == {r['id'] for r in by('japan')}, 'Japan polygons link one-to-one to their records')
ind = json.loads((DATA / atlas['gis']['india']).read_text())['features']
check(len(ind) == 28 and [sum(f['properties'][f'y{y}'] for f in ind) for y in range(2018, 2023)] == [890, 1274, 530, 374, 729], 'India polygons: 28 joins, yearly totals match')
inst = json.loads((DATA / atlas['gis']['installations']).read_text())['features']
check(len(inst) >= 30 and not any('count' in f['properties'] for f in inst), 'installation footprints carry no counts (context only)')
checks = atlas.get('anchor_checks', {})
check(all((c['km'] or 0) <= 15 for c in checks.values()), 'every U.S. anchor within 15 km of its MIRTA footprint')
mil = by('military-heat') + by('military-cold')
check(all(f"{r['lat']:g},{r['lon']:g}" in atlas.get('climate', {}) for r in mil), 'ERA5 context available for every military anchor')
ras = atlas.get('raster')
check(ras is None or (ras['units'] == 'K' and ras['cadence'] == 'monthly' and '{time}' in ras['tiles']), 'GIBS raster metadata well formed (or layer omitted)')
check(all(v['status'].startswith('ok') or 'kept' in v['status'] or 'omitted' in v['status'] for v in atlas.get('pipeline', {}).values()), 'optional pipeline stages report a status')

print(f'\n{len(failures)} failure(s)')
sys.exit(1 if failures else 0)
