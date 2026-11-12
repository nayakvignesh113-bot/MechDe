'use strict';
MD.register('balancebike', {
  group: 'Products', title: 'Self-balancing bikes', icon: '🛵', voice: 'self balancing bike motorcycle gyroscope honda lit motors',
  kid: { what: 'A bike is an <b>upside-down pendulum</b>: it wants to fall. You will build the "brain" that keeps it up, by steering (like Honda) or with spinning gyroscopes (like Lit Motors).', steps: ['Press ▶ Start and watch the bike balance.', 'Press 👉 Push to shove it sideways.', 'Turn the controller gains down until it falls, then fix it.'], try: 'Set speed to 0 and contact shift to "normal trail": steering alone cannot save it at standstill. Now switch to "negative trail".' },
  eq: [
    { t: 'Lean dynamics (inverted pendulum + steering)', f: "θ̈ = (g/h)·θ − (g/h²)·c·δ − (v²/(b·h))·δ − (a·v/(b·h))·δ̇", s: [['θ', 'lean angle'], ['δ', 'steer angle'], ['h', 'centre-of-mass height'], ['b', 'wheelbase'], ['a', 'CoM ahead of rear contact'], ['c', 'sideways contact-patch shift per radian of steer (trail geometry)']], fx: [['faster (v)', 'steering is much more powerful (∝ v²): bikes balance easily at speed'], ['v = 0', 'only the contact-patch shift c helps, so Honda makes c large with negative trail']] },
    { t: 'Controller (PD)', f: 'δ = Kp·θ + Kd·θ̇   (steer into the fall)', fx: [['too little Kp', 'falls'], ['too little Kd', 'wobbles (oscillation)']] },
    { t: 'Gyroscopic torque (CMG)', f: 'τ = I_spin·ω_spin·Ω_gimbal', fx: [['spin the flywheel faster', 'more torque without more mass']] },
    { t: 'Torque to hold a lean', f: 'τ = m·g·h·sin θ', m: 'The gyros must at least beat gravity at the largest lean you want to recover from.' },
  ],
  render(main) {
    pageHead(main, 'Products · dynamics + control', 'How are self-balancing bikes made?',
      'A two-wheeler is an <b>inverted pendulum</b>: unstable, it falls unless something moves the support back under the centre of mass. Riders do it by steering into the fall. A self-balancing bike replaces the rider\'s brain with a sensor (an IMU measuring lean), a controller, and an actuator. Two families exist: <b>steering-based</b> (Honda Riding Assist, Yamaha AMSAS) and <b>gyroscope-based</b> (Lit Motors C-1).');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'mode', label: 'Balancing method', type: 'select', options: ['Steering (Honda-style)', 'Gyroscope (CMG)'], value: 'Steering (Honda-style)', wide: true, aliases: ['method'] },
      { id: 'v', label: 'Speed', unit: 'km/h', value: 3, min: 0, max: 40, step: 0.5, aliases: ['speed'] },
      { id: 'cmode', label: 'Front geometry', type: 'select', options: ['Negative trail (Honda at low speed)', 'Normal trail'], value: 'Negative trail (Honda at low speed)', wide: true, tip: 'At standstill Honda tilts the fork so the contact patch moves sideways a lot when steering: this "moves the support" under the bike.' },
      { id: 'Kp', label: 'Controller strength Kp', value: 8, min: 0, max: 25, step: 0.1, aliases: ['gain', 'kp'] },
      { id: 'Kd', label: 'Controller damping Kd', value: 2, min: 0, max: 6, step: 0.05, aliases: ['damping', 'kd'] },
      { id: 'm', label: 'Bike + rider mass', unit: 'kg', value: 300, min: 50, max: 600, step: 5 },
      { id: 'hc', label: 'Centre-of-mass height', unit: 'm', value: 0.7, min: 0.3, max: 1.2, step: 0.01 },
      { id: 'b', label: 'Wheelbase', unit: 'm', value: 1.5, min: 0.9, max: 2, step: 0.01 },
      { id: 'gyroT', label: 'Gyro torque capacity (CMG mode)', unit: 'N·m', value: 800, min: 50, max: 3000, step: 10 },
      { id: 'dmax', label: 'Max steer angle', unit: '°', value: 30, min: 5, max: 45, step: 1 },
    ];
    const cv = plotCanvas('anim'), c1 = plotCanvas(), info = h('div'), bar = h('div', { class: 'toolbar' }); cv.style.height = '280px';
    R.append(h('div', { class: 'card' }, bar, cv, info), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
    let V, st = { th: 0.05, w: 0, d: 0, t: 0, run: true, fell: false, hist: [] };
    const reset = () => { st = { th: 0.05, w: 0, d: 0, t: 0, run: true, fell: false, hist: [] }; };
    bar.append(h('button', { class: 'btn acc', onclick: () => { reset(); } }, '▶ Start / reset'), h('button', { class: 'btn ghost', onclick: () => { st.w += 0.6; } }, '👉 Push'), h('button', { class: 'btn ghost', onclick: () => { st.run = !st.run; } }, '⏯ Pause'));
    function accel(th, w, d, dd, v) {
      const g = 9.81, hh = v.hc, vel = v.v / 3.6, a = 0.45 * v.b, c = v.cmode.startsWith('Neg') ? 0.12 : 0.02;
      if (v.mode.startsWith('Gyro')) { const tau = clamp(-(v.Kp * 120 * th + v.Kd * 120 * w) * v.m * hh / 30, -v.gyroT, v.gyroT); return (g / hh) * Math.sin(th) + tau / (v.m * hh * hh); }
      return (g / hh) * Math.sin(th) - (g / (hh * hh)) * c * d - (vel * vel / (v.b * hh)) * d - (a * vel / (v.b * hh)) * dd;
    }
    function step(dt) {
      const v = V; if (!v || !st.run || st.fell) return;
      for (let k = 0; k < 10; k++) {
        const h2 = dt / 10, dmx = v.dmax * deg;
        const dTarget = clamp(v.Kp * st.th + v.Kd * st.w, -dmx, dmx), dd = clamp((dTarget - st.d) / 0.05, -4, 4); // steering motor: rate limited 4 rad/s
        st.d += dd * h2; const acc = accel(st.th, st.w, st.d, dd, v); st.w += acc * h2; st.th += st.w * h2; st.t += h2;
        if (Math.abs(st.th) > 0.6) { st.fell = true; break; }
      }
      st.hist.push([st.t, st.th / deg, st.d / deg]); if (st.hist.length > 600) st.hist.shift();
    }
    function run(v) { V = v;
      const tauHold = v.m * 9.81 * v.hc * Math.sin(10 * deg), If = v.gyroT / (600 * 2 * Math.PI / 60 * 1.5); // spin 6000 rpm? use 600 rad/s representation below
      const ws = 6000 * 2 * Math.PI / 60, Om = 1.5, Ireq = v.gyroT / (ws * Om), r = 0.15, mFly = 2 * Ireq / (r * r);
      info.innerHTML = ''; info.append(h('div', { class: 'metrics' }, metric('Torque to hold 10° lean', fmt(tauHold), 'N·m'), metric('Gyro capacity', fmt(v.gyroT), 'N·m', v.gyroT > tauHold ? 'good' : 'bad'), metric('Flywheel inertia for that (6000 rpm, 1.5 rad/s gimbal)', fmt(Ireq), 'kg·m²'), metric('…as a 300 mm disc', fmt(mFly), 'kg')));
      explain(`${v.mode}. At ${v.v} kilometres per hour, the controller ${st.fell ? 'lost' : 'is holding'} the bike.`); }
    const f = buildForm(L, specs, v => { run(v); reset(); }, 'bikebal'); run(f.vals);
    let last = 0;
    anim(t => {
      const dt = Math.min(0.05, t - last); last = t; step(dt);
      const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      const gx = w * 0.32, gy = H - 30, L0 = H * 0.65;
      ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(10, gy); ctx.lineTo(w * 0.62, gy); ctx.stroke();
      const sh = (V && V.cmode.startsWith('Neg') ? 0.12 : 0.02) * st.d * 400; // contact-patch shift (exaggerated)
      const x0 = gx + sh, x1 = x0 + L0 * Math.sin(st.th), y1 = gy - L0 * Math.cos(st.th);
      ctx.strokeStyle = st.fell ? '#b42318' : '#1b2430'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, gy - 8); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.ellipse(x0, gy - 8, 9, 14, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(x1, y1, 16, 0, 7); ctx.fill(); tag(ctx, 'centre of mass', x1 + 20, y1, '#c2410c', 'left', 11);
      ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 30, gy + 14); ctx.lineTo(x0 - 30 + 60 * Math.cos(st.d), gy + 14 - 60 * Math.sin(st.d) * 0.3); ctx.stroke(); tag(ctx, 'handlebar (top view)', x0 - 30, gy + 24, '#2f7d32', 'left', 10, false);
      if (V && V.mode.startsWith('Gyro')) { const ga = t * 20; ctx.strokeStyle = '#7b3fa0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (gy + y1) / 2, 18, 6 + 4 * Math.sin(ga), st.th, 0, 7); ctx.stroke(); tag(ctx, 'gyros', (x0 + x1) / 2 + 22, (gy + y1) / 2, '#7b3fa0', 'left', 11); }
      tag(ctx, st.fell ? '💥 It fell! Increase Kp/Kd, speed, or switch geometry, then press Start.' : `lean ${fmt(st.th / deg, 2)}°   steer ${fmt(st.d / deg, 2)}°`, 10, 14, st.fell ? '#b42318' : '#1b2430', 'left', 13);
      // live plot (mini)
      const px0 = w * 0.66, pw = w * 0.32, py0 = 30, ph = H - 60; ctx.strokeStyle = '#e5e1d6'; ctx.strokeRect(px0, py0, pw, ph); ctx.beginPath(); ctx.moveTo(px0, py0 + ph / 2); ctx.lineTo(px0 + pw, py0 + ph / 2); ctx.stroke();
      const hs = st.hist; if (hs.length > 1) { const t0 = hs[0][0], t1 = hs[hs.length - 1][0] || 1; [[1, '#c2410c'], [2, '#2f7d32']].forEach(([j, col]) => { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); hs.forEach((q, i) => { const X = px0 + (q[0] - t0) / Math.max(t1 - t0, 1e-3) * pw, Y = py0 + ph / 2 - clamp(q[j], -35, 35) / 35 * ph / 2; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }); }
      tag(ctx, 'lean (orange) & steer (green) vs time', px0, py0 - 10, '#4a5566', 'left', 10, false);
    });
    const vs = linspace(0, 30, 61);
    plot(c1, { title: 'Why speed makes balancing easy: steering authority vs speed', xlabel: 'Speed (km/h)', ylabel: 'Restoring accel. per rad of steer (m/s²)', legend: 'tl', series: [{ label: 'Normal trail', x: vs, y: vs.map(s => 9.81 / 0.7 * 0.02 / 0.7 + (s / 3.6) ** 2 / (1.5 * 0.7)) }, { label: 'Negative trail (Honda, standstill mode)', x: vs, y: vs.map(s => 9.81 / 0.7 * 0.12 / 0.7 + (s / 3.6) ** 2 / (1.5 * 0.7)) }], hlines: [{ y: 9.81 / 0.7 * 0.3, label: 'needed to beat gravity at 0.3 rad steer', color: '#94a3b8' }] });
    const tb = h('table', { class: 't' }, h('tr', null, ...['Machine', 'How it balances', 'Design trade-off'].map(x => h('th', { style: { textAlign: 'left' } }, x))),
      [['Honda Riding Assist (CES 2017 concept)', 'No gyroscope. Steer-by-wire plus a motor that changes the fork angle to give negative trail at very low speed, so small steering motions move the support under the bike; robotics know-how from ASIMO / UNI-CUB.', 'Light (no flywheels) and fits in the front end, but only works with the wheels touching the ground and needs fast, precise steering actuators.'],
        ['Lit Motors C-1 (concept)', 'Two counter-rotating control-moment gyroscopes under the floor produce roll torque even when stopped (company figure ≈ 800 N·m).', 'Holds itself up even against side pushes, but flywheels add mass, spin-up time, energy use and noise.'],
        ['Yamaha AMSAS (concept)', 'A six-axis inertial measurement unit (IMU) and two actuators assist balance when stopping and starting.', 'Assists the rider rather than replacing them.'],
        ['Ordinary bicycle above ~15 km/h', 'Passive self-stability from geometry, mass distribution and gyroscopic effects: the front wheel steers into a lean by itself.', 'Free, but only within a speed window.']].map(r => h('tr', null, r.map(c => h('td', { style: { fontFamily: 'var(--sans)', textAlign: 'left' } }, c)))));
    main.append(h('h2', null, 'Real machines and how they were designed'), h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, tb)));
    main.append(h('h2', null, 'Designing one yourself: the chain of decisions'), h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>1 · Sense</h3><p class="small">An IMU (gyro + accelerometer) measures lean angle and lean rate hundreds of times a second. Noise and drift must be filtered (complementary or Kalman filter).</p>' }),
      h('div', { class: 'card', html: '<h3>2 · Decide</h3><p class="small">A controller (PD/PID or state feedback) computes the steer angle or gyro torque. Gains are tuned so it is fast but does not oscillate; you just did this with Kp and Kd.</p>' }),
      h('div', { class: 'card', html: '<h3>3 · Act</h3><p class="small">Size the actuator: steering motor torque and speed, or gyro flywheel inertia × spin speed. Then the structure carrying those loads (machine design again: shafts, bearings, gears).</p>' }),
      h('div', { class: 'card', html: '<h3>4 · Power & heat</h3><p class="small">Motors and flywheels draw battery power and make heat; that is why most designs balance only at low speed and let geometry do the rest at speed.</p>' }),
      h('div', { class: 'card', html: '<h3>5 · Fail-safe</h3><p class="small">If sensors or power fail, the bike must fall safely: stands, mechanical locks, or limited operating envelopes. Safety design is part of the design.</p>' })));
    main.append(h('p', { class: 'small' }, 'The simulator is a teaching model (point-mass inverted pendulum with simplified steering and contact-patch shift); real vehicles need full multibody models. Product descriptions are from public reports of concept vehicles.'));
  }
});
