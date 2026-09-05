import { ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section, SectionHeading } from "@/components/site/blocks";
import { usePaymentPolicy } from "@/lib/data";

/**
 * Renders the school's Payment Fraud & Anti-Fraud Policy (incl. the strict
 * no-refund provision) as a tidy accordion. Drop this at the bottom of any
 * page where the payer needs to see it — currently used on /packages.
 *
 * Content is editable from Admin → Content & site → Payment Policy, so the
 * manager can amend wording without a code change. See usePaymentPolicy()
 * in src/lib/data.ts for the underlying single-row Supabase record.
 */
export function PaymentPolicySection() {
  const { content } = usePaymentPolicy();

  return (
    <Section className="border-t">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.heading}
          subtitle={content.subtitle}
        />
        <div className="text-muted-foreground mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
          <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
          <p>{content.noticeText}</p>
        </div>
        <Accordion type="single" collapsible className="mt-6">
          {content.sections.map((s) => (
            <AccordionItem key={s.title} value={s.title}>
              <AccordionTrigger className="text-left text-sm font-semibold">
                {s.title}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm leading-relaxed">
                {s.body
                  .split("\n\n")
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}