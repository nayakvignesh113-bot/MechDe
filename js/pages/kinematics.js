'use strict';
MD.register('kinematics', {
  group: 'Foundations', title: 'Kinematics lab', icon: '🔗', voice: 'kinematics four bar linkage cam mechanism',
  render(main) {
    pageHead(main, 'Kinematics of machines', 'Motion first: linkages and cams',
      'Kinematics fixes <b>geometry and motion</b> before any force is known: link lengths, stroke, speed ratio, timing. Its outputs (velocities, <b>accelerations</b>, transmission angles) are the inputs of dynamics: no acceleration, no inertia force. A bad transmission angle or a jerky cam profile cannot be cured later by a stronger material.');
    const body = h('div');
    tabs(main, ['Four-bar linkage', 'Cam & follower (SVAJ)'], i => { if (MD.cleanup) { MD.cleanup(); MD.cleanup = null; } body.innerHTML = ''; [fourBar, cam][i](body); });
    main.append(body);
  }
});

function fourBar(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  L.append(h('div', { class: 'panel-title' }, 'Links (any length unit)'));
  const specs = [
    { id: 'r1', label: 'Ground link r1', value: 100, min: 10, max: 300, step: 1, aliases: ['ground'] },
    { id: 'r2', label: 'Input crank r2', value: 40, min: 5, max: 300, step: 1, aliases: ['crank', 'input'] },
    { id: 'r3', label: 'Coupler r3', value: 110, min: 5, max: 300, step: 1, aliases: ['coupler'] },
    { id: 'r4', label: 'Output rocker r4', value: 80, min: 5, max: 300, step: 1, aliases: ['rocker', 'output'] },
    { id: 'p', label: 'Coupler point distance from A', value: 70, min: 0, max: 300, step: 1 },
    { id: 'delta', label: 'Coupler point angle', unit: '°', value: 35, min: -180, max: 180, step: 1 },
    { id: 'rpm', label: 'Input speed', unit: 'rpm', value: 60, min: 1, max: 600, step: 1, aliases: ['speed', 'rpm'] },
    { id: 'branch', label: 'Assembly', type: 'select', options: ['open', 'crossed'], value: 'open' },
  ];
  const cv = plotCanvas('anim'), c1 = plotCanvas(), c2 = plotCanvas(), info = h('div');
  R.append(h('div', { class: 'card' }, cv, info), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
  let V, sol = null;
  function pos(v, t2) {
    const A = [v.r2 * Math.cos(t2), v.r2 * Math.sin(t2)], O4 = [v.r1, 0];
    const dx = O4[0] - A[0], dy = O4[1] - A[1], D = Math.hypot(dx, dy);
    if (D > v.r3 + v.r4 || D < Math.abs(v.r3 - v.r4)) return null;
    const a = (v.r3 * v.r3 - v.r4 * v.r4 + D * D) / (2 * D), hh = Math.sqrt(Math.max(0, v.r3 * v.r3 - a * a));
    const sg = v.branch === 'open' ? 1 : -1;
    const B = [A[0] + a * dx / D - sg * hh * dy / D, A[1] + a * dy / D + sg * hh * dx / D];
    const t3 = Math.atan2(B[1] - A[1], B[0] - A[0]), t4 = Math.atan2(B[1] - O4[1], B[0] - O4[0]);
    const mu = Math.acos(clamp((v.r3 ** 2 + v.r4 ** 2 - D * D) / (2 * v.r3 * v.r4), -1, 1));
    const P = [A[0] + v.p * Math.cos(t3 + v.delta * deg), A[1] + v.p * Math.sin(t3 + v.delta * deg)];
    return { A, B, O4, t3, t4, mu, P };
  }
  const unwrap = arr => { for (let i = 1; i < arr.length; i++) { while (arr[i] - arr[i - 1] > Math.PI) arr[i] -= 2 * Math.PI; while (arr[i] - arr[i - 1] < -Math.PI) arr[i] += 2 * Math.PI; } return arr; };
  function run(v) {
    V = v;
    const ls = [v.r1, v.r2, v.r3, v.r4], s = Math.min(...ls), l = Math.max(...ls), pq = ls.reduce((a, b) => a + b) - s - l;
    const grashof = s + l < pq - 1e-9, change = Math.abs(s + l - pq) < 1e-9;
    let type;
    if (change) type = 'Change-point (special Grashof): may flip branch at collinear positions';
    else if (!grashof) type = 'Non-Grashof triple rocker: no link can rotate fully';
    else if (s === v.r1) type = 'Drag-link (double crank): both side links rotate fully';
    else if (s === v.r2) type = 'Crank-rocker: input crank rotates fully, output rocks';
    else if (s === v.r4) type = 'Rocker-crank: output rotates fully, input only rocks';
    else type = 'Double rocker (coupler is shortest and rotates fully)';
    const N = 361, t2s = linspace(0, 2 * Math.PI, N), recs = t2s.map(t => pos(v, t));
    const ok = recs.map(r => !!r), valid = ok.filter(Boolean).length;
    const w2 = v.rpm * 2 * Math.PI / 60;
    const t4 = unwrap(recs.map(r => r ? r.t4 : NaN).map((x, i, a) => isNaN(x) ? (a[i - 1] ?? 0) : x));
    const dt = 2 * Math.PI / (N - 1);
    const w4 = t4.map((x, i) => ok[i] ? w2 * (t4[Math.min(N - 1, i + 1)] - t4[Math.max(0, i - 1)]) / ((Math.min(N - 1, i + 1) - Math.max(0, i - 1)) * dt) : NaN);
    const a4 = w4.map((x, i) => ok[i] ? w2 * (w4[Math.min(N - 1, i + 1)] - w4[Math.max(0, i - 1)]) / ((Math.min(N - 1, i + 1) - Math.max(0, i - 1)) * dt) : NaN);
    const mu = recs.map(r => r ? r.mu / deg : NaN);
    const muMin = Math.min(...mu.filter(isFinite)), muMax = Math.max(...mu.filter(isFinite));
    const muDev = Math.max(90 - muMin, muMax - 90);
    const xs = t2s.map(t => t / deg);
    plot(c1, { title: 'Output angular velocity & acceleration', xlabel: 'Input angle θ2 (°)', ylabel: 'ω4 (rad/s)', series: [{ label: 'ω4', x: xs, y: w4 }, { label: 'α4 / 10 (rad/s²)', x: xs, y: a4.map(a => a / 10), dash: [5, 3] }] });
    plot(c2, { title: 'Transmission angle μ', xlabel: 'Input angle θ2 (°)', ylabel: 'μ (°)', ymin: 0, ymax: 180, bands: [], hlines: [{ y: 40, label: '40° min', color: '#b26a00' }, { y: 140, label: '140° max', color: '#b26a00' }], series: [{ x: xs, y: mu, color: '#2f7d32' }] });
    // quick-return for crank-rocker
    let tr = null;
    if (grashof && s === v.r2) {
      const c1a = Math.acos(clamp((v.r1 ** 2 + (v.r3 + v.r2) ** 2 - v.r4 ** 2) / (2 * v.r1 * (v.r3 + v.r2)), -1, 1));
      const c2a = Math.acos(clamp((v.r1 ** 2 + (v.r3 - v.r2) ** 2 - v.r4 ** 2) / (2 * v.r1 * (v.r3 - v.r2)), -1, 1));
      const alpha = Math.abs(c2a - c1a) / deg; tr = (180 + alpha) / (180 - alpha);
    }
    const coupler = recs.filter(Boolean).map(r => r.P);
    sol = { recs, ok, coupler, valid, grashof, s, type };
    info.innerHTML = '';
    info.append(h('div', { class: 'metrics' },
      metric('Grashof check s + l vs p + q', `${fmt(s + l)} ${grashof ? '<' : change ? '=' : '>'} ${fmt(pq)}`, '', grashof ? 'good' : 'warn'),
      metric('Assemblable range of θ2', fmt(valid / N * 360, 3), '°', valid === N ? 'good' : 'warn'),
      metric('Transmission angle range', `${fmt(muMin)}–${fmt(muMax)}`, '°', muDev <= 50 ? 'good' : muDev <= 70 ? 'warn' : 'bad'),
      metric('Max ω4', fmt(Math.max(...w4.filter(isFinite).map(Math.abs))), 'rad/s'),
      metric('Max α4', fmt(Math.max(...a4.filter(isFinite).map(Math.abs))), 'rad/s²'),
      tr ? metric('Time ratio (quick return)', fmt(tr), '') : metric('Time ratio', 'n/a', '')));
    info.append(h('div', { class: 'note', html: `<b>${type}.</b> ${muDev > 50 ? `The transmission angle strays ${fmt(muDev)}° from 90°: near μ ≈ 0° or 180° the coupler pushes along the rocker's axis, force amplification blows up, and friction can jam the linkage. Keep 40° ≤ μ ≤ 140°.` : 'Transmission angle stays in the healthy 40–140° window, so force transmits efficiently.'} <b>Dynamics link:</b> the α4 peak × rocker inertia is the torque the rocker shaft and bearings must carry. Kinematics already decided it.` }));
    explain(`${type}. Transmission angle ranges from ${fmt(muMin)} to ${fmt(muMax)} degrees. ${tr ? 'Quick return time ratio is ' + fmt(tr) + '.' : ''}`);
  }
  const f = buildForm(L, specs, run, 'fourbar'); run(f.vals);
  let t2 = 0, dir = 1;
  anim(dt => {
    if (!sol) return;
    const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    const v = V, pts = [[0, 0], [v.r1, 0], ...sol.coupler];
    sol.recs.forEach(r => r && pts.push(r.B, r.A));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min((w - 40) / (x1 - x0 || 1), (H - 40) / (y1 - y0 || 1));
    const X = p => 20 + (p[0] - x0) * sc + ((w - 40) - (x1 - x0) * sc) / 2, Y = p => H - 20 - (p[1] - y0) * sc - ((H - 40) - (y1 - y0) * sc) / 2;
    // advance angle
    const step = Math.min(0.05, 2 * Math.PI * v.rpm / 60 * 0.016 * 0.4);
    let nt = t2 + dir * step, k = Math.round(((nt % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * 360);
    if (!sol.ok[k]) { dir = -dir; nt = t2 + dir * step; }
    t2 = nt;
    const r = pos(v, t2); if (!r) { t2 += dir * 0.1; return; }
    ctx.strokeStyle = '#c2410c55'; ctx.lineWidth = 1.5; ctx.beginPath(); sol.coupler.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.stroke();
    const O2 = [0, 0];
    ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(O2), Y(O2)); ctx.lineTo(X(r.O4), Y(r.O4)); ctx.stroke(); ctx.setLineDash([]);
    const link = (a, b, col, wd) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); };
    ctx.fillStyle = '#0f5e8c22'; ctx.beginPath(); ctx.moveTo(X(r.A), Y(r.A)); ctx.lineTo(X(r.B), Y(r.B)); ctx.lineTo(X(r.P), Y(r.P)); ctx.closePath(); ctx.fill();
    link(O2, r.A, '#c2410c', 7); link(r.A, r.B, '#0f5e8c', 7); link(r.O4, r.B, '#2f7d32', 7);
    link(r.A, r.P, '#0f5e8c88', 2); link(r.B, r.P, '#0f5e8c88', 2);
    [O2, r.O4].forEach(p => { ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.moveTo(X(p), Y(p)); ctx.lineTo(X(p) - 9, Y(p) + 13); ctx.lineTo(X(p) + 9, Y(p) + 13); ctx.fill(); });
    [r.A, r.B, O2, r.O4].forEach(p => { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(p), Y(p), 5, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(X(r.P), Y(r.P), 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b2430'; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`θ2 = ${fmt(((t2 / deg) % 360 + 360) % 360, 3)}°   μ = ${fmt(r.mu / deg, 3)}°`, 10, 18);
    ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillStyle = '#4a5566'; ctx.fillText('crank (orange) · coupler (blue) · rocker (green) · coupler curve', 10, H - 8);
  });
}

function cam(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
  g.append(L, R); body.append(g);
  const LAWS = ['Constant velocity', 'Parabolic (uniform accel.)', 'Simple harmonic', 'Cycloidal', '3-4-5 polynomial'];
  L.append(h('div', { class: 'panel-title' }, 'Follower programme (radial roller follower)'));
  const specs = [
    { id: 'law', label: 'Motion law', type: 'select', options: LAWS, value: 'Simple harmonic', wide: true, aliases: ['law', 'motion'] },
    { id: 'hft', label: 'Lift h', unit: 'mm', value: 25, min: 2, max: 80, step: 0.5, aliases: ['lift'] },
    { id: 'b1', label: 'Rise angle', unit: '°', value: 120, min: 20, max: 200, step: 1, aliases: ['rise'] },
    { id: 'd1', label: 'Dwell after rise', unit: '°', value: 40, min: 0, max: 180, step: 1 },
    { id: 'b2', label: 'Return angle', unit: '°', value: 120, min: 20, max: 200, step: 1, aliases: ['return'] },
    { id: 'Rb', label: 'Base circle radius', unit: 'mm', value: 40, min: 10, max: 150, step: 1, aliases: ['base circle'] },
    { id: 'Rr', label: 'Roller radius', unit: 'mm', value: 10, min: 2, max: 40, step: 0.5, aliases: ['roller'] },
    { id: 'rpm', label: 'Cam speed', unit: 'rpm', value: 600, min: 10, max: 3000, step: 10, aliases: ['speed', 'rpm'] },
    { id: 'mf', label: 'Follower + train mass', unit: 'kg', value: 0.8, min: 0.05, max: 10, step: 0.05, aliases: ['mass'] },
  ];
  const cv = plotCanvas('anim'), c1 = plotCanvas(), info = h('div');
  c1.style.height = '330px';
  R.append(h('div', { class: 'card' }, cv, info), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  let S = null;
  function lawfn(law, u) { // u in [0,1] → s/h, ds/du, d2s/du2, d3s/du3
    switch (law) {
      case 'Constant velocity': return [u, 1, 0, 0];
      case 'Parabolic (uniform accel.)': return u < 0.5 ? [2 * u * u, 4 * u, 4, 0] : [1 - 2 * (1 - u) ** 2, 4 * (1 - u), -4, 0];
      case 'Simple harmonic': return [(1 - Math.cos(Math.PI * u)) / 2, Math.PI / 2 * Math.sin(Math.PI * u), Math.PI ** 2 / 2 * Math.cos(Math.PI * u), -(Math.PI ** 3) / 2 * Math.sin(Math.PI * u)];
      case 'Cycloidal': return [u - Math.sin(2 * Math.PI * u) / (2 * Math.PI), 1 - Math.cos(2 * Math.PI * u), 2 * Math.PI * Math.sin(2 * Math.PI * u), 4 * Math.PI ** 2 * Math.cos(2 * Math.PI * u)];
      default: return [10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5, 30 * u * u - 60 * u ** 3 + 30 * u ** 4, 60 * u - 180 * u * u + 120 * u ** 3, 60 - 360 * u + 360 * u * u];
    }
  }
  function run(v) {
    const tot = v.b1 + v.d1 + v.b2; if (tot > 360) { info.innerHTML = '<div class="badbox">Rise + dwell + return exceed 360°.</div>'; return; }
    const w = v.rpm * 2 * Math.PI / 60, N = 721, th = linspace(0, 360, N);
    const s = [], vv = [], a = [], j = [];
    th.forEach(t => {
      let r;
      if (t <= v.b1) { const u = t / v.b1, f = lawfn(v.law, u), B = v.b1 * deg; r = [v.hft * f[0], v.hft * f[1] / B, v.hft * f[2] / B ** 2, v.hft * f[3] / B ** 3]; }
      else if (t <= v.b1 + v.d1) r = [v.hft, 0, 0, 0];
      else if (t <= tot) { const u = (t - v.b1 - v.d1) / v.b2, f = lawfn(v.law, u), B = v.b2 * deg; r = [v.hft * (1 - f[0]), -v.hft * f[1] / B, -v.hft * f[2] / B ** 2, -v.hft * f[3] / B ** 3]; }
      else r = [0, 0, 0, 0];
      s.push(r[0]); vv.push(r[1] * w / 1000); a.push(r[2] * w * w / 1000); j.push(r[3] * w ** 3 / 1000);
    });
    const ds = s.map((_, i) => (vv[i] * 1000 / w)); // mm/rad
    const press = s.map((x, i) => Math.atan(ds[i] / (v.Rb + v.Rr + x)) / deg);
    const pmax = Math.max(...press.map(Math.abs));
    const amax = Math.max(...a.map(Math.abs)), aneg = Math.min(...a), jmax = Math.max(...j.map(Math.abs));
    const Fspring = v.mf * -aneg; // N needed to keep contact during deceleration
    const disc = (v.law === 'Constant velocity') ? 'infinite (velocity jumps)' : (v.law !== 'Cycloidal' && v.law !== '3-4-5 polynomial') ? 'infinite spikes (acceleration jumps)' : 'finite';
    // min radius of curvature of pitch curve (undercutting check)
    const Rp = s.map(x => v.Rb + v.Rr + x); let rhoMin = Infinity;
    for (let i = 1; i < N - 1; i++) { const dth = 0.5 * deg; const r = Rp[i], r1 = (Rp[i + 1] - Rp[i - 1]) / (2 * dth), r2 = (Rp[i + 1] - 2 * r + Rp[i - 1]) / (dth * dth); const rho = Math.pow(r * r + r1 * r1, 1.5) / (r * r + 2 * r1 * r1 - r * r2); if (rho > 0) rhoMin = Math.min(rhoMin, rho); }
    S = { s, th, v };
    plot(c1, { title: 'SVAJ: displacement, velocity, acceleration, jerk (normalised to peak)', xlabel: 'Cam angle (°)', ylabel: 'value / max', ymin: -1.1, ymax: 1.1, legend: 'tr', series: [
      { label: `s (max ${fmt(v.hft)} mm)`, x: th, y: s.map(x => x / v.hft) },
      { label: `v (max ${fmt(Math.max(...vv.map(Math.abs)))} m/s)`, x: th, y: vv.map(x => x / Math.max(...vv.map(Math.abs))) },
      { label: `a (max ${fmt(amax)} m/s²)`, x: th, y: a.map(x => x / amax) },
      { label: `j (max ${fmt(jmax)} m/s³)`, x: th, y: j.map(x => x / jmax), dash: [3, 3] }] });
    info.innerHTML = '';
    info.append(h('div', { class: 'metrics' },
      metric('Max pressure angle', fmt(pmax), '°', pmax <= 30 ? 'good' : pmax <= 35 ? 'warn' : 'bad'),
      metric('Peak acceleration', fmt(amax), 'm/s²'), metric('Jerk at boundaries', disc, '', disc === 'finite' ? 'good' : 'bad'),
      metric('Spring force to keep contact', fmt(Fspring), 'N', null, 'mass × max deceleration; add preload margin'),
      metric('Min pitch-curve radius ρ', fmt(rhoMin), 'mm', rhoMin > v.Rr ? 'good' : 'bad')));
    const notes = [];
    if (pmax > 30) notes.push(`Pressure angle ${fmt(pmax)}° > 30°: side thrust on the follower stem may jam it. Increase the base circle or the rise angle.`);
    if (rhoMin <= v.Rr) notes.push('Pitch-curve radius smaller than roller radius: the cam profile undercuts (loops) and the follower cannot track it. Increase the base circle or reduce the roller.');
    if (disc !== 'finite') notes.push(`${v.law} has ${disc} at the start/end of motion. At ${v.rpm} rpm that means impact, noise, and spring surge. Cycloidal or 3-4-5 polynomial keep acceleration continuous.`);
    info.append(h('div', { class: 'note', html: (notes.length ? notes.map(n => '⚠ ' + n).join('<br>') + '<br>' : '✓ Profile is kinematically sound. ') + `<b>Chain:</b> kinematics → peak deceleration ${fmt(-aneg)} m/s² → dynamics: retaining spring needs ≥ ${fmt(Fspring)} N → design the spring (<a href="#spring">Spring designer</a>), its surge frequency must be well above ${fmt(v.rpm / 60)} Hz × harmonics.` }));
    explain(`${v.law} cam. Peak pressure angle ${fmt(pmax)} degrees, peak acceleration ${fmt(amax)} metres per second squared, which needs a retaining spring force of at least ${fmt(Fspring)} newtons.`);
  }
  const f = buildForm(L, specs, run, 'cam'); run(f.vals);
  let ang = 0;
  anim(dt => {
    if (!S) return; const v = S.v;
    const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    ang = (ang + 0.9) % 360;
    const Rmax = v.Rb + v.Rr + v.hft, sc = Math.min(w * 0.45, H * 0.42) / (Rmax + v.Rr * 2 + v.hft), cx = w * 0.42, cy = H * 0.62;
    const idx = a => Math.round(((a % 360) + 360) % 360 * 2);
    // pitch curve rotate: cam rotates clockwise → follower sees angle 'ang'
    ctx.beginPath();
    for (let k = 0; k <= 720; k++) { const t = k / 2, R = v.Rb + S.s[k] + v.Rr, phi = (90 + t - ang) * deg; const px = cx + R * Math.cos(phi) * sc, py = cy - R * Math.sin(phi) * sc; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    // cam profile approx: inner offset of pitch curve by Rr (radial approximation for display)
    ctx.beginPath();
    for (let k = 0; k <= 720; k++) { const t = k / 2, R = v.Rb + S.s[k], phi = (90 + t - ang) * deg; const px = cx + R * Math.cos(phi) * sc, py = cy - R * Math.sin(phi) * sc; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.fillStyle = '#0f5e8c22'; ctx.fill(); ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
    const sNow = S.s[idx(ang)], yR = cy - (v.Rb + v.Rr + sNow) * sc;
    ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, yR, v.Rr * sc, 0, 7); ctx.stroke();
    ctx.fillStyle = '#c2410c'; ctx.fillRect(cx - 4, 16, 8, yR - 16 - v.Rr * sc + 2);
    // spring zigzag
    ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = 1.5; ctx.beginPath(); const top = 8, bot = Math.max(top + 20, yR - v.Rr * sc - 30);
    for (let i = 0; i <= 12; i++) { const y = top + (bot - top) * i / 12; ctx.lineTo(cx + (i % 2 ? 14 : -14), y); } ctx.stroke();
    // displacement trace
    const gx = w * 0.72, gw = w * 0.26, gy = H * 0.2, gh = H * 0.5;
    ctx.strokeStyle = '#cbd5e1'; ctx.strokeRect(gx, gy, gw, gh);
    ctx.beginPath(); for (let k = 0; k <= 720; k += 4) { const x = gx + gw * k / 720, y = gy + gh - gh * S.s[k] / v.hft; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = '#0f5e8c'; ctx.stroke();
    const mx = gx + gw * ang / 360; ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(mx, gy + gh - gh * sNow / v.hft, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a5566'; ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillText('follower lift vs cam angle', gx, gy - 6);
    ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillStyle = '#1b2430'; ctx.fillText(`θ = ${fmt(ang, 3)}°  s = ${fmt(sNow)} mm`, 10, H - 10);
  });
}
