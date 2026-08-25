/**
 * Single data-access layer for the whole site.
 *
 * Everything (enquiries, packages, instructors, testimonials, photos,
 * promotions, driving tips, site settings) is read and written through this
 * module — no component talks to localStorage directly. That makes it a clean
 * swap to a real backend (e.g. Supabase) later without touching the pages.
 *
 * PLACEHOLDER NOTE: uploaded images/files are stored here as base64 data URLs
 * inside localStorage. This is a temporary foundation-build approach — local
 * storage has ~5MB of capacity and will not scale to many or large images.
 * When a backend is added, swap the data-URL handling for real file storage
 * (e.g. Supabase Storage) and keep only the returned public URL in the record.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import type { PdfMatchRow } from "./pdfMatch";

/** True when a key has patch[key] explicitly set (including to undefined),
 *  as opposed to the key being absent from the patch entirely. Needed so a
 *  patch like `{ startedAt: undefined }` clears the column in Supabase
 *  instead of silently leaving the old value in place. */
const has = <T extends object>(obj: T, key: keyof T) =>
  Object.prototype.hasOwnProperty.call(obj, key);

/** Extracts a human-readable message from a caught error.
 *
 *  Supabase throws plain objects (PostgrestError, AuthError, etc.) that are
 *  NOT instances of the real JS `Error` class. Code that does
 *  `err instanceof Error ? err.message : "fallback"` silently discards the
 *  actual database/auth error and always shows the fallback text instead.
 *  Use this helper everywhere a caught error needs to be shown to the user
 *  or logged, so the real reason is never thrown away. */
export function errorMessage(
  err: unknown,
  fallback = "Something went wrong. Check your connection and try again.",
): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    if (typeof anyErr.message === "string" && anyErr.message) return anyErr.message;
    if (typeof anyErr.error_description === "string" && anyErr.error_description) {
      return anyErr.error_description;
    }
    if (typeof anyErr.details === "string" && anyErr.details) return anyErr.details;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}

/* ---------------------------------- types --------------------------------- */

export type PhotoCategory = "hero" | "gallery" | "about" | "contact";
export type PublishStatus = "pending" | "published";

export interface Photo {
  id: string;
  src: string;
  caption: string;
  category: PhotoCategory;
  status: PublishStatus;
  createdAt: string;
}

export interface Package {
  id: string;
  slug: string;
  name: string;
  price: number;
  lessons?: number;
  description: string;
  includes: string[];
  /** Which kind of lesson this bundle is for. Undefined/"any" means it can be used for either —
   *  set it to lock a package to provisional or driving lessons and have bookings made against it
   *  default to that type automatically. */
  lessonType?: LessonType;
  /** Manually mark this as the "Most popular" package — shows a highlighted badge and styling
   *  wherever packages are listed. Only one package should have this set at a time. */
  featured?: boolean;
  /** Whether this package shows in the homepage preview (before someone clicks "See all
   *  packages"). Defaults to true for existing packages. */
  showOnHome?: boolean;
  /** Marks this as a combo/bundle package (e.g. two lesson types combined) — gets its own
   *  distinct card styling wherever packages are listed. */
  isCombo?: boolean;
}

export interface Instructor {
  id: string;
  slug: string;
  name: string;
  years: number;
  languages: string;
  bio: string;
  photo?: string;
  phone?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  rating: number;
  comment: string;
  status: PublishStatus;
  createdAt: string;
}

export type EnquiryStatus =
  "new" | "contacted" | "scheduled" | "enrolled" | "completed" | "cancelled";

export const ENQUIRY_STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "enrolled", label: "Enrolled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Statuses that actually hold a booking slot (block double booking).
 *
 * Only "scheduled" and "enrolled" reserve a day+slot — those mean a real
 * lesson has been arranged. "new"/"contacted" are just a learner's stated
 * preference and must NOT block other enquirers from requesting the same
 * day/slot, or from being converted onto it themselves.
 */
export const ACTIVE_ENQUIRY_STATUSES: EnquiryStatus[] = ["scheduled", "enrolled"];

export interface Enquiry {
  id: string;
  /** Human-friendly booking reference shown on the receipt. */
  ref?: string;
  name: string;
  phone: string;
  packageId: string;
  days: string[];
  times: string[];
  /** Specific lesson start times picked from TIME_SLOTS. */
  slots?: string[];

  createdAt: string;
  status: EnquiryStatus;
}

export type StudentStatus = "active" | "completed";

export const STUDENT_STATUSES: { value: StudentStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export interface Student {
  id: string;
  name: string;
  phone: string;
  packageId: string;
  enrolledAt: string;
  status: StudentStatus;
  /** Enquiry this student was created from, when applicable. */
  enquiryId?: string;
}

export type PaymentStatus = "pending" | "confirmed" | "not-found";

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: "pending", label: "Pending Verification" },
  { value: "confirmed", label: "Confirmed" },
  { value: "not-found", label: "Not Found" },
];

export interface Payment {
  id: string;
  studentId?: string;
  name: string;
  phone: string;
  packageId: string;
  amount: number;
  reference: string;
  status: PaymentStatus;
  note: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  flyer?: string;
  flyerName?: string;
  startDate: string;
  endDate: string;
  status: "active" | "expired";
  packageId?: string;
  promoPrice?: number;
}

export interface Tip {
  id: string;
  title: string;
  body: string;
  attachment?: string;
  attachmentName?: string;
  attachmentType?: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface WhyCard {
  title: string;
  body: string;
}

export interface AboutContent {
  storyHeading: string;
  storyParagraphs: string[];
  whyCards: WhyCard[];
}

export type AboutSectionType = "text" | "text-photo" | "photo";

export interface AboutSection {
  id: string;
  type: AboutSectionType;
  heading: string;
  body: string;
  image?: string;
  imagePosition: "left" | "right";
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo?: string;
}

/** Keys map to a fixed icon set rendered by TRUST_ICONS (see blocks.tsx). */
export type TrustIconKey =
  "shield" | "car" | "calendar" | "clock" | "mapPin" | "phone" | "users" | "award";

export interface TrustItem {
  icon: TrustIconKey;
  text: string;
}

export interface SiteSettings {
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  headline: string;
  tagline: string;
  stats: StatItem[];
  /** The 3 trust badges shown in the strip under the homepage hero. */
  trustStrip: TrustItem[];
  /** WhatsApp message pre-filled on generic "chat with us" links. */
  waGeneralTemplate: string;
  /** WhatsApp message pre-filled after a booking request. Supports tokens. */
  waBookingTemplate: string;
  /** EcoCash number learners send money to. */
  ecocashNumber: string;
  /** WhatsApp message pre-filled after a payment submission. Supports tokens. */
  waPaymentTemplate: string;
  /** WhatsApp welcome message sent right after a student is enrolled. Supports tokens. */
  waWelcomeTemplate: string;
  /** WhatsApp message sent to an instructor when a lesson is scheduled. Supports tokens. */
  waInstructorLessonTemplate: string;
  /** WhatsApp message sent to a student when a lesson is scheduled. Supports tokens. */
  waStudentLessonTemplate: string;
  /** WhatsApp follow-up message pre-filled from the Enquiries tab. Supports tokens. */
  waEnquiryFollowUpTemplate: string;
  /** WhatsApp message sent to a student or instructor with a whole week's lessons. Supports tokens. */
  waWeeklyPlanTemplate: string;
}

/* --------------------------------- defaults -------------------------------- */

export const SITE_NAME = "Auto Driving School";
export const WHATSAPP_LINK = "https://wa.me/263788733625";

export const defaultSettings: SiteSettings = {
  phone: "078 873 3625",
  whatsapp: "263788733625",
  address: "11th Ave & Joshua Nkomo St, Bulawayo (Plus code: RHRJ+9F Bulawayo)",
  hours: "Open daily · closes 6pm",
  headline: "Learn to drive with Bulawayo's trusted driving school",
  tagline:
    "TSCZ-registered instructors, dual-control vehicles and flexible lesson times, right in the centre of town.",
  stats: [
    { value: "500+", label: "Learners Trained" },
    { value: "92%", label: "First-Time Pass Rate" },
    { value: "12", label: "Years in Bulawayo" },
    { value: "7", label: "Days a Week" },
  ],
  trustStrip: [
    { icon: "shield", text: "TSCZ registered school" },
    { icon: "car", text: "Dual-control vehicles" },
    { icon: "calendar", text: "Open 7 days, closes 6pm" },
  ],
  waGeneralTemplate: "Hi Auto Driving School, I'd like to ask about driving lessons.",
  waBookingTemplate: [
    "Hi Auto Driving School, I'd like to book driving lessons.",
    "Ref: {ref}",
    "Name: {name}",
    "Phone: {phone}",
    "Package: {package}",
    "Preferred days: {days}",
    "Preferred time of day: {times}",
    "Preferred time slots: {slots}",
  ].join("\n"),
  ecocashNumber: "078 873 3625",
  waPaymentTemplate: [
    "Hi Auto Driving School, I've paid for my lessons on EcoCash.",
    "Name: {name}",
    "Phone: {phone}",
    "Package: {package}",
    "Amount: ${amount}",
    "EcoCash reference: {reference}",
  ].join("\n"),
  waWelcomeTemplate: [
    "Welcome to Auto Driving School, {name}! 🎉",
    "You're enrolled on the {package} package.",
    "Preferred days: {days}",
    "Preferred time of day: {times}",
    "Reference: {ref}",
    "We'll be in touch to confirm your first lesson time. Reply here anytime you have a question.",
  ].join("\n"),
  waInstructorLessonTemplate: [
    "Hi {instructor}, you have a lesson booked:",
    "Student: {student}",
    "Date: {date}",
    "Time: {time}",
    "Type: {type}",
    "",
    "Check your full schedule anytime: {link}",
  ].join("\n"),
  waStudentLessonTemplate: [
    "Hi {student}, your driving lesson is booked:",
    "Date: {date}",
    "Time: {time}",
    "Instructor: {instructor}",
    "See you then!",
    "",
    "Check your lessons anytime: {link}",
  ].join("\n"),
  waEnquiryFollowUpTemplate: [
    "Hi {name}, thanks for your enquiry with Auto Driving School!",
    "Package: {package}",
    "Preferred days: {days}",
    "Preferred time of day: {times}",
    "Preferred slots: {slots}",
    "",
    "Let us know if that still works and we'll get you booked in.",
  ].join("\n"),
  waWeeklyPlanTemplate: [
    "Hi {recipient}, here's the weekly lesson plan:",
    "Student: {student}",
    "Instructor: {instructor}",
    "",
    "{schedule}",
    "",
    "Check anytime: {link}",
  ].join("\n"),
};

const defaultPackages: Package[] = [
  {
    id: "pkg-beginner",
    slug: "beginner",
    name: "Beginner Package",
    price: 120,
    lessons: 8,
    description: "Perfect if you have never sat behind the wheel before.",
    includes: ["8 driving lessons", "Highway Code basics", "Dual-control vehicle", "Yard practice"],
    showOnHome: true,
  },
  {
    id: "pkg-full",
    slug: "full-course",
    name: "Full Course",
    price: 280,
    lessons: 20,
    description: "Everything you need from first lesson to VID test day.",
    includes: [
      "20 driving lessons",
      "Full Highway Code prep",
      "Yard + road training",
      "VID test booking help",
      "Mock test",
    ],
    featured: true,
    showOnHome: true,
  },
  {
    id: "pkg-refresher",
    slug: "refresher",
    name: "Refresher Package",
    price: 90,
    lessons: 5,
    description: "For licenced drivers who need confidence back on the road.",
    includes: ["5 driving lessons", "Parking & reversing drills", "City road confidence"],
    showOnHome: true,
  },
];

const defaultInstructors: Instructor[] = [
  {
    id: "ins-ncube",
    slug: "mr-ncube",
    name: "Mr. Ncube",
    years: 14,
    languages: "Ndebele, English, Shona",
    bio: "Mr. Ncube has been teaching learners in Bulawayo since 2011. He is patient with first-timers and specialises in getting nervous drivers comfortable in traffic before test day.",
  },
  {
    id: "ins-moyo",
    slug: "mrs-moyo",
    name: "Mrs. Moyo",
    years: 9,
    languages: "Ndebele, English",
    bio: "Mrs. Moyo focuses on yard work and VID test preparation. Her learners consistently pass parallel parking and hill starts on the first attempt.",
  },
  {
    id: "ins-dube",
    slug: "mr-dube",
    name: "Mr. Dube",
    years: 6,
    languages: "English, Shona",
    bio: "Mr. Dube handles refresher courses and defensive driving. He keeps lessons practical, focusing on real Bulawayo roads and busy intersections.",
  },
];

const defaultTestimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Thandeka M.",
    rating: 5,
    comment: "Passed my VID test first try. The instructors are so patient!",
    status: "published",
    createdAt: new Date().toISOString(),
  },
  {
    id: "t2",
    name: "Blessing S.",
    rating: 5,
    comment: "Booked the full course and never felt rushed. Highly recommend.",
    status: "published",
    createdAt: new Date().toISOString(),
  },
  {
    id: "t3",
    name: "Sipho N.",
    rating: 4,
    comment: "Great refresher lessons after years of not driving.",
    status: "published",
    createdAt: new Date().toISOString(),
  },
];

const defaultTips: Tip[] = [
  {
    id: "tip1",
    title: "Know your road signs before test day",
    body: "The VID examiner will ask you to identify signs before you even start the car. Learn the warning (triangle), regulatory (circle) and information (rectangle) groups, knowing the shape families alone gets you most of the way there.",
  },
  {
    id: "tip2",
    title: "Master the hill start",
    body: "Handbrake up, clutch to biting point, gentle accelerator, then release. Practise on a quiet slope until you can do it without rolling back a single centimetre.",
  },
  {
    id: "tip3",
    title: "Did you know? Mirrors before every move",
    body: "Mirror, signal, manoeuvre, in that order, every single time. Examiners watch your head movement, so make your mirror checks visible.",
  },
];

export const defaultAboutContent: AboutContent = {
  storyHeading: "Our story",
  storyParagraphs: [
    "Auto Driving School has been training learner drivers from the corner of 11th Avenue and Joshua Nkomo Street for over a decade. We started with a single dual-control vehicle and a simple idea: nobody learns well when they're being shouted at.",
    "Today we run lessons seven days a week, from first-time learners who've never touched a clutch to licenced drivers who want their confidence back.",
  ],
  whyCards: [
    { title: "TSCZ registered", body: "A recognised school, so your hours count." },
    { title: "Dual-control vehicles", body: "Instructor can step in | safe from lesson one." },
    { title: "Experienced instructors", body: "Decades of combined teaching in Bulawayo." },
    { title: "Flexible scheduling", body: "Mornings, afternoons or evenings, 7 days." },
  ],
};

/* ------------------------------- tiny store ------------------------------- */

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* ------------------------------ collection API ----------------------------- */

interface Collection<T extends { id: string }> {
  items: T[];
  add: (item: Omit<T, "id"> & { id?: string }) => T;
  addMany: (items: (Omit<T, "id"> & { id?: string })[]) => T[];
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  replaceAll: (items: T[]) => void;
  /** Swap an item with its neighbour (-1 up, 1 down). */
  move: (id: string, direction: -1 | 1) => void;
  /** True until this collection's initial fetch from Supabase has settled.
   *  Use this before treating a missing `.find()` result as "not found". */
  isLoading: boolean;
}

/* --------------------- remote (Supabase) collection API -------------------- */

/**
 * Every collection in this file lives in Supabase (see supabase/schema.sql).
 * Reads/writes go straight through the anon key with the TEMP-anon-access
 * policies from supabase/002_temp_anon_admin_access.sql — see that file's
 * comments for the security trade-off this implies until /admin gets real
 * Supabase Auth.
 */
type RemoteKey =
  | "students"
  | "tests"
  | "assignments"
  | "submissions"
  | "lessons"
  | "instructors"
  | "photos"
  | "packages"
  | "testimonials"
  | "promotions"
  | "tips"
  | "enquiries"
  | "team"
  | "payments"
  | "aboutSections";

const remoteCache = new Map<RemoteKey, unknown[]>();
const remoteFetchState = new Map<RemoteKey, "loading" | "done">();

// A stable, shared reference for "nothing loaded yet". Returning a fresh []
// literal here instead would break useSyncExternalStore: getSnapshot has to
// return the same reference when nothing changed, or React treats every
// check as a change and re-renders in an infinite loop (this was a real bug
// — "Maximum update depth exceeded" on any panel backed by this store, e.g.
// Instructors/Schedule).
const EMPTY_REMOTE: unknown[] = [];

function readRemote<T>(key: RemoteKey): T[] {
  return (remoteCache.get(key) as T[] | undefined) ?? (EMPTY_REMOTE as T[]);
}

function writeRemote<T>(key: RemoteKey, value: T[]) {
  remoteCache.set(key, value);
  emit();
}

function useRemoteKey<T>(key: RemoteKey): T[] {
  // Server snapshot reads from the same cache as the client snapshot
  // (instead of always pretending to be empty) so that when a route loader
  // — e.g. the homepage's fetchHomeData() — has already seeded this key
  // before render, the very first paint shows the real data instead of a
  // flash of empty-state fallbacks that then gets swapped out a moment
  // later. This is safe because everything stored here is public, shared
  // site content (photos, packages, promotions...), never anything
  // request- or user-specific.
  return useSyncExternalStore(subscribe, () => readRemote<T>(key), () => readRemote<T>(key));
}

function reportRemoteError(action: string, key: string, err: unknown) {
  const detail = errorMessage(err, "Check your connection and try again.");
  console.error(`Supabase ${action} failed for ${key}:`, err);
  toast.error(`Could not ${action}, ${detail}`, { duration: Infinity });
}

function ensureRemoteLoaded<T>(
  key: RemoteKey,
  table: string,
  orderColumn: string,
  fromRow: (row: any) => T,
  ascending = false,
) {
  if (typeof window === "undefined") return; // fetch client-side only (SSR-safe)
  if (remoteFetchState.get(key)) return;
  remoteFetchState.set(key, "loading");
  (async () => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderColumn, { ascending });
      if (error) throw error;
      writeRemote<T>(key, (data ?? []).map(fromRow));
    } catch (err) {
      reportRemoteError("load", key, err);
    } finally {
      remoteFetchState.set(key, "done");
      // The success path already re-renders subscribers via writeRemote's
      // emit(). The error path doesn't touch the cache, so without this call
      // nothing tells "isLoading" consumers that loading has finished —
      // they'd stay stuck showing a loading state forever after a failed
      // fetch.
      emit();
    }
  })();
}

/** True while `key`'s initial fetch from Supabase hasn't finished yet.
 *  Lets pages that look something up by id (e.g. a token) tell "still
 *  loading" apart from "genuinely doesn't exist" — without this, a page
 *  that does `assignments.find(...)` sees an empty array for a moment on
 *  every load and flashes an "invalid link" notice before the real data
 *  arrives. */
function useRemoteLoading(key: RemoteKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => remoteFetchState.get(key) !== "done",
    () => remoteFetchState.get(key) !== "done",
  );
}

interface RemoteTableConfig<T extends { id: string }> {
  key: RemoteKey;
  table: string;
  orderColumn: string;
  /** Defaults to false (newest/highest first) — matches the old localStorage
   *  behaviour of unshifting new items to the front. */
  ascending?: boolean;
  fromRow: (row: any) => T;
  toRow: (item: Partial<T>) => Record<string, unknown>;
  /** Called once per row when Realtime delivers a fresh INSERT from another
   *  session (not our own optimistic insert) — e.g. to toast "New enquiry". */
  onRemoteInsert?: (row: T) => void;
}

/**
 * One Supabase Realtime channel per table, shared across every component
 * using that collection — without this, each mounted panel would open its
 * own subscription and every INSERT/UPDATE would apply (and, for
 * onRemoteInsert, notify) once per mounted instance.
 *
 * This is what makes new enquiries (and any other live edit, from any
 * device/tab) show up immediately instead of only after a manual refresh —
 * previously each table was only ever fetched once per page load.
 */
const remoteChannels = new Map<RemoteKey, ReturnType<typeof supabase.channel>>();

/**
 * Counts in-flight update() calls per "key:id", so the realtime UPDATE
 * handler below can tell "an echo of a write I already applied locally" from
 * "a genuine change from elsewhere" and skip the former.
 *
 * Without this, fast typing into any field bound straight to update() (e.g.
 * a "Test name" box calling update() on every keystroke) races its own
 * Realtime echoes: each keystroke fires an update, Postgres/Realtime don't
 * guarantee those echoes come back in the same order they were sent, and the
 * plain "apply whatever the last echo said" handler would snap the field
 * back to an earlier, half-typed value mid-keystroke. While a row has
 * pending writes outstanding, we trust our own optimistic state instead of
 * replaying possibly-stale echoes for it.
 */
const pendingRemoteWrites = new Map<string, number>();
function pendingWriteKey(key: RemoteKey, id: string) {
  return `${key}:${id}`;
}

function ensureRealtimeSubscribed<T extends { id: string }>(
  key: RemoteKey,
  table: string,
  fromRow: (row: any) => T,
  onRemoteInsert?: (row: T) => void,
) {
  if (typeof window === "undefined") return; // client-side only (SSR-safe)
  if (remoteChannels.has(key)) return;

  const channel = supabase
    .channel(`realtime:${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload: { eventType: string; new: any; old: any }) => {
        const list = readRemote<T>(key);
        if (payload.eventType === "INSERT") {
          const row = fromRow(payload.new);
          // Skip rows we already have — our own optimistic insert already
          // added this id, so this is just Supabase echoing it back.
          if (list.some((i) => i.id === row.id)) return;
          writeRemote<T>(key, [row, ...list]);
          onRemoteInsert?.(row);
        } else if (payload.eventType === "UPDATE") {
          // Skip echoes for rows we still have an update() in flight for —
          // see pendingRemoteWrites above. Our optimistic state is already
          // at least as current as this echo.
          if ((pendingRemoteWrites.get(pendingWriteKey(key, payload.new?.id)) ?? 0) > 0) return;
          const row = fromRow(payload.new);
          writeRemote<T>(
            key,
            list.map((i) => (i.id === row.id ? row : i)),
          );
        } else if (payload.eventType === "DELETE") {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          writeRemote<T>(
            key,
            list.filter((i) => i.id !== deletedId),
          );
        }
      },
    )
    .subscribe();

  remoteChannels.set(key, channel);
}

/** Same shape as useCollection, but backed by a Supabase table instead of
 *  localStorage. Writes are optimistic — the UI updates immediately and
 *  rolls back with a toast if the Supabase call fails. */
function useRemoteCollection<T extends { id: string }>(
  config: RemoteTableConfig<T>,
): Collection<T> {
  const { key, table, orderColumn, ascending = false, fromRow, toRow, onRemoteInsert } = config;

  useEffect(() => {
    ensureRemoteLoaded(key, table, orderColumn, fromRow, ascending);
    ensureRealtimeSubscribed(key, table, fromRow, onRemoteInsert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, table]);

  const items = useRemoteKey<T>(key);
  const isLoading = useRemoteLoading(key);

  const add = useCallback(
    (item: Omit<T, "id"> & { id?: string }) => {
      const tempId = item.id ?? uid();
      const optimistic = { ...item, id: tempId } as T;
      writeRemote<T>(key, [optimistic, ...readRemote<T>(key)]);
      (async () => {
        try {
          const { data, error } = await (supabase.from(table) as any)
            .insert(toRow(item as Partial<T>))
            .select()
            .single();
          if (error) throw error;
          const saved = fromRow(data);
          writeRemote<T>(
            key,
            readRemote<T>(key).map((i) => (i.id === tempId ? saved : i)),
          );
        } catch (err) {
          writeRemote<T>(
            key,
            readRemote<T>(key).filter((i) => i.id !== tempId),
          );
          reportRemoteError("save", key, err);
        }
      })();
      return optimistic;
    },
    [key, table],
  );

  const addMany = useCallback(
    (list: (Omit<T, "id"> & { id?: string })[]) => {
      const optimisticList = list.map((i) => ({ ...i, id: i.id ?? uid() }) as T);
      const tempIds = new Set(optimisticList.map((i) => i.id));
      writeRemote<T>(key, [...optimisticList, ...readRemote<T>(key)]);
      (async () => {
        try {
          const { data, error } = await (supabase.from(table) as any)
            .insert(list.map((i) => toRow(i as Partial<T>)))
            .select();
          if (error) throw error;
          const saved = (data ?? []).map(fromRow);
          writeRemote<T>(key, [...saved, ...readRemote<T>(key).filter((i) => !tempIds.has(i.id))]);
        } catch (err) {
          writeRemote<T>(
            key,
            readRemote<T>(key).filter((i) => !tempIds.has(i.id)),
          );
          reportRemoteError("save", key, err);
        }
      })();
      return optimisticList;
    },
    [key, table],
  );

  const update = useCallback(
    (id: string, patch: Partial<T>) => {
      const prev = readRemote<T>(key);
      writeRemote<T>(
        key,
        prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
      const pk = pendingWriteKey(key, id);
      pendingRemoteWrites.set(pk, (pendingRemoteWrites.get(pk) ?? 0) + 1);
      (async () => {
        try {
          const { error } = await (supabase.from(table) as any).update(toRow(patch)).eq("id", id);
          if (error) throw error;
        } catch (err) {
          writeRemote<T>(key, prev);
          reportRemoteError("update", key, err);
        } finally {
          const remaining = (pendingRemoteWrites.get(pk) ?? 1) - 1;
          if (remaining <= 0) pendingRemoteWrites.delete(pk);
          else pendingRemoteWrites.set(pk, remaining);
        }
      })();
    },
    [key, table],
  );

  const remove = useCallback(
    (id: string) => {
      const prev = readRemote<T>(key);
      writeRemote<T>(
        key,
        prev.filter((i) => i.id !== id),
      );
      (async () => {
        try {
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (error) throw error;
        } catch (err) {
          writeRemote<T>(key, prev);
          reportRemoteError("delete", key, err);
        }
      })();
    },
    [key, table],
  );

  const replaceAll = useCallback((list: T[]) => writeRemote<T>(key, list), [key]);

  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      // Client-side only — these tables have no persisted sort order.
      const list = [...readRemote<T>(key)];
      const i = list.findIndex((x) => x.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      writeRemote<T>(key, list);
    },
    [key],
  );

  return { items, add, addMany, update, remove, replaceAll, move, isLoading };
}

/**
 * Packages, testimonials, promotions, tips, enquiries, team and payments all
 * live in Supabase (see supabase/schema.sql), same pattern as instructors —
 * optimistic local updates, rolled back with a toast if the write fails.
 */
function packageFromRow(row: any): Package {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    lessons: row.lessons ?? undefined,
    description: row.description,
    includes: row.includes ?? [],
    lessonType: row.lesson_type ?? undefined,
    featured: row.featured ?? false,
    showOnHome: row.show_on_home ?? true,
    isCombo: row.is_combo ?? false,
  };
}

function packageToRow(item: Partial<Package>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "slug")) row.slug = item.slug;
  if (has(item, "name")) row.name = item.name;
  if (has(item, "price")) row.price = item.price;
  if (has(item, "lessons")) row.lessons = item.lessons ?? null;
  if (has(item, "description")) row.description = item.description;
  if (has(item, "includes")) row.includes = item.includes;
  if (has(item, "lessonType")) row.lesson_type = item.lessonType || null;
  if (has(item, "featured")) row.featured = item.featured ?? false;
  if (has(item, "showOnHome")) row.show_on_home = item.showOnHome ?? true;
  if (has(item, "isCombo")) row.is_combo = item.isCombo ?? false;
  return row;
}

export const usePackages = () =>
  useRemoteCollection<Package>({
    key: "packages",
    table: "packages",
    orderColumn: "price",
    ascending: true,
    fromRow: packageFromRow,
    toRow: packageToRow,
  });

function testimonialFromRow(row: any): Testimonial {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
  };
}

function testimonialToRow(item: Partial<Testimonial>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "name")) row.name = item.name;
  if (has(item, "rating")) row.rating = item.rating;
  if (has(item, "comment")) row.comment = item.comment;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  return row;
}

export const useTestimonials = () =>
  useRemoteCollection<Testimonial>({
    key: "testimonials",
    table: "testimonials",
    orderColumn: "created_at",
    fromRow: testimonialFromRow,
    toRow: testimonialToRow,
  });

function promotionFromRow(row: any): Promotion {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    flyer: row.flyer ?? undefined,
    flyerName: row.flyer_name ?? undefined,
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    status: row.status,
    packageId: row.package_id ?? undefined,
    promoPrice: row.promo_price ?? undefined,
  };
}

function promotionToRow(item: Partial<Promotion>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "title")) row.title = item.title;
  if (has(item, "description")) row.description = item.description;
  if (has(item, "flyer")) row.flyer = item.flyer || null;
  if (has(item, "flyerName")) row.flyer_name = item.flyerName || null;
  if (has(item, "startDate")) row.start_date = item.startDate || null;
  if (has(item, "endDate")) row.end_date = item.endDate || null;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "packageId")) row.package_id = item.packageId || null;
  if (has(item, "promoPrice")) row.promo_price = item.promoPrice ?? null;
  return row;
}

export const usePromotions = () =>
  useRemoteCollection<Promotion>({
    key: "promotions",
    table: "promotions",
    orderColumn: "title",
    ascending: true,
    fromRow: promotionFromRow,
    toRow: promotionToRow,
  });

function tipFromRow(row: any): Tip {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    attachment: row.attachment ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentType: row.attachment_type ?? undefined,
  };
}

function tipToRow(item: Partial<Tip>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "title")) row.title = item.title;
  if (has(item, "body")) row.body = item.body;
  if (has(item, "attachment")) row.attachment = item.attachment || null;
  if (has(item, "attachmentName")) row.attachment_name = item.attachmentName || null;
  if (has(item, "attachmentType")) row.attachment_type = item.attachmentType || null;
  return row;
}

export const useTips = () =>
  useRemoteCollection<Tip>({
    key: "tips",
    table: "tips",
    orderColumn: "title",
    ascending: true,
    fromRow: tipFromRow,
    toRow: tipToRow,
  });

function enquiryFromRow(row: any): Enquiry {
  return {
    id: row.id,
    ref: row.ref ?? undefined,
    name: row.name,
    phone: row.phone,
    packageId: row.package_id ?? "",
    days: row.days ?? [],
    times: row.times ?? [],
    slots: row.slots ?? undefined,
    createdAt: row.created_at,
    status: row.status,
  };
}

function enquiryToRow(item: Partial<Enquiry>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "ref")) row.ref = item.ref || null;
  if (has(item, "name")) row.name = item.name;
  if (has(item, "phone")) row.phone = item.phone;
  if (has(item, "packageId")) row.package_id = item.packageId || null;
  if (has(item, "days")) row.days = item.days;
  if (has(item, "times")) row.times = item.times;
  if (has(item, "slots")) row.slots = item.slots ?? [];
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  if (has(item, "status")) row.status = item.status;
  return row;
}

export const useEnquiries = () =>
  useRemoteCollection<Enquiry>({
    key: "enquiries",
    table: "enquiries",
    orderColumn: "created_at",
    fromRow: enquiryFromRow,
    toRow: enquiryToRow,
    onRemoteInsert: (row) =>
      toast.message("New enquiry", {
        description: `${row.name} · ${row.phone}`,
      }),
  });

function teamMemberFromRow(row: any): TeamMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photo: row.photo ?? undefined,
  };
}

function teamMemberToRow(item: Partial<TeamMember>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "name")) row.name = item.name;
  if (has(item, "role")) row.role = item.role;
  if (has(item, "bio")) row.bio = item.bio;
  if (has(item, "photo")) row.photo = item.photo || null;
  return row;
}

/** Team has no persisted `position` column yet, so — same trade-off already
 *  accepted for instructors — reordering here is client-side only and
 *  resets on reload. Add a position column later if that starts to matter. */
export const useTeam = () =>
  useRemoteCollection<TeamMember>({
    key: "team",
    table: "team",
    orderColumn: "name",
    ascending: true,
    fromRow: teamMemberFromRow,
    toRow: teamMemberToRow,
  });

function paymentFromRow(row: any): Payment {
  return {
    id: row.id,
    studentId: row.student_id ?? undefined,
    name: row.name,
    phone: row.phone,
    packageId: row.package_id ?? "",
    amount: row.amount,
    reference: row.reference,
    status: row.status,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

function paymentToRow(item: Partial<Payment>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "studentId")) row.student_id = item.studentId || null;
  if (has(item, "name")) row.name = item.name;
  if (has(item, "phone")) row.phone = item.phone;
  if (has(item, "packageId")) row.package_id = item.packageId || null;
  if (has(item, "amount")) row.amount = item.amount;
  if (has(item, "reference")) row.reference = item.reference;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "note")) row.note = item.note;
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  return row;
}

export const usePayments = () =>
  useRemoteCollection<Payment>({
    key: "payments",
    table: "payments",
    orderColumn: "created_at",
    fromRow: paymentFromRow,
    toRow: paymentToRow,
  });

/* ------------------------ one-time local -> Supabase move ------------------------ */

const LEGACY_PREFIX = "ads.v1.";

function readLegacy<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** True when this browser still has any un-migrated local data for the
 *  collections that used to live in localStorage (packages, testimonials,
 *  promotions, tips, enquiries, team, payments, settings, about). */
export function hasLegacyLocalData(): boolean {
  const keys = [
    "packages",
    "testimonials",
    "promotions",
    "tips",
    "enquiries",
    "team",
    "payments",
    "aboutSections",
    "settings",
    "aboutContent",
  ];
  return keys.some((k) => {
    const v = readLegacy<unknown>(k);
    if (v == null) return false;
    return Array.isArray(v) ? v.length > 0 : Object.keys(v as object).length > 0;
  });
}

async function migrateCollection<T extends { id: string }>(
  legacyKey: string,
  table: string,
  toRow: (item: Partial<T>) => Record<string, unknown>,
  fallback: T[] = [],
): Promise<number> {
  const { count, error: countErr } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return 0;

  let legacy = readLegacy<T[]>(legacyKey) ?? [];
  if (legacy.length === 0) legacy = fallback;
  if (legacy.length === 0) return 0;

  const { error } = await (supabase.from(table) as any).insert(legacy.map((item) => toRow(item)));
  if (error) throw error;
  return legacy.length;
}

/**
 * One-time move of everything that used to live in this browser's
 * localStorage (packages, testimonials, promotions, tips, enquiries, team,
 * payments, settings, about content/sections) into Supabase. Safe to call
 * repeatedly — each piece is a no-op once its table already has rows.
 *
 * Business data (enquiries, payments, team, promotions) only migrates if
 * this browser actually has some saved locally — no invented fallback.
 * Packages/testimonials/tips fall back to the site's original sample
 * content so a fresh install still looks populated.
 */
export async function migrateLocalDataToSupabase(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  result.packages = await migrateCollection<Package>(
    "packages",
    "packages",
    packageToRow,
    defaultPackages,
  );
  result.testimonials = await migrateCollection<Testimonial>(
    "testimonials",
    "testimonials",
    testimonialToRow,
    defaultTestimonials,
  );
  result.tips = await migrateCollection<Tip>("tips", "tips", tipToRow, defaultTips);
  result.promotions = await migrateCollection<Promotion>(
    "promotions",
    "promotions",
    promotionToRow,
  );
  result.team = await migrateCollection<TeamMember>("team", "team", teamMemberToRow);
  result.enquiries = await migrateCollection<Enquiry>("enquiries", "enquiries", enquiryToRow);
  result.payments = await migrateCollection<Payment>("payments", "payments", paymentToRow);

  // about_sections: ordered, needs an explicit position per row.
  {
    const { count, error: countErr } = await supabase
      .from("about_sections")
      .select("id", { count: "exact", head: true });
    if (countErr) throw countErr;
    if ((count ?? 0) === 0) {
      const legacy = readLegacy<AboutSection[]>("aboutSections") ?? [];
      if (legacy.length > 0) {
        const { error } = await (supabase.from("about_sections") as any).insert(
          legacy.map((s, i) => ({
            type: s.type,
            heading: s.heading,
            body: s.body,
            image: s.image || null,
            image_position: s.imagePosition,
            position: i,
          })),
        );
        if (error) throw error;
        result.aboutSections = legacy.length;
      } else {
        result.aboutSections = 0;
      }
    } else {
      result.aboutSections = 0;
    }
  }

  // settings / about_content: singleton rows, upsert only if no row exists yet.
  {
    const { data, error: fetchErr } = await supabase
      .from("settings")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!data) {
      const legacy = readLegacy<Partial<SiteSettings>>("settings");
      const { error } = await (supabase.from("settings") as any).upsert({
        id: 1,
        data: { ...defaultSettings, ...(legacy ?? {}) },
      });
      if (error) throw error;
      result.settings = 1;
    } else {
      result.settings = 0;
    }
  }
  {
    const { data, error: fetchErr } = await supabase
      .from("about_content")
      .select("id")
      .eq("id", 1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!data) {
      const legacy = readLegacy<Partial<AboutContent>>("aboutContent");
      const { error } = await (supabase.from("about_content") as any).upsert({
        id: 1,
        data: { ...defaultAboutContent, ...(legacy ?? {}) },
      });
      if (error) throw error;
      result.aboutContent = 1;
    } else {
      result.aboutContent = 0;
    }
  }

  return result;
}

/**
 * Instructors used to be localStorage-only (like packages/testimonials/etc).
 * They now live in Supabase (see supabase/schema.sql) so a student or
 * instructor checking their lessons from their own phone can resolve
 * instructor names — a browser-local list can't do that. See
 * migrateLocalInstructorsToSupabase() below for the one-time move.
 */
function instructorFromRow(row: any): Instructor {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    years: row.years,
    languages: row.languages,
    bio: row.bio,
    photo: row.photo ?? undefined,
    phone: row.phone ?? undefined,
  };
}

function instructorToRow(item: Partial<Instructor>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "id")) row.id = item.id;
  if (has(item, "slug")) row.slug = item.slug;
  if (has(item, "name")) row.name = item.name;
  if (has(item, "years")) row.years = item.years;
  if (has(item, "languages")) row.languages = item.languages;
  if (has(item, "bio")) row.bio = item.bio;
  if (has(item, "photo")) row.photo = item.photo || null;
  if (has(item, "phone")) row.phone = item.phone || null;
  return row;
}

export const useInstructors = () =>
  useRemoteCollection<Instructor>({
    key: "instructors",
    table: "instructors",
    orderColumn: "name",
    fromRow: instructorFromRow,
    toRow: instructorToRow,
  });

/**
 * Photos live in Supabase (table + Storage bucket, see
 * supabase/003_photos_storage_bucket.sql) instead of localStorage. Only the
 * bucket public URL is stored in the `src` column — the actual image bytes
 * live in Storage, not in Postgres or the browser.
 */
function photoFromRow(row: any): Photo {
  return {
    id: row.id,
    src: row.src,
    caption: row.caption,
    category: row.category,
    status: row.status,
    createdAt: row.created_at,
  };
}

function photoToRow(item: Partial<Photo>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "src")) row.src = item.src;
  if (has(item, "caption")) row.caption = item.caption;
  if (has(item, "category")) row.category = item.category;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  return row;
}

export const usePhotos = () =>
  useRemoteCollection<Photo>({
    key: "photos",
    table: "photos",
    orderColumn: "created_at",
    fromRow: photoFromRow,
    toRow: photoToRow,
  });

/**
 * Combined fetch used only by the homepage route loader, so its data can be
 * requested on the server (or during route preload) BEFORE the page renders,
 * instead of the usual pattern (see `ensureRemoteLoaded` above) where every
 * hook waits for the component to mount client-side and only then asks
 * Supabase for data. The four queries still run in parallel either way —
 * this only changes *when* they start, not how many there are.
 *
 * Also seeds the same module-level cache the regular hooks read from, so
 * once this resolves, usePackages()/usePhotos()/usePromotions()/useSettings()
 * on the homepage see the data immediately too, with no second fetch.
 */
export async function fetchHomeData() {
  const [packagesRes, photosRes, promotionsRes, settingsRes] = await Promise.all([
    supabase.from("packages").select("*").order("price", { ascending: true }),
    supabase.from("photos").select("*").order("created_at", { ascending: false }),
    supabase.from("promotions").select("*").order("title", { ascending: true }),
    supabase.from("settings").select("data").eq("id", 1).maybeSingle(),
  ]);

  if (packagesRes.error) throw packagesRes.error;
  if (photosRes.error) throw photosRes.error;
  if (promotionsRes.error) throw promotionsRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const packages = (packagesRes.data ?? []).map(packageFromRow);
  const photos = (photosRes.data ?? []).map(photoFromRow);
  const promotions = (promotionsRes.data ?? []).map(promotionFromRow);
  const settings = settingsRes.data
    ? { ...defaultSettings, ...(settingsRes.data as any).data }
    : defaultSettings;

  // Seed the shared store used by the regular hooks, and mark each key as
  // already loaded so ensureRemoteLoaded() skips its own fetch on mount.
  writeRemote<Package>("packages", packages);
  writeRemote<Photo>("photos", photos);
  writeRemote<Promotion>("promotions", promotions);
  remoteFetchState.set("packages", "done");
  remoteFetchState.set("photos", "done");
  remoteFetchState.set("promotions", "done");
  remoteSingletonCache.set("settings", settings);
  remoteSingletonFetchState.set("settings", "done");

  return { packages, photos, promotions, settings };
}

/**
 * Same idea as fetchHomeData above, one per public page that has several
 * hooks firing on mount. Each seeds the shared store so the page's regular
 * hooks (useInstructors(), usePhotos(), etc.) find their data already
 * loaded instead of triggering their own fetch.
 */
export async function fetchAboutData() {
  const [instructorsRes, teamRes, photosRes, sectionsRes, aboutContentRes] = await Promise.all([
    supabase.from("instructors").select("*").order("name", { ascending: false }),
    supabase.from("team").select("*").order("name", { ascending: true }),
    supabase.from("photos").select("*").order("created_at", { ascending: false }),
    supabase.from("about_sections").select("*").order("position", { ascending: true }),
    supabase.from("about_content").select("data").eq("id", 1).maybeSingle(),
  ]);
  if (instructorsRes.error) throw instructorsRes.error;
  if (teamRes.error) throw teamRes.error;
  if (photosRes.error) throw photosRes.error;
  if (sectionsRes.error) throw sectionsRes.error;
  if (aboutContentRes.error) throw aboutContentRes.error;

  const instructors = (instructorsRes.data ?? []).map(instructorFromRow);
  const team = (teamRes.data ?? []).map(teamMemberFromRow);
  const photos = (photosRes.data ?? []).map(photoFromRow);
  const aboutSections = (sectionsRes.data ?? []).map(aboutSectionFromRow);
  const aboutContent = aboutContentRes.data
    ? { ...defaultAboutContent, ...(aboutContentRes.data as any).data }
    : defaultAboutContent;

  writeRemote<Instructor>("instructors", instructors);
  writeRemote<TeamMember>("team", team);
  writeRemote<Photo>("photos", photos);
  writeRemote<AboutSection>("aboutSections", aboutSections);
  remoteFetchState.set("instructors", "done");
  remoteFetchState.set("team", "done");
  remoteFetchState.set("photos", "done");
  remoteFetchState.set("aboutSections", "done");
  remoteSingletonCache.set("aboutContent", aboutContent);
  remoteSingletonFetchState.set("aboutContent", "done");

  return { instructors, team, photos, aboutSections, aboutContent };
}

export async function fetchInstructorsData() {
  const { data, error } = await supabase
    .from("instructors")
    .select("*")
    .order("name", { ascending: false });
  if (error) throw error;
  const instructors = (data ?? []).map(instructorFromRow);
  writeRemote<Instructor>("instructors", instructors);
  remoteFetchState.set("instructors", "done");
  return { instructors };
}

export async function fetchPackagesPageData() {
  const [packagesRes, promotionsRes, studentsRes] = await Promise.all([
    supabase.from("packages").select("*").order("price", { ascending: true }),
    supabase.from("promotions").select("*").order("title", { ascending: true }),
    supabase.from("students").select("*").order("enrolled_at", { ascending: false }),
  ]);
  if (packagesRes.error) throw packagesRes.error;
  if (promotionsRes.error) throw promotionsRes.error;
  if (studentsRes.error) throw studentsRes.error;

  const packages = (packagesRes.data ?? []).map(packageFromRow);
  const promotions = (promotionsRes.data ?? []).map(promotionFromRow);
  const students = (studentsRes.data ?? []).map(studentFromRow);

  writeRemote<Package>("packages", packages);
  writeRemote<Promotion>("promotions", promotions);
  writeRemote<Student>("students", students);
  remoteFetchState.set("packages", "done");
  remoteFetchState.set("promotions", "done");
  remoteFetchState.set("students", "done");

  return { packages, promotions, students };
}

export async function fetchGalleryData() {
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const photos = (data ?? []).map(photoFromRow);
  writeRemote<Photo>("photos", photos);
  remoteFetchState.set("photos", "done");
  return { photos };
}

export async function fetchContactData() {
  const [enquiriesRes, packagesRes, photosRes, settingsRes] = await Promise.all([
    supabase.from("enquiries").select("*").order("created_at", { ascending: false }),
    supabase.from("packages").select("*").order("price", { ascending: true }),
    supabase.from("photos").select("*").order("created_at", { ascending: false }),
    supabase.from("settings").select("data").eq("id", 1).maybeSingle(),
  ]);
  if (enquiriesRes.error) throw enquiriesRes.error;
  if (packagesRes.error) throw packagesRes.error;
  if (photosRes.error) throw photosRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const enquiries = (enquiriesRes.data ?? []).map(enquiryFromRow);
  const packages = (packagesRes.data ?? []).map(packageFromRow);
  const photos = (photosRes.data ?? []).map(photoFromRow);
  const settings = settingsRes.data
    ? { ...defaultSettings, ...(settingsRes.data as any).data }
    : defaultSettings;

  writeRemote<Enquiry>("enquiries", enquiries);
  writeRemote<Package>("packages", packages);
  writeRemote<Photo>("photos", photos);
  remoteFetchState.set("enquiries", "done");
  remoteFetchState.set("packages", "done");
  remoteFetchState.set("photos", "done");
  remoteSingletonCache.set("settings", settings);
  remoteSingletonFetchState.set("settings", "done");

  return { enquiries, packages, photos, settings };
}

export async function fetchTipsData() {
  const { data, error } = await supabase
    .from("tips")
    .select("*")
    .order("title", { ascending: true });
  if (error) throw error;
  const tips = (data ?? []).map(tipFromRow);
  writeRemote<Tip>("tips", tips);
  remoteFetchState.set("tips", "done");
  return { tips };
}

const PHOTOS_BUCKET = "photos";

/**
 * Uploads a File to the "photos" Storage bucket and returns its public URL.
 * Use this (not fileToDataUrl) for anything that ends up in the `photos`
 * table — that keeps the actual image bytes out of Postgres/localStorage
 * entirely, which is what makes the gallery fast to load.
 */
export async function uploadPhotoToStorage(file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${uid()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file, {
    cacheControl: "31536000", // 1 year — filenames are random, so a new upload never collides with a cached one
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const TEST_FILES_BUCKET = "test-files";

/**
 * Uploads a File to the "test-files" Storage bucket and returns its public
 * URL. Use this (not fileToDataUrl) for test papers and answer keys.
 *
 * Test papers used to be saved with fileToDataUrl — the whole file base64-
 * encoded straight into the `tests.paper` text column. A phone photo easily
 * base64s out to several MB, and at that size the row round-trips
 * unreliably: PostgREST/Realtime have payload limits well under that, so a
 * big paper can silently fail to save in full, or fail to come back intact
 * on read — which is exactly the "test paper" image showing as a broken
 * image on the student's test page. Storing only a short public URL in the
 * column (same pattern as uploadPhotoToStorage for the photos table) avoids
 * that entirely, same as it already does for gallery photos.
 */
export async function uploadTestFileToStorage(file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${uid()}.${ext}`;
  const { error } = await supabase.storage.from(TEST_FILES_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(TEST_FILES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * One-time move of instructors from this browser's localStorage into
 * Supabase. Safe to call repeatedly — it's a no-op once the instructors
 * table already has rows (whether from a previous migration or from adding
 * instructors directly in the new admin UI).
 *
 * Local instructor ids were browser-generated strings (uid()), not valid
 * Postgres uuids, so migrating means handing out new ids. Any lessons
 * already created against the old ids are remapped by matching instructor
 * name so the Schedule panel doesn't suddenly show "Unassigned".
 *
 * Falls back to the site's original default instructors if this browser
 * never had any saved locally, so a fresh install still gets seeded.
 */
export async function migrateLocalInstructorsToSupabase(): Promise<{ migrated: number }> {
  const { count, error: countErr } = await supabase
    .from("instructors")
    .select("id", { count: "exact", head: true });
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return { migrated: 0 };

  let legacy: Instructor[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + "instructors");
    if (raw) legacy = JSON.parse(raw);
  } catch {
    /* corrupt or unavailable storage */
  }
  if (legacy.length === 0) legacy = defaultInstructors;
  if (legacy.length === 0) return { migrated: 0 };

  const { data: inserted, error } = await (supabase.from("instructors") as any)
    .insert(
      legacy.map((l) => ({
        slug: l.slug,
        name: l.name,
        years: l.years,
        languages: l.languages,
        bio: l.bio,
        photo: l.photo ?? null,
      })),
    )
    .select();
  if (error) throw error;

  for (const old of legacy) {
    const match = (inserted ?? []).find((row: any) => row.name === old.name);
    if (!match) continue;
    const { error: lessonErr } = await (supabase.from("lessons") as any)
      .update({ instructor_id: match.id })
      .eq("instructor_id", old.id);
    if (lessonErr) throw lessonErr;
  }

  try {
    localStorage.removeItem(LEGACY_PREFIX + "instructors");
  } catch {
    /* best-effort cleanup only */
  }

  return { migrated: inserted?.length ?? 0 };
}

/** True when this browser still has an un-migrated local instructor list. */
export function hasLegacyLocalInstructors(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + "instructors");
    return !!raw && JSON.parse(raw).length > 0;
  } catch {
    return false;
  }
}

/** Set (or change) the PIN an instructor uses to check their own schedule. */
export async function setInstructorPin(instructorId: string, pin: string): Promise<void> {
  const { error } = await (supabase as any).rpc("set_instructor_pin", {
    p_instructor_id: instructorId,
    p_pin: pin.trim(),
  });
  if (error) throw error;
}

/** True/false only — never returns the PIN itself. Safe to call from the
 *  admin UI even though it runs on the shared anon key. */
export async function instructorHasPin(instructorId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("instructor_has_pin", {
    p_instructor_id: instructorId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function clearInstructorPin(instructorId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("clear_instructor_pin", {
    p_instructor_id: instructorId,
  });
  if (error) throw error;
}

/* ----------------------- public lesson self-lookup ----------------------- */

export interface MyLesson {
  id: string;
  lessonType: LessonType;
  startsAt: string;
  minutes: number;
  status: LessonStatus;
  /** Present when looked up as a student. */
  instructorName?: string;
  /** Present when looked up as an instructor. */
  studentName?: string;
}

/** Returns null when the name/phone don't match any student. */
export async function fetchMyLessonsAsStudent(
  name: string,
  phoneLast4: string,
): Promise<{ studentName: string; lessons: MyLesson[] } | null> {
  const { data, error } = await (supabase as any).rpc("get_my_lessons_student", {
    p_name: name,
    p_phone_last4: phoneLast4,
  });
  if (error) throw error;
  return (data as { studentName: string; lessons: MyLesson[] } | null) ?? null;
}

/** Returns null when the name/PIN don't match any instructor. */
export async function fetchMyLessonsAsInstructor(
  name: string,
  pin: string,
): Promise<{ instructorName: string; lessons: MyLesson[] } | null> {
  const { data, error } = await (supabase as any).rpc("get_my_lessons_instructor", {
    p_name: name,
    p_pin: pin,
  });
  if (error) throw error;
  return (data as { instructorName: string; lessons: MyLesson[] } | null) ?? null;
}

function studentFromRow(row: any): Student {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    packageId: row.package_id ?? "",
    enrolledAt: row.enrolled_at,
    status: row.status,
    enquiryId: row.enquiry_id ?? undefined,
  };
}

function studentToRow(item: Partial<Student>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "name")) row.name = item.name;
  if (has(item, "phone")) row.phone = item.phone;
  if (has(item, "packageId")) row.package_id = item.packageId || null;
  if (has(item, "enrolledAt")) row.enrolled_at = item.enrolledAt;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "enquiryId")) row.enquiry_id = item.enquiryId || null;
  return row;
}

export const useStudents = () =>
  useRemoteCollection<Student>({
    key: "students",
    table: "students",
    orderColumn: "enrolled_at",
    fromRow: studentFromRow,
    toRow: studentToRow,
  });

/**
 * Insert a student and await the real, database-generated id.
 *
 * The optimistic `add()` from useStudents() returns a temporary client-side
 * id immediately and only resolves the real one in the background — fine
 * for simple "create a row" actions, but not safe when the very next step
 * needs a valid id to link elsewhere (e.g. setting payments.student_id or
 * enquiries' enrolled link), since a temporary id is not a real uuid and a
 * write using it would fail. Use this instead whenever the new student's
 * real id is needed straight away, such as in the enrolment flow.
 */
export async function createStudent(item: Omit<Student, "id">): Promise<Student> {
  const { data, error } = await (supabase.from("students") as any)
    .insert(studentToRow(item))
    .select()
    .single();
  if (error) throw error;
  const saved = studentFromRow(data);
  writeRemote<Student>("students", [saved, ...readRemote<Student>("students")]);
  return saved;
}

/**
 * Custom About-page blocks live in the `about_sections` table, which has a
 * persisted `position` column — unlike team/instructors, reordering here
 * survives a reload.
 */
function aboutSectionFromRow(row: any): AboutSection {
  return {
    id: row.id,
    type: row.type,
    heading: row.heading,
    body: row.body,
    image: row.image ?? undefined,
    imagePosition: row.image_position,
  };
}

/** Ordered custom About-page blocks — appends at the end and supports reorder. */
export function useAboutSections() {
  useEffect(() => {
    ensureRemoteLoaded("aboutSections", "about_sections", "position", aboutSectionFromRow, true);
  }, []);

  const items = useRemoteKey<AboutSection>("aboutSections");

  const append = useCallback((section: Omit<AboutSection, "id">) => {
    const tempId = uid();
    const current = readRemote<AboutSection>("aboutSections");
    const optimistic = { ...section, id: tempId } as AboutSection;
    writeRemote<AboutSection>("aboutSections", [...current, optimistic]);
    (async () => {
      try {
        const { data, error } = await (supabase.from("about_sections") as any)
          .insert({
            type: section.type,
            heading: section.heading,
            body: section.body,
            image: section.image || null,
            image_position: section.imagePosition,
            position: current.length,
          })
          .select()
          .single();
        if (error) throw error;
        const saved = aboutSectionFromRow(data);
        writeRemote<AboutSection>(
          "aboutSections",
          readRemote<AboutSection>("aboutSections").map((s) => (s.id === tempId ? saved : s)),
        );
      } catch (err) {
        writeRemote<AboutSection>(
          "aboutSections",
          readRemote<AboutSection>("aboutSections").filter((s) => s.id !== tempId),
        );
        reportRemoteError("save", "aboutSections", err);
      }
    })();
    return optimistic;
  }, []);

  const update = useCallback((id: string, patch: Partial<AboutSection>) => {
    const prev = readRemote<AboutSection>("aboutSections");
    writeRemote<AboutSection>(
      "aboutSections",
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    (async () => {
      try {
        const row: Record<string, unknown> = {};
        if (has(patch, "type")) row.type = patch.type;
        if (has(patch, "heading")) row.heading = patch.heading;
        if (has(patch, "body")) row.body = patch.body;
        if (has(patch, "image")) row.image = patch.image || null;
        if (has(patch, "imagePosition")) row.image_position = patch.imagePosition;
        const { error } = await (supabase.from("about_sections") as any).update(row).eq("id", id);
        if (error) throw error;
      } catch (err) {
        writeRemote<AboutSection>("aboutSections", prev);
        reportRemoteError("update", "aboutSections", err);
      }
    })();
  }, []);

  const remove = useCallback((id: string) => {
    const prev = readRemote<AboutSection>("aboutSections");
    writeRemote<AboutSection>(
      "aboutSections",
      prev.filter((s) => s.id !== id),
    );
    (async () => {
      try {
        const { error } = await supabase.from("about_sections").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        writeRemote<AboutSection>("aboutSections", prev);
        reportRemoteError("delete", "aboutSections", err);
      }
    })();
  }, []);

  const move = useCallback((id: string, direction: -1 | 1) => {
    const prev = readRemote<AboutSection>("aboutSections");
    const list = [...prev];
    const i = list.findIndex((s) => s.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    writeRemote<AboutSection>("aboutSections", list);
    (async () => {
      try {
        const { error: e1 } = await (supabase.from("about_sections") as any)
          .update({ position: i })
          .eq("id", list[i].id);
        if (e1) throw e1;
        const { error: e2 } = await (supabase.from("about_sections") as any)
          .update({ position: j })
          .eq("id", list[j].id);
        if (e2) throw e2;
      } catch (err) {
        writeRemote<AboutSection>("aboutSections", prev);
        reportRemoteError("reorder", "aboutSections", err);
      }
    })();
  }, []);

  return { items, append, update, remove, move };
}

/**
 * `settings` and `about_content` are single-row tables (id, data jsonb) —
 * one shared record instead of a collection. Same optimistic-update /
 * rollback-on-error shape as the collections above.
 */
type RemoteSingletonKey = "settings" | "aboutContent";

const remoteSingletonCache = new Map<RemoteSingletonKey, unknown>();
const remoteSingletonFetchState = new Map<RemoteSingletonKey, "loading" | "done">();

function ensureSingletonLoaded<T>(key: RemoteSingletonKey, table: string, fallback: T) {
  if (typeof window === "undefined") return;
  if (remoteSingletonFetchState.get(key)) return;
  remoteSingletonFetchState.set(key, "loading");
  (async () => {
    try {
      const { data, error } = await supabase.from(table).select("data").eq("id", 1).maybeSingle();
      if (error) throw error;
      remoteSingletonCache.set(key, data ? { ...fallback, ...(data as any).data } : fallback);
      emit();
    } catch (err) {
      reportRemoteError("load", key, err);
    } finally {
      remoteSingletonFetchState.set(key, "done");
    }
  })();
}

function useRemoteSingleton<T extends object>(key: RemoteSingletonKey, table: string, fallback: T) {
  useEffect(() => {
    ensureSingletonLoaded(key, table, fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, table]);

  // Same reasoning as useRemoteKey above: read the real cache on the server
  // snapshot too (not just the fallback), so a loader that already fetched
  // this (e.g. settings via fetchHomeData()) renders correctly on the very
  // first paint instead of flashing default/fallback content first.
  const snapshot = () => (remoteSingletonCache.get(key) as T | undefined) ?? fallback;
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);

  const save = useCallback(
    (patch: Partial<T>) => {
      const prev = (remoteSingletonCache.get(key) as T | undefined) ?? fallback;
      const next = { ...prev, ...patch };
      remoteSingletonCache.set(key, next);
      emit();
      (async () => {
        try {
          const { error } = await (supabase.from(table) as any).upsert({ id: 1, data: next });
          if (error) throw error;
        } catch (err) {
          remoteSingletonCache.set(key, prev);
          emit();
          reportRemoteError("save", key, err);
        }
      })();
    },
    [key, table, fallback],
  );

  return { value, save };
}

export function useAboutContent() {
  const { value, save } = useRemoteSingleton<AboutContent>(
    "aboutContent",
    "about_content",
    defaultAboutContent,
  );
  return { content: value, save };
}

export function useSettings() {
  const { value, save } = useRemoteSingleton<SiteSettings>("settings", "settings", defaultSettings);
  return { settings: value, save };
}

/* --------------------------------- helpers -------------------------------- */

export function isPromotionLive(p: Promotion, now = new Date()) {
  if (p.status === "expired") return false;
  const end = p.endDate ? new Date(p.endDate + "T23:59:59") : null;
  const start = p.startDate ? new Date(p.startDate + "T00:00:00") : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

export function publishedPhotos(photos: Photo[], category: PhotoCategory) {
  return photos.filter((p) => p.status === "published" && p.category === category);
}

/** WhatsApp deep link, optionally with a pre-filled message. */
export const waLink = (whatsapp: string, message?: string) =>
  `https://wa.me/${whatsapp.replace(/\D/g, "")}` +
  (message ? `?text=${encodeURIComponent(message)}` : "");

/** Bookable lesson start times offered on the contact form. */
export const TIME_SLOTS = ["07:00", "08:30", "10:00", "11:30", "13:00", "14:30", "16:00", "17:30"];

/* ----------------------------- file → data URL ----------------------------- */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB — localStorage placeholder limit
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

/* ------------------------- templates & booking rules ----------------------- */

/** Replace {token} placeholders in an admin-editable message template. */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "");
}

/** Tokens available inside the booking WhatsApp template. */
export const BOOKING_TEMPLATE_TOKENS = [
  "{ref}",
  "{name}",
  "{phone}",
  "{package}",
  "{days}",
  "{times}",
  "{slots}",
];

/** Short human-friendly booking reference, e.g. ADS-7K3Q9. */
export const bookingRef = () =>
  "ADS-" +
  Math.random()
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);

export const slotKey = (day: string, slot: string) => `${day}|${slot}`;

/** Every day+slot pair currently held by a live enquiry. */
export function bookedSlotKeys(enquiries: Enquiry[], ignoreId?: string) {
  const taken = new Set<string>();
  for (const e of enquiries) {
    if (e.id === ignoreId) continue;
    if (!ACTIVE_ENQUIRY_STATUSES.includes(e.status)) continue;
    for (const d of e.days) for (const s of e.slots ?? []) taken.add(slotKey(d, s));
  }
  return taken;
}

/** Day+slot pairs from a selection that clash with existing bookings. */
export function findClashes(days: string[], slots: string[], taken: Set<string>) {
  const clashes: string[] = [];
  for (const d of days)
    for (const s of slots) if (taken.has(slotKey(d, s))) clashes.push(`${d} ${s}`);
  return clashes;
}

/** Tokens available inside the payment WhatsApp template. */
export const PAYMENT_TEMPLATE_TOKENS = [
  "{name}",
  "{phone}",
  "{package}",
  "{amount}",
  "{reference}",
  "{note}",
];

/** Tokens available inside the welcome WhatsApp template, sent on enrolment. */
export const WELCOME_TEMPLATE_TOKENS = [
  "{name}",
  "{phone}",
  "{package}",
  "{days}",
  "{times}",
  "{ref}",
];

/** Tokens available inside the instructor-lesson WhatsApp template. */
export const INSTRUCTOR_LESSON_TEMPLATE_TOKENS = [
  "{instructor}",
  "{student}",
  "{date}",
  "{time}",
  "{type}",
  "{link}",
];

/** Tokens available inside the student-lesson WhatsApp template. */
export const STUDENT_LESSON_TEMPLATE_TOKENS = [
  "{student}",
  "{date}",
  "{time}",
  "{instructor}",
  "{type}",
  "{link}",
];

/** Tokens available inside the enquiry follow-up WhatsApp template. */
export const ENQUIRY_FOLLOWUP_TEMPLATE_TOKENS = [
  "{name}",
  "{phone}",
  "{package}",
  "{days}",
  "{times}",
  "{slots}",
  "{ref}",
];

/** Tokens available inside the weekly-plan WhatsApp template. */
export const WEEKLY_PLAN_TEMPLATE_TOKENS = [
  "{recipient}",
  "{student}",
  "{instructor}",
  "{schedule}",
  "{link}",
];

/** Turns a batch of lessons for one student+instructor into a readable,
 *  line-per-day block for the weekly-plan WhatsApp message. */
export function formatWeeklySchedule(
  entries: { startsAt: string; minutes: number; lessonType: LessonType }[],
) {
  return [...entries]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((l) => {
      const d = new Date(l.startsAt);
      const day = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `${day}, ${time} (${l.minutes}min, ${l.lessonType})`;
    })
    .join("\n");
}

/* ---------------------------------- tests --------------------------------- */

export type TestType = "mcq" | "pdf";

export interface Question {
  id: string;
  text: string;
  options: string[];
  correct: number;
}

export interface Test {
  id: string;
  title: string;
  type: TestType;
  minutes: number;
  questions: Question[];
  /** PDF-based test paper (data URL). */
  paper?: string;
  paperName?: string;
  /** Answer key — a PDF (data URL) and/or a typed list. */
  answerKey?: string;
  answerKeyName?: string;
  answerKeyText?: string;
  createdAt: string;
}

export type AssignmentStatus = "not-started" | "in-progress" | "submitted" | "expired";

export const ASSIGNMENT_STATUSES: { value: AssignmentStatus; label: string }[] = [
  { value: "not-started", label: "Not Started" },
  { value: "in-progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "expired", label: "Expired" },
];

export interface LogEntry {
  at: string;
  text: string;
}

export interface Assignment {
  id: string;
  testId: string;
  studentId: string;
  token: string;
  accessCode: string;
  /** true once the access code has been correctly entered — a used code cannot be entered again until renewed. */
  accessCodeUsed?: boolean;
  status: AssignmentStatus;
  startedAt?: string;
  submittedAt?: string;
  extensionMinutes: number;
  notes: string;
  log: LogEntry[];
  resultsToken?: string;
  createdAt: string;
}

export interface FlagEvent {
  at: string;
  type: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  testId: string;
  studentId: string;
  /** questionId → chosen option index (multiple choice). */
  answers: Record<string, number>;
  typed?: string;
  photo?: string;
  photoName?: string;
  flags: FlagEvent[];
  autoScore?: number;
  autoTotal?: number;
  mark?: string;
  feedback?: string;
  /** Question-by-question breakdown from the "pdf" test auto-match, saved
   *  here only when the marker explicitly chooses to share it — presence of
   *  this field is what makes the student's results page show it. Reuses
   *  the shape produced by matchPdfAnswers so there's one source of truth
   *  for "what does a match row look like". */
  answerBreakdown?: PdfMatchRow[];
  submittedAt: string;
}

function testFromRow(row: any): Test {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    minutes: row.minutes,
    questions: row.questions ?? [],
    paper: row.paper ?? undefined,
    paperName: row.paper_name ?? undefined,
    answerKey: row.answer_key ?? undefined,
    answerKeyName: row.answer_key_name ?? undefined,
    answerKeyText: row.answer_key_text ?? undefined,
    createdAt: row.created_at,
  };
}

function testToRow(item: Partial<Test>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "title")) row.title = item.title;
  if (has(item, "type")) row.type = item.type;
  if (has(item, "minutes")) row.minutes = item.minutes;
  if (has(item, "questions")) row.questions = item.questions;
  if (has(item, "paper")) row.paper = item.paper || null;
  if (has(item, "paperName")) row.paper_name = item.paperName || null;
  if (has(item, "answerKey")) row.answer_key = item.answerKey || null;
  if (has(item, "answerKeyName")) row.answer_key_name = item.answerKeyName || null;
  if (has(item, "answerKeyText")) row.answer_key_text = item.answerKeyText || null;
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  return row;
}

export const useTests = () =>
  useRemoteCollection<Test>({
    key: "tests",
    table: "tests",
    orderColumn: "created_at",
    fromRow: testFromRow,
    toRow: testToRow,
  });

function assignmentFromRow(row: any): Assignment {
  return {
    id: row.id,
    testId: row.test_id,
    studentId: row.student_id,
    token: row.token,
    accessCode: row.access_code,
    accessCodeUsed: row.access_code_used ?? undefined,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    extensionMinutes: row.extension_minutes,
    notes: row.notes ?? "",
    log: row.log ?? [],
    resultsToken: row.results_token ?? undefined,
    createdAt: row.created_at,
  };
}

function assignmentToRow(item: Partial<Assignment>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "testId")) row.test_id = item.testId;
  if (has(item, "studentId")) row.student_id = item.studentId;
  if (has(item, "token")) row.token = item.token;
  if (has(item, "accessCode")) row.access_code = item.accessCode;
  if (has(item, "accessCodeUsed")) row.access_code_used = item.accessCodeUsed;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "startedAt")) row.started_at = item.startedAt || null;
  if (has(item, "submittedAt")) row.submitted_at = item.submittedAt || null;
  if (has(item, "extensionMinutes")) row.extension_minutes = item.extensionMinutes;
  if (has(item, "notes")) row.notes = item.notes;
  if (has(item, "log")) row.log = item.log;
  if (has(item, "resultsToken")) row.results_token = item.resultsToken || null;
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  return row;
}

export const useAssignments = () =>
  useRemoteCollection<Assignment>({
    key: "assignments",
    table: "assignments",
    orderColumn: "created_at",
    fromRow: assignmentFromRow,
    toRow: assignmentToRow,
  });

function submissionFromRow(row: any): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    testId: row.test_id,
    studentId: row.student_id,
    answers: row.answers ?? {},
    typed: row.typed ?? undefined,
    photo: row.photo ?? undefined,
    photoName: row.photo_name ?? undefined,
    flags: row.flags ?? [],
    autoScore: row.auto_score ?? undefined,
    autoTotal: row.auto_total ?? undefined,
    mark: row.mark ?? undefined,
    feedback: row.feedback ?? undefined,
    answerBreakdown: row.answer_breakdown ?? undefined,
    submittedAt: row.submitted_at,
  };
}

function submissionToRow(item: Partial<Submission>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "assignmentId")) row.assignment_id = item.assignmentId;
  if (has(item, "testId")) row.test_id = item.testId;
  if (has(item, "studentId")) row.student_id = item.studentId;
  if (has(item, "answers")) row.answers = item.answers;
  if (has(item, "typed")) row.typed = item.typed || null;
  if (has(item, "photo")) row.photo = item.photo || null;
  if (has(item, "photoName")) row.photo_name = item.photoName || null;
  if (has(item, "flags")) row.flags = item.flags;
  if (has(item, "autoScore")) row.auto_score = item.autoScore ?? null;
  if (has(item, "autoTotal")) row.auto_total = item.autoTotal ?? null;
  if (has(item, "mark")) row.mark = item.mark || null;
  if (has(item, "feedback")) row.feedback = item.feedback || null;
  if (has(item, "answerBreakdown")) row.answer_breakdown = item.answerBreakdown ?? null;
  if (has(item, "submittedAt")) row.submitted_at = item.submittedAt;
  return row;
}

export const useSubmissions = () =>
  useRemoteCollection<Submission>({
    key: "submissions",
    table: "submissions",
    orderColumn: "submitted_at",
    fromRow: submissionFromRow,
    toRow: submissionToRow,
  });

/* --------------------------------- lessons --------------------------------- */

export type LessonType = "provisional" | "driving";
export type LessonStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export interface Lesson {
  id: string;
  studentId: string;
  instructorId: string;
  lessonType: LessonType;
  startsAt: string; // ISO datetime
  minutes: number;
  notes: string;
  status: LessonStatus;
  createdAt: string;
}

function lessonFromRow(row: any): Lesson {
  return {
    id: row.id,
    studentId: row.student_id,
    instructorId: row.instructor_id,
    lessonType: row.lesson_type,
    startsAt: row.starts_at,
    minutes: row.minutes,
    notes: row.notes ?? "",
    status: row.status,
    createdAt: row.created_at,
  };
}

function lessonToRow(item: Partial<Lesson>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (has(item, "studentId")) row.student_id = item.studentId;
  if (has(item, "instructorId")) row.instructor_id = item.instructorId;
  if (has(item, "lessonType")) row.lesson_type = item.lessonType;
  if (has(item, "startsAt")) row.starts_at = item.startsAt;
  if (has(item, "minutes")) row.minutes = item.minutes;
  if (has(item, "notes")) row.notes = item.notes;
  if (has(item, "status")) row.status = item.status;
  if (has(item, "createdAt")) row.created_at = item.createdAt;
  return row;
}

export const useLessons = () =>
  useRemoteCollection<Lesson>({
    key: "lessons",
    table: "lessons",
    orderColumn: "starts_at",
    fromRow: lessonFromRow,
    toRow: lessonToRow,
  });

/**
 * Client-side check only — for instant feedback in the UI before saving.
 * The database's exclude constraint (supabase/004_lessons_schedule.sql) is
 * what actually prevents double-booking; this can't be relied on alone
 * since two people could be scheduling at the same moment on different
 * devices.
 */
export function findLessonConflict(
  lessons: Lesson[],
  candidate: { id?: string; instructorId: string; startsAt: string; minutes: number },
): Lesson | null {
  const start = new Date(candidate.startsAt).getTime();
  const end = start + candidate.minutes * 60_000;
  return (
    lessons.find((l) => {
      if (l.id === candidate.id) return false;
      if (l.instructorId !== candidate.instructorId) return false;
      if (l.status !== "scheduled") return false;
      const lStart = new Date(l.startsAt).getTime();
      const lEnd = lStart + l.minutes * 60_000;
      return start < lEnd && lStart < end;
    }) ?? null
  );
}

/** Long random single-use token. */
export const makeToken = () =>
  Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("");

/** Short 6-digit code a student types in alongside their name/phone to start a test. */
export const makeAccessCode = () => String(Math.floor(100000 + Math.random() * 900000));

export function gradeMcq(test: Test, answers: Record<string, number>) {
  const total = test.questions.length;
  const score = test.questions.filter((q) => answers[q.id] === q.correct).length;
  return { score, total };
}

/** A test is publishable only when it has what it needs. */
export function testIsReady(t: Test) {
  if (t.type === "mcq")
    return t.questions.length > 0 && t.questions.every((q) => q.options.length >= 2);
  return Boolean(t.paper) && Boolean(t.answerKey || (t.answerKeyText ?? "").trim());
}

/** Explains WHY a test isn't ready yet, or null when it is. Same rule as
 *  testIsReady — kept in sync with it — but spells out what's missing
 *  instead of a flat "not finished" so it's obvious what to fix. */
export function testReadyReason(t: Test): string | null {
  if (t.type === "mcq") {
    if (t.questions.length === 0) return "Add at least one question";
    const badQuestion = t.questions.find((q) => q.options.length < 2);
    if (badQuestion) return "Every question needs at least 2 options";
    return null;
  }
  if (!t.paper) return "Upload a test paper";
  if (!t.answerKey && !(t.answerKeyText ?? "").trim()) return "Add an answer key, upload a PDF or type the answers";
  return null;
}

/** Total minutes allowed for an assignment, including any extension. */
export const allowedMinutes = (test: Test, a: Assignment) =>
  test.minutes + (a.extensionMinutes || 0);

/** Milliseconds left, or null when not started. */
export function timeLeftMs(test: Test, a: Assignment, now = Date.now()) {
  if (!a.startedAt) return null;
  const end = new Date(a.startedAt).getTime() + allowedMinutes(test, a) * 60_000;
  return Math.max(0, end - now);
}

export const last4 = (phone: string) => phone.replace(/\D/g, "").slice(-4);