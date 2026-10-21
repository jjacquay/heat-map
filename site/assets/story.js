'use strict';
/* The Recorded and the Real — chaptered scrollytelling over the atlas data. */
(function () {
  const { fmt, esc } = HM;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  let W = 600;  // chart canvas width; narrower for phone inline figures so text stays legible
  const announce = msg => { const a = $('announcer'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 30); };
  let data = null, map = null, mapOk = false, markers = [];

  // Each SVG gets its own pattern ids: the same chart is drawn inline (phones) and
  // in the sticky figure (desktop), and a shared id would resolve to a hidden copy.
  let uid = 0;
  function svg(h, label) {
    const s = document.createElementNS(NS, 'svg'), n = ++uid;
    s.hatch = `hatch-${n}`; s.hatch2 = `hatchd-${n}`;
    s.setAttribute('viewBox', `0 0 ${W} ${h}`);
    s.setAttribute('role', 'img');
    if (label) s.setAttribute('aria-label', label);
    s.innerHTML = `<defs><pattern id="${s.hatch}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="hatchline" x1="0" y1="0" x2="0" y2="6"/></pattern><pattern id="${s.hatch2}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="#A93A22" stroke-width="2"/></pattern></defs>`;
    return s;
  }
  function el(s, tag, attrs, text) {
    if (attrs.class === 'estbox') attrs = { ...attrs, fill: `url(#${s.hatch})` };
    if (attrs.fill === 'url(#hatch2)') attrs = { ...attrs, fill: `url(#${s.hatch2})` };
    const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; s.appendChild(e); return e; }

  /* ---------- chart builders ---------- */
  function waffle() {
    const cols = 13, gap = W < 500 ? 4 : 6, x0 = W < 500 ? 4 : 25, size = (W - 2 * x0) / cols - gap, s = svg(Math.round(8 * (size + gap) * 0.85 + 46), 'Of 104 matches, about 26 projected at or above 26 °C WBGT, 5 of them at or above 28 °C. Projections, not measurements.');
    for (let i = 0; i < 104; i++) {
      const c = i % cols, r = Math.floor(i / cols), x = x0 + c * (size + gap), y = 10 + r * (size + gap) * 0.85;
      const attrs = { x, y, width: size, height: size * 0.72, class: i < 26 ? 'estbox' : 'empty' };
      if (i < 5) Object.assign(attrs, { class: '', fill: 'url(#hatch2)', stroke: '#A93A22', 'stroke-width': 1.4 });
      el(s, 'rect', attrs);
    }
    el(s, 'text', { x: x0, y: Math.round(8 * (size + gap) * 0.85 + 34), class: 'mono muted' }, W < 500 ? 'Dense: ≥28 °C · light: ≥26 °C · outline: <26 °C WBGT' : 'Dense hatch: ≥ 28 °C WBGT · light hatch: ≥ 26 °C · outline: below 26 °C');
    return s;
  }
  function big(num, l1, l2) {
    const s = svg(250, `${num} ${l1}. ${l2 || ''}`);
    el(s, 'text', { x: 16, y: 118, class: 'big' }, num);
    el(s, 'text', { x: 20, y: 166, style: 'font-size:18px' }, l1);
    if (l2) el(s, 'text', { x: 20, y: 196, class: 'muted', style: 'font-size:15px' }, l2);
    return s;
  }
  function gap() {
    const rows = [
      { l: 'U.S. heat deaths, 2023', rec: 2325, base: 11000, kind: 'estbox', rl: '2,325 on death certificates (provisional)', bl: '≈11,000 excess-death estimate' },
      { l: 'Spain heat deaths, summer 2025', rec: 25, base: 3832, kind: 'estbox', rl: '25 confirmed heat stroke', bl: '3,832 attributed by model' },
      { l: 'U.S. military heat stroke, 2018–22', rec: 997, base: 2103, kind: 'enc', rl: '997 with a reportable-event record (47.4%)', bl: '2,103 diagnosed encounters' },
      { l: 'U.S. military heat exhaustion, 2018–22', rec: 3227, base: 9115, kind: 'enc', rl: '3,227 with a record (35.4%)', bl: '9,115 diagnosed encounters' },
    ];
    const s = svg(rows.length * (W < 500 ? 100 : 86) + 6, rows.map(r => `${r.l}: ${r.rl} of ${r.bl}`).join('. ')), x0 = W < 500 ? 4 : 20, bw = W - 2 * x0, rowH = W < 500 ? 100 : 86;
    rows.forEach((r, i) => {
      const y = 8 + i * rowH;
      el(s, 'text', { x: x0, y: y + 12, style: 'font-weight:600' }, r.l);
      el(s, 'rect', { x: x0, y: y + 22, width: bw, height: 24, class: r.kind });
      el(s, 'rect', { x: x0, y: y + 22, width: Math.max(2, bw * r.rec / r.base), height: 24, class: 'rec' });
      el(s, 'text', { x: x0, y: y + 64, class: 'mono rec-text' }, r.rl);
      el(s, 'text', W < 500 ? { x: x0, y: y + 82, class: 'mono muted' } : { x: x0 + bw, y: y + 64, class: 'mono muted', 'text-anchor': 'end' }, 'of ' + r.bl);
    });
    return s;
  }
  function compare(a, b, note, label) {
    const s = svg(300, label), base = 250, max = Math.max(a.v, b.v), h = 200;
    const bwid = W < 500 ? 90 : 100;
    [[a, W * 0.23], [b, W * 0.6]].forEach(([d, x]) => {
      const hh = h * d.v / max;
      el(s, 'rect', { x, y: base - hh, width: bwid, height: hh, class: d.cls });
      el(s, 'text', { x: x + bwid / 2, y: base - hh - 10, 'text-anchor': 'middle', style: 'font-family:var(--serif);font-weight:800;font-size:28px' }, d.lab);
      el(s, 'text', { x: x + bwid / 2, y: base + 22, 'text-anchor': 'middle', class: 'muted' }, d.name);
    });
    el(s, 'line', { x1: W / 6, x2: W * 5 / 6, y1: base, y2: base, class: 'grid' });
    if (note) el(s, 'text', { x: W / 2, y: 292, 'text-anchor': 'middle', class: 'mono muted' }, note);
    return s;
  }
  function stack(segs, total, top, label) {
    const s = svg(200, label), x0 = W < 500 ? 4 : 20, bw = W - 2 * x0; let x = x0;
    if (top) el(s, 'text', { x: x0, y: 34, style: 'font-family:var(--serif);font-weight:800;font-size:30px' }, top);
    segs.forEach(g => {
      const w = bw * g.v / total;
      el(s, 'rect', { x, y: 54, width: w, height: 56, class: g.cls });
      el(s, 'text', { x: x + 6, y: 134, class: 'mono' }, g.pct);
      el(s, 'text', { x: x + 6, y: 154, class: 'muted', style: 'font-size:12.5px' }, g.l);
      if (g.l2) el(s, 'text', { x: x + 6, y: 171, class: 'muted', style: 'font-size:12.5px' }, g.l2);
      x += w;
    });
    return s;
  }
  function columns(rows, max) {
    const s = svg(300, rows.map(r => `${r.l}: ${fmt(r.v)}`).join(', ')), base = 250, h = 210, x0 = 40, gp = W < 500 ? 22 : 40, bw = (W - x0 - 20) / 3 - gp;
    [0.25, 0.5, 0.75, 1].forEach(f => { const y = base - h * f; el(s, 'line', { x1: x0 - 10, x2: W - 20, y1: y, y2: y, class: 'grid' }); el(s, 'text', { x: x0 - 14, y: y + 4, class: 'mono muted', 'text-anchor': 'end' }, fmt(Math.round(max * f / 1000)) + 'k'); });
    rows.forEach((r, i) => { const x = x0 + 10 + i * (bw + gp), hh = h * r.v / max; el(s, 'rect', { x, y: base - hh, width: bw, height: hh, class: 'estbox' }); el(s, 'text', { x: x + bw / 2, y: base - hh - 8, 'text-anchor': 'middle', class: 'mono' }, fmt(r.v)); el(s, 'text', { x: x + bw / 2, y: base + 20, 'text-anchor': 'middle' }, r.l); });
    return s;
  }
  function hbars(rows, max, ticks, hl, cls) {
    const rh = 20, s = svg(rows.length * rh + 30, rows.map(r => `${r.l}: ${fmt(r.v)}`).join(', ')), lx = W < 500 ? 172 : 220, bw = W - lx - 44;
    ticks.forEach(v => { const x = lx + bw * v / max; el(s, 'line', { x1: x, x2: x, y1: 4, y2: rows.length * rh + 6, class: 'grid' }); el(s, 'text', { x, y: rows.length * rh + 22, class: 'mono muted', 'text-anchor': 'middle' }, fmt(v)); });
    rows.forEach((r, i) => {
      const y = 6 + i * rh, on = hl.includes(r.l);
      el(s, 'text', { x: lx - 8, y: y + 12, 'text-anchor': 'end', style: 'font-size:12px' + (on ? ';font-weight:700' : ''), class: on ? '' : 'muted' }, r.l);
      el(s, 'rect', { x: lx, y: y + 2, width: bw * r.v / max, height: rh - 6, class: on ? cls : 'acc', opacity: on ? 1 : 0.55, rx: 2 });
      el(s, 'text', { x: lx + bw * r.v / max + 6, y: y + 12, class: 'mono', style: 'font-size:11px' }, fmt(r.v));
    });
    return s;
  }
  function lines(series) {
    const s = svg(320, series.map(se => `${se.n}: ${se.v.join(', ')}`).join('. ')), x0 = 48, x1 = W - 140, y0 = 280, y1 = 20, max = 1600;
    const X = i => x0 + (x1 - x0) * i / 4, Y = v => y0 - (y0 - y1) * v / max;
    [0, 400, 800, 1200, 1600].forEach(v => { el(s, 'line', { x1: x0, x2: x1, y1: Y(v), y2: Y(v), class: 'grid' }); el(s, 'text', { x: x0 - 8, y: Y(v) + 4, class: 'mono muted', 'text-anchor': 'end' }, fmt(v)); });
    [2021, 2022, 2023, 2024, 2025].forEach((y, i) => el(s, 'text', { x: X(i), y: y0 + 22, class: 'mono muted', 'text-anchor': 'middle' }, y));
    const nudge = { 'Air Force': 10, Navy: -6 };
    series.forEach(se => {
      el(s, 'polyline', { points: se.v.map((v, i) => `${X(i)},${Y(v)}`).join(' '), class: 'line', style: `stroke:${se.c}` });
      se.v.forEach((v, i) => el(s, 'circle', { cx: X(i), cy: Y(v), r: i === 4 ? 4.5 : 2.6, style: `fill:${se.c}` }));
      el(s, 'text', { x: x1 + 10, y: Y(se.v[4]) + 4 + (nudge[se.n] || 0), style: 'font-size:12.5px;font-weight:600' }, `${se.n} ${fmt(se.v[4])}`);
    });
    return s;
  }

  /* ---------- chapters ---------- */
  const SRC = (href, text) => `Source: <a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  function charts() {
    const named = data.records.filter(r => r.layer === 'military-heat' && r.period === '2021–2025').sort((a, b) => b.count - a.count);
    const short = n => n.replace('MCB Camp Lejeune / Cherry Point', 'Camp Lejeune/Cherry Point').replace('MCRD Parris Island / Beaufort', 'Parris Island/Beaufort').replace('MCRD San Diego / NB San Diego', 'MCRD/NB San Diego');
    const bases = named.map(r => ({ l: short(r.name), v: r.count }));
    const coldExact = data.records.filter(r => r.layer === 'military-cold' && r.count !== null).sort((a, b) => b.count - a.count).map(r => ({ l: r.name, v: r.count }));
    const coldThr = data.records.filter(r => r.layer === 'military-cold' && r.count === null).length;
    const totals = b => [2021, 2022, 2023, 2024, 2025].map(y => data.trends.filter(t => t.branch === b && t.year === y).reduce((a, t) => a + (t.count || 0), 0));
    const series = [['Army', '#182427'], ['Marine Corps', '#C9482D'], ['Air Force', '#8C8573'], ['Navy', '#225E89']].map(([n, c]) => ({ n, c, v: totals(n) }));
    return {
      worldcup: { t: 'Projected heat at the 2026 World Cup', s: 'Expected number of the 104 matches by projected outdoor wet-bulb globe temperature (WBGT). Includes air-conditioned venues.', src: SRC('https://www.worldweatherattribution.org/climate-change-big-player-at-fifa-world-cup-2026/', 'World Weather Attribution, 14 May 2026') + '. Projections, not measurements.', f: waffle },
      global: { t: 'Heat-related deaths worldwide', s: 'Average per year, 2012–21. Modeled.', src: SRC('https://doi.org/10.1016/S0140-6736(25)01919-1', '2025 Lancet Countdown, indicator 1.1.5'), f: () => big('546,000', 'deaths a year on average, 2012–21 (modeled)', 'Heat-related death rate up 23% since the 1990s') },
      gap: { t: 'What gets recorded, against a larger figure', s: 'Each bar is 100% of that row’s larger figure. Hatched: modeled estimate. Outlined: all diagnosed encounters. Compare within a row; Spain’s two measures answer different questions.', src: 'Sources: <a href="https://doi.org/10.1001/jama.2024.16386" target="_blank" rel="noopener">JAMA 2024</a> and AP; <a href="https://www.sanidad.gob.es/gabinete/notasPrensa.do?id=6760" target="_blank" rel="noopener">Spain Ministry of Health</a>; <a href="https://www.health.mil/Reference-Center/Reports/2023/11/28/Heat-Illness-Report" target="_blank" rel="noopener">DoD Heat Illness Report, Tables 3–4</a>', f: gap },
      sahel: { t: 'Deaths reported at one Bamako hospital', s: 'Four days in 2024, against a full month in 2023. All causes; causes not reported.', src: SRC('https://www.worldweatherattribution.org/extreme-sahel-heatwave-that-hit-highly-vulnerable-population-at-the-end-of-ramadan-would-not-have-occurred-without-climate-change', 'World Weather Attribution, 18 Apr 2024, citing local media'), f: () => compare({ v: 130, cls: 'acc', lab: '130', name: 'All of April 2023' }, { v: 102, cls: 'rec', lab: '102', name: 'April 1–4, 2024' }, 'Recorded deaths from all causes; not a like-for-like comparison', 'Bamako hospital: 130 deaths in all of April 2023; 102 deaths April 1 to 4, 2024') },
      qatar: { t: 'Share of deaths from cardiovascular causes', s: 'Nepali migrant workers in Qatar, 2009–2017.', src: SRC('https://doi.org/10.1159/000500853', 'Pradhan et al., Cardiology, 2019'), f: () => compare({ v: 22, cls: 'acc', lab: '22%', name: 'Cool season' }, { v: 58, cls: 'rec', lab: '58%', name: 'Hot season' }, 'Up to 200 of 571 cardiovascular deaths estimated preventable', 'Cardiovascular share of deaths: 22% in the cool season, 58% in the hot season') },
      hajj: { t: 'Deaths during the 2024 Hajj', s: 'By authorization status, as reported by Saudi authorities.', src: SRC('https://gulfnews.com/world/gulf/saudi/hajj-2024-saudi-arabia-says-1301-deaths-mostly-unregistered-pilgrims-1.1719169731102', 'Saudi Press Agency via Gulf News, 23 Jun 2024'), f: () => stack([{ v: 83, cls: 'rec', pct: '83%', l: 'Not authorized to perform Hajj' }, { v: 17, cls: 'acc', pct: '17%', l: 'Authorized' }], 100, '1,301 deaths', '1,301 deaths; 83% among pilgrims not authorized to perform Hajj') },
      europe: { t: 'Estimated heat-related deaths in Europe, by summer', s: 'Modeled; 654 regions in 32 countries. The 2025 rapid study uses different coverage and methods and is not shown.', src: SRC('https://doi.org/10.1038/s41591-025-03954-7', 'Nature Medicine, 2025'), f: () => columns([{ l: '2022', v: 67873 }, { l: '2023', v: 50798 }, { l: '2024', v: 62775 }], 80000) },
      maricopa: { t: 'Heat-related deaths, Maricopa County, 2024', s: 'Share among people experiencing homelessness.', src: SRC('https://www.maricopa.gov/ArchiveCenter/ViewFile/Item/5934', 'Maricopa County Department of Public Health, 2024 annual heat report'), f: () => stack([{ v: 49, cls: 'rec', pct: '49%', l: 'Experiencing homelessness' }, { v: 51, cls: 'acc', pct: '51%', l: 'All other deaths' }], 100, '608 deaths', '608 heat-related deaths; 49% among people experiencing homelessness') },
      bases: { t: 'Heat illness cases by reporting location, 2021–2025', s: `The ${bases.length} named locations, active component. Outside the contiguous U.S. and NAS Pensacola highlighted. Counts, not rates.`, src: SRC('https://www.health.mil/Reference-Center/Reports/2026/05/01/MSMR-Article-1-Table-3', 'MSMR 33(5), May 2026, Table 3'), f: () => hbars(bases, 1800, [500, 1000, 1500], ['Okinawa, Japan', 'Fort Shafter, HI', 'NAS Pensacola, FL'], 'rec') },
      services: { t: 'Heat illness cases by service, 2021–2025', s: 'Heat stroke plus heat exhaustion, active component.', src: SRC('https://health.mil/Reference-Center/Reports/2026/05/01/MSMR-Vol-33-No-5-May-2026', 'MSMR 33(5), May 2026, Table 2'), f: () => lines(series) },
      flags: { t: 'Where heat illness occurred on the flag scale', s: 'Active component stationed in the continental U.S., 1996–2019. Flag conditions reconstructed from weather-station data.', src: SRC('https://www.health.mil/Reference-Center/Reports/2023/11/28/Heat-Illness-Report', 'DoD Heat Illness Report to Congress, Nov 2023'), f: () => stack([{ v: 16, cls: 'rec', pct: '16%', l: 'Black flag' }, { v: 64, cls: 'acc', pct: '64%', l: 'Green, yellow or red' }, { v: 20, cls: 'empty', pct: '20%', l: 'No flag' }], 100, '84% below the black flag', '16% black flag, 64% green yellow or red flag, 20% no flag') },
      cold: { t: 'Cold weather injuries by location, five seasons', s: `July 2020–June 2025, active component. The ${coldExact.length} locations with exact published totals; ${coldThr} more are known only as “at least 25”.`, src: SRC('https://health.mil/Reference-Center/Reports/2025/12/01/MSMR-Vol-32-No-12-Dec-2025', 'MSMR 32(12), Dec 2025, results text and Figure 4'), f: () => hbars(coldExact, 360, [100, 200, 300], coldExact.map(r => r.l), 'cold') },
      close: { t: 'What the military already measures, and what it does not', s: 'Diagnosed heat-stroke encounters, 2018–2022. By 2025, 77.4% of heat-stroke cases were reported.', src: SRC('https://www.health.mil/Reference-Center/Reports/2023/11/28/Heat-Illness-Report', 'DoD Heat Illness Report, Table 3') + '; 2025 share: ' + '<a href="https://health.mil/Reference-Center/Reports/2026/05/01/MSMR-Vol-33-No-5-May-2026" target="_blank" rel="noopener">MSMR May 2026</a>', f: () => stack([{ v: 47.4, cls: 'rec', pct: '47.4%', l: 'Reached the reportable-event', l2: 'system' }, { v: 52.6, cls: 'enc', pct: '52.6%', l: 'No matching report' }], 100, '2,103 heat-stroke encounters', '2,103 encounters; 47.4% reached the reportable-event system') },
    };
  }

  const SCENES = {
    sahel: { view: { center: [26, 17], zoom: 1.8 }, pins: [['Bamako', -8.0, 12.64, 'Gabriel Touré Hospital', 'top'], ['Kayes', -11.44, 14.45, '48.5 °C, 3 April 2024', 'bottom'], ['Karachi', 67.01, 24.86, 'June 2024', 'bottom']] },
    qatar: { view: { center: [51.2, 25.3], zoom: 5.4 }, pins: [['Doha, Qatar', 51.53, 25.29, '2009–2017 study']] },
    hajj: { view: { center: [40.2, 21.6], zoom: 5.2 }, pins: [['Mecca', 39.83, 21.42, 'Hajj, June 2024']] },
    maricopa: { view: { center: [-112.4, 33.35], zoom: 6.6 }, polygon: 'Maricopa County, Arizona' },
    bases: { view: { center: [-90, 35.5], zoom: 3.1 }, layer: 'military-heat', period: '2021–2025', color: '#C9482D' },
    cold: { view: { center: [-122, 52], zoom: 2.3 }, layer: 'military-cold', period: 'Jul 2020–Jun 2025', color: '#225E89' },
  };

  function exploreHref(key) {
    const rec = (layer, pred) => data.records.find(r => r.layer === layer && pred(r));
    if (key === 'trends') return '../#trends';
    if (key === 'bases') return HM.atlasURL('../', { ds: 'military-heat', period: '2021–2025' });
    if (key === 'cold') return HM.atlasURL('../', { ds: 'military-cold', place: rec('military-cold', r => r.name.startsWith('Fort Wainwright')).id });
    if (key === 'maricopa') return HM.atlasURL('../', { ds: 'civilian-deaths', period: '2024', place: rec('civilian-deaths', r => r.name.startsWith('Maricopa') && r.period === '2024').id });
    if (key === 'spain') return HM.atlasURL('../', { ds: 'modeled-deaths', place: rec('modeled-deaths', () => true).id });
    return '../';
  }

  /* ---------- map ---------- */
  function initMap() {
    if (!window.maplibregl || window.innerWidth <= 900) return;
    try {
      map = new maplibregl.Map({ container: 'figMap', style: HM.BASEMAP, center: [0, 20], zoom: 1.5, interactive: false, attributionControl: false, fadeDuration: 0 });
    } catch { map = null; return; }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('style.load', () => {
      try { HM.paperBasemap(map); } catch { /* fallback */ }
      map.addSource('pts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('poly', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'poly-fill', type: 'fill', source: 'poly', paint: { 'fill-color': '#C9482D', 'fill-opacity': 0.16 } });
      map.addLayer({ id: 'poly-line', type: 'line', source: 'poly', paint: { 'line-color': '#A93A22', 'line-width': 1.6 } });
      map.addLayer({ id: 'pts', type: 'circle', source: 'pts', paint: { 'circle-radius': ['case', ['get', 'thr'], 6, ['max', 3, ['*', 22, ['sqrt', ['/', ['get', 'c'], ['get', 'max']]]]]], 'circle-color': ['get', 'col'], 'circle-opacity': ['case', ['get', 'thr'], 0, 0.4], 'circle-stroke-color': ['get', 'col'], 'circle-stroke-width': 1.3 } });
      mapOk = true;
      if (current) scene(current, true);
    });
    setTimeout(() => { if (!mapOk) map.setStyle(HM.fallbackStyle('../')); }, 9000);
  }
  let civil = null;
  function scene(chapter, immediate) {
    const fig = $('stageFig'), key = chapter.dataset.scene, sc = SCENES[key];
    fig.classList.toggle('with-map', !!(sc && map));
    if (!sc || !map || !mapOk) return;
    markers.forEach(m => m.remove()); markers = [];
    const pts = [], polys = [];
    if (sc.layer) {
      const rows = data.records.filter(r => r.layer === sc.layer && r.period === sc.period);
      const max = Math.max(...rows.map(r => r.count || 0));
      rows.forEach(r => pts.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lon, r.lat] }, properties: { c: r.count ?? 0, thr: r.count === null, max, col: sc.color } }));
    }
    (sc.pins || []).forEach(([name, lon, lat, sub, anchor = 'bottom']) => {
      const e = document.createElement('div'); e.className = 'scene-label'; e.innerHTML = `${esc(name)}<small>${esc(sub)} · place locator</small>`;
      markers.push(new maplibregl.Marker({ element: e, anchor, offset: anchor === 'bottom' ? [0, -8] : [0, 8] }).setLngLat([lon, lat]).addTo(map));
      pts.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { c: 1, thr: false, max: 30, col: '#182427' } });
    });
    if (sc.polygon && civil) polys.push(...civil.features.filter(f => f.properties.name === sc.polygon));
    map.getSource('pts').setData({ type: 'FeatureCollection', features: pts });
    map.getSource('poly').setData({ type: 'FeatureCollection', features: polys });
    map.resize();
    if (immediate || HM.reducedMotion()) map.jumpTo(sc.view); else map.easeTo({ ...sc.view, duration: 900 });
  }

  /* ---------- scrolling ---------- */
  let current = null, CH = {};
  function show(chapter) {
    if (current === chapter) return;
    const first = !current;
    current = chapter;
    document.querySelectorAll('.chapter').forEach(c => c.classList.toggle('is-active', c === chapter));
    document.querySelectorAll('#rail a').forEach(a => { if (a.getAttribute('href') === '#' + chapter.id) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    const c = CH[chapter.dataset.chart], box = $('figChart');
    const paint = () => {
      $('figTitle').textContent = c.t; $('figSub').textContent = c.s; $('figSrc').innerHTML = c.src;
      box.replaceChildren(c.f()); box.setAttribute('aria-label', c.t);
      box.classList.remove('fading');
    };
    if (first || HM.reducedMotion()) paint(); else { box.classList.add('fading'); setTimeout(paint, 180); }
    scene(chapter, first);
  }

  async function init() {
    try { data = await HM.load('../'); } catch (e) { document.querySelector('.figwrap').innerHTML = `<p class="figsub" style="padding:20px">The story's data could not be loaded (${esc(e.message)}). The text remains complete.</p>`; return; }
    civil = await HM.loadGeo('../', data.gis.civilian);
    CH = charts();
    const chapters = [...document.querySelectorAll('.chapter')];
    $('rail').innerHTML = chapters.map((c, i) => `<li><a href="#${c.id}"><span>${String(i + 1).padStart(2, '0')}</span><span class="tip">${esc(c.querySelector('h2').textContent)}</span></a></li>`).join('');
    chapters.forEach((c, i) => {
      if (c.dataset.chart === 'cold') c.classList.add('cold');
      const h2 = c.querySelector('h2');
      h2.insertAdjacentHTML('afterbegin', `<span class="n">Chapter ${String(i + 1).padStart(2, '0')} of ${chapters.length}</span>`);
      const ch = CH[c.dataset.chart];
      const fig = document.createElement('figure'); fig.className = 'inline-fig';
      W = window.innerWidth <= 900 ? 400 : 600;
      fig.innerHTML = `<p class="figtitle">${esc(ch.t)}</p><p class="figsub">${esc(ch.s)}</p><div class="fig-inline-chart"></div><figcaption>${ch.src}</figcaption>`;
      fig.querySelector('.fig-inline-chart').append(ch.f());
      W = 600;
      c.querySelector('p:last-of-type').after(fig);
      const prev = chapters[i - 1], next = chapters[i + 1];
      const acts = document.createElement('div'); acts.className = 'ch-actions';
      acts.innerHTML = (c.dataset.explore ? `<a class="btn btn-primary" href="${esc(exploreHref(c.dataset.explore))}">Explore this view <span aria-hidden="true">→</span></a>` : '')
        + `<button type="button" class="btn btn-quiet" data-copy="${c.id}">Copy link to this chapter</button>`
        + (prev ? `<a class="btn btn-quiet" href="#${prev.id}" aria-label="Previous chapter: ${esc(prev.querySelector('h2').lastChild.textContent)}">↑ Previous</a>` : '')
        + (next ? `<a class="btn btn-quiet" href="#${next.id}" aria-label="Next chapter: ${esc(next.querySelector('h2').lastChild.textContent)}">Next ↓</a>` : `<a class="btn btn-quiet" href="#about">About the numbers ↓</a>`);
      c.append(acts);
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-copy]'); if (!b) return;
      const url = new URL('#' + b.dataset.copy, location.href).href; history.replaceState(null, '', '#' + b.dataset.copy);
      HM.copyLink(url, announce);
    });
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#ch-"]'); if (!a) return;
      const t = document.querySelector(a.getAttribute('href')); if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: HM.reducedMotion() ? 'auto' : 'smooth', block: window.innerWidth > 900 ? 'center' : 'start' });
      history.replaceState(null, '', a.getAttribute('href'));
      t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true });
    });
    initMap();
    if (window.innerWidth > 900) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) show(en.target); }), { rootMargin: '-45% 0px -50% 0px' });
      chapters.forEach(c => io.observe(c));
      show(location.hash && document.querySelector(location.hash)?.classList.contains('chapter') ? document.querySelector(location.hash) : chapters[0]);
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
