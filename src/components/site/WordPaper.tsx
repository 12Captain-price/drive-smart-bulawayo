import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { docxToHtml } from "@/lib/docx";

/**
 * Renders a Word (.docx) test paper/answer key inline, converted to HTML
 * client-side with mammoth — the docx counterpart to `PdfPaper`. A Word
 * document doesn't have fixed "pages" the way a PDF does, so this renders
 * as one continuous scrolling document instead of a page-by-page canvas
 * stack, which is fine for the same reason PdfPaper avoids an iframe: it's
 * plain HTML, so it works identically on every device (including inside
 * WhatsApp/Facebook's in-app browsers) and never requires the student to
 * leave the page to view it.
 */
export function WordPaper({ src, className }: { src: string; className?: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setHtml("");

    (async () => {
      try {
        const converted = await docxToHtml(src);
        if (!cancelled) {
          setHtml(converted);
          setStatus("ready");
        }
      } catch (err) {
        console.error("Word document render failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className={className}>
      {status === "loading" && (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
          <Loader2 className="size-6 animate-spin" />
          Loading document…
        </div>
      )}
      {status === "error" && (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
          <AlertCircle className="text-accent size-6" />
          Couldn't load this document. Please tell your school.
        </div>
      )}
      {status === "ready" && (
        <div
          className={
            "h-full overflow-y-auto bg-white p-6 text-sm leading-relaxed text-black " +
            "[&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold " +
            "[&_p]:mb-3 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 " +
            "[&_li]:mb-1 [&_strong]:font-semibold [&_em]:italic " +
            "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse " +
            "[&_td]:border [&_td]:border-black/20 [&_td]:p-1.5 [&_th]:border [&_th]:border-black/20 [&_th]:p-1.5"
          }
          // Content comes from mammoth's docx→HTML conversion of a file the
          // school itself uploaded — not arbitrary third-party/user input —
          // same trust level as the PDF paper it sits alongside.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}