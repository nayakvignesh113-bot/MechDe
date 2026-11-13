'use strict';
const SP2 = {
  leaf(v) { // semi-elliptic: span 2L, central load 2P → each half a cantilever with end load P = W/2; nf full-length + ng graduated leaves, pre-stressed (nipping) so stresses equalise
    const P = v.W * 1000 / 2, L = (v.span - v.band) / 2, n = v.nf + v.ng, E = 207e3;
    const sigma = 6 * P * L / (n * v.b * v.t * v.t), delta = 12 * P * L ** 3 / (E * v.b * v.t ** 3 * (2 * v.nf + 3 * v.ng));
    const m = matAt(v.mat), nS = m.Sy / sigma, k = 2 * P / delta; // N/mm for whole spring
    const fn = Math.sqrt(k * 1000 / (v.sprung)) / (2 * Math.PI); // ride frequency with sprung mass on this spring
    return { P, L, n, sigma, delta, nS, k, fn };
  },
  torsion(v) { // helical torsion spring
    const C = v.D / v.d, Ki = (4 * C * C - C - 1) / (4 * C * (C - 1)), M = v.M * 1000;
    const sigma = Ki * 32 * M / (Math.PI * v.d ** 3), Sut = WIRES[v.mat].A / Math.pow(v.d, WIRES[v.mat].m), Sy = 0.78 * Sut;
    const Na = v.Nb + (v.l1 + v.l2) / (3 * Math.PI * v.D), E = 196.5e3; // E for spring steel
    const kr = E * v.d ** 4 / (64 * v.D * Na); // N·mm/rad
    const theta = M / kr / deg, Dnew = v.D * v.Nb / (v.Nb + theta / 360); // coil tightens on winding
    return { C, Ki, sigma, Sut, Sy, nS: Sy / sigma, Na, kr: kr / 1000, theta, Dnew, clearance: Dnew - v.d - v.pin };
  },
  bar(v) { // solid torsion bar (vehicle suspension)
    const G = 79.3e3, T = v.F * v.arm, tau = 16 * T / (Math.PI * v.d ** 3), J = Math.PI * v.d ** 4 / 32, kt = G * J / v.L; // N·mm/rad
    const th = T / kt, wheel = v.arm * th, kw = v.F / wheel, m = matAt(v.mat), nS = 0.577 * m.Sy / tau;
    return { T, tau, kt, th: th / deg, wheel, kw, nS };
  },
};
MD.register('springsplus', {
  group: 'Machine elements', title: 'Leaf & torsion springs', icon: '〽️', voice: 'leaf spring torsion spring torsion bar suspension',
  kid: { what: 'Springs that <b>bend</b> (leaf springs in lorries) or <b>twist</b> (clothes-peg springs, car torsion bars).', steps: ['Pick a tab.', 'Enter the load.', 'Read the stress, how much it moves, and the bounce frequency.'], try: 'Leaf tab: change 1 full-length + 7 graduated leaves into 8 full-length: the spring gets stiffer, but stresses stay the same.' },
  eq: [
    { t: 'Leaf spring (equalised by nipping)', f: 'σ = 6·P·L / (n·b·t²),   δ = 12·P·L³ / (E·b·t³·(2nf + 3ng))', s: [['P', 'load at each eye = W/2'], ['L', 'half-span minus half the centre band'], ['nf, ng', 'full-length and graduated leaves']], fx: [['thicker leaves', 'stress ∝ 1/t², deflection ∝ 1/t³: stiffer, harsher ride'], ['more leaves', 'stronger and stiffer together']] },
    { t: 'Ride (bounce) frequency', f: 'f = (1/2π)·√(k / m_sprung)', m: 'Comfortable cars ≈ 1–1.5 Hz, loaded trucks ≈ 2 Hz.', fx: [['softer spring', 'lower f, more comfort, more sag']] },
    { t: 'Helical torsion spring', f: 'σ = Ki·32·M / (π·d³),   k = E·d⁴ / (64·D·Na),   Ki = (4C² − C − 1) / (4C(C − 1))', m: 'The wire of a torsion spring is in bending (not torsion!).', fx: [['wind it up', 'the coil diameter shrinks: it can grip its own guide pin']] },
    { t: 'Torsion bar', f: 'τ = 16·T / (π·d³),   k = G·J / L', fx: [['longer bar', 'softer, same stress at a given torque'], ['double d', 'k × 16']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · energy storage', 'Leaf springs, torsion springs and torsion bars',
      'Not every spring is a coil in torsion. <b>Leaf springs</b> are stacks of bending beams: they carry an axle, locate it and damp by inter-leaf friction. <b>Helical torsion springs</b> (clothes pegs, hinges, garage doors) are wire in <i>bending</i>. <b>Torsion bars</b> (tank and car suspensions) are straight shafts twisted by a lever arm.');
    const body = h('div');
    tabs(main, ['Leaf spring', 'Helical torsion spring', 'Torsion bar'], i => { body.innerHTML = ''; [leafTab, tsTab, barTab][i](body); });
    main.append(body);
  }
});
function sp2Lay(body) { const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g); const out = h('div'); R.append(h('div', { class: 'card' }, out)); return [L, R, out]; }
function leafTab(body) {
  const [L, R, out] = sp2Lay(body);
  const specs = [{ id: 'W', label: 'Load at centre', unit: 'kN', value: 20, min: 1, max: 200, step: 0.5, aliases: ['load'] }, { id: 'span', label: 'Span between eyes', unit: 'mm', value: 1000, min: 300, max: 2000, step: 10 },
    { id: 'band', label: 'Centre clamp (band) width', unit: 'mm', value: 80, min: 0, max: 200, step: 5 }, { id: 'nf', label: 'Full-length leaves', value: 2, min: 1, max: 6, step: 1 }, { id: 'ng', label: 'Graduated leaves', value: 6, min: 0, max: 15, step: 1 },
    { id: 'b', label: 'Leaf width', unit: 'mm', value: 60, min: 25, max: 120, step: 1 }, { id: 't', label: 'Leaf thickness', unit: 'mm', value: 9, min: 4, max: 20, step: 0.5 },
    { id: 'mat', label: 'Spring steel', type: 'select', options: ['AISI 4140 Q&T 425 °C', 'AISI 4340 / EN24 Q&T 650 °C'], value: 'AISI 4140 Q&T 425 °C', wide: true }, { id: 'sprung', label: 'Sprung mass on this spring', unit: 'kg', value: 2000, min: 100, max: 10000, step: 50 }];
  function run(v) {
    const r = SP2.leaf(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Bending stress', fmt(r.sigma), 'MPa'), metric('Safety factor (yield)', fmt(r.nS), '', fsStatus(r.nS, 1.5)), metric('Deflection at centre', fmt(r.delta), 'mm'), metric('Spring rate', fmt(r.k), 'N/mm'), metric('Ride frequency', fmt(r.fn), 'Hz', r.fn < 2.2 ? 'good' : 'warn')));
    verdict(out, r.nS >= 1.5, `${r.n} leaves of ${v.b} × ${v.t} mm`, 'Graduated leaves make the stack a beam of (nearly) uniform strength, like the tapered spanner handle. Pre-bending ("nipping") the full-length leaves equalises the stress between them. Leaf springs are heavy but also locate the axle, so no extra links are needed: ideal for trucks.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = SP2.leaf(vv); return { 'Stress': q.sigma, 'Deflection': q.delta, 'Ride frequency': q.fn }; }, v, specs);
    explain(`Leaf spring stress ${fmt(r.sigma)} megapascals, deflection ${fmt(r.delta)} millimetres, ride frequency ${fmt(r.fn)} hertz.`);
  }
  const f = buildForm(L, specs, run, 'leaf'); run(f.vals);
}
function tsTab(body) {
  const [L, R, out] = sp2Lay(body);
  const specs = [{ id: 'M', label: 'Moment applied', unit: 'N·m', value: 2, min: 0.05, max: 50, step: 0.05, aliases: ['moment'] }, { id: 'd', label: 'Wire diameter', unit: 'mm', value: 3, min: 0.5, max: 12, step: 0.1 },
    { id: 'D', label: 'Mean coil diameter', unit: 'mm', value: 24, min: 4, max: 120, step: 0.5 }, { id: 'Nb', label: 'Body turns', value: 6, min: 1, max: 30, step: 0.25 },
    { id: 'l1', label: 'Leg 1 length', unit: 'mm', value: 40, min: 0, max: 200, step: 1 }, { id: 'l2', label: 'Leg 2 length', unit: 'mm', value: 40, min: 0, max: 200, step: 1 },
    { id: 'pin', label: 'Guide pin diameter', unit: 'mm', value: 16, min: 1, max: 100, step: 0.5 }, { id: 'mat', label: 'Wire', type: 'select', options: Object.keys(WIRES), value: 'Music wire ASTM A228', wide: true }];
  function run(v) {
    const r = SP2.torsion(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Spring index C', fmt(r.C), ''), metric('Curvature factor Ki', fmt(r.Ki, 3), ''), metric('Bending stress', fmt(r.sigma), 'MPa'), metric('Allowable 0.78·Sut', fmt(r.Sy), 'MPa'),
      metric('Safety factor', fmt(r.nS), '', fsStatus(r.nS, 1.2)), metric('Angular rate', fmt(r.kr), 'N·m/rad'), metric('Wind-up angle', fmt(r.theta), '°'), metric('Clearance to pin when wound', fmt(r.clearance), 'mm', r.clearance > 0.1 * v.D ? 'good' : r.clearance > 0 ? 'warn' : 'bad')));
    verdict(out, r.nS >= 1.2 && r.clearance > 0, `Winds ${fmt(r.theta)}° under ${v.M} N·m`, `${r.clearance <= 0 ? 'The coil tightens onto the guide pin and binds: use a smaller pin. ' : ''}Load it so it winds up (closes), not unwinds. The residual stresses from coiling then help instead of hurt.`);
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = SP2.torsion(vv); return { 'Stress': q.sigma, 'Rate': q.kr }; }, v, specs);
    explain(`Torsion spring stress ${fmt(r.sigma)} megapascals, rate ${fmt(r.kr)} newton metres per radian.`);
  }
  const f = buildForm(L, specs, run, 'torsionspring'); run(f.vals);
}
function barTab(body) {
  const [L, R, out] = sp2Lay(body);
  const specs = [{ id: 'F', label: 'Wheel load on the arm', unit: 'N', value: 4000, min: 100, max: 50000, step: 50, aliases: ['load'] }, { id: 'arm', label: 'Lever arm length', unit: 'mm', value: 350, min: 50, max: 800, step: 5 },
    { id: 'd', label: 'Bar diameter', unit: 'mm', value: 28, min: 8, max: 80, step: 0.5 }, { id: 'L', label: 'Bar length', unit: 'mm', value: 1200, min: 200, max: 2500, step: 10 },
    { id: 'mat', label: 'Material', type: 'select', options: ['AISI 4140 Q&T 425 °C', 'AISI 4340 / EN24 Q&T 650 °C', 'AISI 1045 / C45 cold drawn'], value: 'AISI 4140 Q&T 425 °C', wide: true }];
  function run(v) {
    const r = SP2.bar(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Torque', fmt(r.T / 1000), 'N·m'), metric('Shear stress', fmt(r.tau), 'MPa'), metric('Safety factor (0.577·Sy)', fmt(r.nS), '', fsStatus(r.nS, 1.3)), metric('Twist', fmt(r.th), '°'), metric('Wheel travel', fmt(r.wheel), 'mm'), metric('Wheel rate', fmt(r.kw), 'N/mm')));
    verdict(out, r.nS >= 1.3, `Wheel rate ${fmt(r.kw)} N/mm`, 'A torsion bar packs a suspension spring into a straight rod running along the chassis, out of the way. Ride height can be adjusted by turning the bar\'s anchor. Length gives softness without raising stress.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = SP2.bar(vv); return { 'Shear stress': q.tau, 'Wheel rate': q.kw }; }, v, specs);
    explain(`Torsion bar shear stress ${fmt(r.tau)} megapascals, wheel rate ${fmt(r.kw)} newtons per millimetre.`);
  }
  const f = buildForm(L, specs, run, 'tbar'); run(f.vals);
}
