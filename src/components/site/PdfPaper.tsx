import { useEffect, useRef, useState } from "react";
// Static asset import — Vite bundles the worker file and gives us its final
// URL as a plain string. This does NOT execute the worker or touch the
// browser APIs at import time, so it's safe to import at module scope even
// though this component itself is client-only (see the dynamic import of
// "pdfjs-dist" below).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, Loader2 } from "lucide-react";

/**
 * Renders a PDF's pages as images drawn directly onto <canvas> elements,
 * scrolling inline in the page — instead of an <iframe src="...pdf">.
 *
 * Why: most mobile browsers (Android Chrome, and especially in-app browsers
 * like WhatsApp/Facebook's) have no built-in PDF renderer for iframes, so
 * the test paper would just show blank until the student tapped "Open in
 * new tab" or downloaded it. But this app auto-submits the test if a
 * student leaves the test screen/tab — so "open in new tab" isn't a real
 * option here. Rendering with pdfjs-dist (Mozilla's PDF engine, runs
 * entirely client-side) sidesteps both problems: it works identically on
 * every device, and the student never leaves the page.
 */
export function PdfPaper({ src, className }: { src: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const renderTasks: { cancel: () => void }[] = [];
    setStatus("loading");

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        const pdf = await pdfjsLib.getDocument({ url: src }).promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";
        // Fit each page to the container's width, at 2x for crisp
        // rendering on high-DPI phone screens.
        const targetWidth = (container.clientWidth || 600) * 2;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: targetWidth / unscaled.width });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.className = "border-b last:border-b-0";
          container.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          const task = page.render({ canvasContext: ctx, viewport, canvas });
          renderTasks.push(task);
          await task.promise;
        }

        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("PDF render failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTasks.forEach((t) => t.cancel());
    };
  }, [src]);

  return (
    <div className={className}>
      {status === "loading" && (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
          <Loader2 className="size-6 animate-spin" />
          Loading test paper…
        </div>
      )}
      {status === "error" && (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm">
          <AlertCircle className="text-accent size-6" />
          Couldn't load the test paper. Please tell your school.
        </div>
      )}
      <div ref={containerRef} className={status === "ready" ? "block" : "hidden"} />
    </div>
  );
}