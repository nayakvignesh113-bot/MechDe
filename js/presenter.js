'use strict';
/* Talking presenter: original cartoon engineer with lip movement, purposeful gestures and highlighting.
   Speaks only when the student presses ▶ (browsers also require a tap before audio). */
const Presenter = (() => {
  const CHAR = {
    'Dr. Vignesh': { skin: '#9b6440', hair: '#17110d', shirt: '#a7a1e3', trousers: '#c9bfa3', vest: null, hat: false, style: 'prof', sex: 'm', pitch: 0.72, rateK: 0.9, long: false },
    Asha: { skin: '#b9784f', hair: '#2b1a12', shirt: '#2f6f9f', vest: '#f08c2e', hat: '#ffd23f', sex: 'f', pitch: 1.1, rateK: 1, long: true },
    Arjun: { skin: '#a8693f', hair: '#1d130c', shirt: '#3c6b3a', vest: '#f08c2e', hat: '#ffd23f', sex: 'm', pitch: 0.85, rateK: 0.95, long: false },
  };
  let cfg = Object.assign({ on: true, who: 'Dr. Vignesh', rate: 1, min: window.innerWidth < 700 }, store('presenter') || {});
  if (cfg.ver !== 2) { cfg.ver = 2; cfg.who = 'Dr. Vignesh'; cfg.deep = true; cfg.voiceName = null; cfg.pitchUser = null; cfg.rateUser = null; }
  if (cfg.deep == null) cfg.deep = true;
  if (cfg.ver !== 3) { cfg.ver = 3; cfg.narr = 'michael'; cfg.studio = false; }
  if (!cfg.narr) cfg.narr = 'michael';
  const sayName = () => cfg.who.replace(/^Dr\.\s*/, 'Doctor ');
  const save = () => store('presenter', cfg);
  let root, svg, bubble, parts = {}, gesture = 'idle', gT = 0, speaking = false, lastBoundary = 0, viseme = 'closed', queue = [], qi = 0, script = [], blinkT = 2, hl = null;
  const NS = 'http://www.w3.org/2000/svg', E = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  // pose table: [A shoulder, A forearm, B shoulder, B forearm] in degrees from straight down; positive = outward
  const POSE = { idle: [8, 4, 8, 4], wave: [8, 4, 150, 160], point: [92, 96, 10, 6], explain: [42, 95, 42, 95], think: [8, 4, -12, -150], thumbs: [8, 4, 62, 172], warn: [55, 150, 55, 150], greet: [8, 4, 120, 165] };
  let cur = POSE.idle.slice();
  function build() {
    root = h('div', { id: 'presenter', class: cfg.min ? 'min' : '' });
    svg = E('svg', { viewBox: '-20 0 160 160', width: 150, height: 150, 'aria-hidden': 'true' });
    const c = CHAR[cfg.who];
    // body
    if (c.style === 'prof') {
      svg.append(E('rect', { x: 32, y: 150, width: 56, height: 12, fill: c.trousers }));
      svg.append(E('path', { d: 'M24,152 L28,104 Q60,88 92,104 L96,152 Z', fill: c.shirt }));
      svg.append(E('rect', { x: 26, y: 147, width: 68, height: 5, rx: 2, fill: '#3b3326' }));
      svg.append(E('line', { x1: 60, y1: 96, x2: 60, y2: 147, stroke: '#8f88cf', 'stroke-width': 1.4 }));
      [108, 120, 132, 143].forEach(y => svg.append(E('circle', { cx: 62.5, cy: y, r: 1.3, fill: '#7a73bd' })));
      svg.append(E('rect', { x: 53, y: 80, width: 14, height: 15, rx: 4, fill: c.skin }));
      svg.append(E('path', { d: 'M48,94 L60,104 L54,108 Z M72,94 L60,104 L66,108 Z', fill: '#bdb8ee', stroke: '#8f88cf', 'stroke-width': 0.8 }));
    } else {
      svg.append(E('path', { d: 'M28,160 L32,104 Q60,90 88,104 L92,160 Z', fill: c.shirt }));
      svg.append(E('path', { d: 'M36,160 L40,106 L52,100 L60,126 L68,100 L80,106 L84,160 Z', fill: c.vest }));
      svg.append(E('rect', { x: 41, y: 128, width: 38, height: 4, fill: '#e8e8e8', opacity: 0.85 }));
      svg.append(E('rect', { x: 54, y: 78, width: 12, height: 16, rx: 4, fill: c.skin }));
    }
    // arms (lines updated each frame)
    ['A', 'B'].forEach(s => { parts['up' + s] = E('line', { stroke: c.style === 'prof' ? c.skin : c.shirt, 'stroke-width': c.style === 'prof' ? 11 : 10, 'stroke-linecap': 'round' }); parts['lo' + s] = E('line', { stroke: c.skin, 'stroke-width': 8, 'stroke-linecap': 'round' }); parts['hand' + s] = E('circle', { r: 5.5, fill: c.skin }); svg.append(parts['up' + s], parts['lo' + s], parts['hand' + s]); });
    parts.thumb = E('line', { stroke: c.skin, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0 }); svg.append(parts.thumb);
    // head group
    const hd = E('g', {}); parts.head = hd;
    if (c.long) hd.append(E('path', { d: 'M34,46 Q32,86 46,84 L74,84 Q88,86 86,46 Z', fill: c.hair }));
    if (c.style === 'prof') {
      hd.append(E('ellipse', { cx: 60, cy: 55, rx: 25, ry: 28, fill: c.skin }));
      hd.append(E('ellipse', { cx: 35, cy: 57, rx: 4, ry: 6.5, fill: c.skin })); hd.append(E('ellipse', { cx: 85, cy: 57, rx: 4, ry: 6.5, fill: c.skin }));
      // short, receding hair: sides and a thin crown
      hd.append(E('path', { d: 'M35,50 Q34,32 46,25 Q60,19 74,25 Q86,32 85,50 L82,50 Q82,36 74,31 Q66,28 60,30 Q54,28 46,31 Q38,36 38,50 Z', fill: c.hair }));
      hd.append(E('path', { d: 'M48,27 Q60,22 72,27 Q66,25 60,25.5 Q54,25 48,27 Z', fill: c.hair, opacity: 0.7 }));
      hd.append(E('path', { d: 'M42,66 Q60,86 78,66 Q74,80 60,83 Q46,80 42,66 Z', fill: '#2a1d14', opacity: 0.18 }));
    } else {
      hd.append(E('ellipse', { cx: 60, cy: 54, rx: 23, ry: 26, fill: c.skin }));
      hd.append(E('ellipse', { cx: 37, cy: 56, rx: 4, ry: 6, fill: c.skin })); hd.append(E('ellipse', { cx: 83, cy: 56, rx: 4, ry: 6, fill: c.skin }));
      hd.append(E('path', { d: 'M38,44 Q42,28 60,28 Q78,28 82,44 Q72,36 60,38 Q48,36 38,44 Z', fill: c.hair }));
      hd.append(E('path', { d: 'M34,36 Q36,14 60,13 Q84,14 86,36 Z', fill: c.hat })); hd.append(E('rect', { x: 30, y: 34, width: 60, height: 5, rx: 2.5, fill: c.hat })); hd.append(E('rect', { x: 57, y: 14, width: 6, height: 20, rx: 2, fill: '#f2b705' }));
    }
    // eyes, brows
    parts.eyeL = E('ellipse', { cx: 51, cy: 53, rx: 3, ry: 3.6, fill: '#1b1b1b' }); parts.eyeR = E('ellipse', { cx: 69, cy: 53, rx: 3, ry: 3.6, fill: '#1b1b1b' });
    parts.browL = E('path', { d: 'M46,46 Q51,43 56,46', stroke: c.hair, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' }); parts.browR = E('path', { d: 'M64,46 Q69,43 74,46', stroke: c.hair, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' });
    hd.append(parts.eyeL, parts.eyeR, parts.browL, parts.browR);
    hd.append(E('path', { d: 'M59,56 Q57,62 61,62', stroke: '#7a4a2e', 'stroke-width': 1.4, fill: 'none' }));
    parts.mouth = E('ellipse', { cx: 60, cy: 69, rx: 5, ry: 1.2, fill: '#5a1f1f' }); parts.smile = E('path', { d: 'M53,68 Q60,73 67,68', stroke: '#5a1f1f', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' });
    parts.teeth = E('rect', { x: 56, y: 66.5, width: 8, height: 2, rx: 1, fill: '#fff', opacity: 0 });
    hd.append(parts.mouth, parts.teeth, parts.smile);
    svg.append(hd);
    bubble = h('div', { class: 'p-bubble' });
    const ctr = h('div', { class: 'p-ctrl' },
      h('button', { title: 'Explain this page', onclick: () => play() }, '▶'), h('button', { title: 'Stop', onclick: () => stop() }, '■'),
      h('button', { title: 'Switch presenter (Dr. Vignesh / Asha / Arjun)', onclick: () => { const ks = Object.keys(CHAR); cfg.who = ks[(ks.indexOf(cfg.who) + 1) % ks.length]; cfg.voiceName = null; cfg.pitchUser = null; cfg.rateUser = null; save(); rebuild(); } }, '⇄'),

      h('button', { title: 'Minimise', onclick: () => { cfg.min = !cfg.min; save(); root.classList.toggle('min', cfg.min); } }, '–'),
      h('button', { title: 'Hide presenter (turn back on from the top bar 👩‍🏫)', onclick: () => { cfg.on = false; save(); stop(); root.remove(); document.body.classList.remove('has-presenter'); toast('Presenter hidden. Tap 👩‍🏫 in the top bar to bring it back.'); } }, '✕'));
    const fig = h('div', { class: 'p-fig', title: 'Tap to hear this page explained', onclick: () => { if (cfg.min) { cfg.min = false; save(); root.classList.remove('min'); } else (speaking ? stop() : play()); } }); fig.append(svg);
    const NOPT = ['michael', 'lewis', 'device'], NLAB = { michael: '🔊 Voice: Michael', lewis: '🔊 Voice: Lewis', device: '🔈 Voice: phone' };
    const nBtn = h('button', { class: 'p-deep on', title: 'Narrator: Michael (US), Lewis (UK) or your phone\'s own voice' });
    const nLbl = () => { nBtn.textContent = NLAB[cfg.narr] || NLAB.device; nBtn.classList.toggle('on', cfg.narr !== 'device'); };
    nBtn.onclick = () => { cfg.narr = NOPT[(NOPT.indexOf(cfg.narr) + 1) % NOPT.length]; save(); nLbl(); sample(); }; nLbl();
    const ctr2 = h('div', { class: 'p-ctrl2' }, nBtn, h('button', { class: 'p-vset', title: 'Narrator, Studio voice, phone voice depth and speed', onclick: () => voicePanel() }, '⚙ Voice'));
    root.append(bubble, fig, ctr, ctr2);
    document.body.append(root); document.body.classList.add('has-presenter');
  }
  function rebuild() { stop(); if (root) root.remove(); parts = {}; if (cfg.on) { build(); greet(); } }
  // ---------- animation ----------
  function armPts(sx, sy, th, ph, dir) { const r = d => d * Math.PI / 180, ex = sx + dir * 26 * Math.sin(r(th)), ey = sy + 26 * Math.cos(r(th)), hx = ex + dir * 23 * Math.sin(r(ph)), hy = ey + 23 * Math.cos(r(ph)); return [ex, ey, hx, hy]; }
  function frame(t, dt) {
    if (!root || !parts.upA) return;
    gT += dt; const tgt = POSE[gesture] || POSE.idle, wob = Math.sin(gT * 6);
    const goal = tgt.slice();
    if (gesture === 'wave') goal[3] += 22 * Math.sin(gT * 9);
    if (gesture === 'explain') { goal[0] += 8 * Math.sin(gT * 3); goal[2] += 8 * Math.sin(gT * 3 + 2); goal[1] += 10 * Math.sin(gT * 3.4); goal[3] += 10 * Math.sin(gT * 3.4 + 2); }
    if (gesture === 'point') goal[1] += 3 * wob;
    if (gesture === 'idle' || gesture === 'think') { goal[0] += 2 * Math.sin(gT * 1.2); goal[2] += 2 * Math.sin(gT * 1.3 + 1); }
    for (let i = 0; i < 4; i++) cur[i] += (goal[i] - cur[i]) * Math.min(1, dt * 8);
    const sx = CHAR[cfg.who].style === 'prof' ? 31 : 38, sx2 = 120 - sx; const [eA, fA, hA, gA] = armPts(sx, 100, cur[0], cur[1], -1), [eB, fB, hB, gB] = armPts(sx2, 100, cur[2], cur[3], 1);
    const set = (el, a) => { for (const k in a) el.setAttribute(k, a[k]); };
    set(parts.upA, { x1: sx, y1: 100, x2: eA, y2: fA }); set(parts.loA, { x1: eA, y1: fA, x2: hA, y2: gA }); set(parts.handA, { cx: hA, cy: gA });
    set(parts.upB, { x1: sx2, y1: 100, x2: eB, y2: fB }); set(parts.loB, { x1: eB, y1: fB, x2: hB, y2: gB }); set(parts.handB, { cx: hB, cy: gB });
    set(parts.thumb, { x1: hB, y1: gB, x2: hB, y2: gB - 9, opacity: gesture === 'thumbs' ? 1 : 0 });
    const tilt = gesture === 'think' ? 7 : gesture === 'point' ? -6 : speaking ? 2.5 * Math.sin(gT * 2.2) : 1.5 * Math.sin(gT * 0.9);
    parts.head.setAttribute('transform', `rotate(${tilt} 60 80)`);
    const browUp = gesture === 'warn' || gesture === 'point' ? -2.5 : gesture === 'think' ? 1.5 : 0;
    parts.browL.setAttribute('transform', `translate(0 ${browUp})`); parts.browR.setAttribute('transform', `translate(0 ${gesture === 'think' ? -2 : browUp})`);
    // blink
    blinkT -= dt; const bl = blinkT < 0.12 && blinkT > 0 ? 0.15 : 1; if (blinkT < 0) blinkT = 2 + Math.random() * 3;
    parts.eyeL.setAttribute('ry', 3.6 * bl); parts.eyeR.setAttribute('ry', 3.6 * bl);
    // lip sync: boundary-driven, with a fallback chatter while the engine speaks
    if (audOn && analyser) { const L = level(); viseme = L < 0.015 ? 'closed' : L < 0.05 ? 'small' : L < 0.1 ? (Math.random() < 0.5 ? 'round' : 'open') : (Math.random() < 0.5 ? 'wide' : 'open'); lastBoundary = t; }
    if (speaking) { if (t - lastBoundary > 0.11) { const r = Math.random(); viseme = r < 0.3 ? 'small' : r < 0.55 ? 'open' : r < 0.75 ? 'wide' : r < 0.88 ? 'round' : 'closed'; lastBoundary = t - (Math.random() * 0.03); } }
    else viseme = 'closed';
    const V = { closed: [5, 0.8, 0], small: [4.5, 2.2, 0], open: [5.5, 4.4, 1], wide: [7.5, 3, 1], round: [3.6, 4.2, 0] }[viseme];
    parts.mouth.setAttribute('rx', V[0]); parts.mouth.setAttribute('ry', V[1]); parts.teeth.setAttribute('opacity', V[2] * 0.9); parts.smile.setAttribute('opacity', viseme === 'closed' ? 1 : 0);
  }
  let lastT = performance.now() / 1000; (function loop(now) { const t = now / 1000; frame(t, Math.min(0.05, t - lastT)); lastT = t; requestAnimationFrame(loop); })(performance.now());
  function visemeFor(word) { const w = (word || '').toLowerCase(); if (/[ou]/.test(w[1] || w[0] || '')) return 'round'; if (/[a]/.test(w)) return 'open'; if (/[ei]/.test(w)) return 'wide'; return 'small'; }
  // ---------- speech ----------
  // Voice choice. Browsers only offer the voices installed on the device, so we rank them.
  const FEMALE = /female|woman|zira|samantha|heera|neerja|veena|kalpana|lekha|swara|aria|jenny|sonia|libby|natasha|clara|emma|ava\b|michelle|karen|moira|tessa|fiona|victoria|susan|hazel|catherine|serena|ana\b|aditi|raveena|kajal|google us english|google uk english female|google हिन्दी/i;
  // deep, warm male voices first (Edge "Natural" voices are the most human)
  const MALE_RANK = [/andrew.*natural/i, /guy.*natural/i, /davis.*natural/i, /christopher.*natural/i, /brian.*natural/i, /roger.*natural/i, /eric.*natural/i, /ryan.*natural/i, /thomas.*natural/i, /prabhat.*natural/i, /william.*natural/i,
    /google uk english male/i, /en-in-x-ene/i, /en-in-x-end/i, /en-gb-x-rjs/i, /en-gb-x-gbd/i, /en-us-x-iom/i, /en-us-x-tpd/i, /en-us-x-iol/i, /daniel/i, /arthur/i, /aaron/i, /gordon/i, /ralph/i, /fred/i, /rishi/i, /ravi/i, /hemant/i, /prabhat/i, /david/i, /mark/i, /george/i, /james/i, /alex\b/i, /\bmale\b/i];
  function voices() { try { return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) { return []; } }
  function pickVoice() {
    const vs = voices(), c = CHAR[cfg.who];
    if (cfg.voiceName) { const v = vs.find(v => v.name === cfg.voiceName); if (v) return v; }
    if (c.sex === 'm') { for (const re of MALE_RANK) { const v = vs.find(v => re.test(v.name) && !FEMALE.test(v.name)); if (v) return v; } return vs.find(v => !FEMALE.test(v.name)) || vs[0] || null; }
    const fem = vs.filter(v => FEMALE.test(v.name)); return fem.find(v => /en[-_]IN/i.test(v.lang)) || fem.find(v => /natural/i.test(v.name)) || fem[0] || vs[0] || null;
  }
  function voicePanel() {
    const vs = voices(), cur = pickVoice(), c = CHAR[cfg.who];
    const sel = h('select', { class: 'inp' }, h('option', { value: '' }, 'Auto (best ' + (c.sex === 'm' ? 'deep male' : 'female') + ' voice on this device)'), vs.map(v => h('option', { value: v.name }, `${v.name} (${v.lang})${FEMALE.test(v.name) ? '' : ''}`)));
    sel.value = cfg.voiceName || '';
    const mk = (lab, key, lo, hi, def) => { const r = h('input', { type: 'range', min: lo, max: hi, step: 0.01, value: cfg[key] != null ? cfg[key] : def }), o = h('span', { class: 'mono' }, (+r.value).toFixed(2)); r.oninput = () => { cfg[key] = +r.value; o.textContent = (+r.value).toFixed(2); save(); }; return h('div', { class: 'field' }, h('label', null, lab, ' ', o), r); };
    const test = () => phoneSample();
    sel.onchange = () => { cfg.voiceName = sel.value || null; save(); test(); };
    const nr = h('div', { class: 'toolbar' }, [['michael', 'Michael (US)'], ['lewis', 'Lewis (UK)'], ['device', 'Phone voice']].map(([k, l]) => h('button', { class: 'btn ' + (cfg.narr === k ? '' : 'ghost'), onclick: (e) => { cfg.narr = k; save(); $$('button', nr).forEach(b => b.className = 'btn ghost'); e.target.className = 'btn'; sample(); try { $$('.p-deep').forEach(b => b.textContent = { michael: '🔊 Voice: Michael', lewis: '🔊 Voice: Lewis', device: '🔈 Voice: phone' }[k]); } catch (er) { } } }, l)));
    const st = h('input', { type: 'checkbox' }); st.checked = !!cfg.studio; st.onchange = () => { cfg.studio = st.checked; save(); if (st.checked) studioLoad().catch(() => { }); };
    modal(h('div', null, h('h3', null, '🎙 Narrator'),
      h('p', { class: 'small' }, 'Michael and Lewis are recorded neural voices: page explanations play as natural speech on every device. Live results (numbers that change with your inputs) are spoken by the phone voice, unless Studio voice is on.'), nr,
      h('label', { class: 'small', style: { display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '10px 0' } }, st, h('span', null, h('b', null, 'Studio voice for live results. '), 'Runs the same neural voice inside your browser so results sound identical. Downloads about 90 MB once; on a phone each result can take a few seconds to prepare. Needs a modern browser.')),
      h('h3', { style: { marginTop: '14px' } }, '📱 Phone voice'),
      h('p', { class: 'small' }, `Now using: ${cur ? cur.name : 'browser default'}. The list shows the voices installed on this device. The most natural deep male voices are the Microsoft “Natural” ones in Edge (Andrew, Guy, Davis, Christopher); on Chrome, “Google UK English Male”; on Mac/iPhone, Daniel or Arthur (add more in Settings → Accessibility → Spoken content → Voices).`),
      h('div', { class: 'field sel wide' }, h('label', null, 'Voice'), sel),
      mk('Depth (lower = deeper)', 'pitchUser', 0.5, 1.3, pitchNow()), mk('Speed', 'rateUser', 0.6, 1.3, rateNow() / (cfg.rate || 1)),
      h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: test }, '▶ Test'), h('button', { class: 'btn ghost', onclick: () => { cfg.voiceName = null; cfg.pitchUser = null; cfg.rateUser = null; save(); $('#modal').classList.add('hidden'); } }, '↺ Reset voice'))));
  }
  function sample() { stop(); const my = run; if (useNeural()) return playUrl(`audio/${cfg.narr}/sample.mp3?v=${AUD_V}`, my, false, () => phoneSample()); phoneSample(); }
  function phoneSample() { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance('Hello, I am ' + sayName() + '. Every machine begins with a question: what must it do, and how might it fail?'); const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } u.pitch = pitchNow(); u.rate = rateNow(); speaking = true; u.onboundary = e => { viseme = visemeFor(u.text.slice(e.charIndex).split(/\s/)[0]); lastBoundary = performance.now() / 1000; }; u.onend = u.onerror = () => { speaking = false; }; speechSynthesis.speak(u); } catch (e) { } }
  const pitchNow = () => cfg.pitchUser != null ? cfg.pitchUser : CHAR[cfg.who].sex === 'm' && cfg.deep ? 0.6 : CHAR[cfg.who].pitch;
  const rateNow = () => (cfg.rateUser != null ? cfg.rateUser : CHAR[cfg.who].sex === 'm' && cfg.deep ? 0.85 : CHAR[cfg.who].rateK) * (cfg.rate || 1);
  function clean(s) { return String(s).replace(/<[^>]+>/g, '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u25B6\uFE0F]/gu, '').replace(/°\s?C\b/g, ' degrees Celsius').replace(/°/g, ' degrees').replace(/²/g, ' squared').replace(/³/g, ' cubed').replace(/∝/g, ' proportional to ').replace(/≈/g, ' about ').replace(/±/g, ' plus or minus ')
    .replace(/(\d)\s?%/g, '$1 percent').replace(/\bkN\b/g, 'kilonewtons').replace(/\bMPa\b/g, 'megapascals').replace(/\bGPa\b/g, 'gigapascals').replace(/\bkm\/h\b/g, 'kilometres per hour').replace(/\brpm\b/gi, 'R P M').replace(/\bHz\b/g, 'hertz').replace(/\bkW\b/g, 'kilowatts').replace(/\bkWh\b/g, 'kilowatt hours').replace(/\bN·?m\b/g, 'newton metres').replace(/(\d)\s?mm\b/g, '$1 millimetres').replace(/\bSF\b/g, 'safety factor').replace(/\bBOTH\b/g, 'both').replace(/\be\.g\./g, 'for example').replace(/\bi\.e\./g, 'that is').replace(/\bvs\.?\b/g, 'versus').replace(/\bDr\.\s*/g, 'Doctor ').replace(/σ/g, 'sigma ').replace(/τ/g, 'tau ').replace(/×/g, ' times ').replace(/≥/g, ' at least ').replace(/≤/g, ' at most ').replace(/→/g, ', then ').replace(/[·•]/g, ', ').replace(/\s+/g, ' ').trim(); }
  function highlight(target) { if (hl) hl.classList.remove('p-spot'); hl = null; if (!target) return; const el = typeof target === 'string' ? $(target) : target; if (el) { el.classList.add('p-spot'); hl = el; } }
  // ---------- narrators: recorded neural voices (Kokoro, Apache-2.0), optional in-browser Studio voice, phone voice ----------
  const NARR = { michael: { label: 'Michael (US)', kid: 'am_michael' }, lewis: { label: 'Lewis (UK)', kid: 'bm_lewis' } };
  const AUD_V = '1';
  function hash(str) { let x = 0x811c9dc5; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(16).padStart(8, '0'); }
  const man = {};
  function manifest(n) { if (!man[n]) man[n] = fetch(`audio/${n}/index.json?v=${AUD_V}`).then(r => r.ok ? r.json() : []).then(a => new Set(a)).catch(() => new Set()); return man[n]; }
  const useNeural = () => CHAR[cfg.who].sex === 'm' && NARR[cfg.narr];
  let aud = null, actx = null, analyser = null, abuf = null, audOn = false, run = 0;
  function audioEl() {
    if (aud) return aud; aud = new Audio(); aud.preload = 'auto';
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaElementSource(aud); analyser = actx.createAnalyser(); analyser.fftSize = 512; abuf = new Uint8Array(analyser.fftSize); src.connect(analyser); analyser.connect(actx.destination); } catch (e) { analyser = null; }
    return aud;
  }
  function level() { if (!analyser) return -1; analyser.getByteTimeDomainData(abuf); let s2 = 0; for (let i = 0; i < abuf.length; i++) { const d = (abuf[i] - 128) / 128; s2 += d * d; } return Math.sqrt(s2 / abuf.length); }
  function playUrl(url, my, revoke, onFail) {
    const a = audioEl(); try { actx && actx.state === 'suspended' && actx.resume(); } catch (e) { }
    a.onended = () => { audOn = false; speaking = false; if (revoke) URL.revokeObjectURL(url); if (my === run && queue.length) setTimeout(speakNext, 250); };
    a.onerror = () => { audOn = false; if (my === run) onFail(); };
    a.src = url; a.playbackRate = cfg.rate || 1; audOn = true; speaking = true;
    const pr = a.play(); if (pr && pr.catch) pr.catch(() => { audOn = false; if (my === run) onFail(); });
  }
  // Studio voice: Kokoro running inside the browser (model ≈ 90 MB, downloaded once and cached by the browser)
  let studioP = null, studioReady = null;
  function studioLoad() {
    if (studioP) return studioP;
    toast('Downloading the Studio voice (about 90 MB, only once)…', 5000);
    studioP = import(new URL('js/vendor/kokoro.web.js', document.baseURI).href).then(m => m.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' }))
      .then(t => { studioReady = t; toast('Studio voice ready: live results now use it too.'); return t; })
      .catch(e => { studioP = null; toast('Studio voice could not load here; using the phone voice for results.'); throw e; });
    return studioP;
  }
  function phoneSay(txt, my) {
    let u; try { u = new SpeechSynthesisUtterance(txt); } catch (e) { speaking = false; toast('Speech not available in this browser'); return; }
    const v = pickVoice(); if (v) u.voice = v; u.lang = (v && v.lang) || 'en-IN'; u.rate = rateNow(); u.pitch = pitchNow();
    u.onstart = () => { speaking = true; }; u.onboundary = e => { if (e.name === 'word' || e.charIndex >= 0) { const w = u.text.slice(e.charIndex).split(/\s/)[0]; viseme = visemeFor(w); lastBoundary = performance.now() / 1000; } };
    u.onend = () => { speaking = false; if (my === run) setTimeout(speakNext, 250); }; u.onerror = () => { speaking = false; if (my === run) setTimeout(speakNext, 100); };
    speaking = true; speechSynthesis.speak(u);
  }
  async function speakNext() {
    if (qi >= queue.length) { speaking = false; gesture = 'idle'; highlight(null); bubble.innerHTML = '<b>Done!</b> Change an input and press ▶ again, or try the experiment.'; setTimeout(() => { if (!speaking) gesture = 'idle'; }, 400); return; }
    const my = run, it = queue[qi++]; gesture = it.g || 'explain'; highlight(it.spot);
    bubble.innerHTML = ''; bubble.append(h('span', null, it.text));
    const txt = clean(it.text); speaking = true;
    if (useNeural()) {
      const set = await manifest(cfg.narr); if (my !== run) return;
      const hh = hash(txt);
      if (set.has(hh)) return playUrl(`audio/${cfg.narr}/${hh}.mp3?v=${AUD_V}`, my, false, () => phoneSay(txt, my));
      if (cfg.studio) {
        if (studioReady) { gesture = 'think'; try { const a = await studioReady.generate(txt, { voice: NARR[cfg.narr].kid, speed: 0.95 }); if (my !== run) return; gesture = it.g || 'explain'; return playUrl(URL.createObjectURL(a.toBlob()), my, true, () => phoneSay(txt, my)); } catch (e) { } }
        else studioLoad().catch(() => { });
      }
    }
    phoneSay(txt, my);
  }
  function play() {
    if (!cfg.on) return; try { speechSynthesis.cancel(); } catch (e) { }
    run++; queue = buildScript(); qi = 0; if (!queue.length) return; if (cfg.min) { cfg.min = false; root.classList.remove('min'); }
    // some engines load voices lazily
    if (typeof speechSynthesis === 'undefined') { bubble.textContent = queue.map(q => q.text).join(' '); return; }
    speakNext();
  }
  function stop() { run++; try { speechSynthesis.cancel(); } catch (e) { } try { aud && aud.pause(); } catch (e) { } audOn = false; queue = []; qi = 0; speaking = false; gesture = 'idle'; highlight(null); }
  // ---------- page scripts ----------
  function buildScript() {
    const p = MD.pages[MD.current] || {}, F = window.FRIENDLY || { kid: {} }, kid = p.kid || F.kid[MD.current], out = [];
    const strip = s => String(s || '').replace(/<[^>]+>/g, '');
    out.push({ text: `${MD.current === 'home' ? 'Hello! I am ' + sayName() + '. ' : ''}${kid ? strip(kid.what) : 'This page is about ' + strip(p.title) + '.'}`, g: 'greet', spot: '.kidbox' });
    if (kid && kid.steps) kid.steps.forEach((s, i) => out.push({ text: `Step ${i + 1}. ${strip(s)}`, g: i === 0 ? 'point' : 'explain', spot: i === 0 ? '.grid2 > .card, .grid2 > div > .card' : '.kidbox' }));
    const v = $('.verdict'); const ex = MD.explain;
    if (ex) out.push({ dyn: true, text: 'Here is what the page says right now. ' + strip(ex), g: v && v.classList.contains('good') ? 'thumbs' : v && v.classList.contains('bad') ? 'warn' : 'point', spot: v || '.metrics' });
    if ($('.dominance, .bars')) out.push({ text: 'Look at the bar chart. The orange bar is the failure mode that decides the size. That is the one to attack if you want a smaller part.', g: 'point', spot: '.bars' });
    if ($('.effect')) out.push({ text: 'The effect table shows which input matters most. Big green or red numbers mean that input changes the answer a lot.', g: 'explain', spot: '.effect' });
    if (kid && kid.try) out.push({ text: 'Try this. ' + strip(kid.try), g: 'think', spot: '.kid-try' });
    out.push({ text: 'If you want the maths, open the equations panel at the bottom. Every symbol is explained there.', g: 'point', spot: '.eqpanel' });
    return out;
  }
  function greet() { if (!root) return; gesture = 'wave'; setTimeout(() => { if (!speaking) gesture = 'idle'; }, 1600); const p = MD.pages[MD.current]; bubble.innerHTML = ''; bubble.append(h('span', null, `Hi, I'm ${cfg.who}! Tap ▶ and I'll explain ${p ? p.title.toLowerCase() : 'this page'}.`)); }
  function onResult() { // a new result appeared: react with a gesture (no sound unless asked)
    if (!root || speaking) return; const v = $('.verdict'); if (!v) return;
    gesture = v.classList.contains('good') ? 'thumbs' : v.classList.contains('bad') ? 'warn' : 'think'; gT = 0;
    clearTimeout(onResult._t); onResult._t = setTimeout(() => { if (!speaking) gesture = 'idle'; }, 1800);
  }
  function onPage() { stop(); if (!cfg.on) return; if (!root) build(); greet(); }
  function toggle() { cfg.on = !cfg.on; save(); if (cfg.on) { if (!root || !root.isConnected) { parts = {}; build(); } greet(); } else { stop(); root && root.remove(); document.body.classList.remove('has-presenter'); } }
  try { speechSynthesis.onvoiceschanged = () => { }; speechSynthesis.getVoices(); } catch (e) { }
  return { onPage, onResult, play, stop, toggle, get on() { return cfg.on; }, _items: () => buildScript().filter(x => !x.dyn).map(x => clean(x.text)), _hash: hash };
})();
