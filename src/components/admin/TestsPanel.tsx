import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  FileText,
  ListChecks,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChipGroup } from "@/components/site/ChipGroup";
import {
  ASSIGNMENT_STATUSES,
  errorMessage,
  fileToDataUrl,
  gradeMcq,
  makeAccessCode,
  makeToken,
  testIsReady,
  uid,
  useAssignments,
  useSettings,
  useStudents,
  useSubmissions,
  useTests,
  waLink,
  type Assignment,
  type AssignmentStatus,
  type Question,
  type SiteSettings,
  type Student,
  type Submission,
  type Test,
  type TestType,
} from "@/lib/data";
import { cn } from "@/lib/utils";

const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: "mcq", label: "Multiple choice" },
  { value: "pdf", label: "PDF paper" },
];

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

function copyViaExecCommand(text: string) {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    if (ok) toast.success("Link copied");
    else toast.error("Could not copy — tap the link box and select-all instead");
  } catch (err) {
    console.error("Copy fallback failed:", err);
    toast.error("Could not copy — tap the link box and select-all instead");
  }
}

function copy(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Link copied"),
      (err) => {
        // Some browsers (especially over plain http on a LAN IP, or without a
        // direct user-gesture chain) reject the modern Clipboard API — fall
        // back to the older approach instead of just giving up.
        console.error("navigator.clipboard.writeText failed:", err);
        copyViaExecCommand(text);
      },
    );
    return;
  }
  // Clipboard API is unavailable outside a secure context (https, or exactly
  // "localhost") — e.g. testing over a LAN IP like 192.168.x.x.
  copyViaExecCommand(text);
}

async function safe(fn: () => unknown, message: string) {
  try {
    await fn();
    toast.success(message);
  } catch (err) {
    toast.error(errorMessage(err, "Save failed"), { duration: Infinity });
  }
}

/* ------------------------------ search pickers ------------------------------ */

interface PickerOption {
  value: string;
  label: string;
  hint?: string;
}

/** Searchable single-select — replaces a wall-of-chips picker once the list gets long. */
function SearchPicker({
  value,
  onChange,
  options,
  placeholder,
  emptyText = "Nothing found.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholder: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="text-muted-foreground ml-2 size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value === value ? "" : o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Searchable multi-select with checkboxes — for bulk-assigning a test to many students at once. */
function MultiSearchPicker({
  values,
  onChange,
  options,
  placeholder,
  emptyText = "Nothing found.",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: PickerOption[];
  placeholder: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(values);

  function toggle(v: string) {
    onChange(selectedSet.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full justify-between py-2 font-normal"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {values.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            {values.length > 0 && values.length <= 3 &&
              options
                .filter((o) => selectedSet.has(o.value))
                .map((o) => (
                  <Badge key={o.value} variant="secondary" className="font-normal">
                    {o.label}
                  </Badge>
                ))}
            {values.length > 3 && (
              <Badge variant="secondary" className="font-normal">
                <Users className="size-3" /> {values.length} students selected
              </Badge>
            )}
          </span>
          <ChevronsUpDown className="text-muted-foreground ml-2 size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => toggle(o.value)}
                >
                  <Checkbox checked={selectedSet.has(o.value)} className="pointer-events-none" />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {values.length > 0 && (
          <div className="flex items-center justify-between border-t p-2">
            <span className="text-muted-foreground text-xs">{values.length} selected</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* --------------------------------- test bank -------------------------------- */

export function TestsPanel() {
  const { items: tests, add, update, remove } = useTests();
  const [tab, setTab] = useState<"bank" | "assign" | "grade">("bank");
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [bankQuery, setBankQuery] = useState("");

  const visibleTests = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => t.title.toLowerCase().includes(q));
  }, [tests, bankQuery]);

  return (
    <div className="space-y-5">
      <ChipGroup
        ariaLabel="Tests area"
        value={tab}
        onChange={(v) => setTab(v)}
        options={[
          { value: "bank", label: "Test bank" },
          { value: "assign", label: "Assign a test" },
          { value: "grade", label: "Mark & send results" },
        ]}
      />

      {tab === "bank" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                safe(async () => {
                  const created = await add({
                    title: "New test",
                    type: "mcq",
                    minutes: 20,
                    questions: [],
                    createdAt: new Date().toISOString(),
                  });
                  setJustCreatedId(created.id);
                }, "Test created")
              }
            >
              <Plus className="size-4" /> Add test
            </Button>
            {tests.length > 4 && (
              <div className="relative min-w-48 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={bankQuery}
                  onChange={(e) => setBankQuery(e.target.value)}
                  placeholder="Search tests…"
                  className="pl-9"
                />
              </div>
            )}
          </div>

          {tests.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No tests yet. Add one, then give it questions or upload a PDF paper.
            </p>
          )}
          {tests.length > 0 && visibleTests.length === 0 && (
            <p className="text-muted-foreground text-sm">No tests match "{bankQuery}".</p>
          )}

          {visibleTests.map((t) => (
            <TestEditor
              key={t.id}
              test={t}
              update={update}
              remove={remove}
              add={add}
              onDuplicated={setJustCreatedId}
              defaultOpen={t.id === justCreatedId}
            />
          ))}
        </div>
      )}

      {tab === "assign" && <AssignPanel />}
      {tab === "grade" && <GradePanel />}
    </div>
  );
}

function TestEditor({
  test,
  update,
  remove,
  add,
  onDuplicated,
  defaultOpen = false,
}: {
  test: Test;
  update: (id: string, patch: Partial<Test>) => void;
  remove: (id: string) => void;
  add: (item: Omit<Test, "id"> & { id?: string }) => Test;
  onDuplicated: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const setQuestions = (questions: Question[]) => update(test.id, { questions });
  const ready = testIsReady(test);

  function duplicate() {
    safe(async () => {
      const created = await add({
        title: `${test.title} (copy)`,
        type: test.type,
        minutes: test.minutes,
        questions: test.questions.map((q) => ({ ...q, id: uid() })),
        paper: test.paper,
        paperName: test.paperName,
        answerKey: test.answerKey,
        answerKeyName: test.answerKeyName,
        answerKeyText: test.answerKeyText,
        createdAt: new Date().toISOString(),
      });
      onDuplicated(created.id);
    }, "Test duplicated");
  }

  async function upload(file: File | undefined, field: "paper" | "answerKey") {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      update(test.id, { [field]: url, [`${field}Name`]: file.name } as Partial<Test>);
      toast.success("File added");
    } catch {
      toast.error("Could not read that file");
    }
  }

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            test.type === "mcq" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent",
          )}
        >
          {test.type === "mcq" ? <ListChecks className="size-4" /> : <FileText className="size-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{test.title || "Untitled test"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="font-mono text-[0.65rem] font-medium">
              {test.type === "mcq" ? "Multiple choice" : "PDF paper"}
            </Badge>
            <span>{test.minutes} min</span>
            {test.type === "mcq" && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {test.questions.length} question{test.questions.length === 1 ? "" : "s"}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className={cn("font-medium", ready ? "text-success" : "text-muted-foreground")}>
              {ready ? "Ready to send out" : "Not finished yet"}
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
        <CardContent className="space-y-4 border-t pt-5 pb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Test name</Label>
              <Input value={test.title} onChange={(e) => update(test.id, { title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Time allowed (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={test.minutes}
                onChange={(e) => update(test.id, { minutes: Number(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Type of test</Label>
            <ChipGroup
              size="sm"
              value={test.type}
              options={TEST_TYPES}
              onChange={(v) => update(test.id, { type: v })}
            />
          </div>

        {test.type === "mcq" ? (
          <div className="space-y-4">
            {test.questions.map((q, qi) => (
              <div key={q.id} className="bg-secondary/40 space-y-3 rounded-lg border p-4">
                <div className="flex items-start gap-2">
                  <span className="label-mono text-muted-foreground mt-2">Q{qi + 1}</span>
                  <Textarea
                    rows={2}
                    value={q.text}
                    placeholder="Type the question"
                    onChange={(e) =>
                      setQuestions(test.questions.map((x) => (x.id === q.id ? { ...x, text: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        placeholder={`Answer ${oi + 1}`}
                        onChange={(e) =>
                          setQuestions(
                            test.questions.map((x) =>
                              x.id === q.id
                                ? { ...x, options: x.options.map((o, i) => (i === oi ? e.target.value : o)) }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={q.correct === oi ? "default" : "outline"}
                        onClick={() =>
                          setQuestions(test.questions.map((x) => (x.id === q.id ? { ...x, correct: oi } : x)))
                        }
                      >
                        {q.correct === oi ? "Correct" : "Mark correct"}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remove answer"
                        onClick={() =>
                          setQuestions(
                            test.questions.map((x) => {
                              if (x.id !== q.id) return x;
                              const options = x.options.filter((_, i) => i !== oi);
                              // Keep "correct" pointing at the same answer text, not the same slot —
                              // otherwise deleting an earlier/marked option silently re-marks the wrong one.
                              let correct = x.correct;
                              if (x.correct === oi) correct = 0;
                              else if (x.correct > oi) correct = x.correct - 1;
                              return { ...x, options, correct };
                            }),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setQuestions(
                        test.questions.map((x) => (x.id === q.id ? { ...x, options: [...x.options, ""] } : x)),
                      )
                    }
                  >
                    <Plus className="size-4" /> Add answer
                  </Button>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" size="sm" variant="destructive">
                      <Trash2 className="size-4" /> Delete question
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this question?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{q.text || "(no question text)"}" and its answers will be removed for good. This can't be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => setQuestions(test.questions.filter((x) => x.id !== q.id))}
                      >
                        Delete question
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setQuestions([...test.questions, { id: uid(), text: "", options: ["", ""], correct: 0 }])
              }
            >
              <Plus className="size-4" /> Add question
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Test paper (PDF or photo)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => upload(e.target.files?.[0], "paper")}
              />
              {test.paperName && <p className="text-muted-foreground text-xs">Added: {test.paperName}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Answer key (PDF)</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => upload(e.target.files?.[0], "answerKey")} />
              {test.answerKeyName && <p className="text-muted-foreground text-xs">Added: {test.answerKeyName}</p>}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Or type the answers (staff only — never shown to students)</Label>
              <Textarea
                rows={4}
                value={test.answerKeyText ?? ""}
                placeholder="1. B&#10;2. C&#10;3. A"
                onChange={(e) => update(test.id, { answerKeyText: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            <ChevronUp className="size-4" /> Collapse
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={duplicate}>
            <Copy className="size-4" /> Duplicate
          </Button>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="ml-auto">
                <Trash2 className="size-4" /> Delete test
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{test.title || "Untitled test"}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes the test and all its questions for good. Any links you've already sent to students
                  for this test will stop working, even if they haven't written it yet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => safe(() => remove(test.id), "Test deleted")}
                >
                  Delete test
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      )}
    </Card>
  );
}

/* --------------------------------- assigning -------------------------------- */

const STATUS_COUNT_META: { value: AssignmentStatus; label: string; tone: string }[] = [
  { value: "not-started", label: "Not started", tone: "bg-secondary text-secondary-foreground" },
  { value: "in-progress", label: "In progress", tone: "bg-primary/10 text-primary" },
  { value: "submitted", label: "Submitted", tone: "bg-success/10 text-success" },
  { value: "expired", label: "Expired", tone: "bg-destructive/10 text-destructive" },
];

function AssignPanel() {
  const { items: tests } = useTests();
  const { items: students } = useStudents();
  const { items: assignments, addMany, update, remove } = useAssignments();
  const { settings } = useSettings();
  const [testId, setTestId] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState<{ duplicates: Student[]; targets: Student[] } | null>(null);

  const test = tests.find((t) => t.id === testId);

  const counts = useMemo(() => {
    const c: Record<AssignmentStatus, number> = { "not-started": 0, "in-progress": 0, submitted: 0, expired: 0 };
    for (const a of assignments) c[a.status]++;
    return c;
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const s = students.find((x) => x.id === a.studentId);
      const t = tests.find((x) => x.id === a.testId);
      return s?.name.toLowerCase().includes(q) || t?.title.toLowerCase().includes(q);
    });
  }, [assignments, listQuery, students, tests]);

  function hasUnfinished(studentId: string, testIdToCheck: string) {
    return assignments.some(
      (a) => a.testId === testIdToCheck && a.studentId === studentId && (a.status === "not-started" || a.status === "in-progress"),
    );
  }

  function doCreate(targets: Student[]) {
    if (!test) return;
    safe(async () => {
      const created = await addMany(
        targets.map((s) => ({
          testId: test.id,
          studentId: s.id,
          token: makeToken(),
          accessCode: makeAccessCode(),
          status: "not-started" as AssignmentStatus,
          extensionMinutes: 0,
          notes: "",
          log: [{ at: new Date().toISOString(), text: "Test sent out" }],
          createdAt: new Date().toISOString(),
        })),
      );
      setJustCreatedId(created[0]?.id ?? null);
      setStudentIds([]);
    }, targets.length > 1 ? `Test link created for ${targets.length} students` : "Test link created");
  }

  function attemptCreate() {
    if (!test) {
      toast.error("Choose a test first");
      return;
    }
    const targets = studentIds.map((id) => students.find((s) => s.id === id)).filter((s): s is Student => Boolean(s));
    if (targets.length === 0) {
      toast.error("Choose at least one student");
      return;
    }
    if (!testIsReady(test)) {
      toast.error("That test isn't finished yet");
      return;
    }
    const duplicates = targets.filter((s) => hasUnfinished(s.id, test.id));
    if (duplicates.length > 0) {
      setDuplicateInfo({ duplicates, targets });
      return;
    }
    doCreate(targets);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2">
            <Label>Which test?</Label>
            <SearchPicker
              value={testId}
              onChange={setTestId}
              placeholder="Search tests…"
              options={tests.map((t) => ({ value: t.id, label: t.title }))}
              emptyText="No tests yet — add one in the Test bank tab."
            />
          </div>
          <div className="grid gap-2">
            <Label>Which student(s)?</Label>
            <MultiSearchPicker
              values={studentIds}
              onChange={setStudentIds}
              placeholder="Search students — pick one or several…"
              options={students.map((s) => ({ value: s.id, label: `${s.name} · ${s.phone}`, hint: s.phone }))}
              emptyText="No students yet."
            />
            <p className="text-muted-foreground text-xs">
              Pick several to send the same test to a whole class in one go.
            </p>
          </div>
          <Button onClick={attemptCreate} size="lg">
            <Send className="size-4" />
            {studentIds.length > 1 ? `Create ${studentIds.length} test links` : "Create the student's test link"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Each link works once, on one device. If a student loses it, reset it below.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(duplicateInfo)} onOpenChange={(o) => !o && setDuplicateInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-5" /> Already assigned
            </AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateInfo?.duplicates.length === 1
                ? `${duplicateInfo.duplicates[0].name} already has this test assigned and hasn't finished it yet.`
                : `${duplicateInfo?.duplicates.length} of the selected students already have this test assigned and haven't finished it yet: ${duplicateInfo?.duplicates
                    .map((s) => s.name)
                    .join(", ")}.`}{" "}
              Sending it again creates a second, separate link for them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateInfo(null)}>Cancel</AlertDialogCancel>
            {duplicateInfo && duplicateInfo.targets.length > duplicateInfo.duplicates.length && (
              <Button
                variant="outline"
                onClick={() => {
                  const dupIds = new Set(duplicateInfo.duplicates.map((s) => s.id));
                  doCreate(duplicateInfo.targets.filter((s) => !dupIds.has(s.id)));
                  setDuplicateInfo(null);
                }}
              >
                Skip those, assign the rest
              </Button>
            )}
            <AlertDialogAction
              onClick={() => {
                if (duplicateInfo) doCreate(duplicateInfo.targets);
                setDuplicateInfo(null);
              }}
            >
              Assign anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {assignments.length === 0 && (
        <p className="text-muted-foreground text-sm">No tests have been sent out yet.</p>
      )}

      {assignments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_COUNT_META.map((m) => (
            <Badge key={m.value} variant="outline" className={cn("border-transparent font-medium", m.tone)}>
              {counts[m.value]} {m.label}
            </Badge>
          ))}
        </div>
      )}

      {assignments.length > 6 && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="Search by student or test…"
            className="pl-9"
          />
        </div>
      )}

      {assignments.length > 0 && filteredAssignments.length === 0 && (
        <p className="text-muted-foreground text-sm">No assigned tests match "{listQuery}".</p>
      )}

      {filteredAssignments.map((a) => (
        <AssignmentCard
          key={a.id}
          assignment={a}
          test={tests.find((x) => x.id === a.testId)}
          student={students.find((x) => x.id === a.studentId)}
          settings={settings}
          update={update}
          remove={remove}
          defaultOpen={a.id === justCreatedId}
        />
      ))}
    </div>
  );
}

const ASSIGNMENT_STATUS_TONE: Record<AssignmentStatus, string> = {
  "not-started": "text-muted-foreground",
  "in-progress": "text-primary",
  submitted: "text-success",
  expired: "text-destructive",
};

function AssignmentCard({
  assignment: a,
  test: t,
  student: s,
  settings,
  update,
  remove,
  defaultOpen = false,
}: {
  assignment: Assignment;
  test?: Test;
  student?: Student;
  settings: SiteSettings;
  update: (id: string, patch: Partial<Assignment>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const link = `${origin()}/test/${a.token}`;
  const statusLabel = ASSIGNMENT_STATUSES.find((x) => x.value === a.status)?.label ?? a.status;
  const message = [
    `Hi ${s?.name ?? ""}, here is your ${t?.title ?? "test"} from Auto Driving School.`,
    `Time allowed: ${(t?.minutes ?? 0) + a.extensionMinutes} minutes.`,
    `Open this link when you are ready — it only works once:`,
    link,
    `To start, you will type your name, the last 4 digits of your phone number, and this access code: ${a.accessCode}`,
  ].join("\n");

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <Send className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s?.name ?? "Unknown student"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="font-mono text-[0.65rem] font-medium">
              {t?.title ?? "Deleted test"}
            </Badge>
            <span>{(t?.minutes ?? 0) + a.extensionMinutes} min</span>
            <span aria-hidden>·</span>
            <span className={cn("font-medium", ASSIGNMENT_STATUS_TONE[a.status])}>{statusLabel}</span>
            {a.accessCodeUsed && a.status !== "submitted" && (
              <>
                <span aria-hidden>·</span>
                <span className="text-destructive font-medium">code used</span>
              </>
            )}
          </span>
        </span>

        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="space-y-3 border-t pt-5 pb-6">
          <div className="bg-secondary/50 flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs outline-none"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => copy(link)}>
              <Copy className="size-4" /> Copy link
            </Button>
            <Button size="sm" asChild className="bg-success text-success-foreground hover:bg-success/90">
              <a href={waLink(settings.whatsapp && s?.phone ? s.phone : settings.whatsapp, message)} target="_blank" rel="noreferrer">
                Send on WhatsApp
              </a>
            </Button>
          </div>

          <div className="bg-secondary/50 flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground text-xs">Access code</span>
              <p className="font-mono text-sm font-semibold">
                {a.accessCode}{" "}
                {a.accessCodeUsed && <span className="text-destructive font-sans font-normal">(used)</span>}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                safe(
                  () =>
                    update(a.id, {
                      accessCode: makeAccessCode(),
                      accessCodeUsed: false,
                      log: [...a.log, { at: new Date().toISOString(), text: "Access code renewed by staff" }],
                    }),
                  "New access code created",
                )
              }
            >
              Renew code
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <ChipGroup
              size="sm"
              value={a.status}
              options={ASSIGNMENT_STATUSES}
              onChange={(v) => safe(() => update(a.id, { status: v }), "Status updated")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Extra time (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={a.extensionMinutes}
                onChange={(e) => update(a.id, { extensionMinutes: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Your note</Label>
              <Input
                value={a.notes}
                placeholder="e.g. rewrote after network problem"
                onChange={(e) => update(a.id, { notes: e.target.value })}
              />
            </div>
          </div>

          {a.log.length > 0 && (
            <details className="text-muted-foreground text-xs">
              <summary className="cursor-pointer">What happened ({a.log.length})</summary>
              <ul className="mt-2 space-y-1">
                {a.log.map((l, i) => (
                  <li key={i}>
                    {new Date(l.at).toLocaleString()} — {l.text}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              <ChevronUp className="size-4" /> Collapse
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                safe(
                  () =>
                    update(a.id, {
                      token: makeToken(),
                      accessCode: makeAccessCode(),
                      accessCodeUsed: false,
                      status: "not-started",
                      startedAt: undefined,
                      submittedAt: undefined,
                      log: [
                        ...a.log,
                        { at: new Date().toISOString(), text: "Link reset by staff (access code renewed too)" },
                      ],
                    }),
                  "New link and access code created",
                )
              }
            >
              Reset link
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="ml-auto"
              onClick={() => safe(() => remove(a.id), "Test link deleted")}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* --------------------------------- grading --------------------------------- */

/** Was this submission the result of the away-too-long / time's-up auto-submit,
 *  rather than the student tapping "Submit" themselves? Read off the assignment
 *  log line the submit flow always writes first. */
function autoSubmitReason(assignment?: Assignment): string | null {
  const first = assignment?.log[0]?.text;
  if (!first) return null;
  if (first.startsWith("Auto-submitted")) return first;
  if (first === "Time ran out — answers sent automatically") return first;
  return null;
}

function GradePanel() {
  const { items: submissions, update } = useSubmissions();
  const { items: tests } = useTests();
  const { items: students } = useStudents();
  const { items: assignments, update: updateAssignment } = useAssignments();
  const { settings } = useSettings();

  const rows = useMemo(() => {
    const withData = submissions.map((sub) => ({
      sub,
      test: tests.find((t) => t.id === sub.testId),
      student: students.find((s) => s.id === sub.studentId),
      assignment: assignments.find((a) => a.id === sub.assignmentId),
    }));
    // Needs-grading first (busiest graders shouldn't have to scan past marked
    // ones), most recently written first within each group.
    return withData.sort((a, b) => {
      const graded = (a.sub.mark ? 1 : 0) - (b.sub.mark ? 1 : 0);
      if (graded !== 0) return graded;
      return new Date(b.sub.submittedAt).getTime() - new Date(a.sub.submittedAt).getTime();
    });
  }, [submissions, tests, students, assignments]);

  const needsGrading = rows.filter((r) => !r.sub.mark).length;

  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">No tests have been written yet.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        {needsGrading === 0 ? (
          <span className="text-success">All caught up — nothing needs grading.</span>
        ) : (
          <>
            <span className="text-accent">
              {needsGrading} test{needsGrading === 1 ? "" : "s"} need{needsGrading === 1 ? "s" : ""} grading
            </span>
            <span className="text-muted-foreground"> · {rows.length} total</span>
          </>
        )}
      </p>
      {rows.map(({ sub, test, student, assignment }) => (
        <SubmissionCard
          key={sub.id}
          submission={sub}
          test={test}
          student={student}
          assignment={assignment}
          settings={settings}
          update={update}
          updateAssignment={updateAssignment}
        />
      ))}
    </div>
  );
}

function SubmissionCard({
  submission: sub,
  test,
  student,
  assignment,
  settings,
  update,
  updateAssignment,
}: {
  submission: Submission;
  test?: Test;
  student?: Student;
  assignment?: Assignment;
  settings: SiteSettings;
  update: (id: string, patch: Partial<Submission>) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
}) {
  const [open, setOpen] = useState(!sub.mark);
  const auto = test && test.type === "mcq" ? gradeMcq(test, sub.answers) : null;
  const autoReason = autoSubmitReason(assignment);
  const flagGroups = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of sub.flags) m.set(f.type, (m.get(f.type) ?? 0) + 1);
    return Array.from(m.entries());
  }, [sub.flags]);
  const resultsLink = assignment?.resultsToken ? `${origin()}/results/${assignment.resultsToken}` : "";
  const message = [
    `Hi ${student?.name ?? ""}, your ${test?.title ?? "test"} result is ready.`,
    sub.mark ? `Result: ${sub.mark}` : "",
    sub.feedback ? `Note: ${sub.feedback}` : "",
    resultsLink ? `See it here: ${resultsLink}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            sub.mark ? "bg-success/10 text-success" : "bg-accent/10 text-accent",
          )}
        >
          <ListChecks className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{student?.name ?? "Unknown student"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className="font-mono text-[0.65rem] font-medium">
              {test?.title ?? "Deleted test"}
            </Badge>
            <span>written {new Date(sub.submittedAt).toLocaleDateString()}</span>
            {auto && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">
                  {auto.score}/{auto.total}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className={cn("font-medium", sub.mark ? "text-success" : "text-accent")}>
              {sub.mark ? `Marked: ${sub.mark}` : "Needs grading"}
            </span>
            {autoReason && (
              <>
                <span aria-hidden>·</span>
                <span className="text-destructive font-medium">Auto-submitted</span>
              </>
            )}
            {!autoReason && sub.flags.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-destructive font-medium">
                  {sub.flags.length} flag{sub.flags.length === 1 ? "" : "s"}
                </span>
              </>
            )}
          </span>
        </span>

        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="space-y-3 border-t pt-5 pb-6">
          {auto && (
            <p className="bg-secondary/60 rounded-lg border px-4 py-3 text-sm">
              Score from the answer sheet:{" "}
              <span className="font-mono font-bold">
                {auto.score} / {auto.total}
              </span>{" "}
              ({Math.round((auto.score / Math.max(1, auto.total)) * 100)}%)
            </p>
          )}

          {test?.type === "mcq" && (
            <details className="text-sm">
              <summary className="cursor-pointer">See their answers</summary>
              <ol className="mt-2 space-y-1 pl-5">
                {test.questions.map((q) => {
                  const given = sub.answers[q.id];
                  const right = given === q.correct;
                  return (
                    <li key={q.id} className={right ? "text-success" : "text-destructive"}>
                      {q.text || "(no question text)"} — {given === undefined ? "not answered" : q.options[given]}
                      {!right && <span className="text-muted-foreground"> (correct: {q.options[q.correct]})</span>}
                    </li>
                  );
                })}
              </ol>
            </details>
          )}

          {sub.typed && (
            <div className="grid gap-1 text-sm">
              <Label>Their typed answers</Label>
              <p className="bg-secondary/50 rounded-lg border p-3 whitespace-pre-wrap">{sub.typed}</p>
            </div>
          )}
          {sub.photo && (
            <div className="grid gap-1">
              <Label>Photo of their written answers</Label>
              <img src={sub.photo} alt="Student answer sheet" className="max-h-96 rounded-lg border object-contain" />
            </div>
          )}
          {test?.answerKey && (
            <a href={test.answerKey} download={test.answerKeyName} className="text-primary text-sm underline">
              <FileText className="mr-1 inline size-4" /> Open the answer key
            </a>
          )}
          {test?.answerKeyText && (
            <p className="text-muted-foreground text-xs whitespace-pre-wrap">Answer key: {test.answerKeyText}</p>
          )}

          {autoReason && (
            <p className="bg-destructive/10 text-destructive border-destructive/30 rounded-lg border px-4 py-3 text-sm font-medium">
              <AlertTriangle className="mr-1.5 inline size-4" /> {autoReason}
            </p>
          )}

          {sub.flags.length > 0 && (
            <div className="grid gap-1.5 text-sm">
              <Label>What happened during the test</Label>
              <div className="flex flex-wrap gap-1.5">
                {flagGroups.map(([type, count]) => (
                  <Badge key={type} variant="outline" className="border-destructive/30 text-destructive font-normal">
                    {type}
                    {count > 1 ? ` × ${count}` : ""}
                  </Badge>
                ))}
              </div>
              <details className="text-muted-foreground text-xs">
                <summary className="cursor-pointer">Full timeline</summary>
                <ul className="mt-2 space-y-1">
                  {sub.flags.map((f, i) => (
                    <li key={i}>
                      {new Date(f.at).toLocaleString()} — {f.type}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Final result</Label>
              <Input
                value={sub.mark ?? (auto ? `${auto.score}/${auto.total}` : "")}
                placeholder="e.g. 24/25 — Pass"
                onChange={(e) => update(sub.id, { mark: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Note for the student</Label>
              <Input
                value={sub.feedback ?? ""}
                placeholder="e.g. Well done — revise road signs"
                onChange={(e) => update(sub.id, { feedback: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              <ChevronUp className="size-4" /> Collapse
            </Button>
            <Button
              size="sm"
              onClick={() =>
                safe(() => {
                  if (assignment && !assignment.resultsToken)
                    updateAssignment(assignment.id, { resultsToken: makeToken() });
                  update(sub.id, {
                    mark: sub.mark ?? (auto ? `${auto.score}/${auto.total}` : ""),
                  });
                }, "Result saved")
              }
            >
              Save result
            </Button>
            {resultsLink && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(resultsLink)}>
                  <Copy className="size-4" /> Copy results link
                </Button>
                <Button size="sm" asChild className="bg-success text-success-foreground hover:bg-success/90">
                  <a href={waLink(student?.phone || settings.whatsapp, message)} target="_blank" rel="noreferrer">
                    <Send className="size-4" /> Send result on WhatsApp
                  </a>
                </Button>
              </>
            )}
          </div>
          {!resultsLink && (
            <p className="text-muted-foreground text-xs">
              Tap "Save result" to create the student's private results link.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}