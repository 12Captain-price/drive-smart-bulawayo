import { createFileRoute } from "@tanstack/react-router";
import {
  CtaBand,
  PackageCard,
  PromotionsBanner,
  Section,
  SectionHeading,
  promoForPackage,
} from "@/components/site/blocks";
import { fetchPackagesPageData, usePackages, usePromotions, useStudents } from "@/lib/data";

export const Route = createFileRoute("/packages")({
  component: Packages,
  loader: () => fetchPackagesPageData(),
  head: () => ({
    meta: [
      { title: "Driving Lesson Packages & Prices — Bulawayo" },
      {
        name: "description",
        content:
          "Beginner, full course and refresher driving lesson packages in Bulawayo. Transparent prices, lesson counts and what's included.",
      },
      { property: "og:title", content: "Driving Lesson Packages & Prices — Bulawayo" },
      {
        property: "og:description",
        content: "Compare our driving lesson bundles and current promotions.",
      },
      { property: "og:url", content: "/packages" },
    ],
    links: [{ rel: "canonical", href: "/packages" }],
  }),
});

function Packages() {
  const { items: packages } = usePackages();
  const { items: promos } = usePromotions();
  const { items: students } = useStudents();

  // "Most popular" is real, not decorative — the package with the most
  // enrolled students wins the badge, recomputed as enrollments change.
  const popularId = (() => {
    if (!packages.length) return null;
    const counts = new Map<string, number>();
    for (const s of students) counts.set(s.packageId, (counts.get(s.packageId) ?? 0) + 1);
    const withCounts = packages.map((p) => ({ id: p.id, count: counts.get(p.id) ?? 0 }));
    const top = withCounts.reduce((a, b) => (b.count > a.count ? b : a));
    return top.count > 0 ? top.id : null;
  })();

  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Packages & pricing"
          title="Pick the package that fits you"
          subtitle="Bundles are cheaper per lesson than booking one at a time, and keep you improving week after week."
        />
      </Section>
      <PromotionsBanner />
      <Section className="pt-0">
        <div className="grid gap-5 pt-3 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              promo={promoForPackage(promos, p.id)}
              popular={p.id === popularId}
            />
          ))}
        </div>
        <p className="text-muted-foreground mt-8 text-sm">
          Prices are in USD. Single lessons are available on request — but a bundle always works out
          better value.
        </p>
      </Section>
      <CtaBand title="Not sure which package?" />
    </>
  );
}