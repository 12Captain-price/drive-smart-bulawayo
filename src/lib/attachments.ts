// Multi-attachment support for student notes, plus a shared "what kind of
// file is this?" sniff used by every viewer (notes, tests, previews).
//
// Storage: the student_notes table only has single file_url / file_name
// columns, so a note with ONE attachment is stored exactly as before (a plain
// URL) and a note with SEVERAL is stored as a small JSON array inside
// file_url. Old notes keep working untouched, and no database change or
// get_my_notes_student edit is needed. If you'd rather have a proper
// `attachments jsonb` column later, only encode/decode below need to change.

export interface NoteAttachment {
  url: string;
  name: string;
}

export type AttachmentKind = "pdf" | "docx" | "xlsx" | "image";

export const MAX_NOTE_ATTACHMENTS = 10;

export const isXlsxFile = (src: string | undefined, name: string | undefined): boolean => {
  if (!src) return false;
  return (
    src.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
    /\.xlsx($|\?)/i.test(src) ||
    /\.xlsx$/i.test(name ?? "")
  );
};

const isPdf = (src: string, name: string) =>
  src.startsWith("data:application/pdf") || /\.pdf($|\?)/i.test(src) || /\.pdf$/i.test(name);

const isDocx = (src: string, name: string) =>
  src.startsWith("data:application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
  /\.docx($|\?)/i.test(src) ||
  /\.docx$/i.test(name);

export function attachmentKind(src: string, name?: string): AttachmentKind {
  const n = name ?? "";
  if (isPdf(src, n)) return "pdf";
  if (isDocx(src, n)) return "docx";
  if (isXlsxFile(src, n)) return "xlsx";
  return "image";
}

export const attachmentKindLabel = (k: AttachmentKind) =>
  k === "pdf" ? "PDF" : k === "docx" ? "Word doc" : k === "xlsx" ? "Spreadsheet" : "Photo";

/** Turns the raw file_url / file_name columns back into a list. */
export function decodeAttachments(
  fileUrl?: string | null,
  fileName?: string | null,
): NoteAttachment[] {
  if (!fileUrl) return [];
  const trimmed = fileUrl.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((a) => a && typeof a.url === "string" && a.url)
          .map((a, i) => ({
            url: a.url as string,
            name: (a.name as string) || `Attachment ${i + 1}`,
          }));
      }
    } catch {
      // Not JSON after all — fall through and treat it as a plain URL.
    }
  }
  return [{ url: fileUrl, name: fileName || "Attachment" }];
}

/** The file_url / file_name pair to store for a list of attachments. */
export function encodeAttachments(list: NoteAttachment[]): { fileUrl?: string; fileName?: string } {
  if (list.length === 0) return { fileUrl: undefined, fileName: undefined };
  if (list.length === 1) return { fileUrl: list[0].url, fileName: list[0].name };
  return {
    fileUrl: JSON.stringify(list.map((a) => ({ url: a.url, name: a.name }))),
    fileName: `${list[0].name} +${list.length - 1} more`,
  };
}