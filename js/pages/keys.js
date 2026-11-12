'use strict';
// Parallel key sizes b × h by shaft diameter (IS 2048 / DIN 6885 style)
const KEY_TABLE = [[10, 12, 4, 4], [12, 17, 5, 5], [17, 22, 6, 6], [22, 30, 8, 7], [30, 38, 10, 8], [38, 44, 12, 8], [44, 50, 14, 9], [50, 58, 16, 10], [58, 65, 18, 11], [65, 75, 20, 12], [75, 85, 22, 14], [85, 95, 25, 14], [95, 110, 28, 16]];
const KY = {
  key(v) {
    const row = KEY_TABLE.find(r => v.d > r[0] && v.d <= r[1]) || KEY_TABLE[KEY_TABLE.length - 1], b = row[2], hk = row[3];
    const T = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60) * v.Cs; // N·mm
    const mk = matAt(v.kmat), mh = matAt(v.hmat), tau = 0.5 * mk.Sy / v.n, sc = Math.min(mk.Sy, mh.Sy) / v.n;
    const Ls = 2 * T / (v.d * b * tau), Lc = 4 * T / (v.d * hk * sc), L = Math.max(Ls, Lc);
    const tauShaft = 16 * T / (Math.PI * v.d ** 3);
    return { b, hk, T, Ls, Lc, L, gov: Ls > Lc ? 'shear' : 'crushing', tauShaft, hubOk: L <= 1.5 * v.d };
  },
  spline(v) {
    const T = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60) * v.Cs, rm = (v.Dm + v.dm) / 4, hgt = (v.Dm - v.dm) / 2;
    const L = T / (0.75 * v.ns * hgt * rm * v.p); // 75 % of teeth effective
    return { T, rm, hgt, L };
  },
  flange(v) {
    const T = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60) * v.Cs, D1 = 3 * v.d, mb = matAt(v.bmat), tau = 0.5 * mb.Sy / v.n;
    const db = Math.sqrt(8 * T / (Math.PI * v.nb * D1 * tau)); // fitted bolts in shear
    const t = 0.5 * v.d, D = 2 * v.d, tauFl = 2 * T / (Math.PI * D * D * t);
    const F = 2 * T / (v.nb * D1), pBush = F / (2 * db * 2 * db); // flexible bush (Ø ≈ 2·db, length ≈ 2·db), MPa
    return { T, D1, db, t, D, tauFl, pBush, flexOk: pBush <= 1 };
  },
};
MD.register('keys', {
  group: 'Machine elements', title: 'Keys, splines & couplings', icon: '🔑', voice: 'key keyway spline coupling flange',
  kid: { what: 'How a gear grips a shaft (<b>key</b> or <b>spline</b>) and how two shafts are joined (<b>coupling</b>).', steps: ['Enter power, speed and shaft size.', 'Read how long the key must be.', 'See whether it fails by shearing or crushing.'], try: 'Switch the hub to cast iron: crushing takes over and the key gets longer.' },
  eq: [
    { t: 'Key in shear', f: 'L_shear = 2T / (d · b · τ_allow)', s: [['T', 'torque'], ['d', 'shaft diameter'], ['b', 'key width']], fx: [['bigger shaft', 'force at the key = 2T/d is smaller']] },
    { t: 'Key in crushing (bearing)', f: 'L_crush = 4T / (d · h · σ_allow)', fx: [['softer hub', 'crushing governs: the weaker of key and hub decides']] },
    { t: 'Why keys are weaker on purpose', m: 'A key is cheap. If it shears under overload, the expensive shaft and gear survive. It acts as a mechanical fuse.', f: 'τ_key < τ_shaft' },
    { t: 'Spline capacity', f: 'T = 0.75 · n · h · L · r_m · p_allow', fx: [['more splines n', 'more torque, so splines suit sliding gears in gearboxes']] },
    { t: 'Flange coupling bolts (fitted, shear)', f: 'd_b = √(8T / (π · n · D1 · τ))', fx: [['bigger bolt circle D1', 'smaller bolt force']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · connecting things', 'Keys, splines & couplings',
      'Torque has to get from the shaft into the gear (a <b>key</b> or <b>splines</b>) and from one shaft into the next (a <b>coupling</b>). These small parts are where torque is concentrated, so they are designed to be the <i>weak link on purpose</i>: cheap to replace, protecting the costly shaft and gearbox.');
    const body = h('div');
    tabs(main, ['Parallel key', 'Splined shaft', 'Flange & flexible coupling'], i => { body.innerHTML = ''; [keyTab, splineTab, couplingTab][i](body); });
    main.append(body);
  }
});
const KMAT = MAT_NAMES.filter(n => !/Ti-|7075/.test(n));
function keyTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { id: 'P', label: 'Power', unit: 'kW', value: 15, min: 0.2, max: 300, step: 0.1 }, { id: 'rpm', label: 'Speed', unit: 'rpm', value: 720, min: 20, max: 6000, step: 10 },
    { id: 'd', label: 'Shaft diameter', unit: 'mm', value: 45, min: 11, max: 110, step: 1 }, { id: 'Cs', label: 'Service factor', value: 1.5, min: 1, max: 3, step: 0.05 },
    { id: 'kmat', label: 'Key material', type: 'select', options: KMAT, value: 'AISI 1045 / C45 cold drawn', wide: true }, { id: 'hmat', label: 'Hub material', type: 'select', options: KMAT, value: 'IS 2062 E250 structural steel', wide: true },
    { id: 'n', label: 'Factor of safety', value: 2, min: 1, max: 4, step: 0.1 },
  ];
  const out = h('div'), cv = plotCanvas('anim'); cv.style.height = '200px'; R.append(h('div', { class: 'card' }, cv, out));
  let K = null;
  function run(v) {
    const r = KY.key(v); K = Object.assign({ v }, r); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Torque (with service factor)', fmt(r.T / 1000), 'N·m'), metric('Key section b × h', `${r.b} × ${r.hk}`, 'mm'), metric('Length for shear', fmt(r.Ls), 'mm'), metric('Length for crushing', fmt(r.Lc), 'mm'),
      metric('Required key length', fmt(Math.ceil(r.L)), 'mm', 'good'), metric('Governing', r.gov, ''), metric('Fits in hub ≤ 1.5d?', r.hubOk ? 'yes' : 'no', '', r.hubOk ? 'good' : 'warn')));
    verdict(out, r.hubOk, `Key ${r.b} × ${r.hk} × ${Math.ceil(r.L)} mm, governed by ${r.gov}`, r.hubOk ? 'Round the length up to the next standard key length. The keyway also weakens the shaft (Kf ≈ 1.6–2): check it in the Shaft designer.' : 'The key is longer than a practical hub. Use two keys at 180°, splines, or a shrink fit.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = KY.key(vv); return { 'Key length': q.L }; }, v, specs, { skip: ['d'] });
    explain(`Use a ${r.b} by ${r.hk} key, ${Math.ceil(r.L)} millimetres long, governed by ${r.gov}.`);
  }
  const f = buildForm(L, specs, run, 'key'); run(f.vals);
  anim(t => { if (!K) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H); const cx = w * 0.3, cy = H / 2, sc = Math.min(w * 0.25, H * 0.42) / (K.v.d * 1.1);
    const R1 = K.v.d / 2 * sc, Rh = K.v.d * sc; ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, 7); ctx.fill(); ctx.strokeStyle = '#475569'; ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(cx, cy, R1, 0, 7); ctx.fill();
    ctx.fillStyle = '#c2410c'; ctx.fillRect(cx - K.b / 2 * sc, cy - R1 - K.hk / 2 * sc, K.b * sc, K.hk * sc);
    tag(ctx, 'Hub (gear/pulley)', cx, cy - Rh - 10, '#475569', 'center', 11); tag(ctx, 'Shaft', cx, cy + 4, '#1b2430', 'center', 11); tag(ctx, 'Key', cx + K.b * sc, cy - R1, '#c2410c', 'left', 11);
    const x0 = w * 0.6, x1 = w - 20, y0 = H * 0.25; ctx.fillStyle = '#94a3b8'; ctx.fillRect(x0, y0, x1 - x0, H * 0.5); ctx.fillStyle = '#c2410c'; ctx.fillRect(x0 + 20, y0 - 8, Math.min(x1 - x0 - 40, K.L * sc * 0.5), 16);
    tag(ctx, `side view: key length ${fmt(Math.ceil(K.L))} mm`, (x0 + x1) / 2, y0 + H * 0.5 + 14, '#1b2430', 'center', 11);
    const sh = (Math.sin(t * 2) + 1) / 2; ctx.strokeStyle = `rgba(180,35,24,${sh})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - K.b / 2 * sc - 4, cy - R1); ctx.lineTo(cx + K.b / 2 * sc + 4, cy - R1); ctx.stroke();
    tag(ctx, K.gov === 'shear' ? 'fails by shearing across here' : 'fails by crushing on the sides', cx + Rh + 6, cy + Rh * 0.6, '#b42318', 'left', 11, false); });
}
function splineTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { id: 'P', label: 'Power', unit: 'kW', value: 30, min: 0.5, max: 500, step: 0.5 }, { id: 'rpm', label: 'Speed', unit: 'rpm', value: 1000, min: 20, max: 8000, step: 10 },
    { id: 'ns', label: 'Number of splines', value: 6, min: 4, max: 20, step: 1 }, { id: 'dm', label: 'Minor diameter', unit: 'mm', value: 32, min: 10, max: 150, step: 1 }, { id: 'Dm', label: 'Major diameter', unit: 'mm', value: 38, min: 12, max: 170, step: 1 },
    { id: 'p', label: 'Allowable side pressure', unit: 'MPa', value: 10, min: 3, max: 40, step: 0.5, tip: 'Sliding under load ≈ 3–10 MPa; fixed, hardened ≈ 20–40 MPa.' }, { id: 'Cs', label: 'Service factor', value: 1.25, min: 1, max: 3, step: 0.05 },
  ];
  const out = h('div'); R.append(h('div', { class: 'card' }, out));
  function run(v) {
    if (v.Dm <= v.dm) { out.innerHTML = '<div class="badbox">Major diameter must exceed minor diameter.</div>'; return; }
    const r = KY.spline(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Torque', fmt(r.T / 1000), 'N·m'), metric('Spline height', fmt(r.hgt), 'mm'), metric('Mean radius', fmt(r.rm), 'mm'), metric('Required engagement length', fmt(Math.ceil(r.L)), 'mm', r.L <= 2 * v.Dm ? 'good' : 'warn')));
    verdict(out, r.L <= 2 * v.Dm, `Engagement length ${Math.ceil(r.L)} mm`, 'Splines share torque over many teeth and let gears slide along the shaft: used in gearboxes (sliding dog clutches), drive shafts and PTO shafts. A sliding spline must use a low allowable pressure to avoid fretting and wear.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => ({ 'Length needed': KY.spline(vv).L }), v, specs);
    explain(`The spline needs ${Math.ceil(r.L)} millimetres of engagement.`);
  }
  const f = buildForm(L, specs, run, 'spline'); run(f.vals);
}
function couplingTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { id: 'P', label: 'Power', unit: 'kW', value: 22, min: 0.5, max: 500, step: 0.5 }, { id: 'rpm', label: 'Speed', unit: 'rpm', value: 1440, min: 50, max: 6000, step: 10 },
    { id: 'd', label: 'Shaft diameter', unit: 'mm', value: 45, min: 15, max: 150, step: 1 }, { id: 'nb', label: 'Number of bolts', value: 4, min: 3, max: 12, step: 1 },
    { id: 'bmat', label: 'Bolt material', type: 'select', options: KMAT, value: 'AISI 1045 / C45 cold drawn', wide: true }, { id: 'n', label: 'Factor of safety', value: 2.5, min: 1, max: 5, step: 0.1 }, { id: 'Cs', label: 'Service factor', value: 1.5, min: 1, max: 3, step: 0.05 },
  ];
  const out = h('div'); R.append(h('div', { class: 'card' }, out));
  function run(v) {
    const r = KY.flange(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Torque', fmt(r.T / 1000), 'N·m'), metric('Bolt circle D1 ≈ 3d', fmt(r.D1), 'mm'), metric('Fitted bolt Ø (shear)', fmt(Math.ceil(r.db)), 'mm', 'good'), metric('Hub Ø ≈ 2d', fmt(r.D), 'mm'),
      metric('Flange thickness ≈ 0.5d', fmt(r.t), 'mm'), metric('Flange shear at hub', fmt(r.tauFl), 'MPa', r.tauFl < 40 ? 'good' : 'warn'), metric('Rubber-bush pressure (flexible version)', fmt(r.pBush), 'MPa', r.flexOk ? 'good' : 'warn')));
    verdict(out, true, 'Rigid flange vs flexible bush-pin coupling', '<b>Rigid</b> couplings are compact and stiff but need near-perfect alignment; any misalignment bends both shafts every revolution (fatigue!). <b>Flexible</b> couplings (rubber bushes, jaws, discs) tolerate small angular/parallel misalignment and damp shocks, at the cost of size. Motor-to-pump drives almost always use flexible couplings for this reason.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = KY.flange(vv); return { 'Bolt diameter': q.db, 'Bush pressure': q.pBush }; }, v, specs);
    explain(`Flange coupling: ${v.nb} fitted bolts of ${Math.ceil(r.db)} millimetres on a ${fmt(r.D1)} millimetre circle.`);
  }
  const f = buildForm(L, specs, run, 'coupling'); run(f.vals);
}
