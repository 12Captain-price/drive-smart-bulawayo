import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, Car, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BannerImage } from "@/components/site/BannerImage";
import { CtaBand, FramedPhoto, ReviewForm, Section, SectionHeading } from "@/components/site/blocks";
import {
  fetchAboutData,
  publishedPhotos,
  useAboutContent,
  useAboutSections,
  useInstructors,
  usePhotos,
  useTeam,
} from "@/lib/data";
import { placeholderBanner, placeholderGallery } from "@/lib/placeholders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/about")({
  component: About,
  loader: () => fetchAboutData(),
  head: () => ({
    meta: [
      { title: "About Auto Driving School — Bulawayo" },
      {
        name: "description",
        content:
          "Meet Auto Driving School: a VID-registered driving school in central Bulawayo with experienced instructors and dual-control vehicles.",
      },
      { property: "og:title", content: "About Auto Driving School — Bulawayo" },
      {
        property: "og:description",
        content: "Our story, our instructors and why learners in Bulawayo choose us.",
      },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
});

const whyIcons = [ShieldCheck, Car, GraduationCap, CalendarClock];

function About() {
  const { items: photos } = usePhotos();
  const { items: instructors } = useInstructors();
  const { content } = useAboutContent();
  const { items: customSections } = useAboutSections();
  const { items: team } = useTeam();
  const banner = publishedPhotos(photos, "about")[0];
  const aroundPhotos = publishedPhotos(photos, "about").slice(1);
  const around = aroundPhotos.length
    ? aroundPhotos.map((p) => ({ src: p.src, caption: p.caption }))
    : placeholderGallery;
  const story = placeholderGallery;

  return (
    <>
      <div className="bg-secondary relative h-[36vh] min-h-[240px] w-full overflow-hidden">
        <BannerImage src={banner?.src ?? placeholderBanner} alt="Auto Driving School yard" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8">
          <p className="label-mono text-white/70">About us</p>
          <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
            Teaching Bulawayo to drive
          </h1>
        </div>
      </div>

      <Section>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow={content.storyHeading}
              title="A driving school built on patience"
            />
            {content.storyParagraphs.map((p, i) => (
              <p key={i} className={i === 0 ? "text-muted-foreground mt-4 text-sm" : "text-muted-foreground mt-3 text-sm"}>
                {p}
              </p>
            ))}
          </div>
          <img
            src={story[1].src}
            alt="Instructor teaching a learner driver"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-xl object-cover"
          />
        </div>

        <div className="mt-12 grid items-center gap-8 md:grid-cols-2">
          <img
            src={story[2].src}
            alt="Practice yard with cones"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-xl object-cover md:order-2"
          />
          <div>
            <h3 className="text-xl font-semibold">Test-ready, not just road-ready</h3>
            <p className="text-muted-foreground mt-3 text-sm">
              Our yard training covers everything the VID examiner looks for — hill starts, parallel
              parking, road signs and observation — before you ever book a test date. We'll tell you
              honestly when you're ready.
            </p>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="Why us" title="Why learners choose Auto Driving School" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {content.whyCards.map((card, i) => {
            const Icon = whyIcons[i % whyIcons.length];
            return (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Icon className="text-accent size-6" />
                  <h3 className="mt-3 font-semibold">{card.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{card.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      {customSections.length > 0 && (
        <Section className="pt-0">
          <div className="space-y-12">
            {customSections.map((s) => {
              if (s.type === "photo") {
                return s.image ? (
                  <FramedPhoto
                    key={s.id}
                    src={s.image}
                    alt={s.heading || "Auto Driving School"}
                    className="max-h-[520px] w-full rounded-xl"
                  />
                ) : null;
              }

              const text = (
                <div>
                  {s.heading && <h3 className="text-xl font-semibold">{s.heading}</h3>}
                  {s.body && <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{s.body}</p>}
                </div>
              );

              if (s.type === "text") return <div key={s.id} className="max-w-3xl">{text}</div>;

              return (
                <div key={s.id} className="grid items-center gap-8 md:grid-cols-2">
                  {s.image && (
                    <FramedPhoto
                      src={s.image}
                      alt={s.heading || "Auto Driving School"}
                      className={cn(
                        "aspect-[4/3] w-full rounded-xl",
                        s.imagePosition === "right" ? "md:order-2" : "",
                      )}
                    />
                  )}
                  {text}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {team.length > 0 && (
        <Section className="pt-0">
          <SectionHeading eyebrow="Meet the team" title="The people behind the wheel" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => (
              <Card key={m.id} className="h-full overflow-hidden">
                <FramedPhoto
                  src={m.photo}
                  alt={m.name}
                  className="aspect-[4/3] w-full"
                  fallback={<Users className="size-10" />}
                />
                <CardContent className="pt-5">
                  <h3 className="font-semibold">{m.name}</h3>
                  {m.role && <p className="label-mono text-muted-foreground mt-1">{m.role}</p>}
                  {m.bio && <p className="text-muted-foreground mt-2 text-sm">{m.bio}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}


      <Section className="pt-0">
        <SectionHeading eyebrow="The team" title="Our instructors" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((ins) => (
            <Link
              key={ins.id}
              to="/instructors/$slug"
              params={{ slug: ins.slug }}
              className="group block"
            >
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-lg">
                <FramedPhoto
                  src={ins.photo}
                  alt={ins.name}
                  className="aspect-[4/3] w-full"
                  imgClassName="transition-transform group-hover:scale-105"
                  fallback={<GraduationCap className="size-10" />}
                />
                <CardContent className="pt-5">
                  <h3 className="font-semibold">{ins.name}</h3>
                  <p className="label-mono text-muted-foreground mt-1">{ins.years} yrs experience</p>
                  <p className="text-muted-foreground mt-2 text-sm">{ins.languages}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading eyebrow="Around our school" title="The yard, the cars, the classroom" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {around.slice(0, 8).map((p, i) => (
            <FramedPhoto
              key={i}
              src={p.src}
              alt={p.caption || "Around Auto Driving School"}
              className="aspect-square w-full rounded-lg"
            />
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <div className="bg-secondary/60 flex flex-col items-center gap-3 rounded-xl border p-6 text-center">
          <BadgeCheck className="text-success size-8" />
          <h3 className="text-lg font-semibold">Registered with the VID</h3>
          <p className="text-muted-foreground max-w-lg text-sm">
            Auto Driving School is a Vehicle Inspectorate Department registered driving school, so your
            training is recognised for licensing.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto max-w-xl">
          <SectionHeading eyebrow="Leave a review" title="Trained with us? Tell others." center />
          <div className="mt-8">
            <ReviewForm />
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}