import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MessageCircleQuestion,
  Package as PackageIcon,
  Plus,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  UsersRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FramedPhoto, TRUST_ICONS, TRUST_ICON_LABELS } from "@/components/site/blocks";
import { Logo } from "@/components/site/Logo";
import type { TrustIconKey } from "@/lib/data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImageUploader } from "@/components/site/ImageUploader";
import { ChipGroup } from "@/components/site/ChipGroup";
import { TestsPanel } from "@/components/admin/TestsPanel";
import { SchedulePanel } from "@/components/admin/SchedulePanel";
import { HelpPanel } from "@/components/admin/HelpPanel";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { StaffAccountsPanel } from "@/components/admin/StaffAccountsPanel";
import { resolveLoginEmail } from "@/lib/staff-auth-server";
import { downloadSpreadsheet, parseCsv, printTable, type Row } from "@/lib/docs";
import { printPaymentReceipt, printStudentProfile } from "@/lib/receipts";
import { Section } from "@/components/site/blocks";
import { EnrollDialog } from "@/components/admin/EnrollDialog";
import {
  BOOKING_TEMPLATE_TOKENS,
  PAYMENT_TEMPLATE_TOKENS,
  WELCOME_TEMPLATE_TOKENS,
  INSTRUCTOR_LESSON_TEMPLATE_TOKENS,
  STUDENT_LESSON_TEMPLATE_TOKENS,
  ENQUIRY_FOLLOWUP_TEMPLATE_TOKENS,
  WEEKLY_PLAN_TEMPLATE_TOKENS,
  ENQUIRY_STATUSES,
  PAYMENT_STATUSES,
  STUDENT_STATUSES,
  bookedSlotKeys,
  hasLegacyLocalInstructors,
  instructorHasPin,
  migrateLocalInstructorsToSupabase,
  renderTemplate,
  setInstructorPin,
  clearInstructorPin,
  slotKey,
  slugify,
  waLink,
  errorMessage,
  useAboutContent,
  useAboutSections,
  useEnquiries,
  useFaqs,
  useInstructors,
  usePackages,
  usePayments,
  usePaymentPolicy,
  usePhotos,
  usePromotions,
  useSettings,
  useStudents,
  useSubmissions,
  useTeam,
  useTestimonials,
  useTips,
  uploadPhotoToStorage,
  hasLegacyLocalData,
  migrateLocalDataToSupabase,
  type AboutSection,
  type AboutSectionType,
  type Enquiry,
  type Faq,
  type Instructor,
  type Package,
  type Payment,
  type PaymentPolicyContent,
  type PhotoCategory,
  type PolicySection,
  type Promotion,
  type Student,
  type TeamMember,
  type Testimonial,
  type Tip,
  type LessonType,
} from "@/lib/data";
import { cn } from "@/lib/utils";

const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "gallery", label: "Gallery" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
];

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({
    meta: [
      { title: "Admin | Auto Driving School" },
      { name: "description", content: "Private admin dashboard for Auto Driving School." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin | Auto Driving School" },
      { property: "og:description", content: "Private admin area." },
    ],
  }),
});

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

const SECTIONS = [
  "Overview",
  "Enquiries",
  "Students",
  "Schedule",
  "Payments",
  "Tests",
  "Packages",
  "Instructors",
  "About Page",
  "Meet the Team",
  "Testimonials",
  "Photos & Media",
  "Promotions",
  "Driving Tips",
  "FAQs",
  "Payment Policy",
  "Site Settings",
  "Staff Accounts",
  "Help",
] as const;
type SectionName = (typeof SECTIONS)[number];

/** localStorage key for "when did this browser last open the Payments tab" —
 *  drives the badge for newly-arrived payments, see badgeCounts below. */
const PAYMENTS_LAST_SEEN_KEY = "ads-admin-payments-last-seen";

/** Icon shown next to each section in the sidebar. */
const NAV_ICONS: Record<SectionName, typeof Inbox> = {
  Overview: LayoutDashboard,
  Enquiries: Inbox,
  Students: GraduationCap,
  Schedule: CalendarClock,
  Payments: Wallet,
  Tests: ClipboardCheck,
  Packages: PackageIcon,
  Instructors: UserCog,
  "About Page": FileText,
  "Meet the Team": UsersRound,
  Testimonials: Star,
  "Photos & Media": ImageIcon,
  Promotions: Tag,
  "Driving Tips": BookOpen,
  FAQs: MessageCircleQuestion,
  "Payment Policy": ShieldAlert,
  "Site Settings": SettingsIcon,
  "Staff Accounts": ShieldCheck,
  Help: HelpCircle,
};

/** Groups the flat SECTIONS list into labelled clusters for the sidebar —
 *  purely a display grouping, doesn't change routing or SECTIONS itself. */
const NAV_GROUPS: { label: string; items: SectionName[] }[] = [
  { label: "Overview", items: ["Overview"] },
  { label: "Operations", items: ["Enquiries", "Students", "Schedule", "Payments", "Tests"] },
  {
    label: "Content & site",
    items: [
      "Packages",
      "Instructors",
      "About Page",
      "Meet the Team",
      "Testimonials",
      "Photos & Media",
      "Promotions",
      "Driving Tips",
      "FAQs",
      "Payment Policy",
      "Site Settings",
    ],
  },
  // "Staff Accounts" is filtered out of this group for non-managers at render time.
  { label: "Admin", items: ["Staff Accounts"] },
  { label: "Support", items: ["Help"] },
];

function Confirm({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-4" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function guard(fn: () => unknown, message: string) {
  try {
    await fn();
    toast.success(message);
  } catch (err) {
    toast.error(errorMessage(err, "Save failed"), { duration: Infinity });
  }
}

function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [identifier, setIdentifier] = useState(""); // email OR display name (for no-email staff)
  const [pw, setPw] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [section, setSection] = useState<SectionName>("Overview");
  const [hasLegacy, setHasLegacy] = useState(false);
  const [migrating, setMigrating] = useState(false);
  // Bridges "Schedule a lesson now" (from the Enroll dialog or a payment's
  // "Schedule lesson" button) into the Schedule tab — set the student to
  // seed the Add Lesson dialog with, then switch tabs to it.
  const [scheduleSeed, setScheduleSeed] = useState<string | null>(null);
  function goToSchedule(studentId: string) {
    setScheduleSeed(studentId);
    setSection("Schedule");
  }

  useEffect(() => {
    setHasLegacy(hasLegacyLocalData());
  }, []);

  // Real Supabase Auth session — persisted across reloads, refreshed
  // automatically, and shared with the reset-password page.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setError("");
    // Staff without a real email sign in with their display name instead —
    // resolve that server-side to the account's actual (possibly
    // placeholder) login email before handing it to Supabase Auth.
    const { email: loginEmail } = await resolveLoginEmail({ data: { identifier } });
    if (!loginEmail) {
      setSigningIn(false);
      const message = "Wrong email/name or password";
      setError(message);
      toast.error(message);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: pw,
    });
    setSigningIn(false);
    if (signInError) {
      const message = signInError.message.toLowerCase().includes("invalid")
        ? "Wrong email/name or password"
        : signInError.message;
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Welcome back");
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetEmail) {
      setError("Enter your email above first");
      return;
    }
    setResetSending(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${origin()}/admin/reset-password`,
    });
    setResetSending(false);
    if (resetError) {
      setError(resetError.message);
      toast.error(resetError.message);
      return;
    }
    setResetSent(true);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSection("Overview");
    toast.success("Signed out");
  }

  async function migrateAll() {
    setMigrating(true);
    try {
      const result = await migrateLocalDataToSupabase();
      const total = Object.values(result).reduce((a, b) => a + b, 0);
      if (total > 0) {
        toast.success(`Moved ${total} item${total === 1 ? "" : "s"} to the database.`);
        window.location.reload();
      } else {
        toast.info("Nothing to move, everything is already in the database.");
        setHasLegacy(false);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not migrate local data."), { duration: Infinity });
    } finally {
      setMigrating(false);
    }
  }

  // Sidebar badge counts — cheap enough to compute here since both
  // collections are already loaded for their own panels.
  const { items: navEnquiries } = useEnquiries();
  const { items: navPayments } = usePayments();
  const { items: navTestimonials } = useTestimonials();
  const { items: navSubmissions } = useSubmissions();
  // Automatic EcoCash/OneMoney/card payments land as "confirmed" straight
  // away (Paynow already verified them) — they never go through "pending",
  // so a badge that only counted "pending" would stay silent for every
  // online payment. Track when this browser last opened the Payments tab
  // and also badge anything newer than that, regardless of status.
  const [paymentsLastSeen, setPaymentsLastSeen] = useState<number>(() => {
    if (typeof window === "undefined") return Date.now();
    const raw = localStorage.getItem(PAYMENTS_LAST_SEEN_KEY);
    if (raw) return Number(raw);
    // First time this runs on a browser, there's no baseline yet — treat
    // "now" as the baseline so it doesn't badge every payment ever taken.
    const now = Date.now();
    localStorage.setItem(PAYMENTS_LAST_SEEN_KEY, String(now));
    return now;
  });
  useEffect(() => {
    if (section !== "Payments") return;
    const now = Date.now();
    localStorage.setItem(PAYMENTS_LAST_SEEN_KEY, String(now));
    setPaymentsLastSeen(now);
  }, [section]);
  const badgeCounts: Partial<Record<SectionName, number>> = {
    Enquiries: navEnquiries.filter((e) => e.status === "new").length,
    Payments: navPayments.filter(
      (p) => p.status === "pending" || new Date(p.createdAt).getTime() > paymentsLastSeen,
    ).length,
    Testimonials: navTestimonials.filter((t) => t.status === "pending").length,
    Tests: navSubmissions.filter((s) => !s.mark).length,
  };

  if (authLoading) {
    return (
      <Section className="flex min-h-[65vh] max-w-md items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </Section>
    );
  }

  if (!session) {
    return (
      <Section className="flex min-h-[65vh] max-w-md items-center">
        <Card className="w-full overflow-hidden border-none py-0 shadow-xl">
          <div className="bg-primary relative px-8 pt-9 pb-10 text-center">
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, var(--primary-foreground) 0 18px, transparent 18px 34px)",
              }}
              aria-hidden
            />
            <Logo showName={false} size={52} className="justify-center" />
            <h1 className="font-display text-primary-foreground mt-4 text-xl font-bold tracking-tight">
              Staff sign-in
            </h1>
            <p className="text-primary-foreground/70 mt-1 text-sm">Auto Driving School admin</p>
          </div>

          <CardContent className="space-y-4 pt-6 pb-8">
            {forgotMode ? (
              resetSent ? (
                <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4 text-center duration-200">
                  <p className="text-sm">
                    If <span className="font-medium">{resetEmail}</span> has an account, we've sent
                    a link to reset the password. Check that inbox (and spam folder).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setForgotMode(false);
                      setResetSent(false);
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleForgotPassword}
                  className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-3 duration-200"
                >
                  <div className="relative">
                    <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="Your work email"
                      aria-label="Your work email"
                      autoFocus
                      className="pl-9"
                    />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" size="lg" className="w-full" disabled={resetSending}>
                    {resetSending ? "Sending…" : "Send reset link"}
                  </Button>
                  <p className="text-muted-foreground text-center text-xs">
                    No email on file? Ask a manager to reset your password from Staff Accounts
                    instead.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setError("");
                    }}
                    className="text-muted-foreground hover:text-foreground block w-full text-center text-xs underline-offset-2 hover:underline"
                  >
                    Back to sign in
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleSignIn} className="animate-in fade-in-0 space-y-3 duration-200">
                <div className="relative">
                  <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError("");
                    }}
                    placeholder="Work email, or your name"
                    aria-label="Work email, or your name"
                    autoFocus
                    autoComplete="username"
                    className="pl-9"
                  />
                </div>
                <div className="relative">
                  <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    type={showPw ? "text" : "password"}
                    value={pw}
                    onChange={(e) => {
                      setPw(e.target.value);
                      setError("");
                    }}
                    placeholder="Password"
                    aria-label="Password"
                    autoComplete="current-password"
                    className="pr-10 pl-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" size="lg" className="w-full" disabled={signingIn}>
                  {signingIn ? "Signing in…" : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(identifier.includes("@") ? identifier : "");
                    setForgotMode(true);
                    setError("");
                  }}
                  className="text-muted-foreground hover:text-foreground block w-full text-center text-xs underline-offset-2 hover:underline"
                >
                  Forgot your password?
                </button>
              </form>
            )}
            <p className="text-muted-foreground text-center text-xs">
              Staff only. Contact the school office if you need an account.
            </p>
          </CardContent>
        </Card>
      </Section>
    );
  }

  const isManager = session.user.app_metadata?.role === "manager";

  return (
    <Section className="max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono text-muted-foreground">Admin</p>
          <h1 className="text-2xl font-bold">{section === "Overview" ? "Dashboard" : section}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-muted-foreground text-sm">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            {session.user.email && (
              <p className="text-muted-foreground/70 text-xs">{session.user.email}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </div>

      {hasLegacy && (
        <Card className="mt-4 border-accent/50 bg-accent/5">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Data saved locally in this browser</p>
              <p className="text-muted-foreground text-sm">
                Packages, testimonials, promotions, tips, FAQs, enquiries, team, payments or site
                content saved here haven't been moved to the shared database yet, they won't show up
                on your phone or any other browser until you move them.
              </p>
            </div>
            <Button onClick={migrateAll} disabled={migrating}>
              {migrating ? "Moving…" : "Move to database"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[230px_1fr] lg:items-start lg:gap-8">
        <nav className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((s) => s !== "Staff Accounts" || isManager);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="label-mono text-muted-foreground/70 px-3 pb-1.5">{group.label}</p>
                <div className="flex flex-wrap gap-1 lg:flex-col">
                  {items.map((s) => {
                    const Icon = NAV_ICONS[s];
                    const count = badgeCounts[s];
                    const active = section === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSection(s)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary text-foreground/90",
                        )}
                      >
                        <Icon
                          className={cn("size-4 shrink-0", !active && "text-muted-foreground")}
                        />
                        <span className="flex-1">{s}</span>
                        {!!count && (
                          <span
                            className={cn(
                              "flex size-4.5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold",
                              active
                                ? "bg-primary-foreground/20"
                                : "bg-accent text-accent-foreground",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="min-w-0">
          {section === "Overview" && <OverviewPanel />}
          {section === "Enquiries" && <EnquiriesPanel onScheduleNow={goToSchedule} />}
          {section === "Students" && <StudentsPanel />}
          {section === "Schedule" && (
            <SchedulePanel
              seedStudentId={scheduleSeed}
              onSeedConsumed={() => setScheduleSeed(null)}
            />
          )}
          {section === "Payments" && <PaymentsPanel onScheduleNow={goToSchedule} />}
          {section === "Tests" && <TestsPanel />}

          {section === "Packages" && <PackagesPanel />}
          {section === "Instructors" && <InstructorsPanel />}
          {section === "About Page" && <AboutPanel />}
          {section === "Meet the Team" && <TeamPanel />}
          {section === "Testimonials" && <TestimonialsPanel />}
          {section === "Photos & Media" && <PhotosPanel />}
          {section === "Promotions" && <PromotionsPanel />}
          {section === "Driving Tips" && <TipsPanel />}
          {section === "FAQs" && <FaqPanel />}
          {section === "Payment Policy" && <PaymentPolicyPanel />}
          {section === "Site Settings" && <SettingsPanel />}
          {section === "Staff Accounts" && isManager && (
            <StaffAccountsPanel
              accessToken={session.access_token}
              currentUserId={session.user.id}
            />
          )}
          {section === "Help" && <HelpPanel />}
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------- enquiries -------------------------------- */

function EnquiriesPanel({ onScheduleNow }: { onScheduleNow: (studentId: string) => void }) {
  const { items, update, remove } = useEnquiries();
  const { items: packages } = usePackages();
  const { items: students } = useStudents();

  const now = Date.now();
  const week = items.filter((e) => now - new Date(e.createdAt).getTime() < 7 * 864e5).length;
  const month = items.filter((e) => now - new Date(e.createdAt).getTime() < 30 * 864e5).length;
  const taken = bookedSlotKeys(items);
  /** Slot keys claimed by more than one live enquiry. */
  const duplicate = (() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const e of items) {
      for (const d of e.days) {
        for (const s of e.slots ?? []) {
          const k = slotKey(d, s);
          if (!taken.has(k)) continue;
          if (seen.has(k)) dupes.add(k);
          seen.add(k);
        }
      }
    }
    return dupes;
  })();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="label-mono text-muted-foreground">This week</p>
            <p className="font-mono text-3xl font-bold">{week}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="label-mono text-muted-foreground">This month</p>
            <p className="font-mono text-3xl font-bold">{month}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="label-mono text-muted-foreground">Booked slots (held by live enquiries)</p>
          {taken.size === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">Nothing booked yet.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...taken].sort().map((k) => (
                <span
                  key={k}
                  className="bg-secondary rounded-full border px-3 py-1 font-mono text-xs"
                >
                  {k.replace("|", " ")}
                </span>
              ))}
            </div>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Setting an enquiry to Completed or Cancelled frees its slots for new bookings.
          </p>
        </CardContent>
      </Card>

      {items.length === 0 && <p className="text-muted-foreground text-sm">No enquiries yet.</p>}
      {items.map((e) => {
        const clashing = (e.slots ?? []).some((s) =>
          e.days.some((d) => duplicate.has(slotKey(d, s))),
        );
        const student = students.find(
          (s) => s.enquiryId === e.id || s.phone.replace(/\D/g, "") === e.phone.replace(/\D/g, ""),
        );
        return (
          <Card key={e.id} className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
              <div>
                <p className="font-semibold">
                  {e.name} · <span className="font-mono text-sm">{e.phone}</span>
                  {e.ref && (
                    <span className="text-muted-foreground ml-2 font-mono text-xs">{e.ref}</span>
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {packages.find((p) => p.id === e.packageId)?.name ?? "-"} ·{" "}
                  {e.days.join(", ") || "any day"} · {e.times.join(", ") || "any time"}
                  {e.slots?.length ? ` · slots: ${e.slots.join(", ")}` : ""}
                </p>
                {clashing && (
                  <p className="text-destructive mt-1 text-xs">
                    Overlaps another live booking, confirm the time with the learner.
                  </p>
                )}
                <div className="mt-3">
                  <ChipGroup
                    size="sm"
                    ariaLabel="Enquiry status"
                    value={e.status}
                    options={ENQUIRY_STATUSES}
                    onChange={(v) => guard(() => update(e.id, { status: v }), "Status updated")}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {student && (
                  <span className="text-success text-xs font-medium">Already enrolled</span>
                )}
                <EnquiryDetailDialog
                  enquiry={e}
                  packages={packages}
                  student={student}
                  onScheduleNow={onScheduleNow}
                />
                <Confirm
                  label="enquiry"
                  onConfirm={() => guard(() => remove(e.id), "Enquiry deleted")}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------- enquiry detail dialog -------------------------- */

/** Full enquiry view — see every field, send a prefilled follow-up on
 *  WhatsApp, and go straight from the enquiry into a scheduled lesson
 *  (enrolling first if they're not a student yet) without leaving this
 *  dialog. */
function EnquiryDetailDialog({
  enquiry: e,
  packages,
  student,
  onScheduleNow,
}: {
  enquiry: Enquiry;
  packages: Package[];
  student: Student | undefined;
  onScheduleNow: (studentId: string) => void;
}) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const pkg = packages.find((p) => p.id === e.packageId);

  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open) return;
    setMessage(
      renderTemplate(settings.waEnquiryFollowUpTemplate, {
        name: e.name,
        phone: e.phone,
        package: pkg ? `${pkg.name} ($${pkg.price})` : "-",
        days: e.days.join(", ") || "any day",
        times: e.times.join(", ") || "any time",
        slots: e.slots?.join(", ") || "flexible",
        ref: e.ref ?? "",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="size-4" /> View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{e.name}</DialogTitle>
          <DialogDescription>
            {e.ref && <span className="font-mono">{e.ref}</span>} · Enquired{" "}
            {new Date(e.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label-mono text-muted-foreground">Phone</p>
              <p className="font-mono">{e.phone}</p>
            </div>
            <div>
              <p className="label-mono text-muted-foreground">Status</p>
              <p className="capitalize">{e.status}</p>
            </div>
            <div>
              <p className="label-mono text-muted-foreground">Package</p>
              <p>{pkg ? `${pkg.name} ($${pkg.price})` : "-"}</p>
            </div>
            <div>
              <p className="label-mono text-muted-foreground">Preferred days</p>
              <p>{e.days.join(", ") || "any day"}</p>
            </div>
            <div>
              <p className="label-mono text-muted-foreground">Preferred time of day</p>
              <p>{e.times.join(", ") || "any time"}</p>
            </div>
            <div>
              <p className="label-mono text-muted-foreground">Preferred slots</p>
              <p>{e.slots?.join(", ") || "flexible"}</p>
            </div>
          </div>

          <div className="grid gap-2 border-t pt-3">
            <Label htmlFor="enq-msg">Follow-up message</Label>
            <Textarea
              id="enq-msg"
              rows={7}
              className="font-mono text-xs"
              value={message}
              onChange={(ev) => setMessage(ev.target.value)}
            />
            <p className="text-muted-foreground text-xs">Edit anything before you send it.</p>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button className="bg-success text-success-foreground hover:bg-success/90" asChild>
            <a href={waLink(e.phone, message)} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> Send message
            </a>
          </Button>
          {student ? (
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                onScheduleNow(student.id);
              }}
            >
              <CalendarClock className="size-4" /> Schedule a lesson
            </Button>
          ) : (
            <EnrollDialog
              trigger={
                <Button variant="outline">
                  <UserPlus className="size-4" /> Convert to schedule
                </Button>
              }
              initialName={e.name}
              initialPhone={e.phone}
              initialPackageId={e.packageId}
              enquiry={e}
              onScheduleNow={(created) => {
                setOpen(false);
                onScheduleNow(created.id);
              }}
            />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- packages -------------------------------- */

const PACKAGE_LESSON_TYPES: { value: string; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "driving", label: "Driving only" },
  { value: "provisional", label: "Provisional only" },
];

function PackagesPanel() {
  const { items, add, update, remove } = usePackages();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          guard(() => {
            const created = add({
              slug: "new-package-" + Date.now(),
              name: "New package",
              price: 0,
              lessons: undefined,
              description: "",
              includes: [],
              featured: false,
              showOnHome: true,
              isCombo: false,
            });
            setJustCreatedId(created.id);
          }, "Package added")
        }
      >
        <Plus className="size-4" /> Add package
      </Button>
      {items.map((p) => (
        <PackageCard
          key={p.id}
          pkg={p}
          update={update}
          remove={remove}
          defaultOpen={p.id === justCreatedId}
        />
      ))}
    </div>
  );
}

/** A one-bullet-per-line textarea. Keeps its own raw text as local state so an
 *  in-progress blank line (from pressing Enter) isn't immediately stripped by
 *  the parent's filtered array — only synced back up on blur. */
function IncludesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (includes: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));

  return (
    <Textarea
      rows={4}
      placeholder={"e.g.\n8 driving lessons\nDual-control vehicle\nYard practice"}
      value={text}
      onChange={(ev) => setText(ev.target.value)}
      onBlur={() => {
        const includes = text
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        setText(includes.join("\n"));
        onChange(includes);
      }}
    />
  );
}

function PackageCard({
  pkg: p,
  update,
  remove,
  defaultOpen = false,
}: {
  pkg: Package;
  update: (id: string, patch: Partial<Package>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {p.name.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="block truncate font-semibold">{p.name || "Untitled package"}</span>
            {p.featured && (
              <Badge className="bg-primary/10 text-primary shrink-0 border-none font-mono text-[0.6rem] font-bold tracking-wide uppercase">
                Popular
              </Badge>
            )}
            {p.isCombo && (
              <Badge className="bg-accent/10 text-accent shrink-0 border-none font-mono text-[0.6rem] font-bold tracking-wide uppercase">
                Combo
              </Badge>
            )}
          </span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>${p.price}</span>
            {!!p.lessons && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {p.lessons} lesson{p.lessons === 1 ? "" : "s"}
                </span>
              </>
            )}
            {p.lessonType && (
              <>
                <span aria-hidden>·</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[0.65rem] font-medium capitalize"
                >
                  {p.lessonType} only
                </Badge>
              </>
            )}
            {p.showOnHome === false && (
              <>
                <span aria-hidden>·</span>
                <span className="text-muted-foreground/80">Hidden from home</span>
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
        <CardContent className="grid gap-3 border-t pt-5 pb-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={p.name}
              onChange={(ev) =>
                update(p.id, { name: ev.target.value, slug: slugify(ev.target.value) })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Price (USD)</Label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium">
                $
              </span>
              <Input
                type="number"
                value={p.price}
                onChange={(ev) => update(p.id, { price: Number(ev.target.value) })}
                className="pl-7"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Lessons (optional)</Label>
            <Input
              type="number"
              placeholder="Leave blank if not applicable"
              value={p.lessons ?? ""}
              onChange={(ev) =>
                update(p.id, {
                  lessons: ev.target.value === "" ? undefined : Number(ev.target.value),
                })
              }
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Lesson type</Label>
            <ChipGroup
              size="sm"
              value={p.lessonType ?? "any"}
              options={PACKAGE_LESSON_TYPES}
              onChange={(v) =>
                update(p.id, { lessonType: v === "any" ? undefined : (v as LessonType) })
              }
            />
            <p className="text-muted-foreground text-xs">
              Lock this to Provisional or Driving to have lessons booked under it default to that
              type automatically. Leave on "Any" for a general bundle.
            </p>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>What's included (one per line)</Label>
            <IncludesEditor
              value={p.includes}
              onChange={(includes) => update(p.id, { includes })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={p.description}
              onChange={(ev) => update(p.id, { description: ev.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label className="text-sm">Most popular</Label>
              <p className="text-muted-foreground text-xs">
                Highlights this package and badges it as "Most popular" wherever packages are shown.
                Only mark one package at a time.
              </p>
            </div>
            <Switch
              checked={!!p.featured}
              onCheckedChange={(checked) => update(p.id, { featured: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label className="text-sm">Show on homepage</Label>
              <p className="text-muted-foreground text-xs">
                Appears in the packages preview on the homepage, before someone clicks "See all
                packages".
              </p>
            </div>
            <Switch
              checked={p.showOnHome !== false}
              onCheckedChange={(checked) => update(p.id, { showOnHome: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 sm:col-span-2">
            <div>
              <Label className="text-sm">Combo package</Label>
              <p className="text-muted-foreground text-xs">
                For bundles that combine lesson types or multiple packages, gives it its own
                distinct card style wherever packages are shown.
              </p>
            </div>
            <Switch
              checked={!!p.isCombo}
              onCheckedChange={(checked) => update(p.id, { isCombo: checked })}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={() => toast.success("Package saved")}>
              Save
            </Button>
            <Confirm
              label={p.name}
              onConfirm={() => guard(() => remove(p.id), "Package deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------------------- instructors ------------------------------- */

function InstructorsPanel() {
  const { items, add, update, remove } = useInstructors();
  const [hasLegacy, setHasLegacy] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  useEffect(() => {
    setHasLegacy(hasLegacyLocalInstructors());
  }, []);

  async function migrate() {
    setMigrating(true);
    try {
      const { migrated } = await migrateLocalInstructorsToSupabase();
      if (migrated > 0) {
        toast.success(`Moved ${migrated} instructor${migrated === 1 ? "" : "s"} to the database.`);
        window.location.reload();
      } else {
        toast.info("Nothing to move, instructors are already in the database.");
        setHasLegacy(false);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not migrate instructors."));
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="space-y-4">
      {hasLegacy && items.length === 0 && (
        <Card className="border-accent/50 bg-accent/5">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Instructors saved locally in this browser</p>
              <p className="text-muted-foreground text-sm">
                Move them to the shared database so the Schedule tab and instructor lesson lookups
                work from any device, not just this one.
              </p>
            </div>
            <Button onClick={migrate} disabled={migrating}>
              {migrating ? "Moving…" : "Move to database"}
            </Button>
          </CardContent>
        </Card>
      )}
      <Button
        onClick={() =>
          guard(() => {
            const created = add({
              slug: "new-instructor-" + Date.now(),
              name: "New instructor",
              years: 1,
              languages: "English",
              bio: "",
            });
            setJustCreatedId(created.id);
          }, "Instructor added")
        }
      >
        <Plus className="size-4" /> Add instructor
      </Button>
      {items.map((ins) => (
        <InstructorCard
          key={ins.id}
          instructor={ins}
          update={update}
          remove={remove}
          defaultOpen={ins.id === justCreatedId}
        />
      ))}
    </div>
  );
}

function InstructorCard({
  instructor: ins,
  update,
  remove,
  defaultOpen = false,
}: {
  instructor: Instructor;
  update: (id: string, patch: Partial<Instructor>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        {ins.photo ? (
          <img
            src={ins.photo}
            alt={ins.name}
            className="size-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
            {ins.name.charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{ins.name || "Untitled instructor"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>
              {ins.years} yr{ins.years === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span className="truncate">{ins.languages || "No languages set"}</span>
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
            <Label>Name</Label>
            <Input
              value={ins.name}
              onChange={(e) =>
                update(ins.id, { name: e.target.value, slug: slugify(e.target.value) })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Years experience</Label>
            <Input
              type="number"
              value={ins.years}
              onChange={(e) => update(ins.id, { years: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Languages</Label>
            <Input
              value={ins.languages}
              onChange={(e) => update(ins.id, { languages: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Bio</Label>
            <Textarea
              rows={4}
              value={ins.bio}
              onChange={(e) => update(ins.id, { bio: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Photo</Label>
            {ins.photo && (
              <FramedPhoto src={ins.photo} alt={ins.name} className="mb-3 h-32 rounded-lg" />
            )}
            <ImageUploader
              label="Upload instructor photo"
              onUpload={async (files) =>
                update(ins.id, { photo: await uploadPhotoToStorage(files[0].file) })
              }
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>WhatsApp number</Label>
            <Input
              value={ins.phone ?? ""}
              onChange={(e) => update(ins.id, { phone: e.target.value })}
              placeholder="e.g. 077XXXXXXX, needed for the Share button below"
            />
          </div>
          <InstructorPinField
            instructorId={ins.id}
            instructorName={ins.name}
            instructorPhone={ins.phone}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={() => toast.success("Instructor saved")}>
              Save
            </Button>
            <Confirm
              label={ins.name}
              onConfirm={() => guard(() => remove(ins.id), "Instructor deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/** PIN this instructor uses at /my-lessons to check their own schedule.
 *  Saved on blur — the PIN itself lives in a separate, non-public table
 *  (see supabase/005_lesson_lookup.sql), never in the instructors row.
 *  The admin panel can only ever see whether a PIN is set, not what it
 *  is — instructor_has_pin() returns a boolean, never the PIN itself.
 *  That means the "share via WhatsApp" button below only works for a few
 *  seconds right after saving/changing a PIN, while it's still sitting in
 *  this component's memory — refresh the page and it's gone, by design. */
function InstructorPinField({
  instructorId,
  instructorName,
  instructorPhone,
}: {
  instructorId: string;
  instructorName: string;
  instructorPhone?: string;
}) {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [justSetPin, setJustSetPin] = useState<string | null>(null);

  useEffect(() => {
    instructorHasPin(instructorId)
      .then(setHasPin)
      .catch(() => setHasPin(null));
  }, [instructorId]);

  async function save() {
    const trimmed = pin.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await setInstructorPin(instructorId, trimmed);
      setJustSetPin(trimmed);
      setPin("");
      setHasPin(true);
      toast.success("PIN saved");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save PIN."));
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setSaving(true);
    try {
      await clearInstructorPin(instructorId);
      setHasPin(false);
      setJustSetPin(null);
      toast.success("PIN cleared");
    } catch (err) {
      toast.error(errorMessage(err, "Could not clear PIN."));
    } finally {
      setSaving(false);
    }
  }

  const shareMessage = justSetPin
    ? `Hi ${instructorName}, here's how to check your Auto Driving School schedule:\n${origin()}/my-lessons\nUse your name and this PIN: ${justSetPin}`
    : "";

  return (
    <div className="grid gap-2 sm:col-span-2">
      <div className="flex items-center gap-2">
        <Label>Schedule PIN</Label>
        {hasPin === true && (
          <Badge variant="secondary" className="text-xs">
            PIN set
          </Badge>
        )}
        {hasPin === false && (
          <Badge variant="outline" className="text-xs">
            No PIN yet
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder={hasPin ? "Enter a new PIN to change it" : "e.g. 4821"}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onBlur={save}
          className="max-w-32"
        />
        <Button size="sm" variant="outline" onClick={save} disabled={saving || !pin.trim()}>
          {saving ? "Saving…" : hasPin ? "Change PIN" : "Save PIN"}
        </Button>
        {hasPin && (
          <Button size="sm" variant="ghost" onClick={clear} disabled={saving}>
            Clear
          </Button>
        )}
      </div>
      {justSetPin &&
        (instructorPhone ? (
          <Button
            size="sm"
            className="bg-success text-success-foreground hover:bg-success/90 w-fit"
            asChild
          >
            <a href={waLink(instructorPhone, shareMessage)} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> Send this PIN on WhatsApp
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareMessage);
                toast.success("Message copied, paste it wherever you're messaging them");
              } catch {
                toast.error(
                  "Could not copy, add a WhatsApp number above for a one-tap send instead",
                );
              }
            }}
          >
            <MessageCircle className="size-4" /> Copy message to send (add a WhatsApp number above
            for one-tap send)
          </Button>
        ))}
      <p className="text-muted-foreground text-xs">
        Share this with the instructor along with the /my-lessons link so they can check their own
        schedule. For security, saved PINs can't be viewed again here, only changed or cleared.
      </p>
    </div>
  );
}

/* ------------------------------- testimonials ------------------------------ */

function TestimonialsPanel() {
  const { items, add, update, remove } = useTestimonials();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          guard(() => {
            const created = add({
              name: "New review",
              rating: 5,
              comment: "",
              status: "pending",
              createdAt: new Date().toISOString(),
            });
            setJustCreatedId(created.id);
          }, "Testimonial added")
        }
      >
        <Plus className="size-4" /> Add testimonial
      </Button>
      {items.map((t) => (
        <TestimonialCard
          key={t.id}
          testimonial={t}
          update={update}
          remove={remove}
          defaultOpen={t.id === justCreatedId}
        />
      ))}
    </div>
  );
}

function TestimonialCard({
  testimonial: t,
  update,
  remove,
  defaultOpen = false,
}: {
  testimonial: Testimonial;
  update: (id: string, patch: Partial<Testimonial>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {t.name.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{t.name || "Untitled review"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>{t.rating}/5 ★</span>
            <span aria-hidden>·</span>
            <Badge
              variant={t.status === "published" ? "secondary" : "outline"}
              className="text-[0.65rem]"
            >
              {t.status === "published" ? "Published" : "Pending"}
            </Badge>
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
            <Label>Name</Label>
            <Input value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Rating (1-5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={t.rating}
              onChange={(e) => update(t.id, { rating: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Comment</Label>
            <Textarea
              value={t.comment}
              onChange={(e) => update(t.id, { comment: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <ChipGroup
              size="sm"
              value={t.status}
              options={[
                { value: "pending", label: "Pending" },
                { value: "published", label: "Published" },
              ]}
              onChange={(v) => guard(() => update(t.id, { status: v as never }), "Status updated")}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => toast.success("Testimonial saved")}>
              Save
            </Button>
            <Confirm
              label="testimonial"
              onConfirm={() => guard(() => remove(t.id), "Testimonial deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ---------------------------------- photos --------------------------------- */

function PhotosPanel() {
  const { items, addMany, update, remove } = usePhotos();
  const [category, setCategory] = useState<PhotoCategory>("gallery");

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Label>Upload to category</Label>
          <ChipGroup
            value={category}
            options={PHOTO_CATEGORIES}
            onChange={(v) => setCategory(v as PhotoCategory)}
          />

          <ImageUploader
            multiple
            label="Drag & drop photos, or click to browse"
            onUpload={async (files) => {
              const uploaded = await Promise.all(
                files.map(async (f) => ({
                  src: await uploadPhotoToStorage(f.file),
                  caption: f.name.replace(/\.[^.]+$/, ""),
                  category,
                  status: "pending" as const,
                  createdAt: new Date().toISOString(),
                })),
              );
              addMany(uploaded);
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((p) => (
          <Card key={p.id}>
            <FramedPhoto src={p.src} alt={p.caption} className="h-40 w-full rounded-t-xl" />
            <CardContent className="space-y-3 pt-4">
              <Input
                value={p.caption}
                onChange={(e) => update(p.id, { caption: e.target.value })}
              />
              <div className="grid gap-3">
                <ChipGroup
                  size="sm"
                  value={p.category}
                  options={PHOTO_CATEGORIES}
                  onChange={(v) => update(p.id, { category: v as PhotoCategory })}
                />
                <ChipGroup
                  size="sm"
                  value={p.status}
                  options={[
                    { value: "pending", label: "Pending Review" },
                    { value: "published", label: "Published" },
                  ]}
                  onChange={(v) => update(p.id, { status: v as never })}
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => toast.success("Photo saved")}>
                  Save
                </Button>
                <Confirm
                  label="photo"
                  onConfirm={() => guard(() => remove(p.id), "Photo deleted")}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- promotions ------------------------------- */

function PromotionsPanel() {
  const { items, add, update, remove } = usePromotions();
  const { items: packages } = usePackages();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          guard(() => {
            const created = add({
              title: "New promotion",
              description: "",
              startDate: new Date().toISOString().slice(0, 10),
              endDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
              status: "active" as const,
            });
            setJustCreatedId(created.id);
          }, "Promotion added")
        }
      >
        <Plus className="size-4" /> Add promotion
      </Button>
      {items.map((p) => (
        <PromotionCard
          key={p.id}
          promotion={p}
          packages={packages}
          update={update}
          remove={remove}
          defaultOpen={p.id === justCreatedId}
        />
      ))}
    </div>
  );
}

function PromotionCard({
  promotion: p,
  packages,
  update,
  remove,
  defaultOpen = false,
}: {
  promotion: Promotion;
  packages: Package[];
  update: (id: string, patch: Partial<Promotion>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {p.title.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{p.title || "Untitled promotion"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>
              {p.startDate} – {p.endDate}
            </span>
            <span aria-hidden>·</span>
            <Badge
              variant={p.status === "active" ? "secondary" : "outline"}
              className="text-[0.65rem]"
            >
              {p.status === "active" ? "Active" : "Expired"}
            </Badge>
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
          <div className="grid gap-2 sm:col-span-2">
            <Label>Title</Label>
            <Input value={p.title} onChange={(e) => update(p.id, { title: e.target.value })} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={p.description}
              onChange={(e) => update(p.id, { description: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Starts</Label>
            <Input
              type="date"
              value={p.startDate}
              onChange={(e) => update(p.id, { startDate: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Ends</Label>
            <Input
              type="date"
              value={p.endDate}
              onChange={(e) => update(p.id, { endDate: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Linked package</Label>
            <ChipGroup
              size="sm"
              value={p.packageId ?? "none"}
              options={[
                { value: "none", label: "None" },
                ...packages.map((pk) => ({ value: pk.id, label: pk.name })),
              ]}
              onChange={(v) => update(p.id, { packageId: v === "none" ? undefined : v })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Promo price (USD)</Label>
            <Input
              type="number"
              value={p.promoPrice ?? ""}
              onChange={(e) =>
                update(p.id, {
                  promoPrice: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <ChipGroup
              size="sm"
              value={p.status}
              options={[
                { value: "active", label: "Active" },
                { value: "expired", label: "Expired" },
              ]}
              onChange={(v) => update(p.id, { status: v as never })}
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-2 block">Flyer (image or PDF)</Label>
            {p.flyer && !p.flyer.startsWith("data:application/pdf") && (
              <FramedPhoto src={p.flyer} alt={p.title} className="mb-3 h-32 rounded-lg" />
            )}
            <ImageUploader
              allowPdf
              label="Upload flyer"
              onUpload={async (files) =>
                update(p.id, {
                  flyer: await uploadPhotoToStorage(files[0].file),
                  flyerName: files[0].name,
                })
              }
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={() => toast.success("Promotion saved")}>
              Save
            </Button>
            <Confirm
              label={p.title}
              onConfirm={() => guard(() => remove(p.id), "Promotion deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ----------------------------------- tips ---------------------------------- */

function TipsPanel() {
  const { items, add, update, remove } = useTips();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          guard(() => {
            const created = add({ title: "New tip", body: "" });
            setJustCreatedId(created.id);
          }, "Tip added")
        }
      >
        <Plus className="size-4" /> Add tip
      </Button>
      {items.map((t) => (
        <TipCard
          key={t.id}
          tip={t}
          update={update}
          remove={remove}
          defaultOpen={t.id === justCreatedId}
        />
      ))}
    </div>
  );
}

function TipCard({
  tip: t,
  update,
  remove,
  defaultOpen = false,
}: {
  tip: Tip;
  update: (id: string, patch: Partial<Tip>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {t.title.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{t.title || "Untitled tip"}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {t.body ? t.body.slice(0, 60) : "No body yet"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t pt-5 pb-6">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Body</Label>
            <Textarea
              rows={4}
              value={t.body}
              onChange={(e) => update(t.id, { body: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-2 block">Attachment (image or PDF)</Label>
            <ImageUploader
              allowPdf
              label="Upload attachment"
              onUpload={async (files) =>
                update(t.id, {
                  attachment: await uploadPhotoToStorage(files[0].file),
                  attachmentName: files[0].name,
                  attachmentType: files[0].type,
                })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => toast.success("Tip saved")}>
              Save
            </Button>
            <Confirm label={t.title} onConfirm={() => guard(() => remove(t.id), "Tip deleted")} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ----------------------------------- faqs ---------------------------------- */

const FAQ_CATEGORIES = ["Licensing", "Lessons", "Logistics"];

function FaqPanel() {
  const { items, add, update, remove } = useFaqs();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          guard(() => {
            const created = add({ category: "Lessons", question: "New question", answer: "" });
            setJustCreatedId(created.id);
          }, "Question added")
        }
      >
        <Plus className="size-4" /> Add question
      </Button>
      {items.map((f) => (
        <FaqCard
          key={f.id}
          faq={f}
          update={update}
          remove={remove}
          defaultOpen={f.id === justCreatedId}
        />
      ))}
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No FAQs yet — add your first question above. These show up on the public /faq page,
          grouped by category.
        </p>
      )}
    </div>
  );
}

function FaqCard({
  faq: f,
  update,
  remove,
  defaultOpen = false,
}: {
  faq: Faq;
  update: (id: string, patch: Partial<Faq>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {f.question.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{f.question || "Untitled question"}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {f.category} · {f.answer ? f.answer.slice(0, 50) : "No answer yet"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t pt-5 pb-6">
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => update(f.id, { category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAQ_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Question</Label>
            <Input
              value={f.question}
              onChange={(e) => update(f.id, { question: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Answer</Label>
            <Textarea
              rows={4}
              value={f.answer}
              onChange={(e) => update(f.id, { answer: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => toast.success("Question saved")}>
              Save
            </Button>
            <Confirm
              label={f.question}
              onConfirm={() => guard(() => remove(f.id), "Question deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ----------------------------- payment policy ------------------------------ */

function PaymentPolicyPanel() {
  const { content, save } = usePaymentPolicy();
  const [justCreatedIndex, setJustCreatedIndex] = useState<number | null>(null);

  const updateSection = (i: number, patch: Partial<PolicySection>) => {
    save({ sections: content.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  };

  const removeSection = (i: number) => {
    save({ sections: content.sections.filter((_, j) => j !== i) });
  };

  const moveSection = (i: number, direction: -1 | 1) => {
    const j = i + direction;
    if (j < 0 || j >= content.sections.length) return;
    const next = [...content.sections];
    [next[i], next[j]] = [next[j], next[i]];
    save({ sections: next });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <p className="text-muted-foreground text-sm">
            This is the Payment & Anti-Fraud Policy shown at the bottom of the Packages & Pricing
            page. Edit the intro below, or the numbered clauses further down, any time it needs to
            change, there's no need for a code change.
          </p>
          <div className="grid gap-2">
            <Label>Eyebrow (small label above the heading)</Label>
            <Input value={content.eyebrow} onChange={(e) => save({ eyebrow: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Heading</Label>
            <Input value={content.heading} onChange={(e) => save({ heading: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Subtitle</Label>
            <Textarea
              rows={2}
              value={content.subtitle}
              onChange={(e) => save({ subtitle: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Callout box text (shown above the clauses)</Label>
            <Textarea
              rows={3}
              value={content.noticeText}
              onChange={(e) => save({ noticeText: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">Numbered clauses</h2>
        <Button
          size="sm"
          onClick={() =>
            guard(() => {
              save({
                sections: [...content.sections, { title: "New clause", body: "" }],
              });
              setJustCreatedIndex(content.sections.length);
            }, "Clause added")
          }
        >
          <Plus className="size-4" /> Add clause
        </Button>
      </div>

      {content.sections.length === 0 && (
        <p className="text-muted-foreground text-sm">No clauses yet, add the first one above.</p>
      )}

      {content.sections.map((s, i) => (
        <PolicyClauseCard
          key={i}
          section={s}
          index={i}
          total={content.sections.length}
          update={(patch) => updateSection(i, patch)}
          remove={() => guard(() => removeSection(i), "Clause deleted")}
          moveUp={() => moveSection(i, -1)}
          moveDown={() => moveSection(i, 1)}
          defaultOpen={i === justCreatedIndex}
        />
      ))}
    </div>
  );
}

function PolicyClauseCard({
  section: s,
  index,
  total,
  update,
  remove,
  moveUp,
  moveDown,
  defaultOpen = false,
}: {
  section: PolicySection;
  index: number;
  total: number;
  update: (patch: Partial<PolicySection>) => void;
  remove: () => void;
  moveUp: () => void;
  moveDown: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s.title || "Untitled clause"}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {s.body ? s.body.replace(/\n+/g, " ").slice(0, 60) : "No text yet"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t pt-5 pb-6">
          <div className="grid gap-2">
            <Label>Clause title</Label>
            <Input value={s.title} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Clause text (leave a blank line between paragraphs)</Label>
            <Textarea rows={6} value={s.body} onChange={(e) => update({ body: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => toast.success("Clause saved")}>
              Save
            </Button>
            <Button size="sm" variant="outline" disabled={index === 0} onClick={moveUp}>
              <ArrowUp className="size-4" /> Move up
            </Button>
            <Button size="sm" variant="outline" disabled={index === total - 1} onClick={moveDown}>
              <ArrowDown className="size-4" /> Move down
            </Button>
            <Confirm label={s.title || "this clause"} onConfirm={remove} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* --------------------------------- settings -------------------------------- */

function SettingsPanel() {
  const { settings, save } = useSettings();
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Phone</Label>
          <Input value={settings.phone} onChange={(e) => save({ phone: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>WhatsApp number</Label>
          <Input value={settings.whatsapp} onChange={(e) => save({ whatsapp: e.target.value })} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Address</Label>
          <Input value={settings.address} onChange={(e) => save({ address: e.target.value })} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Opening hours</Label>
          <Input value={settings.hours} onChange={(e) => save({ hours: e.target.value })} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Home headline</Label>
          <Input value={settings.headline} onChange={(e) => save({ headline: e.target.value })} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Home tagline</Label>
          <Textarea value={settings.tagline} onChange={(e) => save({ tagline: e.target.value })} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: general enquiry links</Label>
          <Textarea
            rows={2}
            value={settings.waGeneralTemplate}
            onChange={(e) => save({ waGeneralTemplate: e.target.value })}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: booking confirmation</Label>
          <Textarea
            rows={9}
            className="font-mono text-xs"
            value={settings.waBookingTemplate}
            onChange={(e) => save({ waBookingTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {BOOKING_TEMPLATE_TOKENS.join(" ")}, learners can review and edit the message
            before sending.
          </p>
          <div className="bg-secondary/60 rounded-lg border p-3">
            <p className="label-mono text-muted-foreground mb-2">Preview</p>
            <pre className="text-xs whitespace-pre-wrap">
              {renderTemplate(settings.waBookingTemplate, {
                ref: "ADS-7K3Q9",
                name: "Thandeka M.",
                phone: "078 000 0000",
                package: "Full Course ($280)",
                days: "Mon, Wed",
                times: "Morning",
                slots: "08:30",
              })}
            </pre>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>EcoCash number</Label>
          <Input
            value={settings.ecocashNumber}
            onChange={(e) => save({ ecocashNumber: e.target.value })}
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: payment submitted</Label>
          <Textarea
            rows={6}
            className="font-mono text-xs"
            value={settings.waPaymentTemplate}
            onChange={(e) => save({ waPaymentTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {PAYMENT_TEMPLATE_TOKENS.join(" ")}
          </p>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: welcome (sent on enrolment)</Label>
          <Textarea
            rows={7}
            className="font-mono text-xs"
            value={settings.waWelcomeTemplate}
            onChange={(e) => save({ waWelcomeTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {WELCOME_TEMPLATE_TOKENS.join(" ")}
          </p>
          <div className="bg-secondary/60 rounded-lg border p-3">
            <p className="label-mono text-muted-foreground mb-2">Preview</p>
            <pre className="text-xs whitespace-pre-wrap">
              {renderTemplate(settings.waWelcomeTemplate, {
                name: "Thandeka M.",
                phone: "078 000 0000",
                package: "Full Course ($280)",
                days: "Mon, Wed",
                times: "Morning",
                ref: "ADS-7K3Q9",
              })}
            </pre>
          </div>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: lesson booked, to instructor</Label>
          <Textarea
            rows={5}
            className="font-mono text-xs"
            value={settings.waInstructorLessonTemplate}
            onChange={(e) => save({ waInstructorLessonTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {INSTRUCTOR_LESSON_TEMPLATE_TOKENS.join(" ")}
          </p>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: lesson booked, to student</Label>
          <Textarea
            rows={5}
            className="font-mono text-xs"
            value={settings.waStudentLessonTemplate}
            onChange={(e) => save({ waStudentLessonTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {STUDENT_LESSON_TEMPLATE_TOKENS.join(" ")}
          </p>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: enquiry follow-up</Label>
          <Textarea
            rows={6}
            className="font-mono text-xs"
            value={settings.waEnquiryFollowUpTemplate}
            onChange={(e) => save({ waEnquiryFollowUpTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {ENQUIRY_FOLLOWUP_TEMPLATE_TOKENS.join(" ")}, used by "Send message" on the
            Enquiries tab.
          </p>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label>WhatsApp message: weekly plan (student &amp; instructor)</Label>
          <Textarea
            rows={6}
            className="font-mono text-xs"
            value={settings.waWeeklyPlanTemplate}
            onChange={(e) => save({ waWeeklyPlanTemplate: e.target.value })}
          />
          <p className="text-muted-foreground text-xs">
            Tokens: {WEEKLY_PLAN_TEMPLATE_TOKENS.join(" ")}, {"{schedule}"} is the full list of
            days/times, filled in automatically.
          </p>
        </div>

        {settings.stats.map((s, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:col-span-2">
            <Input
              value={s.value}
              onChange={(e) => {
                const stats = settings.stats.map((x, j) =>
                  j === i ? { ...x, value: e.target.value } : x,
                );
                save({ stats });
              }}
            />
            <Input
              value={s.label}
              onChange={(e) => {
                const stats = settings.stats.map((x, j) =>
                  j === i ? { ...x, label: e.target.value } : x,
                );
                save({ stats });
              }}
            />
          </div>
        ))}

        <div className="grid gap-3 sm:col-span-2">
          <Label>Trust strip (shown under the homepage hero)</Label>
          {settings.trustStrip.map((item, i) => (
            <div key={i} className="grid grid-cols-[9rem_1fr] gap-2">
              <Select
                value={item.icon}
                onValueChange={(value) => {
                  const trustStrip = settings.trustStrip.map((x, j) =>
                    j === i ? { ...x, icon: value as TrustIconKey } : x,
                  );
                  save({ trustStrip });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRUST_ICONS) as TrustIconKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {TRUST_ICON_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.text}
                onChange={(e) => {
                  const trustStrip = settings.trustStrip.map((x, j) =>
                    j === i ? { ...x, text: e.target.value } : x,
                  );
                  save({ trustStrip });
                }}
              />
            </div>
          ))}
        </div>

        <div className="sm:col-span-2">
          <Button size="sm" onClick={() => toast.success("Settings saved")}>
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- about page ------------------------------- */

function AboutPanel() {
  const { content, save } = useAboutContent();
  const { items: sections, append, update, remove, move } = useAboutSections();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <div className="grid gap-2">
            <Label>Story section heading</Label>
            <Input
              value={content.storyHeading}
              onChange={(e) => save({ storyHeading: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Story paragraphs (one per line)</Label>
            <Textarea
              rows={8}
              value={content.storyParagraphs.join("\n")}
              onChange={(e) =>
                save({
                  storyParagraphs: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <Button size="sm" onClick={() => toast.success("Story saved")}>
              Save story
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6">
          <h2 className="font-semibold">Why Choose Us cards</h2>
          {content.whyCards.map((card, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <Input
                value={card.title}
                placeholder="Title"
                onChange={(e) =>
                  save({
                    whyCards: content.whyCards.map((c, j) =>
                      j === i ? { ...c, title: e.target.value } : c,
                    ),
                  })
                }
              />
              <Input
                value={card.body}
                placeholder="Short description"
                onChange={(e) =>
                  save({
                    whyCards: content.whyCards.map((c, j) =>
                      j === i ? { ...c, body: e.target.value } : c,
                    ),
                  })
                }
              />
            </div>
          ))}
          <div>
            <Button size="sm" onClick={() => toast.success("Cards saved")}>
              Save cards
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">Custom sections</h2>
        <Button
          size="sm"
          onClick={() =>
            guard(
              () =>
                append({
                  type: "text",
                  heading: "New section",
                  body: "",
                  imagePosition: "left",
                }),
              "Section added",
            )
          }
        >
          <Plus className="size-4" /> Add section
        </Button>
      </div>

      {sections.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No custom sections yet, they'll appear on the About page after "Why Choose Us".
        </p>
      )}

      {sections.map((s, i) => (
        <AboutSectionCard
          key={s.id}
          section={s}
          index={i}
          count={sections.length}
          update={update}
          remove={remove}
          move={move}
        />
      ))}
    </div>
  );
}

function AboutSectionCard({
  section: s,
  index: i,
  count,
  update,
  remove,
  move,
}: {
  section: AboutSection;
  index: number;
  count: number;
  update: (id: string, patch: Partial<AboutSection>) => void;
  remove: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {i + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s.heading || `Section ${i + 1}`}</span>
          <span className="text-muted-foreground mt-0.5 text-xs">
            {s.type === "text" ? "Text only" : s.type === "photo" ? "Photo only" : "Text + Photo"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t pt-5 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-mono text-muted-foreground mr-auto">Section {i + 1}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={i === 0}
              onClick={() => guard(() => move(s.id, -1), "Moved up")}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={i === count - 1}
              onClick={() => guard(() => move(s.id, 1), "Moved down")}
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <ChipGroup
                size="sm"
                value={s.type}
                options={[
                  { value: "text", label: "Text only" },
                  { value: "text-photo", label: "Text + Photo" },
                  { value: "photo", label: "Photo only" },
                ]}
                onChange={(v) => update(s.id, { type: v as AboutSectionType })}
              />
            </div>
            {s.type === "text-photo" && (
              <div className="grid gap-2">
                <Label>Photo position</Label>
                <ChipGroup
                  size="sm"
                  value={s.imagePosition}
                  options={[
                    { value: "left", label: "Left of text" },
                    { value: "right", label: "Right of text" },
                  ]}
                  onChange={(v) => update(s.id, { imagePosition: v as "left" | "right" })}
                />
              </div>
            )}
          </div>

          {s.type !== "photo" && (
            <>
              <div className="grid gap-2">
                <Label>Heading</Label>
                <Input
                  value={s.heading}
                  onChange={(e) => update(s.id, { heading: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Body text</Label>
                <Textarea
                  rows={4}
                  value={s.body}
                  onChange={(e) => update(s.id, { body: e.target.value })}
                />
              </div>
            </>
          )}

          {s.type !== "text" && (
            <div>
              <Label className="mb-2 block">Photo</Label>
              {s.image && (
                <FramedPhoto src={s.image} alt={s.heading} className="mb-3 h-32 rounded-lg" />
              )}
              <ImageUploader
                label="Upload section photo"
                onUpload={async (files) =>
                  update(s.id, { image: await uploadPhotoToStorage(files[0].file) })
                }
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={() => toast.success("Section saved")}>
              Save
            </Button>
            <Confirm
              label="section"
              onConfirm={() => guard(() => remove(s.id), "Section deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* --------------------------------- the team -------------------------------- */

function TeamPanel() {
  const { items, add, update, remove, move } = useTeam();
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Button
        onClick={() =>
          guard(() => {
            const created = add({ name: "New team member", role: "", bio: "" });
            setJustCreatedId(created.id);
          }, "Team member added")
        }
      >
        <Plus className="size-4" /> Add team member
      </Button>
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No team members yet, the "Meet the Team" section stays hidden until you add one.
        </p>
      )}
      {items.length > 1 && (
        <p className="text-muted-foreground text-xs">
          Use the arrows to set the order team members appear in on the About page.
        </p>
      )}
      {items.map((m, i) => (
        <TeamMemberCard
          key={m.id}
          member={m}
          index={i}
          count={items.length}
          update={update}
          remove={remove}
          move={move}
          defaultOpen={m.id === justCreatedId}
        />
      ))}
    </div>
  );
}

function TeamMemberCard({
  member: m,
  index: i,
  count,
  update,
  remove,
  move,
  defaultOpen = false,
}: {
  member: TeamMember;
  index: number;
  count: number;
  update: (id: string, patch: Partial<TeamMember>) => void;
  remove: (id: string) => void;
  move: (id: string, dir: 1 | -1) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-1 px-5 pt-3">
        <span className="label-mono text-muted-foreground mr-1 text-xs">#{i + 1}</span>
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          aria-label="Move up"
          disabled={i === 0}
          onClick={() => move(m.id, -1)}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-7"
          aria-label="Move down"
          disabled={i === count - 1}
          onClick={() => move(m.id, 1)}
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        {m.photo ? (
          <img src={m.photo} alt={m.name} className="size-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
            {m.name.charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{m.name || "Untitled team member"}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {m.role || "No role set"}
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
            <Label>Name</Label>
            <Input value={m.name} onChange={(e) => update(m.id, { name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Input value={m.role} onChange={(e) => update(m.id, { role: e.target.value })} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Short bio</Label>
            <Textarea
              rows={3}
              value={m.bio}
              onChange={(e) => update(m.id, { bio: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Photo</Label>
            {m.photo && <FramedPhoto src={m.photo} alt={m.name} className="mb-3 h-32 rounded-lg" />}
            <ImageUploader
              label="Upload team photo"
              onUpload={async (files) =>
                update(m.id, { photo: await uploadPhotoToStorage(files[0].file) })
              }
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={() => toast.success("Team member saved")}>
              Save
            </Button>
            <Confirm
              label={m.name}
              onConfirm={() => guard(() => remove(m.id), "Team member deleted")}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* --------------------------------- students -------------------------------- */

/** Payments belonging to a student — linked by record or by phone number. */
function minePayments(payments: Payment[], s: Student) {
  const digits = s.phone.replace(/\D/g, "");
  return payments.filter(
    (p) => p.studentId === s.id || (digits.length >= 6 && p.phone.replace(/\D/g, "") === digits),
  );
}

function studentRow(s: Student, packages: Package[], payments: Payment[]): Row {
  const mine = minePayments(payments, s);
  const confirmed = mine.filter((p) => p.status === "confirmed");
  return {
    Name: s.name,
    Phone: s.phone,
    Package: packages.find((p) => p.id === s.packageId)?.name ?? "-",
    "Enrolled on": new Date(s.enrolledAt).toLocaleDateString(),
    Status: s.status === "active" ? "Active" : "Completed",
    Payments: mine.length,
    "Total paid": `$${confirmed.reduce((sum, p) => sum + p.amount, 0)}`,
    "Latest reference": mine[0]?.reference ?? "",
  };
}

function StudentsPanel() {
  const { items, add, addMany, update, remove } = useStudents();
  const { items: packages } = usePackages();
  const { items: payments } = usePayments();
  const [query, setQuery] = useState("");
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) => s.name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q),
    );
  }, [items, query]);

  const allRows = () => shown.map((s) => studentRow(s, packages, payments));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() =>
            guard(async () => {
              const created = await add({
                name: "New student",
                phone: "",
                packageId: packages[0]?.id ?? "",
                enrolledAt: new Date().toISOString().slice(0, 10),
                status: "active",
              });
              setJustCreatedId(created.id);
            }, "Student added")
          }
        >
          <Plus className="size-4" /> Add student
        </Button>
        <BulkImportStudents packages={packages} addMany={addMany} />
        <Button
          variant="outline"
          onClick={() =>
            guard(() => downloadSpreadsheet("students", allRows()), "Spreadsheet downloaded")
          }
        >
          <FileSpreadsheet className="size-4" /> Export all (Excel)
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            guard(
              () => printTable("Students", `${shown.length} student(s)`, allRows()),
              "Opening the PDF",
            )
          }
        >
          <FileDown className="size-4" /> Export all (PDF)
        </Button>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone"
          className="max-w-xs"
        />
      </div>

      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No students yet. Enroll one from the Enquiries or Payments tab, or add one here.
        </p>
      )}

      {shown.map((s) => (
        <StudentCard
          key={s.id}
          student={s}
          packages={packages}
          payments={payments}
          update={update}
          remove={remove}
          defaultOpen={s.id === justCreatedId}
        />
      ))}
    </div>
  );
}

type ParsedStudentRow = {
  name: string;
  phone: string;
  packageId: string;
  packageInput: string;
  enrolledAt: string;
  status: "active" | "completed";
  problem?: string;
};

function parseStudentCsvRows(
  rows: Record<string, string>[],
  packages: Package[],
): ParsedStudentRow[] {
  // Accept a few common header spellings so a school's existing sheet
  // doesn't have to be reformatted to match our exact template.
  const get = (r: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(r).find((h) => h.toLowerCase().trim() === k);
      if (hit && r[hit]) return r[hit];
    }
    return "";
  };

  return rows.map((r) => {
    const name = get(r, "name", "full name", "student name");
    const phone = get(r, "phone", "phone number", "whatsapp", "phone / whatsapp");
    const packageInput = get(r, "package", "package name");
    const enrolledInput = get(r, "enrolled on", "enrolled", "enrolled date", "start date");
    const statusInput = get(r, "status").toLowerCase();

    const pkg = packageInput
      ? packages.find((p) => p.name.toLowerCase() === packageInput.toLowerCase())
      : undefined;

    let problem: string | undefined;
    if (!name) problem = "Missing name";
    else if (!phone) problem = "Missing phone number";
    else if (packageInput && !pkg) problem = `Unknown package "${packageInput}"`;

    const enrolledDate = enrolledInput ? new Date(enrolledInput) : new Date();
    const enrolledAt = isNaN(enrolledDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : enrolledDate.toISOString().slice(0, 10);

    return {
      name,
      phone,
      packageId: pkg?.id ?? packages[0]?.id ?? "",
      packageInput,
      enrolledAt,
      status: statusInput.startsWith("comp") ? "completed" : "active",
      problem,
    };
  });
}

function BulkImportStudents({
  packages,
  addMany,
}: {
  packages: Package[];
  addMany: (items: (Omit<Student, "id"> & { id?: string })[]) => unknown;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState("");

  const valid = rows.filter((r) => !r.problem);
  const invalid = rows.filter((r) => r.problem);

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
      setRows(parseStudentCsvRows(parsed, packages));
    } catch {
      toast.error("Could not read that file, make sure it's a CSV.");
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
          <DialogTitle>Bulk import students</DialogTitle>
          <DialogDescription>
            Upload a CSV file with one row per student, handy for bringing in a class list from
            Excel or Google Sheets all at once instead of adding each one by hand.
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
                downloadSpreadsheet("student-import-template", [
                  {
                    Name: "Tafara Moyo",
                    Phone: "0771234567",
                    Package: packages[0]?.name ?? "Standard",
                    "Enrolled on": new Date().toISOString().slice(0, 10),
                    Status: "Active",
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

          {rows.length > 0 && (
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
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Phone</th>
                      <th className="p-2 text-left">Package</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={cn("border-t", r.problem && "bg-destructive/5")}>
                        <td className="p-2">{r.name || "-"}</td>
                        <td className="p-2 font-mono">{r.phone || "-"}</td>
                        <td className="p-2">{r.packageInput || "-"}</td>
                        <td className="p-2">
                          {r.problem ? (
                            <span className="text-destructive">{r.problem}</span>
                          ) : (
                            <span className="text-success">
                              {r.status === "active" ? "Active" : "Completed"}
                            </span>
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
              guard(
                async () => {
                  await addMany(
                    valid.map((r) => ({
                      name: r.name,
                      phone: r.phone,
                      packageId: r.packageId,
                      enrolledAt: r.enrolledAt,
                      status: r.status,
                    })),
                  );
                  setOpen(false);
                  reset();
                },
                `${valid.length} student${valid.length === 1 ? "" : "s"} imported`,
              )
            }
          >
            <Upload className="size-4" /> Import {valid.length || ""} student
            {valid.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentCard({
  student: s,
  packages,
  payments,
  update,
  remove,
  defaultOpen = false,
}: {
  student: Student;
  packages: Package[];
  payments: Payment[];
  update: (id: string, patch: Partial<Student>) => void;
  remove: (id: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pkg = packages.find((p) => p.id === s.packageId);
  const paid = payments.filter((p) => p.studentId === s.id && p.status === "confirmed");
  const paidTotal = paid.reduce((sum, p) => sum + p.amount, 0);
  const statusLabel = STUDENT_STATUSES.find((x) => x.value === s.status)?.label ?? s.status;

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {(s.name || "?").trim().slice(0, 1).toUpperCase()}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s.name || "Unnamed student"}</span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-mono">{s.phone || "No phone yet"}</span>
            {pkg && (
              <>
                <span aria-hidden>·</span>
                <Badge variant="outline" className="font-mono text-[0.65rem] font-medium">
                  {pkg.name}
                </Badge>
              </>
            )}
            <span aria-hidden>·</span>
            <span
              className={cn(
                "font-medium",
                s.status === "active" ? "text-success" : "text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
            {paidTotal > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="text-success font-medium">Paid ${paidTotal}</span>
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
        <CardContent className="grid gap-3 border-t pt-5 pb-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Phone / WhatsApp (required)</Label>
            <Input
              value={s.phone}
              inputMode="tel"
              placeholder="078 000 0000"
              onChange={(e) => update(s.id, { phone: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Enrolled on</Label>
            <Input
              type="date"
              value={s.enrolledAt.slice(0, 10)}
              onChange={(e) => update(s.id, { enrolledAt: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <ChipGroup
              size="sm"
              value={s.status}
              options={STUDENT_STATUSES}
              onChange={(v) => update(s.id, { status: v })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Package</Label>
            <ChipGroup
              size="sm"
              value={s.packageId}
              options={packages.map((p) => ({ value: p.id, label: `${p.name} ($${p.price})` }))}
              onChange={(v) => update(s.id, { packageId: v })}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Payments</Label>
            {minePayments(payments, s).length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">No payments recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {minePayments(payments, s).map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2",
                      p.status === "confirmed" && "border-success/40 bg-success/10 text-success",
                    )}
                  >
                    <span className="font-mono font-semibold">${p.amount}</span>
                    <span className="font-mono">{p.reference}</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    <span className="font-medium">
                      {PAYMENT_STATUSES.find((x) => x.value === p.status)?.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {paid.length > 0 && (
              <p className="text-success mt-2 text-xs font-semibold">
                Total confirmed: ${paidTotal}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4 sm:col-span-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              <ChevronUp className="size-4" /> Collapse
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                guard(
                  () =>
                    downloadSpreadsheet(`student-${slugify(s.name)}`, [
                      studentRow(s, packages, payments),
                    ]),
                  "Spreadsheet downloaded",
                )
              }
            >
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            {s.phone && (
              <Button
                size="sm"
                className="bg-success text-success-foreground hover:bg-success/90"
                asChild
              >
                <a
                  href={waLink(
                    s.phone,
                    `Hi ${s.name || "there"}, here's how to check your Auto Driving School lessons:\n${origin()}/my-lessons\nUse your name and the last 4 digits of this phone number.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> Send lesson lookup on WhatsApp
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                guard(
                  () =>
                    printStudentProfile(
                      s,
                      packages.find((p) => p.id === s.packageId),
                      minePayments(payments, s),
                      packages,
                    ),
                  "Opening the PDF",
                )
              }
            >
              <FileDown className="size-4" /> PDF
            </Button>
            <span className="ml-auto">
              <Confirm
                label={s.name}
                onConfirm={() => guard(() => remove(s.id), "Student deleted")}
              />
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* --------------------------------- payments -------------------------------- */

function PaymentsPanel({ onScheduleNow }: { onScheduleNow: (studentId: string) => void }) {
  const { items, update, remove } = usePayments();
  const { items: packages } = usePackages();
  const { items: students } = useStudents();
  const { items: enquiries } = useEnquiries();

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No payments submitted yet. They appear here as soon as someone pays by EcoCash.
        </p>
      )}
      {items.map((p) => {
        const student = students.find((s) => s.id === p.studentId);
        // A confirmed payer who isn't a student yet — look for a matching
        // enquiry by phone so the Enroll dialog can carry over their
        // preferred days/times too, same as enrolling straight from Enquiries.
        const matchedEnquiry = !student
          ? enquiries.find((e) => e.phone.replace(/\D/g, "") === p.phone.replace(/\D/g, ""))
          : undefined;
        return (
          <PaymentCard
            key={p.id}
            payment={p}
            student={student}
            matchedEnquiry={matchedEnquiry}
            packages={packages}
            update={update}
            remove={remove}
            onScheduleNow={onScheduleNow}
          />
        );
      })}
    </div>
  );
}

function PaymentCard({
  payment: p,
  student,
  matchedEnquiry,
  packages,
  update,
  remove,
  onScheduleNow,
}: {
  payment: Payment;
  student: Student | undefined;
  matchedEnquiry: Enquiry | undefined;
  packages: Package[];
  update: (id: string, patch: Partial<Payment>) => void;
  remove: (id: string) => void;
  onScheduleNow: (studentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pkgName = packages.find((pk) => pk.id === p.packageId)?.name ?? "-";
  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-secondary/40 flex w-full items-center gap-3 px-5 py-4 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
          {p.name.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {p.name} · <span className="font-mono text-xs">{p.phone}</span>
          </span>
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span>
              {pkgName} · ${p.amount}
            </span>
            <span aria-hidden>·</span>
            <Badge
              variant={p.status === "confirmed" ? "secondary" : "outline"}
              className="text-[0.65rem] capitalize"
            >
              {p.status.replace("-", " ")}
            </Badge>
          </span>
        </span>
        {open ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="grid gap-3 border-t pt-5 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-sm">
                {new Date(p.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-1 font-mono text-sm">Ref: {p.reference}</p>
              {student && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Student record: {student.name} ({student.phone})
                </p>
              )}
            </div>
            <Confirm
              label="payment"
              onConfirm={() => guard(() => remove(p.id), "Payment deleted")}
            />
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <ChipGroup
              size="sm"
              ariaLabel="Payment status"
              value={p.status}
              options={PAYMENT_STATUSES}
              onChange={(v) => guard(() => update(p.id, { status: v }), "Status updated")}
            />
          </div>

          <div className="grid gap-2">
            <Label>Your note</Label>
            <Input
              value={p.note}
              placeholder="e.g. confirmed in statement 8/6"
              onChange={(e) => update(p.id, { note: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                guard(
                  () =>
                    printPaymentReceipt(
                      p,
                      packages.find((pk) => pk.id === p.packageId),
                    ),
                  "Opening the receipt",
                )
              }
            >
              <FileDown className="size-4" /> Receipt
            </Button>

            {p.status === "confirmed" &&
              (student ? (
                <Button size="sm" onClick={() => onScheduleNow(student.id)}>
                  <CalendarClock className="size-4" /> Schedule lesson
                </Button>
              ) : (
                <EnrollDialog
                  trigger={
                    <Button size="sm">
                      <UserPlus className="size-4" /> Enroll student
                    </Button>
                  }
                  initialName={p.name}
                  initialPhone={p.phone}
                  initialPackageId={p.packageId}
                  enquiry={matchedEnquiry}
                  paymentId={p.id}
                  onScheduleNow={(created) => onScheduleNow(created.id)}
                />
              ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}