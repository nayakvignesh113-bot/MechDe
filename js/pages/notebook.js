'use strict';
MD.register('notebook', {
  group: 'Design thinking', title: 'Design notebook', icon: '📝', voice: 'notebook notes dictation',
  render(main) {
    pageHead(main, 'Your design record', 'Design notebook',
      'Engineers keep a design log: assumptions, decisions, the governing criterion and why. Type here, or press <b>🎙 Dictate</b> and speak. Anywhere on the site, the global Voice button also accepts <i>"note …"</i>. Notes are kept in this browser only.');
    const ta = h('textarea', { class: 'notes', placeholder: 'e.g. Shaft for conveyor drive: d = 45 mm governed by bearing slope; switched to self-aligning bearings…' });
    ta.value = store('notes') || '';
    ta.addEventListener('input', () => store('notes', ta.value));
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
    const dict = h('button', { class: 'btn acc', onclick: () => {
      if (rec) { rec.stop(); rec = null; dict.textContent = '🎙 Dictate'; return; }
      if (!SR) { toast('Dictation needs Chrome/Edge with microphone access (open the hosted site directly).', 4500); return; }
      rec = new SR(); rec.lang = 'en-IN'; rec.continuous = true; rec.interimResults = false;
      rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { ta.value += (ta.value && !ta.value.endsWith('\n') ? ' ' : '') + e.results[i][0].transcript.trim(); store('notes', ta.value); } };
      rec.onerror = e => { toast('Dictation error: ' + e.error); rec = null; dict.textContent = '🎙 Dictate'; };
      rec.onend = () => { if (rec) try { rec.start(); } catch (e) { } };
      try { rec.start(); dict.textContent = '■ Stop dictation'; } catch (e) { toast('Microphone unavailable'); rec = null; }
    } }, '🎙 Dictate');
    const last = MD.lastExplain;
    main.append(h('div', { class: 'toolbar' }, dict,
      h('button', { class: 'btn ghost', onclick: () => { if (!last) return toast('Open a design module first'); ta.value += `\n[${new Date().toLocaleString()} · ${MD.pages[last.page] ? MD.pages[last.page].title : last.page}] ${last.text}`; store('notes', ta.value); } }, '＋ Append last verdict' + (last && last.page !== 'notebook' ? ` (${MD.pages[last.page] ? MD.pages[last.page].title : ''})` : '')),
      h('button', { class: 'btn ghost', onclick: () => copyText(ta.value) }, 'Copy all'),
      h('button', { class: 'btn ghost', onclick: () => { ta.value += `\n--- ${new Date().toLocaleDateString()} ---\nRequirement:\nLoads & environment:\nCandidate concepts:\nGoverning failure mode:\nDecision & reason:\n`; store('notes', ta.value); } }, 'Insert design-record template')), ta);
    MD.cleanup = () => { if (rec) { const r = rec; rec = null; r.stop(); } };
    main.append(h('h2', null, 'A design method that works for any component'));
    main.append(h('div', { class: 'grid3' },
      h('div', { class: 'card', html: '<h3>1 · Requirement & loads</h3><p class="small">Function, life, duty cycle, environment. Draw the free-body diagram. Kinematics → dynamics gives the real loads, including inertia and shock (service factor).</p>' }),
      h('div', { class: 'card', html: '<h3>2 · List every failure mode</h3><p class="small">Yield, fracture, fatigue, buckling, excessive deflection, wear/pitting, resonance, creep, corrosion, loosening. Each becomes a constraint.</p>' }),
      h('div', { class: 'card', html: '<h3>3 · Size for each, take the worst</h3><p class="small">Solve each constraint for the unknown dimension. The largest governs. Iterate where factors depend on size. Round up to a standard size.</p>' }),
      h('div', { class: 'card', html: '<h3>4 · Ask "what if?"</h3><p class="small">Sweep speed, temperature, medium, material, geometry. A design near a crossover (two modes governing together) is efficient but sensitive. Know which way it tips.</p>' }),
      h('div', { class: 'card', html: '<h3>5 · Close the loop</h3><p class="small">New size → new mass, stiffness, frequency → re-check dynamics. Then manufacturability, assembly, inspection and cost.</p>' }),
      h('div', { class: 'card', html: '<h3>6 · Record why</h3><p class="small">Write down the governing criterion and the assumptions behind it. When requirements change, you will know which decision to revisit.</p>' })));
    explain('The design notebook stores your notes and decisions in this browser. Press dictate to speak notes.');
  }
});
