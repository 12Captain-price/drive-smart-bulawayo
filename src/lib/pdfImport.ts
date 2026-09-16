// Turns an uploaded MCQ paper (PDF) + an answer key into draft `Question`s
// ready for the admin to review before publishing. Everything runs
// client-side with pdfjs — no external vision API — by reading the PDF's
// real text layer (question numbers, prose, and either bare A/B/C/D labels
// printed on a diagram, or real "a) ..." text options) to find where one
// question ends and the next begins, then rasterising just the diagram
// portion (if any) of that strip as the question's image.
//
// This is a *best-effort draft generator*, not a publisher. It only works
// when the paper has an extractable text layer (typed/exported PDF, not a
// scanned photo) — there's no OCR here. Callers must always route the
// result through a review screen before it becomes a real test; nothing
// here should be trusted to publish unattended.

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseNumberedAnswers } from "@/lib/pdfMatch";

export interface DraftQuestion {
  /** Local id for the review screen only — a fresh uid() is assigned on publish. */
  draftId: string;
  number: number;
  text: string;
  image?: string;
  imageName?: string;
  options: string[];
  correct: number;
  /** Set when something about this question looks off, so the review screen can flag it. */
  warning?: string;
}

export interface ImportResult {
  questions: DraftQuestion[];
  /** Paper-level problems (e.g. "couldn't read any text from this PDF"). */
  errors: string[];
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

interface Line {
  y: number;
  items: TextItem[];
}

interface QuestionMarker {
  number: number;
  /** PDF-space y (bottom-up) of the marker's own line. */
  y: number;
  /** Text on the marker's own line, after the "N." prefix. */
  firstLineText: string;
}

interface TextOption {
  letter: string;
  text: string;
  /** PDF-space y (bottom-up) of this option's line. */
  y: number;
}

const QUESTION_MARKER_RE = /^\s*(?:Q\.?\s*)?(\d{1,3})\s*[.):]\s*(.*)$/i;
// A bare option letter on its own — the labels printed on/around a diagram,
// e.g. "A" next to a car in a junction diagram.
const OPTION_LETTER_RE = /^[A-D]$/;
// A real lettered text option, e.g. "a) Regulatory sign" or "b. Weight restriction".
const OPTION_TEXT_RE = /^([a-dA-D])\s*[.):]\s*(.+)$/;
const LETTER_ORDER = ["a", "b", "c", "d", "e"];

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjsLib;
}

/** Groups a page's raw text items into lines by Y position, keeping per-item x/y. */
function groupLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.y) < 3);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines;
}

function lineText(line: Line): string {
  return line.items
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extracts a short answer-key designator (letter/number) from a noisy answer line. */
function extractDesignator(s: string): string | null {
  const trimmed = s.trim();
  const explicit = trimmed.match(/\b(?:answer|ans)\s*[:-]?\s*([A-Za-z0-9]{1,3})\b/i);
  if (explicit) return explicit[1].toUpperCase();
  const leading = trimmed.match(/^([A-Za-z0-9]{1,3})\b/);
  if (leading) return leading[1].toUpperCase();
  return null;
}

/**
 * Looks for a run of real text options ("a) ...", "b) ...", ...) strictly
 * between a question's own line and the next question's line. Requires the
 * letters to appear in order starting at "a" and at least two of them, so a
 * stray "a." somewhere in a diagram label doesn't get mistaken for options.
 */
function detectTextOptions(lines: Line[], belowY: number, aboveY: number): TextOption[] | null {
  const candidates = lines.filter((l) => l.y < belowY && l.y > aboveY).sort((a, b) => b.y - a.y); // top to bottom

  const seq: TextOption[] = [];
  for (const line of candidates) {
    const m = lineText(line).match(OPTION_TEXT_RE);
    if (m && LETTER_ORDER.indexOf(m[1].toLowerCase()) === seq.length) {
      seq.push({ letter: m[1].toLowerCase(), text: m[2].trim(), y: line.y });
    } else if (seq.length > 0) {
      break; // sequence started and then broke — stop, rest is unrelated content
    }
  }
  return seq.length >= 2 ? seq : null;
}

/** Bare option letters (diagram labels) between a question's line and the next question's line. */
function detectBareLetters(lines: Line[], belowY: number, aboveY: number): string[] {
  const letters: string[] = [];
  for (const line of lines) {
    if (line.y >= belowY || line.y <= aboveY) continue;
    for (const item of line.items) {
      const token = item.str.trim();
      if (OPTION_LETTER_RE.test(token) && !letters.includes(token)) letters.push(token);
    }
  }
  return letters.sort();
}

/**
 * Reads one PDF page's text layer and returns the question markers found on
 * it (number, line position, and the line's own text).
 */
async function analyzePage(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<{ markers: QuestionMarker[]; lines: Line[] }> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of content.items) {
    if (!("str" in raw) || !raw.str.trim()) continue;
    items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5] });
  }
  const lines = groupLines(items).sort((a, b) => b.y - a.y); // top of page first

  const markers: QuestionMarker[] = [];
  for (const line of lines) {
    const text = lineText(line);
    const m = text.match(QUESTION_MARKER_RE);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    // Question numbers restart page to page in some papers but should still
    // increase within a page; skip obvious mis-detections (e.g. a stray
    // "1" from a diagram label rather than a real question start).
    if (!Number.isFinite(n) || n <= 0 || n > 300) continue;
    markers.push({ number: n, y: line.y, firstLineText: m[2].trim() });
  }

  return { markers, lines };
}

/** Renders a page to a canvas at a high-enough scale for a clean crop. */
async function renderPageToCanvas(
  page: import("pdfjs-dist").PDFPageProxy,
  scale: number,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas context for PDF rendering");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** True if canvas row `y` has no ink (i.e. is effectively blank page background). */
function rowIsBlank(data: Uint8ClampedArray, width: number, y: number): boolean {
  const rowStart = y * width * 4;
  for (let x = 0; x < width; x += 3) {
    const i = rowStart + x * 4;
    if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return false;
  }
  return true;
}

function bandIsBlank(data: Uint8ClampedArray, width: number, top: number, bottom: number): boolean {
  for (let y = top; y <= bottom; y++) {
    if (!rowIsBlank(data, width, y)) return false;
  }
  return true;
}

/**
 * Finds the real gap between two questions' content instead of trusting a
 * fixed offset from the next question's text line. Searches outward from a
 * naive guess (within [lo, hi]) for a run of blank rows and snaps the cut to
 * the middle of it, so a diagram that pokes past the naive boundary — in
 * either direction — still gets included in full rather than sliced.
 */
function findBoundary(
  data: Uint8ClampedArray,
  width: number,
  guessY: number,
  lo: number,
  hi: number,
): number {
  const band = 3;
  const guess = Math.min(Math.max(Math.round(guessY), lo), hi);
  for (let d = 0; d <= hi - lo; d++) {
    const upTop = guess - d - band + 1;
    if (upTop >= lo && bandIsBlank(data, width, upTop, upTop + band - 1)) {
      return upTop + Math.floor(band / 2);
    }
    const downTop = guess + d;
    if (downTop + band - 1 <= hi && bandIsBlank(data, width, downTop, downTop + band - 1)) {
      return downTop + Math.floor(band / 2);
    }
  }
  return guess; // no blank band found nearby — fall back to the naive guess
}

/** All non-empty text lines strictly between two PDF-space y positions, top to bottom, excluding option markers. */
function collectContinuationLines(
  lines: Line[],
  belowY: number,
  aboveY: number,
): { y: number; text: string }[] {
  return lines
    .filter((l) => l.y < belowY && l.y > aboveY)
    .sort((a, b) => b.y - a.y)
    .map((l) => ({ y: l.y, text: lineText(l) }))
    .filter(
      (l) => l.text.length > 0 && !OPTION_LETTER_RE.test(l.text) && !OPTION_TEXT_RE.test(l.text),
    );
}

/** Crops [topY, bottomY) (in canvas pixel space, top-down) out of a source canvas. */
function cropCanvas(source: HTMLCanvasElement, topY: number, bottomY: number): string {
  const top = Math.max(0, Math.floor(topY));
  const bottom = Math.min(source.height, Math.ceil(bottomY));
  const height = Math.max(1, bottom - top);
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas context for cropping");
  ctx.drawImage(source, 0, top, source.width, height, 0, 0, source.width, height);
  return out.toDataURL("image/png");
}

/**
 * Reads an uploaded MCQ paper PDF and an answer key (already-extracted
 * text, e.g. from `extractPdfText` on the key PDF, or pasted by the admin)
 * and returns draft questions with cropped diagrams, detected options, and
 * the matched correct answer — for the admin to review before publishing.
 */
export async function importPdfToDraftQuestions(
  paperSrc: string,
  keyText: string,
): Promise<ImportResult> {
  const errors: string[] = [];
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ url: paperSrc }).promise;

  const key = parseNumberedAnswers(keyText);
  if (key.size === 0) {
    errors.push(
      "Couldn't find any numbered answers in the answer key — questions will still be detected, but you'll need to pick each correct answer by hand in the review step.",
    );
  }

  const scale = 2.5; // high-DPI-ish, keeps crops legible on mobile too
  const draft: DraftQuestion[] = [];
  let anyMarkersFound = false;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const { markers, lines } = await analyzePage(page);
    if (markers.length === 0) continue;
    anyMarkersFound = true;

    const viewport = page.getViewport({ scale });
    const canvas = await renderPageToCanvas(page, scale);
    const ctx = canvas.getContext("2d");
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;

    const toPx = (pdfY: number) => viewport.convertToViewportPoint(0, pdfY)[1];

    // Shared boundaries between consecutive questions on this page, so one
    // question's bottom is always exactly the next one's top — no overlap,
    // no gap. Snapped to the nearest real blank band, not a fixed offset.
    const markerPx = markers.map((m) => toPx(m.y));
    const cuts: number[] = new Array(markers.length + 1);
    cuts[0] = imageData
      ? findBoundary(imageData, canvas.width, markerPx[0] - 6, 0, markerPx[0] + 6)
      : Math.max(0, markerPx[0] - 6);
    for (let i = 1; i < markers.length; i++) {
      cuts[i] = imageData
        ? findBoundary(
            imageData,
            canvas.width,
            (markerPx[i - 1] + markerPx[i]) / 2,
            markerPx[i - 1],
            markerPx[i],
          )
        : (markerPx[i - 1] + markerPx[i]) / 2;
    }
    cuts[markers.length] = canvas.height;

    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const nextY = i + 1 < markers.length ? markers[i + 1].y : viewport.viewBox[1]; // PDF space, page bottom for the last one
      const top = cuts[i];
      const bottom = cuts[i + 1];

      const textOptions = detectTextOptions(lines, marker.y, nextY);
      let options: string[];
      let image: string | undefined;
      let letters: string[] = [];
      let questionText: string;
      // The letter designator to match each option in `options` against the
      // answer key, index-aligned with `options` (which for text options
      // holds the option's full prose, not its letter).
      let matchKeys: string[];

      if (textOptions) {
        // Real text options (e.g. "a) Regulatory sign"). Any prose lines
        // between the question's own line and the options are wrapped
        // continuation of the question text, not a diagram — fold them in
        // instead of letting them get mistaken for image content. Only the
        // leftover space *after* all real text (if any) is a candidate for
        // an actual diagram/photo, and only if there's real ink there;
        // otherwise this question has no image at all.
        options = textOptions.map((o) => o.text);
        letters = textOptions.map((o) => o.letter.toUpperCase());
        matchKeys = letters;

        const optionTopPx = toPx(textOptions[0].y);
        const continuation = collectContinuationLines(lines, marker.y, textOptions[0].y);
        questionText = [marker.firstLineText, ...continuation.map((l) => l.text)]
          .filter(Boolean)
          .join(" ");
        const contentStartPx = toPx(
          continuation.length > 0 ? continuation[continuation.length - 1].y : marker.y,
        );

        const imageTop = imageData
          ? findBoundary(imageData, canvas.width, contentStartPx + 20, contentStartPx, optionTopPx)
          : contentStartPx;
        const imageBottom = imageData
          ? findBoundary(
              imageData,
              canvas.width,
              (imageTop + optionTopPx) / 2,
              imageTop,
              optionTopPx,
            )
          : optionTopPx;
        const hasInk = imageData
          ? !bandIsBlank(imageData, canvas.width, Math.ceil(imageTop), Math.floor(imageBottom))
          : false;
        if (hasInk && imageBottom - imageTop > 12) {
          image = cropCanvas(canvas, imageTop, imageBottom);
        }
      } else {
        // Diagram-label style (bare A/B/C/D letters drawn on the diagram) —
        // the whole question block, question text plus diagram, is the image.
        letters = detectBareLetters(lines, marker.y, nextY);
        options = letters.length > 0 ? letters : ["A", "B", "C", "D"];
        matchKeys = options.map((o) => o.toUpperCase());
        const continuation = collectContinuationLines(lines, marker.y, nextY);
        questionText = [marker.firstLineText, ...continuation.map((l) => l.text)]
          .filter(Boolean)
          .join(" ");
        image = cropCanvas(canvas, top, bottom);
      }
      if (!questionText) questionText = `Question ${marker.number}`;

      const keyAnswer = key.get(marker.number);
      const designator = keyAnswer ? extractDesignator(keyAnswer) : null;
      let correct = 0;
      let warning: string | undefined;
      if (!keyAnswer) {
        warning = "No answer found in the key for this question — check it by hand.";
      } else if (designator) {
        const idx = matchKeys.findIndex((k) => k === designator);
        if (idx >= 0) correct = idx;
        else
          warning = `Answer key says "${designator}", which doesn't match a detected option — check it by hand.`;
      } else {
        warning = `Couldn't read a clear letter from the answer key ("${keyAnswer}") — check it by hand.`;
      }
      if (!textOptions && letters.length === 0) {
        warning =
          warning ??
          "Couldn't detect option letters on the diagram — check the crop and options by hand.";
      }

      draft.push({
        draftId: `${pageNum}-${marker.number}-${i}`,
        number: marker.number,
        text: questionText,
        image,
        imageName: image ? `question-${marker.number}.png` : undefined,
        options,
        correct,
        warning,
      });
    }
  }

  if (!anyMarkersFound) {
    errors.push(
      "Couldn't find any numbered questions in this PDF. It may be a scanned image rather than a text-based PDF — try typing the questions in manually instead.",
    );
  }

  draft.sort((a, b) => a.number - b.number);
  return { questions: draft, errors };
}

/** Reads a File into a data URL, for handing to pdfjs / extractPdfText. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}