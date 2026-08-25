import { createFileRoute } from "@tanstack/react-router";
import { FileDown, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CtaBand, Section, SectionHeading } from "@/components/site/blocks";
import { fetchTipsData, useTips } from "@/lib/data";

export const Route = createFileRoute("/tips")({
  component: Tips,
  loader: () => fetchTipsData(),
  head: () => ({
    meta: [
      { title: "Driving Tips & VID Test Prep | Bulawayo" },
      {
        name: "description",
        content:
          "Free driving tips and VID test preparation advice from Auto Driving School Bulawayo: road signs, hill starts, observation and good habits.",
      },
      { property: "og:title", content: "Driving Tips & VID Test Prep | Bulawayo" },
      { property: "og:description", content: "Test-prep advice and good-driving habits from our instructors." },
      { property: "og:url", content: "/tips" },
    ],
    links: [{ rel: "canonical", href: "/tips" }],
  }),
});

function Tips() {
  const { items } = useTips();

  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="Driving tips"
          title="Did you know?"
          subtitle="Short lessons and test-prep notes from our instructors, useful whether you're booked with us or not."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {items.map((tip) => (
            <Card key={tip.id}>
              <CardContent className="pt-6">
                <Lightbulb className="text-warning size-5" />
                <h2 className="mt-3 text-lg font-semibold">{tip.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{tip.body}</p>
                {tip.attachment &&
                  (tip.attachmentType?.startsWith("image/") ? (
                    <img
                      src={tip.attachment}
                      alt={tip.attachmentName ?? tip.title}
                      loading="lazy"
                      className="mt-4 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <a
                      href={tip.attachment}
                      download={tip.attachmentName}
                      className="text-primary mt-4 inline-flex items-center gap-2 text-sm font-medium hover:underline"
                    >
                      <FileDown className="size-4" /> {tip.attachmentName ?? "Download attachment"}
                    </a>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
      <CtaBand title="Want these tips behind the wheel?" />
    </>
  );
}