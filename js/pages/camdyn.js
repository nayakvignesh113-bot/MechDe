'use strict';
/* Cam–follower train dynamics: one-DOF model of a valve train. Detects jump (loss of contact) and shows residual vibration. */
const CD = {
  law(law, u) { // displacement s/h and its first two derivatives wrt u
    switch (law) {
      case 'Simple harmonic': return [(1 - Math.cos(Math.PI * u)) / 2, Math.PI / 2 * Math.sin(Math.PI * u), Math.PI ** 2 / 2 * Math.cos(Math.PI * u)];
      case 'Cycloidal': return [u - Math.sin(2 * Math.PI * u) / (2 * Math.PI), 1 - Math.cos(2 * Math.PI * u), 2 * Math.PI * Math.sin(2 * Math.PI * u)];
      case 'Parabolic': return u < 0.5 ? [2 * u * u, 4 * u, 4] : [1 - 2 * (1 - u) ** 2, 4 * (1 - u), -4];
      default: return [10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5, 30 * u * u - 60 * u ** 3 + 30 * u ** 4, 60 * u - 180 * u * u + 120 * u ** 3];
    }
  },
  lift(v, thDeg) { // cam lift (m) at cam angle
    const t = ((thDeg % 360) + 360) % 360, B = v.beta;
    if (t <= B) return v.h / 1000 * this.law(v.law, t / B)[0];
    if (t <= B + v.dwell) return v.h / 1000;
    if (t <= 2 * B + v.dwell) return v.h / 1000 * (1 - this.law(v.law, (t - B - v.dwell) / B)[0]);
    return 0;
  },
  sim(v) {
    const w = v.rpm * 2 * Math.PI / 60 / (v.engine ? 2 : 1); // camshaft speed (4-stroke: half crank)
    const m = v.m / 1000, kt = v.kt * 1e6, ks = v.ks * 1000, F0 = v.F0, c = 2 * v.zeta * Math.sqrt((kt + ks) * m);
    const dtCam = 0.05 * deg / w, N = Math.ceil(2 * 2 * Math.PI / w / dtCam); // two revolutions
    let x = 0, xd = 0; const T = [], Y = [], X = [], Fc = []; let minF = Infinity, jump = false, jumpAt = null, resid = 0;
    const y = t => this.lift(v, (w * t) / deg), yd = t => (y(t + 1e-6) - y(t - 1e-6)) / 2e-6;
    for (let i = 0; i < N; i++) {
      const t = i * dtCam, yy = y(t), yv = yd(t);
      let Fcontact = kt * (yy - x) + c * (yv - xd); // force the cam pushes with (≥ 0 in contact)
      const open = yy > 1e-6 || x > 1e-6;
      if (Fcontact < 0) { Fcontact = 0; if (open && yy > 2e-5 && !jump && i > N / 2) { jump = true; jumpAt = (w * t / deg) % 360; } }
      const a = (Fcontact - ks * x - F0) / m; xd += a * dtCam; x += xd * dtCam;
      if (x <= 0) { x = 0; if (xd < 0) xd = 0; } // valve sits on its seat (seat carries the preload)
      if (i % 4 === 0) { T.push((w * t / deg)); Y.push(yy * 1000); X.push(x * 1000); Fc.push(Fcontact); }
      if (i > N / 2 && yy > 2e-5) { minF = Math.min(minF, Fcontact); const ang = (w * t / deg) % 360; if (ang > 2 * v.beta + v.dwell + 20) resid = Math.max(resid, Math.abs(x - yy) * 1000); }
    }
    const fn = Math.sqrt((kt + ks) / m) / (2 * Math.PI), fcam = w / (2 * Math.PI);
    return { T, Y, X, Fc, minF, jump, jumpAt, resid, fn, fcam, ratio: fn / fcam };
  },
};
MD.register('camdyn', {
  group: 'Foundations', title: 'Cam follower dynamics', icon: '🎢', voice: 'cam follower dynamics valve float jump surge',
  kid: { what: 'A cam pushes a valve open; a spring pulls it back. Spin the cam too fast and the valve <b>flies off the cam</b> ("valve float") and things smash. This page shows when that happens.', steps: ['Set the engine speed.', 'Watch the green follower curve: does it stay on the grey cam curve?', 'If the contact force touches zero (red), the follower jumps. Stiffen the spring or use a smoother cam.'], try: 'Find the redline on the bottom chart, then add 150 N of spring preload: the redline moves up, but the cam now has more friction and wear.' },
  eq: [
    { t: 'Follower-train model (one degree of freedom)', f: 'm·ẍ = k_t·(y − x) + c·(ẏ − ẋ) − k_s·x − F0', s: [['y', 'cam lift'], ['x', 'valve motion'], ['k_t', 'stiffness of push-rod/rocker train'], ['k_s, F0', 'spring rate and preload']], fx: [['higher speed', 'inertia (m·ẍ ∝ ω²) can exceed spring force: contact is lost (jump)'], ['stiffer train', 'higher natural frequency, less residual vibration']] },
    { t: 'Contact force', f: 'Fc = k_t·(y − x) + c·(ẏ − ẋ) ≥ 0', m: 'A cam can only push. If Fc would go negative, the follower leaves the cam.' },
    { t: 'Natural frequency vs cam frequency', f: 'fn = (1/2π)·√((k_t + k_s)/m),   keep fn / f_cam high (≈ > 10–20 harmonics)', fx: [['heavier valve train', 'fn falls, so vibration and jumping at lower speed']] },
  ],
  render(main) {
    pageHead(main, 'Kinematics meets dynamics', 'Cam follower dynamics: when kinematics is not enough',
      'The Kinematics lab assumes the follower always touches the cam. Real follower trains are masses on springs, and at speed they lag, overshoot and vibrate. When the deceleration force needed exceeds the spring force, the follower <b>jumps</b> off the cam; in engines this is <b>valve float</b>, the reason engines have a redline. Smooth laws (continuous acceleration) excite far less vibration.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'rpm', label: 'Engine (crank) speed', unit: 'rpm', value: 6000, min: 500, max: 14000, step: 100, aliases: ['speed', 'rpm'] },
      { id: 'engine', label: '4-stroke (cam turns at half crank speed)', type: 'check', value: true },
      { id: 'law', label: 'Cam motion law', type: 'select', options: ['Parabolic', 'Simple harmonic', 'Cycloidal', '3-4-5 polynomial'], value: 'Simple harmonic', aliases: ['law'] },
      { id: 'h', label: 'Valve lift', unit: 'mm', value: 9, min: 2, max: 15, step: 0.5 }, { id: 'beta', label: 'Rise (= return) angle', unit: '° cam', value: 75, min: 30, max: 120, step: 1 }, { id: 'dwell', label: 'Dwell at full lift', unit: '° cam', value: 10, min: 0, max: 60, step: 1 },
      { id: 'm', label: 'Equivalent moving mass', unit: 'g', value: 120, min: 20, max: 600, step: 5, tip: 'Valve + retainer + ⅓ spring + rocker/tappet equivalent.' },
      { id: 'ks', label: 'Valve spring rate', unit: 'N/mm', value: 40, min: 5, max: 200, step: 1, aliases: ['spring rate'] }, { id: 'F0', label: 'Spring preload (valve closed)', unit: 'N', value: 300, min: 50, max: 1500, step: 10, aliases: ['preload'] },
      { id: 'kt', label: 'Train stiffness (rocker, push rod, tappet)', unit: 'N/µm', value: 15, min: 1, max: 100, step: 0.5 }, { id: 'zeta', label: 'Damping ratio', value: 0.06, min: 0.01, max: 0.3, step: 0.01 },
    ];
    const out = h('div'), c1 = plotCanvas(), c2 = plotCanvas(); c1.style.height = '300px';
    R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1, c2));
    function run(v) {
      const r = CD.sim(v); out.innerHTML = '';
      out.append(h('div', { class: 'metrics' }, metric('Camshaft speed', fmt(v.rpm / (v.engine ? 2 : 1)), 'rpm'), metric('Train natural frequency', fmt(r.fn), 'Hz'), metric('fn ÷ cam frequency', fmt(r.ratio), '', r.ratio > 20 ? 'good' : r.ratio > 10 ? 'warn' : 'bad'),
        metric('Minimum contact force', fmt(Math.max(r.minF, 0)), 'N', r.minF > 50 ? 'good' : r.minF > 0 ? 'warn' : 'bad'), metric('Jump (valve float)?', r.jump ? `yes, at ${fmt(r.jumpAt)}°` : 'no', '', r.jump ? 'bad' : 'good')));
      verdict(out, !r.jump, r.jump ? 'Valve float: the follower leaves the cam' : `Follower stays in contact (min force ${fmt(r.minF)} N)`, r.jump ? 'Deceleration near peak lift needs more force than the spring gives. Fixes: stiffer spring or more preload (more friction & wear), lighter valve train (titanium valves, overhead cam), smoother cam law, or a lower redline. Racing engines use pneumatic or desmodromic valves for this reason.' : 'The spring always beats the follower\'s inertia. The higher the ratio fn/f_cam, the less the follower "rings" after each lift.');
      plot(c1, { title: 'Cam lift (grey) vs actual follower motion (green)', xlabel: 'Cam angle (°), two revolutions', ylabel: 'Lift (mm)', legend: 'tr', series: [{ label: 'Cam profile', x: r.T, y: r.Y, color: '#94a3b8', width: 3 }, { label: 'Follower', x: r.T, y: r.X, color: '#2f7d32' }] });
      plot(c2, { title: 'Contact force between cam and follower', xlabel: 'Cam angle (°)', ylabel: 'Force (N)', hlines: [{ y: 0, label: 'zero: contact lost', color: '#b42318' }], series: [{ x: r.T, y: r.Fc, color: '#c2410c', fill: true }] });
      const rpms = linspace(1000, 14000, 27), mins = rpms.map(n => CD.sim(Object.assign({}, v, { rpm: n })).minF);
      const red = rpms.find((n, i) => mins[i] <= 0);
      out.querySelector('.metrics').append(metric('Float speed (redline)', red ? fmt(red) : '> 14000', 'rpm', red && red <= v.rpm ? 'bad' : 'good'));
      out.append(h('div', { class: 'note', html: 'Smoother laws (cycloidal, 3-4-5) avoid sudden acceleration jumps, so they shake the train less, but for the same lift and angle they need <i>higher</i> peak acceleration than simple harmonic or parabolic motion. Every cam is a compromise between peak force, smoothness and how fast the valve opens.' }));
      $$('.effect', R).forEach(e => e.remove());
      const cv3 = plotCanvas(); R.append(h('div', { class: 'card effect', style: { marginTop: '12px' } }, cv3));
      plot(cv3, { title: 'Where is the redline? Minimum contact force vs engine speed', xlabel: 'Engine speed (rpm)', ylabel: 'Min contact force (N)', hlines: [{ y: 0, color: '#b42318', label: 'float' }], vlines: [{ x: v.rpm }], series: [{ x: rpms, y: mins.map(x => Math.max(x, -50)), fill: true }] });
      explain(r.jump ? `At ${v.rpm} rpm the follower jumps off the cam, valve float. Increase spring force or lighten the valve train.` : `The follower stays on the cam at ${v.rpm} rpm with a minimum contact force of ${fmt(r.minF)} newtons.`);
    }
    const f = buildForm(L, specs, run, 'camdyn'); run(f.vals);
  }
});
