import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Sheet as SheetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PdfPaper } from "@/components/site/PdfPaper";
import { WordPaper } from "@/components/site/WordPaper";
import { SheetPaper } from "@/components/site/SheetPaper";
import { ProtectedContent } from "@/components/site/ProtectedContent";
import { attachmentKind, attachmentKindLabel, type NoteAttachment } from "@/lib/attachments";

/** One file, rendered read-only inline (PDF / Word / Excel / photo). */
export function AttachmentView({
  src,
  name,
  alt,
  className,
  watermark,
}: {
  src: string;
  name?: string;
  alt?: string;
  className?: string;
  watermark?: string;
}) {
  const kind = attachmentKind(src, name);
  return (
    <ProtectedContent watermark={watermark} className="size-full">
      {kind === "pdf" ? (
        <PdfPaper src={src} className={cn("size-full", className)} />
      ) : kind === "docx" ? (
        <WordPaper src={src} className={cn("size-full", className)} />
      ) : kind === "xlsx" ? (
        <SheetPaper src={src} className={cn("size-full", className)} />
      ) : (
        <img
          src={src}
          alt={alt ?? name ?? "Attachment"}
          draggable={false}
          className={cn("pointer-events-none w-full object-contain", className)}
        />
      )}
    </ProtectedContent>
  );
}

const KIND_ICON = { pdf: FileText, docx: FileText, xlsx: SheetIcon, image: ImageIcon } as const;

/**
 * One or several attachments as a single read-only viewer. With more than one
 * file, a tab strip along the top switches between them.
 */
export function NoteAttachments({
  attachments,
  title,
  className,
  watermark,
}: {
  attachments: NoteAttachment[];
  title?: string;
  className?: string;
  watermark?: string;
}) {
  const [active, setActive] = useState(0);
  const key = attachments.map((a) => a.url).join("|");
  useEffect(() => setActive(0), [key]);

  if (attachments.length === 0) return null;
  const current = attachments[Math.min(active, attachments.length - 1)];

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {attachments.length > 1 && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-1">
          {attachments.map((a, i) => {
            const k = attachmentKind(a.url, a.name);
            const Icon = KIND_ICON[k];
            return (
              <button
                key={`${a.url}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                title={`${a.name} (${attachmentKindLabel(k)})`}
                className={cn(
                  "flex max-w-48 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  i === active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:border-primary/50 text-muted-foreground",
                )}
              >
                <Icon className="size-3 shrink-0" />
                <span className="truncate">{a.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="bg-secondary/30 min-h-0 flex-1 overflow-y-auto rounded-lg border">
        <AttachmentView
          key={current.url}
          src={current.url}
          name={current.name}
          alt={title}
          watermark={watermark}
        />
      </div>
    </div>
  );
}