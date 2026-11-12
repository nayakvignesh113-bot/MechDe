'use strict';
const FLAT_BELTS = { 'Leather (ρ 1000, σ 2.5 MPa)': { rho: 1000, sig: 2.5 }, 'Rubber-fabric (ρ 1250, σ 2.0 MPa)': { rho: 1250, sig: 2.0 }, 'Polyamide core (ρ 1100, σ 6.0 MPa)': { rho: 1100, sig: 6.0 } };
// V-belt sections: top width × depth (mm), mass kg/m, indicative allowable working tension per belt (N)
const V_BELTS = { 'A (13×8)': { m: 0.106, T: 350, dmin: 75 }, 'B (17×11)': { m: 0.189, T: 600, dmin: 125 }, 'C (22×14)': { m: 0.343, T: 1000, dmin: 200 }, 'D (32×19)': { m: 0.596, T: 2000, dmin: 355 }, 'E (38×23)': { m: 0.911, T: 2800, dmin: 500 } };
MD.register('belt', {
  group: 'Machine elements', title: 'Belt drive', icon: '➰', voice: 'belt drive flat belt v belt pulley',
  render(main) {
    pageHead(main, 'Machine elements · flexible drives', 'Belt drive designer',
      'A belt transmits power by <b>friction</b> (capstan law T1/T2 = e^{μθ}), but at speed its own mass spins outward: <b>centrifugal tension</b> mv² eats into the allowable tension without transmitting anything. Power per belt therefore <b>rises then falls</b> with speed, peaking at v = √(T<sub>max</sub>/3m). Above that speed, more speed means <i>less</i> power.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'type', label: 'Belt type', type: 'select', options: ['Flat belt', 'V-belt'], value: 'V-belt', aliases: ['belt type'] },
      { id: 'P', label: 'Power', unit: 'kW', value: 7.5, min: 0.2, max: 200, step: 0.1, aliases: ['power'] },
      { id: 'Cs', label: 'Service factor', value: 1.3, min: 1, max: 2, step: 0.05, aliases: ['service factor'] },
      { id: 'n1', label: 'Driver speed', unit: 'rpm', value: 1440, min: 100, max: 6000, step: 10, aliases: ['speed', 'rpm'] },
      { id: 'd', label: 'Driver pulley Ø d', unit: 'mm', value: 160, min: 50, max: 1000, step: 5, aliases: ['driver diameter', 'pulley'] },
      { id: 'i', label: 'Speed ratio', value: 2.5, min: 1, max: 6, step: 0.05, aliases: ['ratio'] },
      { id: 'C', label: 'Centre distance', unit: 'mm', value: 700, min: 150, max: 5000, step: 10, aliases: ['centre distance', 'center distance'] },
      { id: 'mu', label: 'Coefficient of friction μ', value: 0.3, min: 0.1, max: 0.6, step: 0.01, aliases: ['friction'] },
      { section: 'Flat belt' },
      { id: 'fb', label: 'Material', type: 'select', options: Object.keys(FLAT_BELTS), value: Object.keys(FLAT_BELTS)[0], wide: true },
      { id: 't', label: 'Thickness', unit: 'mm', value: 6, min: 2, max: 15, step: 0.5, aliases: ['thickness'] },
      { section: 'V-belt' },
      { id: 'vb', label: 'Section', type: 'select', options: Object.keys(V_BELTS), value: 'B (17×11)', aliases: ['section'] },
      { id: 'beta', label: 'Groove angle 2β', unit: '°', value: 40, min: 30, max: 45, step: 1 },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(), c2 = plotCanvas();
    cv.style.height = '230px';
    R.append(h('div', { class: 'card' }, cv, out), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
    let B = null;
    function run(v) {
      const flat = v.type === 'Flat belt', D = v.d * v.i, vel = Math.PI * v.d * v.n1 / 60000;
      const sinA = (D - v.d) / (2 * v.C);
      if (Math.abs(sinA) >= 1) { out.innerHTML = '<div class="badbox">Centre distance too small for these pulleys.</div>'; return; }
      const theta = Math.PI - 2 * Math.asin(sinA), mueff = flat ? v.mu : v.mu / Math.sin(v.beta / 2 * deg), Rr = Math.exp(mueff * theta);
      const Lb = 2 * v.C + Math.PI * (D + v.d) / 2 + (D - v.d) ** 2 / (4 * v.C);
      const Pd = v.P * v.Cs * 1000;
      let m, Tmax, nBelts = 1, width = null, perBelt;
      if (flat) { const fb = FLAT_BELTS[v.fb]; m = fb.rho * v.t / 1000; /* kg/m per metre width */ Tmax = fb.sig * 1e6 * v.t / 1000; // N per m width
        const Pw = (Tmax - m * vel * vel) * (1 - 1 / Rr) * vel; width = Pd / Pw * 1000; perBelt = Pw; }
      else { const vb = V_BELTS[v.vb]; m = vb.m; Tmax = vb.T; perBelt = (Tmax - m * vel * vel) * (1 - 1 / Rr) * vel; nBelts = Math.ceil(Pd / perBelt - 1e-9); }
      if (!(perBelt > 0)) { B = null; out.innerHTML = ''; out.append(h('div', { class: 'badbox', html: `<b>At ${fmt(vel)} m/s the belt transmits nothing.</b> Centrifugal tension m·v² = ${fmt(m * vel * vel)} N ${flat ? 'per m width ' : ''}already equals the allowable tension ${fmt(Tmax)} N. Optimum speed is ${fmt(Math.sqrt(Tmax / (3 * m)))} m/s: use a smaller driver pulley or a lower speed.` })); explain('The belt speed is so high that centrifugal tension uses up the whole allowable tension.'); return; }
      const scale = flat ? width / 1000 : 1, T1 = Tmax * scale * (flat ? 1 : 1), Tc = m * vel * vel * scale;
      // actual working tensions for transmitted power
      const Pper = flat ? Pd : Pd / nBelts, dT = Pper / vel; const T1w = Tc + dT * Rr / (Rr - 1), T2w = T1w - dT;
      const vopt = Math.sqrt(Tmax / (3 * m)), shaftLoad = Math.sqrt(T1w ** 2 + T2w ** 2 + 2 * T1w * T2w * Math.cos(Math.PI - theta)) * (flat ? 1 : nBelts);
      if (Tmax - m * vel * vel <= 0) { B = null; out.innerHTML = ''; out.append(h('div', { class: 'badbox', html: `<b>At ${fmt(vel)} m/s the belt's own centrifugal tension (m·v² = ${fmt(m * vel * vel)} N${flat ? ' per m width' : ''}) exceeds its allowable tension (${fmt(Tmax)} N).</b> It cannot transmit any power. Reduce pulley diameter or speed. Optimum speed is ${fmt(Math.sqrt(Tmax / (3 * m)))} m/s.` })); explain('Belt speed is too high: centrifugal tension uses up all the allowable tension.'); return; }
      B = { v, D, vel, theta, T1w, T2w, nBelts, flat };
      out.innerHTML = '';
      out.append(h('div', { class: 'metrics' },
        metric('Belt speed v', fmt(vel), 'm/s', vel <= vopt ? 'good' : 'warn'), metric('Optimum speed √(Tmax/3m)', fmt(vopt), 'm/s'),
        metric('Wrap on small pulley', fmt(theta / deg), '°', theta / deg >= 120 ? 'good' : 'warn'), metric('Tension ratio e^{μθ}', fmt(Rr), ''),
        metric('Centrifugal tension (per belt/width)', fmt(m * vel * vel), flat ? 'N per m width' : 'N'),
        flat ? metric('Required belt width', fmt(width), 'mm', 'good') : metric('Number of belts', nBelts, '', 'good'),
        metric('Tight / slack side', `${fmt(T1w)} / ${fmt(T2w)}`, 'N'), metric('Belt pitch length', fmt(Lb), 'mm'),
        metric('Load on shaft (to shaft designer)', fmt(shaftLoad), 'N'), metric('Driven pulley Ø', fmt(D), 'mm')));
      const notes = [];
      if (vel > vopt) notes.push(`Running above the optimum speed: centrifugal tension takes ${fmt(100 * m * vel * vel / Tmax)} % of the allowable tension. A smaller pulley (or lower speed) would transmit <i>more</i> per belt.`);
      if (theta / deg < 120) notes.push('Wrap angle below 120°: slip risk. Increase centre distance or use an idler.');
      if (!flat && v.d < V_BELTS[v.vb].dmin) notes.push(`Pulley smaller than the recommended minimum Ø${V_BELTS[v.vb].dmin} mm for section ${v.vb}: bending stress in the belt cuts its fatigue life.`);
      if (v.C < 0.7 * (D + v.d) || v.C > 2 * (D + v.d)) notes.push('Centre distance outside ~0.7–2 × (D + d): short drives lose wrap, long ones whip.');
      if (ENV.T > 60) notes.push('Rubber belts age fast above ~60 °C; check the manufacturer\'s temperature correction factor.');
      verdict(out, notes.length ? null : true, flat ? `Flat belt ${fmt(Math.ceil(width / 5) * 5)} mm wide × ${v.t} mm` : `${nBelts} × ${v.vb} V-belts`, notes.length ? notes.join('<br>') : 'Drive is well proportioned: speed below optimum, adequate wrap.');
      out.append(h('div', { class: 'eq' }, `(T1 − Tc)/(T2 − Tc) = e^{μθ${flat ? '' : '/sin β'}},  Tc = m·v²,  P = (T1 − T2)·v
P per ${flat ? 'm width' : 'belt'} = (Tmax − m v²)(1 − e^{−μθ}) v = ${fmt(perBelt / 1000)} kW,   design power = ${fmt(Pd / 1000)} kW`));
      out.append(h('div', { class: 'small' }, 'V-belt allowable tensions are indicative. For final selection use the manufacturer\'s kW-per-belt ratings with arc-of-contact and length correction factors.'));
      const vs = linspace(1, Math.max(50, vel * 1.5), 120);
      plot(c1, { title: `Power per ${flat ? 'metre width' : 'belt'} vs speed`, xlabel: 'Belt speed (m/s)', ylabel: 'kW', ymin: 0, series: [{ x: vs, y: vs.map(s => Math.max(0, (Tmax - m * s * s) * (1 - 1 / Rr) * s / 1000)), fill: true }], vlines: [{ x: vopt, label: 'optimum', color: '#2f7d32' }, { x: vel, label: 'yours' }] });
      const th = linspace(90, 200, 60);
      plot(c2, { title: 'Why V-belts grip better (same μ)', xlabel: 'Wrap angle (°)', ylabel: 'Tension ratio T1/T2', logy: true, legend: 'tl', series: [{ label: 'Flat belt e^{μθ}', x: th, y: th.map(t => Math.exp(v.mu * t * deg)) }, { label: `V-belt e^{μθ/sin ${v.beta / 2}°}`, x: th, y: th.map(t => Math.exp(v.mu / Math.sin(v.beta / 2 * deg) * t * deg)) }] });
      explain(flat ? `A ${fmt(width)} millimetre wide flat belt is needed. Belt speed is ${fmt(vel)} metres per second against an optimum of ${fmt(vopt)}.` : `Use ${nBelts} belts of section ${v.vb}. Belt speed ${fmt(vel)} metres per second, optimum ${fmt(vopt)}.`);
    }
    const f = buildForm(L, specs, run, 'belt'); run(f.vals);
    let ph = 0;
    anim(() => {
      if (!B) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      const v = B.v, r1 = v.d / 2, r2 = B.D / 2, sc = Math.min((w - 40) / (v.C + r1 + r2), (H - 40) / (2 * Math.max(r1, r2)));
      const x1 = 20 + r1 * sc, x2 = x1 + v.C * sc, cy = H / 2, R1 = r1 * sc, R2 = r2 * sc;
      const a = Math.asin((r2 - r1) / v.C); // tangent geometry (open belt)
      const tp = (cx, R, ang) => [cx + R * Math.cos(ang), cy - R * Math.sin(ang)];
      const up = Math.PI / 2 + a, dn = -Math.PI / 2 - a;
      ph = (ph + B.vel * 0.15) % 20;
      const seg = (p, q, col, wd) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -ph; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); };
      // driver rotates clockwise: top strand is tight when driver on left pulls top toward itself
      const wT = 2 + 6 * B.T1w / (B.T1w + B.T2w), wS = 2 + 6 * B.T2w / (B.T1w + B.T2w);
      seg(tp(x2, R2, up), tp(x1, R1, up), '#b42318', wT);
      const s1 = tp(x1, R1, dn), s2 = tp(x2, R2, dn); ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = wS; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -ph; ctx.beginPath(); ctx.moveTo(...s1); ctx.quadraticCurveTo((s1[0] + s2[0]) / 2, (s1[1] + s2[1]) / 2 + 18, ...s2); ctx.stroke();
      ctx.setLineDash([]);
      [[x1, R1, '#c2410c'], [x2, R2, '#475569']].forEach(([x, R, c], k) => { ctx.fillStyle = c + '33'; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, cy, R, 0, 7); ctx.fill(); ctx.stroke();
        const rot = -ph / 10 * (k ? R1 / R2 : 1); for (let s = 0; s < 4; s++) { const an = rot + s * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + R * 0.85 * Math.cos(an), cy + R * 0.85 * Math.sin(an)); ctx.stroke(); } });
      tag(ctx, 'Driver', x1, cy + R1 + 14, '#c2410c', 'center'); tag(ctx, 'Driven', x2, cy + R2 + 14, '#475569', 'center');
      tag(ctx, 'Tight side', (x1 + x2) / 2, cy - Math.max(R1, R2) - 10, '#b42318', 'center'); tag(ctx, 'Slack side', (x1 + x2) / 2, cy + Math.max(R1, R2) + 22, '#0f5e8c', 'center');
      ctx.fillStyle = '#1b2430'; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`tight side ${fmt(B.T1w)} N (red) · slack ${fmt(B.T2w)} N (blue) · wrap ${fmt(B.theta / deg)}°`, 10, 16);
    });
  }
});
