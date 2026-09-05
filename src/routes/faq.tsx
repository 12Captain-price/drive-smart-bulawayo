import { createFileRoute } from "@tanstack/react-router";
import { Car, Clock, FileText, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CtaBand, Section, SectionHeading } from "@/components/site/blocks";
import { fetchFaqData, useFaqs } from "@/lib/data";

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  Licensing: FileText,
  Lessons: Car,
  Logistics: Clock,
};

export const Route = createFileRoute("/faq")({
  component: Faq,
  loader: () => fetchFaqData(),
  head: () => ({
    meta: [
      { title: "Driving School FAQ | VID Test, Lessons & Prices | Bulawayo" },
      {
        name: "description",
        content:
          "Answers about the VID licensing process, how many driving lessons you need, what to bring and our cancellation policy in Bulawayo.",
      },
      { property: "og:title", content: "Driving School FAQ | Bulawayo" },
      {
        property: "og:description",
        content: "Common questions about learning to drive in Bulawayo.",
      },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
  }),
});

function Faq() {
  const { items: faqs } = useFaqs();
  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  return (
    <>
      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions learners ask us" />
        {faqs.length === 0 ? (
          <p className="text-muted-foreground mt-8 max-w-lg text-sm">
            We're still adding answers here, in the meantime send us your question on WhatsApp and
            we'll reply right away.
          </p>
        ) : (
          <div className="mt-8 max-w-3xl space-y-8">
            {categories.map((cat) => {
              const items = faqs.filter((f) => f.category === cat);
              if (!items.length) return null;
              const Icon = CATEGORY_ICONS[cat] ?? HelpCircle;
              return (
                <div key={cat}>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Icon className="size-4" />
                    <p className="label-mono">{cat}</p>
                  </div>
                  <Accordion type="single" collapsible className="mt-1">
                    {items.map((f) => (
                      <AccordionItem key={f.id} value={f.id}>
                        <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                          {f.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <CtaBand title="Still have a question?" />
    </>
  );
}