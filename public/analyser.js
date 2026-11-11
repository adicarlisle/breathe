// Vape spending analyser page. Everything happens in this tab: files are read with
// FileReader/pdf.js, scored with the bundled model, and never sent over the network.
'use strict';
(() => {
  const S = window.Statement, VM = window.VapeModel, V = window.VapeCalc;
  const $ = (id) => document.getElementById(id);
  const ASSETS = '/smoking-calculator/assets/';
  const STRONG = 0.5, POSSIBLE = 0.25, MAX_BYTES = 20 * 1024 * 1024;

  let model = null;
  let tx = [];            // { date, description, amount, p, on }

  const gbp = (n) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });
  const num = (n, d = 0) => n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const status = (text, ok = true) => { $('status').textContent = text; $('status').className = 'msg ' + (ok ? 'ok' : 'err'); };

  async function loadModel() {
    if (!model) model = await fetch(ASSETS + 'vape-model.json').then((r) => r.json());
    return model;
  }

  async function readPdf(file) {
    const pdfjs = await import(ASSETS + 'vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = ASSETS + 'vendor/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true });
    let doc;
    try {
      doc = await task.promise;
    } catch (err) {
      if (err && err.name === 'PasswordException') throw new Error(`${file.name} is password-protected. Download it again without a password, or use your bank's CSV export.`);
      throw new Error(`${file.name} couldn't be opened as a PDF.`);
    }
    const pages = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items);
    } finally {
      await task.destroy(); // frees the worker's copy of the file
    }
    const found = S.parseStatementLines(S.linesFromTextItems(pages));
    if (!found.length) throw new Error(`No transactions found in ${file.name}. If it is a scanned statement, use your bank's CSV download instead.`);
    return found;
  }

  async function readFile(file) {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 20 MB.`);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    return isPdf ? readPdf(file) : S.parseCsv(await file.text());
  }

  async function handle(files) {
    if (!files.length) return;
    status('Reading your statement on this device…');
    try {
      const m = await loadModel();
      const seen = new Set(tx.map((t) => `${t.date}|${t.description}|${t.amount}`));
      let added = 0;
      for (const f of files) {
        for (const t of await readFile(f)) {
          const key = `${t.date}|${t.description}|${t.amount}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const p = VM.predict(m, t.description);
          tx.push({ ...t, p, on: p >= STRONG && t.amount > 0 });
          added++;
        }
      }
      tx.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const vapes = tx.filter((t) => t.on).length;
      status(`Read ${num(added)} transaction${added === 1 ? '' : 's'}. ${vapes ? `${vapes} look like vape purchases.` : 'None look like vape purchases; check the list or search below.'}`);
      render();
    } catch (err) {
      status(err.message || 'That file could not be read.', false);
    }
  }

  function row(t, showMatch) {
    const tr = document.createElement('tr');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = t.on;
    box.setAttribute('aria-label', 'Count as a vape purchase: ' + t.description);
    box.addEventListener('change', () => { t.on = box.checked; render(); });
    const cells = [box, fmtDate(t.date), t.description, gbp(t.amount), showMatch ? Math.round(t.p * 100) + '%' : ''];
    cells.forEach((c, i) => {
      const td = tr.appendChild(document.createElement('td'));
      if (i >= 3) td.className = 'num';
      if (c instanceof Node) td.appendChild(c); else td.textContent = c;
    });
    return tr;
  }

  function renderSearch() {
    const q = $('search').value.trim().toLowerCase();
    const list = q ? tx.filter((t) => t.description.toLowerCase().includes(q)).slice(0, 40) : [];
    $('results').replaceChildren(...list.map((t) => row(t, false)));
  }

  function renderSummary() {
    const chosen = tx.filter((t) => t.on);
    const spend = chosen.reduce((s, t) => s + t.amount, 0);
    const dates = tx.map((t) => t.date).filter(Boolean).sort();
    const from = dates[0], to = dates[dates.length - 1];
    const r = V.summarise({ spend, puffsPerDevice: Number($('puffs').value) || 0, pricePerDevice: Number($('price').value) || 0, from, to, packPrice: Number($('packPrice').value) || 0 });
    $('period').textContent = from ? `${fmtDate(from)} to ${fmtDate(to)}` : 'in this statement';
    $('o-spend').textContent = gbp(r.spend);
    $('o-spendYear').textContent = r.spendPerYear != null ? `about ${gbp(r.spendPerYear)} a year at this rate` : '';
    $('o-devices').textContent = num(r.devices, 1);
    $('o-puffs').textContent = num(r.puffs);
    $('o-puffsDay').textContent = r.puffsPerDay != null ? `about ${num(r.puffsPerDay)} a day` : '';
    $('o-cigs').textContent = num(r.cigarettesByPuffs);
    $('o-cigsDay').textContent = r.cigarettesByPuffsPerDay != null ? `about ${num(r.cigarettesByPuffsPerDay, 1)} a day` : '';
    $('o-smokeCost').textContent = gbp(r.smokingCost);
    lastPuffsPerDay = r.puffsPerDay;
    $('track').disabled = !(r.puffsPerDay > 0);
  }

  // Hand the daily puffs to the cigarette tracker (same device, localStorage) and open it.
  let lastPuffsPerDay = null;
  $('track').addEventListener('click', () => {
    const T = window.Tracker;
    const s = T.load(localStorage) || T.newState();
    s.puffsPerDay = Math.round(lastPuffsPerDay);
    T.save(localStorage, s);
    location.href = '/smoking-calculator/tracker';
  });

  function render() {
    const shown = tx.filter((t) => t.on || (t.p >= POSSIBLE && t.amount > 0));
    $('flagged').replaceChildren(...shown.map((t) => row(t, true)));
    $('reviewHint').textContent = shown.length
      ? 'Ticked purchases are counted. Untick anything that isn\'t vaping; possible matches are left unticked for you to check.'
      : 'Nothing here looked like a vape shop. If you buy vapes with your shopping, search for those purchases below.';
    for (const id of ['review', 'product', 'summary']) $(id).hidden = !tx.length;
    renderSearch();
    renderSummary();
  }

  // Product presets.
  for (const p of V.PRODUCTS) $('productSel').add(new Option(p.name, p.id));
  function applyProduct() {
    const p = V.PRODUCTS.find((x) => x.id === $('productSel').value);
    $('puffs').value = p.puffs;
    $('price').value = p.price;
    if (tx.length) renderSummary();
  }
  $('productSel').addEventListener('change', applyProduct);
  applyProduct();
  for (const id of ['puffs', 'price', 'packPrice']) $(id).addEventListener('input', () => tx.length && renderSummary());
  $('search').addEventListener('input', renderSearch);

  $('file').addEventListener('change', (e) => { handle([...e.target.files]); e.target.value = ''; });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handle([...e.dataTransfer.files]); });
})();
