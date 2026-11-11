#!/usr/bin/env node
// Trains the vape purchase classifier and writes public/vape-model.json.
//   npm run train:vape
// First trains on 80% of shop names and reports how it does on the unseen 20%, then
// trains the shipped model on everything.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const VM = require('../public/vapemodel.js');
const { build } = require('./data.js');

function train(rows, { epochs = 30, rate = 0.4, l2 = 1e-5, seed = 11 } = {}) {
  const w = new Float64Array(VM.BUCKETS);
  let bias = 0;
  const data = rows.map(([text, y]) => ({ f: VM.features(text), y }));
  const pos = data.filter((d) => d.y).length;
  const posWeight = (data.length - pos) / Math.max(1, pos); // balance the classes
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let e = 0; e < epochs; e++) {
    const lr = rate / (1 + e * 0.1);
    for (let i = data.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [data[i], data[j]] = [data[j], data[i]]; }
    for (const d of data) {
      if (!d.f.length) continue;
      const scale = 1 / Math.sqrt(d.f.length);
      let z = bias;
      for (const f of d.f) z += w[f] * scale;
      const p = 1 / (1 + Math.exp(-z));
      const g = (p - d.y) * (d.y ? posWeight : 1);
      bias -= lr * g;
      for (const f of d.f) w[f] -= lr * (g * scale + l2 * w[f]);
    }
  }
  const sparse = {};
  w.forEach((v, i) => { if (Math.abs(v) >= 1e-3) sparse[i] = Math.round(v * 1e4) / 1e4; });
  return { bias: Math.round(bias * 1e4) / 1e4, w: sparse };
}

function evaluate(model, rows, threshold = 0.5) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const mistakes = [];
  for (const [text, y] of rows) {
    const hit = VM.predict(model, text) >= threshold;
    if (hit && y) tp++; else if (hit) { fp++; mistakes.push(['false alarm', text]); } else if (y) { fn++; mistakes.push(['missed', text]); } else tn++;
  }
  return { accuracy: (tp + tn) / rows.length, precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn), mistakes };
}

if (require.main === module) {
  const { train: tr, test } = build();
  const held = evaluate(train(tr), test);
  const pct = (x) => (x * 100).toFixed(1) + '%';
  console.log(`unseen shops: accuracy ${pct(held.accuracy)}, precision ${pct(held.precision)}, recall ${pct(held.recall)} (${test.length} examples)`);
  for (const [kind, text] of held.mistakes.slice(0, 12)) console.log(`  ${kind}: ${text}`);
  const model = train([...tr, ...test]);
  const out = path.join(__dirname, '..', 'public', 'vape-model.json');
  fs.writeFileSync(out, JSON.stringify({ version: 1, trained: new Date().toISOString().slice(0, 10), bias: model.bias, w: model.w }));
  console.log(`wrote ${path.relative(process.cwd(), out)} (${Object.keys(model.w).length} weights, ${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

module.exports = { train, evaluate };
