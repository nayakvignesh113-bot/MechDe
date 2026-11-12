'use strict';
MD.register('chain', {
  group: 'Foundations', title: 'Design Chain (engine)', icon: '🔁', voice: 'design chain engine connecting rod culmination',
  render(main) {
    pageHead(main, 'Where it all comes together', 'The Design Chain: designing an engine\'s connecting rod',
      'One machine, four subjects, one loop. <b>Kinematics</b> gives piston acceleration. <b>Dynamics</b> combines it with gas pressure into the rod force and turning moment. <b>Strength of materials</b> turns that force into buckling and whipping stresses. <b>Design</b> sizes the I-section and bearings. The new rod mass then feeds back into the inertia force, and the loop repeats until the size stops changing.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
    g.append(L, R); main.append(g);
    const specs = engineSpecs().filter(s => s.id !== 'mrec' && s.id !== 'ncyl').concat([
      { section: 'Masses & material' },
      { id: 'mp', label: 'Piston assembly mass', unit: 'kg', value: 1.2, min: 0.1, max: 8, step: 0.05, aliases: ['piston mass'] },
      { id: 'mat', label: 'Rod material', type: 'select', options: MAT_NAMES.filter(n => !/cast|Al 6061/.test(n)), value: 'AISI 1045 / C45 cold drawn', wide: true, aliases: ['material'] },
      { id: 'nb', label: 'Buckling factor of safety', value: 5, min: 2, max: 8, step: 0.5, aliases: ['safety factor', 'factor of safety'] },
      { id: 'pb', label: 'Allowable bearing pressure (big end)', unit: 'MPa', value: 10, min: 4, max: 20, step: 0.5 },
      { id: 'pp', label: 'Allowable bearing pressure (small end)', unit: 'MPa', value: 15, min: 5, max: 30, step: 0.5 },
    ]);
    L.append(h('div', { class: 'panel-title' }, 'Inputs (change anything; the whole chain reruns)'));
    const chainBox = h('div', { class: 'chain' }), cv = plotCanvas('anim'), c1 = plotCanvas(), c2 = plotCanvas(), out = h('div'), iterBox = h('div');
    R.append(chainBox, h('div', { class: 'card' }, cv), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)), out, iterBox);
    let E = null, V = null, Tsec = 0;
    function design(v, m, mrec) {
      const e = engineModel(Object.assign({}, v, { mrec, ncyl: 1 }));
      const Fc = Math.max(...e.one.map(o => o.Frod)), Ft = Math.max(...e.one.map(o => -o.Frod)); // Frod > 0 is compression
      const sc = m.Sy, a = sc / (Math.PI ** 2 * m.E), Lm = v.l;
      const need = (t) => { // returns min buckling FS for thickness t (mm)
        const A = 11 * t * t, kxx2 = 3.18 * t * t, kyy2 = 0.99 * t * t;
        const Pxx = sc * A / (1 + a * Lm * Lm / kxx2), Pyy = sc * A / (1 + a * (Lm / 2) ** 2 / kyy2);
        return { A, Pxx, Pyy, n: Math.min(Pxx, Pyy) / Fc };
      };
      let t = Fc > 1 ? solveMin(tt => need(tt).n - v.nb, 0.3, 250, 1e-4) : NaN;
      const tTen = Math.sqrt(Ft * v.nb / sc / 11); // size so tension stays below Sy/nb
      if (!isFinite(t) || tTen > t) t = Math.max(isFinite(t) ? t : 0, tTen);
      const r = need(t);
      const rodShank = m.rho * r.A * 1e-6 * (Lm / 1000); // kg
      const mRod = rodShank * 1.6; // + big/small end eyes, bolts (≈60 % of shank, typical)
      const Ixx = 419 / 12 * t ** 4, Z = Ixx / (2.5 * t), wq = m.rho * r.A * 1e-9; // kg/mm
      const sWhip = wq * e.w ** 2 * (e.r * 1000) * Lm * Lm / (9 * Math.sqrt(3) * Z) / 1000; // N/mm² (kg/mm·1/s²·mm·mm²/mm³ = kg/(s²·mm) → /1000 → N/mm²)
      const sAx = Fc / r.A;
      const dpin = Math.sqrt(Fc / (1.5 * v.pp)), dcrank = Math.sqrt(Fc / (1.25 * v.pb));
      return { e, Fc, Ft, t, A: r.A, Pxx: r.Pxx, Pyy: r.Pyy, mRod, sWhip, sAx, dpin, dcrank, govPlane: Math.abs(t - tTen) < 1e-6 ? 'tension from inertia (not buckling)' : r.Pxx < r.Pyy ? 'in-plane (x–x, pinned ends)' : 'out-of-plane (y–y, fixed ends)' };
    }
    function run(v) {
      V = v; const m = matAt(v.mat);
      if (v.l / (v.S / 2) < 2.5) { E = null; chainBox.innerHTML = ''; out.innerHTML = ''; iterBox.innerHTML = ''; out.append(h('div', { class: 'badbox', html: `<b>Connecting rod too short:</b> l/r = ${fmt(v.l / (v.S / 2))}. Rods are normally 3–4.5 × crank radius (here ≥ ${fmt(1.5 * v.S)} mm). Short rods raise obliquity, side thrust and secondary inertia forces; below l/r ≈ 1 the mechanism cannot even rotate.` })); explain('The connecting rod is too short for this stroke.'); return; }
      // iterate: rod mass ↔ reciprocating mass ↔ inertia force ↔ rod size
      const it = []; let mrec = v.mp, d;
      for (let k = 0; k < 12; k++) {
        d = design(v, m, mrec);
        it.push({ k, mrec, t: d.t, Fc: d.Fc, Ft: d.Ft, mRod: d.mRod, sWhip: d.sWhip });
        const nm = v.mp + d.mRod / 3;
        if (Math.abs(nm - mrec) < 1e-4) break; mrec = nm;
      }
      E = d.e; const mR = m;
      const sComb = d.sAx + d.sWhip, nYield = mR.Sy / sComb;
      // chain view
      chainBox.innerHTML = '';
      const amax = Math.max(...E.one.map(o => Math.abs(o.a))), gmax = Math.max(...E.one.map(o => Math.abs(o.Fg))), imax = Math.max(...E.one.map(o => Math.abs(o.Fi)));
      const nodes = [
        ['Kinematics', `Piston a<sub>max</sub> = ${fmt(amax)} m/s² (${fmt(amax / 9.81)} g)<br>rod obliquity φ<sub>max</sub> = ${fmt(Math.asin(E.r / E.l) / deg)}°`],
        ['Dynamics', `Gas force ${fmt(gmax / 1000)} kN · inertia ${fmt(imax / 1000)} kN<br>rod compression ${fmt(d.Fc / 1000)} kN, tension ${fmt(d.Ft / 1000)} kN`],
        ['Strength of Materials', `Rankine buckling P<sub>xx</sub> ${fmt(d.Pxx / 1000)} kN, P<sub>yy</sub> ${fmt(d.Pyy / 1000)} kN<br>whipping σ = ${fmt(d.sWhip)} MPa, axial ${fmt(d.sAx)} MPa`],
        ['Design', `I-section t = <b>${fmt(d.t)} mm</b> (4t × 5t = ${fmt(4 * d.t)} × ${fmt(5 * d.t)})<br>rod ≈ ${fmt(d.mRod)} kg · pins Ø${fmt(d.dpin)} / Ø${fmt(d.dcrank)} mm`],
      ];
      nodes.forEach((n, i) => { chainBox.append(h('div', { class: 'node' }, h('div', { class: 't' }, (i + 1) + ' · ' + n[0]), h('div', { class: 'live', html: n[1] }))); if (i < 3) chainBox.append(h('div', { class: 'arrow' }, '➜')); });
      chainBox.append(h('div', { class: 'small', style: { flexBasis: '100%', marginTop: '6px' } }, `↺ Feedback: rod mass → reciprocating mass ${fmt(it[0].mrec)} → ${fmt(it[it.length - 1].mrec)} kg → inertia force → rod size. Converged in ${it.length} passes.`));
      plot(c1, { title: 'Forces along the rod axis', xlabel: 'Crank angle (°)', ylabel: 'kN', legend: 'tr', series: [{ label: 'Gas', x: E.th, y: E.one.map(o => o.Fg / 1000) }, { label: 'Inertia', x: E.th, y: E.one.map(o => o.Fi / 1000) }, { label: 'Rod force (+ compression)', x: E.th, y: E.one.map(o => o.Frod / 1000), width: 2.5 }] });
      plot(c2, { title: 'Kinematics: piston velocity & acceleration', xlabel: 'Crank angle (°)', ylabel: 'v (m/s) · a/100 (m/s²)', legend: 'tr', series: [{ label: 'v', x: E.th.slice(0, 361), y: E.one.slice(0, 361).map(o => o.vel) }, { label: 'a / 100', x: E.th.slice(0, 361), y: E.one.slice(0, 361).map(o => o.a / 100) }] });
      out.innerHTML = '';
      const card = h('div', { class: 'card', style: { marginTop: '12px' } }); out.append(card);
      card.append(h('div', { class: 'metrics' },
        metric('Section thickness t', fmt(d.t), 'mm'), metric('Section area 11t²', fmt(d.A), 'mm²'),
        metric('Buckling FS (governing)', fmt(Math.min(d.Pxx, d.Pyy) / d.Fc), '', fsStatus(Math.min(d.Pxx, d.Pyy) / d.Fc, v.nb - 0.01)),
        metric('Combined σ (axial + whip)', fmt(sComb), 'MPa'), metric('Yield FS on combined', fmt(nYield), '', fsStatus(nYield, 2)),
        metric('Indicated power', fmt(E.P / 1000), 'kW'), metric('Small-end pin Ø (l=1.5d)', fmt(d.dpin), 'mm'), metric('Crank-pin Ø (l=1.25d)', fmt(d.dcrank), 'mm')));
      // dominance vs rpm
      const rpms = linspace(500, 6000, 23), tt = rpms.map(n => design(Object.assign({}, v, { rpm: n }), m, it[it.length - 1].mrec));
      const pc = plotCanvas(); card.append(h('div', { class: 'panel-title', style: { marginTop: '10px' } }, 'Which load dominates as speed rises?'), pc);
      plot(pc, { xlabel: 'Engine speed (rpm)', ylabel: 'MPa', legend: 'tl', vlines: [{ x: v.rpm }], series: [{ label: 'Axial (buckling-driven) stress Fc/A', x: rpms, y: tt.map(q => q.Fc / d.A) }, { label: 'Whipping stress (∝ ω²) at this section', x: rpms, y: tt.map(q => { const Z = 419 / 12 * d.t ** 4 / (2.5 * d.t); return m.rho * d.A * 1e-9 * q.e.w ** 2 * q.e.r * 1000 * v.l ** 2 / (9 * Math.sqrt(3) * Z) / 1000; }) }] });
      const cross = rpms.find((n, i) => { const Z = 419 / 12 * d.t ** 4 / (2.5 * d.t); return m.rho * d.A * 1e-9 * tt[i].e.w ** 2 * tt[i].e.r * 1000 * v.l ** 2 / (9 * Math.sqrt(3) * Z) / 1000 > tt[i].Fc / d.A; });
      verdict(card, nYield >= 2 ? true : null, `Rod: I-section ${fmt(4 * d.t)} × ${fmt(5 * d.t)} mm, web/flange t = ${fmt(d.t)} mm; governed by ${d.govPlane.startsWith('tension') ? '' : 'buckling '}${d.govPlane}`,
        `Gas pressure sets the peak compressive force, so buckling sizes the section. Whipping (inertia bending of the swinging rod) grows with ω² and ${cross ? `would overtake axial stress near <b>${Math.round(cross)} rpm</b>: high-speed rods are designed against inertia, not gas load` : 'stays secondary across the speed range'}. The section is I-shaped because I<sub>xx</sub> ≈ 3.2 I<sub>yy</sub> matches the 4:1 effective-length ratio (pinned in-plane, near-fixed out-of-plane), so both planes are about equally strong with the least metal.`);
      card.append(h('div', { class: 'eq' }, `Rankine–Gordon: P_cr = σc·A / (1 + a (Le/k)²),  a = σc/(π²E) = 1/${fmt(Math.PI ** 2 * m.E / m.Sy, 4)}
x–x: Le = l = ${v.l} mm, k² = 3.18t²     y–y: Le = l/2, k² = 0.99t²
Whipping: σ_b = m'·ω²·r·l² / (9√3·Z_xx),  m' = ρA per unit length`));
      iterBox.innerHTML = '';
      const tb = h('table', { class: 't' }, h('tr', null, ...['Pass', 'Recip. mass (kg)', 'Rod comp. (kN)', 'Rod tension (kN)', 't (mm)', 'Rod mass (kg)', 'Whip σ (MPa)'].map(x => h('th', null, x))));
      it.forEach((r, i) => tb.append(h('tr', { class: i === it.length - 1 ? 'hl' : '' }, ...[r.k + 1, fmt(r.mrec, 4), fmt(r.Fc / 1000, 4), fmt(r.Ft / 1000, 4), fmt(r.t, 4), fmt(r.mRod, 4), fmt(r.sWhip, 3)].map(x => h('td', null, String(x))))));
      iterBox.append(h('div', { class: 'card', style: { marginTop: '12px' } }, h('div', { class: 'panel-title' }, 'The feedback loop, pass by pass'), h('div', { class: 'tablewrap' }, tb),
        h('p', { class: 'small' }, 'Pass 1 assumes only the piston reciprocates. Each pass adds ⅓ of the new rod mass to the reciprocating mass. Inertia force opposes gas force near firing TDC, so a heavier rod slightly relieves peak compression, but raises tension at exhaust TDC and whipping stress. Designers pursue light rods because inertia penalties compound with speed.')));
      envWarnings(m).forEach(w => iterBox.append(h('div', { class: 'warnbox' }, '⚠ ' + w)));
      explain(`At ${v.rpm} rpm the piston accelerates up to ${fmt(amax / 9.81)} g. Peak rod compression is ${fmt(d.Fc / 1000)} kilonewtons. For a buckling safety factor of ${v.nb}, the I-section thickness is ${fmt(d.t)} millimetres. The design converged in ${it.length} passes of the feedback loop.`);
    }
    const f = buildForm(L, specs, run, 'chain'); run(f.vals);
    // animation: slider-crank with force arrow
    let th = 0;
    anim(() => {
      if (!E) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      th = (th + 2) % 720; const i = Math.round(th / 720 * 720), o = E.one[Math.min(720, i)];
      const r = E.r, l = E.l, sc = Math.min((w - 120) / (2 * r + l + 0.05), (H - 60) / (2.4 * r));
      const cx = 70 + r * sc, cy = H / 2, t = th * deg;
      // crank rotates; piston moves horizontally to the right (TDC at right)
      const A = [cx + r * sc * Math.cos(t), cy - r * sc * Math.sin(t)];
      const px = cx + (r * Math.cos(t) + Math.sqrt(l * l - (r * Math.sin(t)) ** 2)) * sc;
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, 7); ctx.stroke();
      // cylinder
      const bore = Math.min(60, H * 0.3); ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
      const xt = cx + (r + l) * sc;
      ctx.beginPath(); ctx.moveTo(cx + (l - r) * sc - 10, cy - bore / 2 - 3); ctx.lineTo(xt + 50, cy - bore / 2 - 3); ctx.lineTo(xt + 50, cy + bore / 2 + 3); ctx.lineTo(cx + (l - r) * sc - 10, cy + bore / 2 + 3); ctx.stroke();
      // gas (colored by pressure)
      const pf = clamp(o.p / V.pmax, 0, 1); ctx.fillStyle = `rgba(194,65,12,${0.08 + 0.6 * pf})`; ctx.fillRect(px + 22, cy - bore / 2, xt + 50 - px - 22, bore);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(px - 22, cy - bore / 2, 44, bore);
      ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(px, cy); ctx.stroke();
      ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...A); ctx.stroke();
      [[cx, cy], A, [px, cy]].forEach(p => { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); ctx.stroke(); });
      // rod force arrow (compression red, tension blue)
      const Fm = Math.max(...E.one.map(q => Math.abs(q.Frod))), len = 70 * o.Frod / Fm;
      const ux = (px - A[0]) / Math.hypot(px - A[0], cy - A[1]), uy = (cy - A[1]) / Math.hypot(px - A[0], cy - A[1]);
      const mx = (A[0] + px) / 2, my = (A[1] + cy) / 2 - 18;
      ctx.strokeStyle = o.Frod > 0 ? '#b42318' : '#0f5e8c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - ux * len / 2, my - uy * len / 2); ctx.lineTo(mx + ux * len / 2, my + uy * len / 2); ctx.stroke();
      tag(ctx, 'Crank', (cx + A[0]) / 2, (cy + A[1]) / 2 - 14, '#c2410c', 'center');
      tag(ctx, 'Connecting rod', (A[0] + px) / 2, (A[1] + cy) / 2 + 18, '#0f5e8c', 'center');
      tag(ctx, 'Piston', px, cy + bore / 2 + 14, '#475569', 'center');
      tag(ctx, 'Cylinder (gas)', xt + 20, cy - bore / 2 - 14, '#c2410c', 'center');
      tag(ctx, 'Crankshaft centre', cx, cy + r * sc + 16, '#1b2430', 'center', 11, false);
      tag(ctx, 'rod force (red = compression, blue = tension)', mx, my - 14, '#64748b', 'center', 11, false);
      const stroke = ['power', 'exhaust', 'intake', 'compression'][Math.floor(th / 180) % 4];
      ctx.fillStyle = '#1b2430'; ctx.font = '12px IBM Plex Mono, monospace';
      ctx.fillText(`θ = ${Math.round(th)}° (${stroke})   p = ${fmt(o.p)} MPa   rod ${o.Frod > 0 ? 'compression' : 'tension'} ${fmt(Math.abs(o.Frod) / 1000)} kN   a = ${fmt(o.a)} m/s²`, 10, 18);
    });
  }
});
