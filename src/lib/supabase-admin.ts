import { createClient } from "@supabase/supabase-js";

/**
 * Minimal schema for the tables this admin client touches. Hand-written
 * (not generated) since paynow_transactions lives in
 * supabase/paynow-transactions.sql rather than the app's main generated
 * src/lib/database.types.ts. Keep this in sync with that migration.
 */
export interface PaynowTransactionRow {
  id: string;
  reference: string;
  paynow_reference: string | null;
  poll_url: string | null;
  /** Paynow's hosted card-entry page for "card" transactions — null for mobile money. */
  browser_url: string | null;
  name: string;
  phone: string;
  package_id: string;
  amount: number;
  method: "ecocash" | "onemoney" | "card";
  status: "created" | "sent" | "paid" | "cancelled" | "error" | "expired";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminDatabase {
  public: {
    Tables: {
      paynow_transactions: {
        Row: PaynowTransactionRow;
        Insert: Partial<PaynowTransactionRow> &
          Pick<PaynowTransactionRow, "reference" | "name" | "phone" | "package_id" | "amount">;
        Update: Partial<PaynowTransactionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

/**
 * Server-only Supabase client, authenticated as service_role.
 *
 * Only ever import this from server functions (files that run inside
 * createServerFn handlers), never from a component. `SUPABASE_SERVICE_ROLE_KEY`
 * is deliberately not prefixed with VITE_, so Vite never inlines it into the
 * client bundle — reading it via `process.env` here (rather than
 * `import.meta.env`) keeps it out of the browser build entirely.
 *
 * Used for the paynow_transactions table, which has RLS enabled with no
 * policies — the anon key genuinely cannot read or write it, by design.
 */
function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to your .env (Supabase dashboard > Project Settings > API > service_role key).",
    );
  }

  return createClient<AdminDatabase>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cached: ReturnType<typeof createClient<AdminDatabase>> | undefined;

export function supabaseAdmin() {
  if (!cached) cached = getAdminClient();
  return cached;
}