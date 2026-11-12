'use strict';
// Indicative catalogue (dynamic C, static C0 in kN), similar to major-maker 62/63/NU series
const BRG = [
  ['6205', 'ball', 25, 14.8, 7.8], ['6206', 'ball', 30, 20.3, 11.2], ['6207', 'ball', 35, 27.0, 15.3], ['6208', 'ball', 40, 32.5, 19.0], ['6209', 'ball', 45, 35.1, 21.6], ['6210', 'ball', 50, 37.1, 23.2], ['6212', 'ball', 60, 55.3, 36.0],
  ['6305', 'ball', 25, 23.4, 11.6], ['6306', 'ball', 30, 29.6, 16.0], ['6307', 'ball', 35, 35.1, 19.0], ['6308', 'ball', 40, 42.3, 24.0], ['6309', 'ball', 45, 55.3, 31.5], ['6310', 'ball', 50, 65.0, 38.0], ['6312', 'ball', 60, 85.2, 52.0],
  ['NU205', 'roller', 25, 28.6, 27.0], ['NU206', 'roller', 30, 44.0, 36.5], ['NU207', 'roller', 35, 56.0, 48.0], ['NU208', 'roller', 40, 62.0, 53.0], ['NU209', 'roller', 45, 69.5, 64.0], ['NU210', 'roller', 50, 73.5, 69.5], ['NU212', 'roller', 60, 108, 102],
];
const BR = {
  rolling(v) {
    const p = v.type === 'Ball' ? 3 : 10 / 3;
    let X = 1, Y = 0; if (v.type === 'Ball' && v.Fa / Math.max(v.Fr, 1e-9) > 0.28) { X = 0.56; Y = 1.6; }
    const P = v.ka * (X * v.Fr + Y * (v.type === 'Ball' ? v.Fa : 0)) * 1000; // N
    const a1 = interp([[0.9, 1], [0.95, 0.64], [0.96, 0.55], [0.97, 0.47], [0.98, 0.37], [0.99, 0.25], [0.999, 0.1]], Math.min(ENV.rel, 0.999));
    const L10 = v.Lh * 60 * v.rpm / 1e6, Creq = P * Math.pow(L10 / Math.max(a1, 0.05), 1 / p) / 1000; // kN
    const pick = BRG.filter(b => b[1] === (v.type === 'Ball' ? 'ball' : 'roller') && b[2] >= v.d && b[3] >= Creq).sort((a, b) => a[3] - b[3])[0];
    const life = c => a1 * Math.pow(c * 1000 / P, p) * 1e6 / (60 * v.rpm);
    return { p, X, Y, P, a1, L10, Creq, pick, lifeH: pick ? life(pick[3]) : NaN, life };
  },
  journal(v) {
    const r = v.d / 2, L = v.ld * v.d, c = v.cr * 1e-3 * r, W = v.W * 1000, N = v.rpm / 60; // mm, N, rev/s
    const nu40 = v.vg, mu = nu40 * 0.87e-3 * Math.exp(-0.03 * (v.To - 40)) * 1; // Pa·s (approx viscosity–temperature)
    const Pp = W / (L * v.d) * 1e6; // Pa
    const S = (r / c) ** 2 * mu * N / Pp;
    const U = 2 * Math.PI * r * 1e-3 * N; // m/s
    // Ocvirk short-bearing: W = μ U L³ ε / (4 c² (1-ε²)²) · √(π²(1-ε²) + 16ε²)
    const Wf = e => mu * U * (L * 1e-3) ** 3 * e / (4 * (c * 1e-3) ** 2 * (1 - e * e) ** 2) * Math.sqrt(Math.PI ** 2 * (1 - e * e) + 16 * e * e);
    let eps = solveMin(e => Wf(e) - W, 1e-4, 0.999, 1e-6); if (!isFinite(eps)) eps = 0.999;
    const h0 = c * (1 - eps) * 1000; // µm
    const hmin = (0.00508 + 0.00004 * v.d) * 1000; // Trumpler, µm
    const f = 2 * Math.PI ** 2 * (r / c) * mu * N / Pp; // Petroff
    const Hloss = f * W * U; // W
    return { mu, Pp: Pp / 1e6, S, eps, h0, hmin, f, Hloss, U };
  },
};
MD.register('bearings', {
  group: 'Machine elements', title: 'Bearings', icon: '🔘', voice: 'bearing ball roller journal life',
  kid: { what: 'Picks a <b>ball or roller bearing</b> that lasts long enough, or checks an <b>oil-film (journal) bearing</b>.', steps: ['Enter the load on the bearing and its speed.', 'Say how many hours it must last.', 'Read the bearing number that fits your shaft.'], try: 'Double the radial load: the ball bearing\'s life falls about 8× (life ∝ 1/load³).' },
  eq: [
    { t: 'Rating life', f: 'L10 = (C / P)^p  million revolutions,   p = 3 (ball), 10/3 (roller)', m: '90 % of identical bearings survive this many revolutions.', fx: [['double the load P', 'ball life ÷ 8, roller life ÷ 10'], ['higher reliability', 'factor a1 < 1, so you need a bigger C']] },
    { t: 'Equivalent load', f: 'P = ka·(X·Fr + Y·Fa)', fx: [['add axial load', 'P rises once Fa/Fr > e (≈ 0.28 for deep-groove balls)']] },
    { t: 'Sommerfeld number', f: 'S = (r/c)² · μ·N / P', m: 'One number that captures the whole oil-film bearing: viscosity, speed, load and clearance.', fx: [['hotter oil (lower μ)', 'S falls, film thins'], ['faster', 'thicker film (oil is dragged in)']] },
    { t: 'Petroff friction', f: 'f = 2π² · (r/c) · μN / P', fx: [['tighter clearance c', 'more friction & heat']] },
    { t: 'Minimum film (Trumpler)', f: 'h0 ≥ 0.005 + 0.00004·d   [mm]', m: 'Film must be thicker than surface roughness + dirt.' },
  ],
  render(main) {
    pageHead(main, 'Machine elements · supporting rotation', 'Bearings: rolling and journal',
      '<b>Rolling bearings</b> (balls, rollers) fail by <b>fatigue of the races</b>: life falls with load cubed, so they are chosen from catalogues by life. <b>Journal bearings</b> float the shaft on a pressurised oil film: nearly wear-free and great for heavy, fast shafts (engine crankshafts, turbines), but they need oil, heat removal and a minimum speed to form the film.');
    const body = h('div');
    tabs(main, ['Ball / roller bearing life', 'Oil-film journal bearing'], i => { body.innerHTML = ''; [rollTab, journalTab][i](body); });
    main.append(body);
  }
});
function rollTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { id: 'type', label: 'Bearing type', type: 'select', options: ['Ball', 'Cylindrical roller'], value: 'Ball' },
    { id: 'Fr', label: 'Radial load', unit: 'kN', value: 4, min: 0.1, max: 60, step: 0.1, aliases: ['radial load', 'load'] },
    { id: 'Fa', label: 'Axial load', unit: 'kN', value: 1, min: 0, max: 30, step: 0.1, aliases: ['axial load'] },
    { id: 'rpm', label: 'Speed', unit: 'rpm', value: 1440, min: 10, max: 10000, step: 10 },
    { id: 'Lh', label: 'Required life', unit: 'hours', value: 20000, min: 500, max: 100000, step: 500, aliases: ['life'], tip: 'Home appliance ≈ 2 000 h, car wheel ≈ 5 000 h, 8-hour factory machine ≈ 20 000 h, 24/7 pump ≈ 50 000+ h.' },
    { id: 'd', label: 'Shaft diameter (bore)', unit: 'mm', value: 30, min: 20, max: 60, step: 5, aliases: ['bore', 'diameter'] },
    { id: 'ka', label: 'Load (shock) factor', value: 1.2, min: 1, max: 3, step: 0.05 },
  ];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = BR.rolling(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Equivalent load P', fmt(r.P / 1000), 'kN'), metric('Life needed', fmt(r.L10), 'million rev'), metric(`Reliability ${ENV.rel * 100}% factor a1`, fmt(r.a1, 3), ''),
      metric('Required dynamic rating C', fmt(r.Creq), 'kN'), metric('Selected bearing', r.pick ? r.pick[0] : 'none', '', r.pick ? 'good' : 'bad'), ...(r.pick ? [metric('Its C', fmt(r.pick[3]), 'kN'), metric('Predicted life', fmt(r.lifeH), 'h', r.lifeH >= v.Lh ? 'good' : 'bad')] : [])));
    verdict(out, !!r.pick, r.pick ? `Use ${r.pick[0]} (bore ${r.pick[2]} mm, C = ${r.pick[3]} kN)` : 'No bearing in this mini-catalogue is big enough', r.pick ? `Life ${fmt(r.lifeH)} h vs ${v.Lh} h required. ${v.type === 'Ball' && v.Fa > 0 ? `Axial load raised the equivalent load (X = ${r.X}, Y = ${r.Y}).` : ''} Cylindrical rollers carry far more radial load for the same bore but almost no axial load.` : 'Use a larger series (63xx/NU2xx), a roller bearing, or a larger bore.');
    out.append(h('div', { class: 'small' }, 'Catalogue ratings are indicative of 62/63/NU2 series; use your supplier\'s data for final selection (and the modified life rating with lubrication/contamination factors).'));
    const loads = linspace(0.2, 3, 60);
    plot(c1, { title: 'Life vs load: the cube law', xlabel: 'Load ÷ your load', ylabel: 'Life (h)', logy: true, legend: 'tr', vlines: [{ x: 1 }], hlines: [{ y: v.Lh, label: 'required', color: '#2f7d32' }], series: r.pick ? [{ label: r.pick[0], x: loads, y: loads.map(k => r.a1 * Math.pow(r.pick[3] * 1000 / (r.P * k), r.p) * 1e6 / (60 * v.rpm)) }] : [] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = BR.rolling(vv); return { 'Required C': q.Creq }; }, v, specs, { skip: ['d'] });
    explain(r.pick ? `Use bearing ${r.pick[0]} with a predicted life of ${fmt(r.lifeH)} hours.` : 'No bearing in the list is big enough.');
  }
  const f = buildForm(L, specs, run, 'rolling'); run(f.vals);
}
function journalTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { id: 'W', label: 'Radial load', unit: 'kN', value: 10, min: 0.5, max: 200, step: 0.5, aliases: ['load'] },
    { id: 'rpm', label: 'Speed', unit: 'rpm', value: 1500, min: 50, max: 10000, step: 10 },
    { id: 'd', label: 'Journal diameter', unit: 'mm', value: 60, min: 20, max: 300, step: 1 },
    { id: 'ld', label: 'Length ÷ diameter (L/d)', value: 0.8, min: 0.3, max: 1.5, step: 0.05 },
    { id: 'cr', label: 'Radial clearance ÷ radius', unit: '×10⁻³', value: 1.0, min: 0.5, max: 3, step: 0.05, tip: 'Typical 1/1000 of the radius. Too tight overheats; too loose thins the film under load.' },
    { id: 'vg', label: 'Oil grade (ISO VG, cSt @40 °C)', type: 'select', options: ['22', '32', '46', '68', '100', '150'], value: '46' },
    { id: 'To', label: 'Oil film temperature', unit: '°C', value: 60, min: 30, max: 120, step: 1 },
  ];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    v = Object.assign({}, v, { vg: +v.vg }); const r = BR.journal(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Viscosity at film temp', fmt(r.mu * 1000), 'mPa·s'), metric('Bearing pressure', fmt(r.Pp), 'MPa', r.Pp < 3 ? 'good' : 'warn'), metric('Sommerfeld S', fmt(r.S), ''),
      metric('Eccentricity ratio ε', fmt(r.eps), '', r.eps < 0.8 ? 'good' : 'warn'), metric('Min film thickness h0', fmt(r.h0), 'µm', r.h0 >= r.hmin ? 'good' : 'bad'), metric('Trumpler minimum', fmt(r.hmin), 'µm'), metric('Friction coeff (Petroff)', fmt(r.f), ''), metric('Heat generated', fmt(r.Hloss), 'W')));
    verdict(out, r.h0 >= r.hmin, r.h0 >= r.hmin ? 'Full oil film: metal surfaces never touch' : 'Film too thin: metal contact, wear and seizure risk', `Film ${fmt(r.h0)} µm vs ${fmt(r.hmin)} µm needed. Hotter oil is thinner: at ${v.To} °C the oil viscosity is ${fmt(r.mu * 1000)} mPa·s. Heat generated must be carried away by oil flow, which is why journal bearings run in an oil circuit.`);
    out.append(h('div', { class: 'small' }, 'Uses the short-bearing (Ocvirk) theory for film thickness and an approximate viscosity–temperature law; for L/d near 1 use Raimondi–Boyd charts for final design.'));
    const temps = linspace(30, 120, 46); plot(c1, { title: 'Why bearings fail when the oil gets hot', xlabel: 'Oil temperature (°C)', ylabel: 'Film thickness (µm)', ymin: 0, hlines: [{ y: r.hmin, label: 'minimum' }], vlines: [{ x: v.To }], series: [{ x: temps, y: temps.map(T => BR.journal(Object.assign({}, v, { To: T })).h0), fill: true }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = BR.journal(Object.assign({}, vv, { vg: +vv.vg })); return { 'Film thickness': q.h0, 'Heat': q.Hloss }; }, v, specs);
    explain(`Minimum oil film ${fmt(r.h0)} micrometres against ${fmt(r.hmin)} required. Heat generated ${fmt(r.Hloss)} watts.`);
  }
  const f = buildForm(L, specs, run, 'journal'); run(f.vals);
}
