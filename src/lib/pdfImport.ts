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
import { detectDiagramRegions, type DiagramDetection } from "@/lib/pdfVision";

/** A crop rectangle expressed as fractions (0–1) of the full source page image. */
export interface CropBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

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
  /** Which page (1-based, key into ImportResult.pageImages) this image was cropped from — only set when `image` came from the PDF itself, not a manual upload. */
  pageNum?: number;
  /** The crop rectangle (fractions of the full page) that produced `image`, so the review screen can let the admin drag it around instead of re-guessing. */
  cropBox?: CropBox;
}

export interface ImportResult {
  questions: DraftQuestion[];
  /** Paper-level problems (e.g. "couldn't read any text from this PDF"). */
  errors: string[];
  /** Full-resolution page renders, keyed by 1-based page number, for the crop-adjust tool. Only pages that produced at least one question are included. */
  pageImages: Record<number, string>;
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

const QUESTION_MARKER_RE = /^\s*(?:Q\.?\s*)?(\d{1,3})(?:[.):]\s*|\s+)(.*)$/i;
// A bare option letter on its own — the labels printed on/around a diagram,
// e.g. "A" next to a car in a junction diagram.
const OPTION_LETTER_RE = /^[A-D]$/;
// A real lettered text option, e.g. "a) Regulatory sign" or "b. Weight restriction".
const OPTION_TEXT_RE = /^([a-dA-D])\s*[.):]\s*(.+)$/;
export const LETTER_ORDER = ["a", "b", "c", "d", "e"];

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

/** Crops [topY, bottomY) × [leftX, rightX) (canvas pixel space, top-down) out of a source canvas. */
function cropCanvas(
  source: HTMLCanvasElement,
  topY: number,
  bottomY: number,
  leftX = 0,
  rightX: number = source.width,
): string {
  const top = Math.max(0, Math.floor(topY));
  const bottom = Math.min(source.height, Math.ceil(bottomY));
  const left = Math.max(0, Math.floor(leftX));
  const right = Math.min(source.width, Math.ceil(rightX));
  const height = Math.max(1, bottom - top);
  const width = Math.max(1, right - left);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create a canvas context for cropping");
  ctx.drawImage(source, left, top, width, height, 0, 0, width, height);
  return out.toDataURL("image/png");
}

/** A smaller copy of a rendered page, just for the vision call — keeps token cost and upload size down. */
function downscaleForVision(source: HTMLCanvasElement, maxDim = 1200): string {
  const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
  if (scale >= 1) return source.toDataURL("image/png");
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(source.width * scale));
  out.height = Math.max(1, Math.round(source.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");
  ctx.drawImage(source, 0, 0, out.width, out.height);
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
  const pageImages: Record<number, string> = {};
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
    // Kept around (once per page, not per question) so the review screen's
    // crop-adjust tool can re-crop from the original full-resolution render
    // instead of only being able to nudge an already-cropped, lower-detail
    // image.
    pageImages[pageNum] = canvas.toDataURL("image/png");
    const boxFromPx = (topPx: number, bottomPx: number, leftPx = 0, rightPx = canvas.width): CropBox => ({
      top: topPx / canvas.height,
      left: leftPx / canvas.width,
      width: (rightPx - leftPx) / canvas.width,
      height: (bottomPx - topPx) / canvas.height,
    });

    // Ask Claude where each question's diagram/photo actually is — far more
    // reliable than guessing from blank pixel rows, and only one call per
    // page. If no API key is configured yet, or the call fails for any
    // reason, aiRegions stays empty and every question on this page falls
    // back to the pixel-based heuristic below — importing still works
    // end-to-end either way, just with less precise crops without a key.
    const aiRegions = new Map<number, DiagramDetection>();
    try {
      const vision = await detectDiagramRegions({
        data: {
          pageImageDataUrl: downscaleForVision(canvas),
          questionNumbers: markers.map((m) => m.number),
        },
      });
      if (vision.ok) {
        for (const region of vision.regions) aiRegions.set(region.number, region);
      } else if (vision.reason !== "no-api-key") {
        errors.push(
          `Diagram detection was unavailable for page ${pageNum} (${vision.reason}) — used a fallback crop instead; double-check that page's images in review.`,
        );
      }
    } catch {
      errors.push(
        `Diagram detection was unavailable for page ${pageNum} — used a fallback crop instead; double-check that page's images in review.`,
      );
    }

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
      const aiRegion = aiRegions.get(marker.number);
      let options: string[];
      let image: string | undefined;
      let letters: string[] = [];
      let questionText: string;
      let cropBox: CropBox | undefined;
      // The letter designator to match each option in `options` against the
      // answer key, index-aligned with `options` (which for text options
      // holds the option's full prose, not its letter).
      let matchKeys: string[];

      if (textOptions) {
        // Real text options (e.g. "a) Regulatory sign"). Any prose lines
        // between the question's own line and the options are wrapped
        // continuation of the question text, not a diagram — fold them in
        // instead of letting them get mistaken for image content.
        options = textOptions.map((o) => o.text);
        letters = textOptions.map((o) => o.letter.toUpperCase());
        matchKeys = letters;

        const optionTopPx = toPx(textOptions[0].y);
        const continuation = collectContinuationLines(lines, marker.y, textOptions[0].y);
        questionText = [marker.firstLineText, ...continuation.map((l) => l.text)]
          .filter(Boolean)
          .join(" ");

        if (aiRegion) {
          // Claude looked at the actual page and knows whether there's a
          // diagram here and exactly where it sits — trust that over guessing.
          if (aiRegion.hasDiagram && aiRegion.box) {
            const b = aiRegion.box;
            cropBox = b;
            image = cropCanvas(
              canvas,
              b.top * canvas.height,
              (b.top + b.height) * canvas.height,
              b.left * canvas.width,
              (b.left + b.width) * canvas.width,
            );
          }
        } else {
          // No AI detection for this question (no API key configured, or
          // this page's call failed) — fall back to the pixel heuristic:
          // only the leftover space after all real text is a candidate for
          // an actual diagram/photo, and only if there's real ink there.
          const contentStartPx = toPx(
            continuation.length > 0 ? continuation[continuation.length - 1].y : marker.y,
          );
          const imageTop = imageData
            ? findBoundary(
                imageData,
                canvas.width,
                contentStartPx + 20,
                contentStartPx,
                optionTopPx,
              )
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
            cropBox = boxFromPx(imageTop, imageBottom);
            image = cropCanvas(canvas, imageTop, imageBottom);
          }
        }
      } else {
        // Diagram-label style (bare A/B/C/D letters drawn on the diagram).
        letters = detectBareLetters(lines, marker.y, nextY);
        options = letters.length > 0 ? letters : ["A", "B", "C", "D"];
        matchKeys = options.map((o) => o.toUpperCase());
        const continuation = collectContinuationLines(lines, marker.y, nextY);
        questionText = [marker.firstLineText, ...continuation.map((l) => l.text)]
          .filter(Boolean)
          .join(" ");

        if (aiRegion) {
          if (aiRegion.hasDiagram && aiRegion.box) {
            const b = aiRegion.box;
            cropBox = b;
            image = cropCanvas(
              canvas,
              b.top * canvas.height,
              (b.top + b.height) * canvas.height,
              b.left * canvas.width,
              (b.left + b.width) * canvas.width,
            );
          }
        } else {
          // Fallback: the whole question block (question text plus diagram)
          // between the shared, ink-snapped boundaries.
          cropBox = boxFromPx(top, bottom);
          image = cropCanvas(canvas, top, bottom);
        }
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
        pageNum: image ? pageNum : undefined,
        cropBox: image ? cropBox : undefined,
      });
    }
  }

  if (!anyMarkersFound) {
    errors.push(
      "Couldn't find any numbered questions in this PDF. It may be a scanned image rather than a text-based PDF — try typing the questions in manually instead.",
    );
  }

  draft.sort((a, b) => a.number - b.number);
  return { questions: draft, errors, pageImages };
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

/**
 * Crops a fractional box (0–1 top/left/width/height) out of a full-page
 * source image and returns the result as a new data URL. Used by the
 * drag-to-adjust crop tool to re-cut a question's diagram once the admin
 * has repositioned or resized the box, without needing the original pdf.js
 * page object around any more.
 *
 * Accepts either a `data:` URL (during the initial import review, before
 * anything's been uploaded) or a remote Storage URL (when re-adjusting a
 * crop on an already-saved question) — `crossOrigin` is set so the latter
 * doesn't taint the canvas and block `toDataURL`.
 */
export function cropDataUrlToBox(pageImageUrl: string, box: CropBox): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!pageImageUrl.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const left = Math.round(box.left * img.naturalWidth);
      const top = Math.round(box.top * img.naturalHeight);
      const width = Math.max(1, Math.round(box.width * img.naturalWidth));
      const height = Math.max(1, Math.round(box.height * img.naturalHeight));
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const ctx = out.getContext("2d");
      if (!ctx) return reject(new Error("Could not create a canvas context for cropping"));
      ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not load the page image for cropping"));
    img.src = pageImageUrl;
  });
}

/**
 * Turns a `data:` URL (e.g. a cropped diagram produced client-side) back
 * into a File so it can go through the same Storage-upload path as
 * manually-picked images, instead of being saved inline as a giant base64
 * string on the question (which is what caused the diagram to visibly lag
 * in behind the question text on the student side).
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}