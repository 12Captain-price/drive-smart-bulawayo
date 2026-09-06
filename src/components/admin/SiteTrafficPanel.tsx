import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { errorMessage } from "@/lib/data";
import { getSiteTraffic, type SiteTrafficStats } from "@/lib/site-traffic-server";

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.15)",
};

function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function SiteTrafficPanel({ accessToken }: { accessToken: string }) {
  const [stats, setStats] = useState<SiteTrafficStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getSiteTraffic({ data: { accessToken } });
        if (!cancelled) setStats(result);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading traffic…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="pt-6 text-sm">
          <p className="text-destructive font-medium">Couldn't load site traffic</p>
          <p className="text-muted-foreground mt-1">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = stats.dailyViews.map((d) => ({ label: dayLabel(d.date), views: d.views }));

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Page views logged from real visits to the public site — this doesn't count admin pages or
        student links.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
              <Eye className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
              <p className="text-muted-foreground text-xs">Total page views (all time)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="bg-accent/10 text-accent flex size-10 shrink-0 items-center justify-center rounded-full">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.last7DaysViews.toLocaleString()}</p>
              <p className="text-muted-foreground text-xs">Views in the last 7 days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Daily views, last 14 days</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-secondary)" }} />
                <Bar dataKey="views" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Top pages, last 14 days</p>
          {stats.topPages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No views logged yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{p.path}</span>
                  <span className="text-muted-foreground">{p.views.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}