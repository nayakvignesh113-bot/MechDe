'use strict';
const CELLS = { '2170 cylindrical (≈3.6 V, 5.0 Ah, 70 g)': { V: 3.6, Ah: 5.0, g: 70, Cmax: 4 }, '4680 cylindrical (≈3.6 V, 23 Ah, 355 g)': { V: 3.6, Ah: 23, g: 355, Cmax: 3 }, 'LFP prismatic (≈3.2 V, 100 Ah, 2 kg)': { V: 3.2, Ah: 100, g: 2000, Cmax: 2 } };
const EV_PRESETS = {
  'Model 3-like dual-motor sedan (approx. public figures)': { m: 1850, Cd: 0.23, A: 2.22, Crr: 0.011, r: 0.334, G: 9, Tm: 600, Pm: 300, nmax: 18000, kWh: 78, drive: 'AWD', aux: 300, Vpack: 345 },
  'City hatchback EV (generic)': { m: 1350, Cd: 0.30, A: 2.2, Crr: 0.010, r: 0.30, G: 8, Tm: 250, Pm: 100, nmax: 12000, kWh: 40, drive: 'FWD/RWD', aux: 300, Vpack: 350 },
  'Electric scooter, hub motor (generic)': { m: 190, Cd: 0.7, A: 0.75, Crr: 0.012, r: 0.22, G: 1, Tm: 140, Pm: 5, nmax: 1100, kWh: 3, drive: 'FWD/RWD', aux: 30, Vpack: 60, vc: 50 },
};
const EVC = {
  calc(v) {
    const g = 9.81, rho = 1.2, eta = v.eta, mEff = v.m * 1.05;
    const road = u => v.m * g * v.Crr + 0.5 * rho * v.Cd * v.A * u * u;
    const vMot = v.nmax * 2 * Math.PI / 60 / v.G * v.r; // m/s at max motor speed
    const mu = 1.0, tracLim = mu * v.m * g * (v.drive === 'AWD' ? 1 : 0.5);
    const Ftr = u => Math.min(v.Tm * v.G * eta / v.r, u > 0.1 ? v.Pm * 1000 * eta / u : Infinity, tracLim) * (u <= vMot ? 1 : 0);
    let vTopP = solveMin(u => road(u) * u - v.Pm * 1000 * eta, 1, 150, 1e-3); if (!isFinite(vTopP)) vTopP = 150;
    const vTop = Math.min(vTopP, vMot);
    // 0–100 time
    let u = 0, t = 0; const target = 100 / 3.6; let ok = true;
    while (u < target) { const a = (Ftr(u) - road(u)) / mEff; if (a <= 0.01) { ok = false; break; } u += a * 0.01; t += 0.01; if (t > 120) { ok = false; break; } }
    const cons = s => { const uu = s / 3.6; return (road(uu) * uu / eta + v.aux) / uu / 3.6; }; // Wh/km
    const whCruise = cons(v.vc), range = v.kWh * 1000 / whCruise;
    const cell = CELLS[v.cell], s = Math.round(v.Vpack / cell.V), Vp = s * cell.V, p = Math.ceil(v.kWh * 1000 / (Vp * cell.Ah)), n = s * p;
    const packKWh = n * cell.V * cell.Ah / 1000, mCells = n * cell.g / 1000, I = v.Pm * 1000 / (Vp * 0.95), C = I / (p * cell.Ah);
    return { vTop: vTop * 3.6, limit: vTopP < vMot ? 'power / drag' : 'motor max rpm', t100: ok ? t : Infinity, whCruise, range, s, p, n, Vp, packKWh, mCells, I, C, Cmax: cell.Cmax, Fstart: Ftr(0.5), tracLim, road, Ftr, vMot, cons };
  },
};
MD.register('ev', {
  group: 'Products', title: 'EV & Tesla-style design', icon: '⚡', voice: 'electric vehicle ev tesla battery range motor',
  kid: { what: 'Design an <b>electric car or scooter</b>: how far it goes on one charge, how fast it accelerates, and how many battery cells it needs.', steps: ['Pick a preset (car, Tesla-like sedan, or scooter).', 'Change the speed you cruise at and watch the range.', 'Look at the battery: how many cells in series and parallel.'], try: 'Cruise at 130 km/h instead of 90: the range drops by about a third, because air drag grows with speed².' },
  eq: [
    { t: 'Road load', f: 'F = m·g·Crr + ½·ρ·Cd·A·v²', fx: [['double speed', 'drag force × 4, drag power × 8'], ['lower Cd (smooth shape)', 'less energy at highway speed, which is why EVs look slippery']] },
    { t: 'Energy use & range', f: 'Wh/km = (F·v / η + P_aux) / v,   range = battery kWh / (Wh/km)', fx: [['heavier car', 'more rolling resistance and more energy to accelerate in city driving'], ['heater / AC (P_aux)', 'matters most at low speed']] },
    { t: 'Tractive force (single gear)', f: 'F = min( T·G·η / r ,  P·η / v ,  μ·m_driven·g )', m: 'Electric motors give full torque from zero speed and run to very high rpm, so one fixed ratio covers everything a petrol car needs 6+ gears for.', fx: [['higher ratio G', 'quicker launch, lower top speed']] },
    { t: 'Battery pack', f: 'V = s·V_cell,   capacity = s·p·V_cell·Ah_cell,   C-rate = I / (p·Ah)', fx: [['more cells in parallel', 'each cell works less hard (lower C-rate), cooler and longer-lived']] },
  ],
  render(main) {
    pageHead(main, 'Products · system design', 'Designing an electric vehicle (and what Tesla changed)',
      'An EV is designed backwards from <b>range</b> and <b>performance</b>. Range is set by energy per km, which is dominated by aerodynamic drag at highway speed and by mass in town. Performance is set by motor torque, power, gear ratio and tyre grip. The battery is then sized in cells-in-series (voltage) × cells-in-parallel (capacity and current).');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const pres = h('select', { class: 'inp', style: { marginBottom: '8px' } }, h('option', { value: '' }, 'Load a preset…'), Object.keys(EV_PRESETS).map(k => h('option', { value: k }, k)));
    L.append(pres);
    const specs = [
      { section: 'Vehicle' },
      { id: 'm', label: 'Mass with driver', unit: 'kg', value: 1850, min: 100, max: 3500, step: 10, aliases: ['mass'] }, { id: 'Cd', label: 'Drag coefficient Cd', value: 0.23, min: 0.18, max: 1, step: 0.005, tip: 'How slippery the shape is. Model 3 ≈ 0.23, a typical SUV ≈ 0.35, a scooter with rider ≈ 0.7.' },
      { id: 'A', label: 'Frontal area', unit: 'm²', value: 2.22, min: 0.5, max: 3.5, step: 0.01 }, { id: 'Crr', label: 'Rolling resistance Crr', value: 0.011, min: 0.006, max: 0.02, step: 0.0005 },
      { id: 'r', label: 'Tyre rolling radius', unit: 'm', value: 0.334, min: 0.15, max: 0.45, step: 0.001 }, { id: 'drive', label: 'Driven wheels', type: 'select', options: ['AWD', 'FWD/RWD'], value: 'AWD' },
      { section: 'Motor & gear' },
      { id: 'Tm', label: 'Peak motor torque (total)', unit: 'N·m', value: 600, min: 10, max: 1500, step: 5, aliases: ['torque'] }, { id: 'Pm', label: 'Peak power', unit: 'kW', value: 300, min: 1, max: 800, step: 1, aliases: ['power'] },
      { id: 'nmax', label: 'Max motor speed', unit: 'rpm', value: 18000, min: 500, max: 25000, step: 100 }, { id: 'G', label: 'Single-speed reduction ratio', value: 9, min: 1, max: 15, step: 0.05, aliases: ['gear ratio', 'ratio'] },
      { id: 'eta', label: 'Battery-to-wheel efficiency', value: 0.88, min: 0.7, max: 0.95, step: 0.01 },
      { section: 'Use & battery' },
      { id: 'vc', label: 'Cruise speed', unit: 'km/h', value: 100, min: 20, max: 160, step: 1, aliases: ['cruise speed', 'speed'] }, { id: 'aux', label: 'Auxiliary power (AC, electronics)', unit: 'W', value: 300, min: 0, max: 5000, step: 50 },
      { id: 'kWh', label: 'Usable battery energy', unit: 'kWh', value: 78, min: 1, max: 150, step: 0.5, aliases: ['battery'] }, { id: 'Vpack', label: 'Target pack voltage', unit: 'V', value: 345, min: 48, max: 900, step: 1 },
      { id: 'cell', label: 'Cell type', type: 'select', options: Object.keys(CELLS), value: Object.keys(CELLS)[0], wide: true },
    ];
    const out = h('div'), c1 = plotCanvas(), c2 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'grid3', style: { marginTop: '12px' } }, h('div', { class: 'card' }, c1), h('div', { class: 'card' }, c2)));
    const f = buildForm(L, specs, run, 'ev');
    pres.onchange = () => { const p = EV_PRESETS[pres.value]; if (!p) return; Object.entries(p).forEach(([k, x]) => MD.fields[k] && MD.fields[k].set(x)); pres.value = ''; };
    function run(v) {
      const r = EVC.calc(v); out.innerHTML = '';
      out.append(h('div', { class: 'metrics' }, metric(`Range at ${v.vc} km/h`, fmt(r.range), 'km', 'good'), metric('Energy use', fmt(r.whCruise), 'Wh/km'), metric('0–100 km/h', isFinite(r.t100) ? fmt(r.t100) : 'not reached', isFinite(r.t100) ? 's' : ''), metric('Top speed', fmt(r.vTop), 'km/h'), metric('Top speed limited by', r.limit, ''),
        metric('Launch force at wheels', fmt(r.Fstart / 1000), 'kN'), metric('Pack: series × parallel', `${r.s}s × ${r.p}p`, ''), metric('Total cells', r.n, ''), metric('Pack voltage / energy', `${fmt(r.Vp)} V / ${fmt(r.packKWh)} kWh`, ''), metric('Cell mass alone', fmt(r.mCells), 'kg'), metric('Peak cell C-rate', fmt(r.C), 'C', r.C <= r.Cmax ? 'good' : 'bad')));
      const speeds = linspace(20, 160, 50);
      verdict(out, r.C <= r.Cmax, `${fmt(r.range)} km at ${v.vc} km/h${isFinite(r.t100) ? `; ${fmt(r.t100)} s to 100 km/h` : ''}`, `At ${v.vc} km/h, aerodynamic drag uses ${fmt(100 * 0.6 * v.Cd * v.A * (v.vc / 3.6) ** 2 / r.road(v.vc / 3.6))} % of the road force. ${r.C > r.Cmax ? 'Cells are pushed beyond their current rating at full power: add cells in parallel or limit power.' : 'Battery current is within the cells\' rating.'} One gear is enough because the motor makes full torque from standstill and spins to ${v.nmax} rpm.`);
      plot(c1, { title: 'Range vs cruise speed', xlabel: 'Speed (km/h)', ylabel: 'Range (km)', vlines: [{ x: v.vc }], series: [{ x: speeds, y: speeds.map(s => v.kWh * 1000 / r.cons(s)), fill: true }] });
      const us = linspace(0, Math.max(r.vTop, 30) * 1.1, 80);
      plot(c2, { title: 'Single-gear tractive force vs road load', xlabel: 'Speed (km/h)', ylabel: 'Force (N)', ymin: 0, legend: 'tr', series: [{ label: 'Motor force at wheels', x: us, y: us.map(s => r.Ftr(s / 3.6)) }, { label: 'Road load (flat)', x: us, y: us.map(s => r.road(s / 3.6)), dash: [5, 3], color: '#1b2430' }], hlines: [{ y: r.tracLim, label: 'tyre grip limit', color: '#94a3b8' }] });
      $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = EVC.calc(vv); return { 'Range': q.range, '0–100 time': isFinite(q.t100) ? q.t100 : NaN, 'Top speed': q.vTop }; }, v, specs, { skip: ['Vpack'] });
      explain(`Range ${fmt(r.range)} kilometres at ${v.vc} kilometres per hour, zero to 100 in ${fmt(r.t100)} seconds, battery of ${r.n} cells arranged ${r.s} in series and ${r.p} in parallel.`);
    }
    run(f.vals);
    main.append(h('h2', null, 'What Tesla changed in how cars are built'), h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>Slippery shape</h3><p class="small">The Model 3 was reported at Cd ≈ 0.23 (0.219 after the 2023 refresh). At highway speed drag is the biggest energy user, so every 0.01 of Cd is a few percent of range. <b>Trade-off:</b> long, low, smooth bodies limit headroom and styling.</p>' }),
      h('div', { class: 'card', html: '<h3>One fixed gear (9:1)</h3><p class="small">The owner\'s manual lists a single-speed fixed gear of 9:1. A motor that spins to very high rpm with flat torque from zero makes a multi-speed gearbox unnecessary: fewer parts, no shift shock. <b>Trade-off:</b> the motor must be efficient over a very wide speed range.</p>' }),
      h('div', { class: 'card', html: '<h3>Many small cells</h3><p class="small">The long-range Model 3 pack was reported to use 4,416 cylindrical 2170 cells (21 mm × 70 mm) arranged as 96 groups in series. Small cells are cheap, mass-produced and cool well. <b>Trade-off:</b> thousands of connections to make and monitor.</p>' }),
      h('div', { class: 'card', html: '<h3>Structural battery pack</h3><p class="small">For the Model Y with larger 4680 cells (46 mm × 80 mm), the pack itself became the car\'s floor, with seats mounted on it, like aircraft wings that double as fuel tanks. Fewer parts and less mass. <b>Trade-off:</b> the pack is hard to repair or replace.</p>' }),
      h('div', { class: 'card', html: '<h3>Single-piece "mega" castings</h3><p class="small">Large front and rear underbody sections are die-cast in one piece of aluminium instead of welding dozens of stamped parts. Faster assembly, fewer joints. <b>Trade-off:</b> a damaged casting is expensive to repair, and huge casting machines are a big investment.</p>' }),
      h('div', { class: 'card', html: '<h3>The designer\'s lesson</h3><p class="small">None of these is "free". Each moved a cost from one place (parts, assembly time, energy) to another (repairability, tooling, motor design). That is design: choosing which compromise serves the product best.</p>' })));
    main.append(h('p', { class: 'small' }, 'Vehicle figures in the preset and the cards are approximate values from public specifications, owner\'s manuals and teardown reports; they are for learning, not for engineering use. Cell figures are representative, not a specific supplier\'s datasheet.'));
  }
});
