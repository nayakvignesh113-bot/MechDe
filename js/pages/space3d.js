'use strict';
/* 3D space trusses: pin-jointed members, 3 DOF per node. Static (direct stiffness), member buckling (Euler), modal (inverse iteration). */
const S3 = {
  // ---- model generators: return { nodes:[[x,y,z]], members:[[i,j]], fixed:[i], load:[i], lat:[i] } (metres)
  gen(v) {
    const N = [], M = [], add = (x, y, z) => (N.push([x, y, z]), N.length - 1), mem = (a, b) => M.push([a, b]);
    const P = v.preset, n = Math.max(1, Math.round(v.n));
    let fixed = [], load = [], lat = [];
    if (P === 'Lattice tower' || P === 'Crane mast + jib') {
      const H = v.H, B = v.B, Bt = P === 'Lattice tower' ? B * v.taper : B, lv = [];
      for (let i = 0; i <= n; i++) {
        const z = H * i / n, b = (B + (Bt - B) * i / n) / 2;
        lv.push([add(-b, -b, z), add(b, -b, z), add(b, b, z), add(-b, b, z)]);
      }
      for (let i = 0; i <= n; i++) {
        const L = lv[i];
        for (let k = 0; k < 4; k++) mem(L[k], L[(k + 1) % 4]);
        mem(L[0], L[2]); // plan diagonal keeps the square from racking
        if (i < n) { const U = lv[i + 1]; for (let k = 0; k < 4; k++) { mem(L[k], U[k]); mem(L[k], U[(k + 1) % 4]); } }
      }
      fixed = lv[0].slice();
      if (P === 'Lattice tower') { load = lv[n].slice(); lat = lv[n].slice(); }
      else {
        const T = lv[n], b = B / 2, hj = B * 0.9, m = Math.max(2, Math.round(v.J / (B * 1.2))), s = v.J / m;
        const top = add(b, 0, H + hj); T.forEach(k => mem(k, top));
        let pm = T[1], pp = T[2], pt = top;
        for (let j = 1; j <= m; j++) {
          const x = b + j * s, w = b * (1 - 0.5 * j / m), ht = hj * (1 - 0.65 * j / m);
          const bm = add(x, -w, H), bp = add(x, w, H), tt = add(x, 0, H + ht);
          mem(bm, bp); mem(bm, tt); mem(bp, tt); mem(pm, bm); mem(pp, bp); mem(pt, tt);
          mem(pm, bp); mem(pm, tt); mem(pp, tt);
          pm = bm; pp = bp; pt = tt;
        }
        load = [pm, pp]; lat = T.slice();
      }
    } else if (P === 'Space-frame roof') {
      const L = v.H, d = v.B, a = L / n, top = [], bot = [];
      for (let i = 0; i <= n; i++) { top.push([]); for (let j = 0; j <= n; j++) top[i].push(add(i * a - L / 2, j * a - L / 2, d)); }
      for (let i = 0; i < n; i++) { bot.push([]); for (let j = 0; j < n; j++) bot[i].push(add((i + 0.5) * a - L / 2, (j + 0.5) * a - L / 2, 0)); }
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { if (i < n) mem(top[i][j], top[i + 1][j]); if (j < n) mem(top[i][j], top[i][j + 1]); }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i < n - 1) mem(bot[i][j], bot[i + 1][j]); if (j < n - 1) mem(bot[i][j], bot[i][j + 1]);
        [top[i][j], top[i + 1][j], top[i][j + 1], top[i + 1][j + 1]].forEach(t => mem(bot[i][j], t));
      }
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
        if (i === 0 || j === 0 || i === n || j === n) fixed.push(top[i][j]); else load.push(top[i][j]);
      }
      if (!load.length) load = [top[0][0]];
      lat = load.slice();
    } else { // tripod / sheer legs
      const H = v.H, R = v.B / 2, apex = add(0, 0, H);
      for (let k = 0; k < 3; k++) { const t = Math.PI / 2 + k * 2 * Math.PI / 3; const b = add(R * Math.cos(t), R * Math.sin(t), 0); mem(b, apex); fixed.push(b); }
      load = [apex]; lat = [apex];
    }
    return { nodes: N, members: M, fixed, load, lat };
  },
  // ---- dense helpers
  chol(A, n) {
    const L = Array.from({ length: n }, () => new Float64Array(n));
    for (let j = 0; j < n; j++) {
      let s = A[j][j]; for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
      if (!(s > 1e-10 * Math.abs(A[j][j] || 1))) return null;
      L[j][j] = Math.sqrt(s);
      for (let i = j + 1; i < n; i++) { let t = A[i][j]; for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k]; L[i][j] = t / L[j][j]; }
    }
    return L;
  },
  csolve(L, b, n) {
    const y = new Float64Array(n), x = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
    return x;
  },
  // ---- analysis
  solve(v, model) {
    const g = model || S3.gen(v), mat = matAt(v.mat), E = mat.E * 1e6, rho = mat.rho; // Pa, kg/m³
    const D = v.D / 1000, t = Math.min(v.t, v.D / 2) / 1000, d = D - 2 * t;
    const A = Math.PI / 4 * (D * D - d * d), I = Math.PI / 64 * (D ** 4 - d ** 4), r = Math.sqrt(I / A);
    const nn = g.nodes.length, fixedSet = new Set(g.fixed), map = new Int32Array(3 * nn).fill(-1); let nf = 0;
    for (let i = 0; i < nn; i++) if (!fixedSet.has(i)) for (let k = 0; k < 3; k++) map[3 * i + k] = nf++;
    const K = Array.from({ length: nf }, () => new Float64Array(nf)), F = new Float64Array(nf), mass = new Float64Array(nf);
    const geo = g.members.map(([a, b]) => { const p = g.nodes[a], q = g.nodes[b], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz); return { a, b, L, c: [dx / L, dy / L, dz / L] }; });
    let mTot = 0;
    geo.forEach(e => {
      const k = E * A / e.L, dofs = [3 * e.a, 3 * e.a + 1, 3 * e.a + 2, 3 * e.b, 3 * e.b + 1, 3 * e.b + 2].map(q => map[q]);
      const cc = [...e.c, ...e.c.map(x => -x)];
      for (let i = 0; i < 6; i++) { if (dofs[i] < 0) continue; for (let j = 0; j < 6; j++) if (dofs[j] >= 0) K[dofs[i]][dofs[j]] += k * cc[i] * cc[j]; }
      const m = rho * A * e.L * 1.15; mTot += m; // +15 % for joints/nodes
      for (let i = 0; i < 6; i++) if (dofs[i] >= 0) mass[dofs[i]] += m / 2;
    });
    // loads: vertical P (kN total, shared) + lateral W (kN total, +x, shared) + self-weight
    const gN = 9.81, addF = (node, dir, f) => { const q = map[3 * node + dir]; if (q >= 0) F[q] += f; };
    g.load.forEach(i => addF(i, 2, -v.P * 1e3 / g.load.length));
    g.lat.forEach(i => addF(i, 0, v.W * 1e3 / g.lat.length));
    for (let i = 0; i < nn; i++) { const q = map[3 * i + 2]; if (q >= 0) F[q] -= mass[q] * gN; }
    // non-structural mass at load nodes (payload P/g participates in vibration)
    g.load.forEach(i => { for (let k = 0; k < 3; k++) { const q = map[3 * i + k]; if (q >= 0) mass[q] += v.P * 1e3 / gN / g.load.length; } });
    const L = S3.chol(K, nf);
    if (!L) return { mech: true, g, nf, A, I, mTot };
    const u = S3.csolve(L, F, nf), U = new Float64Array(3 * nn);
    for (let i = 0; i < 3 * nn; i++) if (map[i] >= 0) U[i] = u[map[i]];
    const Sy = mat.Sy;
    const res = geo.map((e, ei) => {
      const du = [0, 1, 2].reduce((s, k) => s + (U[3 * e.b + k] - U[3 * e.a + k]) * e.c[k], 0);
      const N = E * A / e.L * du, sig = N / A / 1e6, Pcr = Math.PI ** 2 * E * I / (e.L * e.L);
      const uY = Math.abs(sig) / Sy, uB = N < 0 ? -N / Pcr : 0, slender = e.L / r;
      return Object.assign(e, { i: ei, N, sig, Pcr, uY, uB, u: Math.max(uY, uB), slender, mode: uB > uY ? 'buckling' : N >= 0 ? 'yield (tension)' : 'yield (compression)' });
    });
    const crit = res.reduce((a, b) => b.u > a.u ? b : a, res[0]);
    let dmax = 0, dnode = 0; for (let i = 0; i < nn; i++) { const d3 = Math.hypot(U[3 * i], U[3 * i + 1], U[3 * i + 2]); if (d3 > dmax) { dmax = d3; dnode = i; } }
    // modal: inverse iteration for the lowest 3 modes, M-orthogonal deflation
    const modes = [];
    for (let m = 0; m < 3 && m < nf; m++) {
      let x = new Float64Array(nf).map((_, i) => Math.sin(1.7 * (i + 1) * (m + 1)) + 0.3), lam = 0;
      for (let it = 0; it < 60; it++) {
        modes.forEach(md => { let c = 0; for (let i = 0; i < nf; i++) c += md.x[i] * mass[i] * x[i]; for (let i = 0; i < nf; i++) x[i] -= c * md.x[i]; });
        const y = S3.csolve(L, x.map((xi, i) => mass[i] * xi), nf);
        modes.forEach(md => { let c = 0; for (let i = 0; i < nf; i++) c += md.x[i] * mass[i] * y[i]; for (let i = 0; i < nf; i++) y[i] -= c * md.x[i]; });
        let nm = 0; for (let i = 0; i < nf; i++) nm += y[i] * mass[i] * y[i]; nm = Math.sqrt(nm);
        let xy = 0; for (let i = 0; i < nf; i++) xy += x[i] * mass[i] * y[i];
        const lamNew = 1 / (xy / (nm * nm) || 1e-30); // Rayleigh-like
        x = y.map(q => q / nm);
        if (it > 5 && Math.abs(lamNew - lam) < 1e-7 * Math.abs(lamNew)) { lam = lamNew; break; } lam = lamNew;
      }
      // exact Rayleigh quotient with K
      let kx = 0; for (let i = 0; i < nf; i++) { let s = 0; for (let j = 0; j < nf; j++) s += K[i][j] * x[j]; kx += x[i] * s; }
      const full = new Float64Array(3 * nn); for (let i = 0; i < 3 * nn; i++) if (map[i] >= 0) full[i] = x[map[i]];
      modes.push({ x, f: Math.sqrt(Math.max(kx, 0)) / (2 * Math.PI), U: full });
    }
    modes.sort((a, b) => a.f - b.f);
    return { g, res, crit, U, dmax, dnode, A, I, r, mTot, modes, nf, nFS: 1 / crit.u, mat };
  },
};
const S3_PRESETS = {
  'Lattice tower': { H: 30, B: 4, n: 8, J: 0, taper: 0.4, P: 20, W: 15, D: 89, t: 5 },
  'Space-frame roof': { H: 24, B: 1.8, n: 6, J: 0, taper: 1, P: 300, W: 0, D: 76, t: 4 },
  'Tripod / sheer legs': { H: 4, B: 3, n: 1, J: 0, taper: 1, P: 20, W: 2, D: 60, t: 4 },
  'Crane mast + jib': { H: 24, B: 1.6, n: 10, J: 18, taper: 1, P: 20, W: 5, D: 114, t: 6.3 },
};
MD.register('space3d', {
  group: 'Build & test', title: '3D space trusses', icon: '🗼', voice: 'space truss 3d structure tower space frame roof tripod crane mast lattice',
  kid: { what: 'Towers, cranes and stadium roofs are made of many straight tubes joined at points. Each tube is only pushed or pulled. This page builds the whole thing in 3D, loads it, and shows which tube is pushed hardest and whether it will <b>buckle</b>.', steps: ['Pick a structure (tower, roof, tripod or crane).', 'Set its size, the tube size and the loads.', 'Drag the picture to turn it. Red tubes are pulled, blue tubes are pushed. The thick yellow one is the weakest.', 'Press “Wobble” to see how it vibrates.'], try: 'Make the crane jib longer. Watch the bottom mast legs and the jib chords turn deep blue, and the safety factor drop.' },
  eq: [
    { t: 'Member stiffness (3D)', f: 'k = E·A / L   along the member direction (cx, cy, cz)', m: 'A pin-jointed member carries only axial force. Its 6×6 global stiffness is (EA/L)·[ccᵀ, −ccᵀ; −ccᵀ, ccᵀ], with c the unit vector along it.', fx: [['bigger tube area A', 'every member stiffer: deflection falls ∝ 1/A'], ['longer member L', 'softer, and much easier to buckle (∝ 1/L²)']] },
    { t: 'Equilibrium of the whole structure', f: '[K]·{u} = {F}   →   N = (EA/L)·c·(u_b − u_a)', m: 'Assemble all members, remove supported DOFs, solve. If [K] is singular the structure is a <b>mechanism</b>: it needs more bracing.' },
    { t: 'Stability count (Maxwell, 3D)', f: 'm + r ≥ 3·j', s: [['m', 'members'], ['r', 'support reactions'], ['j', 'joints']], m: 'Necessary, not sufficient: members must also be placed so they actually triangulate every face.' },
    { t: 'Euler buckling of a compression member', f: 'P_cr = π²·E·I / L²', fx: [['double the length', 'buckling load ÷ 4'], ['bigger diameter, same wall', 'I grows ∝ D³: buckling load rises fast (why towers use large thin tubes)']] },
    { t: 'Utilisation and safety factor', f: 'U = max(|σ|/S_y , N_comp/P_cr)   n = 1/U_max' },
    { t: 'Natural frequency', f: '[K]{φ} = ω²[M]{φ},   f = ω/2π', m: 'Found by inverse iteration with lumped masses (members + payload). Keep f well away from wind-gust, machinery or footfall frequencies.' },
  ],
  render(main) {
    pageHead(main, 'Structures', '3D space trusses: towers, roofs, tripods, cranes',
      'Real structures are three-dimensional. A transmission tower, a tower crane and a stadium roof are all <b>space trusses</b>: straight members pinned at joints, so each member is purely in tension or compression. The 2D frame page cannot show <b>torsion</b>, <b>out-of-plane bracing</b> or a jib swinging off a mast; this one can. It solves the full 3D stiffness model live, checks every member for yielding and for <b>Euler buckling</b>, and finds the first natural frequencies.');
    const g = h('div', { class: 'grid2' }), Lc = h('div', { class: 'card' }), R = h('div'); g.append(Lc, R); main.append(g);
    const specs = [
      { id: 'preset', label: 'Structure', type: 'select', options: Object.keys(S3_PRESETS), value: 'Lattice tower', wide: true, aliases: ['structure', 'preset'] },
      { section: 'Geometry' },
      { id: 'H', label: 'Height (roof: span)', unit: 'm', value: 30, min: 2, max: 80, step: 0.5, aliases: ['height', 'span'] },
      { id: 'B', label: 'Base width (roof: depth; tripod: spread)', unit: 'm', value: 4, min: 0.5, max: 12, step: 0.1, aliases: ['width', 'base', 'depth'] },
      { id: 'n', label: 'Panels / bays', value: 8, min: 1, max: 14, step: 1, aliases: ['panels', 'bays'] },
      { id: 'taper', label: 'Tower top width ÷ base width', value: 0.4, min: 0.2, max: 1, step: 0.05, aliases: ['taper'] },
      { id: 'J', label: 'Crane jib length', unit: 'm', value: 20, min: 4, max: 60, step: 1, aliases: ['jib'] },
      { section: 'Members (circular tubes)' },
      { id: 'mat', label: 'Material', type: 'select', options: MAT_NAMES, value: 'IS 2062 E350 structural steel', wide: true, aliases: ['material'] },
      { id: 'D', label: 'Tube outside diameter', unit: 'mm', value: 89, min: 20, max: 400, step: 1, aliases: ['diameter', 'tube'] },
      { id: 't', label: 'Wall thickness', unit: 'mm', value: 5, min: 1, max: 30, step: 0.5, aliases: ['wall', 'thickness'] },
      { section: 'Loads' },
      { id: 'P', label: 'Vertical load (total: roof snow/plant, tower equipment, crane hook)', unit: 'kN', value: 20, min: 0, max: 2000, step: 1, aliases: ['load', 'vertical'] },
      { id: 'W', label: 'Wind / lateral load (total)', unit: 'kN', value: 15, min: 0, max: 500, step: 1, aliases: ['wind', 'lateral'] },
    ];
    const cv = h('canvas', { style: { width: '100%', height: '440px', touchAction: 'none', cursor: 'grab', background: '#fbfaf6', borderRadius: '10px' } });
    const ctl = h('div', { class: 'toolbar' }), out = h('div'), tbl = h('div');
    const view = { yaw: -0.7, pitch: 0.45, show: 'forces', spin: false, amp: 1 };
    const btn = (lab, f, title) => h('button', { class: 'btn ghost sm', onclick: f, title }, lab);
    const showBtns = { forces: btn('Forces', () => setShow('forces'), 'Colour members by tension/compression'), defl: btn('Deflected shape', () => setShow('defl'), 'Exaggerated deflection under load'), mode: btn('〰 Wobble (mode 1)', () => setShow('mode'), 'Animate the first vibration mode') };
    function setShow(s) { view.show = s; Object.entries(showBtns).forEach(([k, b]) => b.classList.toggle('on', k === s)); draw(); }
    ctl.append(...Object.values(showBtns), btn('⟳ Spin', () => { view.spin = !view.spin; }, 'Auto-rotate'), btn('↺ Reset view', () => { view.yaw = -0.7; view.pitch = 0.45; draw(); }));
    R.append(h('div', { class: 'card' }, ctl, cv, canvasLegend([['#c0392b', 'tension (pulled)'], ['#1f5fa8', 'compression (pushed)'], ['#f2b705', 'most critical member'], ['#2f7d32', 'pinned support'], ['#7a3e9d', 'load']]),
      h('p', { class: 'small' }, 'Drag to rotate. Line thickness ∝ member force.')), h('div', { class: 'card', style: { marginTop: '12px' } }, out), h('div', { class: 'card', style: { marginTop: '12px' } }, tbl));
    let R0 = null, lastPreset = null, form;
    // drag rotate
    let drag = null;
    cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, view.yaw, view.pitch]; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', e => { if (!drag) return; view.yaw = drag[2] + (e.clientX - drag[0]) * 0.01; view.pitch = clamp(drag[3] + (e.clientY - drag[1]) * 0.01, -1.4, 1.4); draw(); });
    cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
    function proj(p, sc, cx, cy, ctr) {
      const x = p[0] - ctr[0], y = p[1] - ctr[1], z = p[2] - ctr[2];
      const cyw = Math.cos(view.yaw), syw = Math.sin(view.yaw), x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
      const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch), z2 = z * cp - y1 * sp, dpt = z * sp + y1 * cp;
      return [cx + x1 * sc, cy - z2 * sc, dpt];
    }
    function draw(tm = 0) {
      if (!R0) return; const { ctx, w, h: H } = setupCanvas(cv); ctx.clearRect(0, 0, w, H);
      const g = R0.g, P = g.nodes; let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      P.forEach(p => { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } });
      const ctr = lo.map((l, k) => (l + hi[k]) / 2), span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1, sc = Math.min(w, H) * 0.78 / span;
      let disp = null;
      if (!R0.mech && view.show === 'defl') { const s = 0.08 * span / (R0.dmax || 1); disp = i => [R0.U[3 * i] * s, R0.U[3 * i + 1] * s, R0.U[3 * i + 2] * s]; }
      if (!R0.mech && view.show === 'mode' && R0.modes[0]) { const md = R0.modes[0].U; let mx = 0; for (const q of md) mx = Math.max(mx, Math.abs(q)); const s = 0.07 * span / (mx || 1) * Math.sin(tm * 2 * Math.PI * 0.8); disp = i => [md[3 * i] * s, md[3 * i + 1] * s, md[3 * i + 2] * s]; }
      const pts = P.map((p, i) => { const d = disp ? disp(i) : [0, 0, 0]; return proj([p[0] + d[0], p[1] + d[1], p[2] + d[2]], sc, w / 2, H / 2, ctr); });
      // ground grid
      ctx.strokeStyle = '#e4dfd2'; ctx.lineWidth = 1;
      for (let k = -4; k <= 4; k++) { const a = span * 0.6; [[[k * a / 4, -a, lo[2]], [k * a / 4, a, lo[2]]], [[-a, k * a / 4, lo[2]], [a, k * a / 4, lo[2]]]].forEach(([p, q]) => { const A = proj([p[0] + ctr[0], p[1] + ctr[1], p[2]], sc, w / 2, H / 2, ctr), B = proj([q[0] + ctr[0], q[1] + ctr[1], q[2]], sc, w / 2, H / 2, ctr); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }); }
      const maxN = R0.mech ? 1 : Math.max(...R0.res.map(e => Math.abs(e.N))) || 1;
      const order = g.members.map((m, i) => i).sort((a, b) => (pts[g.members[b][0]][2] + pts[g.members[b][1]][2]) - (pts[g.members[a][0]][2] + pts[g.members[a][1]][2]));
      order.forEach(i => {
        const [a, b] = g.members[i], A = pts[a], B = pts[b]; let col = '#6b7280', lw = 1.5;
        if (!R0.mech) { const e = R0.res[i], f = Math.abs(e.N) / maxN; col = view.show === 'forces' ? (e.N >= 0 ? `rgba(192,57,43,${0.35 + 0.65 * f})` : `rgba(31,95,168,${0.35 + 0.65 * f})`) : '#4b5563'; lw = view.show === 'forces' ? 1 + 4 * f : 1.6; }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      });
      if (!R0.mech) { const c = R0.crit, A = pts[c.a], B = pts[c.b]; ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 7; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.globalAlpha = 1; tag(ctx, `critical: ${c.N < 0 ? 'compression' : 'tension'} ${fmt(Math.abs(c.N) / 1e3)} kN`, (A[0] + B[0]) / 2 + 8, (A[1] + B[1]) / 2, '#8a6500'); }
      // supports
      g.fixed.forEach(i => { const p = pts[i]; ctx.fillStyle = '#2f7d32'; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - 7, p[1] + 11); ctx.lineTo(p[0] + 7, p[1] + 11); ctx.closePath(); ctx.fill(); });
      // loads
      ctx.strokeStyle = ctx.fillStyle = '#7a3e9d'; ctx.lineWidth = 2;
      if (form.vals.P > 0) g.load.forEach(i => { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p[0], p[1] - 28); ctx.lineTo(p[0], p[1] - 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p[0], p[1] - 2); ctx.lineTo(p[0] - 4, p[1] - 10); ctx.lineTo(p[0] + 4, p[1] - 10); ctx.fill(); });
      if (form.vals.W > 0 && g.lat.length) { const p = pts[g.lat[0]], q = proj([P[g.lat[0]][0] - span * 0.12, P[g.lat[0]][1], P[g.lat[0]][2]], sc, w / 2, H / 2, ctr); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); tag(ctx, `wind ${form.vals.W} kN`, q[0] - 4, q[1] - 10, '#7a3e9d', 'right'); }
      if (form.vals.P > 0 && g.load.length) { const p = pts[g.load[0]]; tag(ctx, `${form.vals.P} kN`, p[0] + 6, p[1] - 30, '#7a3e9d'); }
      // axes triad
      const o = [46, H - 40];[[1, 0, 0, 'x'], [0, 1, 0, 'y'], [0, 0, 1, 'z']].forEach(([x, y, z, l]) => { const a = proj([x, y, z], 22, 0, 0, [0, 0, 0]); ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(o[0] + a[0], o[1] + a[1]); ctx.stroke(); tag(ctx, l, o[0] + a[0] * 1.2, o[1] + a[1] * 1.2, '#555', 'center', 11); });
      if (view.show === 'defl') tag(ctx, `deflection × ${fmt(0.08 * span / (R0.dmax || 1))}`, w - 10, 16, '#555', 'right', 11);
      if (view.show === 'mode' && R0.modes[0]) tag(ctx, `mode 1: ${fmt(R0.modes[0].f)} Hz (slowed down)`, w - 10, 16, '#555', 'right', 11);
      if (R0.mech) tag(ctx, 'MECHANISM: the structure cannot carry load (add bracing)', w / 2, 20, '#b42318', 'center', 13);
    }
    anim(t => { if (view.spin && !drag) { view.yaw += 0.006; } if (view.spin || view.show === 'mode') draw(t); });
    function run(v, changed) {
      if (changed === 'preset' && v.preset !== lastPreset) { const p = S3_PRESETS[v.preset]; lastPreset = v.preset; Object.entries(p).forEach(([k, x]) => form && form.set(k, x)); return; }
      lastPreset = v.preset;
      if (form) [['J', 'Crane mast + jib'], ['taper', 'Lattice tower']].forEach(([id, pr]) => { const row = form.inputs[id].closest('.field'); row.style.display = v.preset === pr ? '' : 'none'; });
      const r = S3.solve(v); R0 = r; out.innerHTML = ''; tbl.innerHTML = '';
      const g = r.g, j = g.nodes.length, m = g.members.length, rr = 3 * g.fixed.length;
      if (r.mech) { verdict(out, false, 'Mechanism: the structure folds up', `Members ${m} + reactions ${rr} vs 3 × joints ${3 * j}. Add bracing or supports so every face is triangulated.`); draw(); return; }
      const c = r.crit;
      out.append(h('div', { class: 'metrics' },
        metric('Joints / members', `${j} / ${m}`, '', '', 'Maxwell: m + r ≥ 3j'),
        metric('Safety factor (whole structure)', fmt(r.nFS), '', fsStatus(r.nFS, 1.67)),
        metric('Critical member fails by', c.mode, '', c.uB > c.uY ? 'warn' : ''),
        metric('Critical member force', fmt(Math.abs(c.N) / 1e3), 'kN ' + (c.N < 0 ? 'comp.' : 'tens.')),
        metric('Max deflection', fmt(r.dmax * 1000), 'mm'),
        metric('First natural frequency', fmt(r.modes[0] ? r.modes[0].f : NaN), 'Hz', r.modes[0] && r.modes[0].f < 1 ? 'warn' : ''),
        metric('Steelwork mass', fmt(r.mTot / 1000), 't'),
        metric('Slenderness of critical member L/r', fmt(c.slender), '', c.slender > 200 ? 'bad' : c.slender > 120 ? 'warn' : '')));
      const nb = r.res.filter(e => e.uB > e.uY && e.N < 0).length;
      verdict(out, r.nFS >= 1.67, r.nFS >= 1.67 ? `Safe: worst member at ${fmt(100 * c.u)} % of capacity` : r.nFS >= 1 ? `Marginal: worst member at ${fmt(100 * c.u)} % (target ≤ 60 %)` : `Fails: member ${c.i + 1} is overloaded (${fmt(100 * c.u)} %)`,
        `${nb} of ${m} members are governed by <b>buckling</b> rather than yield. In space trusses this is the usual story: tension members are limited by strength, but long compression members fail first by buckling. ${c.uB > c.uY ? 'Shorter panels or a larger-diameter tube (same wall) is the fix: P_cr grows with D³ and falls with L².' : 'Here yield governs: more wall thickness or a stronger steel helps directly.'} ${r.modes[0] && r.modes[0].f < 1 ? 'The first frequency is below 1 Hz: wind gusts can excite it, so a dynamic wind check is needed.' : ''}`);
      // critical members table
      const top = r.res.slice().sort((a, b) => b.u - a.u).slice(0, 8);
      tbl.append(h('div', { class: 'panel-title' }, 'Most heavily used members'), h('div', { class: 'tablewrap' }, h('table', { class: 't' },
        h('tr', null, ['#', 'Length m', 'Force kN', 'Stress MPa', 'P_cr kN', 'L/r', 'Use %', 'Governs'].map(x => h('th', null, x))),
        top.map(e => h('tr', null, h('td', null, e.i + 1), h('td', null, fmt(e.L)), h('td', { style: { color: e.N < 0 ? '#1f5fa8' : '#c0392b' } }, fmt(e.N / 1e3)), h('td', null, fmt(e.sig)), h('td', null, fmt(e.Pcr / 1e3)), h('td', null, fmt(e.slender)), h('td', { style: { fontWeight: 700, color: e.u > 1 ? 'var(--bad)' : e.u > 0.6 ? 'var(--warn)' : 'var(--good)' } }, fmt(100 * e.u)), h('td', null, e.mode))))),
        h('p', { class: 'small' }, `Modes: ${r.modes.map((md, i) => `f${i + 1} = ${fmt(md.f)} Hz`).join(', ')}. Pinned joints and K = 1 buckling length are assumed; real bolted/welded joints add some rotational restraint (conservative here). Self-weight is included.`));
      $$('.effect', R).forEach(e => e.remove());
      effectTable(R, vv => { const q = S3.solve(vv); return q.mech ? {} : { 'Safety factor': q.nFS, 'Max deflection': q.dmax, 'Mass': q.mTot, 'f₁': q.modes[0] ? q.modes[0].f : NaN }; }, v, specs, { key: 'space3d', skip: ['n', v.preset === 'Crane mast + jib' ? '' : 'J', v.preset === 'Lattice tower' ? '' : 'taper'] });
      draw();
      explain(`${v.preset}: safety factor ${fmt(r.nFS)}, governed by ${c.mode} of a member carrying ${fmt(Math.abs(c.N) / 1e3)} kilonewtons. First natural frequency ${fmt(r.modes[0].f)} hertz.`);
    }
    form = buildForm(Lc, specs, run, 'space3d'); lastPreset = form.vals.preset; run(form.vals); run(form.vals);
    setShow('forces');
    MD.onEnv = () => run(form.vals);
    window.addEventListener('resize', () => draw(), { once: true });
  }
});
