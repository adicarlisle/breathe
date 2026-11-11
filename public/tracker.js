// Cigarette tracker state and maths, for people cutting down or quitting.
// State lives in the browser only (localStorage); nothing is sent anywhere.
'use strict';
(function (root) {
  const DAY = 86400e3;
  const KEY = 'bt-cig-tracker-v2';

  function newState({ puffsPerDay = null, sex = 'men', now = Date.now() } = {}) {
    return { v: 2, puffsPerDay, sex, startedAt: now, smokes: [] };
  }

  function isValid(s) {
    return Boolean(s) && s.v === 2 && Number.isFinite(s.startedAt) && Array.isArray(s.smokes) && s.smokes.every(Number.isFinite)
      && (s.puffsPerDay === null || (Number.isFinite(s.puffsPerDay) && s.puffsPerDay >= 0)) && (s.sex === 'men' || s.sex === 'women');
  }

  const between = (s, from, to) => s.smokes.filter((t) => t > from && t <= to).length;

  // Average a day over the last `days` days (or since starting, if that is shorter, but at least one day).
  function averagePerDay(s, now = Date.now(), days = 7) {
    const span = Math.max(1, Math.min(days, (now - s.startedAt) / DAY));
    return between(s, now - span * DAY, now) / span;
  }

  function summary(s, now = Date.now()) {
    const last = s.smokes.length ? Math.max(...s.smokes) : null;
    const trackedDays = (now - s.startedAt) / DAY;
    return {
      today: between(s, startOfDay(now) - 1, now),
      last24h: between(s, now - DAY, now),
      total: s.smokes.length,
      sinceLastMs: last == null ? now - s.startedAt : now - last,
      everSmoked: last != null,
      average7: averagePerDay(s, now, 7),
      thisWeek: between(s, now - 7 * DAY, now),
      lastWeek: trackedDays >= 14 ? between(s, now - 14 * DAY, now - 7 * DAY) : null,
      trackedDays,
    };
  }

  function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

  // Counts per calendar day for the last `n` days, oldest first: [{ day: ms, count }].
  function daily(s, now = Date.now(), n = 14) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const day = startOfDay(now - i * DAY);
      const end = startOfDay(day + DAY * 1.5);
      out.push({ day, count: s.smokes.filter((t) => t >= day && t < end).length, beforeStart: end <= s.startedAt });
    }
    return out;
  }

  function load(storage) {
    try { const s = JSON.parse(storage.getItem(KEY)); return isValid(s) ? s : null; } catch { return null; }
  }
  function save(storage, s) {
    try { storage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
  }
  function clear(storage) {
    try { storage.removeItem(KEY); } catch { /* storage unavailable */ }
  }

  const api = { DAY, KEY, newState, isValid, averagePerDay, summary, daily, startOfDay, load, save, clear };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tracker = api;
})(typeof self !== 'undefined' ? self : this);
