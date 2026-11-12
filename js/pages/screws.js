'use strict';
const SCREW_TYPES = { 'Square': 0, 'Trapezoidal (30°)': 15, 'ACME (29°)': 14.5 };
const PS = {
  calc(v) {
    const W = v.W * 1000, l = v.p * v.starts, dm = v.d - v.p / 2, dc = v.d - v.p, beta = SCREW_TYPES[v.type] * deg, sec = 1 / Math.cos(beta);
    const lam = Math.atan(l / (Math.PI * dm)), mu = v.mu;
    const Tr = W * dm / 2 * (l + Math.PI * mu * dm * sec) / (Math.PI * dm - mu * l * sec) + W * v.muc * v.rc; // raise, N·mm
    const Tl = W * dm / 2 * (Math.PI * mu * dm * sec - l) / (Math.PI * dm + mu * l * sec) + W * v.muc * v.rc;
    const self = Math.PI * mu * dm * sec > l, eta = W * l / (2 * Math.PI * Tr);
    const A = Math.PI * dc * dc / 4, sc = W / A, tau = 16 * (Tr - W * v.muc * v.rc) / (Math.PI * dc ** 3), vm = Math.sqrt(sc * sc + 3 * tau * tau);
    const m = matAt(v.mat), nY = m.Sy / vm;
    const k = dc / 4, lam_s = 2 * v.Lu / k, Pcr = Math.PI ** 2 * m.E * (Math.PI * dc ** 4 / 64) / (2 * v.Lu) ** 2; // fixed-free (jack), K = 2
    const nB = Pcr / W, nThreads = W / (v.pb * Math.PI * dm * (v.p / 2)), Lnut = Math.ceil(nThreads) * v.p;
    const Fhand = Tr / v.arm;
    return { l, dm, dc, lam: lam / deg, Tr, Tl, self, eta, sc, tau, vm, nY, Pcr, nB, lam_s, Lnut, nThreads, Fhand };
  },
};
MD.register('screws', {
  group: 'Machine elements', title: 'Power screws & screw jacks', icon: '🔩', voice: 'power screw screw jack lead screw',
  kid: { what: 'Designs a <b>screw jack</b> (like a car jack) or lead screw: turning a handle lifts a heavy load.', steps: ['Enter the load and screw size.', 'See the handle force and whether the load can slide back down on its own (self-locking).', 'Check the screw doesn\'t buckle and the nut threads don\'t wear out.'], try: 'Change to 3 starts: lifting gets faster and more efficient, but the load may run back down by itself!' },
  eq: [
    { t: 'Torque to raise the load', f: 'T = W·dm/2 · (l + π·μ·dm·sec β) / (π·dm − μ·l·sec β) + W·μc·rc', s: [['l', 'lead = pitch × starts'], ['dm', 'mean diameter'], ['β', 'half thread angle'], ['μc, rc', 'collar friction & radius']], fx: [['more friction μ', 'more torque, lower efficiency'], ['V-type thread (β > 0)', 'more friction than square threads']] },
    { t: 'Self-locking condition', f: 'π·μ·dm·sec β > l   (friction angle > lead angle)', m: 'A self-locking jack holds the car up even if you let go of the handle.', fx: [['more starts (bigger lead)', 'faster & more efficient, but may stop self-locking']] },
    { t: 'Efficiency', f: 'η = W·l / (2π·T)', m: 'A self-locking square-thread screw is always below 50 % efficient.' },
    { t: 'Buckling of the jack screw', f: 'P_cr = π²·E·I / (K·L)²,   K = 2 (one end free)', fx: [['taller lift', 'P_cr ÷ (L²)']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · motion conversion', 'Power screws & screw jacks',
      'A power screw turns rotation into a slow, powerful straight-line motion: car jacks, vices, presses, lathe lead screws. Its key design choice is the <b>lead angle</b>: small enough to be self-locking (the load cannot drive the screw back), or large enough to be efficient. You rarely get both. That is why ball screws (rolling, ~90 % efficient) need a brake.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [{ id: 'W', label: 'Load to lift', unit: 'kN', value: 30, min: 1, max: 500, step: 1, aliases: ['load'] }, { id: 'type', label: 'Thread form', type: 'select', options: Object.keys(SCREW_TYPES), value: 'Square' },
      { id: 'd', label: 'Nominal diameter', unit: 'mm', value: 40, min: 10, max: 150, step: 1, aliases: ['diameter'] }, { id: 'p', label: 'Pitch', unit: 'mm', value: 7, min: 1.5, max: 24, step: 0.5 }, { id: 'starts', label: 'Number of starts', value: 1, min: 1, max: 4, step: 1, aliases: ['starts'] },
      { id: 'mu', label: 'Thread friction μ', value: 0.12, min: 0.03, max: 0.25, step: 0.01, tip: 'Steel screw, bronze nut, greased ≈ 0.10–0.15.' }, { id: 'muc', label: 'Collar friction μc', value: 0.12, min: 0, max: 0.25, step: 0.01 }, { id: 'rc', label: 'Collar mean radius', unit: 'mm', value: 25, min: 0, max: 100, step: 1 },
      { id: 'Lu', label: 'Unsupported screw length (lift)', unit: 'mm', value: 350, min: 50, max: 2000, step: 10 }, { id: 'mat', label: 'Screw material', type: 'select', options: MAT_NAMES.filter(n => /1045|4140|E250|E350|304/.test(n)), value: 'AISI 1045 / C45 cold drawn', wide: true },
      { id: 'pb', label: 'Allowable thread bearing pressure (nut)', unit: 'MPa', value: 15, min: 5, max: 30, step: 0.5 }, { id: 'arm', label: 'Handle length', unit: 'mm', value: 600, min: 100, max: 2000, step: 10 }];
    const out = h('div'), cv = plotCanvas('anim'), c1 = plotCanvas(); cv.style.height = '260px';
    R.append(h('div', { class: 'card' }, h('div', { class: 'grid3' }, cv, out)), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
    let S = null;
    function run(v) {
      const r = PS.calc(v); S = Object.assign({ v }, r); out.innerHTML = '';
      out.append(h('div', { class: 'metrics' }, metric('Lead angle', fmt(r.lam), '°'), metric('Torque to raise', fmt(r.Tr / 1000), 'N·m'), metric('Torque to lower', fmt(r.Tl / 1000), 'N·m', r.Tl > 0 ? 'good' : 'bad'), metric('Self-locking?', r.self ? 'yes' : 'no', '', r.self ? 'good' : 'bad'),
        metric('Efficiency', fmt(r.eta * 100) + ' %', ''), metric('Hand force on handle', fmt(r.Fhand), 'N', r.Fhand < 400 ? 'good' : 'warn'), metric('Screw yield FS', fmt(r.nY), '', fsStatus(r.nY, 2)), metric('Buckling FS', fmt(r.nB), '', fsStatus(r.nB, 3)), metric('Nut length needed', fmt(r.Lnut), 'mm')));
      verdict(out, r.self && r.nY >= 2 && r.nB >= 3, r.self ? `Self-locking jack, ${fmt(r.eta * 100)} % efficient` : 'Not self-locking: load will run back down', `${r.self ? 'The load stays up when you let go, paid for by low efficiency.' : 'Fine for a powered lead screw with a brake, dangerous for a hand jack.'} Handle force ${fmt(r.Fhand)} N (a person can push about 300–400 N comfortably).`);
      const ls = linspace(0.5, 45, 90); plot(c1, { title: 'Efficiency vs lead angle', xlabel: 'Lead angle (°)', ylabel: 'Efficiency (%)', ymin: 0, ymax: 100, vlines: [{ x: r.lam, label: 'yours' }, { x: Math.atan(v.mu) / deg, label: 'self-locking limit', color: '#2f7d32' }], series: [{ x: ls, y: ls.map(a => { const t = Math.tan(a * deg), f = v.mu / Math.cos(SCREW_TYPES[v.type] * deg); return 100 * t * (1 - f * t) / (t + f); }) }] });
      $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = PS.calc(vv); return { 'Hand force': q.Fhand, 'Efficiency': q.eta, 'Buckling FS': q.nB }; }, v, specs);
      explain(`Hand force ${fmt(r.Fhand)} newtons, efficiency ${fmt(r.eta * 100)} percent, ${r.self ? 'self-locking' : 'not self-locking'}. Buckling safety factor ${fmt(r.nB)}.`);
    }
    const f = buildForm(L, specs, run, 'screw'); run(f.vals);
    anim(t => { if (!S) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H); const v = S.v, cx = w / 2, base = H - 16, lift = (Math.sin(t * 0.8) + 1) / 2;
      const sw = Math.max(16, Math.min(40, v.d * 0.6)), top = 40 + (1 - lift) * 60;
      ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.moveTo(cx - 60, base); ctx.lineTo(cx - 25, base - 70); ctx.lineTo(cx + 25, base - 70); ctx.lineTo(cx + 60, base); ctx.fill(); tag(ctx, 'body + nut', cx + 30, base - 40, '#fff', 'left', 11);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(cx - sw / 2, top, sw, base - 70 - top);
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5; for (let y = top + ((t * 30 * v.starts) % 8); y < base - 70; y += 8) { ctx.beginPath(); ctx.moveTo(cx - sw / 2, y); ctx.lineTo(cx + sw / 2, y + 4); ctx.stroke(); }
      ctx.fillStyle = '#c2410c'; ctx.fillRect(cx - 50, top - 18, 100, 18); tag(ctx, `load ${v.W} kN`, cx, top - 28, '#c2410c', 'center', 12);
      const ha = t * 2; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, top + 6); ctx.lineTo(cx + 70 * Math.cos(ha), top + 6 + 10 * Math.sin(ha)); ctx.stroke(); tag(ctx, 'handle', cx + 70 * Math.cos(ha), top + 20, '#1b2430', 'center', 11);
      tag(ctx, 'screw', cx + sw / 2 + 6, (top + base - 70) / 2, '#475569', 'left', 11); });
  }
});
