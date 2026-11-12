'use strict';
const WIRES = { // Sut = A / d^m (MPa, d in mm), G (MPa)
  'Music wire ASTM A228': { A: 2211, m: 0.145, G: 79300 }, 'Oil-tempered ASTM A229': { A: 1855, m: 0.187, G: 77200 },
  'Chrome-vanadium ASTM A232': { A: 2005, m: 0.168, G: 77200 }, 'Chrome-silicon ASTM A401': { A: 1974, m: 0.108, G: 77200 }, 'Stainless 302 ASTM A313': { A: 1867, m: 0.146, G: 69000 },
};
const WIRE_D = [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3, 3.2, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 11, 12, 14, 16];
MD.register('spring', {
  group: 'Machine elements', title: 'Helical spring', icon: '🌀', voice: 'spring helical compression spring',
  render(main) {
    pageHead(main, 'Machine elements · energy storage', 'Helical compression spring',
      'Strength-of-materials surprise: a compression spring\'s wire is in <b>torsion</b>, not compression. Curvature and direct shear raise the inner-fibre stress (Wahl/Bergsträsser factor). A spring must also not <b>buckle</b> (slender free length), not <b>surge</b> (its own wave resonance, as in valve springs), and must survive <b>fatigue</b> (Zimmerli data). Wire diameter is iterated, because strength itself depends on d (thinner wire is stronger).');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'Fmin', label: 'Minimum working load', unit: 'N', value: 150, min: 0, max: 20000, step: 5, aliases: ['minimum load'] },
      { id: 'Fmax', label: 'Maximum working load', unit: 'N', value: 600, min: 1, max: 30000, step: 5, aliases: ['maximum load', 'load'] },
      { id: 'dw', label: 'Working deflection (Fmin → Fmax)', unit: 'mm', value: 20, min: 1, max: 300, step: 0.5, aliases: ['deflection', 'stroke'] },
      { id: 'C', label: 'Spring index C = D/d', value: 7, min: 4, max: 12, step: 0.25, aliases: ['index', 'spring index'] },
      { id: 'mat', label: 'Wire material', type: 'select', options: Object.keys(WIRES), value: 'Chrome-vanadium ASTM A232', wide: true, aliases: ['material'] },
      { id: 'peen', label: 'Shot-peened', type: 'check', value: false },
      { id: 'ends', label: 'Ends', type: 'select', options: ['Squared & ground', 'Squared', 'Plain'], value: 'Squared & ground' },
      { id: 'alpha', label: 'End support (buckling α)', type: 'select', options: ['0.5 both ends on parallel flats', '0.707 one flat, one pivoted', '1.0 both pivoted', '2.0 one free'], value: '0.5 both ends on parallel flats', wide: true },
      { id: 'fop', label: 'Operating frequency of load cycle', unit: 'Hz', value: 20, min: 0, max: 200, step: 1, aliases: ['frequency'] },
      { id: 'nf', label: 'Required fatigue FS', value: 1.5, min: 1, max: 3, step: 0.05, aliases: ['safety factor'] },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(); cv.style.height = '280px';
    R.append(h('div', { class: 'card' }, h('div', { class: 'grid3' }, cv, out)), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
    out.style.minWidth = '0';
    let S = null;
    function calc(v, d) {
      const W = WIRES[v.mat], C = v.C, D = C * d, KB = (4 * C + 2) / (4 * C - 3), k = (v.Fmax - v.Fmin) / v.dw;
      const kT = strengthTempFactor({ cls: 'steel' }, ENV.T);
      const Sut = W.A / Math.pow(d, W.m) * kT, Ssy = 0.45 * Sut, Ssu = 0.67 * Sut, G = W.G * modulusTempFactor({ cls: 'steel' }, ENV.T);
      const t = F => KB * 8 * F * D / (Math.PI * d ** 3);
      const tmax = t(v.Fmax), ta = t((v.Fmax - v.Fmin) / 2), tm = t((v.Fmax + v.Fmin) / 2);
      const Ssa = v.peen ? 398 : 241, Ssm = v.peen ? 534 : 379, Sse = Ssa / (1 - (Ssm / Ssu) ** 2);
      const nf = 0.5 * (Ssu / tm) ** 2 * (ta / Sse) * (-1 + Math.sqrt(1 + (2 * tm * Sse / (Ssu * ta)) ** 2)) * RELIAB[ENV.rel] / 0.814 * KENV.steel[mediumIndex()];
      const Na = G * d ** 4 / (8 * D ** 3 * k), Nt = v.ends === 'Plain' ? Na : Na + 2;
      const Ls = v.ends === 'Squared & ground' ? d * Nt : d * (Nt + 1);
      const L0 = Ls + 1.15 * v.Fmax / k, alpha = parseFloat(v.alpha), Lcr = 2.63 * D / alpha;
      const mass = 7850 * Math.PI ** 2 * (d / 1000) ** 2 * (D / 1000) * Na / 4, fs = 0.5 * Math.sqrt(k * 1000 / mass);
      const tsolid = t(k * (L0 - Ls)), ns = Ssy / tsolid;
      return { d, D, KB, k, Sut, Ssy, tmax, ta, tm, Sse, nf, Na, Nt, Ls, L0, Lcr, buck: L0 > Lcr, fs, mass, ns, Fmin: v.Fmin, Fmax: v.Fmax };
    }
    function run(v) {
      if (v.Fmax <= v.Fmin) { out.innerHTML = '<div class="badbox">Fmax must exceed Fmin.</div>'; return; }
      const rows = WIRE_D.map(d => calc(v, d));
      const ok = r => r.nf >= v.nf && r.ns >= 1.2 && !r.buck && (v.fop <= 0 || r.fs >= 15 * v.fop) && r.Na >= 3;
      const pick = rows.find(ok); S = pick || rows.find(r => r.nf >= v.nf) || rows[rows.length - 1];
      out.innerHTML = '';
      const r = S;
      out.append(h('div', { class: 'metrics' },
        metric('Wire Ø d', r.d, 'mm', pick ? 'good' : 'bad'), metric('Mean coil Ø D', fmt(r.D), 'mm'), metric('Rate k', fmt(r.k), 'N/mm'),
        metric('Active / total coils', `${fmt(r.Na, 3)} / ${fmt(r.Nt, 3)}`, ''), metric('Free / solid length', `${fmt(r.L0)} / ${fmt(r.Ls)}`, 'mm'),
        metric('Bergsträsser KB', fmt(r.KB, 3), ''), metric('τ max at Fmax', fmt(r.tmax), 'MPa'), metric('Fatigue FS (Gerber–Zimmerli)', fmt(r.nf), '', fsStatus(r.nf, v.nf)),
        metric('FS at solid (Ssy)', fmt(r.ns), '', fsStatus(r.ns, 1.2)), metric('Buckling: L0 vs limit', `${fmt(r.L0)} / ${fmt(r.Lcr)}`, 'mm', r.buck ? 'bad' : 'good'),
        metric('Surge frequency', fmt(r.fs), 'Hz', v.fop <= 0 || r.fs >= 15 * v.fop ? 'good' : 'bad'), metric('Spring mass', fmt(r.mass * 1000), 'g')));
      const why = q => q.nf < v.nf ? 'fatigue' : q.ns < 1.2 ? 'solid-height stress' : q.buck ? 'buckling' : (v.fop > 0 && q.fs < 15 * v.fop) ? 'surge' : 'too few coils';
      const tally = rows.filter(q => q.d < r.d).reduce((a, q) => { const k = why(q); a[k] = (a[k] || 0) + 1; return a; }, {});
      const failSummary = Object.entries(tally).map(([k, n]) => `${k} (${n} sizes)`).join(', ') || 'none';
      verdict(out, !!pick, pick ? `Use d = ${r.d} mm wire, D = ${fmt(r.D)} mm, ${fmt(r.Nt, 3)} total coils` : 'No standard wire meets every check at this spring index',
        pick ? `Thinner wires were rejected for: ${failSummary}. The first failure mode as d shrinks is the governing one.`
          : 'Try a lower spring index (stockier coil), a stronger wire (Cr-Si), shot peening, or guide the spring on a rod/in a bore to prevent buckling.');
      const tb = h('table', { class: 't' }, h('tr', null, ...['d', 'D', 'Na', 'L0', 'τmax', 'FS fat', 'FS solid', 'Buckles?', 'f surge (Hz)'].map(x => h('th', null, x))));
      rows.filter(q => q.Na > 1 && q.Na < 80).forEach(q => tb.append(h('tr', { class: q === S ? 'hl' : ok(q) ? '' : 'fail' }, ...[q.d, fmt(q.D), fmt(q.Na, 3), fmt(q.L0), fmt(q.tmax), fmt(q.nf), fmt(q.ns), q.buck ? 'yes' : 'no', fmt(q.fs)].map(x => h('td', null, String(x))))));
      out.append(h('details', null, h('summary', null, 'Wire-diameter iteration'), h('div', { class: 'tablewrap' }, tb)));
      const dd = rows.filter(q => q.Na > 0.5 && q.Na < 200);
      plot(c1, { title: 'Each check vs wire diameter (C fixed): the pass window', xlabel: 'Wire diameter d (mm)', ylabel: 'Ratio (≥ 1 passes)', logy: true, legend: 'tr', hlines: [{ y: 1, label: 'pass', color: '#2f7d32' }], vlines: [{ x: r.d }],
        series: [{ label: 'Fatigue FS / required', x: dd.map(q => q.d), y: dd.map(q => q.nf / v.nf) }, { label: 'Solid-stress FS / 1.2', x: dd.map(q => q.d), y: dd.map(q => q.ns / 1.2) },
          { label: 'Buckling limit / L0', x: dd.map(q => q.d), y: dd.map(q => q.Lcr / q.L0) }, { label: 'Surge f / (15·f_op)', x: dd.map(q => q.d), y: dd.map(q => v.fop > 0 ? q.fs / (15 * v.fop) : NaN) }] });
      R.querySelectorAll('.effect').forEach(e => e.remove()); effectTable(R, vv => { const q = calc(vv, r.d); return { 'Fatigue FS': q.nf, 'Max stress': q.tmax, 'Rate k': q.k, 'Surge f': q.fs }; }, v, specs, { key: 'spring', note: `Wire held at Ø${r.d} mm.` });
      explain(pick ? `Use ${r.d} millimetre wire wound on a ${fmt(r.D)} millimetre mean diameter with ${fmt(r.Nt, 3)} total coils. Fatigue safety factor ${fmt(r.nf)}, surge frequency ${fmt(r.fs)} hertz.` : 'No standard wire meets every requirement at this spring index.');
    }
    const f = buildForm(L, specs, run, 'spring'); run(f.vals);
    MD.onEnv = () => run(f.vals);
    let t = 0;
    anim(() => {
      if (!S) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      t += 0.05; const F = S.Fmin + (S.Fmax - S.Fmin) * (0.5 + 0.5 * Math.sin(t));
      const Lnow = S.L0 - F / S.k, sc = (H - 40) / S.L0, cx = w / 2, Rr = Math.min(w * 0.3, S.D / 2 * sc), base = H - 14;
      const top = base - Lnow * sc, turns = S.Nt, N = Math.ceil(turns * 40);
      ctx.fillStyle = '#475569'; ctx.fillRect(cx - Rr - 14, base, 2 * Rr + 28, 6); ctx.fillRect(cx - Rr - 14, top - 6, 2 * Rr + 28, 6);
      ctx.lineWidth = Math.max(2, S.d * sc); ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) { ctx.strokeStyle = pass ? '#c2410c' : '#7c2d12aa'; ctx.beginPath(); let pen = false;
        for (let i = 0; i <= N; i++) { const u = i / N, a = u * turns * 2 * Math.PI, front = Math.sin(a) > 0; const y = base - S.d * sc / 2 - u * (Lnow - S.d) * sc, x = cx + Rr * Math.cos(a);
          if (front === !!pass) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; } ctx.stroke(); }
      ctx.fillStyle = '#1b2430'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillText(`F = ${fmt(F)} N`, 6, 14); ctx.fillText(`L = ${fmt(Lnow)} mm`, 6, 28);
      const tau = S.KB * 8 * F * S.D / (Math.PI * S.d ** 3); ctx.fillText(`τ = ${fmt(tau)} MPa`, 6, 42);
    });
  }
});
