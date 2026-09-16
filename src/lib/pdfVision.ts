/**
 * Asks Claude (vision) where each question's diagram/photo sits on a
 * rendered page image, so pdfImport.ts can crop it precisely instead of
 * guessing from blank pixel rows. Runs server-side only — ANTHROPIC_API_KEY
 * never reaches the browser — and is called once per page (not per
 * question), so a typical paper costs a fraction of a cent to import.
 *
 * MOCK MODE: until ANTHROPIC_API_KEY is set in .env, this returns
 * { ok: false, reason: "no-api-key" } for every call. Callers must treat
 * that as "fall back to the pixel-based heuristic", never as an error that
 * blocks the import — importing still works end-to-end without a key, just
 * with the older best-effort cropping.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface DiagramBox {
  /** All four fractions of the *sent* page image, measured from the top-left corner. */
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DiagramDetection {
  number: number;
  hasDiagram: boolean;
  box?: DiagramBox;
}

export type DetectDiagramsResult =
  { ok: true; regions: DiagramDetection[] } | { ok: false; reason: string };

const inputSchema = z.object({
  /** data: URL of the rendered page (kept small — this is only for the vision call, not the final crop). */
  pageImageDataUrl: z.string(),
  /** Question numbers found on this page by the text-layer parser, as a hint so the model doesn't have to re-read them. */
  questionNumbers: z.array(z.number()),
});

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export const detectDiagramRegions = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<DetectDiagramsResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return { ok: false, reason: "no-api-key" };
    if (data.questionNumbers.length === 0) return { ok: true, regions: [] };

    const match = data.pageImageDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return { ok: false, reason: "bad-image-data" };
    const [, mediaType, base64] = match;

    const prompt = `This image is one page of a multiple-choice test paper. It contains these question numbers: ${data.questionNumbers.join(", ")}.

For each question number, find the diagram or photo that belongs to it — the illustration only. Never include the question's own printed text, and never include the "a) / b) / c)" style answer-option text, even if letters are drawn inside the diagram itself. Many questions have no diagram or photo at all — say so honestly rather than guessing a box.

Respond with ONLY a JSON array, no other text, no markdown code fences. One object per question number listed above, in exactly this shape:
[{"number": 1, "hasDiagram": true, "box": {"top": 0.12, "left": 0.5, "width": 0.35, "height": 0.18}}, {"number": 2, "hasDiagram": false}]

"box" fields are fractions of the full page image (0 to 1) measured from the top-left corner, and must tightly enclose only the diagram/photo — not the question text, not the options, not a neighbouring question's content. Omit "box" entirely when hasDiagram is false.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        return { ok: false, reason: `api-error-${response.status}` };
      }

      const json = (await response.json()) as { content?: { type: string; text?: string }[] };
      const text = (json.content ?? [])
        .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
        .join("")
        .trim();
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      const parsed: unknown = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) return { ok: false, reason: "unexpected-response-shape" };

      const regions: DiagramDetection[] = parsed
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .filter((r) => isFiniteNumber(r.number))
        .map((r) => {
          const box = r.box as Record<string, unknown> | undefined;
          const hasValidBox =
            !!r.hasDiagram &&
            !!box &&
            isFiniteNumber(box.top) &&
            isFiniteNumber(box.left) &&
            isFiniteNumber(box.width) &&
            isFiniteNumber(box.height);
          return {
            number: r.number as number,
            hasDiagram: !!r.hasDiagram,
            box: hasValidBox
              ? {
                  top: box!.top as number,
                  left: box!.left as number,
                  width: box!.width as number,
                  height: box!.height as number,
                }
              : undefined,
          };
        });

      return { ok: true, regions };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "unknown-error" };
    }
  });