import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  Loader2,
  Maximize,
  MousePointerClick,
  ShieldAlert,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import { Section } from "@/components/site/blocks";
import { PdfPaper } from "@/components/site/PdfPaper";
import {
  fileToDataUrl,
  gradeMcq,
  last4,
  makeToken,
  timeLeftMs,
  useAssignments,
  useStudents,
  useSubmissions,
  useTests,
  type FlagEvent,
} from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/test/$token")({
  component: TakeTest,
  head: () => ({
    meta: [
      { title: "Your Test | Auto Driving School" },
      { name: "description", content: "Write your Auto Driving School test at your own private link." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your Test | Auto Driving School" },
      { property: "og:description", content: "Private test link for Auto Driving School learners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** How long a student can be away from the test screen (tab hidden, or fullscreen exited)
 *  before their test is auto-submitted for them. */
const GRACE_MS = 10_000;
/** Countdown moments that get a toast warning, in whole seconds remaining. */
const TIME_WARNINGS = [300, 60];

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Section className="max-w-md">
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <AlertCircle className="text-accent size-12" />
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">{body}</p>
        </CardContent>
      </Card>
    </Section>
  );
}

function TakeTest() {
  const { token } = Route.useParams();
  const { items: assignments, update: updateAssignment, isLoading: assignmentsLoading } = useAssignments();
  const { items: tests, isLoading: testsLoading } = useTests();
  const { items: students, isLoading: studentsLoading } = useStudents();
  const { add: addSubmission } = useSubmissions();
  const dataLoading = assignmentsLoading || testsLoading || studentsLoading;

  const assignment = assignments.find((a) => a.token === token);
  const test = tests.find((t) => t.id === assignment?.testId);
  const student = students.find((s) => s.id === assignment?.studentId);

  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [photo, setPhoto] = useState<{ src: string; name: string } | null>(null);
  const [paperVisible, setPaperVisible] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** Away-from-screen tracking for the auto-submit-on-leave feature. */
  const [awaySince, setAwaySince] = useState<number | null>(null);
  const [awayReason, setAwayReason] = useState<"tab" | "fullscreen" | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [banner, setBanner] = useState<{ text: string; tone: "warning" | "danger" } | null>(null);

  const flags = useRef<FlagEvent[]>([]);
  const submitting = useRef(false);
  const warned = useRef<Set<number>>(new Set());
  const bannerTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const started = assignment?.status === "in-progress" && Boolean(assignment.startedAt);
  const msLeft = test && assignment ? timeLeftMs(test, assignment, now) : null;

  function pushFlag(type: string) {
    flags.current = [...flags.current, { at: new Date().toISOString(), type }];
  }

  function showBanner(text: string, tone: "warning" | "danger") {
    window.clearTimeout(bannerTimeout.current);
    setBanner({ text, tone });
    bannerTimeout.current = setTimeout(() => setBanner(null), 6000);
  }

  /* countdown */
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [started]);

  /* note when they leave the screen, exit fullscreen, or try to copy/paste */
  useEffect(() => {
    if (!started) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        pushFlag("left the test screen");
        setStrikes((s) => s + 1);
        setAwaySince(Date.now());
        setAwayReason("tab");
      } else if (awaySince && awayReason === "tab") {
        setAwaySince(null);
        setAwayReason(null);
        showBanner("Welcome back, leaving the test screen has been logged and reported to your school.", "warning");
      }
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        pushFlag("exited fullscreen");
        setStrikes((s) => s + 1);
        setAwaySince(Date.now());
        setAwayReason("fullscreen");
      } else if (awaySince && awayReason === "fullscreen") {
        setAwaySince(null);
        setAwayReason(null);
        showBanner("Welcome back, exiting fullscreen has been logged and reported to your school.", "warning");
      }
    };
    const blockAction = (e: Event) => {
      e.preventDefault();
      pushFlag("tried to copy/paste/right-click");
    };
    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("copy", blockAction);
    document.addEventListener("cut", blockAction);
    document.addEventListener("paste", blockAction);
    document.addEventListener("contextmenu", blockAction);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("copy", blockAction);
      document.removeEventListener("cut", blockAction);
      document.removeEventListener("paste", blockAction);
      document.removeEventListener("contextmenu", blockAction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, awaySince, awayReason]);

  const questions = useMemo(() => test?.questions ?? [], [test]);
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );

  function submit(auto = false, reason?: string) {
    if (!assignment || !test || submitting.current) return;
    submitting.current = true;
    setSending(true);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const graded = test.type === "mcq" ? gradeMcq(test, answers) : null;
    addSubmission({
      assignmentId: assignment.id,
      testId: test.id,
      studentId: assignment.studentId,
      answers,
      typed: typed.trim() || undefined,
      photo: photo?.src,
      photoName: photo?.name,
      flags: flags.current,
      autoScore: graded?.score,
      autoTotal: graded?.total,
      submittedAt: new Date().toISOString(),
    });
    updateAssignment(assignment.id, {
      status: "submitted",
      submittedAt: new Date().toISOString(),
      resultsToken: assignment.resultsToken ?? makeToken(),
      log: [
        ...assignment.log,
        {
          at: new Date().toISOString(),
          text: auto ? (reason ?? "Time ran out, answers sent automatically") : "Answers sent",
        },
        ...flags.current.map((f) => ({ at: f.at, text: f.type })),
      ],
    });
    setFinished(true);
  }

  /* time's up → send whatever they have */
  useEffect(() => {
    if (started && msLeft === 0 && !finished) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, started, finished]);

  /* been away too long (tab hidden / left fullscreen) → auto-submit */
  useEffect(() => {
    if (!started || finished || !awaySince) return;
    if (Date.now() - awaySince >= GRACE_MS) {
      submit(
        true,
        awayReason === "fullscreen"
          ? "Auto-submitted: exited fullscreen for too long"
          : "Auto-submitted: left the test screen for too long",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, awaySince, awayReason, started, finished]);

  /* low-time toast warnings */
  useEffect(() => {
    if (!started || msLeft == null || finished) return;
    const seconds = Math.floor(msLeft / 1000);
    for (const mark of TIME_WARNINGS) {
      if (seconds === mark && !warned.current.has(mark)) {
        warned.current.add(mark);
        toast.warning(mark >= 60 ? `${mark / 60} minute${mark > 60 ? "s" : ""} left, start wrapping up.` : `${mark} seconds left!`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, started, finished]);

  if (!assignment || !test) {
    // Data hasn't finished loading yet — this is NOT the same as "not
    // found". Without this check, every visit briefly flashes the invalid
    // link screen while assignments/tests/students are still fetching.
    if (dataLoading) {
      return (
        <Section className="max-w-md">
          <Card className="shadow-lg">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Loader2 className="text-accent size-10 animate-spin" />
              <p className="text-muted-foreground text-sm">Loading your test…</p>
            </CardContent>
          </Card>
        </Section>
      );
    }
    return <Notice title="This link isn't valid" body="Please ask the school to send you a new test link." />;
  }

  if (finished || assignment.status === "submitted")
    return (
      <Section className="max-w-md">
        <Card className="shadow-lg">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CheckCircle2 className="text-success size-14" />
            <h1 className="text-xl font-semibold">Your answers have been sent</h1>
            <p className="text-muted-foreground text-sm">
              Thanks {student?.name ?? ""}, the school will mark your test and send your result on WhatsApp.
            </p>
          </CardContent>
        </Card>
      </Section>
    );

  if (assignment.status === "expired")
    return <Notice title="This test has closed" body="Please contact the school if you still need to write." />;

  /* ------------------------- instructions & regulations -------------------------- */
  if (!started && !rulesAccepted) {
    const rules = [
      {
        icon: Maximize,
        text: "The test opens in fullscreen. Find a quiet, private spot with a stable connection before you begin.",
      },
      {
        icon: Timer,
        text: `You'll have ${test.minutes + assignment.extensionMinutes} minutes once you start. The clock does not pause.`,
      },
      {
        icon: MousePointerClick,
        text: "Copying, pasting, and right-click are disabled for the whole test.",
      },
      {
        icon: ShieldAlert,
        text: `If you switch tabs, minimise the window, or leave fullscreen for more than ${Math.round(
          GRACE_MS / 1000,
        )} seconds, your test will be submitted automatically with whatever you've answered so far.`,
      },
      {
        icon: ListChecks,
        text: "This link and access code each work once only, you can't restart once you begin.",
      },
    ];
    return (
      <Section className="max-w-lg">
        <Card className="shadow-lg">
          <CardContent className="space-y-5 pt-8">
            <div className="text-center">
              <p className="label-mono text-accent">Before you start</p>
              <h1 className="mt-2 text-2xl font-bold">Instructions &amp; regulations</h1>
              <p className="text-muted-foreground mt-2 text-sm">{test.title}</p>
            </div>
            <ul className="space-y-3">
              {rules.map((r, i) => (
                <li key={i} className="bg-secondary/40 flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <r.icon className="text-accent mt-0.5 size-4 shrink-0" />
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={rulesAccepted}
                onCheckedChange={(v) => setRulesAccepted(v === true)}
                className="mt-0.5"
              />
              I have read and understood these rules, and I'm ready to begin.
            </label>
            <Button
              size="lg"
              className="w-full shadow-md"
              disabled={!rulesAccepted}
              onClick={() => setRulesAccepted(true)}
            >
              Continue to my test
            </Button>
          </CardContent>
        </Card>
      </Section>
    );
  }

  /* ------------------------------ start screen ----------------------------- */
  if (!started)
    return (
      <Section className="max-w-md">
        <Card className="shadow-lg">
          <CardContent className="space-y-5 pt-8">
            <div className="text-center">
              <p className="label-mono text-accent">Your test</p>
              <h1 className="mt-2 text-2xl font-bold">{test.title}</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                You have {test.minutes + assignment.extensionMinutes} minutes. Once you start, the clock keeps
                running, so find a quiet spot first.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullname">Your full name</Label>
              <Input
                id="fullname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As given to the school"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pin">Last 4 digits of your phone number</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center font-mono text-lg"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Access code from your school</Label>
              <Input
                id="code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code they gave you"
                className="text-center font-mono text-lg"
              />
            </div>
            <Button
              size="lg"
              className="w-full shadow-md"
              onClick={async () => {
                const nameOk = name.trim().toLowerCase() === (student?.name ?? "").trim().toLowerCase();
                const pinOk = !!student && pin.trim() === last4(student.phone);
                if (!student || !nameOk || !pinOk) {
                  toast.error("Those details don't match. Check your name and phone number.");
                  return;
                }
                if (assignment.accessCodeUsed) {
                  toast.error("This code has already been used. Ask the school to renew it for you.");
                  return;
                }
                if (code.trim() !== assignment.accessCode) {
                  toast.error("That access code isn't right. Check with your school.");
                  return;
                }
                try {
                  await document.documentElement.requestFullscreen?.();
                } catch {
                  // fullscreen isn't available on this device — continue anyway
                }
                updateAssignment(assignment.id, {
                  status: "in-progress",
                  startedAt: new Date().toISOString(),
                  accessCodeUsed: true,
                  log: [...assignment.log, { at: new Date().toISOString(), text: "Started the test" }],
                });
                setNow(Date.now());
              }}
            >
              Start my test
            </Button>
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
              <Maximize className="size-3.5" /> Opens in fullscreen. This link and code each work once only.
            </p>
          </CardContent>
        </Card>
      </Section>
    );

  /* -------------------------------- the test ------------------------------- */
  const totalSeconds = Math.floor((msLeft ?? 0) / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  const low = totalSeconds < 120;
  const q = questions[index];
  const unansweredCount = questions.length - answeredCount;
  const writtenIncomplete = test.type === "pdf" && !typed.trim() && !photo;
  // Papers are now Storage public URLs (see uploadTestFileToStorage), not
  // data URLs, so we can't sniff the mime type from the string prefix
  // anymore — go by the uploaded file's extension instead. Data-URL papers
  // uploaded before that change still work via the old prefix check.
  const isPdfPaper =
    test.paper?.startsWith("data:application/pdf") ||
    /\.pdf($|\?)/i.test(test.paper ?? "") ||
    /\.pdf$/i.test(test.paperName ?? "");

  const confirmMessage =
    test.type === "mcq"
      ? unansweredCount > 0
        ? `You still have ${unansweredCount} question${unansweredCount > 1 ? "s" : ""} unanswered. Once you submit, you can't come back to change anything.`
        : "Once you submit, you can't come back to change your answers. Ready to send?"
      : writtenIncomplete
        ? "You haven't typed an answer or added a photo yet. Once you submit, you can't come back to change anything."
        : "Once you submit, you can't come back to change anything. Ready to send?";

  return (
    <Section className={cn("select-none", test.type === "pdf" ? "max-w-5xl" : "max-w-2xl")}>
      <div
        className={cn(
          "bg-background/95 sticky top-16 z-30 mb-2 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm backdrop-blur",
          low && "border-destructive text-destructive",
        )}
      >
        <span className="truncate text-sm font-medium">{test.title}</span>
        <span className="flex shrink-0 items-center gap-3">
          {strikes > 0 && (
            <span className="text-destructive flex items-center gap-1 text-xs font-semibold">
              <ShieldAlert className="size-3.5" /> {strikes} flagged
            </span>
          )}
          <span className="flex items-center gap-2 font-mono text-lg font-bold">
            <Clock className="size-5" /> {mm}:{ss}
          </span>
        </span>
      </div>

      {banner && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm",
            banner.tone === "danger"
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-accent bg-accent/10 text-accent-foreground",
          )}
        >
          <ShieldAlert className="size-4 shrink-0" /> {banner.text}
        </div>
      )}

      {test.type === "mcq" ? (
        <Card className="shadow-lg">
          <CardContent className="space-y-6 pt-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="label-mono text-muted-foreground">
                  Question {index + 1} of {questions.length}
                </p>
                <p className="text-muted-foreground text-xs">
                  {answeredCount}/{questions.length} answered
                </p>
              </div>
              <Progress value={(answeredCount / Math.max(questions.length, 1)) * 100} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {questions.map((qq, i) => (
                  <button
                    key={qq.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                      i === index
                        ? "border-primary bg-primary text-primary-foreground"
                        : answers[qq.id] !== undefined
                          ? "border-success/40 bg-success/15 text-success"
                          : "hover:border-primary/50",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <h1 className="text-xl font-semibold">{q?.text}</h1>
            <div className="grid gap-3">
              {q?.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [q.id]: i })}
                  className={cn(
                    "rounded-xl border p-4 text-left text-base transition-all duration-200 active:scale-[0.99]",
                    answers[q.id] === i
                      ? "border-primary bg-primary/10 ring-primary/30 shadow-md ring-2"
                      : "hover:border-primary/50 hover:bg-secondary/60 hover:shadow-sm",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="lg" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                Back
              </Button>
              {index < questions.length - 1 ? (
                <Button size="lg" onClick={() => setIndex(index + 1)}>
                  Next question
                </Button>
              ) : (
                <Button size="lg" className="shadow-md" disabled={sending} onClick={() => setConfirmOpen(true)}>
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    "Send my answers"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {test.paper && (
            <div className={cn(!paperVisible && "hidden", "lg:block")}>
              <Card className="shadow-lg lg:sticky lg:top-32">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center justify-between gap-2">
                    <p className="label-mono text-muted-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5" /> Test paper
                    </p>
                  </div>
                  <div className="bg-secondary/30 h-[60vh] overflow-y-auto rounded-lg border lg:h-[70vh]">
                    {isPdfPaper ? (
                      <PdfPaper src={test.paper!} className="size-full" />
                    ) : (
                      <img src={test.paper} alt="Test paper" className="size-full object-contain" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-3">
            {test.paper && (
              <Button
                variant="outline"
                size="sm"
                className="w-full lg:hidden"
                onClick={() => setPaperVisible((v) => !v)}
              >
                <FileText className="size-4" /> {paperVisible ? "Hide test paper" : "Show test paper"}
              </Button>
            )}
            <Card className="shadow-lg">
              <CardContent className="space-y-5 pt-8">
                <h1 className="text-xl font-semibold">{test.title}</h1>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="typed">Type your answers here</Label>
                    <span className="text-muted-foreground text-xs">
                      {typed.trim() ? typed.trim().split(/\s+/).length : 0} words
                    </span>
                  </div>
                  <Textarea
                    id="typed"
                    rows={10}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="1. ...&#10;2. ..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="photo">Or take a photo of your written answers</Label>
                  {photo ? (
                    <div className="relative overflow-hidden rounded-lg border">
                      <img src={photo.src} alt={photo.name} className="max-h-64 w-full object-contain" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 size-7 shadow"
                        onClick={() => {
                          setPhoto(null);
                          if (photoInputRef.current) photoInputRef.current.value = "";
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <Camera className="size-4" /> Add a photo
                    </Button>
                  )}
                  <Input
                    ref={photoInputRef}
                    id="photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setPhoto({ src: await fileToDataUrl(file), name: file.name });
                        toast.success("Photo added");
                      } catch {
                        toast.error("Could not read that photo");
                      }
                    }}
                  />
                </div>
                <Button
                  size="lg"
                  className="w-full shadow-md"
                  disabled={sending}
                  onClick={() => setConfirmOpen(true)}
                >
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    "Send my answers"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit()}>Yes, submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}