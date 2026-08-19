import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand, FramedPhoto, Section } from "@/components/site/blocks";
import { fetchInstructorsData, useInstructors } from "@/lib/data";

export const Route = createFileRoute("/instructors/$slug")({
  component: InstructorProfile,
  loader: () => fetchInstructorsData(),
  head: ({ params }) => {
    const name = params.slug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    return {
      meta: [
        { title: `${name} — Driving Instructor, Auto Driving School Bulawayo` },
        {
          name: "description",
          content: `${name} is a driving instructor at Auto Driving School in Bulawayo. Read their experience, languages and teaching style.`,
        },
        { property: "og:title", content: `${name} — Driving Instructor in Bulawayo` },
        { property: "og:description", content: `Learn to drive with ${name} at Auto Driving School.` },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: `/instructors/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/instructors/${params.slug}` }],
    };
  },
});

function InstructorProfile() {
  const { slug } = Route.useParams();
  const { items } = useInstructors();
  const ins = items.find((i) => i.slug === slug);

  if (!ins) {
    return (
      <Section className="text-center">
        <h1 className="text-2xl font-bold">Instructor not found</h1>
        <Button asChild className="mt-6">
          <Link to="/instructors">Back to instructors</Link>
        </Button>
      </Section>
    );
  }

  return (
    <>
      <Section>
        <Link
          to="/instructors"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" /> All instructors
        </Link>

        <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,320px)_1fr]">
          <FramedPhoto
            src={ins.photo}
            alt={ins.name}
            className="aspect-[4/5] rounded-xl"
            fallback={<GraduationCap className="size-14" />}
          />
          <div>
            <h1 className="text-3xl font-bold">{ins.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="label-mono bg-secondary rounded-md px-2.5 py-1">
                {ins.years} years experience
              </span>
              <span className="label-mono bg-secondary rounded-md px-2.5 py-1">{ins.languages}</span>
            </div>
            <p className="text-muted-foreground mt-6 text-sm leading-relaxed">{ins.bio}</p>
            <Button asChild className="mt-8">
              <Link to="/contact">Book a lesson</Link>
            </Button>
          </div>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}