'use strict';
// Indicative fracture toughness (plane strain, room temperature) and Paris-law constants (SI: da/dN in m/cycle, ΔK in MPa√m)
const KIC = {
  'AISI 4340 (high strength)': { K: 60, Sy: 1500, C: 6.9e-12, m: 3.0 }, 'Structural steel (ferritic-pearlitic)': { K: 100, Sy: 350, C: 6.9e-12, m: 3.0 },
  'Al 7075-T6': { K: 26, Sy: 503, C: 5e-11, m: 3.5 }, 'Al 2024-T3': { K: 35, Sy: 345, C: 2e-11, m: 3.5 },
  'Ti-6Al-4V': { K: 60, Sy: 880, C: 1e-11, m: 3.2 }, 'Grey cast iron': { K: 12, Sy: 200, C: 5e-11, m: 3.5 },
};
// Larson–Miller master curves (LMP×10⁻³ with T in K, t in h, C = 20) vs stress MPa: indicative
const LMP = {
  '2.25Cr-1Mo steel (boiler tubes)': [[16, 400], [17, 330], [18, 260], [19, 190], [20, 130], [21, 80], [22, 45]],
  '316 stainless steel': [[17, 400], [18, 330], [19, 260], [20, 190], [21, 130], [22, 85], [23, 50]],
  'Carbon steel': [[14, 350], [15, 270], [16, 190], [17, 120], [18, 70], [19, 40]],
  'Nickel superalloy (Inconel 718-like)': [[20, 900], [21, 750], [22, 580], [23, 420], [24, 280], [25, 170]],
};
const FR = {
  fracture(v) {
    const mt = KIC[v.mat], K = mt.K * (ENV.T < 0 && /steel|4340/.test(v.mat) ? 0.4 : 1), Y = v.Y, s = v.s;
    const KI = Y * s * Math.sqrt(Math.PI * v.a / 1000), ac = 1000 / Math.PI * (K / (Y * s)) ** 2; // mm
    const valid = 2.5 * (K / mt.Sy) ** 2 * 1000; // plane-strain thickness requirement, mm
    const ds = v.ds, aEnd = Math.min(ac, v.t || ac); // grow until critical (or through-thickness for leak)
    // Paris law integration (numeric)
    let a = v.a / 1000, N = 0; const A = [], NN = []; const end = aEnd / 1000;
    while (a < end && N < 1e10) { const dK = Y * ds * Math.sqrt(Math.PI * a), dadN = mt.C * Math.pow(dK, mt.m), step = Math.max(a * 0.01, 1e-7); N += step / dadN; a += step; if (A.length < 400) { A.push(a * 1000); NN.push(N); } }
    return { K, KI, ac, nFr: K / KI, valid, N, A, NN, leak: v.t && ac > v.t };
  },
  creep(v) {
    const tbl = LMP[v.mat], lmp = interp(tbl.map(([L, s]) => [-s, L]), -v.s) * 1000; // invert: stress → LMP
    const TK = v.T + 273.15, tr = Math.pow(10, lmp / TK - 20);
    const Tallow = lmp / (20 + Math.log10(v.life)) - 273.15; // max temperature for the required life at this stress
    return { lmp, tr, Tallow };
  },
};
MD.register('fracture', {
  group: 'Machine elements', title: 'Fracture & creep life', icon: '🧩', voice: 'fracture mechanics crack growth paris law creep larson miller',
  kid: { what: 'Real parts have tiny <b>cracks</b>. This page finds how big a crack can get before the part snaps, how many load cycles that takes, and how long a hot part lasts before it slowly stretches and breaks (<b>creep</b>).', steps: ['Fracture tab: enter the stress and the starting crack size.', 'Read the critical crack size and the number of cycles to reach it.', 'Creep tab: enter temperature and stress; read the life in hours.'], try: 'Set the temperature (🌡) below 0 °C: the steel\'s toughness drops and the critical crack shrinks, like the Liberty ships.' },
  eq: [
    { t: 'Stress intensity factor', f: 'K_I = Y·σ·√(π·a)', m: 'Measures how strongly a crack tip is loaded. When K_I reaches the material\'s toughness K_IC, the crack runs.', fx: [['double the stress', 'critical crack size ÷ 4'], ['tougher material', 'critical crack ∝ K_IC²']] },
    { t: 'Critical crack size', f: 'a_c = (1/π)·(K_IC / (Y·σ))²' },
    { t: 'Paris law (fatigue crack growth)', f: 'da/dN = C·(ΔK)^m,   ΔK = Y·Δσ·√(π·a)', fx: [['double the stress range', 'crack grows 2^m ≈ 8× faster (m ≈ 3)'], ['detect cracks earlier', 'most of the life is spent while the crack is tiny']] },
    { t: 'Leak-before-break', f: 'a_c > wall thickness t', m: 'For pressure vessels: a crack should leak (and be noticed) before it can cause a burst.' },
    { t: 'Larson–Miller parameter (creep)', f: 'LMP = T·(C + log₁₀ t_r),   C ≈ 20,  T in kelvin', fx: [['+25 °C hotter', 'rupture life often falls 2–5×'], ['lower stress', 'higher LMP allowed → longer life']] },
  ],
  render(main) {
    pageHead(main, 'Beyond strength', 'Fracture mechanics & creep life',
      'Classic strength checks assume a perfect material. <b>Fracture mechanics</b> assumes a crack is already there (it usually is, from welding, casting or machining) and asks how big it may grow, and how fast fatigue grows it. This is <b>damage tolerance</b>, the method used for aircraft since the Comet disasters. <b>Creep</b> is slow stretching under load at high temperature (turbines, boilers, exhaust parts): life is measured in hours, not cycles.');
    const body = h('div');
    tabs(main, ['Fracture & crack growth', 'Creep rupture'], i => { body.innerHTML = ''; [fracTab, creepTab][i](body); });
    main.append(body);
  }
});
function fracTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [{ id: 'mat', label: 'Material', type: 'select', options: Object.keys(KIC), value: 'Al 7075-T6', wide: true, aliases: ['material'] },
    { id: 's', label: 'Maximum stress', unit: 'MPa', value: 200, min: 10, max: 1200, step: 5, aliases: ['stress'] }, { id: 'ds', label: 'Stress range per cycle', unit: 'MPa', value: 150, min: 5, max: 1000, step: 5 },
    { id: 'a', label: 'Initial crack size (detectable flaw)', unit: 'mm', value: 1, min: 0.05, max: 20, step: 0.05, aliases: ['crack'] }, { id: 'Y', label: 'Geometry factor Y (edge crack ≈ 1.12, centre ≈ 1)', value: 1.12, min: 0.6, max: 3, step: 0.01 },
    { id: 't', label: 'Wall thickness (for leak-before-break; 0 = ignore)', unit: 'mm', value: 0, min: 0, max: 100, step: 0.5 }];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = FR.fracture(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Toughness K_IC (at 🌡)', fmt(r.K), 'MPa√m', ENV.T < 0 ? 'warn' : ''), metric('K_I now', fmt(r.KI), 'MPa√m'), metric('Fracture safety K_IC / K_I', fmt(r.nFr), '', fsStatus(r.nFr, 2)),
      metric('Critical crack size', fmt(r.ac), 'mm'), metric('Cycles to grow to critical', fmt(r.N), ''), metric('Inspect every (½ of growth life)', fmt(r.N / 2), 'cycles'), ...(v.t ? [metric('Leak before break?', r.leak ? 'yes' : 'no', '', r.leak ? 'good' : 'bad')] : [])));
    verdict(out, r.nFr >= 2, `Crack can grow from ${v.a} mm to ${fmt(r.ac)} mm in ${fmt(r.N)} cycles`, `Most of that life is spent while the crack is small (see the curve: it shoots up at the end). That is why inspection intervals are set from the time to grow from a detectable size to critical, with a safety factor (here, half). ${ENV.T < 0 ? 'Below 0 °C the steel toughness has been cut to 40 % (ductile-to-brittle transition).' : ''}`);
    plot(c1, { title: 'Crack growth (Paris law)', xlabel: 'Load cycles', ylabel: 'Crack size (mm)', series: [{ x: r.NN, y: r.A, fill: true, color: '#b42318' }], hlines: [{ y: r.ac, label: 'critical' }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = FR.fracture(vv); return { 'Critical crack': q.ac, 'Cycles to failure': q.N }; }, v, specs);
    explain(`Critical crack size ${fmt(r.ac)} millimetres, reached after ${fmt(r.N)} cycles from a ${v.a} millimetre flaw.`);
  }
  const f = buildForm(L, specs, run, 'fracture'); run(f.vals); MD.onEnv = () => run(f.vals);
}
function creepTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [{ id: 'mat', label: 'Material', type: 'select', options: Object.keys(LMP), value: '2.25Cr-1Mo steel (boiler tubes)', wide: true }, { id: 'T', label: 'Metal temperature', unit: '°C', value: 550, min: 350, max: 900, step: 5, aliases: ['temperature'] },
    { id: 's', label: 'Stress', unit: 'MPa', value: 100, min: 20, max: 800, step: 5, aliases: ['stress'] }, { id: 'life', label: 'Required life', unit: 'hours', value: 100000, min: 1000, max: 300000, step: 1000 }];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = FR.creep(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Larson–Miller parameter', fmt(r.lmp), ''), metric('Predicted rupture life', r.tr > 1e7 ? '> 10⁷' : fmt(r.tr), 'h', r.tr >= v.life ? 'good' : 'bad'), metric('≈ years', r.tr > 1e7 ? '> 1000' : fmt(r.tr / 8760), 'yr'), metric(`Max temperature for ${fmt(v.life)} h`, fmt(r.Tallow), '°C')));
    verdict(out, r.tr >= v.life, r.tr > 1e7 ? 'Below the creep range: creep is not a concern here' : r.tr >= v.life ? `Lasts ${fmt(r.tr / v.life)}× the required life` : `Creep rupture after ${fmt(r.tr)} h: too hot or too stressed`, `Creep life is extremely sensitive to temperature: this material can run at ${fmt(r.Tallow)} °C for ${fmt(v.life)} h at ${v.s} MPa. A few tens of degrees hotter (a blocked cooling passage, scale on a boiler tube) can cut life by an order of magnitude.`);
    const Ts = linspace(v.T - 100, v.T + 100, 41); plot(c1, { title: 'Rupture life vs temperature (same stress)', xlabel: 'Temperature (°C)', ylabel: 'Life (h)', logy: true, vlines: [{ x: v.T }], hlines: [{ y: v.life, label: 'required', color: '#2f7d32' }], series: [{ x: Ts, y: Ts.map(T => FR.creep(Object.assign({}, v, { T })).tr) }] });
    out.append(h('div', { class: 'small' }, 'Master curves are indicative shapes for learning; use certified creep-rupture data (e.g. design codes) for real components.'));
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => ({ 'Rupture life': FR.creep(vv).tr }), v, specs, { skip: ['life'] });
    explain(`Predicted creep rupture life ${fmt(r.tr)} hours at ${v.T} degrees and ${v.s} megapascals.`);
  }
  const f = buildForm(L, specs, run, 'creep'); run(f.vals);
}
