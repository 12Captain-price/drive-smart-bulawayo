/**
 * Paynow integration — EcoCash / OneMoney Express Checkout, plus Visa /
 * Mastercard via Paynow's hosted card page.
 *
 * Two server functions, callable from the client like normal async
 * functions — TanStack Start turns them into RPC endpoints under the hood:
 *
 *   - initiatePayment: for "ecocash"/"onemoney" this triggers the USSD/PIN
 *     prompt on the learner's phone (Express Checkout) and returns our
 *     internal `reference` plus a Paynow `pollUrl`. For "card" there's no
 *     prompt — Paynow has no card Express Checkout, so we get back a
 *     `browserUrl` instead and the client redirects the whole page there;
 *     the learner enters card details on Paynow's hosted page and gets
 *     bounced back to `returnurl` (our own /pay) when done.
 *   - checkEcoCashPaymentStatus: polls Paynow for a reference's current
 *     status. For ecocash/onemoney this is Paynow's own recommended flow
 *     (see https://developers.paynow.co.zw) — no public webhook endpoint
 *     required. For card payments, the same poll endpoint is used but is
 *     mainly a formality: by the time the learner is back on /pay after the
 *     hosted-page redirect, Paynow has usually already settled the status.
 *
 * Both run server-side only, so PAYNOW_INTEGRATION_KEY and the Supabase
 * service role key never reach the browser.
 *
 * MOCK MODE: until PAYNOW_INTEGRATION_ID / PAYNOW_INTEGRATION_KEY are set to
 * real values in .env, initiate returns a mock reference and the status
 * check auto-resolves to "paid" after 8 seconds — enough to build and test
 * the whole frontend flow (loading state, polling, success screen) before
 * live credentials exist. Swap in real values and nothing else changes.
 * Card mode is mocked too — no real redirect, same 8s auto-confirm.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin, type PaynowTransactionRow } from "./supabase-admin.ts";

/** Same client `supabaseAdmin()` returns, just cast once here instead of at
 *  every call site — mirrors the `(supabase.from(table) as any)` pattern
 *  already used throughout src/lib/data.ts for this Supabase client version. */
function paynowTable() {
  return supabaseAdmin().from("paynow_transactions") as any;
}

const PAYNOW_INITIATE_URL = "https://www.paynow.co.zw/interface/remotetransaction";
const MOCK_PAID_AFTER_MS = 1000;

type PaynowFields = Record<string, string>;

/** SHA-512, uppercase hex — the exact format Paynow's hash spec requires. */
async function sha512Upper(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Concatenate field values in order (no separators), append the integration
 *  key, SHA-512, uppercase — per https://developers.paynow.co.zw/docs/paynow/generating_hash/ */
async function signPaynowFields(fields: PaynowFields, integrationKey: string): Promise<string> {
  const concatenated = Object.values(fields).join("");
  return sha512Upper(concatenated + integrationKey);
}

function parsePaynowResponse(body: string): PaynowFields {
  const params = new URLSearchParams(body);
  const result: PaynowFields = {};
  for (const [key, value] of params) result[key.toLowerCase()] = value;
  return result;
}

/** Verifies an inbound Paynow response wasn't tampered with in transit. */
async function verifyPaynowHash(fields: PaynowFields, integrationKey: string): Promise<boolean> {
  const { hash, ...rest } = fields;
  if (!hash) return false;
  const expected = await signPaynowFields(rest, integrationKey);
  return expected === hash.toUpperCase();
}

function getPaynowCredentials() {
  // .trim() guards against a trailing newline/space sneaking into a
  // dashboard-pasted secret — invisible in the UI but silently breaks the
  // SHA-512 hash Paynow computes on their end, producing a hash mismatch
  // ("Invalid Hash...") even though the key "looks" right.
  const id = process.env.PAYNOW_INTEGRATION_ID?.trim();
  const key = process.env.PAYNOW_INTEGRATION_KEY?.trim();
  const email = process.env.PAYNOW_MERCHANT_EMAIL?.trim();
  const isPlaceholder =
    !id || !key || id === "your-paynow-integration-id" || key === "your-paynow-integration-key";
  if (isPlaceholder) return null;
  return { id: id!, key: key!, email: email && !email.startsWith("payments@example") ? email : "payments@example.co.zw" };
}

function generateReference() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ADS-${stamp}-${rand}`;
}

/* ------------------------------- initiate -------------------------------- */

export const PAYMENT_METHODS = ["ecocash", "onemoney", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Card payments require your Paynow merchant account to be verified as a
 * registered company (not a sole trader) — see Paynow's onboarding docs.
 * Flip this to true once that's confirmed on your dashboard; until then the
 * card option is hidden on /pay and rejected here too, so nobody can hit a
 * Paynow error mid-payment for a rail your account doesn't actually support
 * yet.
 */
export const CARD_PAYMENTS_ENABLED = true;

/**
 * OneMoney is only enabled on this Paynow integration in ZWG — this site
 * charges in USD, and Paynow rejects a USD request for a payment method
 * that isn't enabled in USD on the account. Flip this to true if/when
 * OneMoney USD gets enabled on the Paynow dashboard (Payment Methods list);
 * until then it's hidden on /pay and rejected here too, same pattern as
 * CARD_PAYMENTS_ENABLED above.
 */
export const ONEMONEY_ENABLED = false;

/** Mobile-money number validation, per network. Card has no phone field. */
const MOBILE_NUMBER_PATTERNS: Record<"ecocash" | "onemoney", { regex: RegExp; hint: string }> = {
  ecocash: { regex: /^0?7[7-8]\d{7}$/, hint: "Enter a valid EcoCash number, e.g. 077 123 4567" },
  // NetOne/OneMoney numbers use the 071 prefix.
  onemoney: { regex: /^0?71\d{7}$/, hint: "Enter a valid OneMoney number, e.g. 071 234 5678" },
};

const initiateInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    /** Contact number, shown on the receipt/WhatsApp message — not necessarily the mobile-money number. */
    phone: z.string().trim().min(1).max(25),
    method: z.enum(PAYMENT_METHODS),
    /** Required for ecocash/onemoney (the number to actually charge). Omitted for card. */
    mobileNumber: z.string().trim().max(25).optional(),
    packageId: z.string().trim().min(1),
    packageName: z.string().trim().min(1).max(120),
    amount: z.number().positive().max(100000),
    /** What the payer says this specific payment is for, e.g. "Deposit for
     *  20 lessons". Optional — shown on Paynow's own prompt/dashboard via
     *  `additionalinfo` so it isn't just buried in our own records. */
    note: z.string().trim().max(140).optional(),
  })
  .refine((data) => CARD_PAYMENTS_ENABLED || data.method !== "card", {
    message: "Card payments aren't available yet. Please use EcoCash or OneMoney.",
    path: ["method"],
  })
  .refine((data) => ONEMONEY_ENABLED || data.method !== "onemoney", {
    message: "OneMoney isn't available yet. Please use EcoCash instead.",
    path: ["method"],
  })
  .refine(
    (data) => {
      if (data.method === "card") return true;
      const pattern = MOBILE_NUMBER_PATTERNS[data.method];
      return !!data.mobileNumber && pattern.regex.test(data.mobileNumber.trim());
    },
    (data) => ({
      message:
        data.method === "card" ? "" : (MOBILE_NUMBER_PATTERNS[data.method as "ecocash" | "onemoney"]?.hint ?? "Enter a valid mobile number"),
      path: ["mobileNumber"],
    }),
  );

export type InitiateResult =
  | { ok: true; reference: string; mock: boolean; instructions?: string; browserUrl?: string }
  | { ok: false; error: string };

export const initiatePayment = createServerFn({ method: "POST" })
  .validator(initiateInput)
  .handler(async ({ data }): Promise<InitiateResult> => {
    const reference = generateReference();
    const creds = getPaynowCredentials();

    if (!creds) {
      // No live keys yet — record the attempt and hand back a mock
      // reference so the rest of the flow (polling + success screen) works
      // end-to-end. See MOCK MODE note at the top of this file. Card mode
      // gets the same mock treatment — no real redirect happens.
      const { error } = await paynowTable().insert({
        reference,
        name: data.name,
        phone: data.phone,
        package_id: data.packageId,
        amount: data.amount,
        method: data.method,
        status: "sent",
        poll_url: `mock://${reference}`,
      });
      if (error) return { ok: false, error: "Could not start the payment. Please try again." };
      return { ok: true, reference, mock: true, instructions: "Test mode: no real charge will happen." };
    }

    const siteUrl = process.env.SITE_URL || "https://example.co.zw";
    const fields: PaynowFields = {
      id: creds.id,
      reference,
      amount: data.amount.toFixed(2),
      additionalinfo: data.note ? `${data.packageName}: ${data.note}` : data.packageName,
      returnurl: `${siteUrl}/pay?reference=${encodeURIComponent(reference)}`,
      // We poll pollurl for status instead of relying on this being hit, so
      // it just needs to be a valid, reachable URL — see file header.
      resulturl: `${siteUrl}/pay`,
      // authemail is optional per Paynow's docs. While this integration is
      // still in test mode, Paynow requires authemail (if sent at all) to
      // exactly match the merchant account's own login email — which kept
      // rejecting real customer flows. Omitting it entirely sidesteps that
      // restriction now and still works fine once the integration goes
      // Live. Revisit later if you want auto-login-by-email for customers
      // (pass the customer's own email here instead of the merchant's).
      status: "Message",
    };
    // Mobile money (Express Checkout) needs `method` + `phone` so Paynow
    // fires the USSD/PIN prompt directly. Card has neither — omitting both
    // is what makes Paynow return a `browserurl` hosted-page redirect
    // instead, per https://developers.paynow.co.zw/docs/integration_types
    if (data.method !== "card") {
      fields.method = data.method;
      fields.phone = data.mobileNumber!.replace(/\s/g, "");
    }
    const hash = await signPaynowFields(fields, creds.key);

    await paynowTable().insert({
      reference,
      name: data.name,
      phone: data.phone,
      package_id: data.packageId,
      amount: data.amount,
      method: data.method,
      status: "created",
    });

    let responseText: string;
    try {
      const response = await fetch(PAYNOW_INITIATE_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...fields, hash }).toString(),
      });
      responseText = await response.text();
    } catch {
      await paynowTable()
        .update({ status: "error", error_message: "Network error contacting Paynow" })
        .eq("reference", reference);
      return { ok: false, error: "Could not reach Paynow. Check your connection and try again." };
    }

    const parsed = parsePaynowResponse(responseText);

    if (parsed.status?.toLowerCase() !== "ok") {
      const errorMsg = parsed.error || "Paynow rejected the request.";
      await paynowTable()
        .update({ status: "error", error_message: errorMsg })
        .eq("reference", reference);
      return { ok: false, error: errorMsg };
    }

    if (!(await verifyPaynowHash(parsed, creds.key))) {
      await paynowTable()
        .update({ status: "error", error_message: "Response hash mismatch" })
        .eq("reference", reference);
      return { ok: false, error: "Could not verify Paynow's response. Please try again." };
    }

    if (data.method === "card") {
      // Hosted redirect flow — Paynow's initiate response includes both
      // browserurl (where we send the browser now) and pollurl (what we
      // check with once the learner is bounced back to returnurl), same as
      // the mobile-money response shape.
      await paynowTable()
        .update({ status: "sent", browser_url: parsed.browserurl, poll_url: parsed.pollurl })
        .eq("reference", reference);
      return { ok: true, reference, mock: false, browserUrl: parsed.browserurl };
    }

    await paynowTable()
      .update({ status: "sent", poll_url: parsed.pollurl })
      .eq("reference", reference);

    return { ok: true, reference, mock: false, instructions: parsed.instructions };
  });

/** Back-compat alias — existing callers importing the old name keep working. */
export const initiateEcoCashPayment = initiatePayment;

/* -------------------------------- status --------------------------------- */

const statusInput = z.object({ reference: z.string().trim().min(1) });

export type PaymentPollStatus = "sent" | "paid" | "cancelled" | "error";

export interface StatusResult {
  status: PaymentPollStatus;
  amount?: number;
  error?: string;
}

export const checkEcoCashPaymentStatus = createServerFn({ method: "POST" })
  .validator(statusInput)
  .handler(async ({ data }): Promise<StatusResult> => {
    const { data: txnData, error: fetchError } = await paynowTable()
      .select("*")
      .eq("reference", data.reference)
      .single();

    if (fetchError || !txnData) return { status: "error", error: "Transaction not found" };
    const txn = txnData as PaynowTransactionRow;

    if (typeof txn.poll_url === "string" && txn.poll_url.startsWith("mock://")) {
      const ageMs = Date.now() - new Date(txn.created_at).getTime();
      const status: PaymentPollStatus = ageMs > MOCK_PAID_AFTER_MS ? "paid" : "sent";
      if (status === "paid" && txn.status !== "paid") {
        await paynowTable().update({ status: "paid" }).eq("reference", data.reference);
      }
      return { status, amount: Number(txn.amount) };
    }

    if (txn.status === "paid" || txn.status === "cancelled") {
      return { status: txn.status, amount: Number(txn.amount) };
    }

    const creds = getPaynowCredentials();
    if (!creds || !txn.poll_url) {
      return { status: "error", amount: Number(txn.amount), error: "Payment not configured" };
    }

    let responseText: string;
    try {
      const response = await fetch(txn.poll_url, { method: "POST" });
      responseText = await response.text();
    } catch {
      return { status: "sent", amount: Number(txn.amount), error: "Could not reach Paynow" };
    }

    const parsed = parsePaynowResponse(responseText);
    if (!(await verifyPaynowHash(parsed, creds.key))) {
      return { status: "sent", amount: Number(txn.amount), error: "Could not verify Paynow's response" };
    }

    const paynowStatus = (parsed.status || "").toLowerCase();
    const normalized: PaymentPollStatus =
      paynowStatus === "paid"
        ? "paid"
        : paynowStatus === "cancelled" || paynowStatus === "failed"
          ? "cancelled"
          : "sent";

    if (normalized !== txn.status) {
      await paynowTable()
        .update({
          status: normalized,
          paynow_reference: parsed.paynowreference || txn.paynow_reference,
        })
        .eq("reference", data.reference);
    }

    return { status: normalized, amount: Number(parsed.amount ?? txn.amount) };
  });