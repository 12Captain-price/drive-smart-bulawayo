import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, Clock3, GraduationCap, Inbox, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ENQUIRY_STATUSES, useEnquiries, usePackages, usePayments, useStudents } from "@/lib/data";

/** Chart colours pull from the same CSS custom properties as the rest of the
 *  site, so the dashboard follows light/dark mode automatically instead of
 *  carrying its own hardcoded palette. */
const CHART = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  muted: "var(--color-muted-foreground)",
  border: "var(--color-border)",
  series: [
    "var(--color-primary)",
    "var(--color-accent)",
    "var(--color-success)",
    "var(--color-warning)",
    "var(--color-muted-foreground)",
    "var(--color-primary)",
  ],
};

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.15)",
};

function currency(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short" });
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function OverviewPanel() {
  const { items: enquiries } = useEnquiries();
  const { items: payments } = usePayments();
  const { items: students } = useStudents();
  const { items: packages } = usePackages();

  const now = new Date();

  const confirmed = useMemo(() => payments.filter((p) => p.status === "confirmed"), [payments]);
  const pendingCount = useMemo(() => payments.filter((p) => p.status === "pending").length, [payments]);
  const totalRevenue = useMemo(
    () => confirmed.reduce((sum, p) => sum + (p.amount || 0), 0),
    [confirmed],
  );

  const monthRevenue = useMemo(() => {
    return confirmed
      .filter((p) => {
        const d = new Date(p.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  const revenueTrend = useMemo(() => {
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d), total: 0 });
    }
    for (const p of confirmed) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.total += p.amount || 0;
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  const activeStudents = useMemo(() => students.filter((s) => s.status === "active").length, [students]);
  const newEnquiries = useMemo(() => enquiries.filter((e) => e.status === "new").length, [enquiries]);
  const weekEnquiries = useMemo(
    () => enquiries.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 7 * 864e5).length,
    [enquiries],
  );

  const funnel = useMemo(
    () =>
      ENQUIRY_STATUSES.map((s) => ({
        status: s.label,
        count: enquiries.filter((e) => e.status === s.value).length,
      })),
    [enquiries],
  );

  const packagePopularity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) counts.set(s.packageId, (counts.get(s.packageId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ name: packages.find((p) => p.id === id)?.name ?? "Unassigned", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [students, packages]);

  const recentActivity = useMemo(() => {
    const events = [
      ...enquiries.map((e) => ({
        id: `enq-${e.id}`,
        icon: Inbox,
        text: `${e.name} enquired about lessons`,
        at: e.createdAt,
      })),
      ...payments.map((p) => ({
        id: `pay-${p.id}`,
        icon: Wallet,
        text: `${p.name} ${p.status === "confirmed" ? "paid" : "submitted a payment of"} ${currency(p.amount)}`,
        at: p.createdAt,
      })),
      ...students.map((s) => ({
        id: `stu-${s.id}`,
        icon: GraduationCap,
        text: `${s.name} enrolled`,
        at: s.enrolledAt,
      })),
    ];
    return events
      .filter((e) => e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 6);
  }, [enquiries, payments, students]);

  const stats: {
    label: string;
    value: string;
    sub?: string;
    icon: typeof Inbox;
    tone: "primary" | "accent" | "success" | "warning";
  }[] = [
    { label: "Active students", value: activeStudents.toString(), icon: GraduationCap, tone: "primary" },
    {
      label: "New enquiries",
      value: newEnquiries.toString(),
      sub: `${weekEnquiries} this week`,
      icon: Inbox,
      tone: "accent",
    },
    {
      label: "Revenue this month",
      value: currency(monthRevenue),
      sub: `${currency(totalRevenue)} all time`,
      icon: TrendingUp,
      tone: "success",
    },
    { label: "Pending payments", value: pendingCount.toString(), icon: Clock3, tone: "warning" },
  ];

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const maxPopularity = packagePopularity[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="label-mono text-muted-foreground truncate">{s.label}</p>
                  <p className="mt-1 font-mono text-2xl font-bold sm:text-3xl">{s.value}</p>
                  {s.sub && <p className="text-muted-foreground mt-1 text-xs">{s.sub}</p>}
                </div>
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    s.tone === "primary" && "bg-primary/10 text-primary",
                    s.tone === "accent" && "bg-accent/10 text-accent",
                    s.tone === "success" && "bg-success/15 text-success",
                    s.tone === "warning" && "bg-warning/15 text-warning",
                  )}
                >
                  <s.icon className="size-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue trend + enquiry pipeline */}
      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="label-mono text-muted-foreground">Revenue — last 6 months</p>
              <Banknote className="text-muted-foreground size-4" />
            </div>
            <div className="mt-2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART.border} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: CHART.muted }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={{ fontSize: 12, fill: CHART.muted }}
                  />
                  <Tooltip
                    formatter={(value: number) => [currency(value), "Revenue"]}
                    contentStyle={tooltipStyle}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={CHART.primary}
                    strokeWidth={2}
                    fill="url(#overviewRevenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <p className="label-mono text-muted-foreground">Enquiry pipeline</p>
            {funnel.every((f) => f.count === 0) ? (
              <p className="text-muted-foreground mt-6 text-sm">No enquiries yet.</p>
            ) : (
              <div className="mt-2 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={funnel}
                    layout="vertical"
                    margin={{ left: 0, right: 12, top: 10, bottom: 0 }}
                  >
                    <XAxis type="number" hide domain={[0, maxFunnel]} />
                    <YAxis
                      dataKey="status"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={78}
                      tick={{ fontSize: 11, fill: CHART.muted }}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-secondary)" }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                      {funnel.map((f, i) => (
                        <Cell key={f.status} fill={CHART.series[i % CHART.series.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Popular packages + recent activity */}
      <div className="grid gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <p className="label-mono text-muted-foreground">Popular packages</p>
            {packagePopularity.length === 0 ? (
              <p className="text-muted-foreground mt-4 text-sm">No enrolled students yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {packagePopularity.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="text-muted-foreground ml-2 shrink-0 font-mono text-xs">
                        {p.count}
                      </span>
                    </div>
                    <div className="bg-secondary mt-1.5 h-2 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${Math.max(8, (p.count / maxPopularity) * 100)}%`,
                          background: CHART.series[i % CHART.series.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <p className="label-mono text-muted-foreground">Recent activity</p>
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground mt-4 text-sm">
                Nothing yet — new enquiries and payments will show up here.
              </p>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {recentActivity.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span className="bg-secondary text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                      <e.icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.text}</span>
                      <span className="text-muted-foreground text-xs">{timeAgo(e.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}