import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Screenshot / copy deterrent for anything sensitive (test papers, notes,
 * results).
 *
 * Be honest about what a website can do: a browser page can NOT switch off the
 * operating system's screenshot tool or a phone's screenshot button — only a
 * native app can do that. So this stacks every protection the web does allow:
 *
 *  - hides the content the instant the window loses focus or the tab is
 *    hidden (this is what happens when Windows Snipping Tool / Win+Shift+S,
 *    Mac Cmd+Shift+3/4/5, or app-switching starts),
 *  - hides it on PrintScreen / print / save shortcuts and wipes the clipboard,
 *  - blocks printing (@media print), right-click, copy, cut, drag and long-press
 *    "save image", and text selection,
 *  - draws a faint watermark with the student's name across the screen, so any
 *    photo of the screen (which nothing can prevent) is traceable.
 */
const ProtectedContext = createContext(false);

const block = (e: { preventDefault: () => void; target: EventTarget | null }) => {
  // Leave typing fields alone (students type their test answers).
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  e.preventDefault();
};

function useCaptureGuard() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flash = (ms = 1500) => {
      setHidden(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "visible" && document.hasFocus()) setHidden(false);
      }, ms);
    };
    const wipeClipboard = () => {
      try {
        void navigator.clipboard?.writeText(" ").catch(() => {});
      } catch {
        // ignore
      }
    };

    const onBlur = () => setHidden(true);
    const onFocus = () => {
      clearTimeout(timer);
      setHidden(false);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") setHidden(true);
      else if (document.hasFocus()) setHidden(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const code = e.code;
      const mod = e.ctrlKey || e.metaKey;
      const printScreen = k === "PrintScreen" || code === "PrintScreen";
      const macShot =
        e.metaKey && e.shiftKey && ["Digit3", "Digit4", "Digit5", "Digit6"].includes(code);
      const winSnip = e.metaKey && e.shiftKey && code === "KeyS";
      const printOrSave = mod && (code === "KeyP" || code === "KeyS");
      if (printScreen || macShot || winSnip || printOrSave) {
        if (e.type === "keydown") e.preventDefault();
        wipeClipboard();
        flash(printScreen ? 2500 : 1500);
      }
    };

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("beforeprint", onBlur);
    window.addEventListener("afterprint", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("beforeprint", onBlur);
      window.removeEventListener("afterprint", onFocus);
    };
  }, []);

  return hidden;
}

function watermarkImage(text: string) {
  const esc = text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const w = Math.max(240, text.length * 9 + 70);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='150'>` +
    `<text x='${w / 2}' y='75' transform='rotate(-24 ${w / 2} 75)' text-anchor='middle' ` +
    `font-family='sans-serif' font-size='14' font-weight='600' fill='rgba(128,128,128,0.2)'>${esc}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function Guarded({
  children,
  className,
  watermark,
}: {
  children: ReactNode;
  className?: string;
  watermark?: string;
}) {
  const hidden = useCaptureGuard();
  return (
    <ProtectedContext.Provider value={true}>
      <div
        data-protected
        className={cn("select-none [-webkit-touch-callout:none]", hidden && "invisible", className)}
        onContextMenu={block}
        onCopy={block}
        onCut={block}
        onDragStart={block}
      >
        {children}
      </div>
      {watermark && !hidden && (
        <div
          aria-hidden
          data-protected
          className="pointer-events-none fixed inset-0 z-[60]"
          style={{ backgroundImage: watermarkImage(watermark) }}
        />
      )}
      {hidden && (
        <div
          role="status"
          className="bg-background text-foreground fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <Lock className="size-8" />
          <p className="text-lg font-semibold">Content hidden</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            This material is view-only. Come back to this window to keep reading.
          </p>
        </div>
      )}
    </ProtectedContext.Provider>
  );
}

export function ProtectedContent({
  children,
  className,
  watermark,
}: {
  children: ReactNode;
  className?: string;
  /** Faint text tiled across the screen — usually the student's name. */
  watermark?: string;
}) {
  const nested = useContext(ProtectedContext);
  // Already inside a protected area: the outer one is guarding everything.
  if (nested) return <div className={className}>{children}</div>;
  return (
    <Guarded className={className} watermark={watermark}>
      {children}
    </Guarded>
  );
}