// Vape purchase classifier: logistic regression over hashed word and character n-grams of a
// bank transaction description. Trained by model/train.js; weights ship in vape-model.json and
// run in the browser, so statements never leave the device.
'use strict';
(function (root) {
  const BUCKETS = 1 << 18;

  // Strip what banks add around the merchant: card/ref numbers, dates, payment-method prefixes.
  function normalise(text) {
    return String(text || '').toLowerCase()
      .replace(/\b(card payment to|card payment|contactless|debit card|visa|vis|pos|purchase|payment to|apple pay|google pay|on \d{1,2}[-/ ]\w+)\b/g, ' ')
      .replace(/[0-9]+/g, ' ')
      .replace(/[^a-z]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0) % BUCKETS;
  }

  // Feature indices (with repeats) for one description.
  function features(text) {
    const words = normalise(text).split(' ').filter(Boolean);
    const out = [];
    words.forEach((w, i) => {
      out.push(fnv1a('w:' + w));
      if (i + 1 < words.length) out.push(fnv1a('b:' + w + '_' + words[i + 1]));
      const p = `^${w}$`;
      for (let n = 3; n <= 5; n++) for (let j = 0; j + n <= p.length; j++) out.push(fnv1a(`c${n}:` + p.slice(j, j + n)));
    });
    // Squashed words catch "vapeclub", "ecigwizard" and similar run-together names.
    const joined = words.join('');
    for (let j = 0; j + 4 <= joined.length; j++) out.push(fnv1a('j4:' + joined.slice(j, j + 4)));
    return out;
  }

  function score(model, feats) {
    let z = model.bias;
    const scale = 1 / Math.sqrt(Math.max(1, feats.length));
    for (const f of feats) z += (model.w[f] || 0) * scale;
    return z;
  }

  // Probability (0..1) that the description is a vape purchase.
  function predict(model, text) {
    const feats = features(text);
    if (!feats.length) return 0;
    return 1 / (1 + Math.exp(-score(model, feats)));
  }

  const api = { BUCKETS, normalise, features, score, predict };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VapeModel = api;
})(typeof self !== 'undefined' ? self : this);
