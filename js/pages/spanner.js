'use strict';
MD.register('spanner', {
  group: 'Design thinking', title: 'Why is a spanner shaped so?', icon: '🔧', voice: 'spanner wrench shape',
  render(main) {
    pageHead(main, 'Design thinking · reverse-engineering an everyday object', 'Why is a spanner shaped the way it is?',
      'Every feature of an open-ended spanner answers a design requirement: its <b>length</b> comes from the bolt\'s tightening torque and what a hand can push, its <b>15° head offset</b> from hexagon geometry and cramped spaces, its <b>tapered handle</b> from beam bending, and its <b>jaw</b> from curved-beam stresses. Here each one is derived from first principles.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const AF = { M6: 10, M8: 13, M10: 17, M12: 19, M16: 24, M20: 30, M24: 36, M30: 46 };
    const TYP = { M6: 140, M8: 170, M10: 215, M12: 240, M16: 300, M20: 370, M24: 440, M30: 560 }; // indicative commercial combination-spanner lengths (mm)
    const specs = [
      { id: 'size', label: 'Bolt size', type: 'select', options: Object.keys(BOLTS), value: 'M12', aliases: ['bolt', 'size'] },
      { id: 'grade', label: 'Property class', type: 'select', options: Object.keys(GRADES), value: '8.8', aliases: ['grade'] },
      { id: 'pre', label: 'Target preload', unit: '% proof', value: 75, min: 30, max: 90, step: 1 },
      { id: 'K', label: 'Torque coefficient K', value: 0.2, min: 0.1, max: 0.3, step: 0.01 },
      { id: 'F', label: 'Comfortable hand force', unit: 'N', value: 250, min: 80, max: 500, step: 10, aliases: ['hand force', 'force'] },
      { id: 'swing', label: 'Available swing in tight space', unit: '°', value: 30, min: 10, max: 90, step: 1, aliases: ['swing'] },
      { id: 'mat', label: 'Spanner steel', type: 'select', options: ['AISI 4140 Q&T 425 °C', 'AISI 4340 / EN24 Q&T 650 °C', 'AISI 1045 / C45 cold drawn'], value: 'AISI 4140 Q&T 425 °C', wide: true },
      { id: 'b', label: 'Handle thickness (constant)', unit: 'mm', value: 6, min: 3, max: 15, step: 0.5 },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(), c2 = plotCanvas(); cv.style.height = '300px';
    R.append(h('div', { class: 'card' }, cv), out, h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
    let S = null;
    function torque(size, v) { const [d, At] = BOLTS[size]; return v.K * v.pre / 100 * GRADES[v.grade].Sp * At * d / 1000; }
    function run(v) {
      const T = torque(v.size, v), Lreq = T / v.F * 1000, m = matAt(v.mat), sall = m.Sy / 1.5;
      // uniform-strength handle depth profile h(x) = sqrt(6 F x / (b σ))
      const xs = linspace(0, Lreq, 60), hx = xs.map(x => Math.sqrt(6 * v.F * Math.max(x, 1) / (v.b * sall)));
      const hNeck = hx[hx.length - 1], massTaper = hx.reduce((s, q) => s + q, 0) / hx.length, massSave = 1 - massTaper / hNeck;
      const steps = Math.ceil(60 / v.swing), flip = v.swing >= 30 ? 'Every swing gives a new grip (flip once)' : `Swing < 30°: even flipping can't reach a new flat`;
      S = { v, Lreq, hx, hNeck, AF: AF[v.size] };
      out.innerHTML = '';
      const c = h('div', { class: 'card', style: { marginTop: '12px' } }); out.append(c);
      c.append(h('div', { class: 'panel-title' }, '1 · Length comes from torque ÷ hand force'));
      c.append(h('div', { class: 'metrics' }, metric('Tightening torque T = K·Fi·d', fmt(T), 'N·m'), metric('Lever needed T/F', fmt(Lreq), 'mm'), metric('Typical commercial spanner', TYP[v.size], 'mm'), metric('Jaw opening (A/F)', AF[v.size], 'mm')));
      const sizes = Object.keys(BOLTS), Treq = sizes.map(s => torque(s, v)), Thand = sizes.map(s => v.F * TYP[s] / 1000);
      plot(c1, { title: 'Torque needed (∝ d³) vs torque a hand delivers on a standard spanner (∝ d)', xlabel: 'Bolt diameter (mm)', ylabel: 'N·m', logy: true, legend: 'tl', series: [{ label: 'Required for preload', x: sizes.map(s => BOLTS[s][0]), y: Treq }, { label: `Hand (${v.F} N) × typical length`, x: sizes.map(s => BOLTS[s][0]), y: Thand }] });
      const cross = sizes.find((s, i) => Thand[i] < Treq[i]);
      c.append(h('div', { class: 'note', html: `Preload Fi ∝ d² and T = K·Fi·d ∝ <b>d³</b>, but spanner length grows only ∝ d (it must fit in the hand and toolbox). So small spanners let a hand <b>over-torque</b> small bolts (snapped M6 screws are common), while from about <b>${cross || 'M30+'}</b> upward a hand on a standard spanner can no longer reach full preload, and you need a torque wrench, a multiplier, or a "cheater" bar. Spanner length is a deliberate compromise, not a scaled copy.` }));
      c.append(h('div', { class: 'panel-title', style: { marginTop: '12px' } }, '2 · The 15° head offset comes from hexagon geometry'));
      c.append(h('div', { class: 'note', html: `A hexagon repeats every <b>60°</b>. If you can only swing ${v.swing}°, a straight spanner needs a 60° swing to re-engage. With the jaw set at 15° to the handle, flipping the spanner over shifts the handle by 2 × 15° = 30°, so a new grip is available every <b>30°</b>. ${flip}. (Swing needed per new grip: ${v.swing >= 30 ? '30°' : '≥ 30°'}; turns of ${v.swing}° per 60° of nut rotation ≈ ${steps}.)` }));
      c.append(h('div', { class: 'panel-title', style: { marginTop: '12px' } }, '3 · The handle tapers because it is a cantilever'));
      c.append(h('div', { class: 'metrics' }, metric('Allowable σ (Sy/1.5)', fmt(sall), 'MPa'), metric('Depth needed at neck', fmt(hNeck), 'mm'), metric('Depth needed at grip end', '→ 0', 'mm'), metric('Steel saved vs uniform depth', fmt(massSave * 100), '%', 'good')));
      plot(c2, { title: 'Uniform-strength handle profile h(x) = √(6Fx / bσ)', xlabel: 'Distance from hand (mm)', ylabel: 'depth h (mm)', ymin: 0, series: [{ x: xs, y: hx, fill: true }, { x: xs, y: hx.map(q => -q), color: '#0f5e8c' }] });
      c.append(h('div', { class: 'note', html: 'The bending moment from your hand rises linearly from zero at your palm to F·L at the head, so the needed section modulus rises too: a parabolic taper wastes no steel. Real spanners also use an I- or oval section (ribbed) to get Z with less mass, and are drop-forged so grain flow follows the outline.' }));
      c.append(h('div', { class: 'panel-title', style: { marginTop: '12px' } }, '4 · The jaw is a curved beam'));
      c.append(h('div', { class: 'note', html: `Torque is reacted by two contact forces on opposite flats, which try to <b>spread</b> the jaw like a C-clamp. Curved-beam (Winkler–Bach) stress peaks on the inner fibre at the throat, which is why the throat is thickest and why worn, spread jaws round off nuts. Flank-drive profiles move contact away from the hex corners to reduce corner crushing. Jaw opening A/F = ${AF[v.size]} mm for ${v.size} follows ISO 272.` }));
      explain(`A ${v.size} grade ${v.grade} bolt needs about ${fmt(T)} newton metres. With ${v.F} newtons of hand force that is a ${fmt(Lreq)} millimetre lever. The 15 degree head offset lets you re-engage every 30 degrees by flipping. The handle tapers because bending moment rises linearly toward the head.`);
    }
    const f = buildForm(L, specs, run, 'spanner'); run(f.vals);
    let t = 0;
    anim(() => {
      if (!S) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      t += 0.012; const k = Math.floor(t / 4), cyc = t % 4, flipPh = k % 2, sw = 30 * deg;
      // phase 0–2: swing 30° turning the nut; phase 2–4: lift off, flip, swing back 30° to re-engage
      const swing = cyc < 2 ? (cyc / 2) * sw : sw * (1 - (cyc - 2) / 2);
      const nutRot = k * sw + (cyc < 2 ? swing : sw);
      const offs = (flipPh ? -15 : 15) * deg, af = S.AF;
      const reach = S.Lreq + af * 1.6, sc = Math.min((w * 0.86) / reach, (H * 0.4) / af);
      const cx = w * 0.04 + af * 1.2 * sc, cy = H * 0.55;
      const handleAng = 0.05 + swing - sw / 2; // swing ±15° about a near-horizontal mean pose
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-(handleAng));
      // handle, depth exaggerated ×1.6 for visibility
      const Lp = S.Lreq * sc, x0h = af * 0.75 * sc;
      ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.moveTo(x0h, 0);
      S.hx.forEach((q, i) => { const x = x0h + Lp * (1 - i / (S.hx.length - 1)); ctx.lineTo(x, -Math.max(q * sc * 0.8, 3)); });
      [...S.hx].reverse().forEach((q, i) => { const x = x0h + Lp * (i / (S.hx.length - 1)); ctx.lineTo(x, Math.max(q * sc * 0.8, 3)); });
      ctx.closePath(); ctx.fill();
      // head with open jaw, rotated by the 15° offset relative to handle axis
      ctx.rotate(Math.PI + offs);
      ctx.fillStyle = '#9a3412'; ctx.beginPath(); ctx.arc(0, 0, af * 1.05 * sc, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.rect(-af * 0.02 * sc, -af / 2 * sc, af * 2 * sc, af * sc); ctx.arc(0, 0, af / 2 * sc, Math.PI / 2, 3 * Math.PI / 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#1b2430'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(af * 1.6 * sc, 0); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      // nut (rotates with the spanner while engaged)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-(nutRot));
      ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + Math.PI / 6, r = af / 2 / Math.cos(Math.PI / 6) * sc * 0.98; j ? ctx.lineTo(r * Math.cos(a), r * Math.sin(a)) : ctx.moveTo(r * Math.cos(a), r * Math.sin(a)); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0, 0, af * 0.22 * sc, 0, 7); ctx.fill(); ctx.restore();
      tag(ctx, 'Nut (hexagon)', cx, cy + af * 1.05 * sc + 14, '#475569', 'center', 11);
      tag(ctx, 'Handle (tapered cantilever)', cx + Math.cos(handleAng) * Lp * 0.6, cy - Math.sin(handleAng) * Lp * 0.6 - 22, '#c2410c', 'center', 11);
      tag(ctx, 'Jaw at 15° to handle', cx - af * 1.2 * sc, cy - af * 1.2 * sc, '#9a3412', 'left', 11);
      // obstruction showing the 30° swing window
      ctx.strokeStyle = '#64748b'; ctx.setLineDash([5, 4]);
      [handleAng - swing, handleAng - swing + sw].forEach(a => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * Lp * 1.05, cy - Math.sin(a) * Lp * 1.05); ctx.stroke(); }); ctx.setLineDash([]);
      ctx.fillStyle = '#1b2430'; ctx.font = '12px IBM Plex Mono, monospace';
      ctx.fillText(`${flipPh ? 'flipped (jaw −15°)' : 'face up (jaw +15°)'} · ${cyc < 2 ? 'turning nut' : 'flip & re-engage'} · nut at ${fmt((nutRot / deg) % 360, 3)}°`, 10, 18);
      ctx.fillStyle = '#4a5566'; ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillText(`dashed lines: the 30° swing available · handle drawn to scale (${fmt(S.Lreq)} mm), depth ×0.8`, 10, H - 10);
    });
  }
});
