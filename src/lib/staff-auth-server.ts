/**
 * Staff account management — the pieces that must run server-side because
 * they use the Supabase service-role key (never shipped to the browser).
 *
 * Why this file exists: some staff don't have an email address, but
 * Supabase Auth only knows how to sign people in by email. So for
 * "no real email" staff we generate an internal placeholder address
 * (`<random>@staff.internal`, never emailed to) and let them sign in by
 * typing their display name instead — see `resolveLoginEmail`, which is
 * the only piece of this file that's *not* manager-gated, since a
 * signed-out person needs it to sign in at all.
 *
 * Every other function here can change or reveal staff account info, so
 * each one re-checks the caller's own access token server-side and
 * confirms `app_metadata.role === "manager"` before doing anything.
 * `app_metadata` (as opposed to `user_metadata`) can only be written by
 * this service-role client, never by the user themselves, so it's safe
 * to use as the source of truth for permissions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin.ts";
import { slugify } from "./data.ts";

const STAFF_EMAIL_DOMAIN = "staff.internal";

export type StaffRole = "staff" | "manager";

export interface StaffAccount {
  id: string;
  displayName: string;
  email: string | null;
  hasRealEmail: boolean;
  role: StaffRole;
  createdAt: string;
}

function isPlaceholderEmail(email: string | undefined | null) {
  return !!email && email.endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}

function toStaffAccount(user: User): StaffAccount {
  const meta = user.app_metadata ?? {};
  const placeholder = isPlaceholderEmail(user.email);
  return {
    id: user.id,
    displayName: typeof meta.display_name === "string" ? meta.display_name : (user.email ?? "Unnamed"),
    email: placeholder ? null : (user.email ?? null),
    hasRealEmail: !placeholder,
    role: meta.role === "manager" ? "manager" : "staff",
    createdAt: user.created_at,
  };
}

/** Throws unless `accessToken` belongs to a signed-in manager; returns that user if so. */
async function requireManager(accessToken: string) {
  const { data, error } = await supabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session has expired, sign in again.");
  if (data.user.app_metadata?.role !== "manager") {
    throw new Error("Only managers can do this.");
  }
  return data.user;
}

/** Every listUsers() page scanned once — fine at driving-school staff counts (tens, not thousands). */
async function listAllUsers(): Promise<User[]> {
  const perPage = 200;
  let page = 1;
  const all: User[] = [];
  for (;;) {
    const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    all.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

/**
 * Turns whatever the person typed into the sign-in box into an actual
 * login email. If it already looks like an email, it's returned as-is —
 * `signInWithPassword` will reject it if no such account exists, same as
 * before. If it looks like a name instead, this looks up the matching
 * no-email staff account and returns *their* placeholder email so the
 * client can sign in with it. Returns null if nothing matches; the client
 * shows the same generic "wrong email/name or password" either way, so
 * this never reveals which staff exist.
 */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .validator(z.object({ identifier: z.string().trim().min(1) }))
  .handler(async ({ data }): Promise<{ email: string | null }> => {
    if (data.identifier.includes("@")) {
      return { email: data.identifier };
    }
    const users = await listAllUsers();
    const target = data.identifier.trim().toLowerCase();
    const match = users.find((u) => {
      const name = u.app_metadata?.display_name;
      return typeof name === "string" && name.trim().toLowerCase() === target;
    });
    return { email: match?.email ?? null };
  });

/** Manager-only: full staff roster, including no-email accounts. */
export const listStaffAccounts = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string() }))
  .handler(async ({ data }): Promise<StaffAccount[]> => {
    await requireManager(data.accessToken);
    const users = await listAllUsers();
    return users
      .map(toStaffAccount)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

const createStaffInput = z.object({
  accessToken: z.string(),
  displayName: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().min(8),
  role: z.enum(["staff", "manager"]),
});

/** Manager-only: creates a new staff account, with or without a real email. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .validator(createStaffInput)
  .handler(async ({ data }): Promise<StaffAccount> => {
    await requireManager(data.accessToken);

    const realEmail = data.email && data.email.length > 0 ? data.email : null;
    const loginEmail = realEmail ?? `${slugify(data.displayName)}-${Math.random().toString(36).slice(2, 8)}@${STAFF_EMAIL_DOMAIN}`;

    const { data: created, error } = await supabaseAdmin().auth.admin.createUser({
      email: loginEmail,
      password: data.password,
      email_confirm: true, // no verification email needed — a manager vouches for this account
      app_metadata: { role: data.role, display_name: data.displayName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");
    return toStaffAccount(created.user);
  });

const resetPasswordInput = z.object({
  accessToken: z.string(),
  targetUserId: z.string(),
  newPassword: z.string().min(8),
});

/** Manager-only: directly sets another staff member's password (their self-serve reset only works if they have a real email). */
export const resetStaffPassword = createServerFn({ method: "POST" })
  .validator(resetPasswordInput)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await requireManager(data.accessToken);
    const { error } = await supabaseAdmin().auth.admin.updateUserById(data.targetUserId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const setRoleInput = z.object({
  accessToken: z.string(),
  targetUserId: z.string(),
  role: z.enum(["staff", "manager"]),
});

/** Manager-only: promote/demote a staff account between "staff" and "manager". */
export const setStaffRole = createServerFn({ method: "POST" })
  .validator(setRoleInput)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const caller = await requireManager(data.accessToken);
    if (caller.id === data.targetUserId && data.role !== "manager") {
      throw new Error("You can't remove your own manager access.");
    }
    const { data: target, error: fetchError } = await supabaseAdmin().auth.admin.getUserById(
      data.targetUserId,
    );
    if (fetchError || !target.user) throw new Error("Account not found.");
    const { error } = await supabaseAdmin().auth.admin.updateUserById(data.targetUserId, {
      app_metadata: { ...target.user.app_metadata, role: data.role },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteStaffInput = z.object({ accessToken: z.string(), targetUserId: z.string() });

/** Manager-only: removes a staff account entirely. */
export const deleteStaffAccount = createServerFn({ method: "POST" })
  .validator(deleteStaffInput)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const caller = await requireManager(data.accessToken);
    if (caller.id === data.targetUserId) {
      throw new Error("You can't delete your own account while signed in as it.");
    }
    const { error } = await supabaseAdmin().auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });