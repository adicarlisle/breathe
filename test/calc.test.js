'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../public/calc.js');
const { server } = require('../server.js');

test('cost maths', () => {
  const r = calc.calculate({ perDay: 20, packPrice: 15, perPack: 20, years: 2, rate: 0 });
  assert.equal(r.perDay, 15);
  assert.equal(r.perYear, 15 * 365.25);
  assert.equal(r.spentSoFar, 15 * 365.25 * 2);
  assert.equal(r.packYears, 2);
  assert.equal(r.ifYouQuit[0].withInterest, r.perMonth * 12);
  assert.ok(Math.abs(r.daysLost - (20 * 365.25 * 2 * 20) / 1440) < 1e-9);
});

test('bad input is clamped to safe values', () => {
  const r = calc.calculate({ perDay: 'x', packPrice: -5, perPack: 0, years: 1e9 });
  assert.equal(r.input.perDay, calc.DEFAULTS.perDay);
  assert.equal(r.input.packPrice, 0);
  assert.equal(r.input.perPack, 1);
  assert.equal(r.input.years, 90);
});

test('interest grows savings', () => {
  assert.ok(calc.savedWithInterest(100, 10, 4) > 12000);
});

test('server renders the page with numbers and serves only its own paths', async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base + '/smoking-calculator');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    const html = await page.text();
    assert.doesNotMatch(html, /\{\{\w+\}\}/, 'every placeholder is filled');
    assert.match(html, /£2,922/); // 10 a day at £16 a pack
    const shared = await fetch(base + '/smoking-calculator?perDay=<script>');
    assert.equal(shared.headers.get('x-robots-tag'), 'noindex');
    assert.doesNotMatch(await shared.text(), /<script>"/);
    assert.equal((await fetch(base + '/smoking-calculator/assets/calc.js')).status, 200);
    assert.equal((await fetch(base + '/smoking-calculator/assets/../server.js')).status, 404);
    assert.equal((await fetch(base + '/smoking-calculator/', { redirect: 'manual' })).status, 301);
  } finally {
    server.close();
  }
});
