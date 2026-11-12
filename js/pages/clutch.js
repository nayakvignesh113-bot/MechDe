'use strict';
const CB = {
  plate(v) { // uniform wear; solve outer radius for torque
    const T = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60) * v.Cs; // N·mm
    const k = v.ratio, cap = Ro => v.ns * v.mu * (2 * Math.PI * v.p * k * Ro * (Ro - k * Ro)) * (Ro + k * Ro) / 2; // uniform wear: W = 2π p Ri (Ro-Ri), Rf = (Ro+Ri)/2
    const Ro = solveMin(R => cap(R) - T, 5, 1000, 1e-3), Ri = k * Ro, W = 2 * Math.PI * v.p * Ri * (Ro - Ri);
    const Rf_up = 2 / 3 * (Ro ** 3 - Ri ** 3) / (Ro ** 2 - Ri ** 2);
    return { T, Ro, Ri, W, Rf: (Ro + Ri) / 2, Rf_up, Tup: v.ns * v.mu * W * Rf_up };
  },
  cone(v) {
    const T = v.P * 1e6 / (v.rpm * 2 * Math.PI / 60) * v.Cs, a = v.alpha * deg, Rm = v.Rm;
    const Wn = T / (v.mu * Rm), Wa = Wn * Math.sin(a), b = Wn / (2 * Math.PI * Rm * v.p); // face width
    const jam = Math.tan(a) < v.mu; // self-locking cone: won't release
    return { T, Wn, Wa, b, jam, Wplate: T / (v.mu * Rm) };
  },
  disc(v) { // vehicle disc brake, one stop from v to 0, energy split front fraction
    const vv = v.v0 / 3.6, KE = 0.5 * v.m * vv * vv, Ebrake = KE * v.front / 100 / 2; // per front disc
    const decel = v.dec * 9.81, F = v.m * decel, Twheel = F * v.front / 100 / 2 * v.rw; // N·m per front wheel
    const clamp = Twheel / (2 * v.mu * v.rd / 1000); // two pads
    const dT = Ebrake / (v.md * 460); // steel/iron c ≈ 460 J/kgK, no cooling during stop
    const tStop = vv / decel, Ppeak = Ebrake * 2 / tStop;
    return { KE, Ebrake, F, Twheel, clamp, dT, tStop, Ppeak };
  },
  band(v) {
    const th = v.wrap * deg, ratio = Math.exp(v.mu * th), T = v.T * 1000, r = v.Dd / 2;
    const T2 = T / (r * (ratio - 1)), T1 = T2 * ratio; // T = (T1-T2) r
    const Flever = (v.type === 'Simple (slack end at lever)' ? T2 * v.a : v.type === 'Simple (tight end at lever)' ? T1 * v.a : (T2 * v.a - T1 * v.b)) / v.l;
    return { ratio, T1, T2, Flever, selfLock: Flever <= 0 };
  },
};
MD.register('clutch', {
  group: 'Machine elements', title: 'Clutches & brakes', icon: '🛑', voice: 'clutch brake friction plate cone band disc',
  kid: { what: 'Designs parts that grab and let go using <b>friction</b>: clutches (connect engine to wheels) and brakes (turn motion into heat).', steps: ['Pick a tab.', 'Enter the power or the vehicle speed.', 'Read the size, clamp force and how hot it gets.'], try: 'On the disc-brake tab, double the speed: the brake gets 4× hotter.' },
  eq: [
    { t: 'Plate clutch torque (uniform wear)', f: 'T = n·μ·W·(Ro + Ri)/2,   W = 2π·p·Ri·(Ro − Ri)', fx: [['more friction surfaces n', 'more torque in the same diameter (motorcycle wet multi-plate clutches)'], ['Ri/Ro = 0.577', 'maximum torque for a given outer size']] },
    { t: 'Cone clutch', f: 'T = μ·Wn·Rm,   axial force Wa = Wn·sin α', fx: [['smaller cone angle α', 'much smaller pedal force, but below tan α = μ the cone jams']] },
    { t: 'Brake energy', f: 'E = ½·m·v²,   ΔT = E / (m_disc·c)', fx: [['double speed', 'energy and temperature × 4'], ['heavier disc', 'cooler; vented discs shed heat between stops']] },
    { t: 'Band brake', f: 'T1/T2 = e^{μθ},   T = (T1 − T2)·r', fx: [['more wrap θ', 'grip rises exponentially'], ['tight end on the lever side', 'self-energising, can even self-lock']] },
  ],
  render(main) {
    pageHead(main, 'Machine elements · friction', 'Clutches & brakes',
      'A clutch transmits torque by friction so it can be connected and disconnected smoothly; a brake absorbs energy by friction and turns it into heat. Both are limited by <b>pressure</b> (wear of the lining) and <b>temperature</b> (fade). Their design is really energy and heat design.');
    const body = h('div');
    tabs(main, ['Plate clutch', 'Cone clutch', 'Vehicle disc brake', 'Band brake'], i => { body.innerHTML = ''; [plateTab, coneTab, discTab, bandTab][i](body); });
    main.append(body);
  }
});
function cbLay(body) { const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); body.append(g); const out = h('div'); R.append(h('div', { class: 'card' }, out)); return [L, R, out]; }
function plateTab(body) {
  const [L, R, out] = cbLay(body), c1 = plotCanvas(); R.append(h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  const specs = [{ id: 'P', label: 'Power', unit: 'kW', value: 20, min: 1, max: 300, step: 1 }, { id: 'rpm', label: 'Speed', unit: 'rpm', value: 3000, min: 300, max: 8000, step: 50 },
    { id: 'ns', label: 'Number of friction surfaces', value: 2, min: 1, max: 16, step: 1, tip: 'Single-plate car clutch = 2 surfaces. Motorcycle wet clutch ≈ 10–16.' }, { id: 'mu', label: 'Friction coefficient', value: 0.3, min: 0.05, max: 0.5, step: 0.01 },
    { id: 'p', label: 'Max lining pressure', unit: 'MPa', value: 0.25, min: 0.05, max: 1.5, step: 0.01 }, { id: 'ratio', label: 'Inner/outer radius Ri/Ro', value: 0.6, min: 0.3, max: 0.9, step: 0.01 }, { id: 'Cs', label: 'Service factor', value: 1.3, min: 1, max: 2.5, step: 0.05 }];
  function run(v) {
    const r = CB.plate(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Design torque', fmt(r.T / 1000), 'N·m'), metric('Outer diameter', fmt(2 * r.Ro), 'mm', 'good'), metric('Inner diameter', fmt(2 * r.Ri), 'mm'), metric('Spring (clamp) force', fmt(r.W / 1000), 'kN'), metric('Torque if new (uniform pressure)', fmt(r.Tup / 1000), 'N·m')));
    verdict(out, true, `Friction disc Ø${fmt(2 * r.Ro)} / Ø${fmt(2 * r.Ri)} mm, clamp ${fmt(r.W / 1000)} kN`, 'Design with <b>uniform wear</b> (the worn-in state, conservative). A new clutch carries a little more torque. Adding plates multiplies torque without increasing diameter, which is why motorcycles use wet multi-plate clutches.');
    const ks = linspace(0.2, 0.95, 60), rel = ks.map(k => k * (1 - k) * (1 + k)); const mx = Math.max(...rel);
    plot(c1, { title: 'Torque vs Ri/Ro (fixed outer size): the optimum', xlabel: 'Ri / Ro', ylabel: 'relative torque', series: [{ x: ks, y: rel.map(x => x / mx), fill: true }], vlines: [{ x: 1 / Math.sqrt(3), label: '0.577 optimum', color: '#2f7d32' }, { x: v.ratio }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = CB.plate(vv); return { 'Outer diameter': q.Ro, 'Clamp force': q.W }; }, v, specs);
    explain(`Clutch disc ${fmt(2 * r.Ro)} millimetres outer diameter with ${fmt(r.W / 1000)} kilonewtons clamp force.`);
  }
  const f = buildForm(L, specs, run, 'plate'); run(f.vals);
}
function coneTab(body) {
  const [L, R, out] = cbLay(body);
  const specs = [{ id: 'P', label: 'Power', unit: 'kW', value: 10, min: 1, max: 200, step: 1 }, { id: 'rpm', label: 'Speed', unit: 'rpm', value: 1000, min: 100, max: 5000, step: 10 },
    { id: 'alpha', label: 'Semi-cone angle α', unit: '°', value: 12.5, min: 5, max: 30, step: 0.5, aliases: ['cone angle'] }, { id: 'mu', label: 'Friction coefficient', value: 0.25, min: 0.05, max: 0.5, step: 0.01 },
    { id: 'Rm', label: 'Mean radius', unit: 'mm', value: 120, min: 30, max: 400, step: 1 }, { id: 'p', label: 'Allowable pressure', unit: 'MPa', value: 0.3, min: 0.05, max: 1.5, step: 0.01 }, { id: 'Cs', label: 'Service factor', value: 1.25, min: 1, max: 2.5, step: 0.05 }];
  function run(v) {
    const r = CB.cone(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Torque', fmt(r.T / 1000), 'N·m'), metric('Normal force on cone', fmt(r.Wn / 1000), 'kN'), metric('Axial (spring) force', fmt(r.Wa / 1000), 'kN', 'good'), metric('Face width', fmt(r.b), 'mm'), metric('Plate clutch would need', fmt(r.Wplate / 1000), 'kN'), metric('Jams (won\'t release)?', r.jam ? 'yes' : 'no', '', r.jam ? 'bad' : 'good')));
    verdict(out, !r.jam, `Wedge action: axial force is only ${fmt(Math.sin(v.alpha * deg) * 100)} % of the normal force`, r.jam ? `tan α = ${fmt(Math.tan(v.alpha * deg), 3)} < μ: the cone self-locks and will not release. Increase α.` : 'The cone wedges like a V-belt in a groove, so a small spring gives a large gripping force. Too small an angle and it jams. Used in synchronisers of manual gearboxes.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = CB.cone(vv); return { 'Axial force': q.Wa, 'Face width': q.b }; }, v, specs);
    explain(`Cone clutch needs an axial force of ${fmt(r.Wa / 1000)} kilonewtons and a ${fmt(r.b)} millimetre face.`);
  }
  const f = buildForm(L, specs, run, 'cone'); run(f.vals);
}
function discTab(body) {
  const [L, R, out] = cbLay(body), c1 = plotCanvas(); R.append(h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
  const specs = [{ id: 'm', label: 'Vehicle mass', unit: 'kg', value: 1500, min: 100, max: 40000, step: 10, aliases: ['mass'] }, { id: 'v0', label: 'Speed before braking', unit: 'km/h', value: 100, min: 10, max: 250, step: 1, aliases: ['speed'] },
    { id: 'dec', label: 'Deceleration', unit: 'g', value: 0.8, min: 0.1, max: 1.2, step: 0.05 }, { id: 'front', label: 'Front brake share', unit: '%', value: 70, min: 40, max: 90, step: 1, tip: 'Weight shifts forward when braking, so front brakes do most of the work.' },
    { id: 'rw', label: 'Tyre rolling radius', unit: 'm', value: 0.31, min: 0.2, max: 0.6, step: 0.005 }, { id: 'rd', label: 'Effective disc (pad) radius', unit: 'mm', value: 120, min: 60, max: 250, step: 1 },
    { id: 'mu', label: 'Pad friction μ', value: 0.4, min: 0.2, max: 0.6, step: 0.01 }, { id: 'md', label: 'Disc mass', unit: 'kg', value: 7, min: 1, max: 30, step: 0.5 }];
  function run(v) {
    const r = CB.disc(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Kinetic energy', fmt(r.KE / 1000), 'kJ'), metric('Energy per front disc', fmt(r.Ebrake / 1000), 'kJ'), metric('Stopping time', fmt(r.tStop), 's'), metric('Peak braking power (both front)', fmt(r.Ppeak / 1000), 'kW'),
      metric('Torque per front wheel', fmt(r.Twheel), 'N·m'), metric('Pad clamp force', fmt(r.clamp / 1000), 'kN'), metric('Disc temperature rise (one stop)', fmt(r.dT), '°C', r.dT < 150 ? 'good' : r.dT < 300 ? 'warn' : 'bad')));
    verdict(out, r.dT < 300, `One stop heats each front disc by ≈ ${fmt(r.dT)} °C`, 'A car\'s brakes momentarily absorb far more power than its engine produces. Repeated stops (mountain descent) stack these temperature rises, so pads "fade" (μ drops). Hence vented and larger discs, and heavier vehicles needing retarders.');
    const vs = linspace(20, 200, 40); plot(c1, { title: 'Disc temperature rise vs speed (∝ v²)', xlabel: 'Speed (km/h)', ylabel: 'ΔT per stop (°C)', vlines: [{ x: v.v0 }], series: [{ x: vs, y: vs.map(s => CB.disc(Object.assign({}, v, { v0: s })).dT), fill: true }] });
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = CB.disc(vv); return { 'Temperature rise': q.dT, 'Clamp force': q.clamp }; }, v, specs);
    explain(`Braking from ${v.v0} kilometres per hour heats each front disc by about ${fmt(r.dT)} degrees.`);
  }
  const f = buildForm(L, specs, run, 'disc'); run(f.vals);
}
function bandTab(body) {
  const [L, R, out] = cbLay(body);
  const specs = [{ id: 'T', label: 'Braking torque', unit: 'N·m', value: 300, min: 10, max: 5000, step: 10, aliases: ['torque'] }, { id: 'Dd', label: 'Drum diameter', unit: 'mm', value: 400, min: 100, max: 1500, step: 10 },
    { id: 'wrap', label: 'Wrap angle', unit: '°', value: 240, min: 90, max: 330, step: 5 }, { id: 'mu', label: 'Friction μ', value: 0.3, min: 0.1, max: 0.5, step: 0.01 },
    { id: 'type', label: 'Lever arrangement', type: 'select', options: ['Simple (slack end at lever)', 'Simple (tight end at lever)', 'Differential'], value: 'Simple (slack end at lever)', wide: true },
    { id: 'l', label: 'Lever length l', unit: 'mm', value: 600, min: 100, max: 2000, step: 10 }, { id: 'a', label: 'Arm a (slack end)', unit: 'mm', value: 100, min: 10, max: 400, step: 5 }, { id: 'b', label: 'Arm b (tight end, differential)', unit: 'mm', value: 40, min: 0, max: 300, step: 5 }];
  function run(v) {
    const r = CB.band(v); out.innerHTML = '';
    out.append(h('div', { class: 'metrics' }, metric('Tension ratio e^{μθ}', fmt(r.ratio), ''), metric('Tight-side tension T1', fmt(r.T1 / 1000), 'kN'), metric('Slack-side tension T2', fmt(r.T2 / 1000), 'kN'), metric('Force at lever end', fmt(r.Flever), 'N', r.selfLock ? 'warn' : 'good')));
    verdict(out, !r.selfLock, r.selfLock ? 'Self-locking: the brake applies itself' : `Lever force ${fmt(r.Flever)} N`, 'Friction makes the drum pull the band tighter (T1 > T2). Placing the slack end near the fulcrum uses this "self-energising" effect to reduce the operator\'s effort. A differential band brake can even self-lock, which is useful for back-stops on conveyors, dangerous for a vehicle.');
    $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => ({ 'Lever force': CB.band(vv).Flever }), v, specs);
    explain(`The lever needs ${fmt(r.Flever)} newtons. Tight side tension ${fmt(r.T1 / 1000)} kilonewtons.`);
  }
  const f = buildForm(L, specs, run, 'band'); run(f.vals);
}
