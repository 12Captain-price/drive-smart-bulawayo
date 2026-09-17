// Word (.docx) support, alongside the existing PDF handling — for test
// papers, answer keys, and (via docxImport.ts) the "Import questions"
// auto-detector. Uses mammoth, a pure-JS docx reader that works client-side
// (no server round-trip, same as pdfjs for PDFs). Legacy .doc (the old
// binary format, pre-2007) is NOT supported — only modern .docx.
//
// mammoth is loaded with a dynamic import, same as pdfjs-dist elsewhere in
// this app (see pdfImport.ts/PdfPaper.tsx) — keeps it out of the
// server-rendered bundle and out of the initial page load for everyone who
// never touches a Word file.

/** True if a paper/answer-key file is a Word document, by data-URL prefix or filename/URL extension. */
export function isDocxFile(src: string | undefined, name: string | undefined): boolean {
  if (!src) return false;
  return (
    src.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
    /\.docx($|\?)/i.test(src) ||
    /\.docx$/i.test(name ?? "")
  );
}

/**
 * Reads a `data:` URL or a remote (e.g. Storage) URL into an ArrayBuffer,
 * which is what mammoth needs. Papers/keys are stored as Storage URLs once
 * uploaded, but can still be a fresh `data:` URL right after picking a file
 * and before it's been uploaded (e.g. in the import dialog).
 */
async function toArrayBuffer(src: string): Promise<ArrayBuffer> {
  if (src.startsWith("data:")) {
    const base64 = src.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not fetch the file (${res.status})`);
  return res.arrayBuffer();
}

/** Plain text out of a Word document — the docx equivalent of `extractPdfText`, for answer-key matching. */
export async function extractDocxText(src: string): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await toArrayBuffer(src);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Converts a Word document to HTML for inline display (used by
 * `WordPaper`). Embedded images come back as `<img src="data:...">` —
 * mammoth's default image handling — so nothing extra needs fetching.
 */
export async function docxToHtml(src: string): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await toArrayBuffer(src);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

export { toArrayBuffer as docxSrcToArrayBuffer };