/* Voice control (Web Speech API) and spoken explanations */
'use strict';
const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, on = false;
  const norm = s => String(s).toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\[.*?\]/g, ' ').replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const WORDNUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, thousand: 1000 };
  function score(phrase, target) {
    const a = norm(phrase).split(' ').filter(w => w.length > 1), b = norm(target).split(' ');
    if (!a.length) return 0; let s = 0;
    a.forEach(w => { if (b.includes(w)) s += 1; else if (b.some(x => x.startsWith(w) || w.startsWith(x) && x.length > 2)) s += 0.6; });
    return s / Math.max(a.length, 1);
  }
  function handle(raw) {
    let t = norm(raw).replace(/\b(minus|negative)\s+/g, '-');
    Object.keys(WORDNUM).forEach(k => t = t.replace(new RegExp('\\b' + k + '\\b', 'g'), WORDNUM[k]));
    t = t.replace(/(\d) point (\d)/g, '$1.$2');
    if (/^(stop|stop listening|quiet)$/.test(t)) { stop(); return 'Stopped listening'; }
    if (/^(explain|read|speak|read results|what is the verdict|verdict)/.test(t)) { speak(MD.explain || 'Nothing to explain on this page yet.'); return 'Explaining…'; }
    let m = t.match(/^(?:note|dictate|write)\s+(.*)$/);
    if (m) { const n = store('notes') || ''; store('notes', n + (n ? '\n' : '') + `[${new Date().toLocaleString()} · ${MD.current}] ` + raw.replace(/^\s*(note|dictate|write)\s+/i, '')); if (MD.current === 'notebook') MD.route(); return 'Noted'; }
    m = t.match(/^(?:go to|open|show|navigate to)\s+(.*)$/);
    if (m) {
      let best = null, bs = 0;
      for (const id of MD.order) { const p = MD.pages[id]; const s = Math.max(score(m[1], p.title + ' ' + id + ' ' + (p.voice || '')), 0); if (s > bs) { bs = s; best = id; } }
      if (best && bs >= 0.5) { location.hash = best; return 'Opening ' + MD.pages[best].title; }
      return 'No page matches “' + m[1] + '”';
    }
    for (const k in (MD.voiceActions || {})) if (t.includes(k)) { MD.voiceActions[k](); return k; }
    m = t.match(/^(?:set|make|change|put)?\s*(.+?)\s+(?:to|equals|equal to|at|is|as)?\s*(-?\d+(?:\.\d+)?)\b/);
    let name, val;
    if (m) { name = m[1]; val = parseFloat(m[2]); }
    else { m = t.match(/^(?:set|make|change|use)\s+(.+?)\s+(?:to|as)\s+(.+)$/); if (m) { name = m[1]; val = m[2]; } }
    if (name != null) {
      let best = null, bs = 0;
      for (const id in MD.fields) {
        const f = MD.fields[id], s = Math.max(score(name, f.spec.label + ' ' + id), ...(f.spec.aliases || []).map(a => score(name, a) * 1.05));
        if (s > bs) { bs = s; best = f; }
      }
      if (best && bs >= 0.5) { const ok = best.set(val); return ok === false ? 'Option not found' : `${norm(best.spec.label)} → ${val}`; }
      return 'No field matches “' + name + '”';
    }
    return 'Heard: “' + raw + '” (try “set power to 15”, “go to gear”, “explain”)';
  }
  function start() {
    if (!SR) { toast('Voice needs Chrome/Edge (Web Speech API). In-app previews block the microphone. Open the GitHub Pages site.', 5000); return; }
    rec = new SR(); rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) toast('🎙 ' + handle(e.results[i][0].transcript)); };
    rec.onerror = e => { toast('Voice error: ' + e.error + (e.error === 'not-allowed' ? '. Microphone blocked; open the site directly in Chrome.' : ''), 4500); stop(); };
    rec.onend = () => { if (on) try { rec.start(); } catch (e) { } };
    try { rec.start(); on = true; $('#voiceBtn').classList.add('on'); toast('Listening… say “set torque to 400” or “go to shaft”'); } catch (e) { toast('Could not start microphone'); }
  }
  function stop() { on = false; try { rec && rec.stop(); } catch (e) { } $('#voiceBtn').classList.remove('on'); }
  function speak(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g, '').replace(/σ/g, 'sigma').replace(/τ/g, 'tau').replace(/≥/g, ' at least ').replace(/×/g, ' times '));
      u.lang = 'en-IN'; u.rate = 1.02; speechSynthesis.speak(u);
    } catch (e) { toast('Speech not available'); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('#voiceBtn').onclick = () => on ? stop() : start();
    $('#speakBtn').onclick = () => speak(MD.explain || 'Open a design module and I will explain the governing result.');
  });
  return { handle, speak, start, stop };
})();
