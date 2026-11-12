'use strict';
const DESIGN_STAGES = [
  { k: 'Need', q: 'What problem hurts?', why: 'Every design begins with a need: someone must cross a river, sew faster, ride without falling, carry a load. No need, no design.', go: 'cases', ph: 0 },
  { k: 'Requirements', q: 'What exactly must it do?', why: 'Turn the wish into numbers: load, speed, life, weight, cost, safety, environment. Vague goals give vague machines.', go: 'environment', ph: 0 },
  { k: 'Concepts', q: 'Which idea, of many?', why: 'Sketch several ways (gear or belt? truss or arch?), then compare them honestly. The best idea beats the best calculation.', go: 'why', ph: 0 },
  { k: 'Kinematics', q: 'How does it move?', why: 'Geometry and motion: strokes, ratios, speeds, accelerations. Wrong motion cannot be fixed by stronger steel.', go: 'kinematics', ph: 1 },
  { k: 'Loads & dynamics', q: 'What forces act?', why: 'Weights, working loads, inertia (mass × acceleration), shocks, vibration. This is where most surprises hide.', go: 'dynamics', ph: 1 },
  { k: 'Stress & deflection', q: 'How hard is each part working?', why: 'Strength of materials converts forces into stresses and bending. Find the critical spot.', go: 'som', ph: 1 },
  { k: 'Failure modes', q: 'How could it fail?', why: 'Yield, fatigue, buckling, wear, resonance, corrosion… each one is a rule the design must obey.', go: 'som', ph: 1 },
  { k: 'Material & process', q: 'What is it made of, and how?', why: 'Steel or aluminium? Cast, forged, welded, printed? The process limits the shape.', go: 'environment', ph: 2 },
  { k: 'Size & shape', q: 'How big, what shape?', why: 'Solve each failure rule for the size; the biggest wins. New size → new weight → new forces → go round again.', go: 'shaft', ph: 2 },
  { k: 'Detail design', q: 'Can it be made and assembled?', why: 'Standard sizes, tolerances, fasteners, drawings, cost. Good ideas die here if ignored.', go: 'keys', ph: 2 },
  { k: 'Prototype & test', q: 'Does reality agree?', why: 'Build, measure, break. Tests catch what the equations missed.', go: 'structure', ph: 3 },
  { k: 'Make, use, learn', q: 'What does the field teach?', why: 'Production, service and failures feed the next version. Design never really ends.', go: 'cases', ph: 3 },
];
const PHASE_COL = ['#fde3cf', '#d7e8f5', '#d8efd9', '#eadcf5'], PHASE_NAME = ['Understand the problem', 'Analyse (physics)', 'Synthesise (decide)', 'Realise & learn'];
function drawFlowchart(box) {
  const narrow = box.clientWidth < 700;
  const W = narrow ? 420 : 1000, nw = narrow ? 300 : 200, nh = narrow ? 64 : 78;
  const pos = DESIGN_STAGES.map((s, i) => {
    if (narrow) return [16, 20 + i * (nh + 26)];
    const row = Math.floor(i / 4), col = i % 4, c = row % 2 ? 3 - col : col;
    return [30 + c * 245, 34 + row * 190];
  });
  const H = narrow ? 20 + DESIGN_STAGES.length * (nh + 26) + 10 : 520;
  const ns = 'http://www.w3.org/2000/svg', el = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Design process flowchart' });
  const defs = el('defs', {}); const mk = el('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }); mk.append(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#1b2430' })); defs.append(mk);
  const mk2 = mk.cloneNode(true); mk2.setAttribute('id', 'ah2'); mk2.firstChild.setAttribute('fill', '#c2410c'); defs.append(mk2); svg.append(defs);
  const ctr = i => [pos[i][0] + nw / 2, pos[i][1] + nh / 2];
  for (let i = 0; i < DESIGN_STAGES.length - 1; i++) {
    const [x1, y1] = ctr(i), [x2, y2] = ctr(i + 1); let d;
    if (narrow || Math.abs(y1 - y2) > 5) d = `M${x1},${pos[i][1] + nh} L${x2},${pos[i + 1][1]}`;
    else d = x2 > x1 ? `M${pos[i][0] + nw},${y1} L${pos[i + 1][0]},${y2}` : `M${pos[i][0]},${y1} L${pos[i + 1][0] + nw},${y2}`;
    svg.append(el('path', { d, stroke: '#1b2430', 'stroke-width': 2, fill: 'none', 'marker-end': 'url(#ah)' }));
  }
  const lp = (d, lx, ly, label, rot) => {
    svg.append(el('path', { d, stroke: '#c2410c', 'stroke-width': 2, 'stroke-dasharray': '6 4', fill: 'none', 'stroke-linejoin': 'round', 'marker-end': 'url(#ah2)' }));
    const t = el('text', { x: lx, y: ly, fill: '#c2410c', 'font-size': 13, 'font-weight': 600, 'text-anchor': 'middle', 'font-family': 'IBM Plex Sans, sans-serif' }); t.textContent = label;
    if (rot) t.setAttribute('transform', `rotate(-90 ${lx} ${ly})`); svg.append(t);
  };
  if (narrow) {
    const side = (a, b, off, label) => { const ya = ctr(a)[1], yb = ctr(b)[1], xe = pos[a][0] + nw, x = xe + off; lp(`M${xe},${ya} L${x},${ya} L${x},${yb} L${xe},${yb}`, x + 12, (ya + yb) / 2, label, true); };
    side(8, 4, 22, '↺ new size → new forces'); side(10, 2, 50, '↺ test fails → rethink'); side(11, 0, 78, '↺ next version');
  } else {
    const R = i => pos[i][0] + nw, T = i => pos[i][1], B = i => pos[i][1] + nh, C = i => ctr(i);
    // 9 Size → 5 Loads: through the row-2/3 gutter, up the right edge
    lp(`M${C(8)[0] + 50},${T(8)} L${C(8)[0] + 50},388 L978,388 L978,${C(4)[1]} L${R(4)},${C(4)[1]}`, 330, 382, '↺ new size → new weight & forces');
    // 11 Test → 3 Concepts: up the column gutter between col 2 and 3
    lp(`M${C(10)[0] + 40},${T(10)} L${C(10)[0] + 40},402 L742,402 L742,168 L${C(2)[0]},168 L${C(2)[0]},${B(2)}`, 680, 162, '↺ test fails → rethink');
    // 12 Use → 1 Need: round the outside
    lp(`M${R(11)},${C(11)[1]} L994,${C(11)[1]} L994,10 L10,10 L10,${C(0)[1]} L${pos[0][0]},${C(0)[1]}`, 560, 26, '↺ field feedback → next version');
  }
  const nodes = DESIGN_STAGES.map((s, i) => {
    const [x, y] = pos[i], a = el('a', { href: '#' + s.go });
    const r = el('rect', { x, y, width: nw, height: nh, rx: 12, fill: PHASE_COL[s.ph], stroke: '#1b2430', 'stroke-width': 1.5 });
    const t1 = el('text', { x: x + 12, y: y + 27, 'font-size': 16, 'font-weight': 700, fill: '#1b2430', 'font-family': 'IBM Plex Sans, sans-serif' }); t1.textContent = `${i + 1}. ${s.k}`;
    const t2 = el('text', { x: x + 12, y: y + 52, 'font-size': 13, fill: '#4a5566', 'font-family': 'IBM Plex Sans, sans-serif' }); t2.textContent = s.q;
    a.append(r, t1, t2); svg.append(a); return r;
  });
  if (!narrow) { const s1 = el('text', { x: 34, y: 27, 'font-size': 13, fill: '#c2410c', 'font-weight': 700, 'font-family': 'IBM Plex Sans, sans-serif' }); s1.textContent = '▶ START HERE: a need'; svg.append(s1); }
  box.innerHTML = ''; box.append(svg);
  let last = -1;
  anim(t => { const i = Math.floor(t / 1.3) % DESIGN_STAGES.length; if (i === last) return; if (last >= 0) { nodes[last].setAttribute('stroke-width', 1.5); nodes[last].setAttribute('stroke', '#1b2430'); } nodes[i].setAttribute('stroke-width', 4); nodes[i].setAttribute('stroke', '#c2410c'); last = i; });
}
MD.register('home', {
  group: 'Start', title: 'Home: how design works', icon: '⌂', voice: 'home start',
  render(main) {
    pageHead(main, 'MechDe · Mechanical Design Studio', 'Why is everything shaped the way it is?',
      'A spanner, a bicycle, a bridge, a sewing machine, an electric car. Every one of them was <b>designed</b>: someone decided its shape, size and material so it works, lasts and is safe. This site lets you make those decisions yourself, see the equations behind them, and watch what changes when you change something.');
    const start = h('div', { class: 'tiles' });
    [['guide', '👋', 'New here? Start with the tour', 'How every page works, in plain words.'], ['structure', '🌉', 'Build a bridge', 'Draw it, load it, watch members turn red.'], ['drivetrain', '🚲', 'Design my bicycle gears', 'Which gear for that hill?'],
      ['balancebike', '🛵', 'How do self-balancing bikes stand?', 'Balance a bike yourself with a controller.'], ['ev', '⚡', 'Design an electric car', 'Battery, motor, range, Tesla-style.'], ['sewing', '🧵', 'How does a sewing machine stitch?', 'Four mechanisms in perfect timing.'],
      ['why', '🤔', 'Why are things shaped like that?', 'I-beams, hollow shafts, domed tanks, hooks.']]
      .forEach(t => start.append(h('a', { class: 'tile big', href: '#' + t[0] }, h('div', { class: 'ic' }, t[1]), h('b', null, t[2]), h('span', null, t[3]))));
    main.append(start);
    main.append(h('h2', null, 'How a design is born, grows and ends: the design flowchart'));
    main.append(h('p', { class: 'lead', html: 'Design <b>begins with a need</b>, not with a formula. It <b>progresses</b> by turning the need into numbers, motion, forces, stresses and finally a size and shape, <b>looping back</b> whenever a decision changes the forces. It <b>ends</b> only when a tested product is serving people, and their feedback starts the next version. Click any box to open the page that does that step.' }));
    const fc = h('div', { class: 'card flow' }); main.append(fc);
    main.append(h('div', { class: 'legend' }, PHASE_NAME.map((n, i) => h('span', null, h('i', { style: { background: PHASE_COL[i], height: '12px', width: '18px', border: '1px solid #1b2430' } }), n)), h('span', { style: { color: 'var(--accent)' } }, '- - - feedback loops: design is iterative')));
    requestAnimationFrame(() => drawFlowchart(fc));
    let rz; const onR = () => { clearTimeout(rz); rz = setTimeout(() => { if (MD.current === 'home') drawFlowchart(fc); }, 200); }; window.addEventListener('resize', onR);
    const prev = MD.cleanup; MD.cleanup = () => { window.removeEventListener('resize', onR); prev && prev(); };
    const tb = h('table', { class: 't' }, h('tr', null, h('th', null, 'Stage'), h('th', { style: { textAlign: 'left' } }, 'Why this stage exists'), h('th', null, 'Try it')));
    DESIGN_STAGES.forEach((s, i) => tb.append(h('tr', null, h('td', { style: { fontFamily: 'var(--sans)', whiteSpace: 'nowrap' } }, `${i + 1}. ${s.k}`), h('td', { style: { fontFamily: 'var(--sans)', textAlign: 'left' } }, s.why), h('td', null, h('a', { href: '#' + s.go }, 'open →')))));
    main.append(h('details', { class: 'card', style: { marginTop: '10px' } }, h('summary', null, 'Each stage explained: where it begins, why, how it progresses, where it ends'), h('div', { class: 'tablewrap' }, tb)));

    main.append(h('h2', null, 'The four subjects behind every machine'));
    const ch = h('div', { class: 'chain' });
    [['Kinematics', 'How does it move?', 'Positions, speeds, accelerations. No forces yet.', 'kinematics'],
      ['Kinetics & Dynamics', 'What forces does the motion create?', 'Mass × acceleration, gas/working loads, unbalance, vibration.', 'dynamics'],
      ['Strength of Materials', 'What stresses result?', 'σ = M·c/I, τ = T·r/J, buckling, deflection, contact stress.', 'som'],
      ['Machine Design', 'What size, shape, material survive?', 'Failure theories + real-world factors + standards + cost. Then iterate.', 'shaft']].forEach((n, i) => {
      ch.append(h('a', { class: 'node', href: '#' + n[3], style: { textDecoration: 'none', color: 'inherit' } }, h('div', { class: 't' }, (i + 1) + ' · ' + n[0]), h('div', { class: 'q' }, n[1]), h('div', { class: 'o' }, n[2])));
      if (i < 3) ch.append(h('div', { class: 'arrow' }, '➜'));
    });
    main.append(ch, h('div', { class: 'note', html: '<b>Watch it all at once:</b> the <a href="#chain">Design Chain</a> page designs an engine connecting rod by running all four subjects and looping until the answer stops changing.' }));

    main.append(h('h2', null, 'What is so fascinating about design?'));
    main.append(h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>🔍 Hidden decisions everywhere</h3><p class="small">The bump on a bottle base, the taper of a spanner, the hole pattern in a bicycle disc, the dome on a gas cylinder: each one is an answer to a force, a cost or a failure someone once suffered.</p>' }),
      h('div', { class: 'card', html: '<h3>⚖️ Every answer is a compromise</h3><p class="small">Stronger means heavier; lighter means more expensive; softer mounts isolate vibration but pass through resonance. Design is choosing the <i>best</i> compromise for this job, so two good engineers may build different machines.</p>' }),
      h('div', { class: 'card', html: '<h3>📈 Small changes, huge effects</h3><p class="small">Double a shaft\'s diameter and its stress falls 8× (d³). Double a beam\'s span and it sags 8× more (L³). Double a car\'s speed and air-drag power rises 8× (v³). Knowing these levers is the designer\'s superpower.</p>' }),
      h('div', { class: 'card', html: '<h3>🌿 Nature got there first</h3><p class="small">Bones are hollow tubes (stiff and light), tree trunks taper like the spanner handle (uniform strength), eggs are domes (pressure vessels). Good engineering often rediscovers good biology.</p>' }),
      h('div', { class: 'card', html: '<h3>💥 Failures teach the most</h3><p class="small">Tacoma Narrows taught us dynamics, the Comet taught us fatigue at corners, the Liberty ships taught us cold brittleness. Every rule in a design code was written after something broke.</p>' }),
      h('div', { class: 'card', html: '<h3>🤖 It keeps changing</h3><p class="small">Self-balancing motorcycles, structural battery packs, single-piece car castings: new materials, sensors and manufacturing keep rewriting "the way things are built". The physics stays; the answers move.</p>' })));

    main.append(h('h2', null, 'Everything on the site'));
    const tiles = h('div', { class: 'tiles' });
    [['chain', '🔁', 'Design Chain (engine)', 'Kinematics → dynamics → SOM → design, iterated live.'],
      ['structure', '🌉', 'Structure builder', 'Bridges, trusses, frames: static, thermal, wind, vibration, moving loads.'],
      ['som', '📐', 'SOM → Design bridge', 'Mohr\'s circle, failure theories, real-world factors.'],
      ['shaft', '🛞', 'Shaft', 'Fatigue, deflection, critical speed.'], ['gear', '⚙️', 'Spur gears', 'Bending vs wear, module choice.'], ['gearsplus', '⚙️', 'Helical, bevel, worm, planetary', 'Thrust, efficiency, self-locking, epicyclic ratios.'],
      ['bearings', '🔘', 'Bearings', 'Ball/roller life (L10) and oil-film journal bearings.'], ['keys', '🔑', 'Keys, splines, couplings', 'Connecting hubs to shafts and shafts to shafts.'],
      ['clutch', '🛑', 'Clutches & brakes', 'Friction torque, heat, wear.'], ['joints', '🔥', 'Welded & riveted joints', 'Eccentric welds, riveted joint efficiency.'], ['screws', '🔩', 'Power screws', 'Screw jacks, efficiency, self-locking.'],
      ['vessels', '🛢', 'Pressure vessels & curved beams', 'Why tanks are domed and hooks are fat inside.'],
      ['belt', '➰', 'Belt drive', 'Centrifugal tension, optimum speed.'], ['spring', '🌀', 'Springs', 'Fatigue, buckling, surge.'], ['bolt', '🔩', 'Bolted joints', 'Preload, separation, fatigue.'], ['column', '🏛', 'Columns', 'Euler vs Johnson.'],
      ['drivetrain', '🚲', 'Bike drivetrain & gear train', 'Bicycle gears, motorcycle gearbox.'], ['kinematics', '🔗', 'Kinematics lab', 'Linkages, cams.'], ['dynamics', '〰', 'Dynamics lab', 'Flywheel, balancing, isolation.'],
      ['why', '🤔', 'Why is it built this way?', 'Shapes explained with live comparisons.'], ['balancebike', '🛵', 'Self-balancing bikes', 'Inverted pendulum, steering, gyroscopes.'], ['ev', '⚡', 'EV & Tesla-style design', 'Range, battery, motor, gear ratio.'], ['sewing', '🧵', 'Sewing machine', 'Needle, hook, take-up, feed timing.'],
      ['spanner', '🔧', 'Why a spanner is shaped so', 'Length, 15° head, taper.'], ['cases', '⚠️', 'Failure case studies', 'Tacoma, Hyatt, Comet, Liberty, Silver, Millennium.'], ['environment', '🌡', 'Operating environment', 'Temperature, corrosion, reliability.'], ['notebook', '📝', 'Design notebook', 'Voice dictation.']]
      .forEach(t => tiles.append(h('a', { class: 'tile', href: '#' + t[0] }, h('div', { class: 'ic' }, t[1]), h('b', null, t[2]), h('span', null, t[3]))));
    main.append(tiles);
    main.append(h('div', { class: 'note', html: '🧒 <b>Simple mode</b> (top bar) shows only the few inputs that matter most; switch to 🎓 <b>Expert</b> for everything. Every input has an ⓘ explanation, every page has a 📘 equations panel and a 🔬 effect-of-parameters table. 🎙 Voice works in Chrome/Edge on the hosted site.' }));
    main.append(h('p', { class: 'small' }, 'Methods follow standard machine-design practice (Shigley, Bhandari/PSG data book conventions, AGMA, IS 800 / IS 875 concepts). Temperature, corrosion and catalogue figures are indicative; verify against codes and supplier data before building.'));
    explain('Design begins with a need, turns it into requirements and concepts, then works through motion, forces, stresses and failure modes to choose material, size and shape, looping back whenever a decision changes the forces. It ends with a tested product in use, whose feedback starts the next version.');
  }
});
