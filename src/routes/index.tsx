import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CtaBand,
  FramedPhoto,
  HeroCarousel,
  HowItWorks,
  LaneDivider,
  Lightbox,
  PackageCard,
  PromotionsBanner,
  Section,
  SectionHeading,
  TestimonialsStrip,
  TRUST_ICONS,
  promoForPackage,
} from "@/components/site/blocks";
import {
  fetchHomeData,
  publishedPhotos,
  usePackages,
  usePhotos,
  usePromotions,
  useSettings,
  waLink,
} from "@/lib/data";
import { placeholderGallery } from "@/lib/placeholders";
import { useEffect, useRef, useState } from "react";

/** Animates a stat value like "500+" or "92%" counting up from 0 once it
 *  scrolls into view. Non-numeric values (rare, but future-proofing) just
 *  render as-is. */
function CountUpStat({ value }: { value: string }) {
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? parseInt(match[1], 10) : null;
  const suffix = match ? match[2] : "";

  const [started, setStarted] = useState(false);
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (target === null || started) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, started]);

  useEffect(() => {
    if (target === null || !started) return;
    const duration = 1200;
    const startTime = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, target]);

  return (
    <p ref={ref} className="text-primary font-mono text-3xl font-bold sm:text-4xl">
      {target === null ? value : `${display}${suffix}`}
    </p>
  );
}

export const Route = createFileRoute("/")({
  component: Home,
  loader: () => fetchHomeData(),
  head: () => ({
    meta: [
      { title: "Auto Driving School — Driving Lessons in Bulawayo" },
      {
        name: "description",
        content:
          "Learn to drive in Bulawayo with Auto Driving School: VID-registered instructors, dual-control cars, beginner, full course and refresher packages.",
      },
      { property: "og:title", content: "Auto Driving School — Driving Lessons in Bulawayo" },
      {
        property: "og:description",
        content: "Learn to drive in Bulawayo with Auto Driving School: VID-registered instructors, dual-control cars, beginner, full course and refresher packages.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Home() {
  const { settings } = useSettings();
  const { items: packages } = usePackages();
  const { items: promos } = usePromotions();
  const { items: photos } = usePhotos();
  const [lightbox, setLightbox] = useState<number | null>(null);

  const uploadedGallery = publishedPhotos(photos, "gallery").slice(0, 8);
  const gallery = uploadedGallery.length
    ? uploadedGallery.map((p) => ({ src: p.src, caption: p.caption }))
    : placeholderGallery;

  return (
    <>
      <HeroCarousel>
        <div className="relative text-center lg:text-left">
          {/* Large decorative driving scene behind the text — a winding road
             with a small car animating along it. Fills the empty space left
             by the shorter text column next to the taller photo card,
             instead of repeating the trust badges (already shown in
             TrustStrip right below). Desktop only, where there's room;
             respects reduced-motion via motion-safe:. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 640"
            className="text-accent/60 pointer-events-none absolute -top-28 -left-24 -z-10 hidden h-[40rem] w-[26rem] lg:block"
          >
            <path
              d="M60 620 C 60 460, 340 480, 340 340 S 120 200, 120 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="3 24"
              className="motion-safe:[animation:road-dash_16s_linear_infinite]"
            />
            <g className="text-foreground/70 motion-safe:[animation:hero-drive_16s_linear_infinite]">
              <g transform="translate(-14 -8)">
                <rect x="0" y="4" width="28" height="10" rx="4" fill="currentColor" />
                <rect x="6" y="0" width="14" height="7" rx="3" fill="currentColor" />
                <circle cx="6" cy="15" r="3" fill="currentColor" />
                <circle cx="22" cy="15" r="3" fill="currentColor" />
              </g>
            </g>
          </svg>

          <h1 className="text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 text-3xl font-bold duration-700 sm:text-5xl">
            {settings.headline}
          </h1>
          <p className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 mx-auto mt-4 max-w-xl text-sm duration-700 delay-150 sm:text-base lg:mx-0">
            {settings.tagline}
          </p>
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 mt-7 flex flex-col gap-3 duration-700 delay-300 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
            <Button
              asChild
              size="lg"
              className="w-full rounded-full font-mono text-xs font-bold tracking-[0.12em] uppercase shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-95 active:shadow-inner sm:w-auto sm:px-8 sm:text-[13px]"
            >
              <Link to="/contact">Book a Lesson</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-foreground w-full rounded-full border-2 font-mono text-xs font-bold tracking-[0.12em] uppercase transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 active:shadow-inner sm:w-auto sm:px-8 sm:text-[13px]"
            >
              <a href={waLink(settings.whatsapp, settings.waGeneralTemplate)} target="_blank" rel="noreferrer">
                WhatsApp 
              </a>
            </Button>
          </div>

          {/* Quick trust icons live right in the hero, not buried in a
             section further down the page. */}
          <div className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium duration-700 delay-500 sm:justify-start">
            {settings.trustStrip.map((item, i) => {
              const Icon = TRUST_ICONS[item.icon] ?? ShieldCheck;
              return (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <Icon className="text-accent size-4 shrink-0" /> {item.text}
                </span>
              );
            })}
          </div>
        </div>
      </HeroCarousel>
      <PromotionsBanner />

      <HowItWorks />
      <LaneDivider />

      {/* Stats band */}
      <Section className="py-12">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {settings.stats.map((s) => (
            <div key={s.label} className="text-center">
              <CountUpStat value={s.value} />
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <LaneDivider />

      {/* Packages preview */}
      <Section>
        <SectionHeading
          eyebrow="Pricing"
          title="Lesson packages"
          subtitle="Bundles work out cheaper than single lessons — and keep you progressing week to week."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {packages.slice(0, 3).map((p) => (
            <PackageCard key={p.id} pkg={p} promo={promoForPackage(promos, p.id)} />
          ))}
        </div>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link to="/packages">See all packages</Link>
          </Button>
        </div>
      </Section>

      {/* Gallery preview */}
      <Section>
        <SectionHeading eyebrow="Gallery" title="Inside our school" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.slice(0, 8).map((p, i) => (
            <button key={i} onClick={() => setLightbox(i)} className="group">
              <FramedPhoto
                src={p.src}
                alt={p.caption || "Auto Driving School"}
                className="aspect-square rounded-lg"
                imgClassName="transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link to="/gallery">View full gallery</Link>
          </Button>
        </div>
      </Section>

      {lightbox !== null && (
        <Lightbox
          photos={gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}

      <TestimonialsStrip />
      <CtaBand />
    </>
  );
}