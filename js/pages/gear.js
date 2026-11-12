'use strict';
const MODULES = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20];
const GEAR_MATS = {
  'Grey CI FG 260 (BHN 200)': { Sut: 260, BHN: 200 }, 'C45 normalised (BHN 200)': { Sut: 630, BHN: 200 },
  '40Cr1 Q&T (BHN 300)': { Sut: 900, BHN: 300 }, 'EN24 Q&T (BHN 350)': { Sut: 1100, BHN: 350 },
  '15Ni4Cr1 case-carburised (core Sut 1100, surface ≈ 58 HRC ≈ BHN 600)': { Sut: 1100, BHN: 600 },
  'Phosphor bronze (BHN 100)': { Sut: 240, BHN: 100 }, 'Nylon 66 (BHN ≈ 25)': { Sut: 80, BHN: 25 },
};
function gearCalc(v, m, overrideBHN) {
  const pm = GEAR_MATS[v.pmat], gm = GEAR_MATS[v.gmat];
  const z2 = Math.round(v.z1 * v.i), w1 = v.rpm * 2 * Math.PI / 60;
  const dp = m * v.z1, dg = m * z2, vel = Math.PI * dp * v.rpm / 60000, b = v.k * m;
  const Pt = v.P * 1000 / vel, Cv = v.grade.startsWith('Ordinary') ? 3 / (3 + vel) : v.grade.startsWith('Careful') ? 6 / (6 + vel) : 5.6 / (5.6 + Math.sqrt(vel));
  const Peff = v.Cs * Pt / Cv;
  const Y = z => 0.484 - 2.87 / z; // Lewis form factor, 20° full depth
  const kT = strengthTempFactor({ cls: 'steel' }, ENV.T);
  const sbp = pm.Sut / 3 * kT, sbg = gm.Sut / 3 * kT;
  const weak = sbp * Y(v.z1) <= sbg * Y(z2) ? 'pinion' : 'gear';
  const Sb = m * b * Math.min(sbp * Y(v.z1), sbg * Y(z2));
  const BHN = overrideBHN || Math.min(pm.BHN, gm.BHN), K = 0.16 * (BHN / 100) ** 2, Q = 2 * z2 / (z2 + v.z1);
  const Sw = b * Q * dp * K;
  // AGMA-style Hertz cross-check
  const Qv = v.grade.startsWith('Ordinary') ? 6 : v.grade.startsWith('Careful') ? 8 : 10, B = 0.25 * (12 - Qv) ** (2 / 3), A = 50 + 56 * (1 - B), Kv = Math.pow((A + Math.sqrt(200 * vel)) / A, B);
  const I = Math.cos(20 * deg) * Math.sin(20 * deg) / 2 * v.i / (v.i + 1);
  const sH = 191 * Math.sqrt(Pt * Kv * v.Cs * 1.3 / (b * dp * I)), Sc = 2.22 * BHN + 200;
  return { m, z2, dp, dg, vel, b, Pt, Cv, Peff, Sb, Sw, nb: Sb / Peff, nw: Sw / Peff, weak, Y1: Y(v.z1), Y2: Y(z2), K, Q, sH, Sc, nH: (Sc / sH) ** 2, T1: v.P * 1000 / w1, BHN };
}
MD.register('gear', {
  group: 'Machine elements', title: 'Spur gear designer', icon: '⚙️', voice: 'gear spur gear design module',
  render(main) {
    pageHead(main, 'Machine elements · power transmission', 'Spur gear designer',
      'A gear tooth is a short <b>cantilever</b> (Lewis: bending fatigue at the root) whose flank is a pair of <b>curved surfaces in rolling contact</b> (Hertz/Buckingham: pitting). The <b>module</b> mostly buys bending strength; <b>hardness</b> mostly buys wear strength. Speed brings the dynamic load. This page sweeps standard modules and shows which mode limits your pair.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { section: 'Duty' },
      { id: 'P', label: 'Power', unit: 'kW', value: 10, min: 0.2, max: 500, step: 0.1, aliases: ['power'] },
      { id: 'rpm', label: 'Pinion speed', unit: 'rpm', value: 1440, min: 50, max: 10000, step: 10, aliases: ['speed', 'rpm'] },
      { id: 'i', label: 'Speed ratio i', value: 3, min: 1, max: 8, step: 0.05, aliases: ['ratio'] },
      { id: 'z1', label: 'Pinion teeth z1 (≥ 18 to avoid undercut)', value: 20, min: 12, max: 60, step: 1, aliases: ['teeth', 'pinion teeth'] },
      { id: 'k', label: 'Face width factor b = k·m', value: 10, min: 6, max: 14, step: 0.5, aliases: ['face width'] },
      { id: 'Cs', label: 'Service factor Cs', value: 1.5, min: 1, max: 2.5, step: 0.05, aliases: ['service factor'], tip: 'Uniform 1.0–1.25; medium shock 1.25–1.5; heavy shock 1.75–2' },
      { section: 'Materials & quality' },
      { id: 'pmat', label: 'Pinion material', type: 'select', options: Object.keys(GEAR_MATS), value: '40Cr1 Q&T (BHN 300)', wide: true, aliases: ['pinion material'] },
      { id: 'gmat', label: 'Gear material', type: 'select', options: Object.keys(GEAR_MATS), value: 'C45 normalised (BHN 200)', wide: true, aliases: ['gear material'] },
      { id: 'grade', label: 'Manufacturing accuracy', type: 'select', options: ['Ordinary cut (Cv = 3/(3+v))', 'Carefully cut (Cv = 6/(6+v))', 'Precision hobbed/ground (Cv = 5.6/(5.6+√v))'], value: 'Carefully cut (Cv = 6/(6+v))', wide: true },
      { id: 'n', label: 'Required factor of safety', value: 1.5, min: 1, max: 3, step: 0.05, aliases: ['safety factor'] },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(), c2 = plotCanvas();
    R.append(h('div', { class: 'card' }, cv, out), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
    let G = null, V;
    function run(v) {
      V = v; const rows = MODULES.map(m => gearCalc(v, m));
      const pick = rows.find(r => Math.min(r.nb, r.nw) >= v.n && r.nH >= 1) || rows[rows.length - 1];
      G = pick;
      const gov = pick.nb < pick.nw ? 'Bending (Lewis beam strength)' : 'Wear (Buckingham surface strength)';
      out.innerHTML = '';
      out.append(h('div', { class: 'metrics' },
        metric('Selected module m', pick.m, 'mm', 'good'), metric('Teeth z1 / z2', `${v.z1} / ${pick.z2}`, ''), metric('Pitch Ø pinion / gear', `${fmt(pick.dp)} / ${fmt(pick.dg)}`, 'mm'),
        metric('Face width b', fmt(pick.b), 'mm'), metric('Pitch-line velocity', fmt(pick.vel), 'm/s'), metric('Tangential load Pt', fmt(pick.Pt), 'N'),
        metric('Velocity factor Cv', fmt(pick.Cv), ''), metric('Effective load Cs·Pt/Cv', fmt(pick.Peff), 'N'),
        metric('Bending FS (weaker: ' + pick.weak + ')', fmt(pick.nb), '', fsStatus(pick.nb, v.n)), metric('Wear FS', fmt(pick.nw), '', fsStatus(pick.nw, v.n)),
        metric('Hertz σH / allowable', `${fmt(pick.sH)} / ${fmt(pick.Sc)}`, 'MPa', pick.sH <= pick.Sc ? 'good' : 'bad')));
      verdict(out, true, `Module ${pick.m} mm: limited by ${gov.toLowerCase()}`,
        pick.nb < pick.nw ? 'The teeth would break before they pit. More hardness won\'t help; a larger module or wider face, a stronger core, or more teeth (larger Y) will.'
          : `Surface pitting comes first. Hardness enters as BHN² in K = 0.16(BHN/100)², so through-hardening or case-carburising the pair is far cheaper than going up in module. ${pick.BHN < 300 ? 'Try a harder material pair.' : ''}`);
      if (v.z1 < 18) out.append(h('div', { class: 'warnbox' }, `⚠ ${v.z1} teeth on a 20° full-depth pinion undercut during generation (minimum ≈ 18 for rack cutting), which weakens the root. Use profile shift or more teeth.`));
      if (ENV.T > 120) out.append(h('div', { class: 'warnbox' }, '⚠ High temperature thins the lubricant film; scuffing may govern over pitting. Check flash temperature.'));
      const tb = h('table', { class: 't' }, h('tr', null, ...['m', 'dp (mm)', 'v (m/s)', 'b (mm)', 'Peff (N)', 'Sb (N)', 'Sw (N)', 'FS bend', 'FS wear', 'σH (MPa)'].map(x => h('th', null, x))));
      rows.forEach(r => tb.append(h('tr', { class: r === pick ? 'hl' : (Math.min(r.nb, r.nw) < v.n ? 'fail' : '') }, ...[r.m, fmt(r.dp), fmt(r.vel), fmt(r.b), fmt(r.Peff), fmt(r.Sb), fmt(r.Sw), fmt(r.nb), fmt(r.nw), fmt(r.sH)].map(x => h('td', null, String(x))))));
      out.append(h('details', { open: true }, h('summary', null, 'Module iteration (velocity factor depends on the module being chosen)'), h('div', { class: 'tablewrap' }, tb)));
      out.append(h('div', { class: 'eq' }, `Lewis:      Sb = m·b·σb·Y,   σb = Sut/3,  Y = 0.484 − 2.87/z     (pinion Y = ${fmt(pick.Y1, 3)}, gear Y = ${fmt(pick.Y2, 3)})
Buckingham: Sw = b·Q·dp·K,  Q = 2z2/(z1+z2) = ${fmt(pick.Q, 3)},  K = 0.16(BHN/100)² = ${fmt(pick.K, 3)} N/mm²
Hertz:      σH = ZE·√(Wt·Kv·Ko·Km / (b·dp·I)),  ZE = 191 √MPa (steel/steel), Sc ≈ 2.22·HB + 200`));
      // dominance vs hardness
      const hb = linspace(100, 650, 60), r2 = hb.map(x => gearCalc(v, pick.m, x));
      plot(c1, { title: `FS vs surface hardness (m = ${pick.m})`, xlabel: 'Surface hardness (BHN)', ylabel: 'Factor of safety', legend: 'tl', hlines: [{ y: v.n, label: 'required' }], series: [{ label: 'Bending (hardness-independent)', x: hb, y: r2.map(r => r.nb) }, { label: 'Wear (∝ BHN²)', x: hb, y: r2.map(r => r.nw) }] });
      const ms = MODULES; plot(c2, { title: 'FS vs module', xlabel: 'Module (mm)', ylabel: 'Factor of safety', logy: true, legend: 'tl', hlines: [{ y: v.n, label: 'required' }], series: [{ label: 'Bending ∝ m²', x: ms, y: rows.map(r => r.nb) }, { label: 'Wear ∝ m²', x: ms, y: rows.map(r => r.nw) }], vlines: [{ x: pick.m }] });
      explain(`Use module ${pick.m} with ${v.z1} and ${pick.z2} teeth and a ${fmt(pick.b)} millimetre face. The design is limited by ${gov}. Bending safety factor ${fmt(pick.nb)}, wear safety factor ${fmt(pick.nw)}.`);
    }
    const f = buildForm(L, specs, run, 'gear'); run(f.vals);
    MD.onEnv = () => run(V);
    const inv = a => Math.tan(a) - a, phi = 20 * deg;
    function gearPath(ctx, cx, cy, z, mm, rot, sc) {
      const r = mm * z / 2, rb = r * Math.cos(phi), ra = r + mm, rf = Math.max(r - 1.25 * mm, 0.2 * r), psi = Math.PI / (2 * z) + inv(phi);
      ctx.beginPath();
      for (let k = 0; k < z; k++) {
        const c = rot + k * 2 * Math.PI / z, rs = linspace(Math.max(rb, rf), ra, 8);
        const pt = (rr, a) => [cx + rr * sc * Math.cos(a), cy - rr * sc * Math.sin(a)];
        const a0 = c - Math.PI / z;
        if (k === 0) ctx.moveTo(...pt(rf, a0));
        ctx.lineTo(...pt(rf, c - psi)); // root to base (radial)
        rs.forEach(rr => ctx.lineTo(...pt(rr, c - (psi - inv(Math.acos(Math.min(1, rb / rr)))))));
        [...rs].reverse().forEach(rr => ctx.lineTo(...pt(rr, c + (psi - inv(Math.acos(Math.min(1, rb / rr)))))));
        ctx.lineTo(...pt(rf, c + psi)); ctx.lineTo(...pt(rf, c + Math.PI / z));
      }
      ctx.closePath();
    }
    let th = 0;
    anim(() => {
      if (!G) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      const z1 = V.z1, z2 = G.z2, mm = G.m, r1 = mm * z1 / 2, r2 = mm * z2 / 2;
      const sc = Math.min((w - 30) / (2 * (r1 + r2) + 4 * mm), (H - 30) / (2 * r2 + 2.5 * mm));
      const total = (r1 + r2 + mm) * 2 * sc, cx1 = (w - total) / 2 + (r1 + mm) * sc + 4, cy = H / 2, cx2 = cx1 + (r1 + r2) * sc;
      th += 0.01 * Math.min(4, V.rpm / 300);
      ctx.fillStyle = '#c2410c33'; ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1.4; gearPath(ctx, cx1, cy, z1, mm, th, sc); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0f5e8c26'; ctx.strokeStyle = '#0f5e8c'; gearPath(ctx, cx2, cy, z2, mm, Math.PI + Math.PI / z2 - th * z1 / z2, sc); ctx.fill(); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
      [[cx1, r1], [cx2, r2]].forEach(([x, r]) => { ctx.beginPath(); ctx.arc(x, cy, r * sc, 0, 7); ctx.stroke(); });
      // line of action
      const px = cx1 + r1 * sc, L = 1.6 * mm * sc / Math.sin(phi) ; ctx.strokeStyle = '#2f7d32'; ctx.beginPath(); ctx.moveTo(px - L * Math.sin(phi), cy - L * Math.cos(phi)); ctx.lineTo(px + L * Math.sin(phi), cy + L * Math.cos(phi)); ctx.stroke(); ctx.setLineDash([]);
      [cx1, cx2].forEach(x => { ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.arc(x, cy, 4, 0, 7); ctx.fill(); });
      tag(ctx, `Pinion (driver, z = ${z1})`, cx1, cy + (r1 + 1.5 * mm) * sc + 12, '#c2410c', 'center');
      tag(ctx, `Gear (driven, z = ${z2})`, cx2, cy + (r2 + 1.5 * mm) * sc + 12 > H - 8 ? H - 10 : cy + (r2 + 1.5 * mm) * sc + 12, '#0f5e8c', 'center');
      tag(ctx, 'pitch point', px + 6, cy - 10, '#2f7d32', 'left', 11);
      ctx.fillStyle = '#1b2430'; ctx.font = '12px IBM Plex Mono, monospace'; ctx.fillText(`m ${mm} · z ${z1}:${z2} · involute 20° · green = line of action`, 10, 16);
    });
  }
});
