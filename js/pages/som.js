'use strict';
MD.register('som', {
  group: 'Foundations', title: 'SOM → Design bridge', icon: '📐', voice: 'strength of materials som mohr failure theory',
  render(main) {
    pageHead(main, 'Foundations', 'Strength of Materials → Machine Design',
      'Strength of materials gives the <b>stress</b> a load produces in an idealised body. Machine design asks whether that stress is <b>safe</b> in a real part: notched, rough, large, hot, corroding, cycled millions of times, made from scattered material. Design adds three things on top of SOM: <b>failure theories</b> (combined stress → one safety number), <b>modifying factors</b> (real-world corrections) and <b>iteration</b> (the unknown size sits inside those factors).');
    const body = h('div');
    tabs(main, ['Safety-factor waterfall', 'Mohr\'s circle & failure theories', 'Where SOM lives in machines'], i => { body.innerHTML = ''; [waterfall, mohr, mapping][i](body); });
    main.append(body);
  }
});

function somInputs() {
  return [
    { section: 'Part: solid round bar, rotating' },
    { id: 'd', label: 'Diameter d', unit: 'mm', value: 30, min: 5, max: 150, step: 0.5, aliases: ['diameter'] },
    { id: 'M', label: 'Bending moment M', unit: 'N·m', value: 300, min: 0, max: 5000, step: 5, aliases: ['moment', 'bending'] },
    { id: 'T', label: 'Torque T (steady)', unit: 'N·m', value: 400, min: 0, max: 5000, step: 5, aliases: ['torque'] },
    { id: 'P', label: 'Axial force P (tension +)', unit: 'kN', value: 0, min: -200, max: 200, step: 1, aliases: ['axial'] },
    { section: 'Material & manufacture' },
    { id: 'mat', label: 'Material', type: 'select', options: MAT_NAMES, value: 'AISI 1045 / C45 cold drawn', wide: true, aliases: ['material'] },
    { id: 'surf', label: 'Surface finish', type: 'select', options: Object.keys(SURFACES), value: 'Machined / cold drawn', aliases: ['surface', 'finish'] },
    { id: 'Kt', label: 'Stress concentration Kt (shoulder/groove)', value: 1.7, min: 1, max: 3.5, step: 0.05, aliases: ['stress concentration'] },
    { id: 'r', label: 'Notch radius r', unit: 'mm', value: 1.5, min: 0.1, max: 10, step: 0.1, aliases: ['radius', 'fillet'] },
  ];
}
function somStress(v) {
  const d = v.d, M = v.M * 1e3, T = v.T * 1e3, P = v.P * 1e3; // N·mm, N
  const sb = 32 * M / (Math.PI * d ** 3), sa = 4 * P / (Math.PI * d * d), tau = 16 * T / (Math.PI * d ** 3);
  const sx = sb + sa, c = sx / 2, R = Math.hypot(sx / 2, tau);
  return { sb, sa, tau, sx, s1: c + R, s2: c - R, tmax: R, vm: Math.sqrt(sx * sx + 3 * tau * tau) };
}
function waterfall(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  L.append(h('div', { class: 'panel-title' }, 'Load case'));
  let vals;
  const form = buildForm(L, somInputs(), run, 'som');
  function run(v) {
    vals = v; R.innerHTML = '';
    const m = matAt(v.mat), s = somStress(v);
    const card = h('div', { class: 'card' }); R.append(card);
    card.append(h('div', { class: 'panel-title' }, '1 · Strength of materials says'));
    card.append(h('div', { class: 'metrics' },
      metric('Bending σ = 32M/πd³', fmt(s.sb), 'MPa'), metric('Axial σ = 4P/πd²', fmt(s.sa), 'MPa'),
      metric('Torsion τ = 16T/πd³', fmt(s.tau), 'MPa'), metric('Von Mises σ\'', fmt(s.vm), 'MPa'),
      metric('Static FS = Sy/σ\'', fmt(m.Sy / s.vm), '', fsStatus(m.Sy / s.vm))));
    // Design layers (rotating shaft: bending fully reversed, torque steady, axial steady)
    const Se1 = SePrime(m), ka = ka_(v.surf, m.Sut), kb = kb_(v.d), kc = 1, kd = 1 /* strengths already T-derated */, ke = RELIAB[ENV.rel], kenv = m.kenv;
    const q = notchQ(v.r, m.Sut), Kf = 1 + q * (v.Kt - 1), qs = notchQ(v.r, m.Sut, true), Kfs = 1 + qs * (Math.max(1, v.Kt * 0.8) - 1);
    const sa_ = Kf * s.sb, sm_ = Math.sqrt((Kf * s.sa) ** 2 + 3 * (Kfs * s.tau) ** 2);
    const steps = [];
    const n0 = m.Sy0 / s.vm; steps.push({ k: 'SOM: Sy/σ\' (20 °C, static)', v: n0, tip: 'What the textbook stress analysis implies' });
    const nT = m.Sy / s.vm; steps.push({ k: `Temperature ${ENV.T} °C (×${fmt(m.kT, 3)})`, v: nT });
    const goodman = Se => 1 / (sa_ / Se + Math.max(sm_, 0) / m.Sut);
    const sigA = s.sb, sigM = Math.sqrt(s.sa ** 2 + 3 * s.tau ** 2);
    const fat = Se => 1 / (sigA / Se + sigM / m.Sut);
    let Se = Se1; steps.push({ k: 'Fatigue, polished specimen Se\'', v: fat(Se), tip: 'Bending now alternates each revolution: Goodman criterion' });
    Se *= ka; steps.push({ k: `Surface finish ka = ${fmt(ka, 3)}`, v: fat(Se) });
    Se *= kb; steps.push({ k: `Size kb = ${fmt(kb, 3)} (d = ${v.d} mm)`, v: fat(Se) });
    Se *= ke; steps.push({ k: `Reliability ${ENV.rel * 100}% ke = ${ke}`, v: fat(Se) });
    Se *= kenv; steps.push({ k: `Medium (${ENV.medium.split(' ')[0]}) = ${kenv}`, v: fat(Se) });
    const nF = goodman(Se); steps.push({ k: `Notch Kf = ${fmt(Kf, 3)} (q = ${fmt(q, 2)})`, v: nF });
    const c2 = h('div', { class: 'card', style: { marginTop: '12px' } }); R.append(c2);
    c2.append(h('div', { class: 'panel-title' }, '2 · Design reality: the same bar, one correction at a time'));
    const box = h('div', { class: 'bars' }), mx = Math.max(...steps.map(s => s.v));
    steps.forEach((st, i) => box.append(h('div', { class: 'bar', title: st.tip || '' }, h('span', { style: { fontSize: '12px' } }, st.k),
      h('div', { class: 'track' }, h('div', { class: 'fill' + (i === steps.length - 1 ? ' gov' : ''), style: { width: 100 * st.v / mx + '%', background: st.v < 1 ? 'var(--bad)' : st.v < 1.5 ? 'var(--warn)' : '' } })),
      h('span', { class: 'val' }, 'n = ' + fmt(st.v)))));
    c2.append(box);
    const drop = n0 / nF;
    verdict(c2, nF >= 1.5 ? true : nF >= 1 ? null : false, `Real fatigue safety factor n = ${fmt(nF)} vs SOM's ${fmt(n0)} (${fmt(drop, 2)}× lower)`,
      `The bar's stresses never changed. Only the honesty of the comparison did. Biggest single loss: <b>${(() => { let w = '', dm = 0; for (let i = 1; i < steps.length; i++) { const r = steps[i - 1].v / steps[i].v; if (r > dm) { dm = r; w = steps[i].k; } } return w; })()}</b>. This is why machine design exists as a subject separate from SOM.`);
    c2.append(h('div', { class: 'eq' }, `Se = ka·kb·kc·kd·ke·k_env·Se' = ${fmt(ka, 3)}×${fmt(kb, 3)}×1×1×${ke}×${kenv}×${fmt(Se1)} = ${fmt(Se)} MPa
Goodman (DE): 1/n = Kf·σa/Se + σm'/Sut,  σa = ${fmt(s.sb)} MPa (reversed bending),  σm' = √((Kf σ_ax)² + 3(Kfs τ)²) = ${fmt(sm_)} MPa`));
    envWarnings(m).forEach(w => c2.append(h('div', { class: 'warnbox' }, '⚠ ' + w)));
    explain(`Strength of materials gives a static safety factor of ${fmt(n0)}. After temperature, rotation-induced fatigue, surface finish, size, reliability, environment and the notch, the real safety factor is ${fmt(nF)}. The largest loss comes from the switch to fatigue.`);
  }
  run(form.vals);
  MD.onEnv = () => run(vals);
}
function mohr(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  L.append(h('div', { class: 'panel-title' }, 'Plane stress state'));
  const specs = [
    { id: 'sx', label: 'σx', unit: 'MPa', value: 120, min: -400, max: 400, step: 1 },
    { id: 'sy', label: 'σy', unit: 'MPa', value: -40, min: -400, max: 400, step: 1 },
    { id: 'txy', label: 'τxy', unit: 'MPa', value: 70, min: -300, max: 300, step: 1, aliases: ['shear'] },
    { id: 'mat', label: 'Material', type: 'select', options: MAT_NAMES, value: 'AISI 1045 / C45 cold drawn', wide: true },
    { id: 'Suc', label: 'Compressive ultimate (brittle only)', unit: 'MPa', value: 900, min: 100, max: 2000, step: 10 },
  ];
  const cv = plotCanvas('anim'), cv2 = plotCanvas(); cv2.style.height = '330px';
  const out = h('div');
  R.append(h('div', { class: 'card' }, h('div', { class: 'panel-title' }, "Mohr's circle"), cv), h('div', { class: 'card', style: { marginTop: '12px' } }, h('div', { class: 'panel-title' }, 'Failure envelopes in principal-stress space (σ3 = 0)'), cv2, out));
  function run(v) {
    const m = matAt(v.mat), c = (v.sx + v.sy) / 2, Rr = Math.hypot((v.sx - v.sy) / 2, v.txy);
    const s1 = c + Rr, s2 = c - Rr, th = 0.5 * Math.atan2(2 * v.txy, v.sx - v.sy) / deg;
    // draw Mohr circle
    const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    const span = Math.max(Math.abs(s1), Math.abs(s2), Rr, 10) * 1.25, sc = Math.min(w, H * 1.6) / (2.4 * span), ox = w / 2 - c * sc * 0.3, oy = H / 2;
    ctx.strokeStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(10, oy); ctx.lineTo(w - 10, oy); ctx.moveTo(ox, 10); ctx.lineTo(ox, H - 10); ctx.stroke();
    ctx.fillStyle = '#4a5566'; ctx.font = '12px IBM Plex Sans, sans-serif'; ctx.fillText('σ', w - 20, oy - 6); ctx.fillText('τ (cw +)', ox + 6, 20);
    ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ox + c * sc, oy, Rr * sc, 0, 7); ctx.stroke();
    const Xp = [ox + v.sx * sc, oy - v.txy * sc], Yp = [ox + v.sy * sc, oy + v.txy * sc];
    ctx.strokeStyle = '#c2410c'; ctx.beginPath(); ctx.moveTo(...Xp); ctx.lineTo(...Yp); ctx.stroke();
    [[Xp, 'X (σx, τxy)'], [Yp, 'Y (σy, −τxy)'], [[ox + s1 * sc, oy], 'σ1 = ' + fmt(s1)], [[ox + s2 * sc, oy], 'σ2 = ' + fmt(s2)], [[ox + c * sc, oy - Rr * sc], 'τmax = ' + fmt(Rr)]].forEach(([p, t]) => { ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); ctx.fillText(t, p[0] + 6, p[1] - 6); });
    ctx.fillStyle = '#4a5566'; ctx.fillText(`Principal plane at θp = ${fmt(th)}° from x`, 12, H - 12);
    // Failure envelopes normalised by Sy (ductile) — Rankine uses Sut/Suc for brittle comparison
    const S = m.Sy, ang = linspace(0, 2 * Math.PI, 361);
    const vmx = [], vmy = []; ang.forEach(a => { const x = Math.cos(a), y = Math.sin(a), r = 1 / Math.sqrt(x * x - x * y + y * y); vmx.push(x * r); vmy.push(y * r); });
    const tr = [[1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, 0]];
    const brittle = m.cls === 'castiron', St = m.Sut / S, Sc = v.Suc / S;
    const ser = [
      { label: 'Von Mises (distortion energy)', x: vmx, y: vmy, color: '#0f5e8c' },
      { label: 'Tresca (max shear)', x: tr.map(p => p[0]), y: tr.map(p => p[1]), color: '#c2410c', dash: [6, 3] },
      { label: 'Rankine (max normal)', x: [1, 1, -1, -1, 1], y: [1, -1, -1, 1, 1], color: '#7b3fa0', dash: [2, 3] },
    ];
    if (brittle) ser.push({ label: 'Coulomb–Mohr (brittle)', x: [St, St, 0, -Sc, -Sc, 0, St], y: [0, St, St, 0, -Sc, -Sc, 0], color: '#2f7d32' });
    const p1 = s1 / S, p2 = s2 / S, k = 1.1 * Math.max(1.4, Math.abs(p1), Math.abs(p2));
    ser.push({ x: [0, p1 * 3], y: [0, p2 * 3], color: '#94a3b8', dash: [3, 3] });
    plot(cv2, { xlabel: 'σ1 / Sy', ylabel: 'σ2 / Sy', xmin: -k, xmax: k, ymin: -k, ymax: k, series: ser, points: [{ x: p1, y: p2, label: 'state' }], legend: 'bl' });
    // safety factors
    const nVM = S / Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2), nTr = S / Math.max(Math.abs(s1 - s2), Math.abs(s1), Math.abs(s2));
    const nRk = S / Math.max(Math.abs(s1), Math.abs(s2));
    const nu = m.nu, nSV = S / Math.max(Math.abs(s1 - nu * s2), Math.abs(s2 - nu * s1));
    let nCM = NaN; { const a = Math.max(s1, 0) / m.Sut - Math.min(s2, 0) / v.Suc; nCM = 1 / Math.max(a, 1e-9); }
    out.innerHTML = '';
    out.append(h('div', { class: 'metrics' },
      metric('Von Mises n', fmt(nVM), '', fsStatus(nVM)), metric('Tresca n', fmt(nTr), '', fsStatus(nTr)), metric('Rankine n', fmt(nRk), '', fsStatus(nRk)),
      metric('Saint-Venant (strain) n', fmt(nSV), '', fsStatus(nSV)), metric('Coulomb–Mohr n (Sut, Suc)', fmt(nCM), '', fsStatus(nCM))));
    out.append(h('div', { class: 'note', html: `<b>Which theory?</b> Ductile metals yield by shear sliding: <b>von Mises</b> is the best predictor and <b>Tresca</b> is the conservative one (up to 15 % more). <b>Rankine</b> is unsafe for ductile parts under opposite-sign stresses (pure torsion: it overpredicts by 1/0.577). Brittle materials (${m.cls === 'castiron' ? 'like this cast iron' : 'cast iron, ceramics'}) fail by tension cracking: use <b>Coulomb–Mohr</b> or modified Mohr with Sut ≠ Suc.` + (s1 * s2 < 0 ? ' <br>Your state has opposite-sign principal stresses, which is where the theories disagree most.' : '') }));
    explain(`Principal stresses are ${fmt(s1)} and ${fmt(s2)} megapascal. Von Mises safety factor is ${fmt(nVM)}, Tresca ${fmt(nTr)}, Rankine ${fmt(nRk)}.`);
  }
  const f = buildForm(L, specs, run, 'mohr'); run(f.vals);
}
function mapping(body) {
  const rows = [
    ['Axial stress σ = P/A, thermal stress EαΔT', 'Bolts & studs, tie rods, cotter & knuckle joints, thermal preload loss, pipes fixed at both ends', 'bolt'],
    ['Torsion τ = Tr/J, angle θ = TL/GJ', 'Shafts, keys, couplings; helical springs (wire is in torsion!), torsion bars', 'shaft'],
    ['Bending σ = Mc/I, deflection (Macaulay, area-moment)', 'Shafts, axles, levers, gear teeth (Lewis = cantilever tooth), beams, bridges, crane girders, spanners', 'structure'],
    ['Combined stresses, principal stresses, Mohr\'s circle', 'Shafts under bending + torsion; crankshafts; brackets; pressure vessels with end loads', 'som'],
    ['Theories of failure (Rankine, Tresca, von Mises)', 'Every static design decision; the ASME shaft code and DE-Goodman are von Mises extended to fatigue', 'som'],
    ['Columns: Euler, Rankine–Gordon, Johnson', 'Connecting rods, piston rods, screw jacks, power-screw spindles, truss compression members', 'column'],
    ['Thin & thick cylinders (Lamé)', 'Pressure vessels, hydraulic cylinders, press fits (hub on shaft), gun barrels', null],
    ['Strain energy, impact (Castigliano)', 'Spring energy storage, impact loads on bolts, deflection of curved frames', 'spring'],
    ['Curved beams (Winkler–Bach)', 'Crane hooks, C-clamps, press frames, spanner jaws, chain links', 'spanner'],
    ['Hertz contact stress', 'Gear tooth pitting, rolling bearings, cam–follower, rail–wheel', 'gear'],
    ['Stress concentration (Kt)', 'Shoulders, keyways, holes, threads: the origin of most fatigue failures (Comet aircraft windows)', 'cases'],
    ['Shear force & bending moment diagrams', 'Locating the critical section of shafts, beams, bridges before sizing anything', 'structure'],
  ];
  const tb = h('table', { class: 't' }, h('tr', null, h('th', null, 'SOM topic'), h('th', { style: { textAlign: 'left' } }, 'Where it appears in machine design'), h('th', null, 'Try it')));
  rows.forEach(r => tb.append(h('tr', null, h('td', { style: { fontFamily: 'var(--sans)' } }, r[0]), h('td', { style: { textAlign: 'left', fontFamily: 'var(--sans)' } }, r[1]), h('td', null, r[2] ? h('a', { href: '#' + r[2] }, 'open →') : ''))));
  body.append(h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, tb)));
  body.append(h('div', { class: 'grid3', style: { marginTop: '14px' } },
    h('div', { class: 'card', html: '<h3>SOM assumes</h3><p class="small">Homogeneous, isotropic, linear-elastic material; smooth prismatic geometry; static loads applied slowly; known exact loads; room temperature.</p>' }),
    h('div', { class: 'card', html: '<h3>Design must handle</h3><p class="small">Notches, surface roughness, size effect, millions of load cycles, impact, unknown overloads (service factor), material scatter (reliability), heat, creep, corrosion, wear, manufacturability, standard sizes, cost.</p>' }),
    h('div', { class: 'card', html: '<h3>So the factor of safety is not "ignorance"</h3><p class="small">Each modifier is a measured correction. What remains in n covers truly unknown overloads and consequences of failure. That is why n ≈ 1.5–2 for well-characterised machine parts but 3–4+ for lifting gear and pressure parts.</p>' })));
  explain('Strength of materials provides the stress formulas. Machine design applies them to real parts and adds failure theories, correction factors for fatigue, notches, size, surface, temperature and reliability, and iteration.');
}
