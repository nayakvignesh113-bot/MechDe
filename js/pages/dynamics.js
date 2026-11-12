'use strict';
/* Shared engine model (single-cylinder 4-stroke slider-crank), used by Dynamics and Design Chain */
function engineModel(v) {
  // v: D (mm bore), S (mm stroke), l (mm rod c-c), rpm, pmax (MPa), CR, mrec (kg), ncyl
  const r = v.S / 2 / 1000, l = v.l / 1000, n = l / r, Ap = Math.PI * (v.D / 1000) ** 2 / 4, w = v.rpm * 2 * Math.PI / 60;
  const Vs = Ap * v.S / 1000, Vc = Vs / (v.CR - 1), patm = 0.1013;
  const N = 721, th = linspace(0, 720, N);
  const kin = t => { const s = Math.sin(t), c = Math.cos(t), q = Math.sqrt(n * n - s * s); return { x: r * (1 - c) + l - Math.sqrt(l * l - (r * s) ** 2), v: r * w * (s + s * c / q), a: r * w * w * (c + (n * n * Math.cos(2 * t) + s ** 4) / q ** 3), phi: Math.asin(s / n) }; };
  const pgas = t => { // MPa absolute, t in degrees 0..720 from TDC firing
    const V = Vc + Ap * kin(t * deg).x;
    if (t <= 180) return Math.max(patm, v.pmax * Math.min(1, Math.pow(1.7 * Vc / V, 1.3))); // dual-combustion: pmax held to cut-off 1.7·Vc
    if (t <= 360) return 0.11;
    if (t <= 540) return 0.09;
    return 0.095 * Math.pow((Vc + Vs) / V, 1.3);
  };
  const one = th.map(t => {
    const k = kin(t * deg), Fg = (pgas(t) - patm) * 1e6 * Ap, Fi = -v.mrec * k.a, Fp = Fg + Fi;
    const Frod = Fp / Math.cos(k.phi), Fside = Fp * Math.tan(k.phi);
    const s = Math.sin(t * deg), T = Fp * r * (s + Math.sin(2 * t * deg) / (2 * Math.sqrt(n * n - s * s)));
    return { t, x: k.x, vel: k.v, a: k.a, p: pgas(t), Fg, Fi, Fp, Frod, Fside, T };
  });
  // multi-cylinder: equal firing intervals 720/ncyl
  const nc = v.ncyl || 1, Ttot = th.map((t, i) => { let s = 0; for (let c = 0; c < nc; c++) { const sh = Math.round(c * (N - 1) / nc); s += one[(i - sh + (N - 1)) % (N - 1)].T; } return s; });
  const Tm = Ttot.slice(0, N - 1).reduce((a, b) => a + b, 0) / (N - 1);
  let E = 0, Emax = -Infinity, Emin = Infinity; const Es = [];
  for (let i = 0; i < N; i++) { if (i) E += 0.5 * ((Ttot[i] - Tm) + (Ttot[i - 1] - Tm)) * (720 / (N - 1)) * deg; Es.push(E); Emax = Math.max(Emax, E); Emin = Math.min(Emin, E); }
  return { th, one, Ttot, Tm, P: Tm * w, dE: Emax - Emin, Es, w, r, l, n, Ap, Vs, Vc };
}
const engineSpecs = () => [
  { section: 'Engine geometry & operation' },
  { id: 'D', label: 'Bore D', unit: 'mm', value: 100, min: 40, max: 250, step: 1, aliases: ['bore'] },
  { id: 'S', label: 'Stroke S', unit: 'mm', value: 120, min: 40, max: 300, step: 1, aliases: ['stroke'] },
  { id: 'l', label: 'Connecting rod length l', unit: 'mm', value: 240, min: 80, max: 800, step: 1, aliases: ['rod length', 'connecting rod length'] },
  { id: 'rpm', label: 'Speed', unit: 'rpm', value: 2000, min: 300, max: 6000, step: 50, aliases: ['speed', 'rpm'] },
  { id: 'pmax', label: 'Peak gas pressure', unit: 'MPa', value: 6, min: 1, max: 15, step: 0.1, aliases: ['pressure', 'gas pressure'] },
  { id: 'CR', label: 'Compression ratio', value: 16, min: 6, max: 22, step: 0.5, aliases: ['compression ratio'] },
  { id: 'mrec', label: 'Reciprocating mass (piston + ⅓ rod)', unit: 'kg', value: 1.8, min: 0.2, max: 10, step: 0.05, aliases: ['reciprocating mass', 'mass'] },
  { id: 'ncyl', label: 'Cylinders (equal firing)', type: 'select', options: ['1', '2', '3', '4', '6'], value: '1', aliases: ['cylinders'] },
];

MD.register('dynamics', {
  group: 'Foundations', title: 'Dynamics lab', icon: '〰', voice: 'dynamics flywheel balancing vibration isolation',
  render(main) {
    pageHead(main, 'Dynamics of machinery', 'Forces from motion',
      'Dynamics converts the kinematic accelerations into <b>forces and torques</b>: inertia forces that load bearings, torque fluctuation that a flywheel must smooth, unbalance that shakes the frame, and vibration that can resonate. These forces are what strength of materials and design must then carry.');
    const body = h('div');
    tabs(main, ['Turning moment & flywheel', 'Balancing rotating masses', 'Vibration isolation'], i => { if (MD.cleanup) { MD.cleanup(); MD.cleanup = null; } body.innerHTML = ''; [flywheel, balancing, isolation][i](body); });
    main.append(body);
  }
});

function flywheel(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  const specs = engineSpecs().concat([
    { section: 'Flywheel' },
    { id: 'Cs', label: 'Coefficient of speed fluctuation Cs', value: 0.02, min: 0.002, max: 0.2, step: 0.001, aliases: ['speed fluctuation'], tip: 'Pumps 0.03–0.05, machine tools 0.03, generators 0.002–0.005, IC engines 0.01–0.03' },
    { id: 'vrim', label: 'Allowable rim speed', unit: 'm/s', value: 30, min: 10, max: 100, step: 1, tip: 'Cast iron ≈ 25–30 m/s, steel ≈ 40–50 m/s', aliases: ['rim speed'] },
    { id: 'fmat', label: 'Flywheel material', type: 'select', options: ['Grey cast iron FG 260', 'IS 2062 E250 structural steel', 'AISI 1045 / C45 cold drawn'], value: 'Grey cast iron FG 260' },
  ]);
  const c1 = plotCanvas(), c2 = plotCanvas(), out = h('div');
  R.append(h('div', { class: 'card' }, c1, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c2));
  function run(v) {
    v = Object.assign({}, v, { ncyl: +v.ncyl });
    const e = engineModel(v), m = matAt(v.fmat);
    const I = e.dE / (e.w * e.w * v.Cs), R0 = v.vrim / e.w, mrim = 0.9 * I / (R0 * R0), Arim = mrim / (2 * Math.PI * R0 * m.rho);
    const sigHoop = m.rho * v.vrim ** 2 / 1e6;
    plot(c1, { title: `Turning-moment diagram (${v.ncyl} cyl.)`, xlabel: 'Crank angle (°)', ylabel: 'Torque (N·m)', hlines: [{ y: e.Tm, label: `mean ${fmt(e.Tm)} N·m`, color: '#2f7d32' }], series: [{ label: 'Total T(θ)', x: e.th, y: e.Ttot }, { label: 'Inertia-only part (1 cyl.)', x: e.th, y: e.one.map(o => o.Fi * e.r * (Math.sin(o.t * deg) + Math.sin(2 * o.t * deg) / (2 * Math.sqrt(e.n ** 2 - Math.sin(o.t * deg) ** 2)))), dash: [4, 3], color: '#94a3b8' }] });
    // flywheel inertia required vs number of cylinders (dominance)
    const cyls = [1, 2, 3, 4, 6], Is = cyls.map(c => engineModel(Object.assign({}, v, { ncyl: c })).dE / (e.w * e.w * v.Cs));
    const rpms = linspace(600, 6000, 40);
    plot(c2, { title: 'Required flywheel inertia vs speed (inertia torque grows with ω²)', xlabel: 'rpm', ylabel: 'I (kg·m²)', logy: true, series: cyls.map((c, k) => ({ label: c + ' cyl', x: rpms, y: rpms.map(n => { const ee = engineModel(Object.assign({}, v, { ncyl: c, rpm: n })); return ee.dE / (ee.w * ee.w * v.Cs); }) })), vlines: [{ x: v.rpm }], legend: 'tr' });
    out.innerHTML = '';
    out.append(h('div', { class: 'metrics' },
      metric('Mean torque', fmt(e.Tm), 'N·m'), metric('Indicated power', fmt(e.P / 1000), 'kW'),
      metric('Max fluctuation of energy ΔE', fmt(e.dE), 'J'), metric('Flywheel inertia I = ΔE/(ω²Cs)', fmt(I), 'kg·m²'),
      metric('Rim radius (from rim speed)', fmt(R0 * 1000), 'mm'), metric('Rim mass', fmt(mrim), 'kg'),
      metric('Rim cross-section', fmt(Arim * 1e6), 'mm²'), metric('Hoop stress ρv²', fmt(sigHoop), 'MPa', fsStatus(m.Sut / sigHoop, 8))));
    out.append(h('div', { class: 'note', html: `<b>What dominates?</b> At ${v.rpm} rpm the reciprocating inertia torque (grey) ${Math.max(...e.one.map(o => Math.abs(o.Fi))) > Math.max(...e.one.map(o => Math.abs(o.Fg))) * 0.5 ? 'is comparable to the gas torque, so speed raises it as ω²' : 'is small next to gas torque'}. Going from 1 to 4 cylinders cuts the required inertia ${fmt(Is[0] / Is[3], 2)}×: firing overlap fills the torque valleys. That is why single-cylinder engines carry heavy flywheels. Rim speed, not inertia, limits size: hoop stress σ = ρv² is independent of thickness.` }));
    explain(`Mean torque ${fmt(e.Tm)} newton metres, power ${fmt(e.P / 1000)} kilowatts. Energy fluctuation ${fmt(e.dE)} joules needs a flywheel inertia of ${fmt(I)} kilogram metre squared, about ${fmt(mrim)} kilograms of rim at ${fmt(R0 * 1000)} millimetre radius.`);
  }
  const f = buildForm(L, specs, run, 'flywheel'); run(f.vals);
}

function balancing(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  const specs = [{ id: 'rpm', label: 'Rotor speed', unit: 'rpm', value: 1500, min: 100, max: 10000, step: 50, aliases: ['speed'] }, { id: 'rb', label: 'Balancing mass radius', unit: 'mm', value: 100, min: 10, max: 500, step: 5 }];
  const data = [[2, 120, 0], [1.5, 100, 70], [3, 80, 160], [1, 150, 260]];
  data.forEach((d, i) => specs.push({ section: 'Mass ' + (i + 1) }, { id: 'm' + i, label: 'm' + (i + 1), unit: 'kg', value: d[0], min: 0, max: 20, step: 0.1 }, { id: 'r' + i, label: 'radius', unit: 'mm', value: d[1], min: 0, max: 500, step: 5 }, { id: 'a' + i, label: 'angle', unit: '°', value: d[2], min: 0, max: 360, step: 1 }));
  const cv = plotCanvas('anim'), out = h('div');
  R.append(h('div', { class: 'card' }, cv, out));
  let V, U = null;
  function run(v) {
    V = v; let ux = 0, uy = 0;
    for (let i = 0; i < 4; i++) { ux += v['m' + i] * v['r' + i] * Math.cos(v['a' + i] * deg); uy += v['m' + i] * v['r' + i] * Math.sin(v['a' + i] * deg); }
    const U0 = Math.hypot(ux, uy), ang = Math.atan2(uy, ux) / deg, w = v.rpm * 2 * Math.PI / 60;
    const F = U0 / 1000 * w * w / 1000; // kg·mm → kg·m, N → kN
    const mb = U0 / v.rb, ab = (ang + 180 + 360) % 360;
    U = { ux, uy, U0, mb, ab };
    out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Resultant unbalance Σmr', fmt(U0), 'kg·mm'), metric('Shaking force at speed', fmt(F), 'kN', F < 0.1 ? 'good' : F < 1 ? 'warn' : 'bad'),
      metric('Balancing mass', fmt(mb), 'kg'), metric('…placed at angle', fmt(ab), '°')));
    out.append(h('div', { class: 'note', html: `Unbalance force grows with <b>ω²</b>: double the speed and the bearing load from the same ${fmt(U0)} kg·mm quadruples. In the polygon, the m·r vectors (blue) are added head-to-tail; the orange closing vector is the balancing mass. Masses in <i>different planes</i> also need couple balance: two balancing planes (dynamic balancing), as for crankshafts and turbine rotors.` }));
    explain(`Resultant unbalance is ${fmt(U0)} kilogram millimetres, giving a shaking force of ${fmt(F)} kilonewtons at ${v.rpm} rpm. Add ${fmt(mb)} kilograms at ${fmt(ab)} degrees.`);
  }
  const f = buildForm(L, specs, run, 'balance'); run(f.vals);
  let t = 0;
  anim(dt => {
    if (!U) return; const v = V; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    t += 0.03; const cx = w * 0.27, cy = H / 2, Rr = Math.min(w * 0.22, H * 0.4), rmax = Math.max(v.rb, ...[0, 1, 2, 3].map(i => v['r' + i])) || 1;
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, 7); ctx.stroke();
    const draw = (m, r, a, col) => { const A = (a * deg) + t, x = cx + Rr * r / rmax * Math.cos(A), y = cy - Rr * r / rmax * Math.sin(A); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4 + 3 * Math.sqrt(m), 0, 7); ctx.fill(); };
    for (let i = 0; i < 4; i++) if (v['m' + i] > 0) draw(v['m' + i], v['r' + i], v['a' + i], '#0f5e8c');
    draw(U.mb, v.rb, U.ab, '#c2410c');
    // vector polygon
    const px0 = w * 0.62, py0 = H * 0.5; let sx = 0, sy = 0; const pts = [[0, 0]];
    for (let i = 0; i < 4; i++) { sx += v['m' + i] * v['r' + i] * Math.cos(v['a' + i] * deg); sy += v['m' + i] * v['r' + i] * Math.sin(v['a' + i] * deg); pts.push([sx, sy]); }
    const ex = Math.max(...pts.map(p => Math.abs(p[0]))), ey = Math.max(...pts.map(p => Math.abs(p[1]))), sc = Math.min(w * 0.17 / (ex || 1), H * 0.4 / (ey || 1));
    ctx.lineWidth = 2;
    for (let i = 1; i < pts.length; i++) { ctx.strokeStyle = '#0f5e8c'; ctx.beginPath(); ctx.moveTo(px0 + pts[i - 1][0] * sc, py0 - pts[i - 1][1] * sc); ctx.lineTo(px0 + pts[i][0] * sc, py0 - pts[i][1] * sc); ctx.stroke(); }
    ctx.strokeStyle = '#c2410c'; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(px0 + sx * sc, py0 - sy * sc); ctx.lineTo(px0, py0); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#4a5566'; ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillText('m·r vector polygon (closing vector = balance)', w * 0.52, 18);
  });
}

function isolation(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  const specs = [
    { id: 'm', label: 'Machine mass', unit: 'kg', value: 400, min: 10, max: 5000, step: 10, aliases: ['mass'] },
    { id: 'rpm', label: 'Operating speed', unit: 'rpm', value: 1450, min: 100, max: 6000, step: 10, aliases: ['speed'] },
    { id: 'me', label: 'Rotating unbalance m·e', unit: 'kg·mm', value: 50, min: 0, max: 1000, step: 1, aliases: ['unbalance'] },
    { id: 'k', label: 'Total isolator stiffness', unit: 'kN/m', value: 900, min: 10, max: 50000, step: 10, aliases: ['stiffness'] },
    { id: 'z', label: 'Damping ratio ζ', value: 0.05, min: 0.005, max: 0.7, step: 0.005, aliases: ['damping'] },
    { id: 'TRt', label: 'Target transmissibility', value: 0.1, min: 0.02, max: 0.9, step: 0.01, aliases: ['target'] },
  ];
  const c1 = plotCanvas(), out = h('div'); c1.style.height = '320px';
  R.append(h('div', { class: 'card' }, c1, out));
  function run(v) {
    const w = v.rpm * 2 * Math.PI / 60, wn = Math.sqrt(v.k * 1000 / v.m), r = w / wn, z = v.z;
    const TR = (r, z) => Math.sqrt((1 + (2 * z * r) ** 2) / ((1 - r * r) ** 2 + (2 * z * r) ** 2));
    const F0 = v.me / 1000 * w * w, X = F0 / (v.k * 1000) / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2);
    const Xres = (v.me / 1000 / v.m) / (2 * z); // amplitude passing resonance ≈ (m·e/M)/(2ζ)
    const rs = linspace(0.05, 5, 300);
    plot(c1, { title: 'Force transmissibility', xlabel: 'Frequency ratio r = ω/ωn', ylabel: 'TR', logy: true, ymin: 0.01, ymax: 20, legend: 'tr',
      series: [0.02, 0.1, 0.3, 0.7].map(zz => ({ label: 'ζ = ' + zz, x: rs, y: rs.map(x => TR(x, zz)) })).concat([{ label: 'your ζ', x: rs, y: rs.map(x => TR(x, z)), color: '#1b2430', width: 2.5 }]),
      vlines: [{ x: Math.SQRT2, label: '√2', color: '#94a3b8' }], hlines: [{ y: v.TRt, label: 'target', color: '#2f7d32' }], points: [{ x: Math.min(r, 5), y: clamp(TR(r, z), 0.011, 19), label: 'operating' }] });
    const rReq = Math.sqrt(1 + 1 / v.TRt), kReq = v.m * (w / rReq) ** 2 / 1000, dst = v.m * 9.81 / (v.k * 1000) * 1000;
    const tr = TR(r, z);
    out.innerHTML = '';
    out.append(h('div', { class: 'metrics' },
      metric('Natural frequency fn', fmt(wn / 2 / Math.PI), 'Hz'), metric('Forcing frequency', fmt(v.rpm / 60), 'Hz'),
      metric('Frequency ratio r', fmt(r), '', r > 1.41 ? 'good' : r > 0.8 ? 'bad' : 'warn'), metric('Transmissibility', fmt(tr), '', tr <= v.TRt ? 'good' : tr < 1 ? 'warn' : 'bad'),
      metric('Force to foundation', fmt(tr * F0), 'N'), metric('Machine amplitude', fmt(X * 1000), 'mm'),
      metric('Static deflection', fmt(dst), 'mm'), metric('Stiffness for target TR (ζ≈0)', fmt(kReq), 'kN/m'),
      metric('Amplitude while passing resonance', fmt(Xres * 1000), 'mm', Xres * 1000 < 2 ? 'good' : 'warn')));
    out.append(h('div', { class: 'note', html: `<b>The design conflict:</b> isolation needs r > √2, i.e. a <i>soft</i> mount. But a soft mount passes through resonance on every start-up and stop, where amplitude is (me/M)/(2ζ). Damping tames that peak, but above r = √2 every extra ζ makes isolation <i>worse</i> (curves cross). Light damping + fast run-up is the usual compromise. ${r > 0.8 && r < 1.25 ? '<b style="color:var(--bad)">You are operating near resonance.</b>' : ''}` }));
    explain(`Natural frequency ${fmt(wn / 2 / Math.PI)} hertz against forcing at ${fmt(v.rpm / 60)} hertz gives frequency ratio ${fmt(r)} and transmissibility ${fmt(tr)}. For transmissibility ${v.TRt}, use stiffness around ${fmt(kReq)} kilonewtons per metre.`);
  }
  const f = buildForm(L, specs, run, 'isol'); run(f.vals);
}
