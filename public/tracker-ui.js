// Cigarette tracker page: one big button, time since the last cigarette, a 14-day trend,
// and what published studies find at the person's current level. Stored on this device only.
'use strict';
(() => {
  const T = window.Tracker, H = window.Health;
  const $ = (id) => document.getElementById(id);
  const num = (n, d = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = (rr) => `${num((rr - 1) * 100)}%`;
  const time = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dayName = (t) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  let state = T.load(localStorage);
  if (!state) { state = T.newState(); T.save(localStorage, state); }
  const persist = () => T.save(localStorage, state);

  function duration(ms) {
    const m = Math.floor(ms / 60e3), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 1) return `${d}d ${h % 24}h`;
    if (h >= 1) return `${h}h ${m % 60}m`;
    return `${m}m`;
  }

  // ---- hero --------------------------------------------------------------------
  function renderHero(sum) {
    $('since').textContent = duration(sum.sinceLastMs);
    $('sinceLabel').textContent = sum.everSmoked ? 'since your last cigarette' : 'since you started tracking';
    $('smokeSub').textContent = `Today: ${sum.today} · 7-day average: ${num(sum.average7, 1)} a day`;
    $('undo').disabled = !state.smokes.length;
  }

  $('smoke').addEventListener('click', () => {
    const now = Date.now();
    state.smokes.push(now);
    persist();
    if (navigator.vibrate) navigator.vibrate(30);
    const btn = $('smoke');
    btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
    $('logged').textContent = `Logged at ${time(now)}. Tracking honestly is how cutting down starts.`;
    render();
  });
  $('undo').addEventListener('click', () => {
    if (!state.smokes.length) return;
    state.smokes.pop();
    persist();
    $('logged').textContent = 'Removed the last one.';
    render();
  });

  // ---- shared chart bits ---------------------------------------------------------
  // Charts are drawn at the container's real width so text stays a readable size on phones.
  const width = (id) => Math.max(320, Math.round($(id).clientWidth || 640));
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const niceMax = (v) => {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  };
  function placeTip(tip, svg, xFrac) {
    tip.hidden = false;
    const w = svg.getBoundingClientRect().width;
    tip.style.left = Math.min(Math.max(0, xFrac * w - tip.offsetWidth / 2), w - tip.offsetWidth) + 'px';
  }
  function fillTip(tip, title, rows) {
    tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = title; tip.append(b);
    for (const [cls, text] of rows) {
      const row = document.createElement('div');
      if (cls) { const sw = document.createElement('span'); sw.className = 'sw ' + cls; row.append(sw); }
      row.append(text);
      tip.append(row);
    }
  }
  function fillTable(table, rows) {
    table.replaceChildren(...rows.map((r, i) => {
      const tr = document.createElement('tr');
      for (const c of r) { const td = document.createElement(i ? 'td' : 'th'); td.textContent = c; tr.append(td); }
      return tr;
    }));
  }

  // ---- 14-day bars (one series: no legend, the heading names it) --------------------
  function renderDays(sum, now) {
    const days = T.daily(state, now, 14);
    const W = width('days'), Hh = 180, M = { l: 32, r: 8, t: 10, b: 26 };
    const yMax = Math.max(2, niceMax(Math.max(...days.map((d) => d.count), 1)));
    const slot = (W - M.l - M.r) / days.length, bw = Math.max(6, slot - 2); // 2px gap between bars
    const Y = (v) => Hh - M.b - (v / yMax) * (Hh - M.t - M.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'chart-svg', role: 'img',
      'aria-label': `Cigarettes per day, last 14 days: ${days.map((d) => d.count).join(', ')}` });
    const ticks = yMax <= 5 ? yMax : 4;
    for (let i = 0; i <= ticks; i++) {
      const v = Math.round((yMax / ticks) * i);
      svg.append(el('line', { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), class: i ? 'grid' : 'axis' }));
      svg.append(el('text', { x: M.l - 6, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, String(v)));
    }
    const tip = $('daysTip');
    days.forEach((d, i) => {
      const x = M.l + i * slot + (slot - bw) / 2;
      if (d.count > 0) {
        const y = Y(d.count), h = Y(0) - y, r = Math.min(4, h, bw / 2);
        // Rounded top, square base anchored to the axis.
        svg.append(el('path', { class: 'bar s1', d: `M${x},${Y(0)}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${Y(0)}Z` }));
      }
      if (i % (W < 480 ? 3 : 2) === 1 || days.length <= 7) svg.append(el('text', { x: x + bw / 2, y: Hh - 8, class: 'tick', 'text-anchor': 'middle' }, new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })));
      const hit = el('rect', { x: M.l + i * slot, y: M.t, width: slot, height: Hh - M.t - M.b, class: 'hit' });
      const show = () => { fillTip(tip, dayName(d.day), [[null, d.beforeStart ? 'Before you started tracking' : `${d.count} cigarette${d.count === 1 ? '' : 's'}`]]); placeTip(tip, svg, (x + bw / 2) / W); };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', () => { tip.hidden = true; });
      svg.append(hit);
    });
    $('days').replaceChildren(svg);
    fillTable($('daysTable'), [['Day', 'Cigarettes'], ...days.map((d) => [dayName(d.day), d.beforeStart ? '–' : String(d.count)])]);

    const w = $('week');
    if (sum.lastWeek == null) w.textContent = `Last 7 days: ${sum.thisWeek}. After two weeks of tracking you'll see this week against last.`;
    else {
      const diff = sum.thisWeek - sum.lastWeek;
      w.textContent = `Last 7 days: ${sum.thisWeek}. The week before: ${sum.lastWeek}. `
        + (diff < 0 ? `↓ ${-diff} fewer. That's real progress.` : diff > 0 ? `↑ ${diff} more. Hard weeks happen; keep logging.` : 'The same as the week before.');
    }
  }

  // ---- risk curve (two series: legend + direct labels) -------------------------------
  const OUTCOMES = [['heart', 's1', 'Heart disease'], ['stroke', 's2', 'Stroke']];

  function renderRisk(sum) {
    const sex = state.sex, you = sum.average7;
    const W = width('curve'), Hh = 280, M = { l: 40, r: 104, t: 14, b: 44 };
    const top = niceMax(Math.max(...OUTCOMES.map(([o]) => H.HACKSHAW[o][sex][20][2])));
    const X = (c) => M.l + (c / 20) * (W - M.l - M.r);
    const Y = (rr) => Hh - M.b - ((rr - 1) / (top - 1)) * (Hh - M.t - M.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'chart-svg', role: 'img', 'aria-label': $('riskText').textContent });
    for (let i = 0; i <= 4; i++) {
      const v = 1 + ((top - 1) / 4) * i;
      svg.append(el('line', { x1: M.l, x2: W - M.r, y1: Y(v), y2: Y(v), class: i ? 'grid' : 'axis' }));
      svg.append(el('text', { x: M.l - 6, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, num(v, 1)));
    }
    for (const c of (W < 480 ? [0, 5, 10, 15, 20] : [0, 1, 5, 10, 15, 20])) svg.append(el('text', { x: X(c), y: Hh - M.b + 18, class: 'tick', 'text-anchor': 'middle' }, String(c)));
    svg.append(el('text', { x: (M.l + W - M.r) / 2, y: Hh - 4, class: 'tick', 'text-anchor': 'middle' }, 'cigarettes a day'));
    svg.append(el('text', { x: X(20), y: Y(1) - 6, class: 'tick', 'text-anchor': 'end' }, 'Never smoked = 1.0'));

    // Bands (95% CI) and lines over the measured range, 1 to 20 a day.
    const xs = []; for (let c = 1; c <= 20; c += 0.5) xs.push(c);
    const ends = [];
    for (const [o, cls] of OUTCOMES) {
      const pts = xs.map((c) => [c, H.riskAt(o, sex, c)]);
      const band = pts.map(([c, r]) => `${X(c)},${Y(r.hi)}`).concat(pts.slice().reverse().map(([c, r]) => `${X(c)},${Y(r.lo)}`));
      svg.append(el('polygon', { points: band.join(' '), class: 'band ' + cls }));
      svg.append(el('path', { d: pts.map(([c, r], i) => `${i ? 'L' : 'M'}${X(c).toFixed(1)},${Y(r.rr).toFixed(1)}`).join(''), class: 'line ' + cls }));
      for (const c of H.POINTS) svg.append(el('circle', { cx: X(c), cy: Y(H.riskAt(o, sex, c).rr), r: 4, class: 'dot ' + cls }));
      ends.push([Y(H.riskAt(o, sex, 20).rr), cls, OUTCOMES.find((x) => x[0] === o)[2]]);
    }
    if (Math.abs(ends[0][0] - ends[1][0]) < 16) { const mid = (ends[0][0] + ends[1][0]) / 2; const up = ends[0][0] <= ends[1][0] ? 0 : 1; ends[up][0] = mid - 8; ends[1 - up][0] = mid + 8; }
    for (const [y, cls, label] of ends) {
      svg.append(el('circle', { cx: X(20) + 11, cy: y, r: 3, class: 'swatch ' + cls }));
      svg.append(el('text', { x: X(20) + 18, y: y + 4, class: 'label' }, label));
    }

    // "You are here".
    const yx = X(Math.min(20, you));
    svg.append(el('line', { x1: yx, x2: yx, y1: M.t, y2: Hh - M.b, class: 'you' }));
    svg.append(el('text', { x: Math.min(yx + 4, W - M.r - 70), y: M.t + 10, class: 'label' }, `You: ${num(you, 1)} a day`));

    // Hover: read both risks at any level.
    const tip = $('curveTip');
    const cross = el('line', { y1: M.t, y2: Hh - M.b, class: 'cross', visibility: 'hidden' });
    const hit = el('rect', { x: M.l, y: 0, width: W - M.l - M.r, height: Hh, class: 'hit' });
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const c = Math.round(Math.min(20, Math.max(0, ((((e.clientX - r.left) / r.width) * W - M.l) / (W - M.l - M.r)) * 20)));
      cross.setAttribute('x1', X(c)); cross.setAttribute('x2', X(c)); cross.setAttribute('visibility', 'visible');
      fillTip(tip, c === 0 ? 'Never smoked' : `${c} a day${c < 1 ? '' : ''}`, c === 0 ? [[null, 'Risk 1.0 (the comparison)']] : OUTCOMES.map(([o, cls, label]) => {
        const k = H.riskAt(o, sex, c);
        return [cls, `${label}: ${num(k.rr, 2)} (${num(k.lo, 2)}–${num(k.hi, 2)}), ${pct(k.rr)} higher`];
      }));
      placeTip(tip, svg, X(c) / W);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
    svg.append(cross, hit);
    $('curve').replaceChildren(svg);

    $('legend').replaceChildren(...OUTCOMES.map(([, cls, label]) => {
      const li = document.createElement('li'); const sw = document.createElement('span'); sw.className = 'sw ' + cls;
      li.append(sw, label); return li;
    }));
    const cell = (o, c) => { const k = H.riskAt(o, sex, c); return `${num(k.rr, 2)} (${num(k.lo, 2)}–${num(k.hi, 2)})`; };
    const rows = [['Cigarettes a day', 'Heart disease', 'Stroke'], ...H.POINTS.map((c) => [String(c), cell('heart', c), cell('stroke', c)])];
    if (you > 0) rows.push([`You (${num(you, 1)})`, cell('heart', you), cell('stroke', you)]);
    fillTable($('curveTable'), rows);
  }

  function riskSentence(sum) {
    const you = sum.average7, sex = state.sex === 'men' ? 'men' : 'women';
    if (you === 0) {
      return sum.everSmoked
        ? 'No cigarettes in the last 7 days. Every smoke-free day counts: about a year after stopping, the risk of a heart attack falls to around half that of a smoker (NHS).'
        : 'No cigarettes logged yet. Tap the button each time you smoke; your level will appear here.';
    }
    const heart = H.riskAt('heart', state.sex, you), stroke = H.riskAt('stroke', state.sex, you);
    let s = `You've averaged ${num(you, 1)} a day over the last 7 days. At about that level, studies of ${sex} found heart disease risk ${pct(heart.rr)} higher than in people who never smoked (range ${pct(heart.lo)} to ${pct(heart.hi)}), and stroke risk ${pct(stroke.rr)} higher. `
      + `That's about ${num(H.shareOfHeavy('heart', state.sex, you) * 100)}% of the extra heart risk of smoking 20 a day.`;
    if (heart.basis === 'below-measured') s += ` The studies measured about one a day. Less than that is not known to be safe: in a US study of about 290,000 adults, people who smoked under one a day all their lives had a ${pct(H.MORTALITY.underOne.allCause)} higher death rate.`;
    if (heart.basis === 'above-measured') s += ' Above 20 a day the risk keeps rising; these studies stop at 20.';
    return s;
  }

  // ---- vaping --------------------------------------------------------------------------
  function renderVaping() {
    $('vapeLine').textContent = (state.puffsPerDay ? `You vape about ${num(state.puffsPerDay)} puffs a day. ` : '') + H.VAPING.summary + ' What is known:';
    $('vapeFacts').replaceChildren(...H.VAPING.exposure.map((f) => { const li = document.createElement('li'); li.textContent = f; return li; }));
    if (document.activeElement !== $('puffs')) $('puffs').value = state.puffsPerDay ?? '';
  }
  $('puffs').addEventListener('change', () => {
    const v = Number($('puffs').value);
    state.puffsPerDay = $('puffs').value === '' ? null : Math.max(0, Math.min(20000, Math.round(v)));
    persist(); renderVaping();
  });
  $('puffsForm').addEventListener('submit', (e) => e.preventDefault());

  for (const r of document.querySelectorAll('input[name=sex]')) {
    r.checked = r.value === state.sex;
    r.addEventListener('change', () => { state.sex = r.value; persist(); render(); });
  }

  $('sources').replaceChildren(...H.SOURCES.map((s) => {
    const li = document.createElement('li'); const a = document.createElement('a');
    a.href = s.url; a.rel = 'noopener'; a.textContent = s.text; li.append(a); return li;
  }));

  $('reset').addEventListener('click', () => {
    if (!confirm('Clear everything you have logged on this device?')) return;
    T.clear(localStorage);
    state = T.newState(); persist();
    $('logged').textContent = '';
    render();
  });

  function render() {
    const now = Date.now();
    const sum = T.summary(state, now);
    renderHero(sum);
    $('riskText').textContent = riskSentence(sum);
    renderDays(sum, now);
    renderRisk(sum);
    renderVaping();
  }

  for (const id of ['hero', 'trend', 'risk', 'vaping']) $(id).hidden = false;
  render();
  // Keep the "time since" clock current.
  setInterval(() => { if (!document.hidden) renderHero(T.summary(state, Date.now())); }, 30e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  let resizeTimer = null;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return; // ignore mobile address-bar height changes
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150);
  });

  // ---- install as an app -----------------------------------------------------------------
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('install').hidden = false; });
  $('install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('install').hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/smoking-calculator/sw.js', { scope: '/smoking-calculator/' }).catch(() => {});
})();
