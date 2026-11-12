'use strict';
const PV = {
  vessel(v) {
    const m = matAt(v.mat), S = m.Sy / v.n, p = v.p, ca = m.corr * ENV.life + v.ca;
    const tThin = p * v.D / (2 * S * v.eta - p), tLong = p * v.D / (4 * S * v.eta);
    const ri = v.D / 2, tLame = p < S ? ri * (Math.sqrt((S + p) / (S - p)) - 1) : Infinity; // Lamé, max hoop at bore
    const tHemi = p * v.D / (4 * S * v.eta - 0.4 * p), tEll = p * v.D / (2 * S * v.eta - 0.2 * p), tFlat = v.D * Math.sqrt(0.3 * p / S);
    const thick = tThin / v.D > 0.05;
    return { S, ca, tThin: tThin + ca, tLong: tLong + ca, tLame: tLame + ca, tHemi: tHemi + ca, tEll: tEll + ca, tFlat: tFlat + ca, thick, m };
  },
  hook(v) { // Winkler–Bach curved beam; load P on a line at distance from centroid; section types
    const ri = v.ri, h0 = v.h; let A, rc, rn;
    if (v.sec === 'Rectangle') { A = v.bi * h0; rc = ri + h0 / 2; rn = h0 / Math.log((ri + h0) / ri); }
    else if (v.sec === 'Circle') { const R = h0 / 2; A = Math.PI * R * R; rc = ri + R; rn = (rc + Math.sqrt(rc * rc - R * R)) / 2; }
    else { const bi = v.bi, bo = v.bo, ro = ri + h0; A = (bi + bo) / 2 * h0; rc = ri + h0 * (bi + 2 * bo) / (3 * (bi + bo)); rn = A / (((bi * ro - bo * ri) / h0) * Math.log(ro / ri) - (bi - bo)); }
    const ro = ri + h0, e = rc - rn, P = v.P * 1000, M = P * rc; // load line through centre of curvature (hook: load acts at the bowl centre)
    const si = P / A + M * (rn - ri) / (A * e * ri), so = P / A - M * (ro - rn) / (A * e * ro);
    const I = v.sec === 'Circle' ? Math.PI * h0 ** 4 / 64 : v.sec === 'Rectangle' ? v.bi * h0 ** 3 / 12 : NaN;
    const straight = isFinite(I) ? P / A + M * (h0 / 2) / I : NaN;
    return { A, rc, rn, e, si, so, straight, ro };
  },
};
MD.register('vessels', {
  group: 'Machine elements', title: 'Pressure vessels & curved beams', icon: '🛢', voice: 'pressure vessel cylinder thick thin lame curved beam crane hook',
  kid: { what: 'Why gas cylinders have <b>round ends</b> and why a crane <b>hook</b> is fat on the inside.', steps: ['Pressure tab: enter pressure and diameter.', 'Compare wall thickness for flat, elliptical and hemispherical ends.', 'Hook tab: compare the inside and outside stress of the curve.'], try: 'In the hook tab change the section from Rectangle to Trapezoid: inside stress drops.' },
  eq: [
    { t: 'Thin cylinder (hoop)', f: 'σ_hoop = p·D / (2t),   σ_long = p·D / (4t)', m: 'Hoop stress is twice the longitudinal stress, so long tanks split along their length, never around.', fx: [['double the diameter', 'wall must double'], ['double pressure', 'wall doubles']] },
    { t: 'Sphere / hemispherical end', f: 'σ = p·D / (4t)', m: 'A sphere carries pressure in two directions equally, so it needs half the wall of a cylinder. That is why gas tanks have domed ends.' },
    { t: 'Flat end plate', f: 't = D·√(C·p / σ),   C ≈ 0.3', m: 'A flat plate resists pressure by bending, which is very inefficient: it must be many times thicker.' },
    { t: 'Thick cylinder (Lamé)', f: 'σ_θ(r) = p·ri²(ro² + r²) / (r²(ro² − ri²)),   t = ri·(√((S + p)/(S − p)) − 1)', m: 'Above t/D ≈ 0.05 the stress is no longer uniform through the wall; the bore carries the most.' },
    { t: 'Curved beam (Winkler–Bach)', f: 'σ = P/A ± M·(rn − r) / (A·e·r),   e = rc − rn', fx: [['tighter curvature (small ri)', 'inner stress rises far above straight-beam theory'], ['trapezoidal section, wide inside', 'puts material where the stress is: hook shape']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · shape matters', 'Pressure vessels & curved beams',
      'Two lessons in why <b>shape</b> beats size. A sphere holds pressure with half the wall of a cylinder, and a flat lid needs many times more: so tanks are cylinders with domed ends. A curved beam (crane hook, C-clamp, chain link) is far more stressed on its inner edge than straight-beam theory predicts: so hooks are thick and wide on the inside.');
    const body = h('div');
    tabs(main, ['Pressure vessel', 'Curved beam / crane hook'], i => { body.innerHTML = ''; [vesselTab, hookTab][i](body); });
    main.append(body);
  }
});
function vesselTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [{ id: 'p', label: 'Internal pressure', unit: 'MPa', value: 2, min: 0.1, max: 100, step: 0.1, aliases: ['pressure'], tip: '1 MPa = 10 bar. LPG cylinder ≈ 1.5–2 MPa test, CNG ≈ 20 MPa, scuba ≈ 20–30 MPa.' },
    { id: 'D', label: 'Inside diameter', unit: 'mm', value: 1000, min: 50, max: 5000, step: 10, aliases: ['diameter'] }, { id: 'mat', label: 'Material', type: 'select', options: MAT_NAMES.filter(n => !/cast|Ti-/.test(n)), value: 'IS 2062 E250 structural steel', wide: true },
    { id: 'n', label: 'Factor of safety on yield', value: 2, min: 1.2, max: 5, step: 0.1 }, { id: 'eta', label: 'Weld joint efficiency', value: 0.85, min: 0.5, max: 1, step: 0.05, tip: '1.0 fully X-rayed, 0.85 spot-checked, 0.7 not inspected.' }, { id: 'ca', label: 'Extra corrosion allowance', unit: 'mm', value: 1.5, min: 0, max: 6, step: 0.5 }];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = PV.vessel(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Allowable stress', fmt(r.S), 'MPa'), metric('Shell (thin-wall hoop)', fmt(r.tThin), 'mm', 'good'), metric('Shell (Lamé thick-wall)', isFinite(r.tLame) ? fmt(r.tLame) : 'impossible: p ≥ allowable', isFinite(r.tLame) ? 'mm' : '', isFinite(r.tLame) ? '' : 'bad'), metric('Corrosion allowance (life + extra)', fmt(r.ca), 'mm'),
      metric('Hemispherical end', fmt(r.tHemi), 'mm', 'good'), metric('2:1 elliptical end', fmt(r.tEll), 'mm'), metric('Flat end plate', fmt(r.tFlat), 'mm', 'bad')));
    verdict(out, true, `Flat lid needs ${fmt(r.tFlat / r.tHemi)}× the thickness of a dome`, `A dome carries pressure by membrane tension; a flat plate by bending. ${r.thick ? 'Wall is thick (t/D > 5 %): use Lamé, since the thin-wall formula underestimates bore stress.' : 'Thin-wall theory is valid here (t/D < 5 %).'} Elliptical (2:1) heads are a compromise: shallower than hemispheres, cheaper to press.`);
    const ri = v.D / 2, ro = ri + r.tLame - r.ca, rs = linspace(ri, ro, 40), k = v.p * ri * ri / (ro * ro - ri * ri);
    if (isFinite(ro)) plot(c1, { title: 'Lamé: stress through the wall', xlabel: 'Radius (mm)', ylabel: 'Stress (MPa)', legend: 'tr', series: [{ label: 'Hoop σθ', x: rs, y: rs.map(x => k * (1 + ro * ro / (x * x))) }, { label: 'Radial σr', x: rs, y: rs.map(x => k * (1 - ro * ro / (x * x))) }], hlines: [{ y: r.S, label: 'allowable' }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = PV.vessel(vv); return { 'Shell thickness': q.tThin, 'Flat end': q.tFlat }; }, v, specs);
    explain(`Shell thickness ${fmt(r.tThin)} millimetres. A hemispherical end needs ${fmt(r.tHemi)}, a flat end ${fmt(r.tFlat)}.`);
  }
  const f = buildForm(L, specs, run, 'vessel'); run(f.vals);
}
function hookTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [{ id: 'P', label: 'Load on hook', unit: 'kN', value: 50, min: 1, max: 500, step: 1, aliases: ['load'] }, { id: 'sec', label: 'Section shape', type: 'select', options: ['Trapezoid', 'Rectangle', 'Circle'], value: 'Trapezoid' },
    { id: 'ri', label: 'Inner radius (bowl)', unit: 'mm', value: 50, min: 10, max: 300, step: 1 }, { id: 'h', label: 'Section depth', unit: 'mm', value: 90, min: 10, max: 300, step: 1 },
    { id: 'bi', label: 'Width at inside', unit: 'mm', value: 60, min: 5, max: 200, step: 1 }, { id: 'bo', label: 'Width at outside (trapezoid)', unit: 'mm', value: 25, min: 2, max: 200, step: 1 }];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = PV.hook(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Area', fmt(r.A), 'mm²'), metric('Centroid radius rc', fmt(r.rc), 'mm'), metric('Neutral-axis radius rn', fmt(r.rn), 'mm'), metric('Shift e = rc − rn', fmt(r.e), 'mm'),
      metric('Inner-fibre stress (tension)', fmt(r.si), 'MPa', 'warn'), metric('Outer-fibre stress (compression)', fmt(r.so), 'MPa'), metric('Straight-beam formula would say', isFinite(r.straight) ? fmt(r.straight) : 'n/a', 'MPa')));
    verdict(out, true, `Inner fibre carries ${fmt(Math.abs(r.si / r.so))}× the outer stress`, 'In a curved beam the neutral axis moves toward the centre of curvature, so the inner fibres strain far more. Putting more width on the inside (trapezoid, or I/T section) balances inner and outer stress: that is the shape of every crane hook.');
    const secs = ['Rectangle', 'Trapezoid', 'Circle'], rr = secs.map(s => PV.hook(Object.assign({}, v, { sec: s })));
    const A0 = PV.hook(v).A, same = secs.map(s => { // scale each section to the same area to compare fairly
      const k = Math.sqrt(A0 / PV.hook(Object.assign({}, v, { sec: s })).A); return PV.hook(Object.assign({}, v, { sec: s, h: v.h * k, bi: v.bi * k, bo: v.bo * k })); });
    plot(c1, { title: 'Same area, different shape: inner-fibre stress', xlabel: '0 = Rectangle · 1 = Trapezoid · 2 = Circle', ylabel: 'σ inner (MPa)', ymin: 0, xmin: -0.5, xmax: 2.5, series: [{ x: [0, 1, 2], y: same.map(q => q.si), scatter: true, color: '#c2410c' }], points: same.map((q, i) => ({ x: i, y: q.si, label: secs[i] + ' ' + fmt(q.si), color: i === 1 ? '#2f7d32' : '#c2410c', r: 7 })) });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = PV.hook(vv); return { 'Inner stress': q.si }; }, v, specs);
    explain(`Inner fibre stress ${fmt(r.si)} megapascals, outer ${fmt(r.so)}. The neutral axis is shifted ${fmt(r.e)} millimetres toward the inside.`);
  }
  const f = buildForm(L, specs, run, 'hook'); run(f.vals);
}
