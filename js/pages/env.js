'use strict';
MD.register('environment', {
  group: 'Start', title: 'Operating environment', icon: '🌡', voice: 'environment temperature corrosion',
  render(main) {
    pageHead(main, 'Global settings', 'Operating environment',
      'Textbook problems happen at 20 °C in clean dry air with 50 % reliability. Real parts don\'t. These settings apply to <b>every</b> module: strengths and moduli are derated for temperature, fatigue strength for medium and reliability, and section thickness for corrosion over the design life.');
    const g = h('div', { class: 'grid2' }), L = h('div', { class: 'card' }), R = h('div');
    g.append(L, R); main.append(g);
    const specs = [
      { id: 'T', label: 'Operating temperature', unit: '°C', value: ENV.T, min: -60, max: 600, step: 1, aliases: ['temperature'] },
      { id: 'Tinstall', label: 'Installation / stress-free temperature', unit: '°C', value: ENV.Tinstall, min: -20, max: 50, step: 1 },
      { id: 'medium', label: 'Medium', type: 'select', options: MEDIA, value: ENV.medium, aliases: ['environment', 'medium'] },
      { id: 'rel', label: 'Reliability (fatigue)', type: 'select', options: Object.keys(RELIAB), labels: { '0.5': '50 %', '0.9': '90 %', '0.95': '95 %', '0.99': '99 %', '0.999': '99.9 %', '0.9999': '99.99 %' }, value: String(ENV.rel), aliases: ['reliability'] },
      { id: 'life', label: 'Design life', unit: 'years', value: ENV.life, min: 1, max: 100, step: 1, aliases: ['life'] },
      { id: 'wind', label: 'Basic wind speed (structures)', unit: 'm/s', value: ENV.wind, min: 0, max: 60, step: 1, aliases: ['wind'] },
    ];
    L.append(h('div', { class: 'panel-title' }, 'Environment'));
    buildForm(L, specs, (v) => { Object.assign(ENV, { T: v.T, Tinstall: v.Tinstall, medium: v.medium, rel: +v.rel, life: v.life, wind: v.wind }); MD.envChanged(); draw(); });
    const c1 = plotCanvas(), c2 = plotCanvas(), out = h('div');
    R.append(h('div', { class: 'card' }, h('div', { class: 'panel-title' }, 'Strength retention vs temperature'), c1, h('div', { class: 'panel-title', style: { marginTop: '12px' } }, 'Elastic modulus retention vs temperature'), c2), out);
    const classes = [['steel', 'Steel (Shigley Sut ratio)'], ['aluminium', 'Al alloys (age-hardened)'], ['titanium', 'Ti-6Al-4V'], ['castiron', 'Grey cast iron']];
    function draw() {
      const Ts = linspace(20, 600, 120);
      plot(c1, { xlabel: 'Temperature (°C)', ylabel: 'S(T)/S(20 °C)', ymin: 0, ymax: 1.1, legend: 'bl', vlines: [{ x: Math.max(20, ENV.T), label: 'operating' }], series: classes.map(([c, l]) => ({ label: l, x: Ts, y: Ts.map(t => strengthTempFactor({ cls: c }, t)) })) });
      plot(c2, { xlabel: 'Temperature (°C)', ylabel: 'E(T)/E(20 °C)', ymin: 0.4, ymax: 1.05, legend: 'bl', vlines: [{ x: Math.max(20, ENV.T), label: 'operating' }], series: classes.map(([c, l]) => ({ label: l, x: Ts, y: Ts.map(t => modulusTempFactor({ cls: c }, t)) })) });
      out.innerHTML = '';
      const card = h('div', { class: 'card', style: { marginTop: '14px' } });
      card.append(h('div', { class: 'panel-title' }, `What this environment does to each material (T = ${ENV.T} °C, ${ENV.medium}, ${ENV.life} yr)`));
      const tb = h('table', { class: 't' }, h('tr', null, ...['Material', 'Sy (MPa)', 'Sy at T', 'E at T (GPa)', 'k_env fatigue', 'Corrosion loss/face (mm)'].map(x => h('th', null, x))));
      MAT_NAMES.forEach(n => { const m = matAt(n); tb.append(h('tr', null, h('td', null, n), h('td', null, fmt(m.Sy0)), h('td', null, fmt(m.Sy)), h('td', null, fmt(m.E / 1000)), h('td', null, fmt(m.kenv, 2)), h('td', null, fmt(m.corr * ENV.life, 2)))); });
      card.append(h('div', { class: 'tablewrap' }, tb));
      const ws = new Set(); MAT_NAMES.forEach(n => envWarnings(matAt(n)).forEach(w => ws.add(w)));
      ws.forEach(w => card.append(h('div', { class: 'warnbox' }, '⚠ ' + w)));
      card.append(h('div', { class: 'note', html: `<b>Reliability factor k<sub>e</sub> = ${RELIAB[ENV.rel]}</b>: endurance data are mean values (50 %). For ${ENV.rel * 100} % survival the endurance strength is reduced by ${fmt((1 - RELIAB[ENV.rel]) * 100, 2)} % (8 % standard deviation assumed).` }));
      out.append(card);
      explain(`At ${ENV.T} degrees in ${ENV.medium}, structural steel keeps about ${Math.round(strengthTempFactor({ cls: 'steel' }, ENV.T) * 100)} percent of its strength and aluminium about ${Math.round(strengthTempFactor({ cls: 'aluminium' }, ENV.T) * 100)} percent.`);
    }
    draw(); MD.onEnv = draw;
  }
});
