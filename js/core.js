/* MechDe core: router, UI helpers, materials, environment and design factors */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
function fmt(x, sig = 3) {
  if (x == null || !isFinite(x)) return x === Infinity ? '∞' : '—';
  const a = Math.abs(x);
  if (a === 0) return '0';
  if (a >= 1e6 || a < 1e-3) return x.toExponential(2);
  const d = Math.max(0, sig - 1 - Math.floor(Math.log10(a)));
  return x.toFixed(Math.min(d, 6));
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const deg = Math.PI / 180;
function interp(table, x) { // table: [[x,y],...] sorted
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (x <= table[i][0]) {
    const [x0, y0] = table[i - 1], [x1, y1] = table[i];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return table[table.length - 1][1];
}
function linspace(a, b, n) { const o = []; for (let i = 0; i < n; i++) o.push(a + (b - a) * i / (n - 1)); return o; }
function bisect(f, a, b, tol = 1e-6, it = 200) { // find x with f(x)=0, f(a), f(b) opposite sign
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) return NaN;
  for (let i = 0; i < it; i++) {
    const m = 0.5 * (a + b), fm = f(m);
    if (Math.abs(b - a) < tol) return m;
    if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
  }
  return 0.5 * (a + b);
}
// smallest x in [lo,hi] with f(x) >= 0 for f increasing in x; lo if already satisfied, Infinity if never
function solveMin(f, lo, hi, tol = 1e-3) {
  const flo = f(lo); if (!(flo < 0)) return isNaN(flo) ? NaN : lo;
  const fhi = f(hi); if (!(fhi >= 0)) return Infinity;
  return bisect(f, lo, hi, tol);
}
function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem('mechde:' + key)); localStorage.setItem('mechde:' + key, JSON.stringify(val)); } catch (e) { return null; } }

/* ---------------- Materials ---------------- */
// Sut, Sy, E (MPa), G (MPa), rho (kg/m3), alpha (1/K), BHN. Room-temperature typical/minimum handbook values.
const MATERIALS = {
  'IS 2062 E250 structural steel': { cls: 'steel', Sut: 410, Sy: 250, E: 200e3, G: 77e3, nu: 0.3, rho: 7850, alpha: 12e-6, BHN: 120 },
  'IS 2062 E350 structural steel': { cls: 'steel', Sut: 490, Sy: 350, E: 200e3, G: 77e3, nu: 0.3, rho: 7850, alpha: 12e-6, BHN: 145 },
  'AISI 1020 hot rolled': { cls: 'steel', Sut: 380, Sy: 210, E: 207e3, G: 79.3e3, nu: 0.29, rho: 7850, alpha: 11.7e-6, BHN: 111 },
  'AISI 1045 / C45 cold drawn': { cls: 'steel', Sut: 630, Sy: 530, E: 207e3, G: 79.3e3, nu: 0.29, rho: 7850, alpha: 11.3e-6, BHN: 179 },
  'AISI 4140 Q&T 425 °C': { cls: 'steel', Sut: 1250, Sy: 1140, E: 207e3, G: 79.3e3, nu: 0.29, rho: 7850, alpha: 12.3e-6, BHN: 370 },
  'AISI 4340 / EN24 Q&T 650 °C': { cls: 'steel', Sut: 1170, Sy: 1100, E: 207e3, G: 79.3e3, nu: 0.29, rho: 7850, alpha: 12.3e-6, BHN: 340 },
  'SS 304 annealed': { cls: 'stainless', Sut: 586, Sy: 241, E: 193e3, G: 74e3, nu: 0.29, rho: 8000, alpha: 17.3e-6, BHN: 149 },
  'Al 6061-T6': { cls: 'aluminium', Sut: 310, Sy: 276, E: 69e3, G: 26e3, nu: 0.33, rho: 2700, alpha: 23.6e-6, BHN: 95, Sf: 96.5 },
  'Al 7075-T6': { cls: 'aluminium', Sut: 572, Sy: 503, E: 71.7e3, G: 26.9e3, nu: 0.33, rho: 2810, alpha: 23.4e-6, BHN: 150, Sf: 159 },
  'Ti-6Al-4V annealed': { cls: 'titanium', Sut: 950, Sy: 880, E: 114e3, G: 44e3, nu: 0.34, rho: 4430, alpha: 8.6e-6, BHN: 334 },
  'Grey cast iron FG 260': { cls: 'castiron', Sut: 260, Sy: 260, E: 110e3, G: 44e3, nu: 0.26, rho: 7200, alpha: 10.8e-6, BHN: 200 },
};
const MAT_NAMES = Object.keys(MATERIALS);

/* ---------------- Environment (global) ---------------- */
const MEDIA = ['Dry indoor air', 'Humid / outdoor air', 'Fresh water', 'Seawater / marine'];
const ENV = Object.assign({ T: 25, Tinstall: 25, medium: MEDIA[0], rel: 0.99, life: 25, wind: 0 }, store('env') || {});
const RELIAB = { 0.5: 1.0, 0.9: 0.897, 0.95: 0.868, 0.99: 0.814, 0.999: 0.753, 0.9999: 0.702 };
// Fatigue-strength multiplier for corrosive media (indicative; real corrosion fatigue has no endurance limit)
const KENV = {
  steel: [1, 0.85, 0.6, 0.45], stainless: [1, 0.95, 0.85, 0.7], aluminium: [1, 0.9, 0.7, 0.5],
  titanium: [1, 1, 1, 0.95], castiron: [1, 0.9, 0.8, 0.7]
};
// Uniform corrosion rate mm/year per exposed face (indicative, unprotected)
const CORR = {
  steel: [0.005, 0.03, 0.06, 0.12], stainless: [0, 0, 0.001, 0.005], aluminium: [0, 0.001, 0.005, 0.02],
  titanium: [0, 0, 0, 0], castiron: [0.005, 0.03, 0.05, 0.1]
};
const mediumIndex = () => Math.max(0, MEDIA.indexOf(ENV.medium));
// Strength retention vs temperature (°C). Steel uses Shigley's polynomial (Sut ratio); others are indicative curves.
function strengthTempFactor(mat, T) {
  const c = mat.cls;
  if (c === 'steel' || c === 'stainless') {
    if (T <= 20) return 1;
    const F = T * 9 / 5 + 32;
    const k = 0.975 + 0.432e-3 * F - 0.115e-5 * F * F + 0.104e-8 * F ** 3 - 0.595e-12 * F ** 4;
    return T > 540 ? Math.max(0.2, k * interp([[540, 1], [700, 0.45]], T)) : Math.min(1.02, k);
  }
  if (c === 'aluminium') return interp([[20, 1], [100, 0.95], [150, 0.82], [200, 0.55], [250, 0.3], [300, 0.15], [400, 0.05]], T);
  if (c === 'titanium') return interp([[20, 1], [200, 0.78], [300, 0.7], [400, 0.63], [500, 0.58], [600, 0.45]], T);
  return interp([[20, 1], [300, 0.95], [400, 0.85], [500, 0.65], [600, 0.4]], T);
}
function modulusTempFactor(mat, T) {
  const c = mat.cls;
  if (c === 'aluminium') return interp([[20, 1], [100, 0.96], [200, 0.88], [300, 0.75], [400, 0.6]], T);
  if (c === 'titanium') return interp([[20, 1], [200, 0.92], [400, 0.84], [600, 0.75]], T);
  return interp([[20, 1], [100, 0.98], [200, 0.95], [300, 0.91], [400, 0.86], [500, 0.79], [600, 0.65]], T);
}
// Material evaluated in the current environment
function matAt(name, env = ENV) {
  const m = MATERIALS[name] || MATERIALS[MAT_NAMES[0]];
  const kS = strengthTempFactor(m, env.T), kE = modulusTempFactor(m, env.T);
  return Object.assign({}, m, {
    name, kT: kS, kE, Sut: m.Sut * kS, Sy: m.Sy * kS, E: m.E * kE, G: m.G * kE,
    Sut0: m.Sut, Sy0: m.Sy, E0: m.E, kenv: KENV[m.cls][mediumIndex()], corr: CORR[m.cls][mediumIndex()]
  });
}
function envWarnings(mat, env = ENV) {
  const w = [];
  if ((mat.cls === 'steel') && env.T < 0) w.push(`Below 0 °C plain carbon/structural steels can cross their ductile-to-brittle transition. Specify impact-tested (Charpy) grades. This killed welded Liberty ships in WWII.`);
  if (mat.cls === 'castiron') w.push('Grey cast iron is brittle: design against ultimate strength with a Coulomb–Mohr/modified-Mohr theory, not yield.');
  if (mat.cls === 'aluminium' && env.T > 120) w.push('Age-hardened aluminium over-ages above ~120–150 °C and loses strength permanently with exposure time.');
  if ((mat.cls === 'steel' || mat.cls === 'stainless') && env.T > 370) w.push('Above ~370 °C (0.35–0.4 Tm) creep becomes a governing mode for steels; time-dependent creep-rupture data are required.');
  if (mediumIndex() >= 2 && mat.cls === 'steel') w.push('Steel in water has no true endurance limit (corrosion fatigue). Coat, cathodically protect, or design to a finite life.');
  if (mediumIndex() === 3 && mat.cls === 'aluminium') w.push('Aluminium in seawater: pitting and galvanic attack if coupled to steel/copper. Isolate dissimilar metals.');
  return w;
}

/* ---------------- Fatigue (Marin) ---------------- */
const SURFACES = { 'Ground': [1.58, -0.085], 'Machined / cold drawn': [4.51, -0.265], 'Hot rolled': [57.7, -0.718], 'As forged': [272, -0.995] };
const ka_ = (surf, Sut) => { const [a, b] = SURFACES[surf]; return Math.min(1, a * Math.pow(Sut, b)); };
function kb_(d, rotating = true) { // d in mm, bending/torsion
  if (!rotating) d = 0.37 * d;
  if (d <= 2.79) return 1; if (d <= 51) return 1.24 * Math.pow(d, -0.107); return 1.51 * Math.pow(Math.min(d, 254), -0.157);
}
function SePrime(m) { // uncorrected rotating-beam endurance (MPa)
  if (m.cls === 'aluminium') return m.Sf * m.kT; // 5e8 cycles; no true endurance limit
  if (m.cls === 'titanium') return 0.54 * m.Sut;
  if (m.cls === 'castiron') return 0.4 * m.Sut;
  return m.Sut <= 1400 ? 0.5 * m.Sut : 700;
}
// Neuber notch sensitivity, r in mm, Sut MPa. Bending and torsion.
function notchQ(r, Sut, torsion = false) {
  let S = Sut / 6.895; if (torsion) S += 20;
  const sa = 0.246 - 3.08e-3 * S + 1.51e-5 * S * S - 2.67e-8 * S ** 3; // sqrt(in)
  const sqrtA = Math.max(sa, 0.005) * Math.sqrt(25.4); // sqrt(mm)
  return 1 / (1 + sqrtA / Math.sqrt(Math.max(r, 1e-3)));
}

/* ---------------- UI: router & pages ---------------- */
const MD = {
  pages: {}, order: [], current: null, fields: {}, explain: '', onEnv: null,
  register(id, def) { this.pages[id] = def; this.order.push(id); },
  start() {
    const nav = $('#sidebar'); let grp = '';
    for (const id of this.order) {
      const p = this.pages[id];
      if (p.group !== grp) { grp = p.group; nav.append(h('div', { class: 'grp' }, grp)); }
      nav.append(h('a', { href: '#' + id, 'data-id': id }, (p.icon || '') + '  ' + p.title));
    }
    $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
    nav.addEventListener('click', e => { if (e.target.tagName === 'A') document.body.classList.remove('nav-open'); });
    $('#envBtn').onclick = () => location.hash = 'environment';
    $('#modal .modal-x').onclick = () => $('#modal').classList.add('hidden');
    $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
    window.addEventListener('hashchange', () => this.route());
    updateEnvSummary();
    this.route();
  },
  route() {
    let id = (location.hash || '#home').slice(1);
    if (!this.pages[id]) id = 'home';
    if (this.cleanup) { try { this.cleanup(); } catch (e) { } this.cleanup = null; }
    this.current = id; this.fields = {}; this.explain = ''; this.onEnv = null; this.voiceActions = {};
    $$('#sidebar a').forEach(a => a.classList.toggle('active', a.dataset.id === id));
    const main = $('#main'); main.innerHTML = ''; window.scrollTo(0, 0);
    const p = this.pages[id];
    document.title = (id === 'home' ? '' : p.title + ' — ') + 'MechDe Design Studio';
    p.render(main);
  },
  envChanged() { store('env', ENV); updateEnvSummary(); if (this.onEnv) this.onEnv(); },
};
function updateEnvSummary() {
  const s = $('#envSummary'); if (s) s.textContent = `${ENV.T} °C · ${ENV.medium.split(' ')[0].toLowerCase()} · R ${ENV.rel * 100}%`;
}
function modal(content) { const b = $('#modal .modal-body'); b.innerHTML = ''; b.append(content); $('#modal').classList.remove('hidden'); }
function toast(msg, ms = 2600) { const t = $('#voiceToast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms); }
function pageHead(main, crumb, title, lead) {
  main.append(h('div', { class: 'crumb' }, crumb), h('h1', null, title));
  if (lead) main.append(h('p', { class: 'lead', html: lead }));
}

/* Form builder. specs: [{id,label,unit,value,min,max,step,type:'num'|'select'|'check',options,aliases,section,slider}] */
function buildForm(container, specs, onChange, key, init) {
  const saved = key ? (store('form:' + key) || {}) : {};
  const vals = {}, inputs = {};
  if (key || init === 'reset') {
    container.append(h('div', { class: 'toolbar', style: { justifyContent: 'flex-end', margin: '0 0 4px' } }, h('button', { class: 'btn ghost sm', title: 'Restore the default inputs for this module', onclick: () => {
      for (const k in saved) delete saved[k]; if (key) store('form:' + key, {});
      specs.forEach(s => { if (!s.id) return; const inp = inputs[s.id]; vals[s.id] = (s.type === 'select' || s.type === 'text') ? s.value : s.type === 'check' ? !!s.value : +s.value;
        if (s.type === 'check') inp.checked = !!s.value; else { inp.value = s.value; if (inp._slider) inp._slider.value = s.value; } });
      onChange && onChange(vals, null); toast('Inputs reset to defaults');
    } }, '↺ Reset to defaults')));
  }
  for (const s of specs) {
    if (s.section) { container.append(h('div', { class: 'sec-h' }, s.section)); continue; }
    let v = saved[s.id] !== undefined ? saved[s.id] : s.value;
    if (s.type === 'select' && !s.options.map(String).includes(String(v))) v = s.value;
    vals[s.id] = (s.type === 'select' || s.type === 'text') ? v : (s.type === 'check' ? !!v : +v);
    const lab = h('label', { for: 'f_' + s.id, html: s.label + (s.unit ? ` <span class="u">[${s.unit}]</span>` : '') });
    if (s.tip) lab.title = s.tip;
    let inp, row;
    if (s.type === 'select') {
      inp = h('select', { id: 'f_' + s.id }, s.options.map(o => h('option', { value: o }, (s.labels && s.labels[o]) || String(o))));
      inp.value = v;
      row = h('div', { class: 'field sel' + (s.wide ? ' wide' : '') }, lab, inp);
    } else if (s.type === 'text') {
      inp = h('input', { type: 'text', id: 'f_' + s.id, value: v, class: 'inp' });
      row = h('div', { class: 'field wide' }, lab, inp);
    } else if (s.type === 'check') {
      inp = h('input', { type: 'checkbox', id: 'f_' + s.id }); inp.checked = !!v;
      row = h('div', { class: 'field' }, lab, inp);
    } else {
      inp = h('input', { type: 'number', id: 'f_' + s.id, step: s.step || 'any', min: s.min, max: s.max, value: v });
      row = h('div', { class: 'field' }, lab, inp);
      if (s.slider !== false && s.min != null && s.max != null) {
        const sl = h('input', { type: 'range', min: s.min, max: s.max, step: s.step || (s.max - s.min) / 200, value: v });
        sl.addEventListener('input', () => { inp.value = sl.value; fire(); });
        inp.addEventListener('input', () => { sl.value = inp.value; });
        row.append(sl); inp._slider = sl;
      }
    }
    const fire = () => {
      vals[s.id] = (s.type === 'select' || s.type === 'text') ? inp.value : (s.type === 'check' ? inp.checked : parseFloat(inp.value));
      if (key) { saved[s.id] = vals[s.id]; store('form:' + key, saved); }
      onChange && onChange(vals, s.id);
    };
    inp.addEventListener(s.type === 'select' || s.type === 'check' ? 'change' : 'input', fire);
    inputs[s.id] = inp; container.append(row);
    MD.fields[s.id] = { spec: s, set: (nv) => {
      if (s.type === 'select') { const o = s.options.find(o => String(o).toLowerCase().includes(String(nv).toLowerCase())); if (!o) return false; inp.value = o; }
      else if (s.type === 'text') inp.value = nv;
      else if (s.type === 'check') inp.checked = !!nv;
      else { inp.value = nv; if (inp._slider) inp._slider.value = nv; }
      row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 900); fire(); return true;
    } };
  }
  if (init === true) onChange(vals);
  return { vals, inputs, set: (id, v) => MD.fields[id] && MD.fields[id].set(v) };
}
function metric(label, value, unit, status, title) {
  return h('div', { class: 'm' + (status ? ' ' + status : ''), title: title || '' },
    h('div', { class: 'k' }, label), h('div', { class: 'v', html: `${value}${unit ? ' <small>' + unit + '</small>' : ''}` }));
}
const fsStatus = (n, target = 1.5) => n >= target ? 'good' : n >= 1 ? 'warn' : 'bad';
function verdict(el, ok, title, text) {
  el.append(h('div', { class: 'verdict ' + (ok === true ? 'good' : ok === false ? 'bad' : '') }, h('b', null, title), h('span', { html: text })));
}
// Horizontal bar chart of "required size per criterion" to show which factor dominates
function dominanceBars(el, items, unit, title) {
  const max = Math.max(...items.map(i => isFinite(i.v) ? i.v : 0)) || 1;
  const gov = items.reduce((a, b) => (isFinite(b.v) && b.v > (a ? a.v : -Infinity)) ? b : a, null);
  const box = h('div', { class: 'bars' });
  if (title) box.append(h('div', { class: 'panel-title' }, title));
  for (const it of items) box.append(h('div', { class: 'bar', title: it.tip || '' },
    h('span', null, it.k), h('div', { class: 'track' }, h('div', { class: 'fill' + (it === gov ? ' gov' : ''), style: { width: (isFinite(it.v) ? 100 * it.v / max : 0) + '%' } })),
    h('span', { class: 'val' }, fmt(it.v) + ' ' + (unit || ''))));
  el.append(box); return gov;
}
function copyText(txt) {
  try { navigator.clipboard.writeText(txt).then(() => toast('Copied to clipboard'), () => toast('Copy blocked by browser')); } catch (e) { toast('Copy not available'); }
}
function downloadCSV(name, rows) {
  const csv = rows.map(r => r.map(c => typeof c === 'string' && /[,"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\n');
  try {
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: name });
    document.body.append(a); a.click(); a.remove();
  } catch (e) { }
  copyText(csv);
}
function tabs(container, names, onPick, start = 0) {
  const bar = h('div', { class: 'tabs' }); const btns = names.map((n, i) => h('button', { onclick: () => pick(i) }, n));
  bar.append(...btns); container.append(bar);
  function pick(i) { btns.forEach((b, j) => b.classList.toggle('on', i === j)); onPick(i); }
  Promise.resolve().then(() => pick(start)); return pick;
}
function anim(fn) { // requestAnimationFrame loop cancelled on route change
  let id, alive = true, t0 = performance.now();
  const loop = (t) => { if (!alive) return; fn((t - t0) / 1000); id = requestAnimationFrame(loop); };
  id = requestAnimationFrame(loop);
  const stop = () => { alive = false; cancelAnimationFrame(id); };
  const prev = MD.cleanup; MD.cleanup = () => { stop(); prev && prev(); };
  return stop;
}
function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
  const w = Math.max(50, r.width), hh = Math.max(50, r.height);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: hh };
}
// canvas label with a light halo so it reads over drawings
function tag(ctx, text, x, y, color = '#1b2430', align = 'left', size = 12, bold = true) {
  ctx.save(); ctx.font = `${bold ? '600 ' : ''}${size}px IBM Plex Sans, sans-serif`; ctx.textBaseline = 'middle';
  { const tw = ctx.measureText(text).width, W = ctx.canvas.width / (window.devicePixelRatio || 1), H = ctx.canvas.height / (window.devicePixelRatio || 1);
    let x0 = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x; x0 = clamp(x0, 4, Math.max(4, W - tw - 4)); x = x0; align = 'left'; y = clamp(y, 8, H - 8); }
  ctx.textAlign = align;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}
function canvasLegend(items) { // [[color, text], ...] → HTML legend row
  return h('div', { class: 'legend' }, items.map(([c, t]) => h('span', null, h('i', { style: { background: c, height: '8px', width: '16px' } }), t)));
}
function explain(text) { MD.explain = text; MD.lastExplain = { page: MD.current, text }; }
