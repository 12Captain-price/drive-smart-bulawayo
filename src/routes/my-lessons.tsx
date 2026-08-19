import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  ListChecks,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeading } from "@/components/site/blocks";
import { cn } from "@/lib/utils";
import { errorMessage, fetchMyLessonsAsInstructor, fetchMyLessonsAsStudent, type MyLesson } from "@/lib/data";

export const Route = createFileRoute("/my-lessons")({
  component: MyLessons,
  head: () => ({
    meta: [
      { title: "My Lessons — Auto Driving School" },
      {
        name: "description",
        content: "Students and instructors: check your upcoming Auto Driving School lessons.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
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
  scheduled: { label: "Scheduled", icon: Clock, className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  "no-show": { label: "No-show", icon: AlertCircle, className: "bg-warning/15 text-warning-foreground border-warning/30" },
};

function StatPill({ icon: Icon, value, label }: { icon: typeof CheckCircle2; value: number; label: string }) {
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

function LessonRow({ lesson, otherParty }: { lesson: MyLesson; otherParty: string }) {
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
          <span className="text-lg leading-none font-bold">{new Date(lesson.startsAt).getDate()}</span>
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
            {lesson.lessonType === "provisional" ? "Provisional" : "Driving"} lesson with {otherParty}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canAddToCalendar && (
            <Button asChild size="icon" variant="ghost" className="size-8" title="Add to calendar">
              <a href={icsHref(lesson, otherParty)} download={`lesson-${lesson.id}.ics`}>
                <CalendarPlus className="size-4" />
              </a>
            </Button>
          )}
          <Badge variant="outline" className={cn("gap-1", meta.className)}>
            <StatusIcon className="size-3" />
            {meta.label}
          </Badge>
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
}: {
  greetingName: string;
  lessons: MyLesson[];
  otherPartyLabel: (l: MyLesson) => string;
  onReset: () => void;
  resetLabel: string;
}) {
  const [showHistory, setShowHistory] = useState(false);

  if (lessons.length === 0) {
    return (
      <div className="mt-6 text-center">
        <div className="bg-secondary text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-full">
          <CalendarClock className="size-6" />
        </div>
        <p className="mt-4 text-lg font-medium">Hi {greetingName.split(" ")[0]}, nothing on the schedule yet</p>
        <p className="text-muted-foreground mt-1 text-sm">Once a lesson is booked, it'll show up right here.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="sm">
            <Link to="/contact">Book a lesson</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            {resetLabel}
          </Button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const upcoming = lessons
    .filter((l) => l.status === "scheduled")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const history = lessons
    .filter((l) => l.status !== "scheduled")
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  const completedCount = lessons.filter((l) => l.status === "completed").length;
  const missedCount = lessons.filter((l) => l.status === "cancelled" || l.status === "no-show").length;
  const next = upcoming.find((l) => new Date(l.startsAt) > now);

  return (
    <div className="mt-6">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex items-center gap-2 duration-500">
        <Sparkles className="text-accent size-4" />
        <p className="text-lg font-medium">Hi {greetingName.split(" ")[0]}, here's your schedule</p>
      </div>

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
            {next.minutes} min · {next.lessonType === "provisional" ? "Provisional" : "Driving"} lesson with{" "}
            {otherPartyLabel(next)}
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
              <LessonRow key={l.id} lesson={l} otherParty={otherPartyLabel(l)} />
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
            <ChevronRight className={cn("size-3.5 transition-transform", showHistory && "rotate-90")} />
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

function StudentLookup() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ studentName: string; lessons: MyLesson[] } | null>(null);

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
      }
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <ScheduleView
        greetingName={result.studentName}
        lessons={result.lessons}
        otherPartyLabel={(l) => l.instructorName ?? "an instructor"}
        onReset={() => setResult(null)}
        resetLabel="Check a different student"
      />
    );
  }

  return (
    <Card className="border-border/60 mt-6">
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="student-name">Your full name</Label>
            <Input id="student-name" value={name} onChange={(e) => setName(e.target.value)} required />
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
  );
}

function InstructorLookup() {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ instructorName: string; lessons: MyLesson[] } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyLessonsAsInstructor(name, pin);
      if (!r) {
        setError("Those details don't match. Check your name and PIN, or ask the school to set one for you.");
        setResult(null);
      } else {
        setResult(r);
      }
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <ScheduleView
        greetingName={result.instructorName}
        lessons={result.lessons}
        otherPartyLabel={(l) => l.studentName ?? "a student"}
        onReset={() => setResult(null)}
        resetLabel="Check a different instructor"
      />
    );
  }

  return (
    <Card className="border-border/60 mt-6">
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="instructor-name">Your name</Label>
            <Input id="instructor-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instructor-pin">PIN</Label>
            <Input id="instructor-pin" value={pin} onChange={(e) => setPin(e.target.value)} required />
          </div>
          {error && (
            <p className="text-destructive flex items-center gap-2 text-sm">
              <AlertCircle className="size-4 shrink-0" /> {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Checking…" : "View my schedule"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RoleOption({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof GraduationCap;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-primary/20 ring-2"
          : "border-border/60 hover:border-border hover:bg-secondary/40",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </button>
  );
}

function MyLessons() {
  const [who, setWho] = useState<"student" | "instructor">("student");

  return (
    <Section className="max-w-xl">
      <SectionHeading
        eyebrow="Your schedule"
        title="My lessons"
        subtitle="Check your upcoming lessons — no account needed."
      />
      <div className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <RoleOption
            active={who === "student"}
            icon={GraduationCap}
            title="I'm a student"
            description="Check lessons booked under your name"
            onClick={() => setWho("student")}
          />
          <RoleOption
            active={who === "instructor"}
            icon={User}
            title="I'm an instructor"
            description="Check your teaching schedule"
            onClick={() => setWho("instructor")}
          />
        </div>
        {who === "student" ? <StudentLookup /> : <InstructorLookup />}
      </div>
      <p className="text-muted-foreground mt-10 flex items-start gap-2 text-xs">
        <CalendarCheck2 className="mt-0.5 size-3.5 shrink-0" />
        Your name and phone number are only used to match your record — this page never shows anyone else's
        lessons.
      </p>
    </Section>
  );
}