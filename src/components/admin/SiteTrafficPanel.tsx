import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

/** "YYYY-MM-DD" using the browser's local calendar date (not UTC), so
 *  preset ranges line up with what the person actually sees as "today". */
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type Preset = "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

function presetBounds(preset: Preset): { start: string; end: string } {
  const today = new Date();
  const end = ymd(today);
  switch (preset) {
    case "today":
      return { start: end, end };
    case "7d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: ymd(s), end };
    }
    case "30d": {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: ymd(s), end };
    }
    case "month": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: ymd(s), end };
    }
    case "custom":
      return { start: end, end }; // placeholder, overridden by custom inputs
  }
}

function rangeLabel(preset: Preset, start: string, end: string) {
  if (preset === "today") return "today";
  if (preset === "7d") return "the last 7 days";
  if (preset === "30d") return "the last 30 days";
  if (preset === "month") return "this month";
  return start === end ? dayLabel(start) : `${dayLabel(start)} – ${dayLabel(end)}`;
}

/** Human-readable names for the "Views by page" chart, matching the labels
 *  already used in the site's own header/footer nav — so what a manager
 *  sees here matches what they'd click on the live site. Falls back to the
 *  raw path for anything not in this list (e.g. a page added later that
 *  this map hasn't been updated for yet). */
const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/packages": "Packages & Pricing",
  "/gallery": "Gallery",
  "/contact": "Book a Lesson",
  "/pay": "Pay",
  "/tips": "Driving Tips",
  "/faq": "FAQ",
  "/guide": "Help",
  "/terms": "Terms and Conditions",
  "/payment-policy": "Payment & Anti-Fraud Policy",
};

function pageLabel(path: string, max = 26) {
  const known = PAGE_LABELS[path];
  if (known) return known;
  return path.length <= max ? path : path.slice(0, max - 1) + "…";
}

interface IncomingView {
  path: string;
  created_at: string;
}

/** Folds one freshly-inserted page_views row into the stats already on
 *  screen, so a new visit shows up instantly instead of waiting for the
 *  next reconciliation fetch. Only affects periodViews/dailyViews/topPages
 *  when the row falls inside the currently selected range — totalViews is
 *  all-time so it always increments. */
function applyIncomingView(
  prev: SiteTrafficStats,
  row: IncomingView,
  rangeStart: string,
  rangeEnd: string,
): SiteTrafficStats {
  const totalViews = prev.totalViews + 1;
  const day = row.created_at.slice(0, 10);
  if (day < rangeStart || day > rangeEnd) return { ...prev, totalViews };

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
    totalViews,
    periodViews: prev.periodViews + 1,
    dailyViews,
    topPages,
  };
}

export function SiteTrafficPanel({ accessToken }: { accessToken: string }) {
  const [preset, setPreset] = useState<Preset>("7d");
  const initialCustom = useMemo(() => presetBounds("7d"), []);
  const [customStart, setCustomStart] = useState(initialCustom.start);
  const [customEnd, setCustomEnd] = useState(initialCustom.end);

  const { start, end } = preset === "custom" ? { start: customStart, end: customEnd } : presetBounds(preset);
  const rangeInvalid = preset === "custom" && (!customStart || !customEnd || customStart > customEnd);

  const [stats, setStats] = useState<SiteTrafficStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, forceTick] = useState(0);
  const isFirstLoad = useRef(true);

  // Full reload from the server function — the source of truth, used for
  // the initial load, whenever the selected range changes, and for
  // periodic reconciliation.
  useEffect(() => {
    if (rangeInvalid) return;
    let cancelled = false;

    async function load() {
      if (isFirstLoad.current) setLoading(true);
      try {
        const result = await getSiteTraffic({ data: { accessToken, startDate: start, endDate: end } });
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
  }, [accessToken, start, end, rangeInvalid]);

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
          setStats((prev) => (prev ? applyIncomingView(prev, row, start, end) : prev));
          setLastUpdated(new Date());
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [start, end]);

  // Re-render once a minute just to keep "Updated Xm ago" fresh.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const label = rangeLabel(preset, start, end);

  const rangeControls = (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          type="button"
          size="sm"
          variant={preset === p.id ? "default" : "outline"}
          onClick={() => setPreset(p.id)}
        >
          {p.label}
        </Button>
      ))}
      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-8 w-[9.5rem] text-xs"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            max={ymd(new Date())}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-8 w-[9.5rem] text-xs"
          />
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {rangeControls}
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading traffic…
        </div>
      </div>
    );
  }

  if (rangeInvalid) {
    return (
      <div className="space-y-6">
        {rangeControls}
        <p className="text-destructive text-sm">Pick a start date on or before the end date.</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        {rangeControls}
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm">
            <p className="text-destructive font-medium">Couldn't load site traffic</p>
            <p className="text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dailyData = stats.dailyViews.map((d) => ({ label: dayLabel(d.date), views: d.views }));
  // With a long custom range there can be a lot of daily bars — thin out
  // the x-axis ticks so labels don't overlap, without changing the data.
  const tickInterval = dailyData.length > 20 ? Math.ceil(dailyData.length / 12) - 1 : 0;
  const pageData = [...stats.topPages]
    .sort((a, b) => a.views - b.views) // ascending so the biggest bar ends up on top
    .map((p) => ({ path: p.path, label: pageLabel(p.path), views: p.views }));

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rangeControls}
        <span className="text-muted-foreground/70 flex shrink-0 items-center gap-1.5 text-xs">
          <span
            className={`size-1.5 rounded-full ${live ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`}
          />
          {live ? "Live" : "Reconnecting…"}
          {updatedText ? ` · ${updatedText}` : ""}
        </span>
      </div>

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
              <p className="text-2xl font-bold">{stats.periodViews.toLocaleString()}</p>
              <p className="text-muted-foreground text-xs">Views in {label}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Daily views, {label}</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  interval={tickInterval}
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
          <p className="mb-3 text-sm font-medium">Views by page, {label}</p>
          {pageData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No views logged for this period.</p>
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
                    width={160}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--color-secondary)" }}
                    formatter={(value: number) => [value, "Views"]}
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