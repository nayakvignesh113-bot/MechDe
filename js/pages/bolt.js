'use strict';
const BOLTS = { M6: [6, 20.1, 1], M8: [8, 36.6, 1.25], M10: [10, 58.0, 1.5], M12: [12, 84.3, 1.75], M16: [16, 157, 2], M20: [20, 245, 2.5], M24: [24, 353, 3], M30: [30, 561, 3.5] };
const GRADES = { '5.8': { Sp: 380, Sut: 520, Se: 128 }, '8.8': { Sp: 600, Sut: 830, Se: 129 }, '10.9': { Sp: 830, Sut: 1040, Se: 162 }, '12.9': { Sp: 970, Sut: 1220, Se: 190 } };
const MEMBERS = { 'Steel': { E: 207e3, alpha: 12e-6 }, 'Aluminium alloy': { E: 71e3, alpha: 23.4e-6 }, 'Grey cast iron': { E: 100e3, alpha: 10.8e-6 } };
function boltCalc(v, override) {
  v = Object.assign({}, v, override || {});
  const [d, At] = BOLTS[v.size], gr = GRADES[v.grade], mem = MEMBERS[v.mem], Eb = 207e3;
  const Ad = Math.PI * d * d / 4, LT = 2 * d + 6, Lb = v.l + d, ld = Math.max(0, Lb - LT), lt = Math.max(0, v.l - ld);
  const kb = Ad * At * Eb / (Ad * lt + At * ld);
  const km = 0.5774 * Math.PI * mem.E * d / (2 * Math.log(5 * (0.5774 * v.l + 0.5 * d) / (0.5774 * v.l + 2.5 * d)));
  const C = kb / (kb + km), P = v.Ptot * 1000 / v.N;
  const Fi0 = v.pre / 100 * gr.Sp * At, dT = ENV.T - ENV.Tinstall;
  const dFi = (mem.alpha - 12e-6) * dT * v.l * kb * km / (kb + km), Fi = Math.max(0, Fi0 + dFi);
  const Se = gr.Se * RELIAB[ENV.rel] / 0.814 * KENV.steel[mediumIndex()] * (v.rolled ? 1 : 0.85);
  const sa = C * P / (2 * At), si = Fi / At, smn = sa + si;
  const nf = Se * (gr.Sut - si) / (gr.Sut * sa + Se * (smn - si));
  const nL = (gr.Sp * At - Fi) / (C * P), n0 = Fi / (P * (1 - C)), np = gr.Sp * At / (C * P + Fi);
  return { d, At, kb, km, C, P, Fi0, dFi, Fi, dT, Se, sa, si, nf, nL, n0, np, T: v.K * Fi * d / 1000, Fb: C * P + Fi, Fm: (1 - C) * P - Fi, gr };
}
MD.register('bolt', {
  group: 'Machine elements', title: 'Bolted joint', icon: '🔩', voice: 'bolt bolted joint preload fastener',
  render(main) {
    pageHead(main, 'Machine elements · fastening', 'Bolted joint under fluctuating load',
      'The counter-intuitive core of bolt design: a well-<b>preloaded</b> bolt barely feels the external load. The clamped members are stiffer than the bolt, so they absorb most of it, and the bolt sees only the fraction C = k<sub>b</sub>/(k<sub>b</sub>+k<sub>m</sub>). Preload protects against <b>separation</b> and <b>fatigue</b> at once, until the bolt yields while tightening. Temperature can quietly steal preload when bolt and members expand differently.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'Ptot', label: 'External separating load (0 → P, total)', unit: 'kN', value: 60, min: 1, max: 1000, step: 1, aliases: ['load'] },
      { id: 'N', label: 'Number of bolts', value: 6, min: 1, max: 48, step: 1, aliases: ['bolts', 'number of bolts'] },
      { id: 'size', label: 'Bolt size', type: 'select', options: Object.keys(BOLTS), value: 'M12', aliases: ['size'] },
      { id: 'grade', label: 'Property class', type: 'select', options: Object.keys(GRADES), value: '8.8', aliases: ['grade', 'class'] },
      { id: 'rolled', label: 'Rolled threads (else cut)', type: 'check', value: true },
      { id: 'l', label: 'Grip length', unit: 'mm', value: 40, min: 5, max: 300, step: 1, aliases: ['grip'] },
      { id: 'mem', label: 'Clamped members', type: 'select', options: Object.keys(MEMBERS), value: 'Steel', aliases: ['member'] },
      { id: 'pre', label: 'Preload (% of proof load)', unit: '%', value: 75, min: 5, max: 100, step: 1, aliases: ['preload'] },
      { id: 'K', label: 'Torque coefficient K', value: 0.2, min: 0.1, max: 0.35, step: 0.01, tip: '0.2 as-received; 0.15–0.18 lubricated' },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(), c2 = plotCanvas();
    R.append(h('div', { class: 'card' }, cv, out), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
    let B = null, V;
    function run(v) {
      V = v; const r = boltCalc(v); B = r;
      out.innerHTML = '';
      out.append(h('div', { class: 'metrics' },
        metric('Bolt stiffness kb', fmt(r.kb / 1000), 'kN/mm'), metric('Member stiffness km', fmt(r.km / 1000), 'kN/mm'), metric('Joint constant C', fmt(r.C, 3), ''),
        metric('Load per bolt P', fmt(r.P / 1000), 'kN'), metric('Preload Fi (assembly)', fmt(r.Fi0 / 1000), 'kN'), metric(`Thermal ΔFi (ΔT = ${fmt(r.dT)} °C)`, fmt(r.dFi / 1000), 'kN', Math.abs(r.dFi) > 0.2 * r.Fi0 ? 'warn' : ''),
        metric('Tightening torque', fmt(r.T), 'N·m'), metric('Yield (load) factor', fmt(r.nL), '', fsStatus(r.nL, 1.5)), metric('Separation factor', fmt(r.n0), '', fsStatus(r.n0, 1.5)),
        metric('Fatigue FS (Goodman)', fmt(r.nf), '', fsStatus(r.nf, 1.5)), metric('Bolt share of P', fmt(100 * r.C), '%')));
      const items = [{ k: 'Yield (load factor)', v: r.nL }, { k: 'Separation', v: r.n0 }, { k: 'Fatigue', v: r.nf }];
      const worst = items.reduce((a, b) => b.v < a.v ? b : a);
      verdict(out, worst.v >= 1.5, `Weakest link: ${worst.k} (n = ${fmt(worst.v)})`,
        worst.k === 'Separation' ? 'Raise preload or add bolts. Once the joint opens, the bolt carries the <i>whole</i> fluctuating load and fatigue failure follows quickly.'
          : worst.k === 'Fatigue' ? `Threads are severe notches (Se only ${fmt(r.Se)} MPa). Higher preload, a softer bolt (longer grip, reduced shank) or more bolts reduce σa. Rolled threads are much better than cut.`
            : 'The bolt is near proof load. Use a higher property class or larger size.');
      if (V.mem === 'Aluminium alloy' && r.dT < 0) out.append(h('div', { class: 'warnbox' }, `⚠ Cooling an aluminium joint clamped by steel bolts loses ${fmt(-r.dFi / 1000)} kN of preload per bolt (aluminium contracts more). Seals leak in cold weather for this reason.`));
      if (r.dFi > 0 && r.Fb > r.gr.Sp * r.At) out.append(h('div', { class: 'badbox' }, '⚠ Thermal expansion pushes the bolt past proof load. It will yield and lose preload on cooling.'));
      out.append(h('div', { class: 'eq' }, `C = kb/(kb+km);  bolt force Fb = C·P + Fi;  member force Fm = (1−C)·P − Fi
km = 0.5774πEd / 2 ln[5(0.5774l + 0.5d)/(0.5774l + 2.5d)]   (frustum, Shigley)
nf = Se(Sut − σi) / [Sut·σa + Se(σm − σi)],  σa = CP/2At = ${fmt(r.sa)} MPa,  σi = Fi/At = ${fmt(r.si)} MPa`));
      const pr = linspace(5, 100, 60), rs = pr.map(p => boltCalc(v, { pre: p }));
      plot(c1, { title: 'Preload sweep: why we tighten hard', xlabel: 'Preload (% proof)', ylabel: 'Factor of safety', ymin: 0, ymax: 6, legend: 'tr', hlines: [{ y: 1, label: '1.0' }], vlines: [{ x: v.pre }], series: [{ label: 'Separation', x: pr, y: rs.map(q => q.n0) }, { label: 'Fatigue', x: pr, y: rs.map(q => q.nf) }, { label: 'Yield load factor', x: pr, y: rs.map(q => q.nL) }] });
      const gl = linspace(10, 200, 40), rg = gl.map(l => boltCalc(v, { l }));
      plot(c2, { title: 'Longer grip → softer bolt → smaller C', xlabel: 'Grip length (mm)', ylabel: 'C and fatigue FS', legend: 'tl', vlines: [{ x: v.l }], series: [{ label: 'C', x: gl, y: rg.map(q => q.C) }, { label: 'Fatigue FS', x: gl, y: rg.map(q => q.nf) }] });
      effectTable(out, vv => { const q = boltCalc(vv); return { 'Fatigue FS': q.nf, 'Separation FS': q.n0, 'Yield factor': q.nL }; }, v, specs, { key: 'bolt' });
      explain(`Each bolt carries ${fmt(r.P / 1000)} kilonewtons. The joint constant is ${fmt(r.C, 2)}, so the bolt feels only ${fmt(100 * r.C)} percent of it. The weakest check is ${worst.k} at ${fmt(worst.v)}. Tighten to ${fmt(r.T)} newton metres.`);
    }
    const f = buildForm(L, specs, run, 'bolt'); run(f.vals);
    MD.onEnv = () => run(V);
    let t = 0;
    anim(() => {
      if (!B) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      t += 0.035; const s = 0.5 + 0.5 * Math.sin(t), P = B.P * s;
      const db = B.Fi / B.kb, dm = B.Fi / B.km, Fmax = Math.max(B.Fi + B.C * B.P, B.P) * 1.25;
      const x0 = 50, y0 = H - 30, W = w - 80, Hh = H - 60, sx = W / (db + dm) * 0.8, sy = Hh / Fmax;
      const X = d => x0 + d * sx, Y = F => y0 - F * sy;
      ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, 10); ctx.lineTo(x0, y0); ctx.lineTo(w - 10, y0); ctx.stroke();
      ctx.fillStyle = '#4a5566'; ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillText('Force', 6, 18); ctx.fillText('Deformation →', w - 90, y0 + 18);
      ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(db * 1.25), Y(B.Fi * 1.25)); ctx.stroke();
      ctx.strokeStyle = '#2f7d32'; ctx.beginPath(); ctx.moveTo(X(db + dm), Y(0)); ctx.lineTo(X(db - dm * 0.25), Y(B.Fi * 1.25)); ctx.stroke();
      // operating point under load P: bolt elongates by δ = CP/kb
      const dd = B.C * P / B.kb, Fb = B.Fi + B.C * P, Fm = Math.max(0, B.Fi - (1 - B.C) * P);
      ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(db + dd), Y(Fm)); ctx.lineTo(X(db + dd), Y(Fb)); ctx.stroke();
      ctx.setLineDash([4, 3]); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, Y(B.Fi)); ctx.lineTo(X(db), Y(B.Fi)); ctx.stroke(); ctx.setLineDash([]);
      [[X(db), Y(B.Fi), '#1b2430'], [X(db + dd), Y(Fb), '#0f5e8c'], [X(db + dd), Y(Fm), '#2f7d32']].forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); });
      ctx.fillStyle = '#1b2430'; ctx.font = '12px IBM Plex Mono, monospace';
      ctx.fillText(`Joint diagram · P = ${fmt(P / 1000)} kN (orange = P)`, x0 + 6, 16);
      ctx.fillStyle = '#0f5e8c'; ctx.fillText(`bolt ${fmt(Fb / 1000)} kN`, X(db + dd) + 8, Y(Fb) + 4);
      ctx.fillStyle = '#2f7d32'; ctx.fillText(`members ${fmt(Fm / 1000)} kN${Fm <= 0 ? ' SEPARATED' : ''}`, X(db + dd) + 8, Y(Fm) + 14);
      ctx.fillStyle = '#4a5566'; ctx.fillText(`Fi = ${fmt(B.Fi / 1000)} kN`, 4, Y(B.Fi) - 4);
      tag(ctx, 'bolt: stretches (slope kb)', X(db * 0.45), Y(B.Fi * 0.45) - 14, '#0f5e8c', 'right', 11);
      tag(ctx, 'members: compress (slope km)', X(db + dm * 0.6), Y(B.Fi * 0.4) + 4, '#2f7d32', 'left', 11);
    });
  }
});
