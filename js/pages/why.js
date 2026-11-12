'use strict';
MD.register('why', {
  group: 'Design thinking', title: 'Why is it built this way?', icon: '🤔', voice: 'why shape built this way i beam hollow shaft',
  kid: { what: 'Everyday shapes explained: <b>why</b> they look like that and <b>why not</b> some other way. Move the sliders to compare.', steps: ['Read a card.', 'Play with its slider.', 'Open the linked page to design it properly.'], try: 'In "Hollow or solid?", slide to 0.8: the tube is much stronger for the same weight.' },
  eq: [
    { t: 'Bending stiffness & strength depend on shape', f: 'stiffness ∝ E·I,   strength ∝ Z = I / c,   I = ∫ y² dA', m: 'Material far from the centre counts with the square of its distance. That single fact explains I-beams, tubes, bones and ribs.', fx: [['move material outwards', 'I rises with distance²'], ['double depth of a rectangle', 'I × 8, Z × 4']] },
    { t: 'Hollow vs solid (same mass)', f: 'Z_hollow / Z_solid = (1 − k⁴) / (1 − k²)^{3/2},   k = d_in / d_out' },
    { t: 'Stress concentration at a shoulder', f: 'Kt ≈ 0.938·(r/d)^−0.258   (stepped shaft, D/d = 1.5, bending; curve fit)', fx: [['bigger fillet radius r', 'Kt falls towards 1']] },
  ],
  render(main) {
    pageHead(main, 'Design thinking', 'Why is it built this way and not some other way?',
      'Shapes are frozen answers to forces. Below, each everyday object is explained with the physics that chose its shape, and with the alternative that loses.');
    const grid = h('div');
    main.append(grid);
    const card = (title, why, whynot, link, widget) => { const c = h('div', { class: 'card', style: { marginTop: '14px' } }, h('h2', { style: { marginTop: 0 } }, title), h('p', { html: '<b>Why:</b> ' + why }), h('p', { class: 'small', html: '<b>Why not another way?</b> ' + whynot })); grid.append(c); if (widget) widget(c); if (link) c.append(h('a', { class: 'btn ghost sm', href: '#' + link[0], style: { display: 'inline-block', textDecoration: 'none', marginTop: '6px' } }, link[1] + ' →')); };

    card('I-beams: why the "I"?', 'In bending, the top and bottom of a beam do almost all the work (one stretched, one squeezed); the middle hardly works. An I puts most of the steel in the flanges, far from the centre, where it counts with distance squared.', 'A solid rectangle of the same weight is several times floppier. A very thin, deep I would be even better on paper, but its thin web buckles and its flanges twist sideways, so real I-beams are a compromise between bending efficiency and local stability.', ['structure', 'Build a beam'], c => {
      const cv = plotCanvas('anim'); cv.style.height = '200px'; const info = h('div', { class: 'metrics' }); c.append(cv, info);
      const sp = [{ id: 'A', label: 'Cross-section area (same for all)', unit: 'mm²', value: 3000, min: 1000, max: 10000, step: 100 }, { id: 'D', label: 'Depth of I-beam & tube', unit: 'mm', value: 120, min: 60, max: 400, step: 5 }];
      const box = h('div'); c.append(box);
      buildForm(box, sp, v => {
        const sq = Math.sqrt(v.A), Isq = sq ** 4 / 12; // solid square
        const tf = Math.max(4, v.A * 0.38 / (0.5 * v.D)), bf = 0.5 * v.D, tw = Math.max(3, (v.A - 2 * bf * tf) / (v.D - 2 * tf)); const Ii = (bf * v.D ** 3 - (bf - tw) * (v.D - 2 * tf) ** 3) / 12;
        const t = solveMin(tt => v.D ** 2 - (v.D - 2 * tt) ** 2 - v.A, 0.1, v.D / 2, 1e-4), Ib = (v.D ** 4 - (v.D - 2 * t) ** 4) / 12;
        info.innerHTML = ''; info.append(metric('Solid square I', fmt(Isq / 1e6), '×10⁶ mm⁴'), (isFinite(Ib) ? metric('Square tube I', fmt(Ib / 1e6), '×10⁶ mm⁴', 'good') : metric('Square tube', 'depth too small for this area', '')), metric('I-beam I', fmt(Ii / 1e6), '×10⁶ mm⁴', 'good'), metric('I-beam is stiffer by', fmt(Ii / Isq) + '×', '', 'good'));
        const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H); const s = Math.min((H - 30) / Math.max(v.D, sq), w / 3.6 / Math.max(v.D * 0.6, sq)), cy = H / 2;
        const draw = (cx, f, lab) => { ctx.fillStyle = '#0f5e8c'; f(cx); tag(ctx, lab, cx, H - 8, '#1b2430', 'center', 11); };
        draw(w / 6, cx => ctx.fillRect(cx - sq * s / 2, cy - sq * s / 2, sq * s, sq * s), 'solid square ×1');
        if (isFinite(t)) draw(w / 2, cx => { ctx.fillRect(cx - v.D * s / 2, cy - v.D * s / 2, v.D * s, v.D * s); ctx.clearRect(cx - (v.D / 2 - t) * s, cy - (v.D / 2 - t) * s, (v.D - 2 * t) * s, (v.D - 2 * t) * s); }, `tube ×${fmt(Ib / Isq)}`);
        draw(5 * w / 6, cx => { ctx.fillRect(cx - bf * s / 2, cy - v.D * s / 2, bf * s, tf * s); ctx.fillRect(cx - bf * s / 2, cy + v.D * s / 2 - tf * s, bf * s, tf * s); ctx.fillRect(cx - tw * s / 2, cy - v.D * s / 2, tw * s, v.D * s); }, `I-beam ×${fmt(Ii / Isq)}`);
      }, null, true);
    });
    card('Hollow or solid? Bicycle frames, drive shafts, bones', 'In bending and twisting the centre of a round bar carries almost no stress. Removing it saves weight; moving that metal outward (bigger diameter, thinner wall) makes the part both stiffer and stronger for the same mass.', 'Make the wall too thin and it dents, kinks or buckles locally (a drinks can). Hollow parts also cost more to make. Solid bars win when space is tight or loads are crushing rather than bending.', ['shaft', 'Design a shaft'], c => {
      const cv = plotCanvas(); c.append(cv); const ks = linspace(0, 0.95, 60);
      plot(cv, { title: 'Same mass: hollow vs solid round', xlabel: 'Bore ratio k = d_in / d_out', ylabel: 'Ratio to solid bar', legend: 'tl', series: [{ label: 'Strength (Z)', x: ks, y: ks.map(k => (1 - k ** 4) / Math.pow(1 - k * k, 1.5)) }, { label: 'Stiffness (I)', x: ks, y: ks.map(k => (1 - k ** 4) / Math.pow(1 - k * k, 2)) }] });
    });
    card('Rounded corners: fillets, windows, keyway ends', 'Force flows through a part like water; a sharp corner makes it swirl and pile up. The local stress at a sharp internal corner can be 2–3× the average, and fatigue cracks start right there.', 'Sharp corners are cheaper to machine. They are fine in parts that never see cyclic loads, but the Comet airliner and countless shafts failed at sharp corners.', ['cases', 'See the Comet case'], c => {
      const cv = plotCanvas(); c.append(cv); const rd = linspace(0.01, 0.3, 60);
      plot(cv, { title: 'Stress concentration at a shaft shoulder (D/d = 1.5, bending)', xlabel: 'Fillet radius ÷ shaft diameter (r/d)', ylabel: 'Kt', ymin: 1, series: [{ x: rd, y: rd.map(x => Math.max(1, 0.93836 * Math.pow(x, -0.25759))), fill: true }] });
    });
    card('Domed ends on gas cylinders and boilers', 'A sphere carries internal pressure purely by stretching its skin evenly in all directions, which needs only half the wall of a cylinder and a tiny fraction of a flat lid.', 'A flat lid must resist pressure by bending, so it needs to be many times thicker and still deflects. Domes are harder to press, so 2:1 elliptical heads are a common compromise.', ['vessels', 'Compare end shapes']);
    card('Crane hooks: fat on the inside', 'Curved beams are much more stressed on their inner edge than the straight-beam formula suggests. The trapezoidal section puts material exactly there.', 'A round or rectangular section of the same weight would be overstressed inside and underused outside.', ['vessels', 'Try the hook calculator']);
    card('Triangles in bridges, cranes and bicycle frames', 'A triangle cannot change shape without changing the length of a side, so pin-jointed triangles carry load by pure tension/compression: very light and efficient.', 'A square frame with pin joints folds like a parallelogram (a mechanism). It needs rigid, heavy joints or a diagonal brace, which turns it into two triangles.', ['structure', 'Try it: delete a diagonal'], c => c.append(h('p', { class: 'small' }, 'In the Structure builder, load the Pratt truss, choose ✕ Delete and remove one diagonal: the solver reports a mechanism.')));
    card('Coil springs', 'Coiling turns a long wire into a compact twisting bar. Torsion stores a lot of elastic energy per kilogram, and the coil packs metres of wire into a few centimetres.', 'A straight bar in tension would need to be impossibly long to give the same deflection; a leaf (bending) spring is heavier per unit energy but also locates an axle (old trucks).', ['spring', 'Design a spring']);
    card('Involute gear teeth', 'The involute curve keeps the line of push fixed and the speed ratio exactly constant even if the centre distance is slightly off, and the teeth can be cut with simple straight-sided tools.', 'Other profiles (cycloidal, used in clocks) roll beautifully but are sensitive to centre distance and hard to manufacture.', ['gear', 'See involutes mesh']);
    card('Bicycle wheels: spokes pull, not push', 'Thin spokes are pre-tensioned, so the hub "hangs" from the rim above it and the bottom spokes simply lose some tension. Thin wires are superb in tension and useless in compression.', 'Thick compression spokes (wooden cart wheels) are much heavier for the same strength.', null);
    card('Round manhole covers', 'A circle has the same width in every direction, so the cover cannot fall through its own hole, needs no orientation to fit, and the round frame resists the soil pressure evenly.', 'A square cover can drop diagonally through its opening and needs aligning.', null);
    card('Ribs on plastic parts and sheet metal', 'Stiffness grows with thickness cubed. A thin wall with deep ribs is far stiffer than a thick wall of the same mass, and moulded plastic cools evenly in thin sections (no sink marks or warping).', 'A thick solid wall wastes material, cools slowly and warps.', null, c => {
      const sp = [{ id: 'r', label: 'Rib height ÷ wall thickness', value: 3, min: 0, max: 8, step: 0.5 }]; const out = h('div', { class: 'metrics' }); const b = h('div'); c.append(b, out);
      buildForm(b, sp, v => { const t = 2, W = 40, rib = 2, hr = v.r * t; const A = W * t + rib * hr; const yb = (W * t * t / 2 + rib * hr * (t + hr / 2)) / A; const I = W * t ** 3 / 12 + W * t * (yb - t / 2) ** 2 + rib * hr ** 3 / 12 + rib * hr * (t + hr / 2 - yb) ** 2;
        const tEq = A / W, Iflat = W * tEq ** 3 / 12; out.innerHTML = ''; out.append(metric('Stiffness vs flat plate of same mass', fmt(I / Iflat) + '×', '', 'good'), metric('Extra material for the rib', fmt(100 * rib * hr / (W * t)) + ' %', '')); }, null, true);
    });
    card('Gears vs belts vs chains: choosing the drive', 'Gears give exact ratios in a small space and high power, but need precise centres and lubrication. Belts are quiet, cheap, tolerate misalignment and slip under overload (a safety fuse), but stretch and slip. Chains give exact ratios over long distances at low cost, but are noisy and need lubrication.', 'There is no single best drive. That is why a motorcycle uses all three: gears in the gearbox, a chain to the wheel, and often a belt in a scooter CVT.', ['drivetrain', 'Design a bike drivetrain']);
    explain('Shapes are frozen answers to forces: I-beams and tubes move material away from the centre, fillets avoid stress peaks, domes carry pressure by membrane tension, hooks put material where curved-beam stress peaks, and triangles cannot change shape.');
  }
});
