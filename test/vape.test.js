'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/statement.js');
const VM = require('../public/vapemodel.js');
const V = require('../public/vape.js');
const model = require('../public/vape-model.json');
const { build } = require('../model/data.js');
const { train, evaluate } = require('../model/train.js');

test('CSV: Monzo-style (single amount column, money out negative)', () => {
  const tx = S.parseCsv('Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency\n'
    + 'tx_1,03/11/2026,12:01,Card payment,VPZ,,Shopping,-12.00,GBP\n'
    + 'tx_2,04/11/2026,09:00,Faster payment,Salary,,Income,1500.00,GBP\n'
    + 'tx_3,05/11/2026,18:30,Card payment,Tesco,,Groceries,-23.45,GBP\n');
  assert.deepEqual(tx[0], { date: '2026-11-03', description: 'Card payment · VPZ', amount: 12 });
  assert.equal(tx[1].amount, -1500);
  assert.equal(tx[2].amount, 23.45);
});

test('CSV: preamble lines, paid out / paid in columns with £', () => {
  const tx = S.parseCsv('"Account Name:","Current account"\n"Account Balance:","£1,234.00"\n\n'
    + '"Date","Transaction type","Description","Paid out","Paid in","Balance"\n'
    + '"07 Nov 2026","Visa purchase","SQ *CLOUD VAPES LEEDS","£15.98","","£1,218.02"\n'
    + '"08 Nov 2026","Bank credit","REFUND","","£5.00","£1,223.02"\n');
  assert.equal(tx.length, 2);
  assert.equal(tx[0].date, '2026-11-07');
  assert.match(tx[0].description, /CLOUD VAPES/);
  assert.equal(tx[0].amount, 15.98);
  assert.equal(tx[1].amount, -5);
});

test('CSV: credit card export (spending positive) and headerless HSBC-style', () => {
  const cc = S.parseCsv('Date,Description,Amount\n2026-11-01,TOTALLY WICKED,9.99\n2026-11-02,AMAZON,20.00\n2026-11-03,PAYMENT RECEIVED,-29.99\n');
  assert.equal(cc[0].amount, 9.99);
  assert.equal(cc[2].amount, -29.99);
  const hsbc = S.parseCsv('01/11/2026,ELF BAR OFFICIAL,-6.00\n02/11/2026,GREGGS,-3.10\n');
  assert.equal(hsbc.length, 2);
  assert.equal(hsbc[0].amount, 6);
});

test('PDF text: dates carry forward, balance column ignored, summary lines skipped', () => {
  const tx = S.parseStatementLines([
    'Statement period 1 November 2026 to 30 November 2026',
    '1 Nov Balance brought forward 500.00',
    '3 Nov CARD PAYMENT TO VPZ GLASGOW 12.00 488.00',
    'TESCO STORES 3021 20.00 468.00',
    '5 Nov SALARY ACME LTD 1,500.00 CR 1,968.00',
    '6 Nov TOTALLY WICKED LTD 9.99 1,958.01',
    '7 Nov REFUND FROM SHOP 5.00 1,963.01',
    '30 Nov Balance carried forward 1,963.01',
  ]);
  assert.equal(tx.length, 5);
  assert.equal(tx[3].description, 'TOTALLY WICKED LTD', 'names starting with "total" are not summary lines');
  assert.equal(tx[3].amount, 9.99);
  assert.equal(tx[4].amount, -5, 'rising balance = money in');
  assert.deepEqual(tx[0], { date: '2026-11-03', description: 'CARD PAYMENT TO VPZ GLASGOW', amount: 12 });
  assert.equal(tx[1].date, '2026-11-03');
  assert.equal(tx[2].amount, -1500);
});

test('pdf.js text items are grouped into lines left to right', () => {
  const item = (s, x, y) => ({ str: s, transform: [1, 0, 0, 1, x, y] });
  const lines = S.linesFromTextItems([[item('12.00', 400, 700), item('3 Nov', 20, 700), item('VPZ', 100, 701), item('Next line', 20, 680)]]);
  assert.deepEqual(lines, ['3 Nov VPZ 12.00', 'Next line']);
});

test('model flags vape shops and brands, not everyday shops', () => {
  for (const t of ['CARD PAYMENT TO VPZ ON 03-11', 'SQ *THE CLOUD VAPOUR CO', 'TOTALLY WICKED LTD', 'PAYPAL *VAPORESSOUK', 'HAYATI DISPOSABLES LTD']) {
    assert.ok(VM.predict(model, t) >= 0.5, t);
  }
  for (const t of ['TESCO STORES 3021 LONDON', 'VAPIANO LONDON', 'CLOUDFLARE', 'NETFLIX.COM', 'SALARY ACME LTD']) {
    assert.ok(VM.predict(model, t) < 0.5, t);
  }
});

test('model recognises shops it was not trained on', () => {
  const { train: tr, test: held } = build();
  const r = evaluate(train(tr), held);
  assert.ok(r.accuracy > 0.85, `accuracy ${r.accuracy}`);
  assert.ok(r.precision > 0.85, `precision ${r.precision}`);
});

test('vaping maths: one 6,000-puff Hayati = 200 cigarettes by puffs', () => {
  const r = V.summarise({ spend: 12, puffsPerDevice: 6000, pricePerDevice: 12, from: '2026-11-01', to: '2026-11-30', packPrice: 16, perPack: 20 });
  assert.equal(r.devices, 1);
  assert.equal(r.puffs, 6000);
  assert.equal(r.cigarettesByPuffs, 200);
  assert.equal(r.harmEquivalentCigarettes, undefined, 'no made-up harm number for vaping');
  assert.equal(r.days, 30);
  assert.equal(r.smokingCost, 160);
});

test('server serves the analyser page and its assets', async () => {
  delete require.cache[require.resolve('../server.js')];
  const { server } = require('../server.js');
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base + '/smoking-calculator/vape-analyser');
    assert.equal(page.status, 200);
    assert.doesNotMatch(await page.text(), /\{\{\w+\}\}/);
    for (const a of ['statement.js', 'vapemodel.js', 'vape.js', 'analyser.js', 'vape-model.json', 'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs']) {
      assert.equal((await fetch(`${base}/smoking-calculator/assets/${a}`)).status, 200, a);
    }
    assert.equal((await fetch(base + '/smoking-calculator/assets/vendor/pdfjs-LICENSE')).status, 404);
  } finally {
    server.close();
  }
});
