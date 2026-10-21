'use strict';
/* Shared helpers for the atlas and the story. Exposes window.HM. */
(function () {
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const fmt = (n, d = 0) => n == null ? '—' : (d ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : nf.format(n));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One entry per dataset. Datasets are never mixed on one map or legend.
  const DATASETS = {
    'military-heat': { mode: 'heat', group: 'Service members', label: 'Military · heat illness', short: 'Heat illness cases', color: '#C9482D',
      unit: 'heat illness cases', legend: 'Heat illness cases, active component', periodNote: 'Five-year windows overlap; never add them.',
      displays: ['symbols', 'density'], view: { center: [-92, 35.5], zoom: 3.4 }, defaultPeriod: '2021–2025' },
    'military-cold': { mode: 'cold', group: 'Service members', label: 'Military · cold injury', short: 'Cold injury cases', color: '#225E89',
      unit: 'cold injury cases', legend: 'Cold injury cases, five seasons', periodNote: 'July–June cold seasons.',
      displays: ['symbols', 'density'], view: { center: [-112, 46], zoom: 2.5 } },
    japan: { mode: 'heat', group: 'Civilians', label: 'Japan · ambulance transports', short: 'Ambulance transports', color: '#C9482D',
      unit: 'ambulance transports', legend: 'Heat-illness ambulance transports', displays: ['rate', 'severe_rate', 'rate65', 'symbols'],
      view: { center: [136.5, 36.4], zoom: 4.3 } },
    india: { mode: 'heat', group: 'Civilians', label: 'India · recorded heat deaths', short: 'Recorded deaths', color: '#A8452C',
      unit: 'recorded heat / sunstroke deaths', legend: 'Recorded heat/sunstroke deaths', displays: ['symbols', 'density'],
      view: { center: [80.5, 22.5], zoom: 3.9 }, defaultPeriod: '2022' },
    'civilian-deaths': { mode: 'heat', group: 'Civilians', label: 'Civilian · observed heat deaths', short: 'Observed deaths', color: '#8A3D5C',
      unit: 'observed deaths', legend: 'Observed heat deaths (source-defined)', displays: ['symbols'],
      view: { center: [-50, 37], zoom: 1.7 }, defaultPeriod: '2025' },
    'modeled-deaths': { mode: 'heat', group: 'Civilians', label: 'Civilian · modeled heat deaths', short: 'Modeled deaths', color: '#5D5A8C',
      unit: 'modeled attributable deaths', legend: 'Modeled heat-attributable deaths', displays: ['symbols'],
      view: { center: [-3.7, 40.2], zoom: 4.4 } },
  };
  const DISPLAY_LABELS = {
    symbols: ['Proportional symbols', 'Circle area = published count'],
    density: ['Relative concentration', 'Smoothed recorded counts; not temperature or risk'],
    rate: ['2025 transports per 100,000 residents (2024 population)', 'Crude rate; not incidence'],
    severe_rate: ['Severe or fatal transports per 100,000 residents (2024 population)', 'Initial-diagnosis severity'],
    rate65: ['Transports aged 65+ per 100,000 residents aged 65+ (2024 population)', 'Age-group rate, not age-adjusted'],
  };

  function atlasURL(base, s) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(s)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
    return base + (p.toString() ? '?' + p.toString() : '') + '#atlas';
  }

  async function load(base = '') {
    const r = await fetch(base + 'data/atlas.json');
    if (!r.ok) throw new Error(`Data file unavailable (HTTP ${r.status}).`);
    const data = await r.json();
    data.sourceById = Object.fromEntries(data.sources.map(s => [s.id, s]));
    data.recordById = Object.fromEntries(data.records.map(r => [r.id, r]));
    return data;
  }
  async function loadGeo(base, path) {
    try { const r = await fetch(base + 'data/' + path); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // Warm the OpenFreeMap "positron" style toward the paper palette.
  function paperBasemap(map) {
    const set = (id, prop, val) => { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, val); } catch { /* layer variant absent */ } };
    for (const l of map.getStyle().layers) {
      const id = l.id;
      if (l.type === 'background') set(id, 'background-color', '#EFE9DD');
      else if (id === 'water' || id.startsWith('water')) { if (l.type === 'fill') set(id, 'fill-color', '#D3DDDC'); if (l.type === 'line') set(id, 'line-color', '#C3D0CF'); }
      else if (id.startsWith('landcover') || id === 'park' || id.startsWith('landuse')) { if (l.type === 'fill') { set(id, 'fill-color', '#E6E0D1'); set(id, 'fill-opacity', 0.5); } }
      else if (id === 'building') set(id, 'fill-color', '#E4DDCE');
      else if (id.startsWith('highway') || id.startsWith('road') || id.startsWith('tunnel') || id.startsWith('railway') || id.startsWith('aeroway')) { if (l.type === 'line') set(id, 'line-color', '#E2DAC9'); }
      else if (id.startsWith('boundary')) set(id, 'line-color', '#A9A293');
      if (l.type === 'symbol') { set(id, 'text-color', '#5C6461'); set(id, 'text-halo-color', '#F4F0E7'); }
      // Quieter basemap: drop small-place, road and POI labels so the data lead.
      if (/^(label_village|label_town|label_other|airport|highway-name|highway-shield|road_shield|water_name_line)/.test(id)) { try { map.setLayoutProperty(id, 'visibility', 'none'); } catch { /* absent */ } }
    }
  }
  // Used when the vector basemap cannot load: Natural Earth outlines shipped with the site.
  const fallbackStyle = base => ({ version: 8, sources: { world: { type: 'geojson', data: base + 'data/gis/world-fallback.geojson' } }, layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': '#D9E1DF' } },
    { id: 'land', type: 'fill', source: 'world', paint: { 'fill-color': '#EFE9DD' } },
    { id: 'borders', type: 'line', source: 'world', paint: { 'line-color': '#B9B2A3', 'line-width': 0.6 } }] });
  const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';

  async function copyLink(url, announce) {
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {
      const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } t.remove();
    }
    announce(ok ? 'Link copied. It reopens this exact view.' : 'Could not copy automatically. The link is in the address bar.');
    return ok;
  }

  window.HM = { fmt, esc, reducedMotion, DATASETS, DISPLAY_LABELS, atlasURL, load, loadGeo, paperBasemap, fallbackStyle, BASEMAP, copyLink };
})();
