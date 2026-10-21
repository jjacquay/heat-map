'use strict';
/* Field Atlas of Thermal Extremes — atlas page. */
(function () {
  const { fmt, esc, DATASETS, DISPLAY_LABELS } = HM;
  const $ = id => document.getElementById(id);
  const announce = msg => { const a = $('announcer'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 30); };

  const SOURCE_SHORT = { heat25: 'AFHSD · MSMR May 2026, Table 3', heat24: 'AFHSD · MSMR June 2025, Table 3', cold25: 'AFHSD · MSMR December 2025', japan: 'FDMA 2025 heat illness report', india: 'NCRB via PIB, 20 Aug 2025', maricopa: 'Maricopa County heat deaths report', spain: 'Spain Ministry of Health' };
  const SOURCE_PART = { heat25: 'Table 3', heat24: 'Table 3', heatfull: 'Table 2', cold25: 'Figure 4 and results text', japan: 'Table 4-2 (PDF p. 10)', india: 'Annexure 1', maricopa: 'Table A', spain: 'Summer 2025 press note' };
  const EXPLAIN = {
    'military-heat': 'Counted where a case was diagnosed or reported, one heat illness per person per year, five years together. It reflects who trains and is treated here, not the risk to any one person.',
    'military-cold': 'Counted where a case was diagnosed or reported, one cold injury per person per July–June season, summed over five seasons.',
    japan: 'Ambulance transports for heat illness in May–September 2025. The rate divides by the October 2024 population: a crude rate, not incidence.',
    india: 'Deaths recorded as heat or sunstroke in state administrative statistics. A recorded zero is what was recorded, not proof that no one died of heat.',
    maricopa: 'Deaths the county medical examiner found were caused or contributed to by heat, including people who did not live in the county.',
    spainc: 'Clinically confirmed heat-stroke deaths: a deliberately narrow count, kept apart from modeled estimates.',
    'modeled-deaths': 'A statistical estimate of deaths attributable to heat from daily mortality monitoring (MoMo), not a list of confirmed cases.',
  };

  let data, geo = {}, map = null, mapReady = false, hoverPopup = null;
  let selected = [];
  const history = [];
  const state = { ds: 'military-heat', period: '', region: 'all', q: '', display: '', place: '', lst: '', fp: '1' };
  const symbolMax = {};

  /* ---------- selection ---------- */
  const periodKey = p => { const y = (p.match(/\d{4}/g) || ['0']).map(Number); return [Math.max(...y), p.length]; };
  function periodsFor(ds) {
    return [...new Set(data.records.filter(r => r.layer === ds).map(r => r.period))]
      .sort((a, b) => { const [ya, la] = periodKey(a), [yb, lb] = periodKey(b); return yb - ya || la - lb; });
  }
  function regionsFor(ds) { return [...new Set(data.records.filter(r => r.layer === ds).map(r => r.region))]; }
  function select() {
    const q = state.q.toLowerCase().trim();
    selected = data.records.filter(r => r.layer === state.ds && r.period === state.period && (state.region === 'all' || r.region === state.region) && (!q || r.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.count ?? -1) - (a.count ?? -1) || a.name.localeCompare(b.name));
  }
  const japanProps = r => r && r.layer === 'japan' ? geo.japan?.features.find(f => f.properties.record === r.id)?.properties : null;
  const climateOf = r => data.climate?.[`${r.lat},${r.lon}`];
  const countText = r => r.count === null ? `≥${fmt(r.lower_bound)}` : fmt(r.count);
  const isGrouped = r => /Combined reporting area/.test(r.note);
  const explainKey = r => r.layer === 'civilian-deaths' ? (r.name.startsWith('Spain') ? 'spainc' : 'maricopa') : r.layer;

  /* ---------- UI scaffolding ---------- */
  function setMode(mode, { keepDs } = {}) {
    document.body.classList.toggle('mode-cold', mode === 'cold');
    document.querySelector(`input[name=mode][value=${mode}]`).checked = true;
    const sel = $('dataset');
    const groups = {};
    for (const [id, d] of Object.entries(DATASETS)) if (d.mode === mode) (groups[d.group] ||= []).push(`<option value="${id}">${esc(d.label)}</option>`);
    if (mode === 'cold') groups.Civilians = ['<option disabled>Civilian cold outcomes · not yet imported</option>'];
    sel.innerHTML = Object.entries(groups).map(([g, o]) => `<optgroup label="${g}">${o.join('')}</optgroup>`).join('');
    if (!keepDs || DATASETS[state.ds].mode !== mode) state.ds = mode === 'cold' ? 'military-cold' : (setMode.lastHeat || 'military-heat');
    sel.value = state.ds;
  }
  function buildControls() {
    const ds = DATASETS[state.ds];
    if (ds.mode === 'heat') setMode.lastHeat = state.ds;
    const periods = periodsFor(state.ds);
    if (!periods.includes(state.period)) state.period = ds.defaultPeriod && periods.includes(ds.defaultPeriod) ? ds.defaultPeriod : periods[0];
    $('periodGroup').innerHTML = `<div class="seg">${periods.map(p => `<label class="seg-opt"><input type="radio" name="period" value="${esc(p)}"${p === state.period ? ' checked' : ''}${periods.length === 1 ? ' disabled' : ''}><span>${esc(p)}</span></label>`).join('')}</div>`;
    $('periodGroup').setAttribute('aria-label', `Reporting period${ds.periodNote ? '. ' + ds.periodNote : ''}`);
    const regions = regionsFor(state.ds);
    if (state.region !== 'all' && !regions.includes(state.region)) state.region = 'all';
    $('region').innerHTML = `<option value="all">All published places</option>` + regions.map(r => `<option${r === state.region ? ' selected' : ''}>${esc(r)}</option>`).join('');
    if (!ds.displays.includes(state.display)) state.display = ds.displays[0];
    $('displayOptions').innerHTML = ds.displays.map(d => `<label><input type="radio" name="display" value="${d}"${d === state.display ? ' checked' : ''}><span>${esc(DISPLAY_LABELS[d][0])}<small>${esc(DISPLAY_LABELS[d][1])}</small></span></label>`).join('');
    const military = state.ds.startsWith('military');
    $('footprintRow').hidden = !military;
    $('footprints').checked = state.fp === '1';
    $('search').value = state.q;
  }

  /* ---------- map ---------- */
  function recordFeatures() {
    return { type: 'FeatureCollection', features: selected.map(r => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { id: r.id, name: r.name, c: r.count ?? -1, thr: r.count === null } })) };
  }
  function radiusExpr() {
    const max = symbolMax[state.ds];
    return ['case', ['get', 'thr'], 8, ['max', 3.5, ['*', 30, ['sqrt', ['/', ['get', 'c'], max]]]]];
  }
  const radiusFor = c => Math.max(3.5, 30 * Math.sqrt(c / symbolMax[state.ds]));
  function firstSymbolLayer() { return map.getStyle().layers.find(l => l.type === 'symbol')?.id; }

  function addLayers() {
    if (map.getSource('recs')) return;
    try { HM.paperBasemap(map); } catch { /* fallback style */ }
    const before = firstSymbolLayer();
    const empty = { type: 'FeatureCollection', features: [] };
    map.addSource('japan', { type: 'geojson', data: geo.japan || empty, promoteId: 'iso' });
    map.addSource('india', { type: 'geojson', data: geo.india || empty, promoteId: 'iso' });
    map.addSource('civil', { type: 'geojson', data: geo.civil || empty });
    map.addSource('install', { type: 'geojson', data: geo.install || empty });
    map.addSource('recs', { type: 'geojson', data: empty, promoteId: 'id' });
    map.addLayer({ id: 'japan-fill', type: 'fill', source: 'japan', paint: { 'fill-color': '#E8DCCB', 'fill-opacity': 0.92, 'fill-color-transition': { duration: 300 } } }, before);
    map.addLayer({ id: 'japan-line', type: 'line', source: 'japan', paint: { 'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#182427', '#FBF9F4'], 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.8] } }, before);
    map.addLayer({ id: 'india-fill', type: 'fill', source: 'india', paint: { 'fill-color': '#E7DCCB', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.6] } }, before);
    map.addLayer({ id: 'india-line', type: 'line', source: 'india', paint: { 'line-color': '#B5AC9B', 'line-width': 0.8 } }, before);
    map.addLayer({ id: 'civil-fill', type: 'fill', source: 'civil', paint: { 'fill-color': '#8A3D5C', 'fill-opacity': 0.08 } }, before);
    map.addLayer({ id: 'civil-line', type: 'line', source: 'civil', paint: { 'line-color': '#8A3D5C', 'line-width': 1.2, 'line-dasharray': [3, 2] } }, before);
    map.addLayer({ id: 'install-fill', type: 'fill', source: 'install', minzoom: 5.5, paint: { 'fill-color': '#6E7570', 'fill-opacity': 0.14 } }, before);
    map.addLayer({ id: 'install-line', type: 'line', source: 'install', minzoom: 5.5, paint: { 'line-color': '#5F6762', 'line-width': 1.1 } }, before);
    map.addLayer({ id: 'density', type: 'heatmap', source: 'recs', filter: ['>', ['get', 'c'], 0], paint: { 'heatmap-radius': 42, 'heatmap-intensity': 1, 'heatmap-opacity': 0.85, 'heatmap-weight': 0.5 } });
    map.addLayer({ id: 'rec-circles', type: 'circle', source: 'recs', paint: {
      'circle-radius': 6, 'circle-color': '#C9482D', 'circle-opacity': ['case', ['get', 'thr'], 0, 0.38],
      'circle-stroke-color': '#C9482D', 'circle-stroke-width': ['case', ['get', 'thr'], 2, 1.3],
      'circle-color-transition': { duration: 350 }, 'circle-stroke-color-transition': { duration: 350 } } });
    map.addLayer({ id: 'rec-halo', type: 'circle', source: 'recs', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#182427', 'circle-stroke-width': 2.5 } });
    wireMapEvents();
    mapReady = true;
    render({ camera: false });
    if (state.lst) setLst(true);
  }

  function hoverTip(e, html) {
    hoverPopup ||= new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '260px' });
    hoverPopup.setLngLat(e.lngLat).setHTML(`<div class="tip">${html}</div>`).addTo(map);
  }
  function wireMapEvents() {
    let hovered = null;
    const unhover = () => { if (hovered) { map.setFeatureState(hovered, { hover: false }); hovered = null; } };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; unhover(); hoverPopup?.remove(); };
    map.on('mousemove', 'rec-circles', e => { const r = data.recordById[e.features[0].properties.id]; hoverTip(e, `<b>${esc(r.name)}</b><span>${countText(r)} ${esc(DATASETS[r.layer].unit)} · ${esc(r.period)}</span>`); });
    map.on('click', 'rec-circles', e => selectRecord(e.features[0].properties.id, { from: 'map' }));
    for (const id of ['japan-fill', 'india-fill']) {
      const src = id.split('-')[0];
      map.on('mousemove', id, e => {
        const f = e.features[0]; unhover(); hovered = { source: src, id: f.id }; map.setFeatureState(hovered, { hover: true });
        const r = recordForPolygon(src, f.properties);
        if (!map.queryRenderedFeatures(e.point, { layers: ['rec-circles'] }).length && r) {
          const jp = japanProps(r);
          hoverTip(e, `<b>${esc(f.properties.name)}</b><span>${jp && state.display !== 'symbols' ? `${fmt(jp[state.display], state.display === 'severe_rate' ? 2 : 1)} per 100,000` : `${countText(r)} ${esc(DATASETS[r.layer].unit)}`} · ${esc(r.period)}</span>`);
        }
      });
      map.on('click', id, e => { if (map.queryRenderedFeatures(e.point, { layers: ['rec-circles'] }).length) return; const r = recordForPolygon(src, e.features[0].properties); if (r) selectRecord(r.id, { from: 'map' }); });
      map.on('mouseenter', id, enter); map.on('mouseleave', id, leave);
    }
    map.on('mousemove', 'install-fill', e => {
      if (map.queryRenderedFeatures(e.point, { layers: ['rec-circles'] }).length) return;
      const p = e.features[0].properties, areas = JSON.parse(p.reporting_areas || '[]');
      hoverTip(e, `<b>${esc(p.site)}</b><span>DoD installation boundary (${esc(p.component)}). Context only: ${areas.length ? 'counts belong to the reporting area “' + esc(areas[0]) + '”' : 'no count is attached to this outline'}.</span>`);
    });
    map.on('mouseenter', 'install-fill', enter); map.on('mouseleave', 'install-fill', leave);
    map.on('mouseenter', 'rec-circles', enter); map.on('mouseleave', 'rec-circles', leave);
    map.on('moveend', syncURL);
  }
  function recordForPolygon(src, props) {
    if (src === 'japan') return data.recordById[props.record];
    return selected.find(r => r.name === `${props.name}, India`) || data.records.find(r => r.layer === 'india' && r.period === state.period && r.name === `${props.name}, India`);
  }

  function japanBreaks(metric) {
    const v = geo.japan.features.map(f => f.properties[metric]).sort((a, b) => a - b);
    return [0.2, 0.4, 0.6, 0.8].map(q => v[Math.floor(q * (v.length - 1))]);
  }
  const RAMP = ['#F3E4CF', '#EBC19C', '#DF9468', '#C9482D', '#8C2A15'];

  function renderMap({ camera }) {
    if (!mapReady) return;
    const ds = DATASETS[state.ds], color = ds.color;
    symbolMax[state.ds] ||= Math.max(...data.records.filter(r => r.layer === state.ds).map(r => r.count || 0), 1);
    map.getSource('recs').setData(recordFeatures());
    const vis = (id, on) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    const choropleth = state.ds === 'japan' && state.display !== 'symbols';
    vis('japan-fill', state.ds === 'japan'); vis('japan-line', state.ds === 'japan');
    if (state.ds === 'japan') {
      if (choropleth) { const b = japanBreaks(state.display); map.setPaintProperty('japan-fill', 'fill-color', ['step', ['get', state.display], RAMP[0], b[0], RAMP[1], b[1], RAMP[2], b[2], RAMP[3], b[3], RAMP[4]]); }
      else map.setPaintProperty('japan-fill', 'fill-color', '#E8DCCB');
      const ids = new Set(selected.map(r => r.id));
      map.setFilter('japan-fill', state.q ? ['in', ['get', 'record'], ['literal', [...ids]]] : null);
    }
    vis('india-fill', state.ds === 'india'); vis('india-line', state.ds === 'india');
    const civ = state.ds === 'civilian-deaths' || state.ds === 'modeled-deaths';
    vis('civil-fill', civ); vis('civil-line', civ);
    if (civ) map.setFilter('civil-fill', ['in', ['get', 'name'], ['literal', selected.map(r => r.name)]]), map.setFilter('civil-line', ['in', ['get', 'name'], ['literal', selected.map(r => r.name)]]);
    const fp = state.ds.startsWith('military') && state.fp === '1';
    vis('install-fill', fp); vis('install-line', fp);
    vis('rec-circles', !choropleth);
    map.setPaintProperty('rec-circles', 'circle-radius', radiusExpr());
    map.setPaintProperty('rec-circles', 'circle-color', color);
    map.setPaintProperty('rec-circles', 'circle-stroke-color', color);
    map.setPaintProperty('rec-circles', 'circle-opacity', ['case', ['get', 'thr'], 0, state.display === 'density' ? 0.12 : 0.38]);
    const dens = state.display === 'density';
    vis('density', dens);
    if (dens) {
      const max = Math.max(1, ...selected.map(r => r.count || 0));
      const rgb = hexToRgb(color);
      map.setPaintProperty('density', 'heatmap-weight', ['/', ['get', 'c'], max]);
      map.setPaintProperty('density', 'heatmap-color', ['interpolate', ['linear'], ['heatmap-density'], 0, `rgba(${rgb},0)`, 0.2, `rgba(${rgb},0.18)`, 0.5, `rgba(${rgb},0.42)`, 1, `rgba(${rgb},0.75)`]);
    }
    map.setFilter('rec-halo', ['==', ['get', 'id'], state.place || '']);
    map.setPaintProperty('rec-halo', 'circle-radius', state.place && data.recordById[state.place] && !choropleth ? (data.recordById[state.place].count === null ? 13 : radiusFor(data.recordById[state.place].count) + 5) : 0);
    map.setPaintProperty('japan-line', 'line-color', ['case', ['==', ['get', 'record'], state.place || ''], '#182427', ['boolean', ['feature-state', 'hover'], false], '#182427', '#FBF9F4']);
    map.setPaintProperty('japan-line', 'line-width', ['case', ['==', ['get', 'record'], state.place || ''], 2.6, ['boolean', ['feature-state', 'hover'], false], 2, 0.8]);
    if (camera) moveCamera(ds.view);
  }
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
  function moveCamera(view, { explicit } = {}) {
    if (!map) return;
    if (explicit && !HM.reducedMotion()) map.flyTo({ ...view, duration: 1400, curve: 1.3, essential: false });
    else map.jumpTo(view);
  }

  /* ---------- legend ---------- */
  function renderLegend() {
    const ds = DATASETS[state.ds];
    const el = $('legendBody');
    let title = state.ds === 'japan' && state.display !== 'symbols' ? DISPLAY_LABELS[state.display][0] : ds.legend;
    $('legendTitle').innerHTML = `${esc(title)}<small>${esc(state.period)}${state.region !== 'all' ? ' · ' + esc(state.region) : ''}</small>`;
    const parts = [];
    if (state.ds === 'japan' && state.display !== 'symbols') {
      const b = japanBreaks(state.display), d = state.display === 'severe_rate' ? 2 : 1;
      const v = geo.japan.features.map(f => f.properties[state.display]);
      parts.push(`<div class="lg-ramp">${RAMP.map(c => `<span style="background:${c}"></span>`).join('')}</div><div class="lg-breaks num"><span>${fmt(Math.min(...v), d)}</span>${b.map(x => `<span>${fmt(x, d)}</span>`).join('')}<span>${fmt(Math.max(...v), d)}</span></div>`);
      parts.push(`<p class="lg-note">Quintiles of 47 prefectures. ${state.display === 'rate65' ? 'Transports aged 65+ ÷ residents aged 65+.' : 'Transports ÷ residents × 100,000.'} Not age-adjusted.</p>`);
    } else if (state.display === 'density') {
      parts.push(`<div class="lg-grad" style="background:linear-gradient(90deg, rgba(${hexToRgb(ds.color)},.05), rgba(${hexToRgb(ds.color)},.75))"></div><div class="lg-breaks"><span>fewer recorded</span><span>more recorded</span></div>`);
      parts.push(`<p class="lg-note">Smoothed published counts at anchors, rescaled to this selection. Changes with zoom. Not temperature, exposure or risk.${state.ds === 'military-cold' ? ' Threshold-only sites are excluded.' : ''}</p>`);
    } else {
      const max = symbolMax[state.ds] || 1;
      const nice = [max / 10, max / 3, max].map(v => { const p = 10 ** Math.floor(Math.log10(v)); return Math.max(1, Math.round(v / p) * p); });
      parts.push(`<div class="lg-sizes">${[...new Set(nice)].map(v => { const r = radiusFor(v); return `<figure><i style="width:${2 * r}px;height:${2 * r}px"></i><figcaption class="num">${fmt(v)}</figcaption></figure>`; }).join('')}</div>`);
      if (state.ds === 'military-cold') parts.push(`<div class="lg-row"><span class="lg-ring"></span>At least 25; exact count not published</div>`);
      parts.push(`<p class="lg-note">Circle area = published count. Markers are reporting-area anchors, not case locations.</p>`);
    }
    if (state.ds.startsWith('military') && state.fp === '1') parts.push(`<div class="lg-row"><span class="lg-foot"></span>DoD installation boundary (zoom in) · context</div>`);
    if (state.ds === 'civilian-deaths' || state.ds === 'modeled-deaths') parts.push(`<p class="lg-note">Dashed outline: the reporting unit the number covers.</p>`);
    el.innerHTML = parts.join('');
    const lst = $('legendLst');
    lst.hidden = !state.lst || !data.raster;
    if (!lst.hidden) {
      const ramp = data.raster.ramp, lo = ramp[0].celsius, hi = ramp[ramp.length - 1].celsius;
      const stops = ramp.map(s => `rgb(${s.rgb}) ${((s.celsius - lo) / (hi - lo) * 100).toFixed(1)}%`).join(',');
      const month = new Date(state.lst + '-01T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      lst.innerHTML = `<p class="legend-title">Land-surface temperature<small>${month} · daytime monthly mean · MODIS Terra</small></p><div class="lg-grad" style="background:linear-gradient(90deg,${stops})"></div><div class="lg-breaks num"><span>${Math.round(lo)} °C</span><span>0</span><span>${Math.round(hi)} °C</span></div><p class="lg-note">Ground (skin) temperature from orbit: not air temperature, heat index or WBGT. Transparent = no data. Converted from kelvin.</p>`;
    }
    $('legend').classList.toggle('compact', window.innerWidth < 860);
  }

  /* ---------- table & summary ---------- */
  function contextCell(r) {
    if (r.layer === 'japan') { const p = japanProps(r); return p ? `${fmt(p.rate, 1)} per 100,000` : '—'; }
    if (r.layer.startsWith('military')) {
      const c = climateOf(r); if (!c) return '—';
      return r.layer === 'military-heat' ? `${fmt(c[r.period]?.hot_days, 1)} days ≥32.2 °C/yr` : `${fmt(c['Jul 2020–Jun 2025']?.freeze_nights, 1)} nights ≤0 °C/season`;
    }
    return '—';
  }
  function renderTable() {
    const ds = DATASETS[state.ds];
    $('extraHead').textContent = state.ds === 'japan' ? 'Rate (2024 pop.)' : state.ds.startsWith('military') ? 'ERA5 context' : 'Context';
    $('rows').innerHTML = selected.map(r => `<tr data-id="${r.id}" class="${r.id === state.place ? 'is-selected' : ''}"><th scope="row"><button type="button" class="rowbtn" data-id="${r.id}">${esc(r.name)}</button>${r.id === state.place ? '<span class="sr-only"> (selected)</span>' : ''}</th><td>${esc(r.period)}</td><td class="r num">${countText(r)}</td><td class="num">${esc(contextCell(r))}</td><td>${esc(r.measure)}</td><td><a class="tag ${r.count === null ? 'thr' : r.layer === 'modeled-deaths' ? 'mod' : ''}" href="#source-${r.source}">${r.count === null ? 'Threshold only' : r.layer === 'modeled-deaths' ? 'Modeled' : 'Published count'} · ${esc(r.source)}</a></td></tr>`).join('')
      || `<tr><td colspan="6">No published observations in this selection. Try a wider period or clear the search.</td></tr>`;
    $('tableCaption').textContent = `${ds.label}, ${state.period}${state.region !== 'all' ? ', ' + state.region : ''}: ${selected.length} records.`;
    const known = selected.filter(r => r.count !== null), thr = selected.length - known.length;
    const total = known.reduce((a, r) => a + r.count, 0);
    let summary = `${selected.length} ${selected.length === 1 ? 'place' : 'places'} · ${ds.label} · ${state.period}. `;
    if (state.ds === 'civilian-deaths') summary += 'Each number keeps its own local definition; no combined total is given.';
    else summary += `${fmt(total)} ${ds.unit} in exact-count records${thr ? `; ${thr} more ${thr === 1 ? 'place is' : 'places are'} known only as “at least 25” and are not added` : ''}.`;
    $('recordSummary').textContent = summary;
    const u = data.unmapped[state.period];
    $('unmapped').textContent = state.ds === 'military-heat' && u
      ? `Not on the map for ${state.period}: ${fmt(u.overseas_excluding_okinawa)} overseas cases outside Okinawa and ${fmt(u.all_other_locations)} at all other locations, which the source does not name. Published worldwide total: ${fmt(u.total)}. The two five-year windows overlap and must not be added.`
      : state.ds === 'military-cold' ? 'Cold counts are five-season totals (July 2020–June 2025), not the 2024–25 season alone. Hollow rings: the source shows the site reached at least 25 but does not print the number.'
      : state.ds === 'india' ? '28 states; union territories are not mapped. Recorded zeros are shown as zeros.' : '';
    $('emptyState').hidden = selected.length > 0;
  }

  /* ---------- field note ---------- */
  function sparkline(rows, current, color) {
    const w = 320, h = 92, x0 = 8, x1 = w - 8, max = Math.max(...rows.map(r => r.v), 1);
    const X = i => x0 + (x1 - x0) * i / (rows.length - 1), Y = v => 62 - 50 * v / max;
    const pts = rows.map((r, i) => `${X(i).toFixed(1)},${Y(r.v).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(rows.map(r => `${r.k}: ${fmt(r.v)}`).join(', '))}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${rows.map((r, i) => `<circle cx="${X(i)}" cy="${Y(r.v)}" r="${r.k === current ? 5 : 3}" fill="${r.k === current ? color : '#FBF9F4'}" stroke="${color}" stroke-width="1.6"/><text x="${X(i)}" y="${h - 6}" text-anchor="middle"${r.k === current ? ' class="lbl"' : ''}>${esc(r.k)}</text><text x="${X(i)}" y="${Y(r.v) - 9}" text-anchor="middle" class="${r.k === current ? 'lbl' : ''}">${fmt(r.v)}</text>`).join('')}</svg>`;
  }
  function whyText(r) {
    const others = data.records.filter(x => x.layer === r.layer && x.lat === r.lat && x.lon === r.lon && x.id !== r.id);
    const alias = others.find(x => x.name !== r.name && r.layer.startsWith('military'));
    if (r.count === null) return 'The source charted this site but did not print its number. All we can say is “at least 25” over five seasons, so it is drawn as a hollow ring and left out of every total.';
    if (alias) return `The other five-year table names this place “${esc(alias.name)}”. Renamed installations are kept exactly as each report printed them.`;
    if (isGrouped(r)) return 'This marker stands for a grouped reporting area: one published count shared by several installations. The count is never split among them.';
    if (r.layer === 'japan') {
      const p = japanProps(r), all = geo.japan.features.map(f => f.properties);
      const shareT = p.transports / all.reduce((a, x) => a + x.transports, 0) * 100, shareP = p.pop_k / all.reduce((a, x) => a + x.pop_k, 0) * 100;
      return `${esc(p.name)} has ${fmt(shareP, 1)}% of Japan's residents and ${fmt(shareT, 1)}% of its heat transports: that gap is what the rate map shows.`;
    }
    if (r.layer === 'india') {
      if (r.count === 0) return `A recorded zero for ${esc(r.period)}. Zero is what the statistics recorded, not evidence that no one died of heat.`;
      const series = data.records.filter(x => x.layer === 'india' && x.name === r.name).map(x => x.count);
      return `Under one unchanged definition, this state's recorded count ranged from ${fmt(Math.min(...series))} to ${fmt(Math.max(...series))} between 2018 and 2022: recording varies as much as weather.`;
    }
    if (r.region !== 'CONUS' && r.layer.startsWith('military')) return `Outside the contiguous United States. ${r.region === 'Overseas' ? 'MIRTA has no boundary here, so no installation outline is drawn.' : 'Alaska and Hawaii have their own geography filter.'}`;
    const c = climateOf(r);
    if (c && r.layer === 'military-heat') return `In the nearest ERA5 grid cell, about ${fmt(c[r.period].hot_days, 0)} days a year reached 32.2 °C (90 °F) in ${esc(r.period)}. That is climate context for the place, not the conditions behind any case.`;
    if (c && r.layer === 'military-cold') return `In the nearest ERA5 grid cell, about ${fmt(c['Jul 2020–Jun 2025'].severe_cold_nights, 0)} nights a season fell to −17.8 °C (0 °F). Climate context, not exposure.`;
    return 'Every number here keeps the definition of the system that recorded it.';
  }

  function fieldNote(r, why) {
    const ds = DATASETS[r.layer], src = data.sourceById[r.source], jp = japanProps(r), c = climateOf(r), check = data.anchor_checks?.[r.id];
    const blocks = [];
    if (jp) {
      const parts = [['deaths', 'Death', '#182427'], ['severe', 'Severe', '#8C2A15'], ['moderate', 'Moderate', '#C9482D'], ['mild', 'Mild', '#EBC19C'], ['other', 'Other/unknown', '#D5CDBD']];
      blocks.push(`<div class="fn-block"><h3>Rates · 2024 population</h3><p class="num"><b>${fmt(jp.rate, 1)}</b> transports per 100,000 residents · <b>${fmt(jp.rate65, 1)}</b> per 100,000 aged 65+ · <b>${fmt(jp.severe_rate, 2)}</b> severe or fatal per 100,000</p></div>`);
      blocks.push(`<div class="fn-block"><h3>Severity at first diagnosis</h3><div class="fn-bars" role="img" aria-label="${parts.map(([k, l]) => `${l} ${fmt(jp[k])}`).join(', ')}">${parts.map(([k, , col]) => `<span style="width:${jp[k] / jp.transports * 100}%;background:${col}"></span>`).join('')}</div><div class="fn-keys num">${parts.map(([k, l, col]) => `<span><i style="background:${col}"></i>${l} ${fmt(jp[k])}</span>`).join('')}</div><p style="margin-top:8px">${fmt(jp.age65 / jp.transports * 100, 0)}% of transports were people aged 65 or older.</p></div>`);
    }
    if (r.layer === 'india' || (r.layer === 'civilian-deaths' && r.name.startsWith('Maricopa'))) {
      const rows = data.records.filter(x => x.layer === r.layer && x.name === r.name).sort((a, b) => a.period.localeCompare(b.period)).map(x => ({ k: x.period, v: x.count }));
      blocks.push(`<div class="fn-block fn-spark"><h3>Same definition, every year</h3>${sparkline(rows, r.period, ds.color)}</div>`);
    }
    if (r.layer === 'military-heat') {
      const other = data.records.find(x => x.layer === r.layer && x.id !== r.id && x.lat === r.lat && x.lon === r.lon);
      if (other) blocks.push(`<div class="fn-block"><h3>Also published</h3><p>${esc(other.period)} window: <b class="num">${fmt(other.count)}</b>${other.name !== r.name ? ` (as “${esc(other.name)}”)` : ''}. The windows share four years, so this is not a trend and the two are never added.</p></div>`);
    }
    if (c) {
      const t = r.layer === 'military-heat' ? `About <b class="num">${fmt(c[r.period].hot_days, 1)}</b> days a year reached ≥32.2 °C; June–August daily highs averaged <b class="num">${fmt(c[r.period].jja_tmax, 1)} °C</b> (${esc(r.period)}).`
        : `About <b class="num">${fmt(c['Jul 2020–Jun 2025'].freeze_nights, 0)}</b> nights a season at or below 0 °C, and <b class="num">${fmt(c['Jul 2020–Jun 2025'].severe_cold_nights, 1)}</b> at or below −17.8 °C (Jul 2020–Jun 2025).`;
      blocks.push(`<div class="fn-block"><h3>Climate context · ERA5 reanalysis</h3><p>${t}</p><p style="color:var(--muted);font-size:12.5px">Air temperature in the ~25 km grid cell nearest the anchor. Not WBGT, and not the conditions when any case occurred.</p></div>`);
    }
    if (check && r.layer.startsWith('military')) {
      blocks.push(`<div class="fn-block"><h3>Where the marker sits</h3><p>${check.sites.length ? `Display anchor ${check.km === 0 ? 'falls inside' : `is ${fmt(check.km, 1)} km from`} the DoD boundary of ${esc(check.sites.join(' + '))}. ${check.sites.length > 1 || isGrouped(r) ? 'Grouped reporting area: one count, several boundaries.' : ''}` : 'No DoD MIRTA boundary is available for this place (overseas or not in the extract). The marker is an approximate anchor.'}</p></div>`);
    }
    const calc = r.count === null ? `The source states ≥${fmt(r.lower_bound)} (the figure's inclusion threshold); the exact count was not published. Excluded from totals.`
      : jp ? `${fmt(jp.transports)} ÷ (${fmt(jp.pop_k)} × 1,000 residents) × 100,000 = ${fmt(jp.rate, 1)}. Population: Statistics Bureau of Japan, 1 Oct 2024 estimate, Table 2 (<a href="#source-jpop">jpop</a>).`
      : 'Published count, reproduced as printed. No adjustment, imputation or rescaling.';
    const view = HM.atlasURL(location.pathname, { ds: r.layer, period: r.period, place: r.id, display: state.display !== DATASETS[r.layer].displays[0] ? state.display : '' });
    return `
      <p class="fn-kicker">${esc(ds.label)} · ${esc(r.region)}</p>
      <h2 class="fn-title" id="fnTitle">${esc(r.name)}</h2>
      <div class="fn-figure"><span class="fn-num${r.count === null ? ' threshold' : ''}">${countText(r)}</span><span class="fn-unit">${esc(r.measure)}${r.count === null ? ' (at least)' : ''}</span></div>
      <p class="fn-period">${esc(r.period)} · ${esc(SOURCE_SHORT[r.source] || src.title)}</p>
      <p class="fn-explain">${esc(r.count === null ? 'The source shows this site only because it reached at least 25 cases over five seasons; its exact count was not published.' : EXPLAIN[explainKey(r)])}</p>
      ${why ? `<p class="fn-why"><b>Why here?</b> ${why}</p>` : ''}
      ${blocks.join('')}
      <details class="trace"><summary>Trace this number</summary><dl>
        <dt>Source</dt><dd><a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.title)} ↗</a></dd>
        <dt>Table</dt><dd>${esc(SOURCE_PART[r.source] || src.status)}</dd>
        <dt>Definition</dt><dd>${esc(r.measure)}. ${esc(r.note)}</dd>
        <dt>Period</dt><dd>${esc(r.period)}</dd>
        <dt>Calculation</dt><dd>${calc}</dd>
        <dt>Location</dt><dd>${esc(r.geocoding)}. Anchor ${fmt(r.lat, 2)}, ${fmt(r.lon, 2)}.</dd>
        <dt>IDs</dt><dd>Record <code>${esc(r.id)}</code> · source <code>${esc(r.source)}</code> · accessed ${esc(src.accessed)}</dd>
      </dl></details>
      <div class="fn-actions"><button type="button" class="btn btn-small" data-fn="zoom">Zoom here</button><button type="button" class="btn btn-small btn-quiet" data-fn="copy" data-url="${esc(view)}">Copy this view</button><a class="btn btn-small btn-quiet" href="#record" data-fn="table">Find in table</a></div>`;
  }

  function openNote(r, why) {
    const fn = $('fieldnote');
    $('fnBody').innerHTML = fieldNote(r, why);
    fn.hidden = false;
    notePadding(true);
    fn.querySelector('[data-fn=zoom]').onclick = () => moveCamera({ center: [r.lon, r.lat], zoom: Math.max(map?.getZoom() || 0, r.layer === 'japan' || r.layer === 'india' ? 5.5 : 7.5) }, { explicit: true });
    fn.querySelector('[data-fn=copy]').onclick = e => HM.copyLink(new URL(e.currentTarget.dataset.url, location.href).href, announce);
  }
  function notePadding(open) {
    $('atlas').classList.toggle('has-note', open);
    if (!map) return;
    if (window.innerWidth > 860) map.setPadding({ top: 60, bottom: 0, left: 0, right: open ? 400 : 0 });
    else map.setPadding({ top: 120, bottom: open ? Math.round(window.innerHeight * 0.5) : 0, left: 0, right: 0 });
  }
  function hideNote() { $('fieldnote').hidden = true; notePadding(false); }
  function closeNote() { hideNote(); notePadding(false); state.place = ''; render({ camera: false }); }

  function selectRecord(id, { from, why, fly } = {}) {
    const r = data.recordById[id]; if (!r) return;
    if (state.place && state.place !== id && from === 'surprise') history.push({ place: state.place, ds: state.ds, period: state.period, cam: map ? { center: map.getCenter(), zoom: map.getZoom() } : null });
    $('backBtn').hidden = !history.length;
    if (r.layer !== state.ds || r.period !== state.period) { if (DATASETS[r.layer].mode !== DATASETS[state.ds].mode) setMode(DATASETS[r.layer].mode); state.ds = r.layer; $('dataset').value = r.layer; state.period = r.period; buildControls(); }
    state.place = id;
    render({ camera: false });
    openNote(r, why);
    if (fly && map) moveCamera({ center: [r.lon, r.lat], zoom: Math.max(map.getZoom(), r.layer === 'japan' ? 5 : r.layer === 'india' ? 4.6 : 5.2) }, { explicit: true });
    if (from !== 'map') { const fnEl = $('fieldnote'); fnEl.focus({ preventScroll: true }); }
    announce(`${r.name}: ${countText(r)} ${DATASETS[r.layer].unit}, ${r.period}.`);
  }

  /* ---------- discovery ---------- */
  function promptText() {
    const benning = data.records.find(r => r.layer === 'military-heat' && r.period === '2021–2025' && r.name.startsWith('Fort Benning'));
    const named = data.records.filter(r => r.layer === 'military-heat' && r.period === '2021–2025');
    const namedSum = named.reduce((a, r) => a + r.count, 0);
    const wain = data.records.find(r => r.layer === 'military-cold' && r.name.startsWith('Fort Wainwright'));
    const thr = data.records.filter(r => r.layer === 'military-cold' && r.count === null).length;
    const jp = geo.japan ? geo.japan.features.map(f => f.properties) : [];
    const top = jp.slice().sort((a, b) => b.rate - a.rate)[0], most = jp.slice().sort((a, b) => b.transports - a.transports)[0];
    const obs = {
      training: `${named.length} named reporting areas hold ${fmt(namedSum)} of the ${fmt(data.unmapped['2021–2025'].total)} active-component heat illnesses published for 2021–2025; ${benning.name.replace(', GA', ', Georgia')} reports the most, ${fmt(benning.count)}.<span class="meta">Cases, one per person per year · MSMR May 2026, Table 3</span>`,
      cold: `${wain.name.replace(', AK', ', Alaska')} has the largest exact total published: ${fmt(wain.count)} cold injuries over five seasons. ${thr} other sites are known only as “at least 25.”<span class="meta">Jul 2020–Jun 2025 · MSMR Dec 2025, Figure 4</span>`,
      japan: top ? `${most.name} had the most transports (${fmt(most.transports)}), but relative to its population ${top.name} was highest: ${fmt(top.rate, 1)} per 100,000 residents.<span class="meta">2025 transports per 100,000 residents (2024 population) · FDMA, Statistics Bureau</span>` : 'Ambulance transports per 100,000 residents.',
    };
    document.querySelectorAll('[data-obs]').forEach(el => { el.innerHTML = obs[el.dataset.obs]; });
    return { benning, wain, top };
  }
  let promptRefs;
  const PROMPTS = {
    training: () => ({ ds: 'military-heat', period: '2021–2025', display: 'symbols', place: promptRefs.benning.id, view: { center: [-88.5, 34.2], zoom: 4.3 } }),
    cold: () => ({ ds: 'military-cold', period: 'Jul 2020–Jun 2025', display: 'symbols', place: promptRefs.wain.id, view: { center: [-121, 53], zoom: 2.2 } }),
    japan: () => ({ ds: 'japan', period: 'May–Sep 2025', display: 'rate', place: promptRefs.top?.record, view: { center: [136.2, 36.2], zoom: 4.4 } }),
  };
  function runPrompt(key, btn) {
    const p = PROMPTS[key]();
    document.querySelectorAll('.prompt').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    setMode(DATASETS[p.ds].mode);
    Object.assign(state, { ds: p.ds, period: p.period, display: p.display, region: 'all', q: '' });
    $('dataset').value = p.ds;
    buildControls();
    render({ camera: false });
    if (p.place) selectRecord(p.place, { from: 'prompt' });  // opens the note (and its map padding) before the camera moves
    moveCamera(window.innerWidth < 860 ? { ...p.view, zoom: p.view.zoom - 0.8 } : p.view, { explicit: true });
    if (window.innerWidth < 860) $('atlas').scrollIntoView({ behavior: HM.reducedMotion() ? 'auto' : 'smooth' });
  }
  function surprise() {
    const pool = selected.filter(r => r.id !== state.place);
    if (!pool.length) { announce('No other places in this selection. Widen the filters to explore more.'); return; }
    const r = pool[Math.floor(Math.random() * pool.length)];
    selectRecord(r.id, { from: 'surprise', why: whyText(r), fly: true });
  }
  function goBack() {
    const prev = history.pop(); if (!prev) return;
    if (prev.ds !== state.ds) { setMode(DATASETS[prev.ds].mode); state.ds = prev.ds; $('dataset').value = prev.ds; }
    state.period = prev.period; buildControls();
    state.place = prev.place; render({ camera: false });
    openNote(data.recordById[prev.place], whyText(data.recordById[prev.place]));
    if (prev.cam && map) moveCamera(prev.cam, { explicit: true });
    $('backBtn').hidden = !history.length;
    $('fieldnote').focus({ preventScroll: true });
  }

  /* ---------- URL state ---------- */
  function syncURL() {
    const s = { ds: state.ds, period: state.period, region: state.region !== 'all' ? state.region : '', q: state.q, display: state.display !== DATASETS[state.ds].displays[0] ? state.display : '', place: state.place, lst: state.lst, fp: state.fp === '1' ? '' : '0' };
    if (map && mapReady) { const c = map.getCenter(); s.cam = `${c.lng.toFixed(3)},${c.lat.toFixed(3)},${map.getZoom().toFixed(2)}`; }
    const url = HM.atlasURL(location.pathname, s);
    window.history.replaceState(null, '', url);
    return new URL(url, location.href).href;
  }
  function readURL() {
    const p = new URLSearchParams(location.search);
    if (p.get('ds') && DATASETS[p.get('ds')]) state.ds = p.get('ds');
    for (const k of ['period', 'region', 'q', 'display', 'place', 'lst', 'fp']) if (p.get(k) !== null) state[k] = p.get(k);
    const placed = data.recordById[state.place];
    if (placed) { state.ds = placed.layer; state.period = placed.period; } else state.place = '';
    if (state.lst && data.raster && !(state.lst >= data.raster.time_start && state.lst <= data.raster.time_end)) state.lst = '';
    const cam = (p.get('cam') || '').split(',').map(Number);
    return cam.length === 3 && cam.every(Number.isFinite) ? { center: [cam[0], cam[1]], zoom: cam[2] } : null;
  }

  /* ---------- raster ---------- */
  function setLst(on) {
    if (!data.raster) return;
    state.lst = on ? ($('lstMonth').value || '2025-07') : '';
    $('lst').checked = on; $('lstOpts').hidden = !on;
    if (mapReady) {
      if (map.getLayer('lst')) map.removeLayer('lst');
      if (map.getSource('lst')) map.removeSource('lst');
      if (on) {
        map.addSource('lst', { type: 'raster', tiles: [data.raster.tiles.replace('{time}', state.lst + '-01')], tileSize: 256, maxzoom: data.raster.max_zoom, attribution: 'Land-surface temperature: <a href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener">NASA GIBS</a> (MODIS Terra)' });
        map.addLayer({ id: 'lst', type: 'raster', source: 'lst', paint: { 'raster-opacity': Number($('lstOpacity').value), 'raster-fade-duration': 200 } }, map.getLayer('japan-fill') ? 'japan-fill' : undefined);
      }
    }
    renderLegend(); syncURL();
  }

  /* ---------- render ---------- */
  function render({ camera = true } = {}) {
    select();
    renderMap({ camera });
    renderLegend();
    renderTable();
    syncURL();
    const ds = DATASETS[state.ds];
    $('displayNote').textContent = state.ds === 'japan' ? 'Rates divide 2025 transports by the 1 Oct 2024 population. They are crude rates, not incidence and not age-adjusted.' : state.ds.startsWith('military') ? 'Military location counts have no population denominator, so they are never shown as rates.' : `${ds.label}: definitions differ by source; compare within this dataset only.`;
  }

  function trendChart() {
    const branch = $('branch').value, outcome = document.querySelector('input[name=outcome]:checked').value;
    const rows = data.trends.filter(r => r.branch === branch && r.measure === outcome);
    const w = 1000, h = 260, l = 50, rt = 30, t = 26, b = 34, max = Math.max(...rows.map(r => r.rate ?? 0), 1) * 1.2;
    const X = i => l + i * (w - l - rt) / (rows.length - 1), Y = v => h - b - v / max * (h - t - b);
    const color = outcome === 'Heat stroke' ? '#8C2A15' : '#C9482D';
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(branch)} ${esc(outcome.toLowerCase())} rate per 100,000 person-years: ${rows.map(r => `${r.year} ${r.rate ?? 'not separately reported'}`).join(', ')}">`;
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line x1="${l}" x2="${w - rt}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E2DACA"/><text x="${l - 10}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(0)}</text>`; }
    const pts = rows.map((r, i) => r.rate === null ? null : `${X(i)},${Y(r.rate)}`).filter(Boolean);
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round"/>`;
    rows.forEach((r, i) => { s += `<text x="${X(i)}" y="${h - 10}" text-anchor="middle">${r.year}</text>`; s += r.rate === null ? `<text x="${X(i)}" y="${h - b - 8}" text-anchor="middle">not separately reported</text>` : `<circle cx="${X(i)}" cy="${Y(r.rate)}" r="5" fill="${color}" stroke="#F4F0E7" stroke-width="2"/><text class="val" x="${X(i)}" y="${Y(r.rate) - 13}" text-anchor="middle">${r.rate.toFixed(1)}</text><text x="${X(i)}" y="${Y(r.rate) + 22}" text-anchor="middle">${r.count === null ? '' : fmt(r.count) + ' cases'}</text>`; });
    $('trendChart').innerHTML = s + '</svg>';
  }
  function renderSources() {
    const q = $('sourceSearch').value.toLowerCase();
    $('sourceList').innerHTML = data.sources.filter(s => JSON.stringify(s).toLowerCase().includes(q)).map(s => `<article class="source" id="source-${s.id}"><div class="src-meta"><span>${esc(s.scope)}</span><span class="src-status">${esc(s.status)}</span></div><h3><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a></h3><p>${esc(s.notes)}</p><p class="src-meta" style="margin-top:6px"><span>ID <code>${esc(s.id)}</code> · accessed ${esc(s.accessed)}</span></p></article>`).join('') || '<p>No sources match that search.</p>';
  }

  /* ---------- exports ---------- */
  function exportRows() {
    return selected.map(r => {
      const s = data.sourceById[r.source], jp = japanProps(r);
      return { id: r.id, dataset: r.layer, name: r.name, period: r.period, count: r.count, lower_bound: r.lower_bound, count_status: r.count === null ? 'threshold only (at least lower_bound); exact count not published' : r.layer === 'modeled-deaths' ? 'modeled estimate' : 'published count',
        measure: r.measure, definition_note: r.note, region: r.region, lat: r.lat, lon: r.lon, geocoding: r.geocoding,
        rate_per_100k_2024pop: jp ? jp.rate : '', population_2024_thousands: jp ? jp.pop_k : '',
        source_id: r.source, source_title: s.title, source_table: SOURCE_PART[r.source] || '', source_url: s.url, accessed: s.accessed };
    });
  }
  function download(name, text, type) { const u = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); }
  const fileStem = () => `heat-map-${state.ds}-${state.period.replace(/[^\w]+/g, '-')}`.toLowerCase();
  function exportCSV() {
    const rows = exportRows(); if (!rows.length) return announce('Nothing to download in this selection.');
    const keys = Object.keys(rows[0]), q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    download(fileStem() + '.csv', [keys.join(','), ...rows.map(r => keys.map(k => q(r[k])).join(','))].join('\r\n'), 'text/csv;charset=utf-8');
    announce(`Downloaded ${rows.length} records as CSV.`);
  }
  function exportGeo() {
    const rows = exportRows(); if (!rows.length) return announce('Nothing to download in this selection.');
    const fc = { type: 'FeatureCollection', note: 'Points are approximate display anchors for published reporting areas, not case locations. Counts from different datasets are not comparable.', features: rows.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: p })) };
    download(fileStem() + '.geojson', JSON.stringify(fc, null, 1), 'application/geo+json');
    announce(`Downloaded ${rows.length} records as GeoJSON.`);
  }

  /* ---------- boot ---------- */
  function initMap(cam) {
    const fb = $('mapFallback');
    const fail = msg => { fb.hidden = false; fb.innerHTML = `<div><h3>The map couldn't start here.</h3><p>${esc(msg)} Every record is still in the table, with downloads and sources.</p><a class="btn btn-small" href="#record">Open the table</a></div>`; };
    if (!window.maplibregl) return fail('The open-source map library did not load (offline or blocked).');
    try {
      map = new maplibregl.Map({ container: 'map', style: HM.BASEMAP, ...(cam || DATASETS[state.ds].view), minZoom: 1, maxZoom: 12, cooperativeGestures: false, attributionControl: false, dragRotate: false, pitchWithRotate: false, fadeDuration: 150 });
    } catch (e) { map = null; return fail('This browser could not create a WebGL map.'); }
    map.touchZoomRotate.disableRotation();
    map.scrollZoom.setWheelZoomRate(1 / 300);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Boundaries: Natural Earth, U.S. Census, DoD MIRTA · Climate: ERA5/Open-Meteo' }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90 }), 'bottom-right');
    let styleLoaded = false, baseErrors = 0;
    map.on('style.load', () => { styleLoaded = true; if (!map.getSource('recs')) { mapReady = false; addLayers(); } });
    const banner = $('mapBanner');
    map.on('error', e => {
      const sid = e.sourceId || e.source?.id;
      if (sid === 'lst') { banner.hidden = false; banner.textContent = 'NASA imagery did not load for this month. The data layers are unaffected.'; return; }
      if (!styleLoaded) return;
      if (sid === 'openmaptiles' || sid === 'ne2_shaded') { if (++baseErrors > 6) { banner.hidden = false; banner.textContent = 'Some basemap tiles did not load. Data layers and the table are unaffected.'; } }
    });
    setTimeout(() => { if (!styleLoaded) { banner.hidden = false; banner.textContent = 'The basemap did not load, so the data are drawn on simplified Natural Earth outlines. The table below lists every record.'; map.setStyle(HM.fallbackStyle('')); } }, 9000);
    map.once('load', () => document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    map.on('webglcontextlost', () => fail('The browser lost its WebGL context.'));
  }

  async function init() {
    try {
      data = await HM.load('');
      const [japan, india, civil, install] = await Promise.all(['japan', 'india', 'civilian', 'installations'].map(k => HM.loadGeo('', data.gis[k])));
      Object.assign(geo, { japan, india, civil, install });
    } catch (e) {
      $('recordSummary').textContent = 'The data could not be loaded. Reload the page, or download the CSV directly.';
      $('mapFallback').hidden = false; $('mapFallback').innerHTML = `<div><h3>Data unavailable.</h3><p>${esc(e.message)}</p><a class="btn btn-small" href="data/observations.csv">Download observations.csv</a></div>`;
      return;
    }
    promptRefs = promptText();
    const cam = readURL();
    setMode(DATASETS[state.ds].mode, { keepDs: true });
    buildControls();
    if (data.raster) {
      Object.assign($('lstMonth'), { min: data.raster.time_start, max: data.raster.time_end, value: state.lst || (data.raster.time_end >= '2025-07' ? '2025-07' : data.raster.time_end) });
      $('lstSub').textContent = `NASA MODIS Terra · monthly daytime · ${data.raster.time_start.slice(0, 4)}–${data.raster.time_end.slice(0, 4)}`;
    } else { $('lst').disabled = true; $('lstSub').textContent = 'Temporarily unavailable: NASA layer metadata could not be read at build time.'; }
    $('lst').checked = !!state.lst; $('lstOpts').hidden = !state.lst;
    initMap(cam);
    render({ camera: false });
    trendChart(); renderSources();
    if (state.place && data.recordById[state.place]) openNote(data.recordById[state.place]);

    document.querySelectorAll('input[name=mode]').forEach(i => i.addEventListener('change', () => { setMode(i.value); state.place = ''; hideNote(); buildControls(); render(); announce(`${i.value === 'heat' ? 'Heat' : 'Cold'} mode: ${DATASETS[state.ds].label}.`); }));
    $('dataset').addEventListener('change', e => { state.ds = e.target.value; state.place = ''; hideNote(); buildControls(); render(); });
    $('periodGroup').addEventListener('change', e => { if (e.target.name === 'period') { state.period = e.target.value; if (state.place) { const cur = data.recordById[state.place]; const twin = data.records.find(r => r.layer === state.ds && r.period === state.period && r.lat === cur.lat && r.lon === cur.lon); state.place = twin ? twin.id : ''; if (twin) openNote(twin); else hideNote(); } render({ camera: false }); } });
    $('region').addEventListener('change', e => { state.region = e.target.value; render({ camera: false }); });
    $('displayOptions').addEventListener('change', e => { state.display = e.target.value; render({ camera: false }); if (state.place) openNote(data.recordById[state.place]); });
    let t; $('search').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; render({ camera: false }); }, 120); });
    $('search').addEventListener('keydown', e => { if (e.key === 'Enter') { state.q = e.target.value; render({ camera: false }); if (selected[0]) selectRecord(selected[0].id, { fly: true }); else announce('No published place matches that search in this dataset.'); } });
    $('footprints').addEventListener('change', e => { state.fp = e.target.checked ? '1' : '0'; render({ camera: false }); });
    $('lst').addEventListener('change', e => setLst(e.target.checked));
    $('lstMonth').addEventListener('change', e => { const v = e.target.value; if (v && v >= data.raster.time_start && v <= data.raster.time_end) { $('mapBanner').hidden = true; setLst(true); } else { e.target.value = state.lst || '2025-07'; announce(`Choose a month between ${data.raster.time_start} and ${data.raster.time_end}.`); } });
    $('lstOpacity').addEventListener('input', e => { if (map?.getLayer('lst')) map.setPaintProperty('lst', 'raster-opacity', Number(e.target.value)); });
    const more = $('moreBtn'), panel = $('morePanel');
    const setMore = open => { panel.hidden = !open; more.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('select, input').focus(); };
    more.addEventListener('click', () => setMore(panel.hidden));
    $('moreClose').addEventListener('click', () => { setMore(false); more.focus(); });
    $('fnClose').addEventListener('click', () => { closeNote(); $('map').focus({ preventScroll: true }); });
    document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!panel.hidden) { setMore(false); more.focus(); } else if (!$('fieldnote').hidden) closeNote(); });
    $('surprise').addEventListener('click', surprise);
    $('backBtn').addEventListener('click', goBack);
    $('resetBtn').addEventListener('click', () => { Object.assign(state, { ds: 'military-heat', period: '', region: 'all', q: '', display: '', place: '', fp: '1' }); history.length = 0; $('backBtn').hidden = true; setMode('heat'); state.ds = 'military-heat'; $('dataset').value = state.ds; buildControls(); hideNote(); setLst(false); document.querySelectorAll('.prompt').forEach(b => b.setAttribute('aria-pressed', 'false')); render(); announce('View reset to military heat illness, 2021–2025.'); });
    $('copyBtn').addEventListener('click', () => HM.copyLink(syncURL(), announce));
    $('exploreBtn').addEventListener('click', () => { $('atlas').scrollIntoView({ behavior: HM.reducedMotion() ? 'auto' : 'smooth', block: 'start' }); document.querySelector('input[name=mode]:checked').focus({ preventScroll: true }); });
    document.querySelectorAll('.prompt').forEach(b => b.addEventListener('click', () => runPrompt(b.dataset.prompt, b)));
    document.querySelector('[data-action=clear]').addEventListener('click', () => { state.q = ''; state.region = 'all'; buildControls(); render({ camera: false }); });
    $('rows').addEventListener('click', e => { const b = e.target.closest('.rowbtn'); if (!b) return; selectRecord(b.dataset.id, { fly: true }); const top = $('atlas').getBoundingClientRect().top; if (top < -200 || top > window.innerHeight) $('atlas').scrollIntoView({ behavior: HM.reducedMotion() ? 'auto' : 'smooth' }); });
    document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.goto;
      if (g === 'japan') return runPrompt('japan', document.querySelector('[data-prompt=japan]'));
      const r = g === 'maricopa' ? data.records.find(x => x.layer === 'civilian-deaths' && x.name.startsWith('Maricopa') && x.period === '2025') : data.records.find(x => x.layer === 'modeled-deaths');
      selectRecord(r.id, { fly: true }); $('atlas').scrollIntoView({ behavior: HM.reducedMotion() ? 'auto' : 'smooth' });
    }));
    $('exportCsv').addEventListener('click', exportCSV);
    $('exportGeo').addEventListener('click', exportGeo);
    $('branch').addEventListener('change', trendChart);
    document.querySelectorAll('input[name=outcome]').forEach(i => i.addEventListener('change', trendChart));
    $('sourceSearch').addEventListener('input', renderSources);
    window.addEventListener('resize', () => $('legend').classList.toggle('compact', window.innerWidth < 860));
  }
  document.addEventListener('DOMContentLoaded', init);
})();
