/**
 * Printable documents: payment receipts, student profiles and test results.
 * All of them go through the browser print dialog so staff and students can
 * save a PDF or print on paper without any extra software.
 */

import { detailHtml, printDocument, printLetterheadDocument, tableHtml, type Row } from "./docs";
import type { Package, Payment, SiteSettings, Student } from "./data";

const money = (n: number) => `$${n}`;
const date = (iso: string) => new Date(iso).toLocaleDateString();

const PAYMENT_LABELS: Record<Payment["status"], string> = {
  pending: "Pending verification",
  confirmed: "Confirmed",
  "not-found": "Not found",
};

export function paymentReceiptHtml(p: Payment, pkg?: Package) {
  return detailHtml("Payment receipt", `Received ${date(p.createdAt)}`, [
    ["Name", p.name],
    ["Phone", p.phone],
    ["Package", pkg?.name ?? "—"],
    ["Amount", money(p.amount)],
    ["EcoCash reference", p.reference],
    ["Status", PAYMENT_LABELS[p.status]],
    ...(p.note ? ([["Note", p.note]] as [string, string][]) : []),
  ]);
}

export function printPaymentReceipt(p: Payment, pkg?: Package) {
  printDocument(`Receipt ${p.reference}`, paymentReceiptHtml(p, pkg));
}

export function printStudentProfile(
  s: Student,
  pkg: Package | undefined,
  payments: Payment[],
  packages: Package[],
) {
  const rows: Row[] = payments.map((p) => ({
    Date: date(p.createdAt),
    Package: packages.find((k) => k.id === p.packageId)?.name ?? "—",
    Amount: money(p.amount),
    Reference: p.reference,
    Status: PAYMENT_LABELS[p.status],
  }));
  const totalPaid = payments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + p.amount, 0);

  printDocument(
    `Student — ${s.name}`,
    detailHtml("Student record", s.name, [
      ["Phone / WhatsApp", s.phone],
      ["Package", pkg?.name ?? "—"],
      ["Enrolled on", date(s.enrolledAt)],
      ["Status", s.status === "active" ? "Active" : "Completed"],
      ["Total confirmed payments", money(totalPaid)],
    ]) + tableHtml("Payments", rows),
  );
}

/**
 * Branded enrolment confirmation — generated the moment admin enrols a
 * student, so it's a complete, self-contained document (school letterhead +
 * student + package + payment info) rather than a plain-text booking
 * receipt with no branding.
 */
export function printEnrolmentConfirmation(
  student: Student,
  pkg: Package | undefined,
  settings: SiteSettings,
  extra: { ref: string; days?: string[]; times?: string[] },
) {
  const pairs: [string, string | number][] = [
    ["Student", student.name],
    ["Phone", student.phone],
    ["Package", pkg ? `${pkg.name} ($${pkg.price})` : "—"],
    ["Enrolment date", date(student.enrolledAt)],
    ["Reference", extra.ref],
  ];
  if (extra.days?.length) pairs.push(["Preferred days", extra.days.join(", ")]);
  if (extra.times?.length) pairs.push(["Preferred time of day", extra.times.join(", ")]);
  pairs.push(["EcoCash number", settings.ecocashNumber]);
  pairs.push(["Payment", "Pay in person at our office, or by EcoCash to the number above."]);

  printLetterheadDocument(
    `Enrolment — ${student.name}`,
    detailHtml(
      "Enrolment Confirmation",
      `Welcome to the school, ${student.name.split(" ")[0]}`,
      pairs,
    ),
    { phone: settings.phone, address: settings.address, hours: settings.hours },
  );
}