'use strict';
const ENDS = { 'Pinned–pinned (K = 1)': 1, 'Fixed–free (K = 2)': 2, 'Fixed–pinned (K = 0.7)': 0.7, 'Fixed–fixed (K = 0.65 practical)': 0.65 };
function colSection(v, s) { // s = scale on primary dimension
  if (v.sec === 'Solid round') { const d = v.d * s; return { A: Math.PI * d * d / 4, I: Math.PI * d ** 4 / 64, c: d / 2, label: `Ø${fmt(d)} mm` }; }
  if (v.sec === 'Hollow tube') { const D = v.d * s, t = Math.min(v.t * s, D / 2 - 0.01), di = D - 2 * t; return { A: Math.PI * (D * D - di * di) / 4, I: Math.PI * (D ** 4 - di ** 4) / 64, c: D / 2, label: `Ø${fmt(D)} × ${fmt(t)} mm` }; }
  const b = v.d * s, hh = v.t * s; return { A: b * hh, I: Math.min(b * hh ** 3, hh * b ** 3) / 12, c: Math.min(b, hh) / 2, label: `${fmt(b)} × ${fmt(hh)} mm` };
}
function colCalc(v, m, s = 1) {
  const S = colSection(v, s), K = ENDS[v.ends], Le = K * v.L, k = Math.sqrt(S.I / S.A), lam = Le / k, lam1 = Math.sqrt(2 * Math.PI ** 2 * m.E / m.Sy);
  const Pe = Math.PI ** 2 * m.E * S.I / Le ** 2, Pj = S.A * (m.Sy - (m.Sy * lam / (2 * Math.PI)) ** 2 / m.E), Pr = m.Sy * S.A / (1 + m.Sy / (Math.PI ** 2 * m.E) * lam * lam);
  const Pcr = lam < lam1 ? Pj : Pe;
  let Psec = NaN;
  if (v.e > 0) Psec = bisect(P => P / S.A * (1 + v.e * S.c / (k * k) / Math.cos(Math.min(1.5707, Le / (2 * k) * Math.sqrt(P / (m.E * S.A))))) - m.Sy, 1, Math.min(Pe * 0.999, m.Sy * S.A), 1e-3);
  return { S, K, Le, k, lam, lam1, Pe, Pj, Pr, Pcr, Psec, regime: lam < lam1 ? 'Johnson (inelastic)' : 'Euler (elastic)' };
}
MD.register('column', {
  group: 'Machine elements', title: 'Columns & buckling', icon: '🏛', voice: 'column buckling euler johnson rankine strut',
  render(main) {
    pageHead(main, 'Strength of materials → design', 'Columns: when stiffness beats strength',
      'Short struts fail by <b>crushing/yielding</b> (strength governs). Long ones fail by <b>buckling</b> at loads far below yield (stiffness E·I governs, so a stronger steel buys <i>nothing</i>). Between them lies an inelastic zone where neither pure theory holds (Johnson parabola). Slenderness ratio λ = KL/k decides which regime you are in.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'P', label: 'Axial load', unit: 'kN', value: 80, min: 1, max: 5000, step: 1, aliases: ['load'] },
      { id: 'L', label: 'Length', unit: 'mm', value: 1500, min: 50, max: 10000, step: 10, aliases: ['length'] },
      { id: 'ends', label: 'End condition', type: 'select', options: Object.keys(ENDS), value: 'Pinned–pinned (K = 1)', wide: true, aliases: ['end condition', 'ends'] },
      { id: 'sec', label: 'Section', type: 'select', options: ['Solid round', 'Hollow tube', 'Rectangle'], value: 'Hollow tube', aliases: ['section'] },
      { id: 'd', label: 'Outer Ø / width b', unit: 'mm', value: 60, min: 5, max: 600, step: 1, aliases: ['diameter', 'width'] },
      { id: 't', label: 'Wall t / depth h', unit: 'mm', value: 4, min: 0.5, max: 300, step: 0.5, aliases: ['thickness', 'depth'] },
      { id: 'mat', label: 'Material', type: 'select', options: MAT_NAMES, value: 'IS 2062 E250 structural steel', wide: true, aliases: ['material'] },
      { id: 'e', label: 'Load eccentricity e (secant check)', unit: 'mm', value: 2, min: 0, max: 50, step: 0.5, aliases: ['eccentricity'] },
      { id: 'n', label: 'Required factor of safety', value: 2, min: 1, max: 5, step: 0.1, aliases: ['safety factor'] },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(); c1.style.height = '320px'; cv.style.height = '260px';
    R.append(h('div', { class: 'card' }, h('div', { class: 'grid3' }, cv, out)), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
    let C = null, V;
    function run(v) {
      V = v; const m = matAt(v.mat), r = colCalc(v, m), P = v.P * 1000; C = r;
      const nAx = m.Sy * r.S.A / P, nB = r.Pcr / P, nSec = r.Psec / P;
      const sReq = bisect(s => Math.min(colCalc(v, m, s).Pcr, v.e > 0 ? colCalc(v, m, s).Psec : Infinity) / P - v.n, 0.05, 40, 1e-5);
      const rq = colCalc(v, m, sReq);
      out.innerHTML = '';
      out.append(h('div', { class: 'metrics' },
        metric('Slenderness λ = KL/k', fmt(r.lam), '', r.lam > 200 ? 'bad' : ''), metric('Transition λ₁ = √(2π²E/Sy)', fmt(r.lam1), ''),
        metric('Regime', r.regime, ''), metric('Critical load (Euler/Johnson)', fmt(r.Pcr / 1000), 'kN'), metric('Rankine–Gordon', fmt(r.Pr / 1000), 'kN'),
        metric('Secant (e = ' + v.e + ' mm) yield load', fmt(r.Psec / 1000), 'kN'), metric('FS buckling', fmt(nB), '', fsStatus(nB, v.n)), metric('FS crushing (Sy·A)', fmt(nAx), '', fsStatus(nAx, v.n)),
        metric('Size for required FS', rq.S.label, '', 'good')));
      verdict(out, Math.min(nB, v.e > 0 ? nSec : Infinity) >= v.n, r.lam >= r.lam1 ? 'Buckling (elastic) governs: stiffness, not strength' : 'Inelastic buckling: strength and stiffness both matter',
        r.lam >= r.lam1 ? `λ = ${fmt(r.lam)} > λ₁ = ${fmt(r.lam1)}. Swapping to a higher-strength steel changes nothing (same E). Spread the material away from the axis (larger tube, thinner wall), brace it to cut KL, or fix the ends.` : `λ = ${fmt(r.lam)} < λ₁: Johnson parabola. Higher Sy helps here, and so does a larger k.`);
      if (r.lam > 200) out.append(h('div', { class: 'warnbox' }, '⚠ λ > 200 is impractically slender for compression members (IS 800 limits λ ≤ 180 for main members).'));
      envWarnings(m).forEach(w => out.append(h('div', { class: 'warnbox' }, '⚠ ' + w)));
      const ls = linspace(5, 250, 200);
      const sig = l => l < r.lam1 ? m.Sy - (m.Sy * l / (2 * Math.PI)) ** 2 / m.E : Math.PI ** 2 * m.E / (l * l);
      plot(c1, { title: `Critical stress vs slenderness: ${v.mat} at ${ENV.T} °C`, xlabel: 'Slenderness ratio λ = KL/k', ylabel: 'σ_cr (MPa)', ymin: 0, ymax: m.Sy * 1.25, legend: 'tr', vlines: [{ x: r.lam1, label: 'λ₁', color: '#94a3b8' }],
        series: [{ label: 'Euler π²E/λ²', x: ls, y: ls.map(l => Math.PI ** 2 * m.E / (l * l)), dash: [5, 3] }, { label: 'Johnson + Euler (design)', x: ls, y: ls.map(sig), width: 2.6 }, { label: 'Rankine–Gordon', x: ls, y: ls.map(l => m.Sy / (1 + m.Sy / (Math.PI ** 2 * m.E) * l * l)) }, { label: 'Yield Sy', x: [0, 250], y: [m.Sy, m.Sy], color: '#94a3b8', dash: [2, 3] }],
        points: [{ x: Math.min(r.lam, 250), y: P / r.S.A, label: 'applied σ', color: '#c2410c' }, { x: Math.min(r.lam, 250), y: sig(r.lam), label: 'critical', color: '#1b2430', r: 4 }] });
      R.querySelectorAll('.effect').forEach(e => e.remove()); effectTable(R, vv => { const mm = matAt(vv.mat), q = colCalc(vv, mm); return { 'Buckling FS': q.Pcr / (vv.P * 1000), 'Slenderness λ': q.lam }; }, v, specs, { key: 'column', note: 'Length and section size dominate. Material strength barely matters once the column is slender.' });
      explain(`Slenderness ratio ${fmt(r.lam)} against transition ${fmt(r.lam1)}, so ${r.regime} governs. Critical load ${fmt(r.Pcr / 1000)} kilonewtons, buckling safety factor ${fmt(nB)}.`);
    }
    const f = buildForm(L, specs, run, 'column'); run(f.vals);
    MD.onEnv = () => run(V);
    let t = 0;
    anim(() => {
      if (!C) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      t += 0.03; const ratio = Math.min(1.2, V.P * 1000 / C.Pcr), amp = ratio > 0.6 ? (ratio - 0.6) * 60 * (0.6 + 0.4 * Math.sin(t)) : 1.5 * Math.sin(t);
      const top = 26, bot = H - 22, cx = w / 2, K = C.K;
      ctx.lineWidth = 7; ctx.strokeStyle = ratio >= 1 ? '#b42318' : ratio > 0.7 ? '#b26a00' : '#0f5e8c'; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const u = i / 40; let y; if (K === 2) y = 1 - Math.cos(Math.PI * u / 2); else if (K === 1) y = Math.sin(Math.PI * u); else if (K < 0.66) y = (1 - Math.cos(2 * Math.PI * u)) / 2; else y = Math.sin(Math.PI * u) * (1 - 0.4 * u) * 1.2; const px = cx + amp * y, py = bot - u * (bot - top); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.fillStyle = '#475569'; ctx.fillRect(cx - 30, bot, 60, 8); if (K !== 2) ctx.fillRect(cx - 30 + (K === 2 ? amp : 0), top - 8, 60, 8);
      ctx.fillStyle = '#c2410c'; ctx.beginPath(); const ax = cx + (K === 2 ? amp : 0); ctx.moveTo(ax, top - 10); ctx.lineTo(ax - 7, top - 24); ctx.lineTo(ax + 7, top - 24); ctx.fill();
      ctx.fillStyle = '#1b2430'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillText(`P/Pcr = ${fmt(ratio)}`, 6, H - 6);
    });
  }
});
