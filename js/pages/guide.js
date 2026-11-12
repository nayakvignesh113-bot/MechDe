'use strict';
MD.register('guide', {
  group: 'Start', title: 'How to design with MechDe', icon: '🧭', voice: 'guide how to use help tutorial recipes',
  render(main) {
    pageHead(main, 'Start here', 'How to design with MechDe',
      'Every module works the same way: <b>enter the requirement → read the governing failure mode → change one thing → watch what takes over</b>. Below: the general method, step-by-step recipes for real products, and an honest map of what MechDe covers today and what it doesn\'t.');
    main.append(h('h2', null, 'Reading any module in 30 seconds'));
    main.append(h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>Left panel = requirement</h3><p class="small">Loads, speeds, materials, limits. Type, drag the slider, or say <i>"set power to 15"</i>. <b>↺ Reset to defaults</b> restores the example. Inputs are remembered in your browser.</p>' }),
      h('div', { class: 'card', html: '<h3>Coloured tiles = checks</h3><p class="small"><span style="color:var(--good)">Green</span> passes the target factor of safety, <span style="color:var(--warn)">amber</span> passes 1.0 but not the target, <span style="color:var(--bad)">red</span> fails.</p>' }),
      h('div', { class: 'card', html: '<h3>Bar chart = who governs</h3><p class="small">Each failure mode demands its own minimum size. The <span style="color:var(--accent)">orange bar</span> is the governing one. That is your design driver, and the thing to attack if you want a smaller part.</p>' }),
      h('div', { class: 'card', html: '<h3>Box with a coloured edge = verdict</h3><p class="small">The answer in words: what size to use, why, and what to change. 🔊 Explain reads it aloud. The notebook can append it to your design record.</p>' }),
      h('div', { class: 'card', html: '<h3>Sweep charts = "what if"</h3><p class="small">Speed, hardness, preload, slenderness, gradient… The dashed line is your design point. Crossings mark where the governing mode switches.</p>' }),
      h('div', { class: 'card', html: '<h3>🌡 = real conditions</h3><p class="small">Temperature, corrosive medium, reliability and life apply to every module. Set them first; a design that passes at 25 °C dry may fail at 120 °C or in seawater.</p>' })));
    main.append(h('h2', null, 'Design recipes: which modules, in what order'));
    const R = [
      { t: '🚲 Bicycle drivetrain (chain & sprockets)', steps: [
        ['drivetrain', 'Bike drivetrain → Bicycle tab', 'Enter rider mass, sustainable power and preferred cadence. Enter chainrings ("50, 34") and cassette ("11,…,32").'],
        ['drivetrain', 'Check range', 'Set the steepest gradient you must climb. If "cadence in lowest gear" is red, add a bigger rear cog or smaller chainring. Check the top speed at your cadence.'],
        ['drivetrain', 'Check steps & overlaps', 'Large jumps (> 15 %) and duplicate ratios show in the verdict and the "All gear combinations" table. Cross-chained combos are red.'],
        ['drivetrain', 'Check the chain', 'Peak pedal force on the smallest chainring sets chain tension. Keep FS ≥ 2 (use an e-bike chain for motors/tandems).'],
        ['structure', 'Frame (optional)', 'Model the diamond frame in 2D (rigid frame) with rider load at the saddle and pedal force at the bottom bracket.'] ] },
      { t: '🏍 Motorcycle gearbox (gear train) + final chain', steps: [
        ['drivetrain', 'Bike drivetrain → Motorcycle tab: engine', 'Enter peak torque/power and their speeds, plus redline.'],
        ['drivetrain', 'Ratios', 'Choose the number of gears, 1st and top ratio, spacing. Read the tractive-effort diagram (top speed, gradeability) and the rpm-after-upshift column (should stay near peak torque).'],
        ['drivetrain', 'Teeth & centre distance', 'Module + centre distance fix the tooth sum for every constant-mesh pair. Keep pinions ≥ 14 teeth; watch the ratio error.'],
        ['gear', 'Each gear pair', 'Press "open in gear designer" on the weakest row to see Lewis/Buckingham detail, module sweep and hardness sweep.'],
        ['shaft', 'Input & output shafts', 'Use the output-shaft torque printed on the drivetrain page; place gears near bearings; check deflection and slope at the gears.'],
        ['environment', 'Hot oil', 'Set 🌡 to ~90–110 °C (gearbox oil) and re-check.'],
        ['bolt', 'Sprocket / cover bolts', 'Fluctuating load, preload, separation.'] ] },
      { t: '🏭 Motor → belt → shaft → gear (conveyor or machine drive)', steps: [
        ['belt', 'Belt drive', 'Motor power, speed, pulley sizes → belt section and number of belts; note the "load on shaft".'],
        ['shaft', 'Shaft', 'Enter the same power and the driven speed; element 1 = pulley (diameter, belt pull angle), element 2 = gear. Read which criterion sets Ø.'],
        ['gear', 'Gear pair', 'Same power, pinion speed, ratio → module, face width, materials.'],
        ['bolt', 'Foundation / bearing-housing bolts', 'Separation & fatigue under the fluctuating load.'],
        ['dynamics', 'Vibration isolation', 'Machine mass, speed, unbalance → isolator stiffness.'] ] },
      { t: '🌉 Footbridge or truss', steps: [
        ['structure', 'Build', 'Load the Pratt or Warren preset, or draw your own (Member tool: click two points; Support tool cycles pin/roller/fixed).'],
        ['structure', 'Static check', 'Set deck load; read utilisation colours and the governing member. Press ⚙ Auto-size.'],
        ['structure', 'Modal & resonance', 'Read f1. Avoid 1.6–2.4 Hz vertical and 0.5–1.2 Hz lateral for footbridges; check the FRF at your excitation.'],
        ['structure', 'Moving load', 'Drive a vehicle across; the envelope colours and the influence line show sign reversals (fatigue).'],
        ['environment', 'Temperature & wind', 'Set the operating vs installation temperature, and the wind speed; re-check (restrained thermal stress).'] ] },
      { t: '🔥 IC engine: connecting rod & flywheel', steps: [
        ['chain', 'Design Chain', 'Bore, stroke, rod length, speed, peak pressure → I-section rod, pin diameters, convergence table.'],
        ['dynamics', 'Flywheel', 'Same engine → turning-moment diagram, ΔE, flywheel inertia and rim size; compare 1 vs 4 cylinders.'],
        ['dynamics', 'Balancing', 'Rotating masses → balancing mass and angle.'] ] },
      { t: '⚙️ Cam-operated valve / follower', steps: [
        ['kinematics', 'Cam & follower', 'Lift, rise/return angles, base circle, speed → pressure angle, undercut, jerk; retaining-spring force.'],
        ['spring', 'Spring', 'Fmin = preload, Fmax = preload + spring force from the cam page; operating frequency = cam rpm/60 → surge check.'] ] },
      { t: '⚡ Electric car or scooter', steps: [
        ['ev', 'EV designer', 'Pick a preset; set cruise speed and battery kWh. Read range, 0–100 time, cells in series × parallel and cell C-rate.'],
        ['gearsplus', 'Reduction gears', 'The single-speed reduction is often helical (quiet) or planetary (compact): size it at motor peak torque.'],
        ['bearings', 'Motor bearings', 'High motor speed: check bearing life at speed.'],
        ['clutch', 'Brakes', 'Disc-brake temperature for a stop from top speed (regenerative braking reduces this in real EVs).'] ] },
      { t: '🛵 Self-balancing two-wheeler', steps: [
        ['balancebike', 'Balance controller', 'Choose steering or gyroscope balancing; tune Kp and Kd; push it and check it recovers at 0 km/h.'],
        ['gearsplus', 'Steering actuator gearbox', 'Size a worm or planetary reduction for the steering motor torque.'],
        ['shaft', 'Gyro flywheel shaft', 'If using gyroscopes: flywheel mass and spin speed → shaft and bearing loads.'] ] },
      { t: '🧵 Sewing machine', steps: [
        ['sewing', 'Mechanism timing', 'Speed and stitch length → needle acceleration, hook speed, feed speed, timing diagram.'],
        ['dynamics', 'Balancing', 'Needle-bar inertia force → counterweight on the main shaft (balancing tab).'],
        ['gearsplus', 'Hook drive', '2:1 bevel or belt drive from the main shaft to the hook shaft.'] ] },
      { t: '🏗 Wall bracket / crane jib', steps: [
        ['structure', 'Jib preset', 'Load the wall-crane preset; read tie tension and jib compression.'],
        ['column', 'Compression member', 'Check the jib as a column (end conditions, eccentricity).'],
        ['bolt', 'Wall bolts', 'Tie load per bolt → preload, separation.'] ] },
    ];
    R.forEach(r => {
      const card = h('div', { class: 'card', style: { marginTop: '12px' } }, h('h3', { style: { marginTop: 0 } }, r.t));
      const ol = h('ol', { style: { margin: '6px 0 0', paddingLeft: '20px' } });
      r.steps.forEach(([id, name, txt]) => ol.append(h('li', { style: { margin: '5px 0' } }, h('a', { href: '#' + id }, h('b', null, name)), ': ', txt)));
      card.append(ol); main.append(card);
    });
    main.append(h('h2', null, 'What MechDe covers, honestly'));
    const cov = [
      ['Static strength, failure theories (von Mises, Tresca, Rankine, Coulomb–Mohr)', 'yes', 'SOM bridge, all elements'],
      ['Fatigue: Marin factors, notch sensitivity, Goodman/Gerber/ASME/Soderberg', 'yes', 'Shaft, SOM bridge, spring, bolt'],
      ['Buckling (Euler, Johnson, Rankine–Gordon, secant)', 'yes', 'Columns, structure, connecting rod'],
      ['Stiffness: deflection, slopes, critical speed', 'yes', 'Shaft, structure'],
      ['Natural frequencies, resonance, FRF, moving loads', 'yes', 'Structure builder'],
      ['Temperature, corrosion, reliability, design life', 'yes', '🌡 global setting'],
      ['Kinematics: four-bar, slider-crank, cams', 'yes', 'Kinematics lab, Design Chain'],
      ['Dynamics: turning moment, flywheel, balancing, isolation', 'yes', 'Dynamics lab'],
      ['Spur gears (Lewis, Buckingham, Hertz)', 'yes', 'Gear designer'],
      ['Gear trains (constant-mesh gearbox), roller chains, bicycle drivetrains', 'yes', 'Bike drivetrain & gear train'],
      ['Flat & V-belts, helical compression springs, bolted joints (axial)', 'yes', 'Belt, spring, bolt'],
      ['Helical, bevel, worm and planetary gears', 'yes', 'Helical, bevel, worm & planetary'],
      ['Rolling bearings (L10 life) and journal bearings', 'yes', 'Bearings'],
      ['Keys, splines, flange & flexible couplings', 'yes', 'Keys, splines & couplings'],
      ['Clutches (plate, cone) and brakes (disc, band)', 'yes', 'Clutches & brakes'],
      ['Welded (eccentric) and riveted joints', 'yes', 'Welded & riveted joints'],
      ['Power screws, screw jacks', 'yes', 'Power screws'],
      ['Pressure vessels (thin/thick, end closures), curved beams', 'yes', 'Pressure vessels & curved beams'],
      ['Product system design: EV, self-balancing bike, sewing machine', 'yes', 'Products section'],
      ['Impact/shock loading', 'partial', 'via service factors only'],
      ['Bolted joints in shear / eccentric loading', 'partial', 'axial tension only'],
      ['Creep and fracture mechanics', 'partial', 'warnings and case studies; no K_IC or creep-life calculation'],
      ['3D structures and solid parts', 'partial', '2D frames/trusses only; out-of-plane buckling approximated with I_min'],
      ['Gear rating to AGMA 2001 / ISO 6336', 'partial', 'Lewis + Buckingham (conservative) with a Hertz cross-check'],
      ['Leaf & torsion springs, flywheels as stressed discs, cams with dynamics of follower train', 'no', 'planned'],
      ['Tolerances & fits, cost, manufacturability, seismic loads', 'no', 'outside current scope'],
    ];
    const tb = h('table', { class: 't' }, h('tr', null, h('th', null, 'Design aspect'), h('th', null, 'Status'), h('th', { style: { textAlign: 'left' } }, 'Where')));
    cov.forEach(([a, s, w]) => tb.append(h('tr', null, h('td', { style: { fontFamily: 'var(--sans)' } }, a), h('td', null, h('span', { class: 'pill', style: { background: s === 'yes' ? '#dcefdc' : s === 'partial' ? '#fdf0d5' : '#f6dcd8' } }, s === 'yes' ? '✓ covered' : s === 'partial' ? '◐ partial' : '✗ not yet')), h('td', { style: { textAlign: 'left', fontFamily: 'var(--sans)' } }, w))));
    main.append(h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, tb)));
    main.append(h('p', { class: 'small' }, 'Data limits: temperature/corrosion factors, V-belt and chain ratings are indicative. Gear checks use the conservative Lewis + Buckingham method (Indian university syllabus convention), not full AGMA 2001 / ISO 6336. Use the results for learning and preliminary sizing, then verify against codes and supplier data.'));
    explain('Each module takes your requirements on the left, shows pass or fail tiles, a bar chart of which failure mode governs, and a verdict. Recipes on this page list which modules to use, in order, for products like a bicycle drivetrain, motorcycle gearbox, conveyor drive, footbridge, engine and cam.');
  }
});
