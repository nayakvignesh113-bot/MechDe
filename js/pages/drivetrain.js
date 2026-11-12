'use strict';
/* Bike drivetrain: bicycle chain & sprockets; motorcycle gearbox (gear train) + final chain drive */
const parseList = s => String(s).split(/[,\s\-–/]+/).map(Number).filter(x => x > 0 && isFinite(x));
const sprocketR = (p, z) => p / (2 * Math.sin(Math.PI / z)); // pitch radius
const BIKE_CHAINS = { 'Bicycle ½″ chain (ISO 9633 min 8 kN)': 8000, 'E-bike rated ½″ chain (≈ 11 kN, indicative)': 11000, '08B-1 industrial ½″ (ISO 606, 18 kN)': 18000 };
const MOTO_CHAINS = { '428 (½″ pitch), ≈ 18 kN': [12.7, 18000], '520 standard (⅝″), ≈ 32 kN': [15.875, 32000], '520 O/X-ring heavy duty, ≈ 40 kN': [15.875, 40000], '530 O-ring (⅝″), ≈ 45 kN': [15.875, 45000] };
const GEAR_MAT_KEYS = Object.keys(GEAR_MATS);

MD.register('drivetrain', {
  group: 'Machine elements', title: 'Bike drivetrain & gear train', icon: '🚲', voice: 'bike bicycle motorcycle gearbox gear train drivetrain chain sprocket',
  render(main) {
    pageHead(main, 'Machine elements · systems', 'Bike drivetrain & gear train',
      'A drivetrain is a <b>system</b>: rider or engine characteristics + ratios (kinematics) → road load and tractive force (dynamics) → chain tension, tooth and shaft stresses (SOM) → chain, gear module, teeth and shaft sizes (design). A bicycle uses a <b>chain and sprockets</b> (no gears in mesh). A motorcycle uses a <b>multi-stage constant-mesh gear train</b> (gearbox) plus a final chain. Both are here.');
    const body = h('div');
    tabs(main, ['Bicycle: chainrings & cassette', 'Motorcycle: gearbox + final chain'], i => { if (MD.cleanup) { MD.cleanup(); MD.cleanup = null; } body.innerHTML = ''; [bicycle, motorcycle][i](body); });
    main.append(body);
  }
});

function bicycle(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { section: 'Rider & bike' },
    { id: 'mass', label: 'Rider + bike mass', unit: 'kg', value: 85, min: 30, max: 200, step: 1, aliases: ['mass'] },
    { id: 'P', label: 'Sustainable power', unit: 'W', value: 200, min: 50, max: 600, step: 5, aliases: ['power'] },
    { id: 'Fp', label: 'Peak pedal force (sprint / standing)', unit: 'N', value: 1200, min: 300, max: 2500, step: 10, aliases: ['pedal force'] },
    { id: 'crank', label: 'Crank length', unit: 'mm', value: 172.5, min: 150, max: 185, step: 2.5, aliases: ['crank'] },
    { id: 'cad', label: 'Preferred cadence', unit: 'rpm', value: 90, min: 50, max: 120, step: 1, aliases: ['cadence'] },
    { id: 'cadmin', label: 'Lowest acceptable cadence', unit: 'rpm', value: 60, min: 30, max: 90, step: 1 },
    { section: 'Drivetrain' },
    { id: 'rings', label: 'Chainring teeth (front)', type: 'text', value: '50, 34', aliases: ['chainring', 'chain ring'] },
    { id: 'cogs', label: 'Cassette teeth (rear)', type: 'text', value: '11,12,13,14,15,17,19,21,24,28,32', aliases: ['cassette', 'cogs'] },
    { id: 'circ', label: 'Wheel + tyre circumference', unit: 'mm', value: 2105, min: 1200, max: 2400, step: 5, tip: '700×25c ≈ 2105, 29×2.2 ≈ 2300, 26×2.0 ≈ 2055', aliases: ['wheel'] },
    { id: 'chain', label: 'Chain', type: 'select', options: Object.keys(BIKE_CHAINS), value: Object.keys(BIKE_CHAINS)[0], wide: true },
    { id: 'eta', label: 'Drivetrain efficiency', value: 0.97, min: 0.85, max: 0.99, step: 0.01 },
    { section: 'Road' },
    { id: 'grade', label: 'Gradient', unit: '%', value: 6, min: -5, max: 25, step: 0.5, aliases: ['gradient', 'slope', 'grade'] },
    { id: 'CdA', label: 'Drag area CdA', unit: 'm²', value: 0.32, min: 0.18, max: 0.7, step: 0.01, tip: 'drops 0.25–0.3, hoods 0.32, upright 0.5+' },
    { id: 'Crr', label: 'Rolling resistance Crr', value: 0.005, min: 0.002, max: 0.02, step: 0.0005 },
  ];
  const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(), c2 = plotCanvas(); cv.style.height = '260px';
  R.append(h('div', { class: 'card' }, cv, canvasLegend([['#c2410c', 'chainring (front, driven by cranks)'], ['#0f5e8c', 'cog (rear cassette, turns wheel)'], ['#b42318', 'tight (top) chain run'], ['#94a3b8', 'slack run']]), out),
    h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
  let A = null;
  function eqSpeed(P, mass, grade, v) { const th = Math.atan(grade / 100), g = 9.81; return solveMin(u => v.eta * P - u * (mass * g * (Math.sin(th) + v.Crr * Math.cos(th)) + 0.6 * v.CdA * u * u) < 0 ? 1 : -1, 0.05, 40, 1e-3); }
  function run(v) {
    const rings = parseList(v.rings).sort((a, b) => b - a), cogs = parseList(v.cogs).sort((a, b) => a - b);
    out.innerHTML = '';
    if (!rings.length || !cogs.length) { out.append(h('div', { class: 'badbox' }, 'Enter chainring and cassette teeth, e.g. "50, 34" and "11,12,13,…,32".')); A = null; return; }
    const C = v.circ / 1000, Dw_in = C / Math.PI / 0.0254;
    const vEq = eqSpeed(v.P, v.mass, v.grade, v); // m/s
    // chainline: rings 7.5 mm apart about 43.5 mm; cogs 3.95 mm pitch centred on 43.5 mm; chainstay 410 mm
    const ringX = k => 43.5 + ((rings.length - 1) / 2 - k) * 7.5, cogX = j => 43.5 + ((cogs.length - 1) / 2 - j) * 3.95;
    const combos = [];
    rings.forEach((zr, k) => cogs.forEach((zc, j) => {
      const ratio = zr / zc, dev = ratio * C, gi = ratio * Dw_in, sp = dev * v.cad / 60 * 3.6;
      const cadHere = vEq / dev * 60, cross = Math.atan(Math.abs(ringX(k) - cogX(j)) / 410) / deg;
      combos.push({ zr, zc, k, j, ratio, dev, gi, sp, cadHere, cross });
    }));
    const usable = combos.filter(c => c.cross <= 2.5);
    const best = (usable.length ? usable : combos).reduce((a, b) => Math.abs(b.cadHere - v.cad) < Math.abs(a.cadHere - v.cad) ? b : a);
    const sorted = [...usable].sort((a, b) => a.ratio - b.ratio), low = sorted[0] || combos[0], high = sorted[sorted.length - 1] || combos[0];
    // steepest gradient climbable in lowest gear at minimum cadence
    const vLow = low.dev * v.cadmin / 60;
    const thMax = solveMin(th => v.eta * v.P - vLow * (v.mass * 9.81 * (Math.sin(th) + v.Crr * Math.cos(th)) + 0.6 * v.CdA * vLow * vLow) < 0 ? 1 : -1, 0, 0.6, 1e-4);
    const gradeMax = isFinite(thMax) ? Math.tan(thMax) * 100 : 60;
    // steps & duplicates
    const steps = []; for (let i = 1; i < sorted.length; i++) steps.push((sorted[i].ratio / sorted[i - 1].ratio - 1) * 100);
    const dup = steps.filter(s => s < 3).length, bigStep = Math.max(...steps, 0);
    // chain load: peak pedal torque on the smallest chainring
    const Tped = v.Fp * v.crank / 1000, zMin = Math.min(...rings), rMin = sprocketR(12.7, zMin) / 1000, Tch = Tped / rMin, Fbr = BIKE_CHAINS[v.chain], nChain = Fbr / Tch;
    const polyMax = (1 - Math.cos(Math.PI / Math.min(...cogs))) * 100;
    A = { v, best, rings, cogs, cad: v.cad };
    out.append(h('div', { class: 'metrics' },
      metric(`Speed on ${v.grade}% at ${v.P} W`, fmt(vEq * 3.6), 'km/h'), metric('Best gear here (cadence nearest ' + v.cad + ')', `${best.zr}×${best.zc}`, '', 'good'),
      metric('Cadence in that gear', fmt(best.cadHere), 'rpm', best.cadHere >= v.cadmin ? 'good' : 'bad'),
      metric('Ratio range (low–high)', `${fmt(low.ratio)}–${fmt(high.ratio)}`, ''), metric('Gear inches (low–high)', `${fmt(low.gi)}–${fmt(high.gi)}`, 'in'),
      metric(`Top speed at ${v.cad} rpm`, fmt(high.sp), 'km/h'), metric(`Steepest climb at ${v.cadmin} rpm, ${v.P} W`, fmt(gradeMax) + ' %', '', gradeMax >= Math.max(v.grade, 8) ? 'good' : 'warn'),
      metric('Usable distinct ratios', `${usable.length - dup} of ${combos.length}`, ''), metric('Largest jump between ratios', fmt(bigStep) + ' %', '', bigStep <= 15 ? 'good' : 'warn'),
      metric(`Peak chain tension (${zMin}T ring)`, fmt(Tch / 1000), 'kN'), metric('Chain FS vs breaking load', fmt(nChain), '', fsStatus(nChain, 2)), metric(`Chordal speed ripple (${Math.min(...cogs)}T cog)`, fmt(polyMax) + ' %', '')));
    const notes = [];
    if (best.cadHere < v.cadmin) notes.push(`Even the lowest gear only allows ${fmt(best.cadHere)} rpm on ${v.grade}% at ${v.P} W. Fit a larger rear cog (or smaller chainring): you need the low gear at about ${fmt(low.ratio * best.cadHere / v.cadmin, 2)} or lower.`);
    if (dup) notes.push(`${dup} combinations are within 3 % of another: duplicate ratios. Multi-ring setups always overlap, and the real number of distinct gears is smaller than rings × cogs.`);
    if (bigStep > 15) notes.push(`A ${fmt(bigStep)} % jump between adjacent ratios forces a cadence change of the same size. Wide-range cassettes trade step size for range.`);
    if (nChain < 2) notes.push('Chain FS < 2 at peak pedal force on the small ring. Small chainrings multiply chain tension (T = torque / pitch radius). That is why e-bike/tandem chains are heavier.');
    notes.push(`Cross-chaining (chainline angle > 2.5°) is excluded: ${combos.length - usable.length} combinations, including big–big and small–small. The chain runs at an angle, which wears teeth and drops efficiency.`);
    verdict(out, best.cadHere >= v.cadmin && nChain >= 2, `On ${v.grade}%: ride ${best.zr}×${best.zc} (ratio ${fmt(best.ratio)}, ${fmt(best.dev)} m per pedal turn)`, notes.join('<br>'));
    // table
    const tb = h('table', { class: 't' }, h('tr', null, ...['Ring×Cog', 'Ratio', 'Gear in', 'm / rev', `km/h @ ${v.cad}`, `rpm on ${v.grade}%`, 'Chainline °'].map(x => h('th', null, x))));
    [...combos].sort((a, b) => a.ratio - b.ratio).forEach(c => tb.append(h('tr', { class: c === best ? 'hl' : (c.cross > 2.5 ? 'fail' : '') }, ...[`${c.zr}×${c.zc}`, fmt(c.ratio), fmt(c.gi), fmt(c.dev), fmt(c.sp), fmt(c.cadHere), fmt(c.cross, 2)].map(x => h('td', null, String(x))))));
    out.append(h('details', null, h('summary', null, 'All gear combinations (red = cross-chained)'), h('div', { class: 'tablewrap' }, tb)));
    out.append(h('div', { class: 'eq' }, `ratio = z_ring / z_cog;  development = ratio × wheel circumference;  gear inches = ratio × wheel Ø (in)
road load F = m·g·(sin θ + Crr·cos θ) + ½·ρ·CdA·v²;   rider power η·P = F·v  →  speed v, then cadence = v / development
chain tension = pedal force × crank length / ring pitch radius,  r = p / (2 sin(180°/z)),  p = 12.7 mm`));
    // gear chart & speed vs gradient
    plot(c1, { title: 'Gear chart: speed at preferred cadence', xlabel: 'Cog teeth (rear)', ylabel: 'km/h', legend: 'tr', series: rings.map(zr => ({ label: zr + 'T ring', x: cogs, y: cogs.map(zc => zr / zc * C * v.cad / 60 * 3.6) })) });
    const grades = linspace(-2, 20, 45);
    plot(c2, { title: 'Cadence in your lowest & best gears vs gradient', xlabel: 'Gradient (%)', ylabel: 'Cadence (rpm)', ymin: 0, ymax: 160, legend: 'tr', hlines: [{ y: v.cadmin, label: 'min cadence' }], vlines: [{ x: v.grade }],
      series: [{ label: `Lowest gear ${low.zr}×${low.zc}`, x: grades, y: grades.map(gr => eqSpeed(v.P, v.mass, gr, v) / low.dev * 60) }, { label: `${best.zr}×${best.zc}`, x: grades, y: grades.map(gr => eqSpeed(v.P, v.mass, gr, v) / best.dev * 60), dash: [5, 3] }] });
    explain(`On a ${v.grade} percent gradient at ${v.P} watts you ride at ${fmt(vEq * 3.6)} kilometres per hour. The best gear is ${best.zr} by ${best.zc}, giving ${fmt(best.cadHere)} rpm. The lowest gear lets you climb ${fmt(gradeMax)} percent at ${v.cadmin} rpm. Peak chain tension is ${fmt(Tch / 1000)} kilonewtons, safety factor ${fmt(nChain)}.`);
  }
  const f = buildForm(L, specs, run, 'bicycle'); run(f.vals);
  let ph = 0;
  anim(() => {
    if (!A) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    const p = 12.7, zr = A.best.zr, zc = A.best.zc, R1 = sprocketR(p, zr), R2 = sprocketR(p, zc), Cd = Math.max(410, (R1 + R2) * 1.6);
    const sc = Math.min((w - 40) / (Cd + R1 + R2), (H - 50) / (2 * R1)), x2 = 20 + R2 * sc, x1 = x2 + Cd * sc, cy = H / 2 + 6;
    ph += A.cad / 60 * 2 * Math.PI * 0.016 * 0.5; // half real speed
    const teeth = (x, R, z, rot, col) => { ctx.fillStyle = col + '30'; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < z; k++) { const a0 = rot + k * 2 * Math.PI / z, a1 = a0 + Math.PI / z; const ro = (R + p * 0.3) * sc, ri = (R - p * 0.25) * sc;
        ctx.lineTo(x + ri * Math.cos(a0), cy + ri * Math.sin(a0)); ctx.lineTo(x + ro * Math.cos(a0 + 0.25 * Math.PI / z), cy + ro * Math.sin(a0 + 0.25 * Math.PI / z)); ctx.lineTo(x + ro * Math.cos(a1 - 0.25 * Math.PI / z), cy + ro * Math.sin(a1 - 0.25 * Math.PI / z)); ctx.lineTo(x + ri * Math.cos(a1), cy + ri * Math.sin(a1)); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, cy, 4, 0, 7); ctx.fill(); };
    teeth(x1, R1, zr, ph, '#c2410c'); teeth(x2, R2, zc, ph * zr / zc, '#0f5e8c');
    // crank arm
    const cl = Math.min(A.v.crank, R1 * 1.5) * sc; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, cy); ctx.lineTo(x1 + cl * Math.cos(ph), cy + cl * Math.sin(ph)); ctx.stroke();
    // chain runs (top = tight when pedalling forward)
    const dash = (y1, y2, col, wd) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -ph * R1 * sc; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); };
    dash(cy - R1 * sc, cy - R2 * sc, '#b42318', 4); dash(cy + R1 * sc, cy + R2 * sc, '#94a3b8', 2.5);
    tag(ctx, `Chainring ${zr}T`, x1, cy + R1 * sc + 16, '#c2410c', 'center'); tag(ctx, `Cog ${zc}T`, x2, cy + R2 * sc + 16, '#0f5e8c', 'center');
    tag(ctx, 'tight chain run (pulls the cog)', (x1 + x2) / 2, cy - Math.max(R1, R2) * sc - 12, '#b42318', 'center', 11);
    tag(ctx, 'crank', x1 + cl * Math.cos(ph) + 8, cy + cl * Math.sin(ph), '#1b2430', 'left', 11);
    tag(ctx, `ratio ${fmt(zr / zc)} : wheel turns ${fmt(zr / zc)}× per pedal turn`, 10, 12, '#1b2430', 'left', 12);
  });
}

function motorcycle(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [
    { section: 'Engine' },
    { id: 'Tmax', label: 'Peak torque', unit: 'N·m', value: 15, min: 3, max: 200, step: 0.5, aliases: ['torque', 'peak torque'] },
    { id: 'nT', label: '…at engine speed', unit: 'rpm', value: 7500, min: 2000, max: 14000, step: 100 },
    { id: 'Pmax', label: 'Peak power', unit: 'kW', value: 14, min: 2, max: 150, step: 0.5, aliases: ['power'] },
    { id: 'nP', label: '…at engine speed', unit: 'rpm', value: 9500, min: 2500, max: 16000, step: 100 },
    { id: 'red', label: 'Redline', unit: 'rpm', value: 10500, min: 3000, max: 17000, step: 100, aliases: ['redline'] },
    { section: 'Gearbox (constant mesh, 2 shafts)' },
    { id: 'prim', label: 'Primary reduction (crank → input shaft)', value: 3.0, min: 1.2, max: 4.5, step: 0.01, aliases: ['primary'] },
    { id: 'N', label: 'Number of gears', value: 5, min: 2, max: 7, step: 1, aliases: ['gears', 'number of gears'] },
    { id: 'i1', label: '1st gear ratio', value: 2.8, min: 1.5, max: 4, step: 0.01, aliases: ['first gear'] },
    { id: 'iN', label: 'Top gear ratio', value: 0.9, min: 0.6, max: 1.4, step: 0.01, aliases: ['top gear'] },
    { id: 'prog', label: 'Ratio spacing', type: 'select', options: ['Geometric (equal % steps)', 'Progressive (closer at top)'], value: 'Progressive (closer at top)', wide: true },
    { id: 'm', label: 'Gear module', unit: 'mm', value: 2.5, min: 1, max: 4, step: 0.25, aliases: ['module'] },
    { id: 'a', label: 'Shaft centre distance', unit: 'mm', value: 75, min: 30, max: 150, step: 1, aliases: ['centre distance', 'center distance'] },
    { id: 'k', label: 'Face width factor b = k·m', value: 9, min: 4, max: 12, step: 0.5 },
    { id: 'gmat', label: 'Gear material', type: 'select', options: GEAR_MAT_KEYS, value: GEAR_MAT_KEYS[4], wide: true },
    { section: 'Final chain & vehicle' },
    { id: 'zf', label: 'Front sprocket teeth', value: 14, min: 10, max: 20, step: 1, aliases: ['front sprocket'] },
    { id: 'zr', label: 'Rear sprocket teeth', value: 43, min: 30, max: 60, step: 1, aliases: ['rear sprocket'] },
    { id: 'chain', label: 'Chain', type: 'select', options: Object.keys(MOTO_CHAINS), value: Object.keys(MOTO_CHAINS)[1], wide: true },
    { id: 'rw', label: 'Tyre rolling radius', unit: 'm', value: 0.3, min: 0.2, max: 0.4, step: 0.005 },
    { id: 'mass', label: 'Bike + rider mass', unit: 'kg', value: 210, min: 100, max: 450, step: 5, aliases: ['mass'] },
    { id: 'CdA', label: 'Drag area CdA', unit: 'm²', value: 0.5, min: 0.2, max: 1, step: 0.01 },
    { id: 'Crr', label: 'Rolling resistance Crr', value: 0.015, min: 0.008, max: 0.03, step: 0.001 },
    { id: 'eta', label: 'Driveline efficiency', value: 0.9, min: 0.75, max: 0.97, step: 0.01 },
  ];
  const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(), c2 = plotCanvas(); cv.style.height = '250px'; c1.style.height = '330px';
  R.append(h('div', { class: 'card' }, cv, canvasLegend([['#c2410c', 'input shaft gears (driven by clutch)'], ['#0f5e8c', 'output shaft gears'], ['#2f7d32', 'pair currently engaged (dog clutch)']]), out),
    h('div', { class: 'card', style: { marginTop: '12px' } }, c1), h('div', { class: 'card', style: { marginTop: '12px' } }, c2));
  let G = null;
  function run(v) {
    const N = Math.round(v.N), wT = v.nT * 2 * Math.PI / 60, wP = v.nP * 2 * Math.PI / 60, TP = v.Pmax * 1000 / wP;
    const kq = v.nP !== v.nT ? Math.max(0, (v.Tmax - TP) / (v.nP - v.nT) ** 2) : 0;
    const T = n => Math.max(0.3 * v.Tmax, v.Tmax - kq * (n - v.nT) ** 2);
    // target ratios
    let ir = [];
    if (v.prog.startsWith('Geo') || N < 3) for (let k = 0; k < N; k++) ir.push(v.i1 * Math.pow(v.iN / v.i1, k / (N - 1)));
    else { const p2 = 1.06, p1 = Math.pow(v.i1 / (v.iN * Math.pow(p2, 0.5 * (N - 1) * (N - 2))), 1 / (N - 1)); for (let k = 1; k <= N; k++) ir.push(v.iN * Math.pow(p1, N - k) * Math.pow(p2, 0.5 * (N - k) * (N - k - 1))); }
    // constant-mesh teeth: z_in + z_out = 2a/m for every pair
    const zs = Math.round(2 * v.a / v.m), pairs = ir.map(i => { const zi = Math.round(zs / (1 + i)), zo = zs - zi; return { target: i, zi, zo, i: zo / zi }; });
    const ifd = v.zr / v.zf, eta = v.eta, rw = v.rw;
    const overall = pairs.map(p => v.prim * p.i * ifd);
    const vOf = (n, k) => n * 2 * Math.PI / 60 / overall[k] * rw; // m/s
    const Rl = (u, gr = 0) => v.mass * 9.81 * (v.Crr + gr) + 0.6 * v.CdA * u * u;
    const nMin = Math.max(1500, 0.25 * v.red);
    const curves = pairs.map((p, k) => { const ns = linspace(nMin, v.red, 60); return { x: ns.map(n => vOf(n, k) * 3.6), y: ns.map(n => T(n) * overall[k] * eta / rw), ns }; });
    // top speed: highest v where some gear's tractive force ≥ resistance, within redline
    let vTop = 0, gTop = 0; curves.forEach((c, k) => c.x.forEach((x, i) => { if (c.y[i] >= Rl(x / 3.6) && x > vTop) { vTop = x; gTop = k; } }));
    const grade1 = Math.max(...curves[0].y.map((F, i) => (F - 0.6 * v.CdA * (curves[0].x[i] / 3.6) ** 2) / (v.mass * 9.81) - v.Crr)) * 100;
    // shift drops
    const drops = pairs.slice(1).map((p, k) => v.red * p.i / pairs[k].i);
    // gear strength at peak torque in each gear: input-shaft speed nT/prim, power = Tmax·ωT
    const nIn = v.nT / v.prim, Pk = v.Tmax * wT / 1000;
    const str = pairs.map(p => {
      const small = Math.min(p.zi, p.zo), ratio = Math.max(p.zi, p.zo) / small, rpmSmall = p.zi <= p.zo ? nIn : nIn * p.zi / p.zo;
      const gv = { P: Pk, rpm: rpmSmall, i: ratio, z1: small, k: v.k, Cs: 1.25, pmat: v.gmat, gmat: v.gmat, grade: 'Precision hobbed/ground (Cv = 5.6/(5.6+√v))', n: 1.5 };
      return Object.assign(gearCalc(gv, v.m), { gv });
    });
    // final chain at max output torque (1st gear)
    const [pc, Fbr] = MOTO_CHAINS[v.chain], Tout = v.Tmax * v.prim * pairs[0].i, Fchain = Tout / (sprocketR(pc, v.zf) / 1000), nCh = Fbr / Fchain;
    const vChain = v.red / v.prim / pairs[N - 1].i * v.zf * pc / 60000; // m/s at redline top gear
    G = { v, pairs, eng: 0 };
    const wk = str.reduce((b, q, i) => Math.min(q.nb, q.nw) < Math.min(str[b].nb, str[b].nw) ? i : b, 0);
    out.innerHTML = '';
    out.append(h('div', { class: 'metrics' },
      metric('Top speed (power-limited or redline)', fmt(vTop), 'km/h'), metric('…reached in gear', gTop + 1, ''), metric('Max gradient in 1st', fmt(grade1) + ' %', '', grade1 > 30 ? 'good' : 'warn'),
      metric('Teeth sum z_in + z_out (all pairs)', zs, ''), metric('Smallest pinion', `${Math.min(...pairs.map(p => Math.min(p.zi, p.zo)))} T`, '', Math.min(...pairs.map(p => Math.min(p.zi, p.zo))) >= 14 ? 'good' : 'warn'),
      metric('Weakest gear pair FS (bend / wear)', `gear ${wk + 1}: ${fmt(str[wk].nb)} / ${fmt(str[wk].nw)}`, '', fsStatus(Math.min(str[wk].nb, str[wk].nw), 1.5)),
      metric('Final chain pull (1st, peak torque)', fmt(Fchain / 1000), 'kN'), metric('Chain FS vs breaking', fmt(nCh), '', fsStatus(nCh, 6)), metric('Chain speed at redline (top)', fmt(vChain), 'm/s', vChain < 25 ? 'good' : 'warn')));
    const tb = h('table', { class: 't' }, h('tr', null, ...['Gear', 'Target i', 'z_in : z_out', 'Actual i', 'Overall', 'km/h @ redline', 'rpm after upshift', 'FS bend', 'FS wear', ''].map(x => h('th', null, x))));
    pairs.forEach((p, k) => {
      const btn = h('button', { class: 'btn ghost sm', onclick: () => { store('form:gear', Object.assign({}, str[k].gv)); location.hash = 'gear'; } }, 'open in gear designer');
      tb.append(h('tr', { class: Math.min(str[k].nb, str[k].nw) < 1.5 ? 'fail' : '' }, ...[k + 1, fmt(p.target), `${p.zi} : ${p.zo}`, fmt(p.i, 4), fmt(overall[k], 4), fmt(vOf(v.red, k) * 3.6), k < N - 1 ? fmt(drops[k]) : '—', fmt(str[k].nb), fmt(str[k].nw)].map(x => h('td', null, String(x))), h('td', null, btn)));
    });
    out.append(h('div', { class: 'panel-title', style: { marginTop: '10px' } }, 'Gear train: ratios → teeth → strength (each pair checked at peak torque)'), h('div', { class: 'tablewrap' }, tb));
    const notes = [];
    if (Math.min(...pairs.map(p => Math.min(p.zi, p.zo))) < 14) notes.push('Pinions under ~14 teeth undercut with a standard 20° rack: gearbox makers use positive profile shift. Or increase the centre distance / reduce the module.');
    const worstDrop = Math.min(...drops); if (worstDrop < v.nT * 0.85) notes.push(`An upshift at redline drops the engine to ${fmt(worstDrop)} rpm, well below peak torque (${v.nT} rpm). The step is too wide; add a gear or close up the ratios.`);
    const ratErr = Math.max(...pairs.map(p => Math.abs(p.i / p.target - 1))) * 100; if (ratErr > 3) notes.push(`Integer teeth with one common centre distance shift ratios by up to ${fmt(ratErr)} % from target. Change the centre distance or module to get closer.`);
    if (nCh < 6) notes.push('Roller chains are sized with high static factors (≥ 6–8 on breaking load) because shock, wear elongation and fatigue dominate. Use a larger chain size or more front-sprocket teeth.');
    const sGov = str.reduce((a, b) => Math.min(b.nb, b.nw) < Math.min(a.nb, a.nw) ? b : a);
    notes.push('Tooth checks use Lewis + Buckingham (infinite-life, conservative). Production gearboxes are rated to finite life with AGMA 2001 / ISO 6336, which permits higher stress for the limited hours spent in 1st gear.');
    notes.push(`Gear strength governed by <b>${sGov.nb < sGov.nw ? 'tooth bending' : 'surface pitting'}</b>. The 1st-gear pinion is the smallest gear carrying the highest torque, which is why it is usually the critical one. The module (${v.m} mm) is shared by all pairs because the centre distance is common.`);
    verdict(out, Math.min(...str.map(s => Math.min(s.nb, s.nw))) >= 1.5 && nCh >= 6, `${N}-speed: ${pairs.map(p => fmt(p.i, 3)).join(' · ')} · primary ${v.prim} · final ${v.zf}/${v.zr}`, notes.join('<br>'));
    out.append(h('div', { class: 'eq' }, `overall ratio = primary × gearbox i × (z_rear/z_front);  v = ω_engine × r_wheel / overall
tractive force F = T(n) × overall × η / r_wheel;  road load = m·g·(Crr + grade) + ½ρ·CdA·v²
constant mesh: z_in + z_out = 2a/m for every pair;  pair strength: Lewis + Buckingham at peak torque (see Spur gear designer)`));
    out.append(h('div', { class: 'note', html: 'Next steps: size the <a href="#shaft">input and output shafts</a> for the 1st-gear torque (output shaft torque = ' + fmt(Tout) + ' N·m), check <a href="#bolt">sprocket bolts</a>, then bearings (not yet in MechDe).' }));
    plot(c1, { title: 'Tractive-effort diagram: force at the rear wheel vs road speed', xlabel: 'Road speed (km/h)', ylabel: 'Force (N)', ymin: 0, legend: 'tr',
      series: curves.map((c, k) => ({ label: `Gear ${k + 1}`, x: c.x, y: c.y })).concat([{ label: 'Resistance, flat', x: linspace(0, vTop * 1.15 + 10, 60), y: linspace(0, vTop * 1.15 + 10, 60).map(x => Rl(x / 3.6)), color: '#1b2430', dash: [5, 3] }, { label: 'Resistance, 10 % grade', x: linspace(0, vTop * 1.15 + 10, 60), y: linspace(0, vTop * 1.15 + 10, 60).map(x => Rl(x / 3.6, 0.1)), color: '#94a3b8', dash: [2, 3] }]) });
    plot(c2, { title: 'Engine speed vs road speed (saw-tooth shift pattern)', xlabel: 'Road speed (km/h)', ylabel: 'Engine rpm', ymin: 0, hlines: [{ y: v.nT, label: 'peak torque', color: '#2f7d32' }, { y: v.red, label: 'redline' }],
      series: curves.map((c, k) => ({ label: `G${k + 1}`, x: c.x, y: c.ns })) });
    explain(`${N} speed gearbox with ratios ${pairs.map(p => fmt(p.i, 3)).join(', ')}. Top speed about ${fmt(vTop)} kilometres per hour. First gear climbs ${fmt(grade1)} percent. The weakest gear pair has a safety factor of ${fmt(Math.min(...str.map(s => Math.min(s.nb, s.nw))))}, and the final chain safety factor is ${fmt(nCh)}.`);
  }
  const f = buildForm(L, specs, run, 'moto'); run(f.vals);
  let t = 0;
  anim(() => {
    if (!G) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    t += 0.016; const N = G.pairs.length, eng = Math.floor(t / 1.6) % N;
    const yIn = H * 0.3, yOut = yIn + G.v.a, x0 = 50, x1 = w - 30, pitch = (x1 - x0) / (N + 1);
    const sc = (H * 0.62) / (G.v.a * 1.7);
    const Yin = H * 0.18 + G.v.m * 0 + 30, Yout = Yin + G.v.a * sc;
    ctx.fillStyle = '#475569'; ctx.fillRect(x0 - 30, Yin - 3, x1 - x0 + 40, 6); ctx.fillRect(x0 - 10, Yout - 3, x1 - x0 + 30, 6);
    G.pairs.forEach((p, k) => {
      const x = x0 + pitch * (k + 1), ri = G.v.m * p.zi / 2 * sc, ro = G.v.m * p.zo / 2 * sc, on = k === eng, bw = Math.max(8, pitch * 0.35);
      ctx.fillStyle = on ? '#2f7d32' : '#c2410c88'; ctx.fillRect(x - bw / 2, Yin - ri, bw, 2 * ri);
      ctx.fillStyle = on ? '#2f7d32' : '#0f5e8c88'; ctx.fillRect(x - bw / 2, Yout - ro, bw, 2 * ro);
      if (on) { ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 2; ctx.strokeRect(x - bw / 2 - 2, Yin - ri - 2, bw + 4, 2 * ri + 2 * ro + (Yout - Yin - ri - ro) + 4); }
      tag(ctx, `${k + 1}`, x, Yout + ro + 12, on ? '#2f7d32' : '#4a5566', 'center', 12);
      tag(ctx, `${p.zi}:${p.zo}`, x, Yin - ri - 10, '#4a5566', 'center', 10, false);
    });
    tag(ctx, 'Input shaft (from clutch)', x0 - 28, Yin - 16 - G.v.m * 0, '#c2410c', 'left', 11);
    tag(ctx, 'Output shaft → front sprocket → chain → rear wheel', x0 - 8, Math.min(H - 10, Yout + Math.max(...G.pairs.map(p => G.v.m * p.zo / 2 * sc)) + 28), '#0f5e8c', 'left', 11);
    tag(ctx, `Gear ${eng + 1} engaged: i = ${fmt(G.pairs[eng].i, 3)}`, w - 12, 12, '#2f7d32', 'right', 12);
  });
}
