'use strict';
/* Helical, bevel, worm and planetary gears: pure calculators + UI */
const GP = {
  helical(v) {
    const g = GEAR_MATS[v.mat], psi = v.psi * deg, mt = v.mn / Math.cos(psi), dp = mt * v.z1, z2 = Math.round(v.z1 * v.i);
    const vel = Math.PI * dp * v.rpm / 60000, Pt = v.P * 1000 / vel, b = v.k * v.mn, Cv = 5.6 / (5.6 + Math.sqrt(vel));
    const zv = v.z1 / Math.cos(psi) ** 3, Y = 0.484 - 2.87 / zv, Peff = v.Cs * Pt / Cv;
    const Sb = v.mn * b * (g.Sut / 3) * Y, K = 0.16 * (g.BHN / 100) ** 2, Q = 2 * z2 / (z2 + v.z1), Sw = b * Q * dp * K / Math.cos(psi) ** 2;
    const Fa = Pt * Math.tan(psi), Fr = Pt * Math.tan(20 * deg) / Math.cos(psi), overlap = b * Math.tan(psi) / (Math.PI * v.mn);
    return { dp, z2, vel, Pt, b, zv, Peff, Sb, Sw, nb: Sb / Peff, nw: Sw / Peff, Fa, Fr, overlap };
  },
  bevel(v) {
    const g = GEAR_MATS[v.mat], z2 = Math.round(v.z1 * v.i), g1 = Math.atan(v.z1 / z2), g2 = Math.PI / 2 - g1;
    const D1 = v.m * v.z1, D2 = v.m * z2, A0 = Math.hypot(D1 / 2, D2 / 2), b = Math.min(v.bf * A0, 10 * v.m);
    const rm = D1 / 2 - b * Math.sin(g1) / 2, vel = Math.PI * 2 * rm * v.rpm / 60000, T = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60), Pt = T / rm;
    const zv1 = v.z1 / Math.cos(g1), zv2 = z2 / Math.cos(g2), Y = 0.484 - 2.87 / zv1, Cv = 6 / (6 + vel), Peff = v.Cs * Pt / Cv;
    const Sb = v.m * b * (g.Sut / 3) * Y * (1 - b / A0), K = 0.16 * (g.BHN / 100) ** 2, Q = 2 * zv2 / (zv1 + zv2), Sw = 0.75 * b * Q * D1 * K / Math.cos(g1);
    const Fr = Pt * Math.tan(20 * deg) * Math.cos(g1), Fa = Pt * Math.tan(20 * deg) * Math.sin(g1);
    return { z2, g1: g1 / deg, g2: g2 / deg, D1, D2, A0, b, vel, Pt, Peff, Sb, Sw, nb: Sb / Peff, nw: Sw / Peff, Fr, Fa };
  },
  worm(v) {
    const d1 = v.q * v.m, d2 = v.m * v.z2, i = v.z2 / v.zw, lam = Math.atan(v.zw / v.q), an = 20 * deg;
    const eta = Math.tan(lam) * (Math.cos(an) - v.mu * Math.tan(lam)) / (Math.cos(an) * Math.tan(lam) + v.mu);
    const self = Math.tan(lam) <= v.mu / Math.cos(an); // cannot back-drive
    const vs = Math.PI * d1 * v.rpm / 60000 / Math.cos(lam), Pout = v.P * eta, heat = v.P * (1 - eta) * 1000;
    const A = heat / (v.hc * v.dT), n2 = v.rpm / i, T2 = Pout * 1e6 / (n2 * 2 * Math.PI / 60);
    const Ft2 = 2 * T2 / d2, b = 0.73 * d1, vg = Math.PI * d2 * n2 / 60000, Cv = 6 / (6 + vg);
    const Sb = v.m * b * v.sbw * (0.484 - 2.87 / v.z2), Sw = d2 * b * v.Kw, Peff = 1.25 * Ft2 / Cv;
    return { d1, d2, i, lam: lam / deg, eta, self, vs, heat, A, T2, Ft2, nb: Sb / Peff, nw: Sw / Peff, n2 };
  },
  planet(v) {
    const zr = v.zs + 2 * v.zp, N = v.N;
    const assemble = Number.isInteger((v.zs + zr) / N), adj = (v.zs + v.zp) * Math.sin(Math.PI / N) > v.zp + 2;
    // Willis: (ws - wc)/(wr - wc) = -zr/zs
    const cases = { 'Ring fixed · sun in → carrier out': 1 + zr / v.zs, 'Sun fixed · ring in → carrier out': 1 + v.zs / zr, 'Carrier fixed · sun in → ring out (reverses)': -zr / v.zs };
    const ratio = cases[v.mode], Tin = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60), Tout = Tin * Math.abs(ratio) * 0.97;
    const dS = v.m * v.zs, Ft = Tin / (dS / 2) / N; // per planet mesh force (input = sun for 2 of 3 modes)
    return { zr, assemble, adj, ratio, Tin, Tout, Ft, cases, dS };
  },
};
MD.register('gearsplus', {
  group: 'Machine elements', title: 'Helical, bevel, worm & planetary', icon: '⚙️', voice: 'helical bevel worm planetary epicyclic gears',
  kid: { what: 'Four other kinds of gears: <b>helical</b> (slanted, quiet teeth), <b>bevel</b> (turn a corner), <b>worm</b> (huge reduction, can lock) and <b>planetary</b> (gears inside gears).', steps: ['Pick a tab.', 'Enter power and speed.', 'Read the safety factors and the special effect of each gear type (thrust, efficiency, locking).'], try: 'On the Worm tab, change starts from 1 to 4: efficiency jumps, but the gear stops locking itself.' },
  eq: [
    { t: 'Helical: virtual teeth & axial thrust', f: "z' = z / cos³ψ,   Fa = Ft·tan ψ,   overlap ratio = b·tan ψ / (π·mn)", fx: [['bigger helix angle ψ', 'stronger & smoother (z\' grows, more teeth share load) but larger axial thrust on bearings'], ['overlap ratio < 1', 'teeth engage abruptly: noise returns']] },
    { t: 'Bevel: pitch cone & strength', f: "tan γ1 = z1/z2,   A0 = √(R1² + R2²),   Sb = m·b·σb·Y'·(1 − b/A0)", fx: [['wider face b', 'strength rises but the (1 − b/A0) penalty grows: keep b ≤ A0/3']] },
    { t: 'Worm efficiency & self-locking', f: 'η = tan λ·(cos αn − μ tan λ) / (cos αn·tan λ + μ),   self-locking if tan λ ≤ μ / cos αn', fx: [['more starts', 'λ rises → η rises, locking lost'], ['better lubrication (lower μ)', 'η rises']] },
    { t: 'Worm heat balance', f: 'Heat = (1 − η)·P = h·A·ΔT', fx: [['low efficiency', 'more heat, so the housing needs fins or a fan']] },
    { t: 'Planetary (Willis equation)', f: '(ωs − ωc) / (ωr − ωc) = − zr / zs,   zr = zs + 2·zp', fx: [['ring fixed, sun in', 'ratio = 1 + zr/zs (largest reduction)'], ['more planets', 'load per tooth falls, compact & high torque']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · power transmission', 'Helical, bevel, worm & planetary gears',
      'Spur gears are simple but noisy and only connect parallel shafts. <b>Helical</b> teeth engage gradually (quiet, stronger) but push sideways. <b>Bevel</b> gears turn the drive through an angle. <b>Worms</b> give huge reductions in one step and can lock against back-driving, at the price of efficiency. <b>Planetary</b> sets share load among several planets: compact, coaxial and very strong, which is why EVs, wind turbines and automatic gearboxes use them.');
    const body = h('div');
    tabs(main, ['Helical', 'Bevel', 'Worm & wheel', 'Planetary'], i => { if (MD.cleanup) { MD.cleanup(); MD.cleanup = null; } body.innerHTML = ''; [helicalTab, bevelTab, wormTab, planetTab][i](body); });
    main.append(body);
  }
});
const GM = Object.keys(GEAR_MATS);
function gpLayout(body) { const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g); return [L, R]; }
function helicalTab(body) {
  const [L, R] = gpLayout(body);
  const specs = [
    { id: 'P', label: 'Power', unit: 'kW', value: 15, min: 0.5, max: 300, step: 0.5, aliases: ['power'] },
    { id: 'rpm', label: 'Pinion speed', unit: 'rpm', value: 1440, min: 50, max: 6000, step: 10 },
    { id: 'i', label: 'Ratio', value: 3, min: 1, max: 8, step: 0.05 },
    { id: 'psi', label: 'Helix angle ψ', unit: '°', value: 23, min: 0, max: 45, step: 0.5, aliases: ['helix angle'], tip: 'Angle of the teeth across the gear. 0° = spur gear. 15–30° is usual.' },
    { id: 'mn', label: 'Normal module', unit: 'mm', value: 3, min: 1, max: 12, step: 0.25, aliases: ['module'] },
    { id: 'z1', label: 'Pinion teeth', value: 20, min: 10, max: 60, step: 1 },
    { id: 'k', label: 'Face width b = k·mn', value: 12, min: 6, max: 20, step: 0.5 },
    { id: 'Cs', label: 'Service factor', value: 1.25, min: 1, max: 2.5, step: 0.05 },
    { id: 'mat', label: 'Material (both gears)', type: 'select', options: GM, value: GM[2], wide: true },
  ];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = GP.helical(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Pitch Ø pinion', fmt(r.dp), 'mm'), metric('Virtual teeth z\'', fmt(r.zv), ''), metric('Face width', fmt(r.b), 'mm'), metric('Pitch-line speed', fmt(r.vel), 'm/s'),
      metric('Bending FS', fmt(r.nb), '', fsStatus(r.nb)), metric('Wear FS', fmt(r.nw), '', fsStatus(r.nw)), metric('Axial thrust Fa', fmt(r.Fa), 'N', r.Fa > r.Pt * 0.6 ? 'warn' : ''), metric('Overlap ratio', fmt(r.overlap), '', r.overlap >= 1 ? 'good' : 'warn')));
    verdict(out, Math.min(r.nb, r.nw) >= 1.5, `${Math.min(r.nb, r.nw) >= 1.5 ? 'Pair is adequate' : 'Pair is under-designed'}: limited by ${r.nb < r.nw ? 'bending' : 'wear'}`, `Axial thrust ${fmt(r.Fa)} N must be carried by the bearings (angular-contact or tapered roller). Double-helical (herringbone) gears cancel it. ${r.overlap < 1 ? 'Overlap < 1: widen the face or increase ψ for quiet running.' : 'Overlap ≥ 1: at least one tooth pair always fully engaged, so it runs quietly.'}`);
    const ps = linspace(0, 40, 41), rs = ps.map(p => GP.helical(Object.assign({}, v, { psi: p })));
    plot(c1, { title: 'The helix-angle trade-off', xlabel: 'Helix angle ψ (°)', ylabel: 'FS  ·  thrust/Ft', legend: 'tl', vlines: [{ x: v.psi }], series: [{ label: 'Bending FS', x: ps, y: rs.map(q => q.nb) }, { label: 'Wear FS', x: ps, y: rs.map(q => q.nw) }, { label: 'Axial thrust ÷ tangential load', x: ps, y: rs.map(q => q.Fa / q.Pt), dash: [5, 3] }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = GP.helical(vv); return { "Bending FS": q.nb, "Wear FS": q.nw, "Axial thrust": q.Fa }; }, v, specs);
    explain(`Helical pair: bending safety factor ${fmt(r.nb)}, wear ${fmt(r.nw)}, axial thrust ${fmt(r.Fa)} newtons.`);
  }
  const f = buildForm(L, specs, run, 'helical'); run(f.vals);
}
function bevelTab(body) {
  const [L, R] = gpLayout(body);
  const specs = [
    { id: 'P', label: 'Power', unit: 'kW', value: 7.5, min: 0.5, max: 200, step: 0.5 },
    { id: 'rpm', label: 'Pinion speed', unit: 'rpm', value: 960, min: 50, max: 5000, step: 10 },
    { id: 'i', label: 'Ratio', value: 2, min: 1, max: 6, step: 0.05 },
    { id: 'z1', label: 'Pinion teeth', value: 20, min: 12, max: 50, step: 1 },
    { id: 'm', label: 'Module (large end)', unit: 'mm', value: 5, min: 1, max: 12, step: 0.25, aliases: ['module'] },
    { id: 'bf', label: 'Face width ÷ cone distance', value: 0.3, min: 0.15, max: 0.33, step: 0.01, tip: 'Keep ≤ 1/3: the tooth gets smaller towards the apex, so extra width adds little.' },
    { id: 'Cs', label: 'Service factor', value: 1.25, min: 1, max: 2.5, step: 0.05 },
    { id: 'mat', label: 'Material', type: 'select', options: GM, value: GM[3], wide: true },
  ];
  const out = h('div'), cv = plotCanvas('anim'); cv.style.height = '220px'; R.append(h('div', { class: 'card' }, cv, out));
  let B = null;
  function run(v) {
    const r = GP.bevel(v); B = r; out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Pitch cone angles', `${fmt(r.g1)}° / ${fmt(r.g2)}°`, ''), metric('Cone distance A0', fmt(r.A0), 'mm'), metric('Face width', fmt(r.b), 'mm'), metric('Pitch Ø', `${fmt(r.D1)} / ${fmt(r.D2)}`, 'mm'),
      metric('Bending FS', fmt(r.nb), '', fsStatus(r.nb)), metric('Wear FS', fmt(r.nw), '', fsStatus(r.nw)), metric('Pinion radial / axial', `${fmt(r.Fr)} / ${fmt(r.Fa)}`, 'N')));
    verdict(out, Math.min(r.nb, r.nw) >= 1.5, `Straight bevel pair, limited by ${r.nb < r.nw ? 'bending' : 'wear'}`, 'Bevel teeth taper toward the cone apex, so only the outer part is strong; the (1 − b/A0) factor penalises wide faces. Spiral bevels (car differentials) engage gradually like helical gears.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = GP.bevel(vv); return { 'Bending FS': q.nb, 'Wear FS': q.nw }; }, v, specs);
    explain(`Bevel pair with cone angles ${fmt(r.g1)} and ${fmt(r.g2)} degrees. Bending safety factor ${fmt(r.nb)}, wear ${fmt(r.nw)}.`);
  }
  const f = buildForm(L, specs, run, 'bevel'); run(f.vals);
  anim(t => { if (!B) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H); const sc = Math.min(w * 0.4, H * 0.8) / Math.max(B.D1, B.D2) * 0.9, ox = w * 0.35, oy = H * 0.85;
    const g1 = B.g1 * deg; // pinion axis horizontal, gear axis vertical; draw cone sections
    ctx.fillStyle = '#c2410c33'; ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - B.A0 * Math.cos(g1) * sc, oy - B.D1 / 2 * sc); ctx.lineTo(ox - B.A0 * Math.cos(g1) * sc, oy + B.D1 / 2 * sc * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0f5e8c33'; ctx.strokeStyle = '#0f5e8c'; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - B.A0 * Math.cos(g1) * sc, oy - B.D1 / 2 * sc); ctx.lineTo(ox + B.D2 / 2 * sc * 0.15, oy - B.A0 * Math.sin(Math.PI / 2 - g1) * sc); ctx.closePath(); ctx.fill(); ctx.stroke();
    const a = t * 2; tag(ctx, 'Pinion (input, horizontal shaft)', ox - B.A0 * Math.cos(g1) * sc / 2, oy + 16, '#c2410c', 'center', 11); tag(ctx, 'Gear (output, vertical shaft)', ox + 10, oy - B.A0 * sc * 0.6, '#0f5e8c', 'left', 11);
    tag(ctx, 'cone apex: both pitch cones meet here', ox + 8, oy + 4, '#1b2430', 'left', 11, false); tag(ctx, `shaft angle 90° · ${'↻'.repeat(1 + Math.floor(a) % 2)}`, 10, 12, '#4a5566', 'left', 11, false); });
}
function wormTab(body) {
  const [L, R] = gpLayout(body);
  const specs = [
    { id: 'P', label: 'Input power', unit: 'kW', value: 3, min: 0.2, max: 50, step: 0.1 },
    { id: 'rpm', label: 'Worm speed', unit: 'rpm', value: 1440, min: 100, max: 3000, step: 10 },
    { id: 'zw', label: 'Worm starts (threads)', value: 2, min: 1, max: 6, step: 1, aliases: ['starts'], tip: 'How many separate threads wind round the worm. 1 start = slow, strong, self-locking; 4 starts = faster, more efficient.' },
    { id: 'z2', label: 'Worm-wheel teeth', value: 40, min: 20, max: 100, step: 1 },
    { id: 'm', label: 'Axial module', unit: 'mm', value: 6, min: 2, max: 16, step: 0.5, aliases: ['module'] },
    { id: 'q', label: 'Diametral quotient q = d1/m', value: 10, min: 6, max: 16, step: 0.5 },
    { id: 'mu', label: 'Friction coefficient μ', value: 0.04, min: 0.015, max: 0.12, step: 0.005, tip: 'Steel worm on bronze wheel, oil-bath: 0.02–0.06 depending on sliding speed.' },
    { id: 'sbw', label: 'Wheel allowable bending σb (bronze)', unit: 'MPa', value: 84, min: 40, max: 150, step: 1 },
    { id: 'Kw', label: 'Wear factor Kw', unit: 'MPa', value: 0.55, min: 0.3, max: 1.2, step: 0.01 },
    { id: 'hc', label: 'Housing heat-transfer coeff.', unit: 'W/m²K', value: 15, min: 8, max: 40, step: 1 },
    { id: 'dT', label: 'Allowed oil temperature rise', unit: '°C', value: 50, min: 20, max: 80, step: 1 },
  ];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = GP.worm(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Reduction', fmt(r.i) + ' : 1', ''), metric('Lead angle λ', fmt(r.lam), '°'), metric('Efficiency', fmt(r.eta * 100) + ' %', '', r.eta > 0.7 ? 'good' : r.eta > 0.5 ? 'warn' : 'bad'),
      metric('Self-locking?', r.self ? 'yes' : 'no', '', r.self ? 'good' : ''), metric('Sliding speed', fmt(r.vs), 'm/s'), metric('Heat to remove', fmt(r.heat), 'W'), metric('Housing area needed', fmt(r.A), 'm²'),
      metric('Wheel torque', fmt(r.T2 / 1000), 'N·m'), metric('Wheel bending FS', fmt(r.nb), '', fsStatus(r.nb)), metric('Wear FS', fmt(r.nw), '', fsStatus(r.nw))));
    verdict(out, Math.min(r.nb, r.nw) >= 1.5, `${fmt(r.i)}:1 in one stage at ${fmt(r.eta * 100)} % efficiency${r.self ? ', self-locking' : ''}`, r.self ? 'The load cannot drive the worm backwards: ideal for hoists, gates and steering locks (no brake needed for holding), but efficiency is below 50 %, so most input power becomes heat.' : 'Not self-locking: efficient enough to back-drive. Add a brake if the load must be held.');
    const ls = linspace(1, 40, 80); plot(c1, { title: 'Efficiency vs lead angle (why multi-start worms are efficient)', xlabel: 'Lead angle λ (°)', ylabel: 'Efficiency (%)', ymin: 0, ymax: 100, vlines: [{ x: r.lam }], series: [0.02, 0.05, 0.1].map(mu => ({ label: 'μ = ' + mu, x: ls, y: ls.map(l => { const t = Math.tan(l * deg), c = Math.cos(20 * deg); return 100 * t * (c - mu * t) / (c * t + mu); }) })) });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = GP.worm(vv); return { 'Efficiency': q.eta, 'Heat': q.heat, 'Wheel bending FS': q.nb }; }, v, specs);
    explain(`Worm drive with ratio ${fmt(r.i)} to 1, efficiency ${fmt(r.eta * 100)} percent, ${r.self ? 'self-locking' : 'not self-locking'}. It must shed ${fmt(r.heat)} watts of heat.`);
  }
  const f = buildForm(L, specs, run, 'worm'); run(f.vals);
}
function planetTab(body) {
  const [L, R] = gpLayout(body);
  const specs = [
    { id: 'P', label: 'Input power', unit: 'kW', value: 10, min: 0.5, max: 500, step: 0.5 },
    { id: 'rpm', label: 'Input speed', unit: 'rpm', value: 3000, min: 100, max: 15000, step: 50 },
    { id: 'zs', label: 'Sun teeth', value: 24, min: 12, max: 60, step: 1 },
    { id: 'zp', label: 'Planet teeth', value: 30, min: 12, max: 80, step: 1 },
    { id: 'N', label: 'Number of planets', value: 3, min: 2, max: 6, step: 1 },
    { id: 'm', label: 'Module', unit: 'mm', value: 2, min: 1, max: 8, step: 0.25 },
    { id: 'mode', label: 'Which member is held', type: 'select', options: ['Ring fixed · sun in → carrier out', 'Sun fixed · ring in → carrier out', 'Carrier fixed · sun in → ring out (reverses)'], value: 'Ring fixed · sun in → carrier out', wide: true },
  ];
  const cv = plotCanvas('anim'), out = h('div'); R.append(h('div', { class: 'card' }, cv, canvasLegend([['#c2410c', 'sun'], ['#2f7d32', 'planets'], ['#0f5e8c', 'ring'], ['#1b2430', 'carrier arm']]), out));
  let PL = null;
  function run(v) {
    const r = GP.planet(v); PL = Object.assign({ v }, r); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Ring teeth zr = zs + 2zp', r.zr, ''), metric('Speed ratio (in/out)', fmt(r.ratio, 4), ''), metric('Output torque', fmt(r.Tout / 1000), 'N·m'), metric('Force per planet mesh', fmt(r.Ft), 'N'),
      metric('Planets fit (assembly)?', r.assemble ? 'yes' : 'no', '', r.assemble ? 'good' : 'bad'), metric('Planets clear each other?', r.adj ? 'yes' : 'no', '', r.adj ? 'good' : 'bad')));
    const tb = h('table', { class: 't' }, h('tr', null, h('th', null, 'Held member · input → output'), h('th', null, 'Ratio')), Object.entries(r.cases).map(([k, x]) => h('tr', { class: k === v.mode ? 'hl' : '' }, h('td', { style: { fontFamily: 'var(--sans)' } }, k), h('td', null, fmt(x, 4)))));
    out.append(h('div', { class: 'tablewrap' }, tb));
    verdict(out, r.assemble && r.adj, r.assemble && r.adj ? 'Valid planetary set' : 'This set cannot be built', `${!r.assemble ? `(zs + zr)/N = ${fmt((v.zs + r.zr) / v.N, 4)} is not a whole number, so the planets cannot be spaced evenly. Change teeth or planet count. ` : ''}${!r.adj ? 'Planets would collide: fewer or smaller planets. ' : ''}Holding a different member changes the ratio without changing a single gear. Automatic gearboxes switch gears by clamping different members with clutches and bands.`);
    explain(`Planetary set with ratio ${fmt(r.ratio)}. Output torque ${fmt(r.Tout / 1000)} newton metres shared by ${v.N} planets.`);
  }
  const f = buildForm(L, specs, run, 'planet'); run(f.vals);
  anim(t => {
    if (!PL) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    const v = PL.v, rs = v.m * v.zs / 2, rp = v.m * v.zp / 2, rr = v.m * PL.zr / 2, sc = Math.min(w, H) * 0.44 / (rr + v.m * 2), cx = w / 2, cy = H / 2;
    const ws = 1.2, mode = v.mode[0]; let wc, wr;
    if (mode === 'R') { wr = 0; wc = ws * v.zs / (v.zs + PL.zr); } else if (mode === 'S') { wr = 1; wc = wr * PL.zr / (v.zs + PL.zr); } else { wc = 0; wr = -ws * v.zs / PL.zr; }
    const wsun = mode === 'S' ? 0 : ws, ang = t;
    ctx.fillStyle = '#0f5e8c18'; ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, (rr + v.m * 1.6) * sc, 0, 7); ctx.arc(cx, cy, (rr - v.m) * sc, 0, 7, true); ctx.fill('evenodd'); ctx.stroke();
    for (let k = 0; k < PL.zr; k += 1) { const a = k * 2 * Math.PI / PL.zr + wr * ang; ctx.beginPath(); ctx.moveTo(cx + (rr - v.m) * sc * Math.cos(a), cy + (rr - v.m) * sc * Math.sin(a)); ctx.lineTo(cx + rr * sc * Math.cos(a), cy + rr * sc * Math.sin(a)); ctx.stroke(); }
    ctx.lineWidth = 1.2; ctx.fillStyle = '#c2410c33'; ctx.strokeStyle = '#c2410c'; gearPath(ctx, cx, cy, v.zs, v.m, wsun * ang, sc); ctx.fill(); ctx.stroke();
    for (let k = 0; k < v.N; k++) { const a = wc * ang + k * 2 * Math.PI / v.N, px = cx + (rs + rp) * sc * Math.cos(a), py = cy + (rs + rp) * sc * Math.sin(a);
      const wpl = -(wsun - wc) * v.zs / v.zp + wc; ctx.fillStyle = '#2f7d3233'; ctx.strokeStyle = '#2f7d32'; gearPath(ctx, px, py, v.zp, v.m, -wpl * ang, sc); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke(); ctx.lineWidth = 1.2; }
    tag(ctx, 'Sun', cx, cy, '#c2410c', 'center', 12); tag(ctx, 'Ring', cx + (rr + v.m) * sc * 0.75, cy - (rr + v.m) * sc * 0.75, '#0f5e8c', 'center', 12);
    tag(ctx, mode === 'R' ? 'ring held' : mode === 'S' ? 'sun held' : 'carrier held', 10, 12, '#1b2430', 'left', 12);
  });
}
