import type { Question } from "@/lib/data";

/**
 * Builds a read-only "revision summary" PDF for one student's MCQ submission:
 * every question they missed (or skipped), the diagram/sign image for that
 * question if it has one, what they answered, and the correct answer.
 *
 * Runs entirely in the browser. jsPDF is loaded on demand so it doesn't add
 * weight to the rest of the admin bundle.
 */

export interface RevisionPdfInput {
  schoolName: string;
  testTitle: string;
  studentName: string;
  mark?: string;
  writtenOn: string;
  questions: Question[];
  answers: Record<string, number | undefined>;
}

/** Fetch an image URL and re-encode as JPEG so jsPDF can embed any format (png/webp/jpg). */
async function loadImage(src: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; // flatten transparency (signs/diagrams)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    return { data: canvas.toDataURL("image/jpeg", 0.85), w: bitmap.width, h: bitmap.height };
  } catch {
    return null;
  }
}

export function missedQuestions(q: Question[], answers: Record<string, number | undefined>) {
  return q
    .map((question, i) => ({ question, n: i + 1, given: answers[question.id] }))
    .filter((r) => r.given !== r.question.correct);
}

export async function buildRevisionPdf(input: RevisionPdfInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  // userPermissions without "modify"/"copy" = view and print only.
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    encryption: { userPermissions: ["print"] },
  });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 16;
  const CONTENT_W = PAGE_W - M * 2;
  const BOTTOM = PAGE_H - 18;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };

  const missed = missedQuestions(input.questions, input.answers);

  // ---- Header
  doc.setFillColor(22, 51, 94);
  doc.rect(0, 0, PAGE_W, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Revision Summary", M, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.schoolName, M, 22);
  doc.text(
    `${input.testTitle}  |  ${input.studentName}  |  Written ${input.writtenOn}`,
    M,
    28,
  );
  y = 44;

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  const total = input.questions.length;
  const summaryLine = input.mark
    ? `Result: ${input.mark}.  Questions to revise: ${missed.length} of ${total}.`
    : `Questions to revise: ${missed.length} of ${total}.`;
  doc.setFont("helvetica", "bold");
  doc.text(summaryLine, M, y);
  y += 8;

  if (missed.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text("You answered every question correctly. Well done!", M, y);
  }

  // ---- Questions
  for (const { question, n, given } of missed) {
    const qLines = doc.splitTextToSize(`${n}. ${question.text || "(no question text)"}`, CONTENT_W - 4);
    const givenText = given === undefined ? "Not answered" : (question.options[given] ?? "Not answered");
    const correctText = question.options[question.correct] ?? "";
    const gLines = doc.splitTextToSize(`Your answer: ${givenText}`, CONTENT_W - 10);
    const cLines = doc.splitTextToSize(`Correct answer: ${correctText}`, CONTENT_W - 10);

    const img = question.image ? await loadImage(question.image) : null;
    let imgW = 0;
    let imgH = 0;
    if (img) {
      const maxW = 100;
      const maxH = 70;
      const scale = Math.min(maxW / img.w, maxH / img.h);
      imgW = img.w * scale;
      imgH = img.h * scale;
    }

    const lineH = 5.2;
    const blockH =
      qLines.length * lineH + (img ? imgH + 4 : 0) + (gLines.length + cLines.length) * lineH + 12;
    ensure(blockH);

    // card background
    doc.setFillColor(246, 248, 251);
    doc.setDrawColor(222, 227, 235);
    doc.roundedRect(M, y - 4, CONTENT_W, blockH, 2, 2, "FD");

    let cy = y + 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(qLines, M + 3, cy);
    cy += qLines.length * lineH + 1;

    if (img) {
      doc.addImage(img.data, "JPEG", M + 3, cy, imgW, imgH);
      cy += imgH + 4;
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(185, 28, 28);
    doc.text(gLines, M + 6, cy);
    cy += gLines.length * lineH + 1;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 128, 61);
    doc.text(cLines, M + 6, cy);

    y += blockH + 4;
  }

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`${input.schoolName}  |  For ${input.studentName}'s revision only`, M, PAGE_H - 8);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
  }

  return doc.output("blob");
}