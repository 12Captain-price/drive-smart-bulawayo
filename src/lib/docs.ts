/**
 * Small document helpers: download data as a spreadsheet (CSV, opens in Excel)
 * or print/save it as a PDF via the browser's own print dialog.
 *
 * Keeping this dependency-free means it works the same once the data layer is
 * swapped for a real backend — only the rows passed in change.
 */

import { SITE_NAME } from "./data";

export type Row = Record<string, string | number>;

/**
 * Parse CSV text into rows keyed by header. Handles quoted fields (with
 * embedded commas, newlines, and escaped "" quotes) — the same format Excel
 * and Google Sheets produce when you "Save as CSV".
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM if present (common when the file was saved by Excel).
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** Download rows as a CSV file — opens straight into Excel. */
export function downloadSpreadsheet(filename: string, rows: Row[]) {
  if (rows.length === 0) throw new Error("There is nothing to export yet.");
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
  ].join("\r\n");
  download(filename.endsWith(".csv") ? filename : `${filename}.csv`, "\uFEFF" + csv, "text/csv");
}

const escapeHtml = (v: string | number) =>
  String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

const shell = (title: string, body: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#11223a;margin:32px;line-height:1.5}
  h1{font-size:20px;margin:0 0 4px}
  .brand{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#c0392b;font-weight:700}
  .meta{color:#667;font-size:12px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
  th,td{border:1px solid #d8dee8;padding:7px 9px;text-align:left;vertical-align:top}
  th{background:#f1f4f9;font-weight:600}
  .box{border:1px solid #d8dee8;border-radius:10px;padding:16px;margin-top:14px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px dashed #e4e8ef;font-size:13px}
  .row:last-child{border-bottom:0}
  .row span:first-child{color:#667}
  .total{font-size:16px;font-weight:700}
  .foot{margin-top:24px;font-size:11px;color:#889}
  @media print{body{margin:12mm}}
</style></head>
<body><div class="brand">${escapeHtml(SITE_NAME)}</div>${body}
<div class="foot">Printed ${new Date().toLocaleString()} · ${escapeHtml(SITE_NAME)}, Bulawayo</div>
<script>window.onload=()=>{window.focus();window.print();}</script>
</body></html>`;

/** Open a print window so the user can save the document as a PDF. */
export function printDocument(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) throw new Error("Please allow pop-ups so the document can open.");
  w.document.write(shell(title, bodyHtml));
  w.document.close();
}

/** School details shown in a document's letterhead. */
export interface LetterheadInfo {
  phone: string;
  address: string;
  hours: string;
}

const letterheadShell = (title: string, body: string, info: LetterheadInfo) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#11223a;margin:32px;line-height:1.5}
  h1{font-size:20px;margin:0 0 4px}
  .letterhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid #c0392b;padding-bottom:16px;margin-bottom:20px}
  .letterhead img{height:52px;width:52px;object-fit:contain;flex-shrink:0}
  .letterhead .name{font-size:19px;font-weight:800;letter-spacing:.02em}
  .letterhead .contact{font-size:11.5px;color:#667;margin-top:3px}
  .meta{color:#667;font-size:12px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
  th,td{border:1px solid #d8dee8;padding:7px 9px;text-align:left;vertical-align:top}
  th{background:#f1f4f9;font-weight:600}
  .box{border:1px solid #d8dee8;border-radius:10px;padding:16px;margin-top:14px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px dashed #e4e8ef;font-size:13px}
  .row:last-child{border-bottom:0}
  .row span:first-child{color:#667}
  .total{font-size:16px;font-weight:700}
  .foot{margin-top:24px;font-size:11px;color:#889}
  @media print{body{margin:12mm}}
</style></head>
<body>
<div class="letterhead">
  <img src="/logo.png" alt="${escapeHtml(SITE_NAME)} logo" />
  <div>
    <div class="name">${escapeHtml(SITE_NAME)}</div>
    <div class="contact">${escapeHtml(info.phone)} &middot; ${escapeHtml(info.address)}</div>
    <div class="contact">${escapeHtml(info.hours)}</div>
  </div>
</div>
${body}
<div class="foot">Printed ${new Date().toLocaleString()} · ${escapeHtml(SITE_NAME)}, Bulawayo</div>
<script>window.onload=()=>{window.focus();window.print();}</script>
</body></html>`;

/** Same as printDocument, but with a full letterhead (logo + school contact
 *  details) at the top — for documents that stand alone once downloaded,
 *  like an enrolment confirmation, rather than routine internal exports. */
export function printLetterheadDocument(title: string, bodyHtml: string, info: LetterheadInfo) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) throw new Error("Please allow pop-ups so the document can open.");
  w.document.write(letterheadShell(title, bodyHtml, info));
  w.document.close();
}

/** Simple table document (used for the students export). */
export function printTable(title: string, subtitle: string, rows: Row[]) {
  if (rows.length === 0) throw new Error("There is nothing to export yet.");
  const headers = Object.keys(rows[0]);
  printDocument(
    title,
    `<h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(subtitle)}</div>
     <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
     <tbody>${rows
       .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h] ?? "")}</td>`).join("")}</tr>`)
       .join("")}</tbody></table>`,
  );
}

/** Key/value detail document (single student, payment receipt). */
export function detailHtml(heading: string, subtitle: string, pairs: [string, string | number][]) {
  return `<h1>${escapeHtml(heading)}</h1><div class="meta">${escapeHtml(subtitle)}</div>
    <div class="box">${pairs
      .map(
        ([k, v]) =>
          `<div class="row"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`,
      )
      .join("")}</div>`;
}

export function tableHtml(caption: string, rows: Row[]) {
  if (rows.length === 0)
    return `<div class="meta" style="margin-top:16px">${escapeHtml(caption)}: none yet</div>`;
  const headers = Object.keys(rows[0]);
  return `<h1 style="margin-top:22px;font-size:15px">${escapeHtml(caption)}</h1>
    <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h] ?? "")}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
}