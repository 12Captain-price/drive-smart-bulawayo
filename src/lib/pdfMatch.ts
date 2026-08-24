// Utilities for the "pdf" test type: pulling text out of an uploaded answer
// key PDF and matching it against a student's typed answers.
//
// This is a *best-effort suggestion*, not a real grader. It only works when
// the answer key PDF has actual embedded text (typed/exported — not a scan
// or a photo turned into a PDF), and only for students who typed their
// answers rather than photographing a written paper. Both limits are
// inherent — there's no OCR pipeline here, and handwriting OCR wouldn't be
// reliable enough to trust for real marks anyway. Callers must always let
// the marker review and confirm/edit — never write a mark straight from this.

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Pulls raw text out of a PDF given as a data URL (or any URL pdfjs can fetch). */
export async function extractPdfText(src: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdf = await pdfjsLib.getDocument({ url: src }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    pageTexts.push(line);
  }
  return pageTexts.join("\n");
}

/**
 * Splits text into question-number → answer pairs. Recognises lines that
 * start a new question with a leading number like "1.", "1)", "1 -", "Q1:",
 * "Q1.". Everything up to the next recognised marker is treated as that
 * question's answer. Returns an empty map if nothing matches the pattern —
 * callers should treat that as "couldn't parse", not "no answers".
 */
export function parseNumberedAnswers(text: string): Map<number, string> {
  const markerRe = /(?:^|\n)\s*(?:Q\.?\s*)?(\d{1,3})\s*[.):-]\s*/gi;
  const matches = [...text.matchAll(markerRe)];
  const out = new Map<number, string>();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0 || n > 300) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const answer = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (answer) out.set(n, answer);
  }
  return out;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap token-overlap similarity, 0..1 — good enough to flag "probably the same answer". */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

export interface PdfMatchRow {
  n: number;
  key: string;
  given: string | undefined;
  match: boolean;
  close: boolean;
}

export interface PdfMatchResult {
  rows: PdfMatchRow[];
  score: number;
  total: number;
}

/** Matches parsed answer-key answers against parsed student answers, question by question. */
export function matchPdfAnswers(keyText: string, studentText: string): PdfMatchResult | null {
  const key = parseNumberedAnswers(keyText);
  const given = parseNumberedAnswers(studentText);
  if (key.size === 0) return null; // couldn't parse the key — nothing to suggest

  const rows: PdfMatchRow[] = [];
  let score = 0;
  for (const [n, keyAnswer] of [...key.entries()].sort((a, b) => a[0] - b[0])) {
    const givenAnswer = given.get(n);
    const sim = givenAnswer ? similarity(keyAnswer, givenAnswer) : 0;
    const match = sim >= 0.99;
    const close = !match && sim >= 0.5;
    if (match) score++;
    rows.push({ n, key: keyAnswer, given: givenAnswer, match, close });
  }
  return { rows, score, total: key.size };
}