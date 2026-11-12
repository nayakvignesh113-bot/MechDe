'use strict';
const JT = {
  weld(v) { // two vertical fillet welds, length L, spacing b, load P at eccentricity e from weld-group centroid
    const P = v.P * 1000, L = v.L, b = v.b, Ju = L * (3 * b * b + L * L) / 6, Au = 2 * L; // unit throat
    const rx = b / 2, ry = L / 2, r = Math.hypot(rx, ry), M = P * v.e;
    const t1u = P / Au, t2u = M * r / Ju; // per unit throat
    const cosT = rx / r, tu = Math.sqrt(t1u * t1u + t2u * t2u + 2 * t1u * t2u * cosT); // primary (vertical) + secondary (perp. to r)
    const tall = v.tall / v.Kf, t = tu / tall, s = t / 0.707; // throat & leg size
    return { Ju, Au, t1u, t2u, tu, t, s, M };
  },
  rivet(v) {
    const d = v.d, t = v.t, p = v.p, n = v.n, shear = v.sh === 'Double' ? 1.875 : 1;
    const Pt = (p - d) * t * v.st, Ps = n * shear * Math.PI / 4 * d * d * v.ss, Pc = n * d * t * v.sc, Psolid = p * t * v.st;
    const Pmin = Math.min(Pt, Ps, Pc), eff = Pmin / Psolid;
    const gov = Pmin === Pt ? 'plate tearing between rivets' : Pmin === Ps ? 'rivet shearing' : 'crushing of plate/rivet';
    return { Pt, Ps, Pc, Psolid, Pmin, eff, gov, unwin: 6 * Math.sqrt(t) };
  },
};
MD.register('joints', {
  group: 'Machine elements', title: 'Welded & riveted joints', icon: '🔥', voice: 'weld welded joint rivet riveted fillet',
  kid: { what: 'Checks <b>welds</b> that hold a bracket off-centre, and <b>riveted</b> joints (old bridges, aircraft skins).', steps: ['Enter the load and how far off-centre it acts.', 'Read the weld size needed.', 'On the rivet tab, find the pitch that makes the joint strongest.'], try: 'Double the eccentricity e: the twisting part of the stress takes over.' },
  eq: [
    { t: 'Eccentric weld group', f: 'τ1 = P / A,   τ2 = M·r / J,   τ = √(τ1² + τ2² + 2τ1τ2·cos θ)', s: [['A', 'throat area'], ['J', 'polar moment of weld group'], ['r', 'distance to the farthest weld point']], fx: [['load further out (e)', 'twisting stress τ2 grows linearly'], ['spread the welds (b)', 'J grows fast, τ2 falls']] },
    { t: 'Fillet throat', f: 'throat t = 0.707 × leg size s', m: 'A fillet weld fails across its smallest section (the throat at 45°).' },
    { t: 'Riveted joint efficiency', f: 'η = min(Pt, Ps, Pc) / (p·t·σt),   Pt = (p − d)·t·σt,   Ps = n·(π/4)·d²·τ,   Pc = n·d·t·σc', fx: [['wider pitch p', 'tearing strength rises, but rivet shear doesn\'t: the best pitch balances them'], ['Unwin: d = 6√t', 'a classic rule for rivet size from plate thickness']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · permanent joints', 'Welded & riveted joints',
      'Welds and rivets make permanent joints. Welds are light and continuous but can hide defects and concentrate stress (fatigue at the weld toe); rivets are inspectable and stop cracks from running between plates, which is why riveted hulls did not split like some welded Liberty ships. Most failures start at the joint, not in the plate.');
    const body = h('div');
    tabs(main, ['Eccentrically loaded weld', 'Riveted lap/butt joint'], i => { body.innerHTML = ''; [weldTab, rivetTab][i](body); });
    main.append(body);
  }
});
function weldTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [{ id: 'P', label: 'Load', unit: 'kN', value: 25, min: 1, max: 500, step: 1, aliases: ['load'] }, { id: 'e', label: 'Eccentricity (load to weld centre)', unit: 'mm', value: 200, min: 0, max: 1000, step: 5, aliases: ['eccentricity'] },
    { id: 'L', label: 'Weld length (each of 2 vertical welds)', unit: 'mm', value: 200, min: 30, max: 800, step: 5 }, { id: 'b', label: 'Distance between welds', unit: 'mm', value: 150, min: 20, max: 800, step: 5 },
    { id: 'tall', label: 'Allowable weld shear', unit: 'MPa', value: 94, min: 40, max: 200, step: 1, tip: 'Typical static design value for fillet welds with E41-grade electrodes.' }, { id: 'Kf', label: 'Fatigue factor (1 static, 1.5 transverse, 2.7 parallel-end)', value: 1, min: 1, max: 3, step: 0.1 }];
  const out = h('div'), cv = plotCanvas('anim'); cv.style.height = '240px'; R.append(h('div', { class: 'card' }, cv, out));
  let W = null;
  function run(v) {
    const r = JT.weld(v); W = Object.assign({ v }, r); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Twisting moment', fmt(r.M / 1e6), 'kN·m'), metric('Direct shear per mm throat', fmt(r.t1u), 'N/mm'), metric('Twisting shear per mm throat', fmt(r.t2u), 'N/mm'), metric('Required throat', fmt(r.t), 'mm'), metric('Required leg size', fmt(Math.ceil(r.s)), 'mm', r.s <= 16 ? 'good' : 'warn')));
    verdict(out, r.s <= 16, `Fillet weld leg ${Math.ceil(r.s)} mm on both sides`, `${r.t2u > r.t1u ? 'The <b>twist</b> from the eccentric load dominates: move the welds apart or shorten the bracket.' : 'Direct shear dominates: add weld length.'} The most stressed point is the weld corner farthest from the centroid.`);
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => ({ 'Weld size needed': JT.weld(vv).s }), v, specs);
    explain(`Use ${Math.ceil(r.s)} millimetre fillet welds. ${r.t2u > r.t1u ? 'The twisting effect dominates.' : 'Direct shear dominates.'}`);
  }
  const f = buildForm(L, specs, run, 'weld'); run(f.vals);
  anim(t => { if (!W) return; const v = W.v, { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
    const sc = Math.min((w - 60) / (v.b + v.e + 40), (H - 40) / (v.L + 40)), x0 = 30, cy = H / 2;
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x0, cy - (v.L / 2 + 15) * sc, (v.b + 20) * sc, (v.L + 30) * sc); tag(ctx, 'column flange', x0 + 4, cy - (v.L / 2 + 22) * sc, '#475569', 'left', 11);
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(x0 + 10 * sc, cy - v.L / 2 * sc, (v.b + v.e) * sc, v.L * sc);
    ctx.fillStyle = '#c2410c'; [0, v.b].forEach(x => ctx.fillRect(x0 + (10 + x) * sc - 3, cy - v.L / 2 * sc, 6, v.L * sc));
    const xl = x0 + (10 + v.b / 2 + v.e) * sc, amp = 1 + 0.06 * Math.sin(t * 3); ctx.strokeStyle = '#b42318'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xl, cy - v.L / 2 * sc - 30 * amp); ctx.lineTo(xl, cy - v.L / 2 * sc + 4); ctx.stroke();
    tag(ctx, `P = ${v.P} kN`, xl + 6, cy - v.L / 2 * sc - 24, '#b42318', 'left', 12); tag(ctx, 'welds', x0 + (10 + v.b / 2) * sc, cy + v.L / 2 * sc + 12, '#c2410c', 'center', 11); tag(ctx, `e = ${v.e} mm`, (x0 + (10 + v.b / 2) * sc + xl) / 2, cy, '#1b2430', 'center', 11); });
}
function rivetTab(body) {
  const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g);
  const specs = [{ id: 't', label: 'Plate thickness', unit: 'mm', value: 12, min: 3, max: 40, step: 0.5 }, { id: 'd', label: 'Rivet hole diameter', unit: 'mm', value: 21, min: 6, max: 40, step: 0.5 },
    { id: 'p', label: 'Pitch', unit: 'mm', value: 60, min: 20, max: 200, step: 1, aliases: ['pitch'] }, { id: 'n', label: 'Rivets per pitch length (rows)', value: 2, min: 1, max: 4, step: 1 },
    { id: 'sh', label: 'Shear', type: 'select', options: ['Single', 'Double'], value: 'Single' }, { id: 'st', label: 'Plate tensile allowable', unit: 'MPa', value: 80, min: 40, max: 200, step: 1 },
    { id: 'ss', label: 'Rivet shear allowable', unit: 'MPa', value: 60, min: 30, max: 150, step: 1 }, { id: 'sc', label: 'Crushing allowable', unit: 'MPa', value: 120, min: 60, max: 300, step: 1 }];
  const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  function run(v) {
    const r = JT.rivet(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Tearing strength', fmt(r.Pt / 1000), 'kN'), metric('Shearing strength', fmt(r.Ps / 1000), 'kN'), metric('Crushing strength', fmt(r.Pc / 1000), 'kN'), metric('Solid plate strength', fmt(r.Psolid / 1000), 'kN'), metric('Joint efficiency', fmt(r.eff * 100) + ' %', '', r.eff > 0.7 ? 'good' : 'warn'), metric('Unwin rivet size 6√t', fmt(r.unwin), 'mm')));
    verdict(out, r.eff > 0.6, `Efficiency ${fmt(r.eff * 100)} %: governed by ${r.gov}`, 'A good joint is equally likely to fail in every way, so no strength is wasted. Find the pitch where tearing meets shearing on the chart.');
    const ps = linspace(v.d * 1.5, v.d * 6, 60), es = ps.map(p => JT.rivet(Object.assign({}, v, { p })));
    plot(c1, { title: 'Efficiency vs pitch: balance the failure modes', xlabel: 'Pitch (mm)', ylabel: 'Strength ÷ solid plate (%)', ymin: 0, legend: 'tr', vlines: [{ x: v.p }], series: [{ label: 'Tearing', x: ps, y: es.map(q => 100 * q.Pt / q.Psolid) }, { label: 'Shearing', x: ps, y: es.map(q => 100 * q.Ps / q.Psolid) }, { label: 'Crushing', x: ps, y: es.map(q => 100 * q.Pc / q.Psolid) }, { label: 'Joint efficiency', x: ps, y: es.map(q => 100 * q.eff), width: 3, color: '#1b2430' }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => ({ 'Efficiency': JT.rivet(vv).eff }), v, specs);
    explain(`Riveted joint efficiency ${fmt(r.eff * 100)} percent, governed by ${r.gov}.`);
  }
  const f = buildForm(L, specs, run, 'rivet'); run(f.vals);
}
