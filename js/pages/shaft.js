'use strict';
const NOTCHES = {
  'Shoulder, sharp fillet (r/d = 0.02)': { Kt: 2.7, Kts: 2.2, rd: 0.02 },
  'Shoulder, well-rounded (r/d = 0.1)': { Kt: 1.7, Kts: 1.5, rd: 0.1 },
  'End-mill keyseat (r/d = 0.02)': { Kt: 2.14, Kts: 3.0, rd: 0.02 },
  'Sled-runner keyseat': { Kt: 1.7, Kts: 1.5, rd: 0.05 },
  'Retaining-ring groove': { Kt: 5.0, Kts: 3.0, rd: 0.01 },
  'Plain (no notch)': { Kt: 1, Kts: 1, rd: 0.1 },
};
const BEARING_SLOPE = { 'Deep-groove ball (0.001–0.003 rad)': 0.002, 'Cylindrical roller (0.0008–0.0012 rad)': 0.001, 'Tapered roller (0.0005–0.0012 rad)': 0.0008, 'Self-aligning ball (0.026–0.052 rad)': 0.03 };
const STD_D = [10, 12, 15, 17, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250, 280, 300];
function shaftModel(v) {
  const w = v.rpm * 2 * Math.PI / 60, T = v.P * 1000 / w; // N·m
  const els = [];
  [[1, 'e1'], [2, 'e2']].forEach(([i, k]) => {
    const type = v[k + 'type']; if (type === 'None') return;
    const D = v[k + 'D'] / 1000, a = v[k + 'a'], m = v[k + 'm'];
    let Fy = 0, Fz = 0; // y vertical, z horizontal
    if (type === 'Spur gear (20°)') { const Ft = 2 * T / D, Fr = Ft * Math.tan(20 * deg); Fy = -Ft; Fz = Fr; }
    else { const ratio = type === 'Flat-belt pulley' ? 2.5 : 5, pull = 2 * T / D * (ratio + 1) / (ratio - 1); Fz = pull * Math.cos(v[k + 'ang'] * deg); Fy = -pull * Math.sin(v[k + 'ang'] * deg); }
    Fy -= m * 9.81;
    els.push({ a, Fy, Fz, m, type, D });
  });
  const L = v.L, Lend = Math.max(L, ...els.map(e => e.a));
  // reactions (bearings at 0 and L)
  const R = dir => { const sF = els.reduce((s, e) => s + e[dir], 0), sM = els.reduce((s, e) => s + e[dir] * e.a, 0); const R2 = -sM / L, R1 = -sF - R2; return [R1, R2]; };
  const [Ry1, Ry2] = R('Fy'), [Rz1, Rz2] = R('Fz');
  const Mx = (x, dir, R1, R2) => { let M = R1 * x; if (x > L) M += R2 * (x - L); els.forEach(e => { if (x > e.a) M += e[dir] * (x - e.a); }); return M / 1000; }; // N·m (x in mm)
  const N = 401, xs = linspace(0, Lend, N), My = xs.map(x => Mx(x, 'Fy', Ry1, Ry2)), Mz = xs.map(x => Mx(x, 'Fz', Rz1, Rz2)), Mr = xs.map((_, i) => Math.hypot(My[i], Mz[i]));
  const tLo = Math.min(...els.map(e => e.a)), tHi = Math.max(...els.map(e => e.a));
  const Tx = xs.map(x => els.length > 1 && x >= tLo && x <= tHi ? T : 0);
  // critical section: max resultant moment where torque is present (or overall max)
  let ic = 0; xs.forEach((x, i) => { const score = Mr[i] + (Tx[i] ? 1e-9 : 0); if (score > Mr[ic] + (Tx[ic] ? 1e-9 : 0)) ic = i; });
  const Mc = Mr[ic], Tc = Tx[ic] || (els.length > 1 ? T : 0);
  return { w, T, els, L, Lend, xs, My, Mz, Mr, Tx, Mc, Tc, xc: xs[ic], R: { Ry1, Ry2, Rz1, Rz2 } };
}
function shaftDeflect(sm, d, E) { // uniform diameter; returns deflection arrays (mm) in y,z and slopes
  const I = Math.PI * d ** 4 / 64, EI = E * I; // N·mm²
  const integ = (Ms) => { // Ms in N·m along xs (mm)
    const xs = sm.xs, n = xs.length, th = new Float64Array(n), y = new Float64Array(n);
    for (let i = 1; i < n; i++) { const dx = xs[i] - xs[i - 1]; th[i] = th[i - 1] + 0.5 * (Ms[i] + Ms[i - 1]) * 1000 / EI * dx; y[i] = y[i - 1] + 0.5 * (th[i] + th[i - 1]) * dx; }
    const iL = xs.findIndex(x => x >= sm.L - 1e-9), C = -y[iL] / sm.L;
    return { y: Array.from(y, (v, i) => v + C * xs[i]), th: Array.from(th, v => v + C) };
  };
  const a = integ(sm.My), b = integ(sm.Mz);
  const yt = a.y.map((v, i) => Math.hypot(v, b.y[i])), tt = a.th.map((v, i) => Math.hypot(v, b.th[i]));
  const iL = sm.xs.findIndex(x => x >= sm.L - 1e-9);
  const atEl = sm.els.map(e => { const i = sm.xs.findIndex(x => x >= e.a - 1e-9); return { y: yt[i], th: tt[i] }; });
  return { yt, tt, slopeB: Math.max(tt[0], tt[iL]), atEl, ymax: Math.max(...yt) };
}
function shaftCritical(sm, d, E, rho) { // Rayleigh: static gravity deflection of element masses + shaft self-weight
  const I = Math.PI * d ** 4 / 64, EI = E * I, n = 41, ml = rho * Math.PI * d * d / 4 * 1e-9; // kg/mm
  const pts = linspace(0, sm.Lend, n).map((x, i) => ({ a: x, m: ml * sm.Lend / (n - 1) * (i === 0 || i === n - 1 ? 0.5 : 1) })).concat(sm.els.map(e => ({ a: e.a, m: e.m })));
  const L = sm.L, W = pts.map(p => p.m * 9.81), sF = W.reduce((s, w) => s + w, 0), sM = pts.reduce((s, p, i) => s + W[i] * p.a, 0);
  const R2 = sM / L, R1 = sF - R2;
  const xs = sm.xs, Mg = xs.map(x => { let M = R1 * x + (x > L ? R2 * (x - L) : 0); pts.forEach((p, i) => { if (x > p.a) M -= W[i] * (x - p.a); }); return M; }); // N·mm
  const th = new Float64Array(xs.length), y = new Float64Array(xs.length);
  for (let i = 1; i < xs.length; i++) { const dx = xs[i] - xs[i - 1]; th[i] = th[i - 1] + 0.5 * (Mg[i] + Mg[i - 1]) / EI * dx; y[i] = y[i - 1] + 0.5 * (th[i] + th[i - 1]) * dx; }
  const iL = xs.findIndex(x => x >= L - 1e-9), C = -y[iL] / L;
  const yAt = a => { const i = Math.min(xs.length - 1, Math.max(1, xs.findIndex(x => x >= a))); const t = (a - xs[i - 1]) / ((xs[i] - xs[i - 1]) || 1); return (y[i - 1] + C * xs[i - 1]) * (1 - t) + (y[i] + C * xs[i]) * t; };
  const yy = pts.map(p => yAt(p.a));
  const num = pts.reduce((s, p, i) => s + p.m * Math.abs(yy[i]), 0), den = pts.reduce((s, p, i) => s + p.m * yy[i] * yy[i], 0);
  return Math.sqrt(9810 * num / den); // rad/s (g in mm/s²)
}
function shaftFatigue(sm, d, v, m) {
  const nt = NOTCHES[v.notch], r = Math.max(0.1, nt.rd * d);
  const q = notchQ(r, m.Sut), qs = notchQ(r, m.Sut, true), Kf = 1 + q * (nt.Kt - 1), Kfs = 1 + qs * (nt.Kts - 1);
  const ka = ka_(v.surf, m.Sut), kb = kb_(d), ke = RELIAB[ENV.rel], Se = ka * kb * ke * m.kenv * SePrime(m);
  const Ma = sm.Mc * 1000, Mm = 0, Tm = sm.Tc * 1000 * (1), Ta = sm.Tc * 1000 * v.tfl / 100; // N·mm
  const sa = Math.sqrt((32 * Kf * Ma / (Math.PI * d ** 3)) ** 2 + 3 * (16 * Kfs * Ta / (Math.PI * d ** 3)) ** 2);
  const sm_ = Math.sqrt((32 * Kf * Mm / (Math.PI * d ** 3)) ** 2 + 3 * (16 * Kfs * Tm / (Math.PI * d ** 3)) ** 2);
  const n = { Goodman: 1 / (sa / Se + sm_ / m.Sut), Soderberg: 1 / (sa / Se + sm_ / m.Sy), Gerber: (() => { const a = sa / Se, b = sm_ / m.Sut; return b > 1e-12 ? (-a + Math.sqrt(a * a + 4 * b * b)) / (2 * b * b) : 1 / a; })(), 'ASME elliptic': 1 / Math.sqrt((sa / Se) ** 2 + (sm_ / m.Sy) ** 2) };
  const ny = m.Sy / Math.sqrt((32 * Kf * (Ma + Mm) / (Math.PI * d ** 3)) ** 2 + 3 * (16 * Kfs * (Ta + Tm) / (Math.PI * d ** 3)) ** 2);
  return { Kf, Kfs, q, qs, ka, kb, ke, Se, sa, sm: sm_, n, ny };
}
MD.register('shaft', {
  group: 'Machine elements', title: 'Shaft designer', icon: '🛞', voice: 'shaft design transmission shaft',
  render(main) {
    pageHead(main, 'Machine elements · power transmission', 'Shaft designer',
      'A shaft must survive <b>fatigue</b> (bending reverses every revolution), must not <b>yield</b> on the first overload, must not <b>deflect</b> so much that gears mis-mesh, must keep <b>bearing slopes</b> within limits, and must run well below its <b>critical (whirling) speed</b>. Each criterion demands a minimum diameter: the largest one wins. Change speed, material or environment and watch the winner change.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const ET = ['Spur gear (20°)', 'Flat-belt pulley', 'V-belt pulley', 'None'];
    const specs = [
      { section: 'Duty' },
      { id: 'P', label: 'Power', unit: 'kW', value: 15, min: 0.5, max: 300, step: 0.5, aliases: ['power'] },
      { id: 'rpm', label: 'Speed', unit: 'rpm', value: 720, min: 50, max: 10000, step: 10, aliases: ['speed', 'rpm'] },
      { id: 'tfl', label: 'Torque fluctuation ±', unit: '%', value: 0, min: 0, max: 100, step: 1, aliases: ['torque fluctuation'] },
      { id: 'L', label: 'Bearing span L', unit: 'mm', value: 500, min: 100, max: 3000, step: 10, aliases: ['span', 'length'] },
      { section: 'Element 1 (input)' },
      { id: 'e1type', label: 'Type', type: 'select', options: ET, value: 'Flat-belt pulley' },
      { id: 'e1a', label: 'Position from left bearing', unit: 'mm', value: 120, min: 0, max: 3500, step: 5 },
      { id: 'e1D', label: 'Diameter', unit: 'mm', value: 300, min: 30, max: 1500, step: 5 },
      { id: 'e1ang', label: 'Belt pull angle from horizontal', unit: '°', value: 0, min: -90, max: 90, step: 5 },
      { id: 'e1m', label: 'Mass', unit: 'kg', value: 15, min: 0, max: 500, step: 1 },
      { section: 'Element 2 (output)' },
      { id: 'e2type', label: 'Type', type: 'select', options: ET, value: 'Spur gear (20°)' },
      { id: 'e2a', label: 'Position from left bearing', unit: 'mm', value: 380, min: 0, max: 3500, step: 5 },
      { id: 'e2D', label: 'Pitch diameter', unit: 'mm', value: 150, min: 20, max: 1500, step: 5 },
      { id: 'e2ang', label: 'Belt pull angle (pulleys)', unit: '°', value: 0, min: -90, max: 90, step: 5 },
      { id: 'e2m', label: 'Mass', unit: 'kg', value: 8, min: 0, max: 500, step: 1 },
      { section: 'Material, manufacture & limits' },
      { id: 'mat', label: 'Material', type: 'select', options: MAT_NAMES.filter(n => !/E250|E350|cast/.test(n)), value: 'AISI 1045 / C45 cold drawn', wide: true, aliases: ['material'] },
      { id: 'surf', label: 'Surface', type: 'select', options: Object.keys(SURFACES), value: 'Machined / cold drawn', aliases: ['surface'] },
      { id: 'notch', label: 'Notch at critical section', type: 'select', options: Object.keys(NOTCHES), value: 'End-mill keyseat (r/d = 0.02)', wide: true, aliases: ['notch', 'keyway'] },
      { id: 'nf', label: 'Design factor (fatigue & yield)', value: 1.5, min: 1, max: 4, step: 0.05, aliases: ['safety factor', 'design factor'] },
      { id: 'ylim', label: 'Allowable deflection at elements', unit: 'mm', value: 0.13, min: 0.01, max: 1, step: 0.01, aliases: ['deflection'] },
      { id: 'brg', label: 'Bearing type (slope limit)', type: 'select', options: Object.keys(BEARING_SLOPE), value: 'Deep-groove ball (0.001–0.003 rad)', wide: true },
      { id: 'cm', label: 'Critical speed margin (ωc / ω ≥)', value: 2, min: 1.1, max: 4, step: 0.1, aliases: ['margin'] },
    ];
    const out = h('div'), c1 = plotCanvas(), c2 = plotCanvas(), c3 = plotCanvas(), c4 = plotCanvas(), anim1 = plotCanvas('anim');
    anim1.style.height = '170px';
    R.append(h('div', { class: 'card' }, anim1, out), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2), h('div', { class: 'card' }, c3), h('div', { class: 'card' }, c4)));
    let V, SM, Dsel;
    function requiredDiameters(v, m) {
      const sm = shaftModel(v), lim = BEARING_SLOPE[v.brg];
      const solve = f => solveMin(f, 3, 600, 1e-3);
      const d = {};
      ['Goodman', 'Gerber', 'ASME elliptic', 'Soderberg'].forEach(c => d['Fatigue: ' + c] = solve(dd => shaftFatigue(sm, dd, v, m).n[c] - v.nf));
      d['First-cycle yield'] = solve(dd => shaftFatigue(sm, dd, v, m).ny - v.nf);
      d['Deflection at elements'] = solve(dd => v.ylim - Math.max(...shaftDeflect(sm, dd, m.E).atEl.map(a => a.y), 0));
      d['Slope at bearings'] = solve(dd => lim - shaftDeflect(sm, dd, m.E).slopeB);
      d['Gear slope < 0.0005 rad'] = sm.els.some(e => e.type.startsWith('Spur')) ? solve(dd => 0.0005 - Math.max(...shaftDeflect(sm, dd, m.E).atEl.filter((a, i) => sm.els[i].type.startsWith('Spur')).map(a => a.th))) : NaN;
      d['Critical speed'] = solve(dd => shaftCritical(sm, dd, m.E, m.rho) - v.cm * sm.w);
      return { sm, d };
    }
    function run(v) {
      V = v; const m = matAt(v.mat);
      const { sm, d } = requiredDiameters(v, m); SM = sm;
      const crit = ['Fatigue: Goodman', 'First-cycle yield', 'Deflection at elements', 'Slope at bearings', 'Gear slope < 0.0005 rad', 'Critical speed'];
      const govK = crit.filter(k => !isNaN(d[k])).reduce((a, b) => d[b] > d[a] ? b : a, 'Fatigue: Goodman');
      const dreq = d[govK];
      if (!isFinite(dreq)) { out.innerHTML = ''; out.append(h('div', { class: 'badbox', html: `<b>No solid shaft up to Ø600 mm satisfies "${govK}".</b> Shorten the span, move elements toward the bearings, reduce speed or relax the limit.` })); explain('No practical diameter satisfies ' + govK); SM = sm; Dsel = 600; return; }
      if (!sm.els.length) { out.innerHTML = '<div class="badbox">Add at least one gear or pulley.</div>'; return; }
      const dstd = STD_D.find(x => x >= dreq) || Math.ceil(dreq / 10) * 10; Dsel = dstd;
      const fa = shaftFatigue(sm, dstd, v, m), df = shaftDeflect(sm, dstd, m.E), wc = shaftCritical(sm, dstd, m.E, m.rho);
      out.innerHTML = '';
      out.append(h('div', { class: 'metrics' },
        metric('Torque T', fmt(sm.T), 'N·m'), metric('Critical section x', fmt(sm.xc), 'mm'), metric('M at critical section', fmt(sm.Mc), 'N·m'),
        metric('Required d (governing)', fmt(dreq), 'mm'), metric('Selected standard d', dstd, 'mm', 'good'),
        metric('Fatigue n (Goodman)', fmt(fa.n.Goodman), '', fsStatus(fa.n.Goodman, v.nf - 1e-6)), metric('Yield n', fmt(fa.ny), '', fsStatus(fa.ny, v.nf - 1e-6)),
        metric('Max deflection at element', fmt(Math.max(...df.atEl.map(a => a.y), 0)), 'mm'), metric('Bearing slope', fmt(df.slopeB), 'rad'),
        metric('1st critical speed', fmt(wc * 60 / 2 / Math.PI), 'rpm', wc / sm.w >= v.cm ? 'good' : 'bad')));
      const box = h('div', { style: { marginTop: '6px' } }); out.append(box);
      const gov = dominanceBars(box, crit.filter(k => isFinite(d[k])).map(k => ({ k, v: d[k] })), 'mm', 'Minimum diameter demanded by each failure mode');
      if (sm.els.length < 2) out.append(h('div', { class: 'note' }, 'Only one element: no torque is transmitted along the shaft (it acts as an axle carrying bending only).'));
      const reason = {
        'Fatigue: Goodman': 'Bending reverses every revolution. The notch and surface finish cut the endurance strength, so <b>strength (fatigue)</b> governs. Better material, a gentler fillet or a ground finish pay off directly.',
        'First-cycle yield': 'Peak (overload) stress governs. Higher yield strength helps directly.',
        'Deflection at elements': '<b>Stiffness</b> governs, not strength: a stronger steel will not help because E is the same for all steels. Shorten the span, move elements near bearings, or increase d.',
        'Slope at bearings': '<b>Bearing misalignment</b> governs (stiffness). Use self-aligning bearings or shorten the span.',
        'Gear slope < 0.0005 rad': '<b>Gear-mesh misalignment</b> governs: uneven face loading would pit the teeth. Move the gear toward a bearing.',
        'Critical speed': 'The shaft would <b>whirl</b> near its natural frequency. Mass and stiffness govern (ωc ∝ d for a bare shaft). Shorter span or a stiffer, lighter design.' }[govK];
      verdict(out, true, `Use d = ${dstd} mm: governed by ${govK.toLowerCase()}`, reason);
      out.append(h('div', { class: 'eq' }, `Se = ka·kb·ke·k_env·Se' = ${fmt(fa.ka, 3)}·${fmt(fa.kb, 3)}·${fa.ke}·${m.kenv}·${fmt(SePrime(m))} = ${fmt(fa.Se)} MPa   (T = ${ENV.T} °C → Sut = ${fmt(m.Sut)} MPa)
Kf = 1 + q(Kt−1) = ${fmt(fa.Kf, 3)} (q = ${fmt(fa.q, 2)}),  Kfs = ${fmt(fa.Kfs, 3)}
DE-Goodman: d = [16n/π · ( √(4(Kf·Ma)² + 3(Kfs·Ta)²)/Se + √(4(Kf·Mm)² + 3(Kfs·Tm)²)/Sut )]^(1/3)`));
      // iteration table (fixed point on Goodman)
      const tb = h('table', { class: 't' }, h('tr', null, ...['Iter', 'd assumed (mm)', 'kb', 'q', 'Kf', 'Se (MPa)', 'd computed (mm)'].map(x => h('th', null, x))));
      let di = 25; for (let i = 0; i < 6; i++) { const f = shaftFatigue(sm, di, v, m); const A = Math.sqrt(4 * (f.Kf * sm.Mc * 1000) ** 2 + 3 * (f.Kfs * sm.Tc * 1000 * v.tfl / 100) ** 2), B = Math.sqrt(3 * (f.Kfs * sm.Tc * 1000) ** 2); const dn = Math.cbrt(16 * v.nf / Math.PI * (A / f.Se + B / m.Sut)); tb.append(h('tr', { class: i === 5 ? 'hl' : '' }, ...[i + 1, fmt(di, 4), fmt(f.kb, 4), fmt(f.q, 3), fmt(f.Kf, 4), fmt(f.Se, 4), fmt(dn, 4)].map(x => h('td', null, String(x))))); di = dn; }
      out.append(h('details', null, h('summary', null, 'Why iterate? kb, q and Kf depend on the diameter being designed'), h('div', { class: 'tablewrap' }, tb)));
      envWarnings(m).forEach(w => out.append(h('div', { class: 'warnbox' }, '⚠ ' + w)));
      // plots
      plot(c1, { title: 'Bending moment diagrams', xlabel: 'x along shaft (mm)', ylabel: 'N·m', legend: 'tr', series: [{ label: 'Vertical plane', x: sm.xs, y: sm.My }, { label: 'Horizontal plane', x: sm.xs, y: sm.Mz }, { label: 'Resultant', x: sm.xs, y: sm.Mr, width: 2.6, color: '#1b2430' }, { label: 'Torque', x: sm.xs, y: sm.Tx, dash: [4, 3], color: '#2f7d32' }], vlines: [{ x: sm.xc, label: 'critical' }] });
      plot(c2, { title: `Deflection (d = ${dstd} mm)`, xlabel: 'x (mm)', ylabel: 'mm', series: [{ x: sm.xs, y: df.yt, color: '#7b3fa0', fill: true }], hlines: [{ y: v.ylim, label: 'limit' }] });
      // Goodman diagram
      const Se = fa.Se, sm0 = linspace(0, m.Sut, 60);
      plot(c3, { title: 'Fatigue diagram (von Mises σa vs σm)', xlabel: 'σm (MPa)', ylabel: 'σa (MPa)', xmin: 0, ymin: 0, xmax: m.Sut, ymax: Math.max(Se, m.Sy) * 1.05, legend: 'tr', series: [
        { label: 'Goodman', x: [0, m.Sut], y: [Se, 0] }, { label: 'Gerber', x: sm0, y: sm0.map(s => Se * (1 - (s / m.Sut) ** 2)) },
        { label: 'ASME elliptic', x: linspace(0, m.Sy, 60), y: linspace(0, m.Sy, 60).map(s => Se * Math.sqrt(Math.max(0, 1 - (s / m.Sy) ** 2))) },
        { label: 'Soderberg', x: [0, m.Sy], y: [Se, 0], dash: [5, 3] }, { label: 'Yield (Langer)', x: [0, m.Sy], y: [m.Sy, 0], dash: [2, 3], color: '#94a3b8' }],
        points: [{ x: fa.sm, y: fa.sa, label: 'operating' }] });
      // dominance vs speed at constant power
      const rpms = linspace(Math.max(50, v.rpm * 0.15), v.rpm * 4, 22), sw = rpms.map(n => requiredDiameters(Object.assign({}, v, { rpm: n }), m).d);
      plot(c4, { title: 'Same power, different speed: who governs?', xlabel: 'Speed (rpm)', ylabel: 'required d (mm)', legend: 'tr', vlines: [{ x: v.rpm }], series: [
        { label: 'Fatigue (Goodman)', x: rpms, y: sw.map(q => q['Fatigue: Goodman']) }, { label: 'Deflection', x: rpms, y: sw.map(q => q['Deflection at elements']) },
        { label: 'Bearing slope', x: rpms, y: sw.map(q => q['Slope at bearings']) }, { label: 'Critical speed', x: rpms, y: sw.map(q => q['Critical speed']), width: 2.5 }] });
      effectTable(out, vv => { const m2 = matAt(vv.mat), s2 = shaftModel(vv), f2 = shaftFatigue(s2, dstd, vv, m2), d2 = shaftDeflect(s2, dstd, m2.E); return { 'Fatigue FS': f2.n.Goodman, 'Deflection at gear': Math.max(...d2.atEl.map(a => a.y), 0), 'Critical speed': shaftCritical(s2, dstd, m2.E, m2.rho) }; }, v, specs, { key: 'shaft', note: `Shaft held at Ø${dstd} mm. Notice that span L changes deflection far more than anything else (∝ L³).` });
      explain(`Select a ${dstd} millimetre shaft. It is governed by ${govK}. The Goodman fatigue safety factor is ${fmt(fa.n.Goodman)}, and the first critical speed is ${fmt(wc * 60 / 2 / Math.PI)} rpm against ${v.rpm} operating.`);
    }
    const f = buildForm(L, specs, run, 'shaft'); run(f.vals);
    MD.onEnv = () => run(V);
    let ang = 0;
    anim(() => {
      if (!SM) return; const { ctx, w, h: H } = setupCanvas(anim1); ctx.clearRect(0, 0, w, H);
      ang += 0.04 * Math.min(3, V.rpm / 500);
      const sx = (w - 60) / SM.Lend, x0 = 30, cy = H / 2, rs = Math.min(18, Math.max(5, Dsel * sx * 0.5));
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x0, cy - rs, SM.Lend * sx, 2 * rs);
      for (let k = 0; k < 10; k++) { const xx = x0 + ((k * SM.Lend / 10 + ang * 20) % SM.Lend) * sx; ctx.fillStyle = '#94a3b8'; ctx.fillRect(xx, cy - rs, 2, 2 * rs); }
      [0, SM.L].forEach(x => { ctx.fillStyle = '#1b2430'; ctx.fillRect(x0 + x * sx - 7, cy + rs, 14, 16); ctx.fillRect(x0 + x * sx - 7, cy - rs - 16, 14, 16); });
      SM.els.forEach(e => { const hgt = Math.min(H * 0.42, Math.max(20, e.D * sx * 0.5)); ctx.fillStyle = e.type.startsWith('Spur') ? '#c2410c' : '#0f5e8c'; ctx.globalAlpha = 0.85; ctx.fillRect(x0 + e.a * sx - 9, cy - hgt, 18, 2 * hgt); ctx.globalAlpha = 1;
        if (e.type.startsWith('Spur')) for (let k = -3; k <= 3; k++) { ctx.fillStyle = '#7c2d12'; ctx.fillRect(x0 + e.a * sx - 9, cy + hgt * Math.sin(ang * 2 + k * 0.45) * 0.95, 18, 3); } });
      ctx.strokeStyle = '#b42318'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x0 + SM.xc * sx, 6); ctx.lineTo(x0 + SM.xc * sx, H - 6); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, 'Bearing A', x0, cy + rs + 26, '#1b2430', 'center', 11); tag(ctx, 'Bearing B', x0 + SM.L * sx, cy + rs + 26, '#1b2430', 'center', 11);
      SM.els.forEach((e, i) => tag(ctx, `${i ? 'Output' : 'Input'}: ${e.type.split(' (')[0]}`, x0 + e.a * sx, H - 10, e.type.startsWith('Spur') ? '#c2410c' : '#0f5e8c', 'center', 11));
      ctx.fillStyle = '#1b2430'; ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillText(`Ø${Dsel} mm shaft · bearings (black) · critical section (red)`, 8, 14);
    });
  }
});
