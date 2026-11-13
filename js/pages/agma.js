'use strict';
/* Simplified AGMA 2001-D04 (metric form as in Shigley ch. 14) spur-gear rating */
const AGMA_MATS = {
  'Through-hardened steel, grade 1': { St: hb => 0.533 * hb + 88.3, Sc: hb => 2.22 * hb + 200 },
  'Through-hardened steel, grade 2': { St: hb => 0.703 * hb + 113, Sc: hb => 2.41 * hb + 237 },
  'Carburised & hardened, grade 1 (≈ 58 HRC)': { St: () => 380, Sc: () => 1240 },
  'Carburised & hardened, grade 2 (≈ 58 HRC)': { St: () => 450, Sc: () => 1550 },
};
const AG = {
  J(z) { return interp([[12, 0.21], [15, 0.25], [17, 0.28], [20, 0.32], [25, 0.34], [30, 0.36], [40, 0.39], [50, 0.405], [60, 0.415], [80, 0.43], [150, 0.45], [300, 0.47]], z); },
  calc(v) {
    const z2 = Math.round(v.z1 * v.i), d1 = v.m * v.z1, n1 = v.rpm, V = Math.PI * d1 * n1 / 60000, Wt = v.P * 1000 / V, b = v.F;
    const B = 0.25 * (12 - v.Qv) ** (2 / 3), A = 50 + 56 * (1 - B), Kv = Math.pow((A + Math.sqrt(200 * V)) / A, B);
    const Y = 0.484 - 2.87 / v.z1, Ks = Math.max(1, 0.8433 * Math.pow(v.m * b * Math.sqrt(Y), 0.0535));
    const Cpf = b <= 25 ? b / (10 * d1) - 0.025 : b / (10 * d1) - 0.0375 + 0.000492 * b; // b in mm, approx
    const Cma = { 'Open gearing': 0.247 + 0.0167 * (b / 25.4) - 0.765e-4 * (b / 25.4) ** 2, 'Commercial enclosed': 0.127 + 0.0158 * (b / 25.4) - 0.93e-4 * (b / 25.4) ** 2, 'Precision enclosed': 0.0675 + 0.0128 * (b / 25.4) - 0.926e-4 * (b / 25.4) ** 2 }[v.encl];
    const KH = 1 + 1 * (Math.max(Cpf, 0) * 1 + Cma * 1); // Cmc = 1 (uncrowned), Cpm = 1 (straddle), Ce = 1
    const J1 = AG.J(v.z1), J2 = AG.J(z2), ZE = 191, I = Math.cos(20 * deg) * Math.sin(20 * deg) / 2 * v.i / (v.i + 1);
    const sb1 = Wt * v.Ko * Kv * Ks * KH / (b * v.m * J1), sb2 = Wt * v.Ko * Kv * Ks * KH / (b * v.m * J2);
    const sc = ZE * Math.sqrt(Wt * v.Ko * Kv * Ks * KH / (d1 * b * I));
    const N1 = v.life * 60 * n1, N2 = N1 / v.i;
    const YN = N => N > 3e6 ? 1.3558 * Math.pow(N, -0.0178) : 1.6831 * Math.pow(N, -0.0323);
    const ZN = N => N > 1e7 ? 1.4488 * Math.pow(N, -0.023) : 2.466 * Math.pow(N, -0.056);
    const YZ = interp([[0.5, 0.7], [0.9, 0.85], [0.99, 1], [0.999, 1.25], [0.9999, 1.5]], ENV.rel), Yth = ENV.T <= 120 ? 1 : (273 + ENV.T) / 393;
    const m = AGMA_MATS[v.mat], St = m.St(v.HB), Sc = m.Sc(v.HB);
    const SF1 = St * YN(N1) / (Yth * YZ) / sb1, SF2 = St * YN(N2) / (Yth * YZ) / sb2;
    const SH1 = Sc * ZN(N1) / (Yth * YZ) / sc, SH2 = Sc * ZN(N2) / (Yth * YZ) / sc;
    const lewis = gearCalc({ P: v.P, rpm: v.rpm, i: v.i, z1: v.z1, k: b / v.m, Cs: v.Ko, pmat: Object.keys(GEAR_MATS)[3], gmat: Object.keys(GEAR_MATS)[3], grade: 'Precision hobbed/ground (Cv = 5.6/(5.6+√v))' }, v.m);
    return { z2, d1, V, Wt, Kv, Ks, KH, J1, J2, I, sb1, sb2, sc, N1, N2, YN1: YN(N1), ZN1: ZN(N1), YZ, St, Sc, SF1, SF2, SH1, SH2, lewis };
  },
};
MD.register('agma', {
  group: 'Machine elements', title: 'Gear rating (AGMA 2001)', icon: '📏', voice: 'agma gear rating iso 6336 bending contact stress cycles',
  kid: { what: 'The way <b>industry</b> rates gears (AGMA standard): many correction factors and, importantly, <b>how many hours</b> the gear must run.', steps: ['Enter power, speed, module and face width.', 'Enter required life in hours.', 'Compare bending safety SF with contact safety SH² (they are on the same footing).'], try: 'Change life from 20 000 h to 2 000 h: the allowed stress rises, so the same gear is "stronger" for a short life.' },
  eq: [
    { t: 'AGMA bending stress', f: 'σ = Wt·Ko·Kv·Ks · (1 / (b·m)) · (KH·KB / YJ)', s: [['Ko', 'overload'], ['Kv', 'dynamic (quality Qv)'], ['Ks', 'size'], ['KH', 'load distribution'], ['YJ', 'geometry factor (≈ Lewis Y with stress concentration)']], fx: [['better quality Qv', 'Kv falls: smoother teeth, less impact'], ['wider face b', 'stress falls, but KH (misalignment) rises']] },
    { t: 'AGMA contact stress', f: 'σc = ZE·√( Wt·Ko·Kv·Ks·KH·ZR / (d1·b·ZI) )', fx: [['double the load', 'contact stress × 1.41 (square root)']] },
    { t: 'Safety factors', f: 'SF = (St·YN / (Yθ·YZ)) / σ,   SH = (Sc·ZN / (Yθ·YZ)) / σc', m: 'Compare SF with SH², since contact stress varies with √load. The smaller one governs.', fx: [['longer life (more cycles N)', 'YN and ZN fall: allowable stress drops'], ['higher reliability', 'YZ rises: less allowable']] },
    { t: 'Stress-cycle factors', f: 'YN = 1.3558·N^−0.0178,   ZN = 1.4488·N^−0.023   (N > 10⁷)' },
  ],
  render(main) {
    pageHead(main, 'Machine elements · standards', 'Gear rating to AGMA 2001 (simplified)',
      'The Lewis/Buckingham method on the Spur gear page is the classic textbook approach. Industry rates gears with <b>AGMA 2001</b> (USA) or <b>ISO 6336</b> (Europe/India), which add measured factors for quality, size, load distribution and, crucially, <b>life in cycles and reliability</b>. A gear that lasts 2 000 h may fail at 20 000 h. This page implements the AGMA metric form (as in Shigley) with chart values approximated by curve fits.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div'); g.append(L, R); main.append(g);
    const specs = [
      { id: 'P', label: 'Power', unit: 'kW', value: 15, min: 0.5, max: 500, step: 0.5, aliases: ['power'] }, { id: 'rpm', label: 'Pinion speed', unit: 'rpm', value: 1450, min: 50, max: 6000, step: 10 },
      { id: 'i', label: 'Ratio', value: 3, min: 1, max: 8, step: 0.05 }, { id: 'z1', label: 'Pinion teeth', value: 20, min: 12, max: 60, step: 1 }, { id: 'm', label: 'Module', unit: 'mm', value: 4, min: 1, max: 12, step: 0.25, aliases: ['module'] },
      { id: 'F', label: 'Face width', unit: 'mm', value: 45, min: 10, max: 200, step: 1, aliases: ['face width'] }, { id: 'Qv', label: 'Transmission accuracy Qv (5 = rough, 11 = ground)', value: 8, min: 5, max: 11, step: 1 },
      { id: 'Ko', label: 'Overload factor Ko', value: 1.25, min: 1, max: 2.25, step: 0.05 }, { id: 'encl', label: 'Mounting', type: 'select', options: ['Open gearing', 'Commercial enclosed', 'Precision enclosed'], value: 'Commercial enclosed' },
      { id: 'mat', label: 'Material', type: 'select', options: Object.keys(AGMA_MATS), value: 'Through-hardened steel, grade 1', wide: true }, { id: 'HB', label: 'Hardness (through-hardened)', unit: 'HB', value: 300, min: 150, max: 450, step: 5 },
      { id: 'life', label: 'Required life', unit: 'hours', value: 20000, min: 100, max: 100000, step: 100, aliases: ['life'] },
    ];
    const out = h('div'), c1 = plotCanvas(); R.append(h('div', { class: 'card' }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, c1));
    function run(v) {
      const r = AG.calc(v); out.innerHTML = '';
      const govB = Math.min(r.SF1, r.SF2), govC = Math.min(r.SH1, r.SH2);
      out.append(h('div', { class: 'metrics' }, metric('Tangential load Wt', fmt(r.Wt), 'N'), metric('Pitch-line speed', fmt(r.V), 'm/s'), metric('Kv · Ks · KH', `${fmt(r.Kv, 3)} · ${fmt(r.Ks, 3)} · ${fmt(r.KH, 3)}`, ''), metric('Geometry YJ (pinion / gear)', `${fmt(r.J1, 3)} / ${fmt(r.J2, 3)}`, ''),
        metric('Bending stress (pinion)', fmt(r.sb1), 'MPa'), metric('Contact stress', fmt(r.sc), 'MPa'), metric('Pinion cycles', fmt(r.N1), ''), metric(`YN · ZN at ${fmt(r.N1)} cycles`, `${fmt(r.YN1, 3)} · ${fmt(r.ZN1, 3)}`, ''),
        metric('Bending SF (min)', fmt(govB), '', fsStatus(govB, 1.3)), metric('Contact SH (min)', fmt(govC), '', fsStatus(govC, 1.15)), metric('SH² (compare with SF)', fmt(govC * govC), '')));
      const wear = govC * govC < govB;
      verdict(out, govB >= 1.3 && govC >= 1.15, `${wear ? 'Pitting (contact)' : 'Bending'} governs: SF = ${fmt(govB)}, SH² = ${fmt(govC * govC)}`, `Lewis/Buckingham on the same gear gives bending FS ${fmt(r.lewis.nb)} and wear FS ${fmt(r.lewis.nw)}: the textbook method ignores life, so it can be far too cautious for a short-life gear or not cautious enough for a 24/7 one. ${wear ? 'Harder surfaces (carburising) are the usual cure for pitting.' : 'A larger module, wider face or more teeth helps bending.'}`);
      const lifes = [100, 300, 1000, 3000, 10000, 30000, 100000], sf = lifes.map(L => AG.calc(Object.assign({}, v, { life: L })));
      plot(c1, { title: 'Same gear, different required life', xlabel: 'Life (hours)', ylabel: 'Safety factor', logx: true, legend: 'tr', vlines: [{ x: v.life }], hlines: [{ y: 1, label: '1.0' }], series: [{ label: 'Bending SF', x: lifes, y: sf.map(q => Math.min(q.SF1, q.SF2)) }, { label: 'Contact SH²', x: lifes, y: sf.map(q => Math.min(q.SH1, q.SH2) ** 2) }] });
      $$('.effect', R).forEach(e => e.remove()); effectTable(R, vv => { const q = AG.calc(vv); return { 'Bending SF': Math.min(q.SF1, q.SF2), 'Contact SH': Math.min(q.SH1, q.SH2) }; }, v, specs);
      out.append(h('div', { class: 'small' }, 'Simplifications: YJ from a curve fit of the AGMA chart (mating with ~75 teeth), KH from the empirical Cpf/Cma formulas with Cmc = Cpm = Ce = 1, ZR = ZW = KB = 1. Use the full standard (or ISO 6336 software) for certified ratings.'));
      explain(`AGMA rating: bending safety factor ${fmt(govB)}, contact safety factor ${fmt(govC)}. ${wear ? 'Pitting governs.' : 'Bending governs.'}`);
    }
    const f = buildForm(L, specs, run, 'agma'); run(f.vals);
  }
});
