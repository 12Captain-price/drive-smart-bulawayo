import { PolicyAccordion } from "@/components/site/PolicyAccordion";
import { usePaymentPolicy } from "@/lib/data";

/**
 * Renders the school's Payment Fraud & Anti-Fraud Policy (incl. the strict
 * no-refund provision) as its own dedicated page at /payment-policy, linked
 * from the footer. Deliberately NOT embedded in /packages — a payer looking
 * at prices shouldn't have a wall of legal clauses between them and the
 * "Book this package" button; this policy is one click away for anyone who
 * wants to read it before paying, without being in front of them by default.
 *
 * Content is editable from Admin → Content & site → Payment Policy, so the
 * manager can amend wording without a code change. See usePaymentPolicy()
 * in src/lib/data.ts for the underlying single-row Supabase record.
 */
export function PaymentPolicySection() {
  const { content } = usePaymentPolicy();
  return <PolicyAccordion content={content} />;
}