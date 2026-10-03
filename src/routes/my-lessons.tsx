import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  History,
  Image as ImageIcon,
  ListChecks,
  Lock,
  MessageCircle,
  NotebookText,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Section, SectionHeading } from "@/components/site/blocks";
import { NoteAttachments } from "@/components/site/AttachmentView";
import { ProtectedContent } from "@/components/site/ProtectedContent";
import { attachmentKind, attachmentKindLabel } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import {
  errorMessage,
  fetchMyLessonsAsInstructor,
  fetchMyLessonsAsStudent,
  fetchMyNotesAsInstructor,
  fetchMyNotesAsStudent,
  renderTemplate,
  useSettings,
  waLink,
  type MyLesson,
  type StudentNote,
} from "@/lib/data";

export const Route = createFileRoute("/my-lessons")({
  component: MyLessons,
  head: () => ({
    meta: [
      { title: "My Lessons | Auto Driving School" },
      {
        name: "description",
        content: "Students and instructors: check your upcoming Auto Driving School lessons.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtWeekdayShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

/** "Today" / "Tomorrow" / "In 4 days" for near-term dates, otherwise null so
 *  the caller falls back to the full date. */
function relativeLabel(iso: string): string | null {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  return null;
}

/** Builds a downloadable .ics file so a scheduled lesson can be dropped
 *  straight into the person's calendar app. */
function icsHref(lesson: MyLesson, otherParty: string) {
  const start = new Date(lesson.startsAt);
  const end = new Date(start.getTime() + lesson.minutes * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${lesson.id}@autodrivingschool`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${lesson.lessonType === "provisional" ? "Provisional" : "Driving"} lesson with ${otherParty}`,
    `DESCRIPTION:${lesson.minutes} minute lesson booked with Auto Driving School.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf8,${encodeURIComponent(lines)}`;
}

const STATUS_META: Record<
  MyLesson["status"],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  scheduled: {
    label: "Scheduled",
    icon: Clock,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  "no-show": {
    label: "No-show",
    icon: AlertCircle,
    className: "bg-warning/15 text-warning-foreground border-warning/30",
  },
};

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof CheckCircle2;
  value: number;
  label: string;
}) {
  return (
    <div className="border-border/60 bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-lg leading-none font-bold">{value}</p>
        <p className="text-muted-foreground mt-1 text-xs">{label}</p>
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  otherParty,
  rescheduleHref,
  awaitingUpdate,
}: {
  lesson: MyLesson;
  otherParty: string;
  /** Present only on the student view, for scheduled lessons. */
  rescheduleHref?: string;
  /** True when this lesson is still "Scheduled" but its time has already passed. */
  awaitingUpdate?: boolean;
}) {
  const meta = STATUS_META[lesson.status];
  const StatusIcon = meta.icon;
  const relative = relativeLabel(lesson.startsAt);
  const canAddToCalendar = lesson.status === "scheduled" && new Date(lesson.startsAt) > new Date();

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="bg-secondary flex size-14 shrink-0 flex-col items-center justify-center rounded-lg">
          <span className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
            {fmtWeekdayShort(lesson.startsAt)}
          </span>
          <span className="text-lg leading-none font-bold">
            {new Date(lesson.startsAt).getDate()}
          </span>
        </div>

        <div className="min-w-[10rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{fmtDay(lesson.startsAt)}</p>
            {relative && (
              <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                {relative}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {fmtTime(lesson.startsAt)} · {lesson.minutes} min ·{" "}
            {lesson.lessonType === "provisional" ? "Provisional" : "Driving"} lesson with{" "}
            {otherParty}
          </p>
          {awaitingUpdate && (
            <p className="text-warning-foreground bg-warning/10 mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>This lesson's time has passed. We'll confirm its status shortly.</span>
            </p>
          )}
          {lesson.notes && (
            <p className="text-muted-foreground bg-secondary/60 mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs">
              <NotebookText className="mt-0.5 size-3.5 shrink-0" />
              <span>{lesson.notes}</span>
            </p>
          )}
          {rescheduleHref && (
            <a
              href={rescheduleHref}
              target="_blank"
              rel="noreferrer"
              className="text-success mt-2 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
            >
              <MessageCircle className="size-3.5" /> Request a reschedule
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canAddToCalendar && (
            <Button asChild size="icon" variant="ghost" className="size-8" title="Add to calendar">
              <a href={icsHref(lesson, otherParty)} download={`lesson-${lesson.id}.ics`}>
                <CalendarPlus className="size-4" />
              </a>
            </Button>
          )}
          {lesson.status === "scheduled" && lesson.rescheduled && (
            <Badge
              variant="outline"
              className="text-accent-foreground border-accent/40 bg-accent/15 gap-1"
            >
              <History className="size-3" /> Rescheduled
            </Badge>
          )}
          {awaitingUpdate ? (
            <Badge
              variant="outline"
              className="text-warning-foreground border-warning/40 bg-warning/15 gap-1"
            >
              <AlertCircle className="size-3" /> Awaiting update
            </Badge>
          ) : (
            <Badge variant="outline" className={cn("gap-1", meta.className)}>
              <StatusIcon className="size-3" />
              {meta.label}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleView({
  greetingName,
  lessons,
  otherPartyLabel,
  onReset,
  resetLabel,
  role,
}: {
  greetingName: string;
  lessons: MyLesson[];
  otherPartyLabel: (l: MyLesson) => string;
  onReset: () => void;
  resetLabel: string;
  /** Students get a "Request a reschedule" WhatsApp link on upcoming lessons; instructors don't. */
  role: "student" | "instructor";
}) {
  const [showHistory, setShowHistory] = useState(false);
  const { settings } = useSettings();

  function rescheduleHref(l: MyLesson) {
    if (role !== "student" || l.status !== "scheduled") {
      return undefined;
    }
    const message = renderTemplate(settings.waRescheduleTemplate, {
      student: greetingName,
      date: fmtDay(l.startsAt),
      time: fmtTime(l.startsAt),
    });
    return waLink(settings.whatsapp, message);
  }

  if (lessons.length === 0) {
    return (
      <div className="mt-6 text-center">
        <div className="bg-secondary text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-full">
          <CalendarClock className="size-6" />
        </div>
        <p className="mt-4 text-lg font-medium">
          Hi {greetingName.split(" ")[0]}, nothing on the schedule yet
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Once a lesson is booked, it'll show up right here.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {role === "student" && (
            <Button asChild size="sm">
              <Link to="/contact">Book a lesson</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onReset}>
            {resetLabel}
          </Button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const lessonEnd = (l: MyLesson) => new Date(new Date(l.startsAt).getTime() + l.minutes * 60_000);
  const scheduled = lessons.filter((l) => l.status === "scheduled");
  const upcoming = scheduled
    .filter((l) => lessonEnd(l) > now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const awaitingUpdate = scheduled
    .filter((l) => lessonEnd(l) <= now)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const history = lessons
    .filter((l) => l.status !== "scheduled")
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  const completedCount = lessons.filter((l) => l.status === "completed").length;
  const missedCount = lessons.filter(
    (l) => l.status === "cancelled" || l.status === "no-show",
  ).length;
  const next = upcoming[0];

  return (
    <div className="mt-6">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex items-center gap-2 duration-500">
        <Sparkles className="text-accent size-4" />
        <p className="text-lg font-medium">Hi {greetingName.split(" ")[0]}, here's your schedule</p>
      </div>
      <p className="text-muted-foreground/70 mt-1 text-xs">
        This updates automatically, no need to refresh.
      </p>

      {/* Stats overview */}
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 mt-5 grid grid-cols-3 gap-3 duration-500 delay-100">
        <StatPill icon={CalendarClock} value={upcoming.length} label="Upcoming" />
        <StatPill icon={CheckCircle2} value={completedCount} label="Completed" />
        <StatPill icon={CalendarX2} value={missedCount} label="Cancelled / no-show" />
      </div>

      {/* Next lesson highlight */}
      {next && (
        <div className="from-primary/10 via-primary/5 to-background border-primary/20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 relative mt-6 overflow-hidden rounded-2xl border bg-gradient-to-br p-5 duration-500 delay-150">
          <Badge className="gap-1">
            <Sparkles className="size-3" /> Next lesson
          </Badge>
          <p className="mt-3 text-xl font-bold">
            {relativeLabel(next.startsAt) ?? fmtDay(next.startsAt)}{" "}
            <span className="text-muted-foreground font-normal">at {fmtTime(next.startsAt)}</span>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {next.minutes} min · {next.lessonType === "provisional" ? "Provisional" : "Driving"}{" "}
            lesson with {otherPartyLabel(next)}
          </p>
          <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5">
            <a href={icsHref(next, otherPartyLabel(next))} download={`lesson-${next.id}.ics`}>
              <CalendarPlus className="size-4" /> Add to calendar
            </a>
          </Button>
        </div>
      )}

      {/* Upcoming list */}
      {upcoming.length > 0 && (
        <div className="mt-8">
          <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
            <ListChecks className="size-3.5" /> Upcoming
          </h3>
          <div className="mt-3 space-y-3">
            {upcoming.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                otherParty={otherPartyLabel(l)}
                rescheduleHref={rescheduleHref(l)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lessons whose time has passed but haven't been marked complete/cancelled/no-show yet */}
      {awaitingUpdate.length > 0 && (
        <div className="mt-8">
          <h3 className="text-warning-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
            <AlertCircle className="size-3.5" /> Awaiting update
          </h3>
          <div className="mt-3 space-y-3">
            {awaitingUpdate.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                otherParty={otherPartyLabel(l)}
                rescheduleHref={rescheduleHref(l)}
                awaitingUpdate
              />
            ))}
          </div>
        </div>
      )}

      {/* Past lessons, tucked away behind a toggle so the page opens on what matters */}
      {history.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase transition-colors"
          >
            <ChevronRight
              className={cn("size-3.5 transition-transform", showHistory && "rotate-90")}
            />
            Past lessons ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3">
              {history.map((l) => (
                <LessonRow key={l.id} lesson={l} otherParty={otherPartyLabel(l)} />
              ))}
            </div>
          )}
        </div>
      )}

      <Button variant="ghost" size="sm" className="mt-8" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}

const NOTE_LESSON_TYPE_LABEL: Record<StudentNote["lessonType"], string> = {
  provisional: "Provisional lesson",
  driving: "Driving lesson",
  general: "General",
};

const NOTE_TYPE_ICON: Record<StudentNote["lessonType"], typeof GraduationCap> = {
  provisional: GraduationCap,
  driving: Car,
  general: NotebookText,
};

function fmtNoteDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "PDF" / "Word doc" / "Spreadsheet" / "Photo" (or "3 files") — shown on a note card that has attachments. */
function noteAttachmentLabel(n: StudentNote) {
  if (n.attachments.length > 1) return `${n.attachments.length} files`;
  return attachmentKindLabel(attachmentKind(n.attachments[0].url, n.attachments[0].name));
}

/**
 * A single note, styled like the "combo" package cards on /packages (dashed
 * accent border, soft gradient, a pill badge, a rounded gradient CTA) since
 * that's the look the school wanted to reuse here.
 */
function NoteCard({ note, onOpen }: { note: StudentNote; onOpen: () => void }) {
  const TypeIcon = NOTE_TYPE_ICON[note.lessonType];
  const hasFile = note.attachments.length > 0;
  const AttachIcon = !hasFile
    ? null
    : note.attachments.length === 1 &&
        attachmentKind(note.attachments[0].url, note.attachments[0].name) === "image"
      ? ImageIcon
      : FileText;

  return (
    <Card
      className={cn(
        "border-accent/50 from-accent/[0.08] via-primary/[0.04] relative flex h-full flex-col overflow-hidden rounded-3xl border-dashed bg-gradient-to-br to-transparent transition-[transform,box-shadow] duration-300 will-change-transform",
        "hover:-translate-y-1.5 hover:shadow-lg",
      )}
    >
      <span className="from-accent to-primary text-primary-foreground absolute top-5 left-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm">
        <TypeIcon size={10} /> {NOTE_LESSON_TYPE_LABEL[note.lessonType]}
      </span>
      {hasFile && AttachIcon && (
        <span className="label-mono bg-secondary absolute top-5 right-5 flex items-center gap-1 rounded-md px-2 py-1">
          <AttachIcon size={10} /> {noteAttachmentLabel(note)}
        </span>
      )}
      <CardContent className="flex flex-1 flex-col pt-14">
        <h3 className="text-lg font-semibold tracking-tight">{note.title || "(untitled note)"}</h3>
        <p className="text-muted-foreground mt-1 text-xs">{fmtNoteDate(note.createdAt)}</p>
        {note.body && (
          <p className="text-muted-foreground mt-3 line-clamp-3 text-sm">{note.body}</p>
        )}
        <ul className="mt-4 flex-1 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">✓</span> Read-only, no download
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">✓</span> Never expires, check back any time
          </li>
        </ul>
        <Button
          onClick={onOpen}
          className="from-accent to-primary text-primary-foreground mt-6 w-full rounded-full font-semibold bg-gradient-to-r hover:brightness-110"
        >
          View note
        </Button>
      </CardContent>
    </Card>
  );
}

/** Read-only notes staff have sent this student — no download, no expiry,
 *  the student can come back to these on every visit. */
function NotesGrid({
  notes,
  studentName,
  onReset,
  resetLabel = "Check a different student",
  emptyText = "Once your instructor sends you notes to revise, they'll show up here.",
}: {
  notes: StudentNote[];
  /** Name shown as the on-screen watermark (the signed-in person). */
  studentName: string;
  onReset: () => void;
  resetLabel?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState<StudentNote | null>(null);
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (sorted.length === 0) {
    return (
      <div className="text-center">
        <div className="bg-secondary text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-full">
          <NotebookText className="size-6" />
        </div>
        <p className="mt-4 text-lg font-medium">No notes yet</p>
        <p className="text-muted-foreground mt-1 text-sm">{emptyText}</p>
        <Button variant="ghost" size="sm" className="mt-5" onClick={onReset}>
          {resetLabel}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ProtectedContent watermark={studentName}>
        <div className="grid gap-5 sm:grid-cols-2">
          {sorted.map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => setOpen(n)} />
          ))}
        </div>
        <NoteViewer note={open} onOpenChange={(o) => !o && setOpen(null)} />
      </ProtectedContent>
      <Button variant="ghost" size="sm" className="mt-8" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}

/** Shows a note read-only — its typed text and/or any number of attached
 *  PDFs, Word docs, Excel sheets or photos. Everything renders inline
 *  (canvas / HTML / tables), so there's never an actual file the student
 *  could save; copy, right-click, drag, print and screenshot shortcuts are
 *  blocked (see ProtectedContent). It never expires, so the student can
 *  reopen it from this same list any time they log back in. */
function NoteViewer({
  note,
  onOpenChange,
}: {
  note: StudentNote | null;
  onOpenChange: (open: boolean) => void;
}) {
  const hasFile = (note?.attachments.length ?? 0) > 0;

  return (
    <Dialog open={!!note} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-3",
          hasFile ? "h-[85vh] w-[95vw] max-w-2xl" : "sm:max-w-lg",
        )}
      >
        {note && (
          <>
            <DialogHeader>
              <DialogTitle>{note.title || "(untitled note)"}</DialogTitle>
              <DialogDescription>
                {NOTE_LESSON_TYPE_LABEL[note.lessonType]} · {fmtNoteDate(note.createdAt)}
              </DialogDescription>
            </DialogHeader>

            {hasFile && (
              <NoteAttachments
                attachments={note.attachments}
                title={note.title}
                className="flex-1"
              />
            )}

            {note.body && (
              <div
                className={cn(
                  "overflow-y-auto rounded-lg border bg-secondary/40 p-4 text-sm whitespace-pre-line select-none",
                  hasFile ? "max-h-32 shrink-0" : "max-h-[60vh]",
                )}
                onCopy={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              >
                {note.body}
              </div>
            )}

            <p className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
              <Lock className="size-3.5 shrink-0" /> View-only — this note stays here for you to
              check back on any time, it doesn't expire.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
    >
      <ArrowLeft className="size-4" /> {label}
    </button>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof CalendarClock;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border/60 bg-card hover:border-primary/40 group relative flex flex-col items-start gap-3 overflow-hidden rounded-3xl border p-6 text-left transition-[transform,box-shadow] duration-300 will-change-transform hover:-translate-y-1.5 hover:shadow-lg"
    >
      <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-12 items-center justify-center rounded-2xl transition-colors">
        <Icon className="size-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <span className="text-primary mt-1 inline-flex items-center gap-1 text-sm font-medium">
        View <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

/**
 * What a student sees right after their name + last-4-of-phone lookup
 * succeeds: a choice between their lesson Schedule and their In-Class
 * Notes, rather than everything stacked on one long page. Both sub-views
 * share the same already-fetched data, so switching between them (or going
 * "back") never asks the student to look themselves up again.
 */
function StudentHome({
  greetingName,
  lessons,
  notes,
  onReset,
}: {
  greetingName: string;
  lessons: MyLesson[];
  notes: StudentNote[];
  onReset: () => void;
}) {
  const [view, setView] = useState<"choice" | "schedule" | "notes">("choice");
  const backToChoice = () => setView("choice");

  if (view === "schedule") {
    return (
      <div>
        <BackButton onClick={backToChoice} label="Back to your options" />
        <ScheduleView
          greetingName={greetingName}
          lessons={lessons}
          otherPartyLabel={(l) => l.instructorName ?? "an instructor"}
          onReset={onReset}
          resetLabel="Check a different student"
          role="student"
        />
      </div>
    );
  }

  if (view === "notes") {
    return (
      <div>
        <BackButton onClick={backToChoice} label="Back to your options" />
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
          <NotebookText className="size-3.5" /> In-Class Notes
        </h3>
        <div className="mt-4">
          <NotesGrid notes={notes} studentName={greetingName} onReset={onReset} />
        </div>
      </div>
    );
  }

  const upcomingCount = lessons.filter(
    (l) => l.status === "scheduled" && new Date(l.startsAt) > new Date(),
  ).length;

  return (
    <div>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex items-center gap-2 duration-500">
        <Sparkles className="text-accent size-4" />
        <p className="text-lg font-medium">
          Hi {greetingName.split(" ")[0]}, what would you like to check?
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          icon={CalendarClock}
          title="Schedule"
          description={
            upcomingCount > 0
              ? `${upcomingCount} upcoming lesson${upcomingCount === 1 ? "" : "s"}`
              : "See your lesson history"
          }
          onClick={() => setView("schedule")}
        />
        <ChoiceCard
          icon={NotebookText}
          title="In-Class Notes"
          description={
            notes.length > 0
              ? `${notes.length} note${notes.length === 1 ? "" : "s"} from your instructor`
              : "Nothing sent yet"
          }
          onClick={() => setView("notes")}
        />
      </div>
      <Button variant="ghost" size="sm" className="mt-8" onClick={onReset}>
        Check a different student
      </Button>
    </div>
  );
}

/** Silently re-runs `fetcher` every 30s (and immediately whenever the tab
 *  regains focus) so an admin update — a lesson marked completed, a note
 *  added, a reschedule confirmed — shows up here without the visitor
 *  re-entering their details. Failures are swallowed; the last good result
 *  just stays on screen until the next successful tick. */
function useLiveRefresh<T>(
  active: boolean,
  fetcher: () => Promise<T | null>,
  onUpdate: (r: T) => void,
) {
  const fetcherRef = useRef(fetcher);
  const onUpdateRef = useRef(onUpdate);
  fetcherRef.current = fetcher;
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    async function refresh() {
      try {
        const r = await fetcherRef.current();
        if (!cancelled && r) onUpdateRef.current(r);
      } catch {
        // silent — keep showing the last known data, next tick retries
      }
    }
    const id = setInterval(refresh, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);
}

function StudentLookup({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ studentName: string; lessons: MyLesson[] } | null>(null);
  const [notes, setNotes] = useState<StudentNote[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyLessonsAsStudent(name, phone);
      if (!r) {
        setError("Those details don't match. Check your name and phone number.");
        setResult(null);
      } else {
        setResult(r);
        // Best-effort — a hiccup fetching notes shouldn't block the schedule
        // from showing.
        fetchMyNotesAsStudent(name, phone)
          .then((n) => setNotes(n?.notes ?? []))
          .catch(() => {});
      }
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setLoading(false);
    }
  }

  useLiveRefresh(
    !!result,
    () => fetchMyLessonsAsStudent(name, phone),
    (r) => setResult(r),
  );
  useLiveRefresh(
    !!result,
    () => fetchMyNotesAsStudent(name, phone),
    (n) => setNotes(n?.notes ?? []),
  );

  if (result) {
    return (
      <StudentHome
        greetingName={result.studentName}
        lessons={result.lessons}
        notes={notes}
        onReset={() => {
          setResult(null);
          setNotes([]);
        }}
      />
    );
  }

  return (
    <div>
      <BackButton onClick={onBack} label="Choose a different role" />
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <SignInHeader
            icon={GraduationCap}
            tone="student"
            title="Student sign-in"
            subtitle="Use the name and phone number you enrolled with."
          />
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="student-name">Your full name</Label>
              <Input
                id="student-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-phone">Last 4 digits of your phone number</Label>
              <Input
                id="student-phone"
                inputMode="numeric"
                maxLength={4}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-destructive flex items-center gap-2 text-sm">
                <AlertCircle className="size-4 shrink-0" /> {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Checking…" : "View my lessons"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Small header shown above a sign-in form so each role's login looks like its own space. */
function SignInHeader({
  icon: Icon,
  tone,
  title,
  subtitle,
}: {
  icon: typeof GraduationCap;
  tone: "student" | "instructor";
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          tone === "student" ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground",
        )}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-base leading-tight font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/**
 * What an instructor sees after signing in — deliberately not the student
 * layout: a teaching-day dashboard (today's lessons up top, quick counts)
 * with their schedule and the notes the school has sent them one tap away.
 */
function InstructorHome({
  greetingName,
  lessons,
  notes,
  onReset,
}: {
  greetingName: string;
  lessons: MyLesson[];
  notes: StudentNote[];
  onReset: () => void;
}) {
  const [view, setView] = useState<"home" | "schedule" | "notes">("home");
  const backHome = () => setView("home");

  if (view === "schedule") {
    return (
      <div>
        <BackButton onClick={backHome} label="Back to your dashboard" />
        <ScheduleView
          greetingName={greetingName}
          lessons={lessons}
          otherPartyLabel={(l) => l.studentName ?? "a student"}
          onReset={onReset}
          resetLabel="Sign out"
          role="instructor"
        />
      </div>
    );
  }

  if (view === "notes") {
    return (
      <div>
        <BackButton onClick={backHome} label="Back to your dashboard" />
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
          <NotebookText className="size-3.5" /> Notes from the school
        </h3>
        <div className="mt-4">
          <NotesGrid
            notes={notes}
            studentName={greetingName}
            onReset={onReset}
            resetLabel="Sign out"
            emptyText="Notes the school sends to you will show up here. Only you can see them."
          />
        </div>
      </div>
    );
  }

  const now = new Date();
  const scheduled = lessons.filter((l) => l.status === "scheduled");
  const today = scheduled
    .filter((l) => new Date(l.startsAt).toDateString() === now.toDateString())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const next7 = scheduled.filter((l) => {
    const t = new Date(l.startsAt);
    return t >= now && t < weekEnd;
  }).length;
  const upcomingCount = scheduled.filter(
    (l) => new Date(new Date(l.startsAt).getTime() + l.minutes * 60_000) > now,
  ).length;

  return (
    <div>
      <div className="border-accent/40 from-accent/15 via-primary/5 relative overflow-hidden rounded-3xl border bg-gradient-to-br to-transparent p-5">
        <div className="flex items-center gap-4">
          <div className="bg-accent text-accent-foreground flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-sm">
            {initialsOf(greetingName)}
          </div>
          <div className="min-w-0">
            <p className="text-accent-foreground/80 text-[10px] font-bold tracking-wider uppercase">
              Instructor portal
            </p>
            <p className="truncate text-xl font-semibold">Welcome, {greetingName.split(" ")[0]}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatPill icon={Clock} value={today.length} label="Today" />
        <StatPill icon={CalendarCheck2} value={next7} label="Next 7 days" />
        <StatPill icon={NotebookText} value={notes.length} label="Notes" />
      </div>

      <h3 className="text-muted-foreground mt-7 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
        <CalendarClock className="size-3.5" /> Today
      </h3>
      {today.length === 0 ? (
        <p className="text-muted-foreground bg-secondary/50 mt-3 rounded-xl px-4 py-3 text-sm">
          No lessons today. Enjoy the breather.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {today.map((l) => (
            <li
              key={l.id}
              className="border-border/60 bg-card flex items-center gap-3 rounded-xl border px-4 py-3"
            >
              <span className="text-primary w-20 shrink-0 text-sm font-semibold">
                {fmtTime(l.startsAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {l.studentName ?? "A student"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {l.minutes} min · {l.lessonType === "provisional" ? "Provisional" : "Driving"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          icon={CalendarClock}
          title="My schedule"
          description={
            upcomingCount > 0
              ? `${upcomingCount} upcoming lesson${upcomingCount === 1 ? "" : "s"}`
              : "See your lesson history"
          }
          onClick={() => setView("schedule")}
        />
        <ChoiceCard
          icon={NotebookText}
          title="Notes"
          description={
            notes.length > 0
              ? `${notes.length} note${notes.length === 1 ? "" : "s"} from the school`
              : "Nothing sent yet"
          }
          onClick={() => setView("notes")}
        />
      </div>
      <Button variant="ghost" size="sm" className="mt-8" onClick={onReset}>
        Sign out
      </Button>
    </div>
  );
}

function InstructorLookup({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ instructorName: string; lessons: MyLesson[] } | null>(
    null,
  );
  const [notes, setNotes] = useState<StudentNote[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyLessonsAsInstructor(name, pin);
      if (!r) {
        setError(
          "Those details don't match. Check your name and PIN, or ask the school to reset your PIN.",
        );
        setResult(null);
      } else {
        setResult(r);
        // Best-effort — a hiccup fetching notes shouldn't block the schedule.
        fetchMyNotesAsInstructor(name, pin)
          .then((n) => setNotes(n?.notes ?? []))
          .catch(() => {});
      }
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setLoading(false);
    }
  }

  useLiveRefresh(
    !!result,
    () => fetchMyLessonsAsInstructor(name, pin),
    (r) => setResult(r),
  );
  useLiveRefresh(
    !!result,
    () => fetchMyNotesAsInstructor(name, pin),
    (n) => setNotes(n?.notes ?? []),
  );

  if (result) {
    return (
      <InstructorHome
        greetingName={result.instructorName}
        lessons={result.lessons}
        notes={notes}
        onReset={() => {
          setResult(null);
          setNotes([]);
        }}
      />
    );
  }

  return (
    <div>
      <BackButton onClick={onBack} label="Choose a different role" />
      <Card className="border-accent/40 border-t-accent border-t-4">
        <CardContent className="pt-6">
          <SignInHeader
            icon={Car}
            tone="instructor"
            title="Instructor sign-in"
            subtitle="Use your full name and the PIN the school gave you."
          />
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="instructor-name">Your full name</Label>
              <Input
                id="instructor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructor-pin">Your PIN</Label>
              <Input
                id="instructor-pin"
                type="password"
                autoComplete="off"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            {error && (
              <p className="text-destructive flex items-center gap-2 text-sm">
                <AlertCircle className="size-4 shrink-0" /> {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Checking…" : "Open my dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** One of the two big role cards on the My Lessons landing. */
function PortalCard({
  icon: Icon,
  title,
  description,
  tone,
  onClick,
}: {
  icon: typeof GraduationCap;
  title: string;
  description: string;
  tone: "student" | "instructor";
  onClick: () => void;
}) {
  const student = tone === "student";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bg-card group relative flex flex-col items-start gap-4 overflow-hidden rounded-3xl border p-6 text-left transition-[transform,box-shadow] duration-300 will-change-transform hover:-translate-y-1.5 hover:shadow-lg",
        student
          ? "border-border/60 hover:border-primary/40"
          : "border-accent/40 hover:border-accent",
      )}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl transition-colors",
          student
            ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
            : "bg-accent/20 text-accent-foreground group-hover:bg-accent",
        )}
      >
        <Icon className="size-7" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <span
        className={cn(
          "mt-auto inline-flex items-center gap-1 text-sm font-medium",
          student ? "text-primary" : "text-accent-foreground",
        )}
      >
        Continue{" "}
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function MyLessons() {
  const [who, setWho] = useState<"student" | "instructor" | null>(null);

  return (
    <Section className="max-w-xl">
      <SectionHeading
        eyebrow="Your schedule"
        title="My lessons"
        subtitle={
          who === null
            ? "Who's checking in? Pick one to continue, no account needed."
            : "Check your upcoming lessons, no account needed."
        }
      />
      <div className="mt-8">
        {who === null && (
          <div className="grid gap-4 sm:grid-cols-2">
            <PortalCard
              tone="student"
              icon={GraduationCap}
              title="I'm a student"
              description="Your lessons, schedule and in-class notes"
              onClick={() => setWho("student")}
            />
            <PortalCard
              tone="instructor"
              icon={Car}
              title="I'm an instructor"
              description="Your teaching day, schedule and notes from the school"
              onClick={() => setWho("instructor")}
            />
          </div>
        )}
        {who === "student" && <StudentLookup onBack={() => setWho(null)} />}
        {who === "instructor" && <InstructorLookup onBack={() => setWho(null)} />}
      </div>
      <p className="text-muted-foreground mt-10 flex items-start gap-2 text-xs">
        <CalendarCheck2 className="mt-0.5 size-3.5 shrink-0" />
        Your name and phone number are only used to match your record, this page never shows anyone
        else's lessons.
      </p>
    </Section>
  );
}