// Vaping maths: money spent on vapes -> devices -> puffs -> cigarette equivalents.
'use strict';
(function (root) {
  // UK retailer rule of thumb: a 600-puff device (2 ml at 20 mg/ml) is about 20 cigarettes.
  const PUFFS_PER_CIGARETTE = 600 / 20;
  // This compares nicotine, not health risk: vaping's long-term risk has not been measured (see health.js).

  // Prices are typical starting points; people change them to what they pay.
  const PRODUCTS = [
    { id: 'hayati-6000', name: 'Hayati Pro Max 6000', puffs: 6000, price: 12 },
    { id: 'puffs-600', name: '600-puff device (2 ml pod)', puffs: 600, price: 6 },
    { id: 'custom', name: 'Something else (enter puffs and price)', puffs: 1000, price: 8 },
  ];

  const DAY = 86400e3;

  function summarise({ spend, puffsPerDevice, pricePerDevice, from, to, packPrice = 16, perPack = 20 }) {
    const devices = pricePerDevice > 0 ? spend / pricePerDevice : 0;
    const puffs = devices * puffsPerDevice;
    const cigarettesByPuffs = puffs / PUFFS_PER_CIGARETTE;
    const days = from && to ? Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1) : null;
    const perDay = (x) => (days ? x / days : null);
    return {
      spend, devices, puffs, cigarettesByPuffs, days,
      puffsPerDay: perDay(puffs),
      cigarettesByPuffsPerDay: perDay(cigarettesByPuffs),
      spendPerYear: days ? (spend / days) * 365.25 : null,
      // What the same number of cigarettes (by puffs) would have cost at the given pack price.
      smokingCost: cigarettesByPuffs * (packPrice / perPack),
    };
  }

  const api = { PUFFS_PER_CIGARETTE, PRODUCTS, summarise };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VapeCalc = api;
})(typeof self !== 'undefined' ? self : this);
