/**
 * Site traffic stats for the Admin "Site Traffic" panel.
 *
 * page_views has no anon SELECT policy (see supabase/page-views.sql), so
 * this reads it with the service-role key instead — same shape as
 * staff-auth-server.ts: re-check the caller's access token server-side and
 * confirm `app_metadata.role === "manager"` before returning anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, type PageViewRow } from "./supabase-admin.ts";

async function requireManager(accessToken: string) {
  const { data, error } = await supabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session has expired, sign in again.");
  if (data.user.app_metadata?.role !== "manager") {
    throw new Error("Only managers can view site traffic.");
  }
}

const LOOKBACK_DAYS = 14;

export interface SiteTrafficStats {
  totalViews: number;
  last7DaysViews: number;
  topPages: { path: string; views: number }[];
  /** One entry per day for the last LOOKBACK_DAYS days, oldest first, zero-filled for days with no views. */
  dailyViews: { date: string; views: number }[];
}

export const getSiteTraffic = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string() }))
  .handler(async ({ data }): Promise<SiteTrafficStats> => {
    await requireManager(data.accessToken);

    const since = new Date();
    since.setDate(since.getDate() - (LOOKBACK_DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const [totalResult, recentResult] = await Promise.all([
      supabaseAdmin().from("page_views").select("id", { count: "exact", head: true }),
      supabaseAdmin()
        .from("page_views")
        .select("path, created_at")
        .gte("created_at", since.toISOString())
        .returns<Pick<PageViewRow, "path" | "created_at">[]>(),
    ]);

    if (totalResult.error) throw new Error(totalResult.error.message);
    if (recentResult.error) throw new Error(recentResult.error.message);

    const rows = recentResult.data ?? [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let last7DaysViews = 0;
    const pageCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();

    for (const row of rows) {
      if (new Date(row.created_at).getTime() >= sevenDaysAgo) last7DaysViews += 1;
      pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1);
      const day = row.created_at.slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }

    const topPages = [...pageCounts.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const dailyViews: { date: string; views: number }[] = [];
    for (let i = LOOKBACK_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyViews.push({ date: key, views: dayCounts.get(key) ?? 0 });
    }

    return {
      totalViews: totalResult.count ?? 0,
      last7DaysViews,
      topPages,
      dailyViews,
    };
  });