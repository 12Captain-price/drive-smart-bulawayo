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
import type { PolicyPageContent } from "@/lib/data";

/**
 * Shared rendering for a full-page policy document — an intro + a numbered
 * clause accordion. Payment & Anti-Fraud Policy (/payment-policy) and Terms
 * and Conditions (/terms) each have their own dedicated route and their own
 * admin-editable content, but both render through this one component so the
 * two pages stay visually consistent without duplicating the accordion
 * markup.
 *
 * type="multiple" (not "single") so opening one clause doesn't auto-close
 * whichever one you already had open — someone actually reading through
 * several clauses in a row shouldn't have to keep re-opening the last one.
 * The "Expand all" toggle covers the "I just want to read the whole thing"
 * case in one click, no need to click all of them individually.
 */
export function PolicyAccordion({ content }: { content: PolicyPageContent }) {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const allOpen = openItems.length === content.sections.length && content.sections.length > 0;

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.heading}
          subtitle={content.subtitle}
        />

        {content.noticeText && (
          <div className="text-muted-foreground mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
            <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
            <p>{content.noticeText}</p>
          </div>
        )}

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