import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PaymentPolicySection } from "@/components/site/PaymentPolicy";

export const Route = createFileRoute("/payment-policy")({
  component: PaymentPolicyPage,
  head: () => ({
    meta: [
      { title: "Payment & Anti-Fraud Policy | Auto Driving School" },
      {
        name: "description",
        content:
          "Auto Driving School's Payment & Anti-Fraud Policy, including our strict no-refund provision and how payment disputes are handled.",
      },
      { property: "og:title", content: "Payment & Anti-Fraud Policy | Auto Driving School" },
      {
        property: "og:description",
        content: "Read our full payment and anti-fraud policy before paying for a package.",
      },
      { property: "og:url", content: "/payment-policy" },
    ],
    links: [{ rel: "canonical", href: "/payment-policy" }],
  }),
});

function PaymentPolicyPage() {
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
      <PaymentPolicySection />
    </>
  );
}