/* Minimal canvas line/scatter plotter */
'use strict';
const PALETTE = ['#0f5e8c', '#c2410c', '#2f7d32', '#7b3fa0', '#b26a00', '#475569', '#0e7490'];
function niceStep(range, n = 5) {
  const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
function plot(cv, cfg) {
  const { ctx, w, h: H } = setupCanvas(cv);
  ctx.clearRect(0, 0, w, H);
  const S = cfg.series.filter(s => s.x && s.x.length);
  let xs = [], ys = [];
  S.forEach(s => { s.x.forEach((v, i) => { if (isFinite(v) && isFinite(s.y[i])) { xs.push(v); ys.push(s.y[i]); } }); });
  (cfg.points || []).forEach(p => { xs.push(p.x); ys.push(p.y); });
  (cfg.hlines || []).forEach(l => ys.push(l.y));
  (cfg.vlines || []).forEach(l => xs.push(l.x));
  const lx = cfg.logx, ly = cfg.logy;
  const tx = v => lx ? Math.log10(v) : v, ty = v => ly ? Math.log10(v) : v;
  let x0 = cfg.xmin ?? Math.min(...xs), x1 = cfg.xmax ?? Math.max(...xs);
  let y0 = cfg.ymin ?? Math.min(...ys), y1 = cfg.ymax ?? Math.max(...ys);
  if (!isFinite(x0) || !isFinite(x1)) { x0 = 0; x1 = 1; }
  if (!isFinite(y0) || !isFinite(y1)) { y0 = 0; y1 = 1; }
  if (cfg.ymin == null && !ly && y0 > 0 && y0 < 0.35 * y1) y0 = 0;
  if (x1 === x0) x1 = x0 + 1; if (y1 === y0) { y1 = y0 + 1; }
  if (cfg.ymax == null && !ly) y1 += (y1 - y0) * 0.06;
  if (cfg.ymin == null && !ly && y0 < 0) y0 -= (y1 - y0) * 0.04;
  const X0 = tx(x0), X1 = tx(x1), Y0 = ty(y0), Y1 = ty(y1);
  const L = 58, R = 14, T = cfg.title ? 26 : 12, B = 40;
  const px = v => L + (tx(v) - X0) / (X1 - X0) * (w - L - R);
  const py = v => H - B - (ty(v) - Y0) / (Y1 - Y0) * (H - T - B);
  ctx.font = '11px IBM Plex Sans, sans-serif'; ctx.fillStyle = '#4a5566'; ctx.strokeStyle = '#ece9df'; ctx.lineWidth = 1;
  // ticks
  const tick = (a, b, log) => {
    if (log) { const o = []; for (let e = Math.floor(a); e <= Math.ceil(b); e++) o.push(Math.pow(10, e)); return o; }
    const st = niceStep(b - a), o = []; for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-6; v += st) o.push(+v.toPrecision(10)); return o;
  };
  ctx.textAlign = 'center';
  tick(X0, X1, lx).forEach(v => { if (v < x0 - 1e-12 || v > x1 + 1e-12) return; const X = px(v); ctx.beginPath(); ctx.moveTo(X, T); ctx.lineTo(X, H - B); ctx.stroke(); ctx.fillText(fmt(v), X, H - B + 14); });
  ctx.textAlign = 'right';
  tick(Y0, Y1, ly).forEach(v => { if (v < y0 - 1e-12 || v > y1 + 1e-12) return; const Y = py(v); ctx.beginPath(); ctx.moveTo(L, Y); ctx.lineTo(w - R, Y); ctx.stroke(); ctx.fillText(fmt(v), L - 5, Y + 4); });
  ctx.strokeStyle = '#1b2430'; ctx.strokeRect(L, T, w - L - R, H - T - B);
  if (!ly && y0 < 0 && y1 > 0) { ctx.strokeStyle = '#94a3b8'; ctx.beginPath(); ctx.moveTo(L, py(0)); ctx.lineTo(w - R, py(0)); ctx.stroke(); }
  ctx.fillStyle = '#1b2430'; ctx.font = '600 12px IBM Plex Sans, sans-serif';
  ctx.textAlign = 'center'; if (cfg.xlabel) ctx.fillText(cfg.xlabel, L + (w - L - R) / 2, H - 6);
  if (cfg.title) { ctx.textAlign = 'left'; ctx.fillText(cfg.title, L, 16); }
  if (cfg.ylabel) { ctx.save(); ctx.translate(13, T + (H - T - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(cfg.ylabel, 0, 0); ctx.restore(); }
  ctx.save(); ctx.beginPath(); ctx.rect(L, T, w - L - R, H - T - B); ctx.clip();
  (cfg.bands || []).forEach(b => { ctx.fillStyle = b.color || '#fde68a55'; const a = px(b.x0), c = px(b.x1); ctx.fillRect(a, T, c - a, H - T - B); });
  S.forEach((s, k) => {
    const col = s.color || PALETTE[k % PALETTE.length];
    ctx.strokeStyle = col; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []);
    if (s.scatter) { ctx.fillStyle = col; s.x.forEach((v, i) => { ctx.beginPath(); ctx.arc(px(v), py(s.y[i]), 2.5, 0, 7); ctx.fill(); }); }
    else {
      ctx.beginPath(); let pen = false;
      s.x.forEach((v, i) => { const yv = s.y[i]; if (!isFinite(v) || !isFinite(yv) || (ly && yv <= 0)) { pen = false; return; } const X = px(v), Y = py(yv); pen ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); pen = true; });
      ctx.stroke();
      if (s.fill) { ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.lineTo(px(s.x[s.x.length - 1]), py(Math.max(y0, 0))); ctx.lineTo(px(s.x[0]), py(Math.max(y0, 0))); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.setLineDash([]);
  });
  ctx.font = '11px IBM Plex Sans, sans-serif';
  (cfg.hlines || []).forEach(l => { ctx.strokeStyle = l.color || '#b42318'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L, py(l.y)); ctx.lineTo(w - R, py(l.y)); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || '#b42318'; ctx.textAlign = 'right'; ctx.fillText(l.label, w - R - 4, py(l.y) - 4); } });
  (cfg.vlines || []).forEach(l => { ctx.strokeStyle = l.color || '#c2410c'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(px(l.x), T); ctx.lineTo(px(l.x), H - B); ctx.stroke(); ctx.setLineDash([]); if (l.label) { ctx.fillStyle = l.color || '#c2410c'; ctx.textAlign = 'left'; ctx.fillText(l.label, px(l.x) + 4, T + 12); } });
  (cfg.points || []).forEach(p => { ctx.fillStyle = p.color || '#c2410c'; ctx.beginPath(); ctx.arc(px(p.x), py(p.y), p.r || 5, 0, 7); ctx.fill(); if (p.label) { ctx.fillStyle = '#1b2430'; ctx.textAlign = 'left'; ctx.fillText(p.label, px(p.x) + 7, py(p.y) - 6); } });
  ctx.restore();
  // legend
  const named = S.filter(s => s.label);
  if (named.length) {
    ctx.font = '11px IBM Plex Sans, sans-serif'; let lx0 = L + 8, ly0 = T + 14;
    const pos = cfg.legend || 'tl';
    const wid = Math.max(...named.map(s => ctx.measureText(s.label).width)) + 30;
    if (pos === 'tr') lx0 = w - R - wid - 4;
    if (pos === 'br') { lx0 = w - R - wid - 4; ly0 = H - B - named.length * 15; }
    if (pos === 'bl') ly0 = H - B - named.length * 15;
    ctx.fillStyle = '#ffffffd9'; ctx.fillRect(lx0 - 4, ly0 - 11, wid, named.length * 15 + 3);
    named.forEach((s, i) => { const col = s.color || PALETTE[S.indexOf(s) % PALETTE.length]; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx0, ly0 + i * 15 - 4); ctx.lineTo(lx0 + 18, ly0 + i * 15 - 4); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#1b2430'; ctx.textAlign = 'left'; ctx.fillText(s.label, lx0 + 23, ly0 + i * 15); });
  }
  cv._plotcfg = cfg;
  return { px, py };
}
function plotCanvas(cls = 'plot', hgt) { const c = h('canvas', { class: cls }); if (hgt) c.style.height = hgt + 'px'; return c; }
// re-plot on resize
window.addEventListener('resize', () => { $$('canvas.plot').forEach(c => c._plotcfg && plot(c, c._plotcfg)); });
