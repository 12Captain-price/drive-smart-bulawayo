// Word-document counterpart to pdfImport.ts's importPdfToDraftQuestions.
//
// A Word doc has no fixed page geometry to render and crop from, so this
// takes a different (and in one way simpler) approach: mammoth converts the
// document to HTML, any diagrams come back as already-discrete <img>
// elements (mammoth embeds each picture as its own base64 data URI) rather
// than ink on a scanned page, so there's no region-detection/cropping step
// at all — whichever image sits inside a question's block is used as-is.
// That also means imported diagrams here don't get an "Adjust crop" option
// (there's no source page to re-cut from), unlike PDF imports.
//
// Like pdfImport.ts, this is a best-effort draft generator: it only
// recognises questions that start with a number ("1.", "Q1)", …) and
// options that are either typed as "a) ...")/"b) ..." lines or a native
// Word numbered/bulleted list. Anything else falls through to the review
// screen's manual fallbacks, same as the PDF path.

import { parseNumberedAnswers, extractDesignator } from "@/lib/pdfMatch";
import { LETTER_ORDER, type DraftQuestion, type ImportResult } from "@/lib/pdfImport";
import { docxSrcToArrayBuffer } from "@/lib/docx";

const QUESTION_MARKER_RE = /^\s*(?:Q\.?\s*)?(\d{1,3})(?:[.):]\s*|\s+)(.*)$/i;
const OPTION_TEXT_RE = /^([a-dA-D])\s*[.):]\s*(.+)$/;

interface Block {
  text: string;
  image?: string;
  /** A `<li>` inside an `<ol>`/`<ul>` — Word's native numbered/bulleted
   *  options, as opposed to a plain paragraph that happens to start with
   *  "a)". Consecutive list-item blocks are treated as options in order,
   *  regardless of what (if any) prefix their text has. */
  isListItem: boolean;
}

async function docxToBlocks(arrayBuffer: ArrayBuffer): Promise<Block[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const doc = new DOMParser().parseFromString(result.value, "text/html");
  const blocks: Block[] = [];

  for (const el of Array.from(doc.body.children)) {
    if (el.tagName === "OL" || el.tagName === "UL") {
      for (const li of Array.from(el.children)) {
        const text = (li.textContent ?? "").replace(/\s+/g, " ").trim();
        const img = li.querySelector("img");
        if (!text && !img) continue;
        blocks.push({ text, image: img?.getAttribute("src") ?? undefined, isListItem: true });
      }
      continue;
    }
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const img = el.querySelector("img");
    if (!text && !img) continue;
    blocks.push({ text, image: img?.getAttribute("src") ?? undefined, isListItem: false });
  }
  return blocks;
}

/** True if `designator` (from the answer key) points at option index `i`, by letter or by 1-based position. */
function designatorMatchesIndex(designator: string, i: number, letter: string): boolean {
  const d = designator.trim().toUpperCase();
  return d === letter.toUpperCase() || d === String(i + 1);
}

/**
 * Reads an uploaded MCQ paper as a Word document (plus an answer key,
 * already-extracted text) and returns draft questions for the admin to
 * review — same contract as `importPdfToDraftQuestions`, so the review
 * screen and confirmImport() don't need to know which path produced them.
 */
export async function importDocxToDraftQuestions(
  paperSrc: string,
  keyText: string,
): Promise<ImportResult> {
  const errors: string[] = [];
  const arrayBuffer = await docxSrcToArrayBuffer(paperSrc);
  const blocks = await docxToBlocks(arrayBuffer);

  const key = parseNumberedAnswers(keyText);
  if (key.size === 0) {
    errors.push(
      "Couldn't find any numbered answers in the answer key — questions will still be detected, but you'll need to pick each correct answer by hand in the review step.",
    );
  }

  const markers: { number: number; index: number; firstLineText: string }[] = [];
  blocks.forEach((b, i) => {
    if (b.isListItem) return; // a list item's text never starts a new question
    const m = b.text.match(QUESTION_MARKER_RE);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0 || n > 300) return;
    markers.push({ number: n, index: i, firstLineText: m[2].trim() });
  });

  if (markers.length === 0) {
    errors.push(
      "Couldn't find any numbered questions in this document. Make sure each question starts with a number, like \"1.\", on its own line.",
    );
    return { questions: [], errors, pageImages: {} };
  }

  const draft: DraftQuestion[] = [];
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1].index : blocks.length;
    const body = blocks.slice(marker.index + 1, end);

    let image = blocks[marker.index].image;
    const textLines: string[] = [];
    const optionBlocks: { letter: string; text: string }[] = [];
    let sawListRun = false;

    for (const blk of body) {
      if (!image && blk.image) image = blk.image;

      if (optionBlocks.length === 0 && !sawListRun) {
        const om = blk.text.match(OPTION_TEXT_RE);
        if (om && LETTER_ORDER.indexOf(om[1].toLowerCase()) === optionBlocks.length) {
          optionBlocks.push({ letter: om[1].toLowerCase(), text: om[2].trim() });
          continue;
        }
        if (blk.isListItem) {
          sawListRun = true;
          optionBlocks.push({
            letter: LETTER_ORDER[optionBlocks.length] ?? String(optionBlocks.length + 1),
            text: blk.text,
          });
          continue;
        }
        if (blk.text) textLines.push(blk.text);
        continue;
      }

      // Already inside an options run — a same-style continuation extends
      // it; anything else (a stray paragraph, a different list) ends it and
      // is ignored rather than risking a misdetected extra option.
      if (sawListRun && blk.isListItem) {
        optionBlocks.push({
          letter: LETTER_ORDER[optionBlocks.length] ?? String(optionBlocks.length + 1),
          text: blk.text,
        });
        continue;
      }
      if (!sawListRun) {
        const om = blk.text.match(OPTION_TEXT_RE);
        if (om && LETTER_ORDER.indexOf(om[1].toLowerCase()) === optionBlocks.length) {
          optionBlocks.push({ letter: om[1].toLowerCase(), text: om[2].trim() });
        }
      }
    }

    let options: string[];
    let letters: string[];
    let warning: string | undefined;
    if (optionBlocks.length >= 2) {
      options = optionBlocks.map((o) => o.text);
      letters = optionBlocks.map((o) => o.letter);
    } else {
      options = ["A", "B", "C", "D"];
      letters = options;
      warning =
        "Couldn't detect this question's answer options (looked for \"a) ...\" lines or a Word list) — add them by hand.";
    }

    const questionText =
      [marker.firstLineText, ...textLines].filter(Boolean).join(" ") ||
      `Question ${marker.number}`;

    let correct = 0;
    const keyAnswer = key.get(marker.number);
    if (!keyAnswer) {
      warning = warning ?? "No answer found in the key for this question — check it by hand.";
    } else {
      const designator = extractDesignator(keyAnswer);
      if (designator) {
        const idx = options.findIndex((_, oi) => designatorMatchesIndex(designator, oi, letters[oi]));
        if (idx >= 0) correct = idx;
        else
          warning = `Answer key says "${designator}", which doesn't match a detected option — check it by hand.`;
      } else {
        warning = `Couldn't read a clear letter from the answer key ("${keyAnswer}") — check it by hand.`;
      }
    }

    draft.push({
      draftId: `docx-${marker.number}-${i}`,
      number: marker.number,
      text: questionText,
      image,
      imageName: image ? `question-${marker.number}.png` : undefined,
      options,
      correct,
      warning,
      // No pageNum/cropBox: the image (if any) is already a standalone
      // embedded picture, not a region cropped from a rendered page.
    });
  }

  draft.sort((a, b) => a.number - b.number);
  return { questions: draft, errors, pageImages: {} };
}