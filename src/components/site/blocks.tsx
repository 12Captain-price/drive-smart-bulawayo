import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  CalendarClock,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Phone,
  PhoneCall,
  Quote,
  RotateCw,
  ShieldCheck,
  Star,
  Trophy,
  Users,
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
} from "@/components/ui/dialog";
import { BannerImage } from "./BannerImage";
import { StarRating } from "./StarRating";
import {
  errorMessage,
  isPromotionLive,
  publishedPhotos,
  useTestimonials,
  usePhotos,
  usePromotions,
  useSettings,
  waLink,
  type Package,
  type Promotion,
  type TrustIconKey,
} from "@/lib/data";
import { placeholderHero } from "@/lib/placeholders";
import { cn } from "@/lib/utils";

/** Shared icon set for the homepage trust strip — used here and in the
 *  admin Site Settings icon picker so both stay in sync. */
export const TRUST_ICONS: Record<TrustIconKey, typeof ShieldCheck> = {
  shield: ShieldCheck,
  car: Car,
  calendar: CalendarClock,
  clock: Clock,
  mapPin: MapPin,
  phone: Phone,
  users: Users,
  award: Award,
};

export const TRUST_ICON_LABELS: Record<TrustIconKey, string> = {
  shield: "Shield",
  car: "Car",
  calendar: "Calendar",
  clock: "Clock",
  mapPin: "Map pin",
  phone: "Phone",
  users: "Users",
  award: "Award",
};

/** The trust badges shown under the hero — text and icon are editable in
 *  Site Settings. */
export function TrustStrip() {
  const { settings } = useSettings();
  return (
    <div className="bg-secondary/60 border-y border-dashed">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3 sm:gap-6 sm:py-8">
        {settings.trustStrip.map((item, i) => {
          const Icon = TRUST_ICONS[item.icon] ?? ShieldCheck;
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-3 text-center text-sm font-medium sm:text-left"
            >
              <Icon className="text-accent size-5 shrink-0" /> {item.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-6xl px-4 py-14 sm:py-16", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="label-mono text-accent">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-3 text-sm sm:text-base">{subtitle}</p>}
    </div>
  );
}

/**
 * A photo shown "in full" (never cropped) but dressed up so the empty
 * space around it doesn't read as a plain grey box: a softly blurred,
 * saturated copy of the same photo fills the frame behind it. Falls back
 * to `fallback` (e.g. an icon) when there's no photo yet.
 */
export function FramedPhoto({
  src,
  alt,
  className,
  imgClassName,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
}) {
  if (!src) {
    return (
      <div className={cn("bg-secondary text-muted-foreground flex items-center justify-center", className)}>
        {fallback}
      </div>
    );
  }
  return (
    <div className={cn("bg-secondary relative isolate overflow-hidden", className)}>
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-80 blur-3xl saturate-150" />
      <div className="from-background/25 via-background/5 absolute inset-0 bg-gradient-to-t to-transparent" />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn("relative h-full w-full object-contain drop-shadow-[0_8px_24px_rgb(0_0_0_/_0.25)]", imgClassName)}
      />
    </div>
  );
}

/* --------------------------------- carousel -------------------------------- */

export function HeroCarousel({
  children,
  badge,
}: {
  children?: React.ReactNode;
  /** Pinned to the top-right corner of the photo card. */
  badge?: React.ReactNode;
}) {
  const { items: photos } = usePhotos();
  const uploaded = publishedPhotos(photos, "hero");
  const slides = uploaded.length
    ? uploaded.map((p) => ({ src: p.src, caption: p.caption }))
    : placeholderHero;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), 2000);
    return () => clearTimeout(t);
  }, [index, paused, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);

  return (
    <div className="hero-dark bg-background relative overflow-hidden">
      {/* Dashed lane-marking run through the hero itself as the visual
         spine between the headline and the photo — the same road motif
         used in LaneDivider / HowItWorks, not confined to a section
         further down the page. */}
      <div
        aria-hidden="true"
        className="border-accent/35 absolute inset-y-16 left-1/2 hidden w-0 -translate-x-1/2 border-l-2 border-dashed lg:block"
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
        {/* left: headline / CTA content, supplied by the page */}
        <div className="relative z-10">{children}</div>

        {/* right: photo carousel card, framed like a windscreen/mirror
           rather than a generic rounded product-shot card */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            className="border-accent/40 ring-border relative aspect-[4/5] w-full overflow-hidden rounded-3xl border-2 shadow-xl ring-1 ring-offset-4 ring-offset-background sm:aspect-[3/4]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX === null) return;
              const dx = e.changedTouches[0].clientX - touchX;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              setTouchX(null);
            }}
          >
            {slides.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700",
                  i === index ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <img
                  src={s.src}
                  alt={s.caption || "Auto Driving School"}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

            {slides[index]?.caption && (
              <span className="bg-background/90 text-foreground absolute bottom-4 left-4 rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-wide uppercase shadow-sm backdrop-blur-sm">
                {slides[index].caption}
              </span>
            )}

            {badge && <div className="absolute top-3 right-3 z-20">{badge}</div>}

            <HeroReviewCard />
          </div>

          {slides.length > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  aria-label="Previous photo"
                  onClick={() => go(-1)}
                  className="border-border bg-secondary text-foreground hover:bg-secondary/70 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </button>
                <button
                  aria-label="Next photo"
                  onClick={() => go(1)}
                  className="border-border bg-secondary text-foreground hover:bg-secondary/70 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Next <ChevronRight className="size-3.5" />
                </button>
              </div>
              <span className="text-muted-foreground font-mono text-xs">
                {index + 1} / {slides.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A small review chip pinned to the hero photo card, cycling through
 *  published testimonials on its own timer — independent of the photo
 *  slideshow above, so the two never jump at the same moment. */
function HeroReviewCard() {
  const { items } = useTestimonials();
  const published = items.filter((t) => t.status === "published");
  const [i, setI] = useState(0);

  useEffect(() => {
    if (published.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % published.length), 4500);
    return () => clearInterval(t);
  }, [published.length]);

  if (!published.length) return null;
  const review = published[i % published.length];

  return (
    <div className="bg-background/95 border-border/60 absolute right-3 bottom-3 z-20 max-w-[12rem] rounded-xl border p-3 shadow-lg backdrop-blur-sm sm:max-w-[14rem]">
      <StarRating value={review.rating} size={12} />
      <p
        key={review.id}
        className="text-foreground motion-safe:animate-in motion-safe:fade-in mt-1.5 line-clamp-2 text-xs leading-snug duration-500"
      >
        “{review.comment}”
      </p>
      <p className="text-muted-foreground mt-1.5 truncate font-mono text-[10px] font-bold tracking-wide uppercase">
        {review.name}
      </p>
    </div>
  );
}

/* ------------------------------ lane divider -------------------------------- */

/** A dashed lane-marking used as a section divider instead of a plain hairline. */
export function LaneDivider() {
  return (
    <div className="mx-auto flex max-w-6xl items-center px-4" aria-hidden="true">
      <div className="border-border h-0 w-full border-t-2 border-dashed" />
    </div>
  );
}

/* ------------------------------ how it works -------------------------------- */

const JOURNEY_STEPS = [
  {
    icon: PhoneCall,
    title: "Enquire",
    desc: "WhatsApp or call us your preferred days and times — we match you with an instructor and confirm a start date.",
  },
  {
    icon: Car,
    title: "First lesson",
    desc: "Meet your instructor, get comfortable behind the wheel in a dual-control car, and cover the basics on quiet roads.",
  },
  {
    icon: RotateCw,
    title: "Practice",
    desc: "Regular lessons build road skills, parking, and confidence in traffic — pace tracked against your package.",
  },
  {
    icon: Trophy,
    title: "VID test & pass",
    desc: "We book your VID test when you're ready and prep you for the exact route — then you're driving on your own.",
  },
] as const;

/** The signature "route" section: a dashed lane line with a marker that
 *  advances as each step scrolls into view — the actual learner journey,
 *  not a decorative numbered list. */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          setActive((prev) => Math.max(prev, i));
        }
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const progressPct = (active / (JOURNEY_STEPS.length - 1)) * 100;

  return (
    <Section id="how-it-works">
      <SectionHeading
        eyebrow="The route"
        title="How it works"
        subtitle="From your first message to driving on your own — four stops, no detours."
        center
      />
      <div className="relative mx-auto mt-14 max-w-xl">
        {/* base lane line */}
        <div className="border-border absolute top-2 bottom-2 left-7 w-0 border-l-2 border-dashed" />
        {/* traveled portion */}
        <div
          className="bg-primary absolute top-2 left-7 w-0.5 origin-top transition-all duration-700 ease-out"
          style={{ height: `calc(${progressPct}% - 16px)` }}
        />
        <ol className="space-y-10">
          {JOURNEY_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i <= active;
            return (
              <li
                key={step.title}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-index={i}
                className="relative flex gap-5"
              >
                <div
                  className={cn(
                    "bg-background relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-500",
                    isActive ? "border-primary text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  <Icon className="size-6" />
                </div>
                <div className="pt-2.5">
                  <p className="label-mono text-accent">Stop {i + 1}</p>
                  <h3 className="mt-1 font-bold">{step.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{step.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}

/* -------------------------------- promotions ------------------------------- */

export function PromotionsBanner() {
  const { items } = usePromotions();
  const live = items.filter((p) => isPromotionLive(p));
  const [active, setActive] = useState<Promotion | null>(null);
  if (!live.length) return null;

  const isPdf = (flyer?: string) => !!flyer && flyer.startsWith("data:application/pdf");

  return (
    <Section className="py-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {live.map((promo) => (
          <Card
            key={promo.id}
            role="button"
            tabIndex={0}
            onClick={() => setActive(promo)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActive(promo);
              }
            }}
            className="hover:border-primary/50 focus-visible:ring-ring cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
          >
            {promo.flyer &&
              (isPdf(promo.flyer) ? (
                <div className="bg-muted/40 text-primary flex h-44 w-full flex-col items-center justify-center gap-2 px-6 text-sm font-medium">
                  <FileText className="h-8 w-8" />
                  View flyer (PDF)
                </div>
              ) : (
                <FramedPhoto src={promo.flyer} alt={promo.title} className="h-44 w-full" />
              ))}
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Badge className="bg-accent text-accent-foreground">Promotion</Badge>
                <span className="label-mono text-muted-foreground">
                  {promo.startDate} → {promo.endDate}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{promo.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{promo.description}</p>
              {promo.flyer && (
                <span className="text-primary mt-3 inline-flex items-center gap-1 text-sm font-medium">
                  {isPdf(promo.flyer) ? "Open flyer" : "View flyer"}
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-accent text-accent-foreground">Promotion</Badge>
                  <span className="label-mono text-muted-foreground">
                    {active.startDate} → {active.endDate}
                  </span>
                </div>
                <DialogTitle className="mt-2">{active.title}</DialogTitle>
                <DialogDescription>{active.description}</DialogDescription>
              </DialogHeader>

              {active.flyer &&
                (isPdf(active.flyer) ? (
                  <a
                    href={active.flyer}
                    target="_blank"
                    rel="noreferrer"
                    className="border-border hover:bg-muted/40 text-primary flex items-center justify-center gap-2 rounded-md border py-8 text-sm font-medium"
                  >
                    <FileText className="h-6 w-6" />
                    Open flyer PDF in new tab
                  </a>
                ) : (
                  <img
                    src={active.flyer}
                    alt={active.title}
                    className="w-full rounded-md object-contain"
                  />
                ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function promoForPackage(promos: Promotion[], packageId: string) {
  return promos.find((p) => isPromotionLive(p) && p.packageId === packageId && p.promoPrice != null);
}

/* -------------------------------- packages -------------------------------- */

export function PackageCard({
  pkg,
  promo,
  popular,
}: {
  pkg: Package;
  promo?: Promotion;
  popular?: boolean;
}) {
  const effectivePrice = promo?.promoPrice ?? pkg.price;
  const perLesson = pkg.lessons > 0 ? effectivePrice / pkg.lessons : null;

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl transition-[transform,box-shadow] duration-300 will-change-transform",
        "hover:-translate-y-1.5 hover:shadow-lg",
        popular
          ? "border-primary/60 from-primary/[0.07] to-transparent shadow-[0_20px_60px_-20px_var(--primary)]/40 relative bg-gradient-to-b"
          : "hover:border-primary/30",
      )}
    >
      {popular && (
        <span className="from-primary to-accent text-primary-foreground absolute top-5 right-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm">
          <Star size={10} className="fill-current" /> Most popular
        </span>
      )}
      <CardContent className="flex flex-1 flex-col pt-6">
        <div className="flex items-start justify-between gap-3 pr-2">
          <h3 className="text-lg font-semibold tracking-tight">{pkg.name}</h3>
          <span className="label-mono bg-secondary rounded-md px-2 py-1">{pkg.lessons} lessons</span>
        </div>
        <div className="mt-5 flex items-baseline gap-2">
          {promo?.promoPrice != null && (
            <span className="text-muted-foreground font-mono text-lg line-through">${pkg.price}</span>
          )}
          <span className="text-primary font-mono text-4xl font-bold tracking-tight">${effectivePrice}</span>
        </div>
        {perLesson != null && (
          <p className="text-muted-foreground mt-1 font-mono text-xs tracking-wide uppercase">
            ≈ ${perLesson.toFixed(2)} per lesson
          </p>
        )}
        <p className="text-muted-foreground mt-3 text-sm">{pkg.description}</p>
        <ul className="mt-5 flex-1 space-y-2 text-sm">
          {pkg.includes.map((i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-accent mt-0.5">✓</span> {i}
            </li>
          ))}
        </ul>
        <Button
          asChild
          className={cn(
            "mt-6 w-full rounded-full font-semibold",
            popular && "from-primary to-accent text-primary-foreground bg-gradient-to-r hover:brightness-110",
          )}
        >
          <Link to="/contact">Book this package</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- testimonials ------------------------------ */

export function TestimonialsStrip() {
  const { items } = useTestimonials();
  const published = items.filter((t) => t.status === "published").slice(0, 6);
  if (!published.length) return null;

  const avgRating = published.reduce((sum, t) => sum + t.rating, 0) / published.length;

  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <p className="label-mono text-accent">Reviews</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-3xl">What our learners say</h2>
        <div className="mt-3 flex items-center justify-center gap-2">
          <StarRating value={Math.round(avgRating)} size={18} />
          <span className="font-mono text-sm font-semibold">{avgRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-sm">
            from {published.length} review{published.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {published.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-6">
              <Quote className="text-accent size-5" />
              <p className="mt-3 text-sm">{t.comment}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-semibold">{t.name}</span>
                <StarRating value={t.rating} size={14} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------- review form ------------------------------- */

export function ReviewForm() {
  const { add } = useTestimonials();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) {
      toast.error("Add your name and a short comment");
      return;
    }
    setSaving(true);
    try {
      add({
        name: name.trim(),
        rating,
        comment: comment.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      toast.success("Thanks — your review will appear once approved");
      setName("");
      setComment("");
      setRating(5);
    } catch (err) {
      toast.error(errorMessage(err, "Could not save your review"), {
        duration: Infinity,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="rev-name">Your name</Label>
        <Input id="rev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </div>
      <div className="grid gap-2">
        <Label>Rating</Label>
        <StarRating value={rating} onChange={setRating} size={24} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rev-comment">Comment</Label>
        <Textarea
          id="rev-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={4}
        />
      </div>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Sending…" : "Submit review"}
      </Button>
    </form>
  );
}

/* --------------------------------- lightbox -------------------------------- */

export function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: { src: string; caption: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onNavigate((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onNavigate]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-md p-2 text-white/80 transition-colors hover:text-white"
      >
        <X className="size-6" />
      </button>
      <button
        aria-label="Previous photo"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index - 1 + photos.length) % photos.length);
        }}
        className="absolute left-2 rounded-full p-3 text-white/80 transition-colors hover:text-white"
      >
        <ChevronLeft className="size-8" />
      </button>
      <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.caption} className="max-h-[80vh] w-auto object-contain" />
        {photo.caption && (
          <figcaption className="mt-3 text-center text-sm text-white/80">{photo.caption}</figcaption>
        )}
      </figure>
      <button
        aria-label="Next photo"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index + 1) % photos.length);
        }}
        className="absolute right-2 rounded-full p-3 text-white/80 transition-colors hover:text-white"
      >
        <ChevronRight className="size-8" />
      </button>
    </div>
  );
}

/* --------------------------------- CTA band -------------------------------- */

export function CtaBand({ title = "Ready to start driving?" }: { title?: string }) {
  const { settings } = useSettings();
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-14 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="max-w-xl text-sm opacity-90">
          Book your first lesson today — {settings.hours.toLowerCase()}.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link to="/contact">Book a Lesson</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/40 bg-transparent hover:bg-primary-foreground/10"
          >
            <a href={waLink(settings.whatsapp, settings.waGeneralTemplate)} target="_blank" rel="noreferrer">
              WhatsApp us
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function StarsRow({ value }: { value: number }) {
  return (
    <div className="flex">
      {Array.from({ length: value }).map((_, i) => (
        <Star key={i} className="fill-warning text-warning size-4" />
      ))}
    </div>
  );
}