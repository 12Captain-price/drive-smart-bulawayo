import { useMemo, useState } from "react";
import {
  Eye,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  NotebookPen,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Sheet as SheetIcon,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { NoteAttachments } from "@/components/site/AttachmentView";
import {
  MAX_NOTE_ATTACHMENTS,
  attachmentKind,
  attachmentKindLabel,
  encodeAttachments,
  type NoteAttachment,
} from "@/lib/attachments";
import {
  errorMessage,
  renderTemplate,
  uploadTestFileToStorage,
  useInstructors,
  useSettings,
  useStudents,
  useStudentNotes,
  waLink,
  type LessonType,
  type StudentNote,
} from "@/lib/data";

const ACCEPT_FILES =
  "application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*";

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
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** Small "PDF" / "Word doc" / "Spreadsheet" / "Photo" pill (or "3 files") for a note's attachments. */
function AttachmentBadge({ note }: { note: StudentNote }) {
  const files = note.attachments;
  if (files.length === 0) return null;
  const kind = attachmentKind(files[0].url, files[0].name);
  const label = files.length > 1 ? `${files.length} files` : attachmentKindLabel(kind);
  const Icon =
    files.length === 1 && kind === "image"
      ? ImageIcon
      : kind === "xlsx" && files.length === 1
        ? SheetIcon
        : FileText;
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
  const { items: instructors } = useInstructors();
  const { items: notes, add, addMany, update, remove } = useStudentNotes();
  const { settings } = useSettings();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StudentNote | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentNote | null>(null);
  const [previewNote, setPreviewNote] = useState<StudentNote | null>(null);

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown student";

  /** Who a note was sent to — a student, or an instructor when it's an
   *  instructor-only note. */
  const isInstructorNote = (n: StudentNote) => Boolean(n.instructorId);
  const recipientName = (n: StudentNote) =>
    n.instructorId
      ? (instructors.find((i) => i.id === n.instructorId)?.name ?? "Unknown instructor")
      : studentName(n.studentId);

  /** Builds the "Notify on WhatsApp" link for a note — same pattern as the
   *  Schedule tab's send buttons: an editable template rendered with this
   *  note's details, opened as a wa.me link the moment staff click it (no
   *  extra confirm step). Goes to the student's or the instructor's phone
   *  depending on who the note is for. */
  function notifyHref(n: StudentNote) {
    const recipient = n.instructorId
      ? instructors.find((i) => i.id === n.instructorId)
      : students.find((s) => s.id === n.studentId);
    if (!recipient?.phone) return undefined;
    const message = renderTemplate(settings.waNoteTemplate, {
      student: recipient.name,
      title: n.title || "a note",
      link: `${origin()}/my-lessons`,
    });
    return waLink(recipient.phone, message);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!q) return sorted;
    const nameOf = (n: StudentNote) =>
      n.instructorId
        ? (instructors.find((i) => i.id === n.instructorId)?.name ?? "")
        : (students.find((s) => s.id === n.studentId)?.name ?? "");
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        nameOf(n).toLowerCase().includes(q),
    );
  }, [notes, query, students, instructors]);

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
            Send students notes to revise — PDFs, Word docs, Excel sheets, photos, or just typed
            text — after a provisional lesson or anytime. They see them read-only on the My Lessons
            page: no download, and no expiry. You can also send a note to instructors only; it
            appears just for them once they sign in on My Lessons.
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
                      {isInstructorNote(n) && (
                        <Badge
                          variant="outline"
                          className="border-accent/40 bg-accent/15 text-accent-foreground gap-1 font-normal"
                        >
                          <UserCheck className="size-3" /> Instructor only
                        </Badge>
                      )}
                      <AttachmentBadge note={n} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {recipientName(n)} · {fmtDate(n.createdAt)}
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
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPreviewNote(n)}
                      aria-label="Preview note as the recipient sees it"
                      title="Preview as the recipient sees it"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(n)}
                      aria-label="Edit note"
                    >
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
        instructors={instructors.map((i) => ({ id: i.id, name: i.name, phone: i.phone ?? "" }))}
        onSave={({ audience, recipientIds, ...payload }) => {
          const forInstructors = audience === "instructors";
          if (editing) {
            update(editing.id, {
              ...payload,
              studentId: forInstructors ? "" : recipientIds[0],
              instructorId: forInstructors ? recipientIds[0] : undefined,
            });
            toast.success("Note updated");
          } else {
            const now = new Date().toISOString();
            const list = recipientIds.map((id) => ({
              ...payload,
              studentId: forInstructors ? "" : id,
              instructorId: forInstructors ? id : undefined,
              createdAt: now,
              updatedAt: now,
            }));
            if (list.length === 1) add(list[0]);
            else addMany(list);
            const who = forInstructors ? "instructor" : "student";
            toast.success(
              list.length === 1
                ? `Note sent — the ${who} will see it on My Lessons`
                : `Note sent to ${list.length} ${who}s — they'll see it on My Lessons`,
            );
          }
          setComposerOpen(false);
        }}
      />

      <Dialog open={!!previewNote} onOpenChange={(o) => !o && setPreviewNote(null)}>
        <DialogContent
          className={cn(
            "flex flex-col gap-3",
            previewNote && previewNote.attachments.length > 0
              ? "h-[85vh] w-[95vw] max-w-2xl"
              : "sm:max-w-lg",
          )}
        >
          {previewNote && (
            <>
              <DialogHeader>
                <DialogTitle>{previewNote.title || "(untitled note)"}</DialogTitle>
                <DialogDescription>
                  Preview — this is what {recipientName(previewNote)} sees.
                </DialogDescription>
              </DialogHeader>
              <NoteAttachments
                attachments={previewNote.attachments}
                title={previewNote.title}
                watermark="Preview"
                className="flex-1"
              />
              {previewNote.body && (
                <div className="bg-secondary/40 max-h-40 shrink-0 overflow-y-auto rounded-lg border p-4 text-sm whitespace-pre-line">
                  {previewNote.body}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  "{deleteTarget.title || "(untitled note)"}" for {recipientName(deleteTarget)} will
                  no longer be visible to{" "}
                  {isInstructorNote(deleteTarget) ? "the instructor" : "the student"}. This can't be
                  undone.
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

type NoteAudience = "students" | "instructors";

type NotePayload = {
  audience: NoteAudience;
  /** One id when editing; one or more when sending a new note. Student ids
   *  or instructor ids depending on `audience`. */
  recipientIds: string[];
  lessonType: LessonType | "general";
  title: string;
  body: string;
  fileUrl?: string;
  fileName?: string;
  attachments: NoteAttachment[];
};

function NoteComposer({
  open,
  onOpenChange,
  note,
  students,
  instructors,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: StudentNote | null;
  students: { id: string; name: string; phone: string }[];
  instructors: { id: string; name: string; phone: string }[];
  onSave: (payload: NotePayload) => void;
}) {
  const noteAudience = (n: StudentNote | null): NoteAudience =>
    n?.instructorId ? "instructors" : "students";
  const noteRecipient = (n: StudentNote | null) => (n ? [n.instructorId || n.studentId] : []);
  const [audience, setAudience] = useState<NoteAudience>(noteAudience(note));
  const [recipientIds, setRecipientIds] = useState<string[]>(noteRecipient(note));
  const [studentQuery, setStudentQuery] = useState("");
  const [lessonType, setLessonType] = useState<LessonType | "general">(
    note?.lessonType ?? "provisional",
  );
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [attachments, setAttachments] = useState<NoteAttachment[]>(note?.attachments ?? []);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Re-seed the form whenever a different note is opened for editing (or the
  // dialog opens fresh for "New note") — Dialog keeps this component mounted
  // between opens, so state wouldn't otherwise reset on its own.
  const [seededFor, setSeededFor] = useState(note?.id ?? "new");
  const wantedKey = note?.id ?? "new";
  if (open && seededFor !== wantedKey) {
    setSeededFor(wantedKey);
    setAudience(noteAudience(note));
    setRecipientIds(noteRecipient(note));
    setStudentQuery("");
    setLessonType(note?.lessonType ?? "provisional");
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setAttachments(note?.attachments ?? []);
    setPreviewIdx(null);
  }

  const editing = Boolean(note);

  const forInstructors = audience === "instructors";
  const people = forInstructors ? instructors : students;
  const noun = forInstructors ? "instructor" : "student";

  const visibleStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (s) => s.name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q),
    );
  }, [people, studentQuery]);

  const switchAudience = (next: NoteAudience) => {
    if (next === audience) return;
    setAudience(next);
    setRecipientIds([]);
    setStudentQuery("");
  };

  const toggleStudent = (id: string, on: boolean) =>
    setRecipientIds((cur) =>
      on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id),
    );

  const allVisibleSelected =
    visibleStudents.length > 0 && visibleStudents.every((s) => recipientIds.includes(s.id));
  const toggleAllVisible = () =>
    setRecipientIds((cur) =>
      allVisibleSelected
        ? cur.filter((id) => !visibleStudents.some((s) => s.id === id))
        : [...cur, ...visibleStudents.map((s) => s.id).filter((id) => !cur.includes(id))],
    );

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setUploading(true);
    let room = MAX_NOTE_ATTACHMENTS - attachments.length;
    const added: NoteAttachment[] = [];
    try {
      for (const file of files) {
        if (room <= 0) {
          toast.error(`You can attach up to ${MAX_NOTE_ATTACHMENTS} files to one note.`);
          break;
        }
        const isImage = file.type.startsWith("image/");
        const isSupported =
          isImage || /\.(pdf|docx|xlsx)$/i.test(file.name) || file.type === "application/pdf";
        if (!isSupported) {
          toast.error(
            `"${file.name}" isn't supported. Use PDF, Word (.docx), Excel (.xlsx) or a photo.`,
          );
          continue;
        }
        try {
          const url = await uploadTestFileToStorage(file);
          added.push({ url, name: file.name });
          room -= 1;
        } catch (err) {
          toast.error(
            `Could not upload "${file.name}", ${errorMessage(err, "check your connection and try again.")}`,
            { duration: Infinity },
          );
        }
      }
    } finally {
      if (added.length) setAttachments((cur) => [...cur, ...added]);
      setUploading(false);
    }
  }

  const removeAttachment = (idx: number) => {
    setAttachments((cur) => cur.filter((_, i) => i !== idx));
    setPreviewIdx((p) => (p === null ? null : p === idx ? null : p > idx ? p - 1 : p));
  };

  const hasFiles = attachments.length > 0;
  const canSave = Boolean(
    recipientIds.length > 0 && title.trim() && (body.trim() || hasFiles) && !uploading,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {note
              ? "Edit note"
              : forInstructors
                ? "New note for instructors"
                : "New note for students"}
          </DialogTitle>
          <DialogDescription>
            {forInstructors
              ? "Only the instructor you pick can read this — they sign in on My Lessons with their name and the last 4 digits of their phone. Read-only, no download."
              : "They'll see this read-only on their My Lessons page — no download, and it stays there for them to revisit any time."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Send note to">
              {(
                [
                  { value: "students", label: "Students", icon: GraduationCap },
                  { value: "instructors", label: "Instructors only", icon: UserCheck },
                ] as const
              ).map((o) => {
                const active = audience === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => switchAudience(o.value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/5 text-primary ring-primary/20 ring-2"
                        : "border-input text-muted-foreground hover:bg-secondary/40",
                    )}
                  >
                    <o.icon className="size-4" /> {o.label}
                  </button>
                );
              })}
            </div>
          )}
          {editing ? (
            <div className="grid gap-2">
              <Label>{forInstructors ? "Instructor" : "Student"}</Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={recipientIds[0] ?? ""}
                onChange={(e) => setRecipientIds(e.target.value ? [e.target.value] : [])}
              >
                <option value="">Select {forInstructors ? "an instructor" : "a student"}…</option>
                {people.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}, {s.phone}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{forInstructors ? "Instructors" : "Students"}</Label>
                <span className="text-muted-foreground text-xs">
                  {recipientIds.length === 0 ? "None selected" : `${recipientIds.length} selected`}
                </span>
              </div>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                <Input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="h-9 pl-9"
                  aria-label={`Search ${noun}s`}
                />
              </div>
              <div className="border-input max-h-44 divide-y overflow-y-auto rounded-md border">
                {visibleStudents.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-center text-sm">No {noun}s match.</p>
                ) : (
                  <>
                    <label className="bg-secondary/40 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm font-medium">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={() => toggleAllVisible()}
                      />
                      {studentQuery.trim() ? "Select all matching" : "Select all"}
                    </label>
                    {visibleStudents.map((s) => (
                      <label
                        key={s.id}
                        className="hover:bg-secondary/40 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={recipientIds.includes(s.id)}
                          onCheckedChange={(v) => toggleStudent(s.id, v === true)}
                        />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">{s.phone}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
              {recipientIds.length > 1 && (
                <p className="text-muted-foreground text-xs">
                  Each {noun} gets their own copy of this note.
                </p>
              )}
            </div>
          )}

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
            <Label>Attach files (PDF, Word, Excel, or photos) — optional</Label>
            {hasFiles && (
              <ul className="space-y-1.5">
                {attachments.map((a, i) => (
                  <li
                    key={`${a.url}-${i}`}
                    className="border-input bg-secondary/40 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <Paperclip className="text-muted-foreground size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewIdx((p) => (p === i ? null : i))}
                      className={cn(
                        "hover:text-foreground flex shrink-0 items-center gap-1 text-xs font-medium",
                        previewIdx === i ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-label={`Preview ${a.name}`}
                    >
                      <Eye className="size-4" /> {previewIdx === i ? "Hide" : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label={`Remove ${a.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {previewIdx !== null && attachments[previewIdx] && (
              <div className="h-72">
                <NoteAttachments
                  attachments={[attachments[previewIdx]]}
                  watermark="Preview"
                  className="h-full"
                />
              </div>
            )}
            {attachments.length < MAX_NOTE_ATTACHMENTS && (
              <Input
                type="file"
                multiple
                accept={ACCEPT_FILES}
                disabled={uploading}
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            )}
            <p className="text-muted-foreground text-xs">
              {hasFiles
                ? "Pick more files to add to this note. "
                : "You can select several files at once. "}
              Up to {MAX_NOTE_ATTACHMENTS}.
            </p>
            {uploading && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3 animate-spin" /> Uploading…
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note-body">{hasFiles ? "Add a note (optional)" : "Note"}</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={hasFiles ? 4 : 8}
              placeholder={
                forInstructors
                  ? "Write what you'd like the instructor to know…"
                  : "Write what you'd like the student to revise…"
              }
            />
          </div>

          <p className="text-muted-foreground flex items-start gap-2 text-xs">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            {forInstructors
              ? "Shown read-only, no download button — visible only to the instructor(s) you pick, never to students."
              : "Shown read-only, no download button, never expires — the student just looks it up again from My Lessons whenever they want."}
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
                audience,
                recipientIds,
                lessonType,
                title: title.trim(),
                body: body.trim(),
                attachments,
                ...encodeAttachments(attachments),
              })
            }
          >
            <FileText className="size-4" />
            {note
              ? "Save changes"
              : recipientIds.length > 1
                ? `Send to ${recipientIds.length} ${noun}s`
                : "Send note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}