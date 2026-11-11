// Published health data for low-level smoking, and what is (and isn't) known about vaping.
// Every number here comes from a cited study; nothing is modelled beyond straight-line
// interpolation between the published points.
'use strict';
(function (root) {
  // Hackshaw A, Morris JK, Boniface S, Tang JL, Milenković D. Low cigarette consumption and risk of
  // coronary heart disease and stroke: meta-analysis of 141 cohort studies in 55 study reports.
  // BMJ 2018;360:j5855. Table 1, all studies, random-effects pooled relative risk vs never smokers
  // [estimate, 95% CI low, 95% CI high]. (Estimates adjusted for multiple confounders, Table 2, are higher.)
  const HACKSHAW = {
    heart: {
      men:   { 1: [1.48, 1.30, 1.69], 5: [1.58, 1.39, 1.80], 20: [2.04, 1.86, 2.24] },
      women: { 1: [1.57, 1.29, 1.91], 5: [1.76, 1.46, 2.13], 20: [2.84, 2.21, 3.64] },
    },
    stroke: {
      men:   { 1: [1.25, 1.13, 1.38], 5: [1.30, 1.18, 1.43], 20: [1.64, 1.48, 1.82] },
      women: { 1: [1.31, 1.13, 1.52], 5: [1.44, 1.22, 1.70], 20: [2.16, 1.69, 2.75] },
    },
  };
  const POINTS = [1, 5, 20];

  // Inoue-Choi M et al. Association of long-term, low-intensity smoking with all-cause and cause-specific
  // mortality in the NIH-AARP Diet and Health Study. JAMA Intern Med 2017;177:87-95. Hazard ratios vs never smokers.
  const MORTALITY = {
    underOne: { allCause: 1.64, lungCancer: 9.12 },
    oneToTen: { allCause: 1.87, lungCancer: 11.61 },
  };

  const SOURCES = [
    { id: 'hackshaw', text: 'Hackshaw A et al. Low cigarette consumption and risk of coronary heart disease and stroke: meta-analysis of 141 cohort studies. BMJ 2018;360:j5855.', url: 'https://doi.org/10.1136/bmj.j5855' },
    { id: 'inoue-choi', text: 'Inoue-Choi M et al. Long-term, low-intensity smoking and mortality in the NIH-AARP Diet and Health Study. JAMA Internal Medicine 2017;177:87-95.', url: 'https://doi.org/10.1001/jamainternmed.2016.7511' },
    { id: 'ohid', text: 'McNeill A et al. Nicotine vaping in England: 2022 evidence update. Office for Health Improvement and Disparities.', url: 'https://www.gov.uk/government/publications/nicotine-vaping-in-england-2022-evidence-update' },
  ];

  // Relative risk at `perDay` cigarettes a day, interpolated between the published 1, 5 and 20 a day.
  // Below 1 a day there is no point estimate: the 1-a-day figure is shown and flagged, because
  // smoking less than one a day has not been shown to be safe (Inoue-Choi: 64% higher death rate).
  function riskAt(outcome, sex, perDay) {
    const t = HACKSHAW[outcome] && HACKSHAW[outcome][sex];
    if (!t) throw new Error('unknown outcome or sex');
    if (!(perDay > 0)) return { rr: 1, lo: 1, hi: 1, basis: 'none' };
    if (perDay <= 1) return { rr: t[1][0], lo: t[1][1], hi: t[1][2], basis: perDay < 1 ? 'below-measured' : 'measured' };
    if (perDay >= 20) return { rr: t[20][0], lo: t[20][1], hi: t[20][2], basis: perDay > 20 ? 'above-measured' : 'measured' };
    const [a, b] = perDay <= 5 ? [1, 5] : [5, 20];
    const f = (perDay - a) / (b - a);
    const lerp = (i) => t[a][i] + (t[b][i] - t[a][i]) * f;
    return { rr: lerp(0), lo: lerp(1), hi: lerp(2), basis: POINTS.includes(perDay) ? 'measured' : 'interpolated' };
  }

  // Share of a 20-a-day smoker's extra risk, e.g. 0.46 = 46%.
  function shareOfHeavy(outcome, sex, perDay) {
    const r = riskAt(outcome, sex, perDay).rr;
    return (r - 1) / (HACKSHAW[outcome][sex][20][0] - 1);
  }

  const VAPING = {
    known: false,
    summary: 'There are no long-term studies yet of heart disease, stroke, cancer or deaths in people who vape, so its risk at any number of puffs cannot be given as a number.',
    exposure: [
      'People who vape have much lower exposure to toxicants than people who smoke (lower carbon monoxide, volatile organic compounds and tobacco-specific nitrosamines).',
      'Exposure is similar to or higher than in people who use neither.',
      'Exposure to some metals is often higher than in people who use neither.',
      'Evidence on early signs of harm (biomarkers of potential harm) is mixed.',
    ],
    source: 'ohid',
  };

  const api = { HACKSHAW, POINTS, MORTALITY, SOURCES, VAPING, riskAt, shareOfHeavy };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Health = api;
})(typeof self !== 'undefined' ? self : this);
