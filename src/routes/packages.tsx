import { createFileRoute } from "@tanstack/react-router";
import {
  CtaBand,
  PackageCard,
  PromotionsBanner,
  Section,
  SectionHeading,
  promoForPackage,
} from "@/components/site/blocks";
import { PaymentPolicySection } from "@/components/site/PaymentPolicy";
import { fetchPackagesPageData, usePackages, usePromotions } from "@/lib/data";

export const Route = createFileRoute("/packages")({
  component: Packages,
  loader: () => fetchPackagesPageData(),
  head: () => ({
    meta: [
      { title: "Driving Lesson Packages & Prices | Bulawayo" },
      {
        name: "description",
        content:
          "Beginner, full course and refresher driving lesson packages in Bulawayo. Transparent prices, lesson counts and what's included.",
      },
      { property: "og:title", content: "Driving Lesson Packages & Prices | Bulawayo" },
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
              popular={!!p.featured}
            />
          ))}
        </div>
        <p className="text-muted-foreground mt-8 text-sm">Prices are in USD.</p>
      </Section>
      <PaymentPolicySection />
      <CtaBand title="Not sure which package?" />
    </>
  );
}
