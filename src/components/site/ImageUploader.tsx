import { useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, errorMessage, fileToDataUrl } from "@/lib/data";
import { Progress } from "@/components/ui/progress";

export interface UploadedFile {
  dataUrl: string;
  name: string;
  type: string;
  /** The original File — use this with uploadPhotoToStorage() instead of
   *  dataUrl for anything that should live in Supabase Storage rather than
   *  as base64 in the database or localStorage. */
  file: File;
}

/**
 * Drag-and-drop + click-to-browse uploader. Reads each file, converts it to a
 * data URL and hands the batch to `onUpload`, which must persist it (through
 * the data layer) before we report success. Images are never resized or
 * re-compressed — the original bytes are kept.
 */
export function ImageUploader({
  onUpload,
  multiple = false,
  allowPdf = false,
  label = "Drag & drop, or click to browse",
  className,
}: {
  onUpload: (files: UploadedFile[]) => void | Promise<void>;
  multiple?: boolean;
  allowPdf?: boolean;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState("");

  const accepted = allowPdf ? [...ACCEPTED_IMAGE_TYPES, "application/pdf"] : ACCEPTED_IMAGE_TYPES;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, multiple ? undefined : 1);

    const valid: File[] = [];
    for (const file of files) {
      if (!accepted.includes(file.type)) {
        toast.error(`${file.name} rejected, use JPG, PNG${allowPdf ? ", WEBP or PDF" : " or WEBP"}`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is too large, max 2MB`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    setBusy(true);
    setProgress(0);
    const results: UploadedFile[] = [];
    try {
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        setCurrent(file.name);
        const dataUrl = await fileToDataUrl(file);
        results.push({ dataUrl, name: file.name, type: file.type, file });
        setProgress(Math.round(((i + 1) / valid.length) * 100));
      }
      await onUpload(results);
      toast.success(
        results.length > 1
          ? `${results.length} of ${valid.length} files uploaded`
          : `${results[0].name} uploaded`,
      );
    } catch (err) {
      toast.error(`Upload failed, ${errorMessage(err, "please try again")}`, { duration: Infinity });
    } finally {
      setBusy(false);
      setCurrent("");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        disabled={busy}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-secondary/60",
          busy && "opacity-70",
        )}
      >
        {busy ? (
          <Loader2 className="text-primary size-6 animate-spin" />
        ) : (
          <UploadCloud className="text-muted-foreground size-6" />
        )}
        <span className="text-sm font-medium">{busy ? `Uploading ${current}…` : label}</span>
        <span className="label-mono text-muted-foreground">
          {allowPdf ? "JPG · PNG · WEBP · PDF" : "JPG · PNG · WEBP"} · max 2MB
          {multiple ? " each" : ""}
        </span>
      </button>

      {busy && <Progress value={progress} className="mt-3 h-1.5" />}

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={accepted.join(",")}
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}