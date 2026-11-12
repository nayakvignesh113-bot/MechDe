/* 2D frame / truss finite-element solver: static, modal, harmonic (FRF). SI units (m, N, Pa, kg). */
'use strict';
const FEM = (() => {
  const zeros = (n, m) => m === undefined ? new Float64Array(n) : Array.from({ length: n }, () => new Float64Array(m));
  function geom(model, e) {
    const A = model.nodes[e.a], B = model.nodes[e.b];
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
    return { L, c: dx / L, s: dy / L };
  }
  function kLocal(E, A, I, L, truss) {
    const k = zeros(6, 6), ea = E * A / L;
    k[0][0] = k[3][3] = ea; k[0][3] = k[3][0] = -ea;
    if (!truss) {
      const a = 12 * E * I / L ** 3, b = 6 * E * I / L ** 2, c = 4 * E * I / L, d = 2 * E * I / L;
      k[1][1] = k[4][4] = a; k[1][4] = k[4][1] = -a;
      k[1][2] = k[2][1] = k[1][5] = k[5][1] = b; k[4][2] = k[2][4] = k[4][5] = k[5][4] = -b;
      k[2][2] = k[5][5] = c; k[2][5] = k[5][2] = d;
    }
    return k;
  }
  function mLocal(mbar, L, truss) {
    const m = zeros(6, 6), t = mbar * L;
    if (truss) { m[0][0] = m[1][1] = m[3][3] = m[4][4] = t / 2; return m; }
    m[0][0] = m[3][3] = t / 3; m[0][3] = m[3][0] = t / 6;
    const f = t / 420;
    const v = [[156, 22 * L, 54, -13 * L], [22 * L, 4 * L * L, 13 * L, -3 * L * L], [54, 13 * L, 156, -22 * L], [-13 * L, -3 * L * L, -22 * L, 4 * L * L]];
    const idx = [1, 2, 4, 5];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) m[idx[i]][idx[j]] = f * v[i][j];
    return m;
  }
  function Tmat(c, s) { const T = zeros(6, 6); T[0][0] = T[1][1] = T[3][3] = T[4][4] = c; T[0][1] = T[3][4] = s; T[1][0] = T[4][3] = -s; T[2][2] = T[5][5] = 1; return T; }
  const toGlobal = (k, T) => { // T^T k T
    const n = 6, tmp = zeros(6, 6), o = zeros(6, 6);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let r = 0; r < n; r++) s += k[i][r] * T[r][j]; tmp[i][j] = s; }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let r = 0; r < n; r++) s += T[r][i] * tmp[r][j]; o[i][j] = s; }
    return o;
  };
  const SUP = { free: [0, 0, 0], pin: [1, 1, 0], roller: [0, 1, 0], rollerV: [1, 0, 0], fixed: [1, 1, 1] };
  function dofMap(model) {
    const n = model.nodes.length, fixed = new Uint8Array(3 * n);
    model.nodes.forEach((nd, i) => { const f = SUP[nd.sup || 'free']; for (let j = 0; j < 3; j++) fixed[3 * i + j] = f[j]; if (model.truss) fixed[3 * i + 2] = 1; });
    // free rotations at nodes with no frame members connected would be singular; fix them
    if (!model.truss) {
      const used = new Uint8Array(n); model.members.forEach(e => { used[e.a] = 1; used[e.b] = 1; });
      for (let i = 0; i < n; i++) if (!used[i]) { fixed[3 * i] = fixed[3 * i + 1] = fixed[3 * i + 2] = 1; }
    }
    const map = new Int32Array(3 * n).fill(-1); let k = 0;
    for (let i = 0; i < 3 * n; i++) if (!fixed[i]) map[i] = k++;
    return { map, nf: k, fixed };
  }
  // equivalent nodal loads (local) for member loads: q (local transverse, N/m), qa (local axial, N/m), point loads [{a (m), P (local y), Pa}]
  function feq(L, q, qa, pts, dTforce, truss) {
    const f = zeros(6);
    f[0] += qa * L / 2; f[3] += qa * L / 2;
    if (truss) { f[1] += q * L / 2; f[4] += q * L / 2; }
    else { f[1] += q * L / 2; f[4] += q * L / 2; f[2] += q * L * L / 12; f[5] -= q * L * L / 12; }
    for (const p of pts) {
      const a = p.a, b = L - a;
      f[0] += p.Pa * b / L; f[3] += p.Pa * a / L;
      if (truss) { f[1] += p.P * b / L; f[4] += p.P * a / L; }
      else {
        f[1] += p.P * b * b * (3 * a + b) / L ** 3; f[4] += p.P * a * a * (a + 3 * b) / L ** 3;
        f[2] += p.P * a * b * b / (L * L); f[5] -= p.P * a * a * b / (L * L);
      }
    }
    f[0] -= dTforce; f[3] += dTforce;
    return f;
  }
  function cholesky(A, n) { // in-place lower; returns false if not SPD
    const L = zeros(n, n);
    for (let j = 0; j < n; j++) {
      let s = A[j][j]; for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
      if (!(s > 1e-9 * Math.abs(A[j][j] || 1)) || s <= 0) return { ok: false, j };
      L[j][j] = Math.sqrt(s);
      for (let i = j + 1; i < n; i++) { let t = A[i][j]; for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k]; L[i][j] = t / L[j][j]; }
    }
    return { ok: true, L };
  }
  function cholSolve(L, b, n) {
    const y = zeros(n), x = zeros(n);
    for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
    return x;
  }
  function jacobiEig(A, n) { // symmetric
    const a = A.map(r => Float64Array.from(r)), v = zeros(n, n);
    for (let i = 0; i < n; i++) v[i][i] = 1;
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22 * (1 + a.reduce((s, r, i) => s + r[i] * r[i], 0))) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
      }
    }
    const vals = []; for (let i = 0; i < n; i++) vals.push(a[i][i]);
    return { vals, vecs: v };
  }
  function assemble(model, wantMass) {
    const N = model.nodes.length, { map, nf, fixed } = dofMap(model);
    const K = zeros(nf, nf), M = wantMass ? zeros(nf, nf) : null, F = zeros(nf), Ffull = zeros(3 * N);
    const elems = [];
    model.members.forEach((e, ei) => {
      const { L, c, s } = geom(model, e), T = Tmat(c, s);
      const p = e.props, truss = model.truss;
      const kl = kLocal(p.E, p.A, p.I, L, truss), kg = toGlobal(kl, T);
      // member loads: global gravity-type w (N/m, along -y) → local components
      const wg = (model.selfWeight ? p.rho * p.A * 9.81 : 0) + (e.deckW || 0);
      // wind (global +x, N/m)
      const wx = e.windW || 0;
      const q = -wg * c + wx * (-s), qa = -wg * s + wx * c; // project (wx,-wg) onto local y=(-s,c), x=(c,s)
      const pts = (model.mpoints || []).filter(pp => pp.m === ei).map(pp => ({ a: pp.f * L, P: (-pp.Fx * s + pp.Fy * c), Pa: pp.Fx * c + pp.Fy * s }));
      const dTf = (model.dT || 0) * p.E * p.A * p.alpha;
      const fl = feq(L, q, qa, pts, dTf, truss);
      const fg = zeros(6); for (let i = 0; i < 6; i++) { let t = 0; for (let r = 0; r < 6; r++) t += T[r][i] * fl[r]; fg[i] = t; }
      const dofs = [3 * e.a, 3 * e.a + 1, 3 * e.a + 2, 3 * e.b, 3 * e.b + 1, 3 * e.b + 2];
      for (let i = 0; i < 6; i++) { Ffull[dofs[i]] += fg[i]; const I = map[dofs[i]]; if (I < 0) continue; F[I] += fg[i]; for (let j = 0; j < 6; j++) { const J = map[dofs[j]]; if (J >= 0) K[I][J] += kg[i][j]; } }
      if (wantMass) {
        const mbar = p.rho * p.A + (e.deckW || 0) / 9.81 * (model.deckMass ? 1 : 0);
        const ml = mLocal(mbar, L, truss), mg = toGlobal(ml, T);
        for (let i = 0; i < 6; i++) { const I = map[dofs[i]]; if (I < 0) continue; for (let j = 0; j < 6; j++) { const J = map[dofs[j]]; if (J >= 0) M[I][J] += mg[i][j]; } }
      }
      const qself = model.selfWeight ? p.rho * p.A * 9.81 * c : 0;
      elems.push({ L, c, s, T, kl, fl, q, qa, pts, dofs, qself });
    });
    (model.loads || []).forEach(ld => { const d = [ld.Fx || 0, ld.Fy || 0, ld.M || 0]; for (let j = 0; j < 3; j++) { Ffull[3 * ld.n + j] += d[j]; const I = map[3 * ld.n + j]; if (I >= 0) F[I] += d[j]; } });
    if (wantMass) model.nodes.forEach((nd, i) => { if (nd.mass) for (let j = 0; j < 2; j++) { const I = map[3 * i + j]; if (I >= 0) M[I][I] += nd.mass; } });
    return { K, M, F, Ffull, map, nf, fixed, elems, N };
  }
  function staticSolve(model) {
    if (!model.members.length) return { ok: false, msg: 'Add members to analyse.' };
    const S = assemble(model, false);
    if (S.nf === 0) return { ok: false, msg: 'Every degree of freedom is fixed.' };
    const ch = cholesky(S.K, S.nf);
    if (!ch.ok) {
      let nd = -1; for (let i = 0; i < S.map.length; i++) if (S.map[i] === ch.j) nd = Math.floor(i / 3);
      return { ok: false, msg: `Unstable structure (mechanism) near node ${nd + 1}. Add supports or bracing members${model.truss ? ', or switch to rigid-joint frame' : ''}.`, node: nd };
    }
    const uf = cholSolve(ch.L, S.F, S.nf);
    const u = zeros(3 * S.N); for (let i = 0; i < u.length; i++) if (S.map[i] >= 0) u[i] = uf[S.map[i]];
    const R = zeros(3 * S.N);
    const res = model.members.map((e, ei) => {
      const el = S.elems[ei], p = e.props;
      const ug = el.dofs.map(d => u[d]);
      const ul = zeros(6); for (let i = 0; i < 6; i++) { let t = 0; for (let r = 0; r < 6; r++) t += el.T[i][r] * ug[r]; ul[i] = t; }
      const f = zeros(6); for (let i = 0; i < 6; i++) { let t = -el.fl[i]; for (let r = 0; r < 6; r++) t += el.kl[i][r] * ul[r]; f[i] = t; }
      // global end forces for reactions
      for (let i = 0; i < 6; i++) { let t = 0; for (let r = 0; r < 6; r++) t += el.T[r][i] * f[r]; R[el.dofs[i]] += t; }
      const N = f[3] + 0; // tension positive (approx; varies with axial loads along member)
      const Nmid = (f[3] - f[0]) / 2;
      // moment diagram
      const ns = 21, xs = [], Ms = [], Vs = [];
      let Mmax = 0, Vmax = 0;
      for (let k = 0; k < ns; k++) {
        const x = el.L * k / (ns - 1);
        let M = model.truss ? 0 : -f[2] + f[1] * x + el.q * x * x / 2;
        let V = f[1] + el.q * x;
        for (const pt of el.pts) if (x > pt.a) { if (!model.truss) M += pt.P * (x - pt.a); V += pt.P; }
        if (model.truss) { M = 0; V = 0; }
        xs.push(x); Ms.push(M); Vs.push(V); Mmax = Math.max(Mmax, Math.abs(M)); Vmax = Math.max(Vmax, Math.abs(V));
      }
      // truss members with gravity: simple-span bending from own weight (secondary)
      if (model.truss) Mmax = Math.abs(el.qself) * el.L * el.L / 8; // deck load assumed delivered to joints via cross-girders
      const Nabs = Math.max(Math.abs(f[0]), Math.abs(f[3]));
      const Nc = Math.min(f[3], -f[0]); // most compressive of the two ends (tension +)
      const sigma = Nabs / p.A + Mmax / (p.I / p.c);
      const allow = p.Sy / model.fos;
      const util = sigma / allow;
      let Pcr = Infinity, utilB = 0;
      if (Nc < 0) { Pcr = Math.PI ** 2 * p.E * p.Imin / (model.K * el.L) ** 2; utilB = (-Nc) / (Pcr / model.fos); }
      return { N: Nmid, Nc, f, xs, Ms, Vs, Mmax, Vmax, sigma, util, Pcr, utilB, gov: Math.max(util, utilB), L: el.L, mode: utilB > util ? 'buckling' : 'stress' };
    });
    // reactions = internal sum minus applied nodal loads at supported DOFs
    const reac = [];
    model.nodes.forEach((nd, i) => {
      if ((nd.sup || 'free') === 'free') return;
      const r = [0, 1, 2].map(j => S.fixed[3 * i + j] && !(model.truss && j === 2) ? R[3 * i + j] - (model.loads || []).filter(l => l.n === i).reduce((s, l) => s + [l.Fx || 0, l.Fy || 0, l.M || 0][j], 0) : 0);
      reac.push({ n: i, Rx: r[0], Ry: r[1], M: r[2] });
    });
    let umax = 0, unode = 0; for (let i = 0; i < S.N; i++) { const d = Math.hypot(u[3 * i], u[3 * i + 1]); if (d > umax) { umax = d; unode = i; } }
    return { ok: true, u, members: res, reac, umax, unode };
  }
  function modal(model, nModes = 6) {
    const S = assemble(model, true);
    if (S.nf === 0) return { ok: false, msg: 'No free DOF' };
    // drop DOFs with zero mass AND keep (truss rotation already fixed). Ensure M SPD: add tiny rotational inertia
    for (let i = 0; i < S.nf; i++) if (S.M[i][i] <= 0) S.M[i][i] = 1e-9;
    const chK = cholesky(S.K, S.nf); if (!chK.ok) return { ok: false, msg: 'Structure is a mechanism; cannot compute modes.' };
    const chM = cholesky(S.M, S.nf); if (!chM.ok) return { ok: false, msg: 'Mass matrix singular' };
    const n = S.nf, L = chM.L;
    // A = L^-1 K L^-T
    const Linv = zeros(n, n);
    for (let j = 0; j < n; j++) { const e = zeros(n); e[j] = 1; for (let i = 0; i < n; i++) { let s = e[i]; for (let k = 0; k < i; k++) s -= L[i][k] * Linv[k][j]; Linv[i][j] = s / L[i][i]; } }
    const tmp = zeros(n, n), A = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < n; k++) s += Linv[i][k] * S.K[k][j]; tmp[i][j] = s; }
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { let s = 0; for (let k = 0; k < n; k++) s += tmp[i][k] * Linv[j][k]; A[i][j] = A[j][i] = s; }
    const { vals, vecs } = jacobiEig(A, n);
    const order = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const modes = [];
    for (const [lam, idx] of order.slice(0, Math.min(nModes, n))) {
      const y = vecs.map(r => r[idx]);
      const phi = zeros(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < n; k++) s += Linv[k][i] * y[k]; phi[i] = s; } // L^-T y
      const full = zeros(3 * S.N); for (let i = 0; i < full.length; i++) if (S.map[i] >= 0) full[i] = phi[S.map[i]];
      const w = Math.sqrt(Math.max(lam, 0));
      // dominant direction
      let ex = 0, ey = 0; for (let i = 0; i < S.N; i++) { ex += full[3 * i] ** 2; ey += full[3 * i + 1] ** 2; }
      modes.push({ w, f: w / (2 * Math.PI), phi: full, dir: ex > ey ? 'lateral (x)' : 'vertical (y)' });
    }
    let mass = 0; model.members.forEach(e => mass += e.props.rho * e.props.A * geom(model, e).L); model.nodes.forEach(n => mass += n.mass || 0);
    return { ok: true, modes, mass };
  }
  // driving-point / transfer FRF by modal superposition: force at dof fi, response at dof ri (full indices)
  function frf(modes, fi, ri, freqs, zeta) {
    return freqs.map(f => {
      const w = 2 * Math.PI * f; let re = 0, im = 0;
      for (const m of modes) {
        const num = m.phi[fi] * m.phi[ri], a = m.w * m.w - w * w, b = 2 * zeta * m.w * w, d = a * a + b * b;
        re += num * a / d; im += -num * b / d;
      }
      return Math.hypot(re, im);
    });
  }
  return { staticSolve, modal, frf, geom, SUP };
})();
