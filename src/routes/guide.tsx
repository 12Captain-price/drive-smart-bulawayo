import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/site/blocks";
import { siteGuide } from "@/lib/guides";

export const Route = createFileRoute("/guide")({
  component: Guide,
  head: () => ({
    meta: [
      { title: "How to Use This Site — Auto Driving School Bulawayo" },
      {
        name: "description",
        content:
          "Step-by-step help for booking driving lessons, paying with EcoCash and writing your test with Auto Driving School in Bulawayo.",
      },
      { property: "og:title", content: "How to Use This Site — Auto Driving School" },
      {
        property: "og:description",
        content: "Simple guides for booking lessons, paying with EcoCash and writing your test.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/guide" }],
  }),
});

function Guide() {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return siteGuide;
    return siteGuide
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => (e.q + " " + e.a).toLowerCase().includes(q)),
      }))
      .filter((g) => g.entries.length > 0);
  }, [query]);

  return (
    <Section className="max-w-3xl">
      <div className="text-center">
        <p className="label-mono text-accent">Help</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">How to use this site</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
          Short answers for booking a lesson, paying on EcoCash and writing your test.
        </p>
      </div>

      <div className="relative mx-auto mt-8 max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for help, e.g. 'payment'"
          className="pl-9"
          aria-label="Search the guide"
        />
      </div>

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="label-mono text-accent">{g.title}</h2>
            <div className="mt-3 grid gap-3">
              {g.entries.map((e) => (
                <Card key={e.q} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">{e.q}</h3>
                    <p className="text-muted-foreground mt-2 text-sm">{e.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-muted-foreground text-center text-sm">
            Nothing matched that. Try another word, or message us on WhatsApp.
          </p>
        )}
      </div>
    </Section>
  );
}
