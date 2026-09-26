import { useMemo, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  NotebookPen,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isDocxFile } from "@/lib/docx";
import {
  errorMessage,
  isPdfFile,
  renderTemplate,
  uploadTestFileToStorage,
  useSettings,
  useStudents,
  useStudentNotes,
  waLink,
  type LessonType,
  type StudentNote,
} from "@/lib/data";

const LESSON_TYPE_OPTIONS: { value: LessonType | "general"; label: string }[] = [
  { value: "provisional", label: "Provisional lesson" },
  { value: "driving", label: "Driving lesson" },
  { value: "general", label: "General" },
];

const LESSON_TYPE_LABEL: Record<LessonType | "general", string> = {
  provisional: "Provisional lesson",
  driving: "Driving lesson",
  general: "General",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** Small "PDF" / "Word" / "Photo" pill for a note's attachment, if it has one. */
function AttachmentBadge({ note }: { note: StudentNote }) {
  if (!note.fileUrl) return null;
  const label = isPdfFile(note.fileUrl, note.fileName)
    ? "PDF"
    : isDocxFile(note.fileUrl, note.fileName)
      ? "Word doc"
      : "Photo";
  const Icon = label === "Photo" ? ImageIcon : FileText;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="size-3" /> {label}
    </Badge>
  );
}

/**
 * Lets staff send a durable, read-only note to a student — the "notes we
 * send after a provisional lesson", whether that's a PDF, a Word doc, a
 * photo, or just typed text (any combination of the three). Students read
 * these on the My Lessons page (name + last-4-of-phone, same lookup as
 * their lessons) with no download option and no expiry, so they can come
 * back to them whenever they need to revise.
 */
export function NotesPanel() {
  const { items: students } = useStudents();
  const { items: notes, add, update, remove } = useStudentNotes();
  const { settings } = useSettings();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StudentNote | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentNote | null>(null);

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown student";

  /** Builds the "Send to student" WhatsApp link for a note — same
   *  pattern as the Schedule tab's "Send to student" button: an editable
   *  template rendered with this note's details, opened as a wa.me link
   *  the moment staff click it (no extra confirm step). */
  function notifyHref(n: StudentNote) {
    const student = students.find((s) => s.id === n.studentId);
    if (!student?.phone) return undefined;
    const message = renderTemplate(settings.waNoteTemplate, {
      student: student.name,
      title: n.title || "a note",
      link: `${origin()}/my-lessons`,
    });
    return waLink(student.phone, message);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!q) return sorted;
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        studentName(n.studentId).toLowerCase().includes(q),
    );
  }, [notes, query, students]);

  const openNew = () => {
    setEditing(null);
    setComposerOpen(true);
  };
  const openEdit = (n: StudentNote) => {
    setEditing(n);
    setComposerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Notes</h1>
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">
            Send a student notes to revise — a PDF, a Word doc, a photo, or just typed text — after
            a provisional lesson or anytime. They see them read-only on the My Lessons page: no
            download, and no expiry, so they can check back whenever they need to.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          New note
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes or student name…"
          className="pl-9"
          aria-label="Search notes"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-14 text-center text-sm">
            <NotebookPen className="text-muted-foreground/60 size-8" />
            {notes.length === 0 ? "No notes sent yet." : "No notes match your search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((n) => {
            const waHref = notifyHref(n);
            return (
              <Card key={n.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{n.title || "(untitled note)"}</h3>
                    <Badge variant="secondary" className="font-normal">
                      {LESSON_TYPE_LABEL[n.lessonType]}
                    </Badge>
                    <AttachmentBadge note={n} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {studentName(n.studentId)} · {fmtDate(n.createdAt)}
                  </p>
                  {n.body && (
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-sm whitespace-pre-line">
                      {n.body}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {waHref ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={waHref} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" /> Notify on WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground font-normal">
                      No phone on file
                    </Badge>
                  )}
                  <Button variant="outline" size="icon" onClick={() => openEdit(n)} aria-label="Edit note">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setDeleteTarget(n)}
                    aria-label="Delete note"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <NoteComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        note={editing}
        students={students}
        onSave={(payload) => {
          if (editing) {
            update(editing.id, payload);
            toast.success("Note updated");
          } else {
            add({ ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            toast.success("Note sent — the student will see it on My Lessons");
          }
          setComposerOpen(false);
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  "{deleteTarget.title || "(untitled note)"}" for {studentName(deleteTarget.studentId)}{" "}
                  will no longer be visible to the student. This can't be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  remove(deleteTarget.id);
                  toast.success("Note deleted");
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type NotePayload = {
  studentId: string;
  lessonType: LessonType | "general";
  title: string;
  body: string;
  fileUrl?: string;
  fileName?: string;
};

function NoteComposer({
  open,
  onOpenChange,
  note,
  students,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: StudentNote | null;
  students: { id: string; name: string; phone: string }[];
  onSave: (payload: NotePayload) => void;
}) {
  const [studentId, setStudentId] = useState(note?.studentId ?? "");
  const [lessonType, setLessonType] = useState<LessonType | "general">(note?.lessonType ?? "provisional");
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [fileUrl, setFileUrl] = useState(note?.fileUrl ?? "");
  const [fileName, setFileName] = useState(note?.fileName ?? "");
  const [uploading, setUploading] = useState(false);

  // Re-seed the form whenever a different note is opened for editing (or the
  // dialog opens fresh for "New note") — Dialog keeps this component mounted
  // between opens, so state wouldn't otherwise reset on its own.
  const [seededFor, setSeededFor] = useState(note?.id ?? "new");
  const wantedKey = note?.id ?? "new";
  if (open && seededFor !== wantedKey) {
    setSeededFor(wantedKey);
    setStudentId(note?.studentId ?? "");
    setLessonType(note?.lessonType ?? "provisional");
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setFileUrl(note?.fileUrl ?? "");
    setFileName(note?.fileName ?? "");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTestFileToStorage(file);
      setFileUrl(url);
      setFileName(file.name);
    } catch (err) {
      toast.error(`Could not upload that file, ${errorMessage(err, "check your connection and try again.")}`, {
        duration: Infinity,
      });
    } finally {
      setUploading(false);
    }
  }

  const canSave = Boolean(studentId && title.trim() && (body.trim() || fileUrl) && !uploading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New note for a student"}</DialogTitle>
          <DialogDescription>
            They'll see this read-only on their My Lessons page — no download, and it stays there
            for them to revisit any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Student</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}, {s.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Relates to</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value as LessonType | "general")}
            >
              {LESSON_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Roundabouts & give-way rules"
            />
          </div>

          <div className="grid gap-2">
            <Label>Attach a file (PDF, Word doc, or photo) — optional</Label>
            {fileName ? (
              <div className="border-input bg-secondary/40 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Paperclip className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{fileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFileUrl("");
                    setFileName("");
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Remove attachment"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <Input
                type="file"
                accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            )}
            {uploading && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3 animate-spin" /> Uploading…
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note-body">{fileName ? "Add a note (optional)" : "Note"}</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={fileName ? 4 : 8}
              placeholder="Write what you'd like the student to revise…"
            />
          </div>

          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Shown read-only, no download button, never expires — the student just looks it up again
            from My Lessons whenever they want.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSave({
                studentId,
                lessonType,
                title: title.trim(),
                body: body.trim(),
                fileUrl: fileUrl || undefined,
                fileName: fileName || undefined,
              })
            }
          >
            <FileText className="size-4" />
            {note ? "Save changes" : "Send note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}