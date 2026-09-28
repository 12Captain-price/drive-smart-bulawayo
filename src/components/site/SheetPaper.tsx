import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Cell = string | number | boolean | Date | null | undefined;
type SheetView = { sheet: string; data: Cell[][] };

const MAX_ROWS = 500;
const MAX_COLS = 30;

async function toArrayBuffer(src: string): Promise<ArrayBuffer> {
  if (src.startsWith("data:")) {
    const binary = atob(src.split(",")[1] ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not fetch the file (${res.status})`);
  return res.arrayBuffer();
}

const fmt = (v: Cell) =>
  v === null || v === undefined
    ? ""
    : v instanceof Date
      ? v.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
      : typeof v === "boolean"
        ? v
          ? "TRUE"
          : "FALSE"
        : String(v);

/**
 * Renders an Excel (.xlsx) file inline as read-only tables (one tab per
 * sheet) — the spreadsheet counterpart to PdfPaper / WordPaper. Values only:
 * formulas show their last calculated result, and there's nothing to save.
 */
export function SheetPaper({ src, className }: { src: string; className?: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [sheets, setSheets] = useState<SheetView[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setActive(0);
    (async () => {
      try {
        const { default: readXlsx } = await import("read-excel-file/universal");
        const result = await readXlsx(await toArrayBuffer(src));
        if (cancelled) return;
        setSheets(result.map((s) => ({ sheet: s.sheet, data: s.data as Cell[][] })));
        setStatus("ready");
      } catch (err) {
        console.error("Spreadsheet render failed:", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const current = sheets[active];
  const rows = (current?.data ?? []).slice(0, MAX_ROWS);
  const cols = Math.min(
    MAX_COLS,
    rows.reduce((m, r) => Math.max(m, r.length), 0),
  );

  return (
    <div className={className}>
      {status === "loading" && (
        <div className="text-muted-foreground flex h-full min-h-40 flex-col items-center justify-center gap-2 text-sm">
          <Loader2 className="size-6 animate-spin" />
          Loading spreadsheet…
        </div>
      )}
      {status === "error" && (
        <div className="text-muted-foreground flex h-full min-h-40 flex-col items-center justify-center gap-2 px-4 text-center text-sm">
          <AlertCircle className="text-accent size-6" />
          Couldn't load this spreadsheet. Only .xlsx files can be shown.
        </div>
      )}
      {status === "ready" && (
        <div className="flex h-full flex-col bg-white text-black">
          {sheets.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-black/5 px-2 pt-2">
              {sheets.map((s, i) => (
                <button
                  key={`${s.sheet}-${i}`}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "shrink-0 rounded-t-md border border-b-0 px-3 py-1 text-xs font-medium",
                    i === active ? "bg-white" : "bg-black/5 text-black/60 hover:text-black",
                  )}
                >
                  {s.sheet}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-black/60">This sheet is empty.</p>
            ) : (
              <table className="w-max min-w-full border-collapse text-xs">
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri} className={ri === 0 ? "bg-black/5 font-semibold" : undefined}>
                      {Array.from({ length: cols }, (_, ci) => (
                        <td
                          key={ci}
                          className="border border-black/15 px-2 py-1 whitespace-pre align-top"
                        >
                          {fmt(r[ci])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(current?.data.length ?? 0) > MAX_ROWS && (
              <p className="p-2 text-center text-xs text-black/50">
                Showing the first {MAX_ROWS} rows.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}