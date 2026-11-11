// Live recalculation as you type; inputs are mirrored into the URL so the page can be shared.
'use strict';
(() => {
  const C = window.SmokingCalc;
  const form = document.getElementById('calc');
  const gbp = (n) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n >= 1000 ? 0 : 2 });
  const whole = (n) => Math.round(n).toLocaleString('en-GB');
  const days = (d) => (d >= 365 ? `${(d / 365.25).toFixed(1)} years` : `${whole(d)} days`);
  const fmt = { perYear: gbp, perDay: gbp, perWeek: gbp, perMonth: gbp, spentSoFar: gbp, cigarettesSoFar: whole, daysLost: days, packYears: (n) => n.toFixed(1), daysRegainedPerYear: days };

  function values() {
    const v = {};
    for (const el of document.querySelectorAll('input[name]')) v[el.name] = el.value;
    return v;
  }

  function update() {
    const r = C.calculate(values());
    for (const el of document.querySelectorAll('[data-out]')) el.textContent = fmt[el.dataset.out](r[el.dataset.out]);
    const tbody = document.getElementById('quit-rows');
    tbody.replaceChildren(...r.ifYouQuit.map((q) => {
      const tr = document.createElement('tr');
      for (const t of [`${q.years} year${q.years > 1 ? 's' : ''}`, gbp(q.saved), gbp(q.withInterest)]) tr.appendChild(document.createElement('td')).textContent = t;
      return tr;
    }));
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(r.input)) if (v !== C.DEFAULTS[k]) q.set(k, v);
    history.replaceState(null, '', location.pathname + (q.size ? '?' + q : ''));
  }

  document.addEventListener('input', (e) => { if (e.target.matches('input[name]')) update(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); update(); });

  const share = document.getElementById('share');
  if (navigator.clipboard) {
    share.hidden = false;
    share.addEventListener('click', async () => {
      await navigator.clipboard.writeText(location.href).catch(() => {});
      share.textContent = 'Link copied';
      setTimeout(() => { share.textContent = 'Copy a link to these numbers'; }, 2000);
    });
  }
})();
