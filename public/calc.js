// Smoking cost maths. Pure functions, shared by the page (browser) and server.js (Node),
// so the numbers crawlers see in the HTML match what the calculator shows.
'use strict';
(function (root) {
  const DAYS_PER_YEAR = 365.25;
  // UCL analysis of the British Doctors Study and Million Women Study (2024):
  // each cigarette costs about 20 minutes of life on average (17 for men, 22 for women).
  const MINUTES_PER_CIGARETTE = 20;
  const DEFAULTS = Object.freeze({ perDay: 10, packPrice: 16, perPack: 20, years: 10, rate: 4 });
  const LIMITS = { perDay: [0, 200], packPrice: [0, 200], perPack: [1, 200], years: [0, 90], rate: [0, 20] };

  function clean(input) {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) {
      const n = Number(input && input[k] !== undefined && input[k] !== '' ? input[k] : DEFAULTS[k]);
      const [lo, hi] = LIMITS[k];
      out[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[k];
    }
    return out;
  }

  // What monthly deposits of `monthly` grow to after `years` at `ratePct`% a year, compounded monthly.
  function savedWithInterest(monthly, years, ratePct) {
    const n = Math.round(years * 12);
    const r = ratePct / 100 / 12;
    return r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
  }

  function calculate(input) {
    const v = clean(input);
    const perCigarette = v.packPrice / v.perPack;
    const perDayCost = v.perDay * perCigarette;
    const perYear = perDayCost * DAYS_PER_YEAR;
    const perMonth = perYear / 12;
    const cigarettesSoFar = v.perDay * DAYS_PER_YEAR * v.years;
    const minutesLost = cigarettesSoFar * MINUTES_PER_CIGARETTE;
    return {
      input: v,
      perCigarette,
      perDay: perDayCost,
      perWeek: perDayCost * 7,
      perMonth,
      perYear,
      spentSoFar: perYear * v.years,
      cigarettesSoFar,
      packsSoFar: cigarettesSoFar / v.perPack,
      packYears: (v.perDay / 20) * v.years,
      daysLost: minutesLost / 60 / 24,
      daysRegainedPerYear: (v.perDay * DAYS_PER_YEAR * MINUTES_PER_CIGARETTE) / 60 / 24,
      ifYouQuit: [1, 5, 10, 20].map((years) => ({
        years,
        saved: perYear * years,
        withInterest: savedWithInterest(perMonth, years, v.rate),
      })),
    };
  }

  const api = { DEFAULTS, LIMITS, MINUTES_PER_CIGARETTE, clean, calculate, savedWithInterest };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmokingCalc = api;
})(typeof self !== 'undefined' ? self : this);
