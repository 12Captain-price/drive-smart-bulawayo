import { PolicyAccordion } from "@/components/site/PolicyAccordion";
import { useTerms } from "@/lib/data";

/**
 * Renders the school's Terms and Conditions as its own dedicated page at
 * /terms, linked from the footer alongside the Payment & Anti-Fraud Policy.
 *
 * Content is editable from Admin → Content & site → Terms and Conditions.
 * The starter wording in defaultTermsContent (src/lib/data.ts) is a
 * reasonable first draft for a Bulawayo driving school, not legal advice —
 * worth a lawyer's review before relying on it.
 */
export function TermsSection() {
  const { content } = useTerms();
  return <PolicyAccordion content={content} />;
}