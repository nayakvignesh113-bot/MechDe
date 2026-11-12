'use strict';
/* Structure Builder: draw → load → analyse (static, thermal, wind, moving load, modal, FRF) → design check → auto-size */
const SECTIONS = (() => {
  const S = {};
  // ISMB (IS 808): A cm², Ixx cm⁴, Iyy cm⁴, h mm, b mm
  [[100, 75, 14.6, 257.5, 40.8], [150, 80, 19.0, 726.4, 52.6], [200, 100, 32.33, 2235.4, 150.0], [250, 125, 47.55, 5131.6, 334.5], [300, 140, 56.26, 8603.6, 453.9], [400, 140, 78.46, 20458.4, 622.1], [500, 180, 110.74, 45218.3, 1369.8], [600, 210, 156.21, 91813, 2651]]
    .forEach(([hh, b, A, Ix, Iy]) => S['ISMB ' + hh] = { fam: 'ISMB', A: A * 100, I: Ix * 1e4, Imin: Iy * 1e4, h: hh, b, per: 2 * (2 * b + hh) });
  [[48.3, 4], [60.3, 4], [88.9, 5], [114.3, 6], [168.3, 8], [219.1, 10], [323.9, 12]].forEach(([D, t]) => S[`CHS ${D}×${t}`] = { fam: 'CHS', D, t });
  [[50, 4], [80, 5], [100, 6], [150, 8], [200, 10], [250, 12]].forEach(([b, t]) => S[`SHS ${b}×${t}`] = { fam: 'SHS', b, t });
  [20, 30, 40, 60, 80, 100].forEach(d => S[`Rod Ø${d}`] = { fam: 'ROD', d });
  return S;
})();
const SEC_NAMES = Object.keys(SECTIONS);
function secProps(name, c) { // c = corrosion loss per face (mm). Returns SI.
  const s = SECTIONS[name] || SECTIONS['ISMB 200']; let A, I, Imin, depth;
  if (s.fam === 'ISMB') { A = Math.max(s.A * 0.2, s.A - s.per * c); I = s.I * A / s.A; Imin = s.Imin * A / s.A; depth = s.h; }
  else if (s.fam === 'CHS') { const D = s.D - 2 * c, t = Math.max(0.3, s.t - c), di = D - 2 * t; A = Math.PI / 4 * (D * D - di * di); I = Imin = Math.PI / 64 * (D ** 4 - di ** 4); depth = D; }
  else if (s.fam === 'SHS') { const b = s.b - 2 * c, t = Math.max(0.3, s.t - c), bi = b - 2 * t; A = b * b - bi * bi; I = Imin = (b ** 4 - bi ** 4) / 12; depth = b; }
  else { const d = Math.max(1, s.d - 2 * c); A = Math.PI * d * d / 4; I = Imin = Math.PI * d ** 4 / 64; depth = d; }
  return { A: A * 1e-6, I: I * 1e-12, Imin: Imin * 1e-12, c: depth / 2 * 1e-3, depth: depth * 1e-3 };
}
const PRESETS = {
  'Pratt truss footbridge 24 m': () => { const n = [], m = []; const P = 6, Lp = 4, H = 3; for (let i = 0; i <= P; i++) n.push({ x: i * Lp, y: 0, sup: i === 0 ? 'pin' : i === P ? 'roller' : 'free' }); for (let i = 1; i < P; i++) n.push({ x: i * Lp, y: H }); const top = i => P + i; for (let i = 0; i < P; i++) m.push([i, i + 1]); for (let i = 1; i < P - 1; i++) m.push([top(i), top(i + 1)]); m.push([0, top(1)], [P, top(P - 1)]); for (let i = 1; i < P; i++) m.push([i, top(i)]); for (let i = 1; i < P / 2; i++) m.push([top(i), i + 1]); for (let i = P / 2 + 1; i < P; i++) m.push([top(i), i - 1]); return { truss: true, nodes: n, members: m.map(([a, b]) => ({ a, b, sec: 'CHS 114.3×6', mat: 'IS 2062 E250 structural steel' })), loads: [], deck: 5, set: { nsm: 600 } }; },
  'Warren truss bridge 30 m': () => { const n = [], m = []; const P = 6, Lp = 5, H = 4; for (let i = 0; i <= P; i++) n.push({ x: i * Lp, y: 0, sup: i === 0 ? 'pin' : i === P ? 'roller' : 'free' }); for (let i = 0; i < P; i++) n.push({ x: i * Lp + Lp / 2, y: H }); for (let i = 0; i < P; i++) m.push([i, i + 1]); for (let i = 0; i < P - 1; i++) m.push([P + 1 + i, P + 2 + i]); for (let i = 0; i < P; i++) m.push([i, P + 1 + i], [P + 1 + i, i + 1]); return { truss: true, nodes: n, members: m.map(([a, b]) => ({ a, b, sec: 'SHS 150×8', mat: 'IS 2062 E350 structural steel' })), loads: [], deck: 30, set: { nsm: 3000 } }; },
  'Simply supported girder 12 m': () => { const n = []; for (let i = 0; i <= 6; i++) n.push({ x: i * 2, y: 0, sup: i === 0 ? 'pin' : i === 6 ? 'roller' : 'free' }); return { truss: false, nodes: n, members: [0, 1, 2, 3, 4, 5].map(i => ({ a: i, b: i + 1, sec: 'ISMB 400', mat: 'IS 2062 E250 structural steel' })), loads: [], deck: 20, set: { nsm: 2000 } }; },
  'Portal frame 12 × 6 m (fixed bases)': () => ({ truss: false, nodes: [{ x: 0, y: 0, sup: 'fixed' }, { x: 0, y: 6 }, { x: 6, y: 7.5 }, { x: 12, y: 6 }, { x: 12, y: 0, sup: 'fixed' }], members: [[0, 1, 'ISMB 400'], [1, 2, 'ISMB 300'], [2, 3, 'ISMB 300'], [3, 4, 'ISMB 400']].map(([a, b, sec]) => ({ a, b, sec, mat: 'IS 2062 E250 structural steel' })), loads: [{ n: 1, Fx: 15, Fy: 0 }, { n: 2, Fx: 0, Fy: -40 }], deck: 0, set: { nsm: 0 } }),
  'Wall crane jib with tie': () => ({ truss: false, nodes: [{ x: 0, y: 0, sup: 'pin' }, { x: 0, y: 3, sup: 'pin' }, { x: 2.5, y: 0 }, { x: 5, y: 0 }], members: [{ a: 0, b: 2, sec: 'ISMB 250', mat: 'IS 2062 E250 structural steel' }, { a: 2, b: 3, sec: 'ISMB 250', mat: 'IS 2062 E250 structural steel' }, { a: 1, b: 3, sec: 'Rod Ø30', mat: 'IS 2062 E250 structural steel' }], loads: [{ n: 3, Fx: 0, Fy: -30 }], deck: 0, set: { nsm: 0 } }),
  'Two-storey frame (lateral loads)': () => ({ truss: false, nodes: [{ x: 0, y: 0, sup: 'fixed' }, { x: 6, y: 0, sup: 'fixed' }, { x: 0, y: 3.5 }, { x: 6, y: 3.5 }, { x: 0, y: 7 }, { x: 6, y: 7 }], members: [[0, 2], [1, 3], [2, 4], [3, 5], [2, 3], [4, 5]].map(([a, b]) => ({ a, b, sec: 'ISMB 300', mat: 'IS 2062 E250 structural steel' })), loads: [{ n: 2, Fx: 20, Fy: 0 }, { n: 4, Fx: 30, Fy: 0 }], deck: 0, set: { nsm: 0, mass: [[2, 8000], [3, 8000], [4, 6000], [5, 6000]] } }),
  'Slender footbridge 36 m (resonance)': () => { const n = []; for (let i = 0; i <= 12; i++) n.push({ x: i * 3, y: 0, sup: i === 0 ? 'pin' : i === 12 ? 'roller' : 'free' }); return { truss: false, nodes: n, members: Array.from({ length: 12 }, (_, i) => ({ a: i, b: i + 1, sec: 'ISMB 600', mat: 'IS 2062 E250 structural steel' })), loads: [], deck: 6, set: { nsm: 1200 } }; },
};
MD.register('structure', {
  group: 'Build & test', title: 'Structure builder', icon: '🌉', voice: 'structure bridge truss frame builder',
  render(main) {
    pageHead(main, 'Stationary & dynamic structures', 'Structure builder',
      'Draw a bridge, truss, frame or bracket and load it. Every edit re-solves the finite-element model instantly: members turn red as they approach yield or buckling. Then switch on temperature, wind, a moving vehicle, or look at its <b>natural frequencies</b>: a structure that is strong enough statically can still fail by resonance (Tacoma Narrows, Millennium Bridge).');
    const st = Object.assign({ tool: 'move', view: 'util', sel: null, selM: null, pendingA: null }, {});
    let M = store('struct'); if (!M || !M.nodes) M = toModel(PRESETS[(M && PRESETS[M.preset]) ? M.preset : 'Pratt truss footbridge 24 m']());
    function toModel(p) {
      const set = Object.assign({ fos: 1.67, K: 1.0, self: true, thermal: true, wind: true, nsm: 0, impact: 1.0, zeta: 0.02, fexc: 2.0, deckTop: false }, p.set || {});
      const nodes = p.nodes.map(n => Object.assign({ sup: 'free', mass: 0 }, n));
      (set.mass || []).forEach(([i, ms]) => nodes[i].mass = ms); delete set.mass;
      return { truss: !!p.truss, nodes, members: p.members, loads: p.loads || [], deck: p.deck || 0, set };
    }
    const save = () => store('struct', M);
    // ---- layout
    const top = h('div', { class: 'toolbar' }); main.append(top);
    const presetSel = h('select', { class: 'inp', style: { width: 'auto' } }, h('option', { value: '' }, 'Load preset…'), Object.keys(PRESETS).map(k => h('option', { value: k }, k)));
    presetSel.onchange = () => { if (!presetSel.value) return; M = toModel(PRESETS[presetSel.value]()); st.sel = st.selM = null; envelope = null; modes = null; presetSel.value = ''; save(); refreshAll(); };
    const toolBtns = {};
    const tools = [['move', '✋ Select/Move'], ['node', '● Node'], ['member', '／ Member'], ['support', '▲ Support'], ['load', '↓ Load'], ['del', '✕ Delete']];
    top.append(presetSel, h('span', { class: 'sep' }));
    tools.forEach(([k, l]) => { const b = h('button', { class: 'btn ghost sm', onclick: () => { st.tool = k; st.pendingA = null; Object.values(toolBtns).forEach(x => x.classList.remove('on')); b.classList.add('on'); hint(); } }, l); toolBtns[k] = b; top.append(b); });
    toolBtns.move.classList.add('on');
    top.append(h('span', { class: 'sep' }), h('button', { class: 'btn ghost sm', onclick: () => { if (confirmBox('Clear the model?')) { M = toModel({ nodes: [], members: [] }); save(); refreshAll(); } } }, 'Clear'));
    const viewBar = h('div', { class: 'toolbar' }); main.append(viewBar);
    const views = [['util', 'Utilisation'], ['def', 'Deformed'], ['axial', 'Axial forces'], ['bmd', 'Bending moment'], ['mode', 'Mode shape']], vBtns = {};
    viewBar.append(h('span', { class: 'small' }, 'View: '));
    views.forEach(([k, l]) => { const b = h('button', { class: 'btn ghost sm' + (k === st.view ? ' on' : ''), onclick: () => { st.view = k; Object.values(vBtns).forEach(x => x.classList.remove('on')); b.classList.add('on'); if (k === 'mode' && !modes) runModal(); } }, l); vBtns[k] = b; viewBar.append(b); });
    const hintEl = h('span', { class: 'small', style: { marginLeft: '8px' } }); viewBar.append(hintEl);
    const cv = h('canvas', { class: 'anim', style: { height: '440px' } }); main.append(cv);
    const legend = h('div', { class: 'legend', html: '<span><i style="background:#2f7d32"></i>util < 0.6</span><span><i style="background:#b26a00"></i>0.6–0.9</span><span><i style="background:#ea580c"></i>0.9–1.0</span><span><i style="background:#b42318"></i>> 1.0 fails</span><span>Thin = tension · thick = compression · ⟂ arrows = reactions</span>' });
    main.append(legend);
    const g = h('div', { class: 'grid2', style: { marginTop: '10px' } }), L = h('div'), R = h('div'); g.append(L, R); main.append(g);
    const setCard = h('div', { class: 'card' }), propCard = h('div', { class: 'card', style: { marginTop: '12px' } });
    L.append(setCard, propCard);
    const resBody = h('div');
    // settings form
    setCard.append(h('div', { class: 'panel-title' }, 'Model & loading'));
    const sspec = [
      { id: 'truss', label: 'Pin-jointed truss (else rigid frame)', type: 'check', value: M.truss },
      { id: 'self', label: 'Include self-weight', type: 'check', value: M.set.self },
      { id: 'deck', label: 'Deck / imposed load on deck', unit: 'kN/m', value: M.deck, min: 0, max: 100, step: 0.5, aliases: ['deck load', 'imposed load'] },
      { id: 'deckTop', label: 'Deck on top chord (else bottom)', type: 'check', value: M.set.deckTop },
      { id: 'thermal', label: `Thermal load ΔT = T_op − T_install`, type: 'check', value: M.set.thermal },
      { id: 'wind', label: 'Wind on members (basic wind speed from 🌡)', type: 'check', value: M.set.wind },
      { id: 'fos', label: 'Factor of safety (yield & buckling)', value: M.set.fos, min: 1, max: 4, step: 0.01, aliases: ['safety factor'] },
      { id: 'K', label: 'Effective-length factor K', value: M.set.K, min: 0.5, max: 2.5, step: 0.05 },
      { id: 'nsm', label: 'Non-structural mass on deck (modal)', unit: 'kg/m', value: M.set.nsm, min: 0, max: 10000, step: 50, aliases: ['deck mass'] },
    ];
    let SV = {};
    const sf = buildForm(setCard, sspec, (v) => { SV = v; M.truss = v.truss; M.deck = v.deck; Object.assign(M.set, { self: v.self, deckTop: v.deckTop, thermal: v.thermal, wind: v.wind, fos: v.fos, K: v.K, nsm: v.nsm }); modes = null; envelope = null; save(); solve(); renderResults(); });
    SV = sf.vals;
    function hint() {
      hintEl.textContent = { move: 'Drag nodes; click a member or node to edit it.', node: 'Click to add a node (snaps to 0.5 m).', member: 'Click two points/nodes to connect them.', support: 'Click a node to cycle: free → pin → roller → fixed → vertical roller.', load: 'Click a node to add −10 kN (edit in panel).', del: 'Click a node or member to delete it.' }[st.tool];
    }
    hint();
    // results tabs
    R.append(h('div', { class: 'card' }, resBody));
    let tabIdx = 0;
    const resTabs = h('div'); resBody.append(resTabs);
    const resOut = h('div'); resBody.append(resOut);
    tabs(resTabs, ['Static check', 'Modal & resonance', 'Moving load', 'Member table'], i => { tabIdx = i; if (i !== 2) stopMoving(); renderResults(); });
    // ---- analysis
    let res = null, modes = null, envelope = null, moving = null, il = null;
    function buildFE(extra) {
      const dT = M.set.thermal ? (ENV.T - ENV.Tinstall) : 0;
      const ys = M.nodes.map(n => n.y), deckY = M.set.deckTop ? Math.max(...ys) : Math.min(...ys);
      const wind = M.set.wind ? 0.6 * ENV.wind ** 2 * 2.0 : 0; // N/m² × Cf=2.0
      const members = M.members.map(e => {
        const m = matAt(e.mat), sp = secProps(e.sec, m.corr * ENV.life);
        const A = M.nodes[e.a], B = M.nodes[e.b];
        const isDeck = Math.abs(A.y - deckY) < 1e-6 && Math.abs(B.y - deckY) < 1e-6 && Math.abs(A.x - B.x) > 1e-6;
                return { a: e.a, b: e.b, isDeck, deckW: isDeck ? M.deck * 1000 : 0, windW: 0,
          props: { E: m.E * 1e6, A: sp.A, I: sp.I, Imin: sp.Imin, c: sp.c, rho: m.rho, alpha: m.alpha, Sy: m.Sy * 1e6 }, mat: m, sp };
      });
      // wind acts horizontally on projected (vertical) area; members inclined see their vertical projection
      members.forEach((e, i) => { const A = M.nodes[e.a], B = M.nodes[e.b], L = Math.hypot(B.x - A.x, B.y - A.y) || 1; e.windW = wind * e.sp.depth * Math.abs(B.y - A.y) / L; });
      const nodes = M.nodes.map(n => ({ x: n.x, y: n.y, sup: n.sup, mass: n.mass || 0 }));
      return Object.assign({ truss: M.truss, nodes, members, loads: M.loads.map(l => ({ n: l.n, Fx: (l.Fx || 0) * 1000, Fy: (l.Fy || 0) * 1000 })), selfWeight: M.set.self, dT, fos: M.set.fos, K: M.set.K, deckY }, extra || {});
    }
    function solve(extra) { if (!M.nodes.length || !M.members.length) { res = null; return; } res = FEM.staticSolve(buildFE(extra)); return res; }
    function runModal() {
      const fe = buildFE();
      // non-structural deck mass as nodal lumps
      fe.members.forEach(e => { if (e.isDeck && M.set.nsm) { const L = FEM.geom(fe, e).L; fe.nodes[e.a].mass += M.set.nsm * L / 2; fe.nodes[e.b].mass += M.set.nsm * L / 2; } });
      const r = FEM.modal(fe, 8); modes = r.ok ? r : { ok: false, msg: r.msg }; modeSel = 0;
    }
    let modeSel = 0;
    // ---- drawing
    let view = null, drag = null;
    function fit() {
      const { w, h: H } = setupCanvas(cv);
      const xs = M.nodes.map(n => n.x), ys = M.nodes.map(n => n.y);
      let x0 = Math.min(0, ...xs) - 2, x1 = Math.max(10, ...xs) + 2, y0 = Math.min(0, ...ys) - 2, y1 = Math.max(4, ...ys) + 2;
      const s = Math.min(w / (x1 - x0), H / (y1 - y0));
      const ox = (w - (x1 - x0) * s) / 2 - x0 * s, oy = H - (H - (y1 - y0) * s) / 2 + y0 * s;
      view = { s, ox, oy, w, H, x0, x1, y0, y1 };
    }
    const X = x => view.ox + x * view.s, Y = y => view.oy - y * view.s;
    const toW = (px, py) => [(px - view.ox) / view.s, (view.oy - py) / view.s];
    const snap = v => Math.round(v * 2) / 2;
    const utilCol = u => u < 0.6 ? '#2f7d32' : u < 0.9 ? '#b26a00' : u <= 1 ? '#ea580c' : '#b42318';
    function draw(time) {
      if (!view || !drag) fit();
      const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      // grid
      const step = view.s > 30 ? 1 : view.s > 12 ? 2 : 5;
      ctx.strokeStyle = '#efece3'; ctx.lineWidth = 1;
      for (let x = Math.ceil(view.x0 / step) * step; x <= view.x1; x += step) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
      for (let y = Math.ceil(view.y0 / step) * step; y <= view.y1; y += step) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); }
      ctx.fillStyle = '#a3a99f'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.fillText(`grid ${step} m`, 6, H - 6);
      const ok = res && res.ok;
      // displacement for drawing
      let U = null, scale = 0;
      const span = Math.max(1, view.x1 - view.x0 - 4);
      if (st.view === 'def' && ok) { U = res.u; scale = res.umax > 0 ? 0.06 * span / res.umax : 0; }
      if (st.view === 'mode' && modes && modes.ok && modes.modes[modeSel]) { const ph = modes.modes[modeSel].phi; let mx = 0; for (let i = 0; i < M.nodes.length; i++) mx = Math.max(mx, Math.hypot(ph[3 * i], ph[3 * i + 1])); U = ph; scale = mx ? 0.08 * span / mx * Math.sin(time * 4) : 0; }
      const nodePos = i => U ? [M.nodes[i].x + scale * U[3 * i], M.nodes[i].y + scale * U[3 * i + 1]] : [M.nodes[i].x, M.nodes[i].y];
      // members
      M.members.forEach((e, k) => {
        const A = M.nodes[e.a], B = M.nodes[e.b]; if (!A || !B) return;
        const r = ok ? res.members[k] : null;
        let col = '#64748b', lw = 4;
        if (r && (st.view === 'util' || st.view === 'axial')) { const u = envelope ? Math.max(envelope[k], r.gov) : r.gov; col = st.view === 'util' ? utilCol(u) : (r.N < 0 ? '#b42318' : '#0f5e8c'); lw = r.N < -1 ? 6 : 3; }
        if (U) { // ghost
          ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(B.x), Y(B.y)); ctx.stroke();
          const pa = nodePos(e.a), pb = nodePos(e.b);
          ctx.strokeStyle = st.view === 'mode' ? '#7b3fa0' : (r ? utilCol(r.gov) : col); ctx.lineWidth = 3.5; ctx.beginPath();
          if (!M.truss) { // Hermite curve using rotations
            const L = Math.hypot(B.x - A.x, B.y - A.y), c = (B.x - A.x) / L, s = (B.y - A.y) / L;
            const ua = [U[3 * e.a], U[3 * e.a + 1], U[3 * e.a + 2]], ub = [U[3 * e.b], U[3 * e.b + 1], U[3 * e.b + 2]];
            const va = -ua[0] * s + ua[1] * c, vb = -ub[0] * s + ub[1] * c, xa = ua[0] * c + ua[1] * s, xb = ub[0] * c + ub[1] * s;
            for (let j = 0; j <= 16; j++) { const t = j / 16, xi = t * L; const N1 = 1 - 3 * t * t + 2 * t ** 3, N2 = xi * (1 - t) ** 2, N3 = 3 * t * t - 2 * t ** 3, N4 = xi * (t * t - t);
              const v = N1 * va + N2 * ua[2] + N3 * vb + N4 * ub[2], ux = (1 - t) * xa + t * xb;
              const px = A.x + c * xi + scale * (ux * c - v * s), py = A.y + s * xi + scale * (ux * s + v * c); j ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py)); }
          } else { ctx.moveTo(X(pa[0]), Y(pa[1])); ctx.lineTo(X(pb[0]), Y(pb[1])); }
          ctx.stroke();
        } else {
          ctx.strokeStyle = col; ctx.lineWidth = (st.selM === k ? lw + 3 : lw); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(B.x), Y(B.y)); ctx.stroke();
          if (st.selM === k) { ctx.strokeStyle = '#ff8a4c'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(A.x), Y(A.y)); ctx.lineTo(X(B.x), Y(B.y)); ctx.stroke(); ctx.setLineDash([]); }
        }
        if (r && st.view === 'axial') { ctx.fillStyle = '#1b2430'; ctx.font = '10.5px IBM Plex Mono, monospace'; const t = `${fmt(r.N / 1000)}`; ctx.fillText(t, (X(A.x) + X(B.x)) / 2 + 3, (Y(A.y) + Y(B.y)) / 2 - 3); }
        if (r && st.view === 'bmd' && !M.truss) {
          const L = r.L, c = (B.x - A.x) / L, s = (B.y - A.y) / L, Mmax = Math.max(...res.members.map(q => q.Mmax)) || 1, sc = 0.12 * span / Mmax;
          ctx.fillStyle = '#0f5e8c33'; ctx.strokeStyle = '#0f5e8c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(A.x), Y(A.y));
          r.xs.forEach((x, j) => { const off = -r.Ms[j] * sc; ctx.lineTo(X(A.x + c * x - s * off), Y(A.y + s * x + c * off)); });
          ctx.lineTo(X(B.x), Y(B.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
          const jm = r.Ms.reduce((b, m, j) => Math.abs(m) > Math.abs(r.Ms[b]) ? j : b, 0);
          if (Math.abs(r.Ms[jm]) > 0.25 * Mmax) { const off = -r.Ms[jm] * sc; ctx.fillStyle = '#0f5e8c'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.fillText(fmt(r.Ms[jm] / 1000) + ' kN·m', X(A.x + c * r.xs[jm] - s * off) + 3, Y(A.y + s * r.xs[jm] + c * off) - 3); }
        }
      });
      // deck load arrows
      if (M.deck > 0) {
        const ys = M.nodes.map(n => n.y), dy = M.set.deckTop ? Math.max(...ys) : Math.min(...ys);
        ctx.strokeStyle = '#c2410c88'; ctx.lineWidth = 1;
        M.members.forEach(e => { const A = M.nodes[e.a], B = M.nodes[e.b]; if (!(Math.abs(A.y - dy) < 1e-6 && Math.abs(B.y - dy) < 1e-6) || U) return; for (let t = 0.1; t < 1; t += 0.2) { const x = X(A.x + (B.x - A.x) * t), y = Y(A.y); ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 3); ctx.lineTo(x - 2, y - 6); ctx.moveTo(x, y - 3); ctx.lineTo(x + 2, y - 6); ctx.stroke(); } });
      }
      // vehicle
      if (moving && moving.X != null && !U) { const x = X(moving.X), y = Y(res && res.ok ? (M.set.deckTop ? Math.max(...M.nodes.map(n => n.y)) : Math.min(...M.nodes.map(n => n.y))) : 0); ctx.fillStyle = '#c2410c'; ctx.fillRect(x - 18, y - 22, 36, 14); ctx.beginPath(); ctx.arc(x - 10, y - 6, 4, 0, 7); ctx.arc(x + 10, y - 6, 4, 0, 7); ctx.fill(); }
      // nodes, supports, loads
      M.nodes.forEach((n, i) => {
        const [px, py] = [X(nodePos(i)[0]), Y(nodePos(i)[1])];
        drawSupport(ctx, px, py, n.sup);
        ctx.fillStyle = st.sel === i ? '#ff8a4c' : '#fff'; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py, st.sel === i ? 6 : 4.2, 0, 7); ctx.fill(); ctx.stroke();
        if (st.pendingA === i) { ctx.strokeStyle = '#ff8a4c'; ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.stroke(); }
      });
      M.loads.forEach(l => { const n = M.nodes[l.n]; if (!n) return; const mag = Math.hypot(l.Fx || 0, l.Fy || 0); if (!mag) return; const ux = (l.Fx || 0) / mag, uy = (l.Fy || 0) / mag, x = X(n.x), y = Y(n.y), Ln = 38;
        ctx.strokeStyle = '#c2410c'; ctx.fillStyle = '#c2410c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - ux * Ln, y + uy * Ln); ctx.lineTo(x - ux * 6, y + uy * 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - ux * 5, y + uy * 5); ctx.lineTo(x - ux * 13 - uy * 5, y + uy * 13 - ux * 5); ctx.lineTo(x - ux * 13 + uy * 5, y + uy * 13 + ux * 5); ctx.fill();
        ctx.font = '11px IBM Plex Mono, monospace'; ctx.fillText(fmt(mag) + ' kN', x - ux * Ln + 4, y + uy * Ln - 4); });
      if (ok && !U) res.reac.forEach(r => { const n = M.nodes[r.n]; ctx.strokeStyle = '#2f7d32'; ctx.fillStyle = '#2f7d32'; ctx.lineWidth = 1.5; ctx.font = '10px IBM Plex Mono, monospace';
        if (Math.abs(r.Ry) > 1) { const d = Math.sign(r.Ry); ctx.beginPath(); ctx.moveTo(X(n.x) + 12, Y(n.y) + d * 30); ctx.lineTo(X(n.x) + 12, Y(n.y) + 4 * d); ctx.stroke(); ctx.fillText(fmt(r.Ry / 1000) + ' kN', X(n.x) + 16, Y(n.y) + d * 26 + 4); } });
      if (res && !res.ok) { ctx.fillStyle = '#b42318'; ctx.font = '600 13px IBM Plex Sans, sans-serif'; ctx.fillText('⚠ ' + res.msg, 10, 20); }
      if (st.view === 'mode' && modes && modes.ok && modes.modes[modeSel]) { ctx.fillStyle = '#7b3fa0'; ctx.font = '600 13px IBM Plex Sans, sans-serif'; ctx.fillText(`Mode ${modeSel + 1}: ${fmt(modes.modes[modeSel].f)} Hz (${modes.modes[modeSel].dir})`, 10, 20); }
      if (st.view === 'def' && ok) { ctx.fillStyle = '#4a5566'; ctx.font = '12px IBM Plex Sans, sans-serif'; ctx.fillText(`max displacement ${fmt(res.umax * 1000)} mm (exaggerated ×${fmt(scale)})`, 10, 20); }
    }
    function drawSupport(ctx, x, y, s) {
      ctx.strokeStyle = '#1b2430'; ctx.fillStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
      if (s === 'pin' || s === 'roller') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 15); ctx.lineTo(x + 10, y + 15); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (s === 'roller') { ctx.beginPath(); ctx.arc(x - 5, y + 19, 3, 0, 7); ctx.arc(x + 5, y + 19, 3, 0, 7); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x - 14, y + (s === 'roller' ? 23 : 15)); ctx.lineTo(x + 14, y + (s === 'roller' ? 23 : 15)); ctx.stroke(); }
      if (s === 'rollerV') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 15, y - 10); ctx.lineTo(x - 15, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 23, y - 14); ctx.lineTo(x - 23, y + 14); ctx.stroke(); }
      if (s === 'fixed') { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x - 14, y, 28, 9); ctx.strokeRect(x - 14, y, 28, 9); for (let k = -12; k < 14; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, y + 9); ctx.lineTo(x + k - 5, y + 15); ctx.stroke(); } }
    }
    // ---- interaction
    const nearestNode = (px, py, tol = 14) => { let b = -1, d = tol; M.nodes.forEach((n, i) => { const dd = Math.hypot(X(n.x) - px, Y(n.y) - py); if (dd < d) { d = dd; b = i; } }); return b; };
    const nearestMember = (px, py, tol = 8) => { let b = -1, d = tol; M.members.forEach((e, k) => { const A = M.nodes[e.a], B = M.nodes[e.b]; const ax = X(A.x), ay = Y(A.y), bx = X(B.x), by = Y(B.y); const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1; const t = clamp(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2, 0, 1); const dd = Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py); if (dd < d) { d = dd; b = k; } }); return b; };
    const addNode = (x, y) => { const i = M.nodes.findIndex(n => Math.abs(n.x - x) < 1e-6 && Math.abs(n.y - y) < 1e-6); if (i >= 0) return i; M.nodes.push({ x, y, sup: 'free', mass: 0 }); return M.nodes.length - 1; };
    const lastSec = () => (M.members[M.members.length - 1] || {}).sec || 'CHS 114.3×6', lastMat = () => (M.members[M.members.length - 1] || {}).mat || 'IS 2062 E250 structural steel';
    cv.addEventListener('pointerdown', ev => {
      const r = cv.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
      const ni = nearestNode(px, py), mi = ni < 0 ? nearestMember(px, py) : -1;
      const [wx, wy] = toW(px, py), sx = snap(wx), sy = snap(wy);
      modes = null; envelope = null;
      switch (st.tool) {
        case 'move': if (ni >= 0) { st.sel = ni; st.selM = null; drag = { i: ni }; cv.setPointerCapture(ev.pointerId); } else if (mi >= 0) { st.selM = mi; st.sel = null; } else { st.sel = st.selM = null; } break;
        case 'node': st.sel = addNode(sx, sy); break;
        case 'member': { const i = ni >= 0 ? ni : addNode(sx, sy); if (st.pendingA == null) st.pendingA = i; else { if (i !== st.pendingA && !M.members.some(e => (e.a === i && e.b === st.pendingA) || (e.b === i && e.a === st.pendingA))) M.members.push({ a: st.pendingA, b: i, sec: lastSec(), mat: lastMat() }); st.pendingA = i; } break; }
        case 'support': if (ni >= 0) { const seq = ['free', 'pin', 'roller', 'fixed', 'rollerV']; M.nodes[ni].sup = seq[(seq.indexOf(M.nodes[ni].sup) + 1) % seq.length]; st.sel = ni; } break;
        case 'load': if (ni >= 0) { const l = M.loads.find(l => l.n === ni); if (l) l.Fy = (l.Fy || 0) - 10; else M.loads.push({ n: ni, Fx: 0, Fy: -10 }); st.sel = ni; } break;
        case 'del': if (ni >= 0) delNode(ni); else if (mi >= 0) { M.members.splice(mi, 1); st.selM = null; } break;
      }
      save(); solve(); renderProps(); renderResults();
    });
    cv.addEventListener('pointermove', ev => {
      if (!drag) return; const r = cv.getBoundingClientRect(); const [wx, wy] = toW(ev.clientX - r.left, ev.clientY - r.top);
      const n = M.nodes[drag.i]; const nx = snap(wx), ny = snap(wy);
      if (nx !== n.x || ny !== n.y) { n.x = nx; n.y = ny; solve(); renderProps(); renderResultsThrottled(); }
    });
    cv.addEventListener('pointerup', () => { if (drag) { drag = null; save(); renderResults(); } });
    let rT = 0; function renderResultsThrottled() { const t = performance.now(); if (t - rT > 150) { rT = t; renderResults(); } }
    function delNode(i) {
      M.members = M.members.filter(e => e.a !== i && e.b !== i).map(e => ({ ...e, a: e.a > i ? e.a - 1 : e.a, b: e.b > i ? e.b - 1 : e.b }));
      M.loads = M.loads.filter(l => l.n !== i).map(l => ({ ...l, n: l.n > i ? l.n - 1 : l.n }));
      M.nodes.splice(i, 1); st.sel = null;
    }
    function confirmBox(msg) { return true; }
    // ---- property panel
    function renderProps() {
      propCard.innerHTML = '';
      if (st.sel != null && M.nodes[st.sel]) {
        const n = M.nodes[st.sel], i = st.sel, l = M.loads.find(l => l.n === i) || { Fx: 0, Fy: 0 };
        propCard.append(h('div', { class: 'panel-title' }, `Node ${i + 1}`));
        const mk = (label, val, on, opts) => { const inp = opts ? h('select', { class: 'inp' }, opts.map(o => h('option', { value: o }, o))) : h('input', { class: 'inp', type: 'number', step: 'any', value: val }); if (opts) inp.value = val; inp.onchange = () => { on(opts ? inp.value : +inp.value); modes = null; save(); solve(); renderResults(); }; return h('div', { class: 'field' }, h('label', null, label), inp); };
        propCard.append(mk('x [m]', n.x, v => n.x = v), mk('y [m]', n.y, v => n.y = v), mk('Support', n.sup, v => n.sup = v, ['free', 'pin', 'roller', 'rollerV', 'fixed']),
          mk('Load Fx [kN]', l.Fx || 0, v => setLoad(i, 'Fx', v)), mk('Load Fy [kN] (down −)', l.Fy || 0, v => setLoad(i, 'Fy', v)), mk('Lumped mass [kg]', n.mass || 0, v => n.mass = v));
        if (res && res.ok) propCard.append(h('div', { class: 'kv' }, `ux = ${fmt(res.u[3 * i] * 1000)} mm, uy = ${fmt(res.u[3 * i + 1] * 1000)} mm`));
      } else if (st.selM != null && M.members[st.selM]) {
        const e = M.members[st.selM], k = st.selM;
        propCard.append(h('div', { class: 'panel-title' }, `Member ${k + 1} (nodes ${e.a + 1}–${e.b + 1})`));
        const s1 = h('select', { class: 'inp' }, SEC_NAMES.map(o => h('option', { value: o }, o))); s1.value = e.sec;
        const s2 = h('select', { class: 'inp' }, MAT_NAMES.map(o => h('option', { value: o }, o))); s2.value = e.mat;
        s1.onchange = () => { e.sec = s1.value; save(); solve(); renderResults(); }; s2.onchange = () => { e.mat = s2.value; save(); solve(); renderResults(); };
        propCard.append(h('div', { class: 'field wide' }, h('label', null, 'Section'), s1), h('div', { class: 'field wide' }, h('label', null, 'Material'), s2),
          h('button', { class: 'btn ghost sm', onclick: () => { M.members.forEach(m => { m.sec = e.sec; m.mat = e.mat; }); save(); solve(); renderResults(); } }, 'Apply to all members'));
        if (res && res.ok) { const r = res.members[k]; propCard.append(h('div', { class: 'metrics' }, metric('Axial N', fmt(r.N / 1000), 'kN ' + (r.N < 0 ? 'C' : 'T')), metric('M max', fmt(r.Mmax / 1000), 'kN·m'), metric('σ max', fmt(r.sigma / 1e6), 'MPa'), metric('Util. stress', fmt(r.util), '', r.util > 1 ? 'bad' : r.util > 0.9 ? 'warn' : 'good'), metric('Util. buckling', fmt(r.utilB), '', r.utilB > 1 ? 'bad' : r.utilB > 0.9 ? 'warn' : 'good'))); }
      } else propCard.append(h('div', { class: 'small' }, 'Select a node or member to edit it. Tip: drag a node to reshape the structure and watch the forces redistribute in real time.'));
    }
    function setLoad(i, k, v) { let l = M.loads.find(l => l.n === i); if (!l) { l = { n: i, Fx: 0, Fy: 0 }; M.loads.push(l); } l[k] = v; M.loads = M.loads.filter(l => l.Fx || l.Fy); }
    // ---- results
    function totalMass() { let m = 0; M.members.forEach(e => { const mm = matAt(e.mat), sp = secProps(e.sec, 0); const A = M.nodes[e.a], B = M.nodes[e.b]; m += mm.rho * sp.A * Math.hypot(B.x - A.x, B.y - A.y); }); return m; }
    function renderResults() {
      resOut.innerHTML = '';
      if (!res) { resOut.append(h('div', { class: 'small' }, 'Build a structure or load a preset.')); return; }
      if (!res.ok) { resOut.append(h('div', { class: 'badbox' }, '⚠ ' + res.msg)); explain(res.msg); return; }
      [staticTab, modalTab, movingTab, tableTab][tabIdx]();
    }
    function governing() { let k = 0; res.members.forEach((r, i) => { if (r.gov > res.members[k].gov) k = i; }); return k; }
    function staticTab() {
      const k = governing(), r = res.members[k], fe = buildFE();
      const xs = M.nodes.map(n => n.x), span = Math.max(...xs) - Math.min(...xs);
      const dLim = span / 300, nFail = res.members.filter(q => q.gov > 1).length;
      resOut.append(h('div', { class: 'metrics' },
        metric('Max utilisation', fmt(r.gov), '', r.gov > 1 ? 'bad' : r.gov > 0.9 ? 'warn' : 'good'), metric('Governing member', `#${k + 1} · ${r.mode}`, ''),
        metric('Members failing', nFail, '', nFail ? 'bad' : 'good'), metric('Max deflection', fmt(res.umax * 1000), 'mm', res.umax <= dLim ? 'good' : 'warn', 'limit span/300'),
        metric('Span/300 limit', fmt(dLim * 1000), 'mm'), metric('Steel mass', fmt(totalMass()), 'kg'),
        metric('ΔT applied', fmt(fe.dT), '°C'), metric('Wind pressure', fmt(0.6 * ENV.wind ** 2 * (M.set.wind ? 1 : 0)), 'N/m²')));
      // dominance: which load case dominates the governing member
      const parts = [];
      const base = { self: M.set.self, deck: M.deck, thermal: M.set.thermal, wind: M.set.wind, loads: M.loads };
      const single = (cfg) => { const save = { self: M.set.self, deck: M.deck, thermal: M.set.thermal, wind: M.set.wind, loads: M.loads }; M.set.self = cfg.self; M.deck = cfg.deck; M.set.thermal = cfg.thermal; M.set.wind = cfg.wind; M.loads = cfg.loads; const rr = FEM.staticSolve(buildFE()); M.set.self = save.self; M.deck = save.deck; M.set.thermal = save.thermal; M.set.wind = save.wind; M.loads = save.loads; return rr.ok ? rr.members[k] : null; };
      const none = { self: false, deck: 0, thermal: false, wind: false, loads: [] };
      [['Self-weight', { ...none, self: base.self }], ['Deck / imposed load', { ...none, deck: base.deck }], ['Point loads', { ...none, loads: base.loads }], ['Temperature ΔT', { ...none, thermal: base.thermal }], ['Wind', { ...none, wind: base.wind }]].forEach(([nm, cfg]) => { const q = single(cfg); if (q) parts.push({ k: nm, v: Math.abs(q.N) / 1000 + 0, tip: 'axial force contribution' }); });
      const card = h('div', { style: { marginTop: '8px' } }); resOut.append(card);
      const gv = dominanceBars(card, parts.filter(p => p.v > 1e-6), 'kN', `What loads member #${k + 1}? (|axial force| per load case alone)`);
      const fe2 = buildFE(), mm = fe2.members[k].mat;
      const txt = r.gov > 1 ? `Member #${k + 1} fails by <b>${r.mode}</b> (utilisation ${fmt(r.gov)}). ${r.mode === 'buckling' ? 'A compression member: increasing radius of gyration (wider/hollow section) helps more than adding area.' : 'Increase section modulus or area, or add bracing to shorten the load path.'}` : `All members pass. The critical one is #${k + 1} (${r.mode}, utilisation ${fmt(r.gov)}).`;
      verdict(resOut, r.gov <= 1, r.gov <= 1 ? 'Structure is adequate' : 'Structure fails', txt + (gv ? ` Dominant action: <b>${gv.k}</b>.` : '') + (Math.abs(fe2.dT) > 5 && M.nodes.filter(n => n.sup === 'fixed' || n.sup === 'pin').length > 1 ? ` Note: ${fmt(Math.abs(fe2.dT))} °C of restrained thermal strain costs ${fmt(mm.E * mm.alpha * Math.abs(fe2.dT))} MPa in a fully restrained member. That is why bridges sit on a roller at one end.` : ''));
      envWarnings(mm).forEach(w => resOut.append(h('div', { class: 'warnbox' }, '⚠ ' + w)));
      resOut.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn acc', onclick: autoSize }, '⚙ Auto-size members (lightest passing sections)'), h('span', { class: 'small' }, 'Re-analyses after every change: forces redistribute in indeterminate structures, so sizing is iterative.')));
      explain(r.gov > 1 ? `The structure fails. Member ${k + 1} governs by ${r.mode} at utilisation ${fmt(r.gov)}.` : `The structure passes. Maximum utilisation is ${fmt(r.gov)} in member ${k + 1}, governed by ${r.mode}. Maximum deflection is ${fmt(res.umax * 1000)} millimetres.`);
    }
    function autoSize() {
      const fam = s => SECTIONS[s].fam;
      const byMass = f => SEC_NAMES.filter(s => fam(s) === f).sort((a, b) => secProps(a, 0).A - secProps(b, 0).A);
      const m0 = totalMass(); const log = [];
      for (let pass = 0; pass < 8; pass++) {
        solve(); if (!res || !res.ok) break; let changed = 0;
        M.members.forEach((e, k) => {
          const list = byMass(fam(e.sec)), cur = list.indexOf(e.sec), r = res.members[k];
          if (r.gov > 1 && cur < list.length - 1) { e.sec = list[cur + 1]; changed++; }
          else if (r.gov < 0.55 && cur > 0) { const old = e.sec; e.sec = list[cur - 1]; const t = FEM.staticSolve(buildFE()); if (!t.ok || t.members[k].gov > 0.95) e.sec = old; else changed++; }
        });
        log.push(`pass ${pass + 1}: ${changed} members resized`); if (!changed) break;
      }
      solve(); save(); renderProps(); renderResults();
      toast(`Auto-size: ${fmt(m0)} kg → ${fmt(totalMass())} kg (${log.length} passes)`, 4000);
    }
    function modalTab() {
      if (!modes) runModal();
      if (!modes.ok) { resOut.append(h('div', { class: 'badbox' }, modes.msg)); return; }
      const fs = h('div', { class: 'toolbar' });
      modes.modes.forEach((m, i) => fs.append(h('button', { class: 'btn ghost sm' + (i === modeSel ? ' on' : ''), onclick: () => { modeSel = i; st.view = 'mode'; Object.values(vBtns).forEach(x => x.classList.remove('on')); vBtns.mode.classList.add('on'); renderResults(); } }, `f${i + 1} = ${fmt(modes.modes[i].f)} Hz`)));
      resOut.append(h('div', { class: 'panel-title' }, 'Natural frequencies (click to animate)'), fs);
      const ex = h('div'); resOut.append(ex);
      const sp = [{ id: 'zeta', label: 'Damping ratio ζ', value: M.set.zeta, min: 0.002, max: 0.2, step: 0.001, aliases: ['damping'] }, { id: 'fexc', label: 'Your excitation frequency (machine, traffic)', unit: 'Hz', value: M.set.fexc, min: 0.1, max: 50, step: 0.1, aliases: ['excitation'] }];
      const cvF = plotCanvas(); const fbox = h('div');
      buildForm(ex, sp, v => { M.set.zeta = v.zeta; M.set.fexc = v.fexc; save(); frfPlot(); });
      resOut.append(cvF, fbox);
      function frfPlot() {
        const ys = M.nodes.map(n => n.y); let node = st.sel;
        if (node == null) { // pick free node with largest mode-1 amplitude
          let b = 0, bv = -1; M.nodes.forEach((n, i) => { const a = Math.abs(modes.modes[0].phi[3 * i + 1]) + Math.abs(modes.modes[0].phi[3 * i]); if (a > bv) { bv = a; b = i; } }); node = b; }
        const dir = modes.modes[0].dir.startsWith('lat') ? 0 : 1, dof = 3 * node + dir;
        const fmax = Math.max(modes.modes[modes.modes.length - 1].f * 1.2, M.set.fexc * 1.3, 5), fr = linspace(0.05, fmax, 600);
        const H = FEM.frf(modes.modes, dof, dof, fr, M.set.zeta);
        const st0 = FEM.frf(modes.modes, dof, dof, [1e-4], M.set.zeta)[0];
        const daf = H.map(x => x / st0);
        plot(cvF, { title: `Frequency response at node ${node + 1} (${dir ? 'vertical' : 'horizontal'}): dynamic amplification`, xlabel: 'Excitation frequency (Hz)', ylabel: '|X| / X_static', logy: true, ymin: 0.01, series: [{ x: fr, y: daf, color: '#7b3fa0' }],
          bands: [{ x0: 1.6, x1: 2.4, color: '#fde68a66' }, { x0: 0.8, x1: 1.2, color: '#bfdbfe66' }], vlines: [{ x: M.set.fexc, label: 'your excitation' }] });
        const peak = Math.max(...daf), fNear = modes.modes.reduce((b, m) => Math.abs(m.f - M.set.fexc) < Math.abs(b.f - M.set.fexc) ? m : b, modes.modes[0]);
        const dafExc = FEM.frf(modes.modes, dof, dof, [M.set.fexc], M.set.zeta)[0] / st0;
        const ped = modes.modes.filter(m => m.f >= 1.6 && m.f <= 2.4 && m.dir.startsWith('vert')), lat = modes.modes.filter(m => m.f >= 0.5 && m.f <= 1.2 && m.dir.startsWith('lat'));
        fbox.innerHTML = '';
        fbox.append(h('div', { class: 'legend', html: '<span><i style="background:#fde68a"></i>walking (vertical) 1.6–2.4 Hz</span><span><i style="background:#bfdbfe"></i>walking (lateral) 0.8–1.2 Hz</span>' }));
        fbox.append(h('div', { class: 'metrics' }, metric('Fundamental f1', fmt(modes.modes[0].f), 'Hz'), metric('Structure mass', fmt(modes.mass / 1000), 't'),
          metric('Peak amplification ≈ 1/(2ζ)', fmt(peak), '×'), metric('Amplification at your excitation', fmt(dafExc), '×', dafExc < 1.5 ? 'good' : dafExc < 5 ? 'warn' : 'bad'),
          metric('Nearest mode to excitation', `${fmt(fNear.f)} Hz`, '', Math.abs(fNear.f - M.set.fexc) / M.set.fexc < 0.2 ? 'bad' : 'good')));
        const notes = [];
        if (ped.length) notes.push(`⚠ Mode at ${fmt(ped[0].f)} Hz lies in the vertical walking band. Footfall can resonate it (comfort limit ~0.7 m/s²). Stiffen the deck or add tuned mass dampers.`);
        if (lat.length) notes.push(`⚠ Lateral mode at ${fmt(lat[0].f)} Hz is in the lateral walking band: synchronous lateral excitation (London Millennium Bridge, 2000).`);
        if (!ped.length && !lat.length) notes.push('No mode falls in the pedestrian walking bands.');
        notes.push(`Static strength said nothing about this. At resonance the response is ${fmt(peak)}× the static deflection for ζ = ${M.set.zeta}: <b>damping, not strength, is the dominant factor</b>. Steel bridges have ζ ≈ 0.005–0.02.`);
        fbox.append(h('div', { class: 'note', html: notes.join('<br>') }));
        explain(`The fundamental natural frequency is ${fmt(modes.modes[0].f)} hertz. At your excitation of ${M.set.fexc} hertz the dynamic amplification is ${fmt(dafExc)} times. ${ped.length ? 'One mode lies in the pedestrian walking band.' : ''}`);
      }
      frfPlot();
    }
    function stopMoving() { if (moving) { moving.run = false; } moving = null; }
    function movingTab() {
      const box = h('div'); resOut.append(box);
      const sp = [{ id: 'P1', label: 'Front axle load', unit: 'kN', value: 50, min: 0, max: 500, step: 1, aliases: ['axle'] }, { id: 'P2', label: 'Rear axle load', unit: 'kN', value: 100, min: 0, max: 500, step: 1 }, { id: 'sp', label: 'Axle spacing', unit: 'm', value: 4, min: 0, max: 20, step: 0.1 }, { id: 'imp', label: 'Impact (dynamic) factor', value: M.set.impact, min: 1, max: 1.8, step: 0.01, aliases: ['impact factor'] }];
      const mv = buildForm(box, sp, () => { }, 'moving');
      const cvI = plotCanvas(), info = h('div');
      const runB = h('button', { class: 'btn acc', onclick: () => start() }, '▶ Drive vehicle across');
      box.append(h('div', { class: 'toolbar' }, runB, h('span', { class: 'small' }, 'Select a member first to trace its influence line (default: governing member).')), cvI, info);
      function start() {
        const fe = buildFE(); const deck = fe.members.map((e, k) => ({ e, k })).filter(o => o.e.isDeck);
        if (!deck.length) { info.innerHTML = '<div class="badbox">No horizontal deck members at the deck level.</div>'; return; }
        const xs = deck.flatMap(o => [M.nodes[o.e.a].x, M.nodes[o.e.b].x]), x0 = Math.min(...xs), x1 = Math.max(...xs);
        const v = mv.vals, sel = st.selM != null ? st.selM : governing();
        envelope = new Float64Array(M.members.length); il = { X: [], N: [], d: [] };
        moving = { X: x0 - v.sp, run: true };
        const axles = () => [{ P: v.P1 * v.imp * 1000, off: 0 }, { P: v.P2 * v.imp * 1000, off: -v.sp }];
        const step = () => {
          if (!moving || !moving.run) return;
          moving.X += (x1 - x0 + v.sp) / 160;
          const mp = [];
          axles().forEach(a => { const xa = moving.X + a.off; if (xa < x0 || xa > x1) return; const d = deck.find(o => { const A = M.nodes[o.e.a].x, B = M.nodes[o.e.b].x; return xa >= Math.min(A, B) - 1e-9 && xa <= Math.max(A, B) + 1e-9; }); if (!d) return; const A = M.nodes[d.e.a].x, B = M.nodes[d.e.b].x; mp.push({ m: d.k, f: (xa - A) / (B - A), Fx: 0, Fy: -a.P }); });
          solve({ mpoints: mp });
          if (res && res.ok) { res.members.forEach((r, k) => envelope[k] = Math.max(envelope[k], r.gov)); il.X.push(moving.X); il.N.push(res.members[sel].N / 1000); il.d.push(res.umax * 1000); }
          plot(cvI, { title: `Influence of vehicle position on member #${sel + 1} axial force`, xlabel: 'Front-axle position (m)', ylabel: 'N (kN, tension +)', xmin: x0 - v.sp, xmax: x1, series: [{ x: il.X, y: il.N, label: 'member force' }, { x: il.X, y: il.d, label: 'max deflection (mm)', dash: [4, 3] }] });
          if (moving.X < x1) setTimeout(step, 30);
          else { moving.run = false; const worst = Array.from(envelope).reduce((b, u, k) => u > envelope[b] ? k : b, 0); info.innerHTML = ''; info.append(h('div', { class: 'metrics' }, metric('Envelope max utilisation', fmt(envelope[worst]), '', envelope[worst] > 1 ? 'bad' : envelope[worst] > 0.9 ? 'warn' : 'good'), metric('Critical member', '#' + (worst + 1), ''), metric('Force range in #' + (sel + 1), `${fmt(Math.min(...il.N))} … ${fmt(Math.max(...il.N))}`, 'kN'))); info.append(h('div', { class: 'note', html: `Colours now show the <b>envelope</b>: the worst state of each member over the whole crossing. Diagonals near mid-span often <b>reverse sign</b> as the vehicle passes (tension ↔ compression), so they must be checked for buckling <i>and</i> fatigue; static analysis with a single load position misses this. Range of stress per crossing × number of vehicles = fatigue spectrum.` })); explain(`After the vehicle crossing, the envelope maximum utilisation is ${fmt(envelope[worst])} in member ${worst + 1}.`); solve(); }
        };
        step();
      }
      if (il && il.X.length) plot(cvI, { xlabel: 'Front-axle position (m)', ylabel: 'N (kN)', series: [{ x: il.X, y: il.N }] });
    }
    function tableTab() {
      const tb = h('table', { class: 't' }, h('tr', null, ...['#', 'Section', 'L (m)', 'N (kN)', 'M (kN·m)', 'σ (MPa)', 'Util σ', 'Pcr (kN)', 'Util buck.', 'Governs'].map(x => h('th', null, x))));
      const rows = [['member', 'section', 'L_m', 'N_kN', 'M_kNm', 'sigma_MPa', 'util_stress', 'Pcr_kN', 'util_buckling', 'governs']];
      res.members.forEach((r, k) => { const row = [k + 1, M.members[k].sec, fmt(r.L), fmt(r.N / 1000), fmt(r.Mmax / 1000), fmt(r.sigma / 1e6), fmt(r.util), isFinite(r.Pcr) ? fmt(r.Pcr / 1000) : '—', fmt(r.utilB), r.mode]; rows.push(row); tb.append(h('tr', { class: r.gov > 1 ? 'fail' : (st.selM === k ? 'hl' : ''), onclick: () => { st.selM = k; st.sel = null; renderProps(); } }, ...row.map(x => h('td', null, String(x))))); });
      resOut.append(h('div', { class: 'tablewrap' }, tb), h('div', { class: 'toolbar' }, h('button', { class: 'btn ghost sm', onclick: () => downloadCSV('mechde-members.csv', rows) }, 'Export CSV')));
    }
    function refreshAll() {
      const setI = (id, v) => { const el = $('#f_' + id); if (!el) return; if (el.type === 'checkbox') el.checked = !!v; else { el.value = v; if (el._slider) el._slider.value = v; } };
      setI('truss', M.truss); setI('deck', M.deck); setI('nsm', M.set.nsm); setI('self', M.set.self); setI('deckTop', M.set.deckTop); setI('thermal', M.set.thermal); setI('wind', M.set.wind); setI('fos', M.set.fos); setI('K', M.set.K);
      view = null; solve(); renderProps(); renderResults();
    }
    MD.voiceActions = { 'auto size': autoSize, 'optimise': autoSize, 'optimize': autoSize, 'modal': () => { st.view = 'mode'; runModal(); renderResults(); } };
    MD.onEnv = () => { modes = null; envelope = null; solve(); renderResults(); };
    solve(); renderProps(); renderResults();
    anim(t => draw(t));
  }
});
