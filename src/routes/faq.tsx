import { createFileRoute } from "@tanstack/react-router";
import { Car, Clock, FileText } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CtaBand, Section, SectionHeading } from "@/components/site/blocks";

const faqs = [
  {
    category: "Licensing",
    q: "How does the VID licensing process work?",
    a: "You first write and pass the provisional (learner's) test at the VID, which covers road signs and rules. Once you hold a provisional licence you may take lessons on public roads with a qualified instructor. When you're ready, we help you book the practical VID test, a yard section (hill start, parallel parking, reverse) followed by a road section.",
  },
  {
    category: "Lessons",
    q: "How many lessons will I need?",
    a: "Complete beginners usually need 15–20 lessons before test standard. If you've driven before, 5–8 refresher lessons is common. We'll give you an honest assessment after your first two lessons rather than selling you hours you don't need.",
  },
  {
    category: "Logistics",
    q: "What should I bring to a lesson?",
    a: "Your provisional licence (or national ID if you're still preparing for it), comfortable flat shoes, and glasses if you wear them for distance. That's it, the vehicle is ours.",
  },
  {
    category: "Logistics",
    q: "What is your cancellation policy?",
    a: "Let us know at least 12 hours before your lesson and we'll reschedule at no cost. Cancellations inside 12 hours, or no-shows, use up the booked lesson from your package.",
  },
  {
    category: "Lessons",
    q: "Do you teach in Ndebele and Shona?",
    a: "Yes. Our instructors teach in Ndebele, English and Shona, tell us your preference when booking and we'll match you with the right instructor.",
  },
  {
    category: "Lessons",
    q: "Are your vehicles dual-control?",
    a: "Every training vehicle has dual controls, so your instructor can brake or clutch from the passenger seat. You're safe from your very first lesson.",
  },
];

const CATEGORIES: { name: string; icon: typeof FileText }[] = [
  { name: "Licensing", icon: FileText },
  { name: "Lessons", icon: Car },
  { name: "Logistics", icon: Clock },
];

export const Route = createFileRoute("/faq")({
  component: Faq,
  head: () => ({
    meta: [
      { title: "Driving School FAQ | VID Test, Lessons & Prices | Bulawayo" },
      {
        name: "description",
        content:
          "Answers about the VID licensing process, how many driving lessons you need, what to bring and our cancellation policy in Bulawayo.",
      },
      { property: "og:title", content: "Driving School FAQ | Bulawayo" },
      { property: "og:description", content: "Common questions about learning to drive in Bulawayo." },
      { property: "og:url", content: "/faq" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});

function Faq() {
  return (
    <>
      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions learners ask us" />
        <div className="mt-8 max-w-3xl space-y-8">
          {CATEGORIES.map((cat) => {
            const items = faqs.filter((f) => f.category === cat.name);
            if (!items.length) return null;
            return (
              <div key={cat.name}>
                <div className="text-muted-foreground flex items-center gap-2">
                  <cat.icon className="size-4" />
                  <p className="label-mono">{cat.name}</p>
                </div>
                <Accordion type="single" collapsible className="mt-1">
                  {items.map((f, i) => (
                    <AccordionItem key={i} value={`${cat.name}-${i}`}>
                      <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                        {f.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            );
          })}
        </div>
      </Section>
      <CtaBand title="Still have a question?" />
    </>
  );
}