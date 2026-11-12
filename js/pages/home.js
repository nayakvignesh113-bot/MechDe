'use strict';
MD.register('home', {
  group: 'Start', title: 'Home: how design works', icon: '⌂', voice: 'home start',
  render(main) {
    pageHead(main, 'MechDe · Mechanical Design Studio', 'Design is the reverse of analysis',
      'Analysis asks <i>"given this part and this load, what happens?"</i> Design asks <i>"what part, of what shape, size and material, survives this load for its whole life at the lowest cost?"</i> Most design questions have no single formula: you iterate, because the unknown dimension sits inside the very factors that decide it. MechDe lets you build parts and structures, load them, change the environment, and watch which failure mode takes over.');
    main.append(h('h2', null, 'The design chain: four subjects, one loop'));
    const ch = h('div', { class: 'chain' });
    const nodes = [
      ['Kinematics', 'How does it move?', 'Geometry only: positions, velocities, accelerations, stroke, speed ratios, transmission angle. No forces, no mass.', 'kinematics'],
      ['Kinetics & Dynamics', 'What forces does that motion create?', 'Newton/D\'Alembert: inertia forces, gas/working loads, torque fluctuation (flywheel), unbalance, vibration and resonance.', 'dynamics'],
      ['Strength of Materials', 'What stresses and deflections result?', 'σ = P/A, Mc/I, Tr/J; combined stresses, Mohr\'s circle, buckling, deflection, strain energy, contact stress.', 'som'],
      ['Machine Design', 'What size, shape and material survive?', 'Failure theories + real-world modifiers (fatigue, notches, size, surface, temperature, corrosion, reliability) + standards + cost. Then iterate.', 'shaft'],
    ];
    nodes.forEach((n, i) => {
      ch.append(h('a', { class: 'node', href: '#' + n[3], style: { textDecoration: 'none', color: 'inherit' } }, h('div', { class: 't' }, (i + 1) + ' · ' + n[0]), h('div', { class: 'q' }, n[1]), h('div', { class: 'o' }, n[2])));
      if (i < 3) ch.append(h('div', { class: 'arrow' }, '➜'));
    });
    main.append(ch);
    main.append(h('div', { class: 'note', html: '<b>The feedback loop:</b> design changes mass and stiffness, so dynamics changes too. A thicker connecting rod is heavier, so its inertia force rises, so its stress rises. A stiffer shaft raises its critical speed; a lighter one lowers its whipping stress. Good machines come from going round this loop until it converges. The <a href="#chain">Design Chain</a> page runs the loop live on an engine.' }));
    main.append(h('h2', null, 'Build · test · analyse'));
    const tiles = h('div', { class: 'tiles' });
    [
      ['chain', '🔁', 'Design Chain (engine)', 'Kinematics → dynamics → SOM → design, iterated live on a slider-crank engine: piston, connecting rod, flywheel.'],
      ['structure', '🌉', 'Structure Builder', 'Draw bridges, trusses, frames, cranes. Static, thermal, wind, moving vehicle, natural frequencies, resonance (FRF).'],
      ['som', '📐', 'SOM → Design Bridge', 'Mohr\'s circle, failure theories, and how each real-world factor erodes the textbook safety factor.'],
      ['shaft', '🛞', 'Shaft Designer', 'Fatigue (Goodman/Gerber/ASME/Soderberg), deflection, bearing slope, critical speed: which one sets the diameter?'],
      ['gear', '⚙️', 'Spur Gear Designer', 'Lewis beam strength vs Buckingham wear vs Hertz contact; module selection; meshing animation.'],
      ['belt', '➰', 'Belt Drive', 'Flat & V-belts, centrifugal tension, the speed that maximises power, number of belts.'],
      ['spring', '🌀', 'Helical Spring', 'Wahl factor, fatigue (Zimmerli), buckling, surge frequency; wire-size iteration.'],
      ['bolt', '🔩', 'Bolted Joint', 'Preload, joint stiffness, separation, fatigue, and preload loss from thermal mismatch.'],
      ['column', '🏛', 'Columns & Buckling', 'Euler vs Johnson vs Rankine: when does yielding hand over to buckling?'],
      ['kinematics', '🔗', 'Kinematics Lab', 'Four-bar linkages (Grashof, coupler curves, transmission angle) and cam profiles (SVAJ).'],
      ['dynamics', '〰', 'Dynamics Lab', 'Flywheel from turning-moment diagram, rotating-mass balancing, vibration isolation.'],
      ['spanner', '🔧', 'Why is a spanner shaped so?', 'Length, 15° head offset and tapering handle, derived from bolt torque, hex geometry and beam theory.'],
      ['cases', '⚠️', 'Failure case studies', 'Tacoma Narrows, Hyatt Regency, Comet, Liberty ships, Millennium Bridge, each reproduced in a module.'],
      ['environment', '🌡', 'Operating environment', 'Temperature, corrosive medium, reliability and design life: applied to every module.'],
      ['notebook', '📝', 'Design notebook', 'Voice dictation of design notes and decisions, saved in your browser.'],
    ].forEach(t => tiles.append(h('a', { class: 'tile', href: '#' + t[0] }, h('div', { class: 'ic' }, t[1]), h('b', null, t[2]), h('span', null, t[3]))));
    main.append(tiles);
    main.append(h('h2', null, 'How every module thinks'));
    main.append(h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>1 · Every failure mode is a constraint</h3><p class="small">A shaft can fail by fatigue, yield, excessive deflection, bearing misalignment, or whirling at critical speed. Each needs its own minimum size. The <b>largest</b> one governs. Every module shows this as a dominance bar chart.</p>' }),
      h('div', { class: 'card', html: '<h3>2 · Environment shifts the winner</h3><p class="small">Raise temperature and aluminium loses strength faster than stiffness. Put steel in seawater and its endurance limit disappears. Below 0 °C mild steel can turn brittle. Change the 🌡 setting and watch the governing mode change.</p>' }),
      h('div', { class: 'card', html: '<h3>3 · Iteration is shown, not hidden</h3><p class="small">Size factor depends on diameter, velocity factor depends on module, joint stiffness depends on bolt size. The iteration tables show each pass converging, which is exactly what a designer does on paper.</p>' }),
    ));
    main.append(h('div', { class: 'note', html: '🎙 <b>Voice:</b> press Voice and say <i>"go to gear"</i>, <i>"set power to 15"</i>, <i>"set material to 4140"</i>, <i>"explain"</i>, or <i>"note use carburised pinion"</i>. Works in Chrome/Edge on the hosted site (in-app previews block the microphone).' }));
    main.append(h('p', { class: 'small' }, 'Methods follow standard machine-design practice (Shigley, Bhandari/PSG data book conventions, AGMA, IS 800 / IS 875 concepts). Temperature and corrosion factors are indicative: verify against material certificates and codes before fabrication.'));
    explain('MechDe treats design as the reverse of analysis. Kinematics gives motion, dynamics gives forces, strength of materials gives stresses, and design picks the size and material, then the loop repeats because the new size changes the forces.');
  }
});
