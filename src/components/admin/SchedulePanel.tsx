import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  MessageCircle,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChipGroup } from "@/components/site/ChipGroup";
import { downloadSpreadsheet, parseCsv } from "@/lib/docs";
import { printLessonsReport, type LessonReportRow } from "@/lib/receipts";
import {
  errorMessage,
  findLessonConflict,
  formatWeeklySchedule,
  renderTemplate,
  useInstructors,
  useLessons,
  usePackages,
  useSettings,
  useStudents,
  waLink,
  type Instructor,
  type Lesson,
  type LessonStatus,
  type LessonType,
  type Package,
  type SiteSettings,
  type Student,
} from "@/lib/data";
import { cn } from "@/lib/utils";

async function safe(fn: () => unknown, message: string) {
  try {
    await fn();
    toast.success(message);
  } catch (err) {
    toast.error(errorMessage(err, "Save failed"), { duration: Infinity });
  }
}

const LESSON_TYPES: { value: LessonType; label: string }[] = [
  { value: "provisional", label: "Provisional" },
  { value: "driving", label: "Driving" },
];

const LESSON_STATUSES: { value: LessonStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no-show", label: "No-show" },
];

const DURATION_PRESETS = [30, 45, 60, 90];

/* ------------------------------- date helpers ------------------------------ */

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtWeekRange(start: Date) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const e = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  );
  return `${s} – ${e}`;
}

/** yyyy-mm-dd + HH:mm (local) -> ISO string. */
function toIso(date: string, time: string) {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}`);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/* -------------------------------- schedule ---------------------------------- */

export function SchedulePanel({
  seedStudentId,
  onSeedConsumed,
}: {
  /** When set, opens the Add Lesson dialog prefilled for this student — used
   *  to jump straight from enrolling (or a confirmed payment) into
   *  scheduling their first lesson. */
  seedStudentId?: string | null;
  onSeedConsumed?: () => void;
} = {}) {
  const { items: lessons, add, addMany, update, remove } = useLessons();
  const { items: students } = useStudents();
  const { items: instructors } = useInstructors();
  const { items: packages } = usePackages();
  const { settings } = useSettings();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = addDays(weekStart, 7);

  const weekLessons = useMemo(
    () =>
      lessons
        .filter((l) => {
          const t = new Date(l.startsAt);
          return t >= weekStart && t < weekEnd;
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [lessons, weekStart, weekEnd],
  );

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown student";
  const instructorName = (id: string) => instructors.find((i) => i.id === id)?.name ?? "Unassigned";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <AddLessonDialog
          lessons={lessons}
          students={students}
          instructors={instructors}
          packages={packages}
          add={add}
          seedStudentId={seedStudentId}
          onSeedConsumed={onSeedConsumed}
        />
        <WeeklyScheduleDialog
          lessons={lessons}
          students={students}
          instructors={instructors}
          packages={packages}
          settings={settings}
          addMany={addMany}
        />
        <BulkImportLessons
          lessons={lessons}
          students={students}
          instructors={instructors}
          add={add}
        />
        <LessonRecordsDialog
          lessons={lessons}
          students={students}
          instructors={instructors}
          settings={settings}
        />
        <Button
          variant="outline"
          onClick={() =>
            safe(
              () =>
                downloadSpreadsheet(
                  "schedule",
                  weekLessons.map((l) => ({
                    Date: new Date(l.startsAt).toLocaleDateString(),
                    Time: fmtTime(l.startsAt),
                    Student: studentName(l.studentId),
                    Instructor: instructorName(l.instructorId),
                    Type: l.lessonType,
                    Minutes: l.minutes,
                    Status: l.status,
                    Notes: l.notes,
                  })),
                ),
              "Spreadsheet downloaded",
            )
          }
        >
          <Download className="size-4" /> Export week (Excel)
        </Button>
      </div>

      <div className="bg-secondary/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </Button>
        </div>
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="text-muted-foreground size-4" /> {fmtWeekRange(weekStart)}
        </span>
      </div>

      {instructors.length === 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <AlertCircle className="size-4" /> Add instructors on the Instructors tab first — you'll
          need to pick one for each lesson.
        </p>
      )}

      <div className="space-y-5">
        {days.map((day) => {
          const dayLessons = weekLessons.filter(
            (l) => new Date(l.startsAt).toDateString() === day.toDateString(),
          );
          return (
            <div key={day.toISOString()}>
              <p className="text-muted-foreground mb-2 text-sm font-semibold">{fmtDay(day)}</p>
              {dayLessons.length === 0 ? (
                <p className="text-muted-foreground/70 pl-1 text-xs">No lessons scheduled</p>
              ) : (
                <div className="space-y-2">
                  {dayLessons.map((l) => (
                    <LessonCard
                      key={l.id}
                      lesson={l}
                      lessons={lessons}
                      students={students}
                      instructors={instructors}
                      settings={settings}
                      update={update}
                      remove={remove}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- lesson records dialog --------------------------- */

const LESSON_RECORD_STATUS_FILTERS: { value: LessonStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...LESSON_STATUSES,
];

const STATUS_BADGE_CLASS: Record<LessonStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  "no-show": "bg-amber-100 text-amber-700 border-amber-200",
};

/**
 * Staff-facing view of every lesson ever scheduled — for one student or the
 * whole school — with the same records viewable on screen, or exported as a
 * spreadsheet or a printable PDF report.
 */
function LessonRecordsDialog({
  lessons,
  students,
  instructors,
  settings,
}: {
  lessons: Lesson[];
  students: Student[];
  instructors: Instructor[];
  settings: SiteSettings;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<LessonStatus | "all">("all");

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown student";
  const instructorName = (id: string) => instructors.find((i) => i.id === id)?.name ?? "Unassigned";
  const selectedStudent = students.find((s) => s.id === studentId);

  const filtered = useMemo(
    () =>
      lessons
        .filter((l) => (studentId ? l.studentId === studentId : true))
        .filter((l) => (statusFilter === "all" ? true : l.status === statusFilter))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [lessons, studentId, statusFilter],
  );

  const counts = useMemo(() => {
    const c = { scheduled: 0, completed: 0, cancelled: 0, "no-show": 0 } as Record<
      LessonStatus,
      number
    >;
    filtered.forEach((l) => c[l.status]++);
    return c;
  }, [filtered]);

  const scopeTitle = selectedStudent ? `Lesson Records — ${selectedStudent.name}` : "Lesson Records — All Students";
  const scopeSubtitle = `${filtered.length} lesson${filtered.length === 1 ? "" : "s"}${
    statusFilter === "all" ? "" : ` · ${LESSON_STATUSES.find((s) => s.value === statusFilter)?.label}`
  } · generated ${new Date().toLocaleDateString()}`;

  function reportRows(): LessonReportRow[] {
    return filtered.map((l) => ({
      date: new Date(l.startsAt).toLocaleDateString(),
      time: fmtTime(l.startsAt),
      student: studentName(l.studentId),
      instructor: instructorName(l.instructorId),
      type: l.lessonType,
      duration: `${l.minutes}m`,
      status: l.status,
      notes: l.notes,
    }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ListChecks className="size-4" /> Lesson records
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lesson records</DialogTitle>
          <DialogDescription>
            View every scheduled lesson for one student, or the whole school — then export the
            view as a spreadsheet or a printable PDF report.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-[200px] flex-1 gap-2">
            <Label>Student</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">All students</option>
              {sortedStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-[160px] gap-2">
            <Label>Status</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LessonStatus | "all")}
            >
              {LESSON_RECORD_STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="bg-secondary/50 rounded-lg border p-3">
            <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
              Total
            </p>
            <p className="text-xl font-extrabold">{filtered.length}</p>
          </div>
          {LESSON_STATUSES.map((s) => (
            <div key={s.value} className="bg-secondary/50 rounded-lg border p-3">
              <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
                {s.label}
              </p>
              <p className="text-xl font-extrabold">{counts[s.value]}</p>
            </div>
          ))}
        </div>

        <ScrollArea className="h-72 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                {!selectedStudent && <TableHead>Student</TableHead>}
                <TableHead>Instructor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={selectedStudent ? 6 : 7}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    No lessons match this view yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(l.startsAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtTime(l.startsAt)}</TableCell>
                    {!selectedStudent && (
                      <TableCell className="max-w-[160px] truncate">
                        {studentName(l.studentId)}
                      </TableCell>
                    )}
                    <TableCell className="max-w-[140px] truncate">
                      {instructorName(l.instructorId)}
                    </TableCell>
                    <TableCell className="capitalize">{l.lessonType}</TableCell>
                    <TableCell>{l.minutes}m</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-medium", STATUS_BADGE_CLASS[l.status])}>
                        {LESSON_STATUSES.find((s) => s.value === l.status)?.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Users className="size-3.5" />
            {selectedStudent ? selectedStudent.name : `All students (${sortedStudents.length})`}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={filtered.length === 0}
              onClick={() =>
                safe(
                  () =>
                    downloadSpreadsheet(
                      selectedStudent ? `lessons-${selectedStudent.name}` : "lessons-all-students",
                      reportRows().map((r) => ({
                        Date: r.date,
                        Time: r.time,
                        ...(selectedStudent ? {} : { Student: r.student }),
                        Instructor: r.instructor,
                        Type: r.type,
                        Duration: r.duration,
                        Status: r.status,
                        Notes: r.notes,
                      })),
                    ),
                  "Spreadsheet downloaded",
                )
              }
            >
              <FileSpreadsheet className="size-4" /> Export Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={filtered.length === 0}
              onClick={() =>
                safe(
                  () =>
                    printLessonsReport(
                      settings,
                      { title: scopeTitle, subtitle: scopeSubtitle },
                      reportRows(),
                      !selectedStudent,
                    ),
                  "PDF report opened",
                )
              }
            >
              <FileText className="size-4" /> Export PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- lesson card -------------------------------- */

function LessonCard({
  lesson: l,
  lessons,
  students,
  instructors,
  settings,
  update,
  remove,
}: {
  lesson: Lesson;
  lessons: Lesson[];
  students: Student[];
  instructors: Instructor[];
  settings: SiteSettings;
  update: (id: string, patch: Partial<Lesson>) => void;
  remove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const student = students.find((s) => s.id === l.studentId);
  const instructor = instructors.find((i) => i.id === l.instructorId);
  const endTime = new Date(new Date(l.startsAt).getTime() + l.minutes * 60_000);

  const lessonVars = {
    student: student?.name ?? "Unknown student",
    instructor: instructor?.name ?? "Unassigned",
    date: new Date(l.startsAt).toLocaleDateString(),
    time: fmtTime(l.startsAt),
    type: l.lessonType,
    link: typeof window === "undefined" ? "" : `${window.location.origin}/my-lessons`,
  };
  const instructorMessage = renderTemplate(settings.waInstructorLessonTemplate, lessonVars);
  const studentMessage = renderTemplate(settings.waStudentLessonTemplate, lessonVars);

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-3 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 flex-col items-center justify-center rounded-full text-[0.6rem] font-semibold leading-tight">
          <Clock className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {fmtTime(l.startsAt)} – {fmtTime(endTime.toISOString())} ·{" "}
            {student?.name ?? "Unknown student"}
          </span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>{instructor?.name ?? "Unassigned"}</span>
            <span aria-hidden>·</span>
            <Badge variant="outline" className="text-[0.65rem] font-medium capitalize">
              {l.lessonType}
            </Badge>
            <span aria-hidden>·</span>
            <span
              className={cn(
                "font-medium capitalize",
                l.status === "scheduled" && "text-primary",
                l.status === "completed" && "text-success",
                l.status === "cancelled" && "text-muted-foreground",
                l.status === "no-show" && "text-destructive",
              )}
            >
              {l.status.replace("-", " ")}
            </span>
          </span>
        </span>
        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t pt-5 pb-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={l.startsAt.slice(0, 10)}
              onChange={(e) => {
                const time = new Date(l.startsAt).toTimeString().slice(0, 5);
                const iso = toIso(e.target.value, time);
                if (!iso) return;
                const conflict = findLessonConflict(lessons, {
                  id: l.id,
                  instructorId: l.instructorId,
                  startsAt: iso,
                  minutes: l.minutes,
                });
                if (conflict) {
                  toast.error(
                    `${instructor?.name ?? "This instructor"} already has a lesson at that time.`,
                  );
                  return;
                }
                update(l.id, { startsAt: iso });
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={new Date(l.startsAt).toTimeString().slice(0, 5)}
              onChange={(e) => {
                const iso = toIso(l.startsAt.slice(0, 10), e.target.value);
                if (!iso) return;
                const conflict = findLessonConflict(lessons, {
                  id: l.id,
                  instructorId: l.instructorId,
                  startsAt: iso,
                  minutes: l.minutes,
                });
                if (conflict) {
                  toast.error(
                    `${instructor?.name ?? "This instructor"} already has a lesson at that time.`,
                  );
                  return;
                }
                update(l.id, { startsAt: iso });
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={l.minutes === m ? "default" : "outline"}
                  onClick={() => {
                    const conflict = findLessonConflict(lessons, {
                      id: l.id,
                      instructorId: l.instructorId,
                      startsAt: l.startsAt,
                      minutes: m,
                    });
                    if (conflict) {
                      toast.error(
                        `That would overlap ${instructor?.name ?? "this instructor"}'s next lesson.`,
                      );
                      return;
                    }
                    update(l.id, { minutes: m });
                  }}
                >
                  {m}m
                </Button>
              ))}
              <Input
                type="number"
                min={15}
                step={5}
                value={l.minutes}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  if (!m || m < 15) return;
                  update(l.id, { minutes: m });
                }}
                className="w-20"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <ChipGroup
              size="sm"
              value={l.lessonType}
              options={LESSON_TYPES}
              onChange={(v) => update(l.id, { lessonType: v })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Status</Label>
            <ChipGroup
              size="sm"
              value={l.status}
              options={LESSON_STATUSES}
              onChange={(v) => update(l.id, { status: v })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={l.notes}
              onChange={(e) => update(l.id, { notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {instructor?.phone && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={waLink(instructor.phone, instructorMessage)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> Send to instructor
                </a>
              </Button>
            )}
            {student?.phone && (
              <Button size="sm" variant="outline" asChild>
                <a href={waLink(student.phone, studentMessage)} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> Send to student
                </a>
              </Button>
            )}
          </div>
          <div className="sm:col-span-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" /> Delete lesson
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
                  <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove(l.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------------------ add lesson dialog ---------------------------- */

function AddLessonDialog({
  lessons,
  students,
  instructors,
  packages,
  add,
  seedStudentId,
  onSeedConsumed,
}: {
  lessons: Lesson[];
  students: Student[];
  instructors: Instructor[];
  packages: Package[];
  add: (item: Omit<Lesson, "id"> & { id?: string }) => unknown;
  seedStudentId?: string | null;
  onSeedConsumed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [lessonType, setLessonType] = useState<LessonType>("driving");
  const [lessonTypeTouched, setLessonTypeTouched] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [minutes, setMinutes] = useState(60);
  const [notes, setNotes] = useState("");

  function reset() {
    setStudentId("");
    setInstructorId("");
    setLessonType("driving");
    setLessonTypeTouched(false);
    setDate(new Date().toISOString().slice(0, 10));
    setTime("09:00");
    setMinutes(60);
    setNotes("");
  }

  // Jump straight into scheduling for a just-enrolled (or already-enrolled)
  // student, handed off from the Enroll dialog or a payment's "Schedule
  // lesson" button.
  useEffect(() => {
    if (!seedStudentId) return;
    pickStudent(seedStudentId);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedStudentId]);

  function pickStudent(id: string) {
    setStudentId(id);
    // Default the lesson type from the student's package, if that package is
    // locked to one type — but don't clobber it if staff already changed it
    // by hand for this booking.
    if (!lessonTypeTouched) {
      const student = students.find((s) => s.id === id);
      const pkg = packages.find((p) => p.id === student?.packageId);
      if (pkg?.lessonType) setLessonType(pkg.lessonType);
    }
  }

  function submit() {
    if (!studentId) return toast.error("Choose a student");
    if (!instructorId) return toast.error("Choose an instructor");
    const startsAt = toIso(date, time);
    if (!startsAt) return toast.error("Pick a valid date and time");

    const conflict = findLessonConflict(lessons, { instructorId, startsAt, minutes });
    if (conflict) {
      const other = students.find((s) => s.id === conflict.studentId)?.name ?? "another student";
      toast.error(`That instructor already has a lesson with ${other} at that time.`);
      return;
    }

    add({
      studentId,
      instructorId,
      lessonType,
      startsAt,
      minutes,
      notes,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    });
    toast.success("Lesson scheduled");
    closeDialog();
  }

  function closeDialog() {
    setOpen(false);
    reset();
    if (seedStudentId) onSeedConsumed?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add lesson
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule a lesson</DialogTitle>
          <DialogDescription>
            Pick a student, instructor, and time. Overlapping lessons for the same instructor are
            blocked automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Student</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={studentId}
              onChange={(e) => pickStudent(e.target.value)}
            >
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.phone}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Instructor</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
            >
              <option value="">Select an instructor…</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <ChipGroup
              size="sm"
              value={lessonType}
              options={LESSON_TYPES}
              onChange={(v) => {
                setLessonType(v);
                setLessonTypeTouched(true);
              }}
            />
            {!lessonTypeTouched &&
              packages.find((p) => p.id === students.find((s) => s.id === studentId)?.packageId)
                ?.lessonType && (
                <p className="text-muted-foreground text-xs">
                  Set from this student's package — change it above if this booking is different.
                </p>
              )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={minutes === m ? "default" : "outline"}
                  onClick={() => setMinutes(m)}
                >
                  {m}m
                </Button>
              ))}
              <Input
                type="number"
                min={15}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 60)}
                className="w-20"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>
            <Plus className="size-4" /> Schedule lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- weekly schedule dialog -------------------------- */

const WEEK_DAYS = [
  { label: "Monday", short: "Mon" },
  { label: "Tuesday", short: "Tue" },
  { label: "Wednesday", short: "Wed" },
  { label: "Thursday", short: "Thu" },
  { label: "Friday", short: "Fri" },
  { label: "Saturday", short: "Sat" },
  { label: "Sunday", short: "Sun" },
];

type DaySelection = { enabled: boolean; time: string };

/** Schedule a whole week of lessons for one student at once, then forward
 *  the resulting plan to both the student and the instructor on WhatsApp in
 *  a single message each — instead of adding and messaging one lesson at a
 *  time. */
function WeeklyScheduleDialog({
  lessons,
  students,
  instructors,
  packages,
  settings,
  addMany,
}: {
  lessons: Lesson[];
  students: Student[];
  instructors: Instructor[];
  packages: Package[];
  settings: SiteSettings;
  addMany: (items: (Omit<Lesson, "id"> & { id?: string })[]) => Lesson[];
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [lessonType, setLessonType] = useState<LessonType>("driving");
  const [minutes, setMinutes] = useState(60);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<Record<string, DaySelection>>(() =>
    Object.fromEntries(WEEK_DAYS.map((d) => [d.short, { enabled: false, time: "09:00" }])),
  );
  const [result, setResult] = useState<{ created: Lesson[]; student: Student; instructor: Instructor } | null>(
    null,
  );

  function reset() {
    setStudentId("");
    setInstructorId("");
    setLessonType("driving");
    setMinutes(60);
    setWeekStart(startOfWeek(new Date()).toISOString().slice(0, 10));
    setNotes("");
    setDays(Object.fromEntries(WEEK_DAYS.map((d) => [d.short, { enabled: false, time: "09:00" }])));
    setResult(null);
  }

  function toggleDay(short: string) {
    setDays((prev) => ({ ...prev, [short]: { ...prev[short], enabled: !prev[short].enabled } }));
  }

  function setDayTime(short: string, time: string) {
    setDays((prev) => ({ ...prev, [short]: { ...prev[short], time } }));
  }

  function submit() {
    if (!studentId) return toast.error("Choose a student");
    if (!instructorId) return toast.error("Choose an instructor");
    const selected = WEEK_DAYS.map((d, i) => ({ ...d, index: i, ...days[d.short] })).filter(
      (d) => d.enabled,
    );
    if (selected.length === 0) return toast.error("Pick at least one day");

    const base = new Date(`${weekStart}T00:00`);
    if (isNaN(base.getTime())) return toast.error("Pick a valid week start date");

    const candidates: (Omit<Lesson, "id"> & { id?: string })[] = [];
    const staged: Lesson[] = [];
    const createdAt = new Date().toISOString();

    for (const d of selected) {
      const date = addDays(base, d.index);
      const startsAt = toIso(date.toISOString().slice(0, 10), d.time);
      if (!startsAt) return toast.error(`Invalid time for ${d.label}`);

      const conflict = findLessonConflict([...lessons, ...staged], {
        instructorId,
        startsAt,
        minutes,
      });
      if (conflict) {
        const other = students.find((s) => s.id === conflict.studentId)?.name ?? "another student";
        toast.error(`${d.label} ${d.time} clashes with ${other}'s lesson — adjust and try again.`);
        return;
      }

      const lesson: Omit<Lesson, "id"> & { id?: string } = {
        studentId,
        instructorId,
        lessonType,
        startsAt,
        minutes,
        notes,
        status: "scheduled",
        createdAt,
      };
      candidates.push(lesson);
      staged.push({ ...lesson, id: `staged-${staged.length}` });
    }

    const created = addMany(candidates);
    const student = students.find((s) => s.id === studentId)!;
    const instructor = instructors.find((i) => i.id === instructorId)!;
    setResult({ created, student, instructor });
    toast.success(`${created.length} lesson${created.length === 1 ? "" : "s"} scheduled`);
  }

  function closeDialog() {
    setOpen(false);
    reset();
  }

  const link = typeof window === "undefined" ? "" : `${window.location.origin}/my-lessons`;
  const schedule = result ? formatWeeklySchedule(result.created) : "";
  const studentMessage = result
    ? renderTemplate(settings.waWeeklyPlanTemplate, {
        recipient: result.student.name,
        student: result.student.name,
        instructor: result.instructor.name,
        schedule,
        link,
      })
    : "";
  const instructorMessage = result
    ? renderTemplate(settings.waWeeklyPlanTemplate, {
        recipient: result.instructor.name,
        student: result.student.name,
        instructor: result.instructor.name,
        schedule,
        link,
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarRange className="size-4" /> Schedule week
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Schedule a week of lessons</DialogTitle>
              <DialogDescription>
                Pick a student, instructor, and one or more days — all lessons are created at once,
                then you can forward the plan to both of them on WhatsApp.
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
                      {s.name} — {s.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Instructor</Label>
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                >
                  <option value="">Select an instructor…</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Week starting (Monday)</Label>
                  <Input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <ChipGroup
                    size="sm"
                    value={lessonType}
                    options={LESSON_TYPES}
                    onChange={setLessonType}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Duration</Label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={minutes === m ? "default" : "outline"}
                      onClick={() => setMinutes(m)}
                    >
                      {m}m
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Days &amp; times</Label>
                <div className="space-y-2">
                  {WEEK_DAYS.map((d) => (
                    <div key={d.short} className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={days[d.short].enabled ? "default" : "outline"}
                        className="w-28 shrink-0"
                        onClick={() => toggleDay(d.short)}
                      >
                        {d.label}
                      </Button>
                      <Input
                        type="time"
                        value={days[d.short].time}
                        disabled={!days[d.short].enabled}
                        onChange={(e) => setDayTime(d.short, e.target.value)}
                        className="w-32"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notes (optional, applied to every lesson)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>
                <CalendarRange className="size-4" /> Schedule week
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-5" /> Week scheduled for{" "}
                {result.student.name}
              </DialogTitle>
              <DialogDescription>
                {result.created.length} lesson{result.created.length === 1 ? "" : "s"} with{" "}
                {result.instructor.name}. Forward the plan below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-secondary/60 rounded-lg border p-3">
                <p className="label-mono text-muted-foreground mb-2">Schedule</p>
                <pre className="text-xs whitespace-pre-wrap">{schedule}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.student.phone && (
                  <Button
                    size="sm"
                    className="bg-success text-success-foreground hover:bg-success/90"
                    asChild
                  >
                    <a href={waLink(result.student.phone, studentMessage)} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" /> Send to student
                    </a>
                  </Button>
                )}
                {result.instructor.phone && (
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={waLink(result.instructor.phone, instructorMessage)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="size-4" /> Send to instructor
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={closeDialog}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ bulk import lessons -------------------------- */

type ParsedLessonRow = {
  studentId: string;
  studentInput: string;
  instructorId: string;
  instructorInput: string;
  lessonType: LessonType;
  startsAt: string;
  minutes: number;
  notes: string;
  problem?: string;
};

function parseLessonCsvRows(
  rows: Record<string, string>[],
  students: Student[],
  instructors: Instructor[],
): ParsedLessonRow[] {
  const get = (r: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(r).find((h) => h.toLowerCase().trim() === k);
      if (hit && r[hit]) return r[hit];
    }
    return "";
  };

  return rows.map((r) => {
    const studentInput = get(r, "student", "student name", "name");
    const instructorInput = get(r, "instructor", "instructor name");
    const dateInput = get(r, "date");
    const timeInput = get(r, "time", "start time");
    const durationInput = get(r, "minutes", "duration", "duration (mins)");
    const typeInput = get(r, "type", "lesson type").toLowerCase();
    const notes = get(r, "notes");

    const student = studentInput
      ? students.find((s) => s.name.toLowerCase() === studentInput.toLowerCase())
      : undefined;
    const instructor = instructorInput
      ? instructors.find((i) => i.name.toLowerCase() === instructorInput.toLowerCase())
      : undefined;

    const startsAt = toIso(dateInput, timeInput || "09:00");
    const minutes = Number(durationInput) || 60;

    let problem: string | undefined;
    if (!studentInput) problem = "Missing student";
    else if (!student) problem = `Unknown student "${studentInput}"`;
    else if (!instructorInput) problem = "Missing instructor";
    else if (!instructor) problem = `Unknown instructor "${instructorInput}"`;
    else if (!startsAt) problem = "Missing or invalid date/time";

    return {
      studentId: student?.id ?? "",
      studentInput,
      instructorId: instructor?.id ?? "",
      instructorInput,
      lessonType: typeInput.startsWith("prov") ? "provisional" : "driving",
      startsAt,
      minutes,
      notes,
      problem,
    };
  });
}

function BulkImportLessons({
  lessons,
  students,
  instructors,
  add,
}: {
  lessons: Lesson[];
  students: Student[];
  instructors: Instructor[];
  add: (item: Omit<Lesson, "id"> & { id?: string }) => unknown;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedLessonRow[]>([]);
  const [fileName, setFileName] = useState("");

  // Flag conflicts (with existing lessons, and between rows in the same
  // file) up front so staff see them before importing, not one at a time
  // via the toast rollback on each insert.
  const checked = useMemo(() => {
    const staged: Lesson[] = [];
    return rows.map((r) => {
      if (r.problem) return r;
      const conflict = findLessonConflict([...lessons, ...staged], {
        instructorId: r.instructorId,
        startsAt: r.startsAt,
        minutes: r.minutes,
      });
      if (conflict) return { ...r, problem: `Overlaps another lesson for ${r.instructorInput}` };
      staged.push({
        id: `staged-${staged.length}`,
        studentId: r.studentId,
        instructorId: r.instructorId,
        lessonType: r.lessonType,
        startsAt: r.startsAt,
        minutes: r.minutes,
        notes: r.notes,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      });
      return r;
    });
  }, [rows, lessons]);

  const valid = checked.filter((r) => !r.problem);
  const invalid = checked.filter((r) => r.problem);

  function reset() {
    setRows([]);
    setFileName("");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error("That file has no rows we could read.");
        return;
      }
      setRows(parseLessonCsvRows(parsed, students, instructors));
    } catch {
      toast.error("Could not read that file — make sure it's a CSV.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" /> Bulk import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import schedule</DialogTitle>
          <DialogDescription>
            Upload the school's existing Excel schedule as a CSV — one row per lesson — instead of
            re-entering it by hand. Student and instructor names must match what's already in the
            app exactly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-secondary/50 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Not sure of the format?</p>
              <p className="text-muted-foreground text-xs">
                Download a template with the right column headers, already filled with an example
                row.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                downloadSpreadsheet("schedule-import-template", [
                  {
                    Student: students[0]?.name ?? "Tafara Moyo",
                    Instructor: instructors[0]?.name ?? "Mr. Dube",
                    Date: new Date().toISOString().slice(0, 10),
                    Time: "09:00",
                    Minutes: 60,
                    Type: "driving",
                    Notes: "",
                  },
                ])
              }
            >
              <Download className="size-4" /> Download template
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>CSV file</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {fileName && <p className="text-muted-foreground text-xs">Reading: {fileName}</p>}
          </div>

          {checked.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-success font-semibold">{valid.length} ready to import</span>
                {invalid.length > 0 && (
                  <span className="text-destructive">
                    {" "}
                    · {invalid.length} row{invalid.length === 1 ? "" : "s"} need fixing
                  </span>
                )}
              </p>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Student</th>
                      <th className="p-2 text-left">Instructor</th>
                      <th className="p-2 text-left">When</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checked.map((r, i) => (
                      <tr key={i} className={cn("border-t", r.problem && "bg-destructive/5")}>
                        <td className="p-2">{r.studentInput || "—"}</td>
                        <td className="p-2">{r.instructorInput || "—"}</td>
                        <td className="p-2">
                          {r.startsAt
                            ? `${new Date(r.startsAt).toLocaleDateString()} ${fmtTime(r.startsAt)}`
                            : "—"}
                        </td>
                        <td className="p-2">
                          {r.problem ? (
                            <span className="text-destructive">{r.problem}</span>
                          ) : (
                            <span className="text-success">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={valid.length === 0}
            onClick={() =>
              safe(
                async () => {
                  for (const r of valid) {
                    add({
                      studentId: r.studentId,
                      instructorId: r.instructorId,
                      lessonType: r.lessonType,
                      startsAt: r.startsAt,
                      minutes: r.minutes,
                      notes: r.notes,
                      status: "scheduled",
                      createdAt: new Date().toISOString(),
                    });
                  }
                  setOpen(false);
                  reset();
                },
                `${valid.length} lesson${valid.length === 1 ? "" : "s"} imported`,
              )
            }
          >
            <Upload className="size-4" /> Import {valid.length || ""} lesson
            {valid.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}