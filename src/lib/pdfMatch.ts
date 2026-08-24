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

/**
 * Pulls raw text out of a PDF given as a data URL (or any URL pdfjs can
 * fetch), reconstructing line breaks from each text item's Y position.
 *
 * pdfjs's getTextContent() returns a flat list of text runs with no notion
 * of "lines" — just joining their strings collapses an entire page into one
 * line, which breaks any parsing that looks for "1." at the start of a
 * line. Line breaks have to be inferred: a new line starts whenever an
 * item's baseline Y (transform[5]) jumps from the previous item's.
 */
export async function extractPdfText(src: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdf = await pdfjsLib.getDocument({ url: src }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // First pass: group items into lines by Y position (as before), but
    // also record how big the Y jump was going into each line.
    const rawLines: { text: string; gapBefore: number }[] = [];
    let lastY: number | null = null;
    let line = "";
    let pendingGap = 0; // gap leading into the line currently being built
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        rawLines.push({ text: line, gapBefore: pendingGap });
        line = "";
        pendingGap = Math.abs(y - lastY);
      }
      line += line && !line.endsWith(" ") && !item.str.startsWith(" ") ? ` ${item.str}` : item.str;
      lastY = y;
    }
    if (line) rawLines.push({ text: line, gapBefore: pendingGap });

    // The most common line-to-line gap on the page is the "normal" single
    // line height. A gap noticeably bigger than that marks a paragraph or
    // section break (e.g. between the last row of a table and trailing
    // notes below it) — insert a blank line there. Downstream parsing
    // (parseNumberedAnswers) uses blank lines to know where an answer
    // actually ends, instead of running on into unrelated trailing text
    // just because there's no next numbered marker to stop it.
    const gapCounts = new Map<number, number>();
    for (const { gapBefore } of rawLines.slice(1)) {
      const rounded = Math.round(gapBefore);
      gapCounts.set(rounded, (gapCounts.get(rounded) ?? 0) + 1);
    }
    let typicalGap = 0;
    let bestCount = 0;
    for (const [gap, count] of gapCounts) {
      if (count > bestCount) {
        bestCount = count;
        typicalGap = gap;
      }
    }

    const lines: string[] = [];
    rawLines.forEach(({ text, gapBefore }, i) => {
      if (i > 0 && typicalGap > 0 && gapBefore > typicalGap * 1.25) {
        lines.push("");
      }
      lines.push(text);
    });
    pageTexts.push(lines.join("\n"));
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
  // Punctuation after the number is now optional: table-style keys like
  // "1 B The vehicle on the right" separate the number from the rest with
  // nothing but a space. (Punctuated styles like "1.", "1)", "1 -", "Q1:"
  // still work the same as before.)
  const markerRe = /(?:^|\n)\s*(?:Q\.?\s*)?(\d{1,3})\s*[.):-]?\s*/gi;
  const matches = [...text.matchAll(markerRe)];
  const out = new Map<number, string>();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0 || n > 300) continue;
    const start = (m.index ?? 0) + m[0].length;
    let end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    // A blank line (inserted by extractPdfText at a paragraph/section
    // break) marks the real end of an answer even when there's no next
    // numbered marker to bound it — e.g. the last question in a table,
    // followed by unrelated notes further down the page.
    const blankLineOffset = text.slice(start, end).search(/\n[ \t]*\n/);
    if (blankLineOffset !== -1) end = start + blankLineOffset;
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

/**
 * Pulls a short "designator" (an MCQ letter, a number, a short word like
 * "true") out of a longer answer-key line that mixes the answer in with
 * explanation text — e.g. "B — the vehicle on the right has right of way"
 * or "A flashing amber light... Answer: B". Answer keys routinely look like
 * this, and comparing the *whole* sentence against a student's one-letter
 * answer would almost never match on word overlap alone.
 *
 * Three patterns, in priority order: an explicit "answer:"/"ans:" marker
 * anywhere in the text (most reliable — it's unambiguous); a short token at
 * the very start followed by punctuation like "—"/"-"/":"/")" (e.g.
 * "B — ..."); or, for punctuation-free table keys like "B The vehicle on
 * the right", a bare leading token whose *next* word is also capitalised —
 * a real designator is followed by a new sentence, whereas ordinary prose
 * starting with a short word (e.g. "A flashing amber light...") continues
 * in lowercase. A leading word matching neither pattern is left alone.
 */
function extractDesignator(s: string): string | null {
  const trimmed = s.trim();
  const explicit = trimmed.match(/\b(?:answer|ans)\s*[:-]?\s*([A-Za-z0-9]{1,4})\b/i);
  if (explicit) return explicit[1];
  // "B — the vehicle..." / "B) ..." / "B: ..." — punctuation right after
  // the token is an unambiguous signal on its own.
  const punctuated = trimmed.match(/^([A-Za-z0-9]{1,4})\s*[-:)\u2014\u2013]\s*/);
  if (punctuated) return punctuated[1];
  // "B The vehicle on the right" — a bare token with no punctuation at all
  // (common in table-style keys: number, space, letter, space, description).
  // This is ambiguous with ordinary prose that happens to start with a short
  // word like "A" (e.g. "A flashing amber light..."), so it's only treated
  // as a designator when the next word ALSO starts a fresh sentence
  // (capitalised) — real prose continues in lowercase, while a designator is
  // followed by the actual answer text starting anew. Deliberately
  // conservative: a leading word not followed by this pattern is left alone.
  const bare = trimmed.match(/^([A-Z]{1,2}|\d{1,2})\s+(?=[A-Z])/);
  if (bare) return bare[1];
  return null;
}

/** Cheap token-overlap similarity, 0..1 — good enough to flag "probably the same answer". */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // If one side is short (a bare MCQ letter/number/short word), try
  // matching it against a designator pulled out of the other side first —
  // this is what makes matching work against real, noisy answer keys.
  const [short, long] = na.length <= nb.length ? [a, b] : [b, a];
  if (normalize(short).length <= 4) {
    const designator = extractDesignator(long);
    if (designator && normalize(designator) === normalize(short)) return 1;
  }

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