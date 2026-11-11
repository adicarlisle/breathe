// Smoking Calculator: its own small service, served at /smoking-calculator behind Caddy.
// Renders the page with the default numbers filled in (so search engines see real
// content) and serves its assets. No dependencies, no data stored.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const calc = require('./public/calc.js');

const BASE = '/smoking-calculator';
const PORT = Number(process.env.PORT || 8080);
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://bigthought.ai').replace(/\/$/, '');
const PUB = path.join(__dirname, 'public');
const JS = 'text/javascript';
const ASSETS = {
  'calc.js': JS, 'app.js': JS, 'style.css': 'text/css',
  'statement.js': JS, 'vapemodel.js': JS, 'vape.js': JS, 'analyser.js': JS, 'vape-model.json': 'application/json',
  'vendor/pdf.min.mjs': JS, 'vendor/pdf.worker.min.mjs': JS,
  'health.js': JS, 'tracker.js': JS, 'tracker-ui.js': JS,
  'icon-180.png': 'image/png', 'icon-192.png': 'image/png', 'icon-512.png': 'image/png', 'icon-maskable-512.png': 'image/png',
};
const TEMPLATE = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const page = (file) => fs.readFileSync(path.join(PUB, file), 'utf8').replace(/\{\{PUBLIC_URL\}\}/g, PUBLIC_URL);
const ANALYSER = page('analyser.html');
const TRACKER = page('tracker.html');

const HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN', // the launcher at / shows this app in a frame
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

const gbp = (n) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: n >= 1000 ? 0 : 2 });
const whole = (n) => Math.round(n).toLocaleString('en-GB');
const days = (d) => (d >= 365 ? `${(d / 365.25).toFixed(1)} years` : `${whole(d)} days`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(query) {
  const r = calc.calculate(query);
  const d = calc.calculate({});
  const vars = {
    PUBLIC_URL, ...r.input,
    perYear: gbp(r.perYear), perDayCost: gbp(r.perDay), perWeek: gbp(r.perWeek), perMonth: gbp(r.perMonth),
    spentSoFar: gbp(r.spentSoFar), cigarettesSoFar: whole(r.cigarettesSoFar), daysLost: days(r.daysLost),
    packYears: r.packYears.toFixed(1), daysRegainedPerYear: days(r.daysRegainedPerYear),
    DEFAULT_PER_YEAR: gbp(d.perYear), DEFAULT_PER_MONTH: gbp(d.perMonth),
  };
  const rows = r.ifYouQuit.map((q) => `<tr><td>${q.years} year${q.years > 1 ? 's' : ''}</td><td>${esc(gbp(q.saved))}</td><td>${esc(gbp(q.withInterest))}</td></tr>`).join('');
  return TEMPLATE.replace(/\{\{(\w+)\}\}/g, (m, k) => (k === 'quitRows' ? rows : k in vars ? esc(vars[k]) : m));
}

function send(res, status, body, type, extra = {}) {
  res.writeHead(status, { 'content-type': type, ...HEADERS, ...extra });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain', { allow: 'GET, HEAD' });
  if (p === '/health') return send(res, 200, '{"ok":true}', 'application/json');
  if (p === BASE + '/') return send(res, 301, '', 'text/plain', { location: BASE + url.search });
  if (p === BASE) {
    // Shared links carry inputs in the query; only the plain page is indexed.
    const extra = url.search ? { 'x-robots-tag': 'noindex' } : { 'cache-control': 'public, max-age=300' };
    return send(res, 200, render(Object.fromEntries(url.searchParams)), 'text/html; charset=utf-8', extra);
  }
  if (p === BASE + '/vape-analyser') return send(res, 200, ANALYSER, 'text/html; charset=utf-8', { 'cache-control': 'public, max-age=300' });
  if (p === BASE + '/tracker') return send(res, 200, TRACKER, 'text/html; charset=utf-8', { 'cache-control': 'no-cache' });
  if (p === BASE + '/manifest.webmanifest') return send(res, 200, fs.readFileSync(path.join(PUB, 'manifest.webmanifest')), 'application/manifest+json', { 'cache-control': 'public, max-age=300' });
  // The service worker must not be cached long, or app updates would be slow to arrive.
  if (p === BASE + '/sw.js') return send(res, 200, fs.readFileSync(path.join(PUB, 'sw.js')), JS, { 'cache-control': 'no-cache' });
  const file = p.startsWith(BASE + '/assets/') ? p.slice(BASE.length + 8) : null;
  if (file && Object.hasOwn(ASSETS, file)) {
    // pdf.js is pinned to a version, so it can be cached for longer.
    const cache = file.startsWith('vendor/') ? 'public, max-age=86400' : 'public, max-age=300';
    return send(res, 200, fs.readFileSync(path.join(PUB, file)), ASSETS[file], { 'cache-control': cache });
  }
  send(res, 404, 'Not found', 'text/plain');
});

if (require.main === module) server.listen(PORT, '0.0.0.0', () => console.log(`smoking-calculator on :${PORT}${BASE}`));
module.exports = { server, render };
