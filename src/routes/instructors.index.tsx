import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CtaBand, FramedPhoto, Section, SectionHeading } from "@/components/site/blocks";
import { fetchInstructorsData, useInstructors } from "@/lib/data";

/** Instructor languages are stored as free text ("Ndebele, English and
 *  Shona") — split into individual chips for scanability. */
function splitLanguages(languages: string) {
  return languages
    .split(/,|&|\band\b/i)
    .map((l) => l.trim())
    .filter(Boolean);
}

export const Route = createFileRoute("/instructors/")({
  component: Instructors,
  loader: () => fetchInstructorsData(),
  head: () => ({
    meta: [
      { title: "Our Driving Instructors — Auto Driving School Bulawayo" },
      {
        name: "description",
        content:
          "Meet the qualified driving instructors at Auto Driving School Bulawayo — years of experience and lessons in Ndebele, English and Shona.",
      },
      { property: "og:title", content: "Our Driving Instructors — Bulawayo" },
      { property: "og:description", content: "Experienced, patient, VID-registered instructors." },
      { property: "og:url", content: "/instructors" },
    ],
    links: [{ rel: "canonical", href: "/instructors" }],
  }),
});

function Instructors() {
  const { items } = useInstructors();

  return (
    <>
      <Section>
        <SectionHeading
          eyebrow="The team"
          title="Your instructors"
          subtitle="Tap an instructor to read a bit more about how they teach."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ins) => (
            <Link key={ins.id} to="/instructors/$slug" params={{ slug: ins.slug }} className="group">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-lg">
                <FramedPhoto
                  src={ins.photo}
                  alt={ins.name}
                  className="aspect-[4/3]"
                  imgClassName="transition-transform group-hover:scale-105"
                  fallback={<GraduationCap className="size-10" />}
                />
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{ins.name}</h2>
                    <Badge variant="secondary" className="label-mono shrink-0">
                      {ins.years} yrs
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {splitLanguages(ins.languages).map((lang) => (
                      <span
                        key={lang}
                        className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                  <span className="text-primary mt-3 inline-block text-sm font-medium group-hover:underline">
                    View profile →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
      <CtaBand title="Book a lesson with one of our instructors" />
    </>
  );
}