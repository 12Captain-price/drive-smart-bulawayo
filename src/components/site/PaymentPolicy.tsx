import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, ShieldCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/site/blocks";
import { usePaymentPolicy } from "@/lib/data";

/**
 * Renders the school's Payment Fraud & Anti-Fraud Policy (incl. the strict
 * no-refund provision) as a tidy accordion. Drop this at the bottom of any
 * page where the payer needs to see it — currently used on /packages.
 *
 * type="multiple" (not "single") so opening one clause doesn't auto-close
 * whichever one you already had open — someone actually reading through
 * several clauses in a row shouldn't have to keep re-opening the last one.
 * The "Expand all" toggle covers the "I just want to read the whole thing"
 * case in one click, no need to click all 24 individually.
 *
 * Content is editable from Admin → Content & site → Payment Policy, so the
 * manager can amend wording without a code change. See usePaymentPolicy()
 * in src/lib/data.ts for the underlying single-row Supabase record.
 */
export function PaymentPolicySection() {
  const { content } = usePaymentPolicy();
  const [openItems, setOpenItems] = useState<string[]>([]);
  const allOpen = openItems.length === content.sections.length && content.sections.length > 0;

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

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpenItems(allOpen ? [] : content.sections.map((s) => s.title))}
          >
            {allOpen ? (
              <>
                <ChevronsDownUp className="size-4" /> Collapse all
              </>
            ) : (
              <>
                <ChevronsUpDown className="size-4" /> Expand all to read
              </>
            )}
          </Button>
        </div>

        <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="mt-2">
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