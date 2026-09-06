import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { errorMessage } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { getSiteTraffic, type SiteTrafficStats } from "@/lib/site-traffic-server";

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.15)",
};

/** New views push in live via Realtime — this is just a safety-net
 *  reconciliation so drift (a missed event, a day boundary rolling over)
 *  never lasts longer than a couple of minutes. */
const RECONCILE_INTERVAL_MS = 120_000;

function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Shortens a path like "/payment-policy" to fit next to a bar without
 *  needing to widen the chart's left margin for every page name. */
function shortPath(path: string, max = 20) {
  if (path.length <= max) return path;
  return path.slice(0, max - 1) + "…";
}

interface IncomingView {
  path: string;
  created_at: string;
}

/** Folds one freshly-inserted page_views row into the stats already on
 *  screen, so a new visit shows up instantly instead of waiting for the
 *  next reconciliation fetch. */
function applyIncomingView(prev: SiteTrafficStats, row: IncomingView): SiteTrafficStats {
  const day = row.created_at.slice(0, 10);
  const dailyViews = prev.dailyViews.map((d) =>
    d.date === day ? { ...d, views: d.views + 1 } : d,
  );

  const pageCounts = new Map(prev.topPages.map((p) => [p.path, p.views]));
  pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1);
  const topPages = [...pageCounts.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  return {
    totalViews: prev.totalViews + 1,
    last7DaysViews: prev.last7DaysViews + 1,
    dailyViews,
    topPages,
  };
}

export function SiteTrafficPanel({ accessToken }: { accessToken: string }) {
  const [stats, setStats] = useState<SiteTrafficStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, forceTick] = useState(0);
  const isFirstLoad = useRef(true);

  // Full reload from the server function — the source of truth, used for
  // the initial load and for periodic reconciliation.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isFirstLoad.current) setLoading(true);
      try {
        const result = await getSiteTraffic({ data: { accessToken } });
        if (cancelled) return;
        setStats(result);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        // A background reconcile that fails shouldn't wipe out numbers
        // already on screen — only surface the error if we have nothing yet.
        if (!cancelled && isFirstLoad.current) setError(errorMessage(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          isFirstLoad.current = false;
        }
      }
    }

    load();
    const interval = setInterval(load, RECONCILE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken]);

  // Instant push updates: subscribe to new page_views rows via Supabase
  // Realtime. Requires supabase/page-views-realtime.sql to have been run —
  // it grants managers SELECT on this table (Realtime authorizes each
  // broadcast against that policy) and adds the table to the realtime
  // publication.
  useEffect(() => {
    const channel = supabase
      .channel("page-views-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "page_views" },
        (payload) => {
          const row = payload.new as IncomingView;
          setStats((prev) => (prev ? applyIncomingView(prev, row) : prev));
          setLastUpdated(new Date());
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Re-render once a minute just to keep "Updated Xm ago" fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

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

  const dailyData = stats.dailyViews.map((d) => ({ label: dayLabel(d.date), views: d.views }));
  const pageData = [...stats.topPages]
    .sort((a, b) => a.views - b.views) // ascending so the biggest bar ends up on top
    .map((p) => ({ path: p.path, label: shortPath(p.path), views: p.views }));

  const updatedText = lastUpdated
    ? (() => {
        const secs = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
        if (secs < 5) return "Updated just now";
        if (secs < 60) return `Updated ${secs}s ago`;
        const mins = Math.round(secs / 60);
        return `Updated ${mins}m ago`;
      })()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Page views logged from real visits to the public site — this doesn't count admin pages or
          student links.
        </p>
        <span className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          <span
            className={`size-1.5 rounded-full ${live ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`}
          />
          {live ? "Live" : "Reconnecting…"}
          {updatedText ? ` · ${updatedText}` : ""}
        </span>
      </div>

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
              <BarChart data={dailyData}>
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
          <p className="mb-3 text-sm font-medium">Views by page, last 14 days</p>
          {pageData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No views logged yet.</p>
          ) : (
            <div style={{ height: Math.max(pageData.length * 34, 80) }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pageData} layout="vertical" margin={{ left: 4, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={130}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--color-secondary)" }}
                    formatter={(value: number) => [value, "Views"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.path ?? ""}
                  />
                  <Bar dataKey="views" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}