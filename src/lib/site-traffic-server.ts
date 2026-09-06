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

// Sanity cap so a mistyped or malicious custom range can't force a huge scan
// or a multi-thousand-point response.
const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface SiteTrafficStats {
  /** All-time count, independent of the selected range. */
  totalViews: number;
  /** Count within [startDate, endDate], inclusive. */
  periodViews: number;
  topPages: { path: string; views: number }[];
  /** One entry per day in the selected range, oldest first, zero-filled for days with no views. */
  dailyViews: { date: string; views: number }[];
}

export const getSiteTraffic = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accessToken: z.string(),
      /** Inclusive range bounds, "YYYY-MM-DD", interpreted as calendar days. */
      startDate: z.string().regex(DATE_RE),
      endDate: z.string().regex(DATE_RE),
    }),
  )
  .handler(async ({ data }): Promise<SiteTrafficStats> => {
    await requireManager(data.accessToken);

    const start = new Date(`${data.startDate}T00:00:00.000Z`);
    const end = new Date(`${data.endDate}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new Error("That date range doesn't look right.");
    }
    const spanDays = Math.min(
      MAX_RANGE_DAYS,
      Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
    );

    const [totalResult, rangeResult] = await Promise.all([
      supabaseAdmin().from("page_views").select("id", { count: "exact", head: true }),
      supabaseAdmin()
        .from("page_views")
        .select("path, created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .returns<Pick<PageViewRow, "path" | "created_at">[]>(),
    ]);

    if (totalResult.error) throw new Error(totalResult.error.message);
    if (rangeResult.error) throw new Error(rangeResult.error.message);

    const rows = rangeResult.data ?? [];
    const pageCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();

    for (const row of rows) {
      pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1);
      const day = row.created_at.slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }

    const topPages = [...pageCounts.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const dailyViews: { date: string; views: number }[] = [];
    for (let i = 0; i < spanDays; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyViews.push({ date: key, views: dayCounts.get(key) ?? 0 });
    }

    return {
      totalViews: totalResult.count ?? 0,
      periodViews: rows.length,
      topPages,
      dailyViews,
    };
  });