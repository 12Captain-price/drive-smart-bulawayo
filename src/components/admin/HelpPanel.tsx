import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { adminGuide } from "@/lib/guides";

/** Plain-language "how do I…" guide for school staff. */
export function HelpPanel() {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return adminGuide;
    return adminGuide
      .map((g) => ({ ...g, entries: g.entries.filter((e) => (e.q + " " + e.a).toLowerCase().includes(q)) }))
      .filter((g) => g.entries.length > 0);
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, e.g. 'send a test'"
          className="pl-9"
          aria-label="Search the admin guide"
        />
      </div>

      {groups.map((g) => (
        <div key={g.title}>
          <h2 className="label-mono text-accent">{g.title}</h2>
          <div className="mt-3 grid gap-3">
            {g.entries.map((e) => (
              <Card key={e.q} className="transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{e.q}</h3>
                  <p className="text-muted-foreground mt-2 text-sm">{e.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="text-muted-foreground text-sm">Nothing matched that word.</p>}
    </div>
  );
}
