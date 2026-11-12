'use strict';
const SEW = {
  calc(v) {
    const r = v.S / 2, l = v.l, w = v.spm * 2 * Math.PI / 60;
    const s = th => r * (1 - Math.cos(th)) + l - Math.sqrt(l * l - (r * Math.sin(th)) ** 2); // needle depth below its top position (mm)
    const amax = r * w * w * (1 + r / l) / 1000, vmax = r * w / 1000 * 1.05, F = v.mb / 1000 * amax;
    // loop pick-up: needle 2.4 mm above bottom on the way up
    const thPick = solveMin(t => (v.S - s(t)) - 2.4, Math.PI, 2 * Math.PI, 1e-5);
    const feed = v.L * v.spm / 1000; // m/min
    return { s, amax, vmax, F, thPick, feed, hookRpm: 2 * v.spm, density: 10 / v.L, w };
  },
};
MD.register('sewing', {
  group: 'Products', title: 'Sewing machine design', icon: '🧵', voice: 'sewing machine needle hook bobbin feed dog take up lockstitch',
  kid: { what: 'How a sewing machine ties a <b>lockstitch</b>: four mechanisms (needle, hook, take-up lever, feed dog) driven from one shaft and timed perfectly.', steps: ['Watch the animation: needle down, hook grabs the thread loop, lever pulls it tight, feed dog moves the cloth.', 'Change speed (stitches per minute) and stitch length.', 'Read how hard the needle bar is shaken at high speed.'], try: 'Go from 800 (home machine) to 5000 stitches/min (factory machine): the needle\'s acceleration rises about 39×.' },
  eq: [
    { t: 'Needle bar (slider-crank)', f: 'a_max = r·ω²·(1 + r/l),   F = m·a', fx: [['double speed', 'acceleration & shaking force × 4'], ['longer connecting link l', 'smoother motion, slightly lower peak']] },
    { t: 'Feed', f: 'cloth speed = stitch length × stitches per minute,   stitches per cm = 10 / L(mm)' },
    { t: 'Hook timing', f: 'hook speed = 2 × needle speed (rotary hook)', m: 'One hook turn carries the needle-thread loop round the bobbin; the second is the idle turn while the take-up lever sets the stitch and the cloth is fed.' },
  ],
  render(main) {
    pageHead(main, 'Products · mechanisms in harmony', 'How is a sewing machine designed?',
      'A lockstitch machine is a lesson in <b>kinematic timing</b>. One motor turns one main shaft. From it, a slider-crank drives the <b>needle</b>, a linkage or cam drives the <b>take-up lever</b>, gears or a belt spin the <b>rotary hook</b> at twice shaft speed, and two eccentrics move the <b>feed dog</b> up-back-down-forward (Wilson\'s "four-motion feed", patented in 1854). If any of them is off by a few degrees, the hook misses the loop and the machine skips stitches.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'spm', label: 'Speed (stitches per minute)', value: 1000, min: 100, max: 6000, step: 50, aliases: ['speed', 'stitches per minute'], tip: 'Home machines ≈ 800–1 100; industrial lockstitch up to ≈ 5 000.' },
      { id: 'L', label: 'Stitch length', unit: 'mm', value: 2.5, min: 0.5, max: 6, step: 0.1, aliases: ['stitch length'] },
      { id: 'S', label: 'Needle-bar stroke', unit: 'mm', value: 30, min: 20, max: 40, step: 0.5 },
      { id: 'l', label: 'Needle-bar link length', unit: 'mm', value: 45, min: 25, max: 100, step: 1 },
      { id: 'mb', label: 'Needle bar + needle mass', unit: 'g', value: 60, min: 20, max: 200, step: 5 },
      { id: 'tf', label: 'Fabric thickness', unit: 'mm', value: 1.5, min: 0.2, max: 8, step: 0.1 },
    ];
    const cv = plotCanvas('anim'), out = h('div'), c1 = plotCanvas(); cv.style.height = '340px'; c1.style.height = '300px';
    R.append(h('div', { class: 'card' }, cv, canvasLegend([['#475569', 'needle bar & needle'], ['#c2410c', 'take-up lever'], ['#0f5e8c', 'rotary hook (2 turns per stitch)'], ['#2f7d32', 'feed dog'], ['#7b3fa0', 'thread / stitches']]), out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
    let Sx = null, V;
    function run(v) {
      V = v; const r = SEW.calc(v); Sx = r; out.innerHTML = '';
      out.append(h('div', { class: 'metrics' }, metric('Hook speed', fmt(r.hookRpm), 'rpm'), metric('Cloth feed speed', fmt(r.feed), 'm/min'), metric('Stitch density', fmt(r.density), 'per cm'),
        metric('Needle peak speed', fmt(r.vmax), 'm/s'), metric('Needle-bar peak acceleration', fmt(r.amax / 9.81), 'g', r.amax / 9.81 < 300 ? 'good' : 'warn'), metric('Shaking force from needle bar', fmt(r.F), 'N'), metric('Loop pick-up at shaft angle', fmt(r.thPick / deg), '°')));
      verdict(out, true, `At ${v.spm} stitches/min the needle bar pulls ${fmt(r.amax / 9.81)} g`, `Inertia grows with speed², so industrial heads are balanced with counterweights on the main shaft, run in oil, and use light needle bars. The hook passes the needle when the needle has risen ≈ 2.4 mm from bottom: the thread then forms a loop beside the needle scarf for the hook point to catch.`);
      const th = linspace(0, 360, 361), smax = v.S;
      plot(c1, { title: 'Timing diagram: one stitch = one main-shaft turn', xlabel: 'Main shaft angle (°), 0 = needle at top', ylabel: 'normalised position', ymin: -1.2, ymax: 1.25, legend: 'bl',
        bands: [{ x0: th.find(t => r.s(t * deg) > smax - (smax * 0.45)) || 120, x1: 360 - (th.find(t => r.s(t * deg) > smax - (smax * 0.45)) || 120), color: '#e9d5ff66' }],
        vlines: [{ x: r.thPick / deg, label: 'hook catches loop', color: '#0f5e8c' }],
        series: [{ label: 'Needle height', x: th, y: th.map(t => 1 - 2 * r.s(t * deg) / smax), color: '#475569', width: 2.5 }, { label: 'Take-up lever (illustrative)', x: th, y: th.map(t => Math.cos((t - 300) * deg)), color: '#c2410c' },
          { label: 'Feed-dog lift', x: th, y: th.map(t => Math.max(0, Math.cos(t * deg)) * 0.9 - 0.1), color: '#2f7d32' }, { label: 'Feed-dog travel', x: th, y: th.map(t => -0.6 * Math.sin(t * deg)), color: '#2f7d32', dash: [4, 3] }] });
      $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = SEW.calc(vv); return { 'Needle acceleration': q.amax, 'Feed speed': q.feed }; }, v, specs);
      explain(`At ${v.spm} stitches per minute the hook spins at ${fmt(r.hookRpm)} rpm, the cloth moves at ${fmt(r.feed)} metres per minute, and the needle bar accelerates at up to ${fmt(r.amax / 9.81)} g.`);
    }
    const f = buildForm(L, specs, run, 'sewing'); run(f.vals);
    let feedPos = 0, lastCycle = 0;
    anim(t => {
      if (!Sx) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      const cyc = t / 1.6, th = (cyc % 1) * 2 * Math.PI, v = V;
      const plateY = H * 0.58, cx = w * 0.45, sc = (H * 0.32) / v.S;
      // fabric & stitches
      const cyN = Math.floor(cyc); if (cyN !== lastCycle) { lastCycle = cyN; }
      const dogUp = Math.cos(th) > 0.15, feedNow = -Math.sin(th);
      const fabOff = (Math.floor(cyc) + (th < Math.PI / 2 || th > 3 * Math.PI / 2 ? (1 - Math.cos(th)) / 2 * 0 : 0)) * v.L * 6;
      ctx.fillStyle = '#e9e3d3'; ctx.fillRect(0, plateY - v.tf * 3 - 4, w, v.tf * 3 + 4);
      ctx.strokeStyle = '#7b3fa0'; ctx.lineWidth = 2; for (let k = 1; k < 30; k++) { const x = cx - ((k * v.L * 6 + (cyc % 1) * v.L * 6 * (dogUp ? 1 : 0)) % w) ; if (x < 0) break; ctx.beginPath(); ctx.moveTo(x, plateY - v.tf * 3 - 4); ctx.lineTo(x + v.L * 6 * 0.8, plateY - v.tf * 3 - 4); ctx.stroke(); }
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, plateY, w, 8); tag(ctx, 'needle plate', 8, plateY + 16, '#475569', 'left', 10, false); tag(ctx, 'fabric', 8, plateY - v.tf * 3 - 12, '#8b7d5a', 'left', 10, false);
      // needle bar
      const sdep = Sx.s(th) * sc, ytop = plateY - v.S * sc * 0.9 - 30, ny = ytop + sdep;
      ctx.fillStyle = '#475569'; ctx.fillRect(cx - 5, 20, 10, ny - 20); ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.moveTo(cx - 2, ny); ctx.lineTo(cx + 2, ny); ctx.lineTo(cx, ny + 38); ctx.fill();
      tag(ctx, 'needle bar', cx + 10, 40, '#475569', 'left', 11);
      // main shaft crank
      const mx = cx, my = 14; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx + 60, my + 8, 8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(mx + 60, my + 8); ctx.lineTo(mx + 60 + 8 * Math.sin(th), my + 8 - 8 * Math.cos(th)); ctx.stroke(); tag(ctx, 'main shaft', mx + 74, my + 8, '#1b2430', 'left', 10, false);
      // take-up lever
      const tuy = 70 + 28 * -Math.cos(th - 300 * deg); ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 80, 70); ctx.lineTo(cx - 30, tuy); ctx.stroke(); ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(cx - 30, tuy, 5, 0, 7); ctx.fill(); tag(ctx, 'take-up lever', cx - 130, 56, '#c2410c', 'left', 11);
      // thread
      ctx.strokeStyle = '#7b3fa0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 110, 30); ctx.lineTo(cx - 30, tuy); ctx.lineTo(cx, ny + 32); ctx.stroke();
      // rotary hook (2x)
      const hy = plateY + 58, hr = 36, ha = 2 * th + Math.PI; ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx - 6, hy, hr, ha, ha + Math.PI * 1.75); ctx.stroke();
      ctx.fillStyle = '#0f5e8c'; ctx.beginPath(); ctx.arc(cx - 6 + hr * Math.cos(ha), hy + hr * Math.sin(ha), 5, 0, 7); ctx.fill(); ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(cx - 6, hy, 18, 0, 7); ctx.fill(); tag(ctx, 'bobbin', cx - 6, hy, '#475569', 'center', 10, false); tag(ctx, 'rotary hook (2× speed)', cx + hr + 4, hy + 20, '#0f5e8c', 'left', 11);
      // feed dog
      const fdx = cx + 40 + 14 * feedNow, fdy = plateY + 4 - (dogUp ? 8 * Math.cos(th) : -4); ctx.fillStyle = '#2f7d32'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(fdx + k * 9, fdy); ctx.lineTo(fdx + k * 9 + 6, fdy - 6); ctx.lineTo(fdx + k * 9 + 9, fdy); ctx.fill(); } tag(ctx, 'feed dog', fdx, plateY + 28, '#2f7d32', 'left', 11);
      const phase = th / deg; const stage = phase < 150 ? 'needle going down through the cloth' : phase < Sx.thPick / deg + 20 ? 'needle rising: thread forms a loop, the hook catches it' : phase < 300 ? 'hook carries the loop round the bobbin' : 'take-up lever pulls the stitch tight; feed dog moves the cloth';
      tag(ctx, `${fmt(phase, 3)}°: ${stage}`, 8, H - 12, '#1b2430', 'left', 12);
    });
    main.append(h('h2', null, 'Design decisions inside a sewing machine'), h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>Why does the hook turn twice?</h3><p class="small">On the first turn the hook point catches the needle-thread loop and carries it all the way round the bobbin case (that wraps the bobbin thread). The second, idle turn gives the take-up lever time to pull the loop back up and set the stitch while the cloth is fed. Hence a 2:1 drive (gears or a toothed belt) to the hook shaft.</p>' }),
      h('div', { class: 'card', html: '<h3>Why a slider-crank for the needle?</h3><p class="small">It is the simplest way to turn rotation into a straight stroke, and it naturally slows near the bottom, giving the hook time. Its inertia force grows with speed², so high-speed heads use light needle bars and counterweights (dynamics!).</p>' }),
      h('div', { class: 'card', html: '<h3>Why a four-motion feed?</h3><p class="small">The cloth must be gripped and moved only while the needle is out of it, then released. Two eccentrics 90° apart give the feed dog its up–back–down–forward path; changing the throw of one eccentric changes stitch length, and reversing it sews backwards.</p>' }),
      h('div', { class: 'card', html: '<h3>Tolerances matter</h3><p class="small">The hook point must pass the needle scarf with a gap of only hundredths of a millimetre. Too far and it misses the loop (skipped stitch), too close and it hits the needle. This is detail design: fits, adjustment screws and hardened, polished hook surfaces.</p>' }),
      h('div', { class: 'card', html: '<h3>Materials</h3><p class="small">Hooks and needles: hardened, polished steel (wear and fatigue). Bodies: cast iron or aluminium die-castings (stiffness and vibration damping). Gears: steel or reinforced plastic (quiet at home speeds).</p>' }),
      h('div', { class: 'card', html: '<h3>Modern machines</h3><p class="small">Computerised machines replace cams with stepper motors for needle swing and feed, so hundreds of stitch patterns are just software. The core lockstitch timing is unchanged since the 1850s.</p>' })));
    main.append(h('p', { class: 'small' }, 'Timing curves for the take-up lever and feed dog are illustrative (real machines differ by model); the needle curve is the exact slider-crank motion for your inputs.'));
  }
});
