import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { TermsSection } from "@/components/site/Terms";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms and Conditions | Auto Driving School" },
      {
        name: "description",
        content:
          "Auto Driving School's Terms and Conditions covering enrolment, lessons, test bookings and use of our services in Bulawayo.",
      },
      { property: "og:title", content: "Terms and Conditions | Auto Driving School" },
      {
        property: "og:description",
        content: "Read our full Terms and Conditions before enrolling.",
      },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
});

function TermsPage() {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <Link
          to="/packages"
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to packages
        </Link>
      </div>
      <TermsSection />
    </>
  );
}