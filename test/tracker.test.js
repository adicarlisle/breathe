'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/health.js');
const T = require('../public/tracker.js');

test('health: published Hackshaw 2018 points are returned exactly', () => {
  assert.deepEqual(H.riskAt('heart', 'men', 1), { rr: 1.48, lo: 1.30, hi: 1.69, basis: 'measured' });
  assert.equal(H.riskAt('heart', 'women', 20).rr, 2.84);
  assert.equal(H.riskAt('stroke', 'men', 5).rr, 1.30);
  assert.equal(H.riskAt('stroke', 'women', 1).rr, 1.31);
  // Abstract: men at 1 a day have 46% of the excess heart risk of 20 a day.
  assert.equal(Math.round(H.shareOfHeavy('heart', 'men', 1) * 100), 46);
  assert.equal(Math.round(H.shareOfHeavy('heart', 'women', 1) * 100), 31);
});

test('health: interpolates between points, never extrapolates below one a day', () => {
  const r = H.riskAt('heart', 'men', 3);
  assert.ok(r.rr > 1.48 && r.rr < 1.58);
  assert.equal(r.basis, 'interpolated');
  const half = H.riskAt('heart', 'men', 0.5);
  assert.equal(half.rr, 1.48, 'under one a day shows the measured one-a-day risk, not a smaller made-up one');
  assert.equal(half.basis, 'below-measured');
  assert.equal(H.riskAt('heart', 'men', 0).rr, 1);
  assert.equal(H.riskAt('stroke', 'women', 40).basis, 'above-measured');
  assert.equal(H.VAPING.known, false, 'no number is invented for vaping');
});

test('tracker: summary, averages and daily counts', () => {
  const DAY = T.DAY;
  const start = Date.UTC(2026, 10, 1, 12);
  const s = T.newState({ now: start });
  const now = start + 15 * DAY;
  // 2 a day for the first week, 1 a day for the second, none today yet.
  for (let d = 1; d <= 14; d++) for (let k = 0; k < (d <= 7 ? 2 : 1); k++) s.smokes.push(start + d * DAY - (k + 1) * 3600e3);
  const sum = T.summary(s, now);
  assert.equal(sum.total, 21);
  assert.equal(sum.thisWeek, 6); // day 8's cigarette is an hour before the 7-day window
  assert.equal(sum.lastWeek, 13);
  assert.equal(sum.average7, 6 / 7);
  assert.equal(sum.everSmoked, true);
  assert.ok(sum.sinceLastMs >= DAY);
  const days = T.daily(s, now, 14);
  assert.equal(days.length, 14);
  assert.equal(days.reduce((a, d) => a + d.count, 0), T.summary(s, now).total - s.smokes.filter((t) => t < T.startOfDay(now - 13 * DAY)).length);
});

test('tracker: storage round trip rejects bad data', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  assert.equal(T.load(storage), null);
  const s = T.newState({ puffsPerDay: 300, sex: 'women' });
  s.smokes.push(Date.now());
  T.save(storage, s);
  assert.deepEqual(T.load(storage), s);
  mem.set(T.KEY, '{"v":2,"smokes":["x"]}');
  assert.equal(T.load(storage), null);
  mem.set(T.KEY, 'not json');
  assert.equal(T.load(storage), null);
});

test('server: tracker page, manifest and service worker', async () => {
  delete require.cache[require.resolve('../server.js')];
  const { server } = require('../server.js');
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/smoking-calculator`;
  try {
    const page = await fetch(base + '/tracker');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /rel="manifest"/);
    assert.doesNotMatch(html, /\{\{\w+\}\}/);
    const man = await fetch(base + '/manifest.webmanifest');
    assert.equal(man.headers.get('content-type'), 'application/manifest+json');
    const m = await man.json();
    assert.equal(m.start_url, '/smoking-calculator/tracker');
    for (const icon of m.icons) assert.equal((await fetch('http://127.0.0.1:' + server.address().port + icon.src)).status, 200, icon.src);
    const sw = await fetch(base + '/sw.js');
    assert.equal(sw.status, 200);
    assert.equal(sw.headers.get('cache-control'), 'no-cache');
  } finally {
    server.close();
  }
});
