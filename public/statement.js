// Bank statement reader: CSV exports and the text of PDF statements -> transactions.
// Runs in the browser (and in Node for tests). Nothing here sends data anywhere.
// A transaction is { date: 'YYYY-MM-DD' | null, description, amount } where amount > 0 is money out.
'use strict';
(function (root) {
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');

  // UK-style dates: 05/03/2026, 05-03-26, 2026-03-05, 5 Mar 2026, 05 Mar 26, 5 Mar (year from the statement).
  const DATE_RE = /^\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?(?:\s+\d{2,4})?)\b/;

  function parseDate(s, fallbackYear) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      if (Number(m[2]) < 1 || Number(m[2]) > 12) return null;
      return `${y}-${pad(m[2])}-${pad(m[1])}`;
    }
    m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:\s+(\d{2,4}))?/);
    if (m) {
      const mon = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)];
      if (!mon) return null;
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : fallbackYear;
      return y ? `${y}-${pad(mon)}-${pad(m[1])}` : null;
    }
    return null;
  }

  // "£1,234.56", "-12.30", "(12.30)", "12.30 DR", "12.30CR" -> signed number (credit positive, debit negative), or NaN.
  function parseAmount(s) {
    let t = String(s || '').trim();
    if (!t) return NaN;
    let sign = 1;
    if (/\bDR\b|DR$/i.test(t)) sign = -1;
    if (/^\(.*\)$/.test(t)) sign = -1;
    t = t.replace(/\b(CR|DR)\b|CR$|DR$/gi, '').replace(/[£$€,\s()]/g, '');
    if (t.startsWith('-')) { sign *= -1; t = t.slice(1); }
    if (t.startsWith('+')) t = t.slice(1);
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return sign * Number(t);
  }

  function parseCsvRows(text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/).slice(0, 20).join('\n');
    const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((f) => f.trim()));
  }

  const ROLE = {
    date: /^(transaction |posting |posted |completed )?date|date$/,
    desc: /description|details|merchant|narrative|payee|^name$|memo|counter ?party|transaction$|^reference$|^type$/,
    out: /paid out|money out|debit|withdrawal|spent|^out$/,
    in: /paid in|money in|credit|deposit|received|^in$/,
    amount: /^amount|^value|amount$/,
  };

  function parseCsv(text) {
    const rows = parseCsvRows(text);
    // Some banks put account details above the header row: find the header in the first rows.
    let h = -1, cols = null;
    for (let i = 0; i < Math.min(rows.length, 20) && h < 0; i++) {
      const lower = rows[i].map((c) => c.trim().toLowerCase());
      const date = lower.findIndex((c) => ROLE.date.test(c));
      const desc = lower.map((c, j) => (ROLE.desc.test(c) && !ROLE.date.test(c) && !/balance|category|currency|id$/.test(c) ? j : -1)).filter((j) => j >= 0);
      const out = lower.findIndex((c) => ROLE.out.test(c) && !/balance/.test(c));
      const inn = lower.findIndex((c) => ROLE.in.test(c) && !/balance|card/.test(c));
      const amount = lower.findIndex((c) => ROLE.amount.test(c) && !/balance/.test(c));
      if (date >= 0 && desc.length && (amount >= 0 || out >= 0)) { h = i; cols = { date, desc, out, in: inn, amount }; }
    }
    // No header row (e.g. HSBC): date, description, amount in the first three columns.
    if (h < 0 && rows.length && parseDate(rows[0][0]) && rows[0].length >= 3 && Number.isFinite(parseAmount(rows[0][2]))) {
      h = -1; cols = { date: 0, desc: [1], out: -1, in: -1, amount: 2 };
    } else if (h < 0) throw new Error('Could not find the date, description and amount columns in this CSV. Try your bank\'s standard CSV download.');
    const body = rows.slice(h + 1);
    let signed = body.map((r) => {
      if (cols.out >= 0 && (r[cols.out] || '').trim()) return -Math.abs(parseAmount(r[cols.out]));
      if (cols.in >= 0 && (r[cols.in] || '').trim()) return Math.abs(parseAmount(r[cols.in]));
      return cols.amount >= 0 ? parseAmount(r[cols.amount]) : NaN;
    });
    // One amount column: most rows on any statement are spending, so whichever sign is
    // more common is money out (negative on bank accounts, positive on most credit cards).
    if (cols.out < 0) {
      const vals = signed.filter((n) => Number.isFinite(n) && n !== 0);
      const negatives = vals.filter((n) => n < 0).length;
      if (negatives < vals.length - negatives) signed = signed.map((n) => -n);
    }
    const tx = [];
    body.forEach((r, i) => {
      if (!Number.isFinite(signed[i])) return;
      const description = [...new Set(cols.desc.map((j) => (r[j] || '').trim()).filter(Boolean))].join(' · ');
      if (!description) return;
      tx.push({ date: parseDate(r[cols.date]), description, amount: Math.round(-signed[i] * 100) / 100 });
    });
    return tx;
  }

  // Lines of text from a PDF statement. Many statements only print the date on the first
  // transaction of each day, so the last date seen carries forward. When a line has several
  // amounts, the first is the transaction and the last is the running balance.
  const AMOUNT_RE = /(?:^|\s)\(?-?£?\d{1,3}(?:,\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR))?(?=\s|$)/g;
  const BALANCE_LINE = /balance (brought|carried) forward|opening balance|closing balance/i;
  const SKIP = /balance (brought|carried) forward|opening balance|closing balance|^totals?\b|sort code|account (number|name)|statement (date|period)|page \d+|interest rate|overdraft limit/i;

  function parseStatementLines(lines, fallbackYear) {
    if (!fallbackYear) {
      const y = lines.join(' ').match(/\b(20\d{2})\b/);
      fallbackYear = y ? Number(y[1]) : new Date().getFullYear();
    }
    const tx = [];
    let current = null;
    let balance = null; // running balance, to tell money in from money out
    for (const raw of lines) {
      let line = String(raw).replace(/\s+/g, ' ').trim();
      if (!line) continue;
      const dm = line.match(DATE_RE);
      if (dm) {
        const d = parseDate(dm[1], fallbackYear);
        if (d) { current = d; line = line.slice(dm[0].length).trim(); }
      }
      const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => m[0].trim());
      if (BALANCE_LINE.test(line) && amounts.length) balance = parseAmount(amounts[amounts.length - 1]);
      if (SKIP.test(line)) continue;
      if (!amounts.length || !current) continue;
      let description = line;
      for (const a of amounts) description = description.replace(a, ' ');
      description = description.replace(/\s+/g, ' ').trim();
      if (!description || description.length < 2) continue;
      const value = parseAmount(amounts[0]);
      if (!Number.isFinite(value)) continue;
      // Direction is rarely marked in PDF text. When the line ends with a running balance,
      // a rising balance means money in; otherwise it's money out unless marked CR.
      let credit = /CR$/i.test(amounts[0]);
      if (amounts.length >= 2) {
        const after = parseAmount(amounts[amounts.length - 1]);
        if (balance != null && Number.isFinite(after)) {
          if (Math.abs(balance + Math.abs(value) - after) < 0.005) credit = true;
          else if (Math.abs(balance - Math.abs(value) - after) < 0.005) credit = false;
        }
        if (Number.isFinite(after)) balance = after;
      }
      tx.push({ date: current, description, amount: credit ? -Math.abs(value) : Math.abs(value) });
    }
    return tx;
  }

  // pdf.js text items -> lines, grouped by page and vertical position, read left to right.
  function linesFromTextItems(pages) {
    const lines = [];
    for (const items of pages) {
      const rows = [];
      for (const it of items) {
        if (!it.str || !it.str.trim()) continue;
        const x = it.transform[4], y = it.transform[5];
        let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
        if (!row) { row = { y, parts: [] }; rows.push(row); }
        row.parts.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.parts.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join(' '));
    }
    return lines;
  }

  const api = { parseDate, parseAmount, parseCsvRows, parseCsv, parseStatementLines, linesFromTextItems };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Statement = api;
})(typeof self !== 'undefined' ? self : this);
