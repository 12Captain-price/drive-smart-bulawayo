/**
 * Printable documents: payment receipts, student profiles and test results.
 * All of them go through the browser print dialog so staff and students can
 * save a PDF or print on paper without any extra software.
 */

import { detailHtml, printDocument, printLetterheadDocument, tableHtml, type Row } from "./docs";
import type { Package, Payment, SiteSettings, Student, LessonStatus } from "./data";

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

/* ----------------------------- lessons report ------------------------------ */

const escapeHtml = (v: string | number) =>
  String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

const LESSON_STATUS_STYLE: Record<LessonStatus, { bg: string; fg: string; label: string }> = {
  scheduled: { bg: "#e8f0fe", fg: "#1a56db", label: "Scheduled" },
  completed: { bg: "#e6f6ec", fg: "#0f7a3d", label: "Completed" },
  cancelled: { bg: "#fdecec", fg: "#c0392b", label: "Cancelled" },
  "no-show": { bg: "#fff4e0", fg: "#b7791f", label: "No-show" },
};

function statusPill(status: LessonStatus) {
  const s = LESSON_STATUS_STYLE[status];
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${s.bg};color:${s.fg};white-space:nowrap">${s.label}</span>`;
}

/** A single lesson, already resolved to display strings, for the printed report. */
export interface LessonReportRow {
  date: string;
  time: string;
  student: string;
  instructor: string;
  type: string;
  duration: string;
  status: LessonStatus;
  notes: string;
}

function statCard(label: string, value: number, accent?: string) {
  return `<div style="flex:1;min-width:108px;border:1px solid #d8dee8;border-radius:12px;padding:13px 15px">
    <div style="font-size:10.5px;color:#667;text-transform:uppercase;letter-spacing:.06em;font-weight:600">${escapeHtml(label)}</div>
    <div style="font-size:24px;font-weight:800;margin-top:3px;color:${accent ?? "#11223a"}">${value}</div>
  </div>`;
}

/**
 * Printable "lesson history" report for the schedule panel — either every
 * lesson for one student, or every lesson across the whole school. Built as
 * its own layout (rather than the generic tableHtml helper) so the status of
 * each lesson shows as a coloured pill and the top of the page summarises
 * counts at a glance, matching how the rest of the exports read.
 */
export function printLessonsReport(
  settings: SiteSettings,
  scope: { title: string; subtitle: string },
  rows: LessonReportRow[],
  showStudentColumn: boolean,
) {
  const counts: Record<LessonStatus, number> = {
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    "no-show": 0,
  };
  rows.forEach((r) => counts[r.status]++);

  const stats = `<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
    ${statCard("Total lessons", rows.length)}
    ${statCard("Scheduled", counts.scheduled, "#1a56db")}
    ${statCard("Completed", counts.completed, "#0f7a3d")}
    ${statCard("Cancelled", counts.cancelled, "#c0392b")}
    ${statCard("No-show", counts["no-show"], "#b7791f")}
  </div>`;

  const headers = [
    "Date",
    "Time",
    ...(showStudentColumn ? ["Student"] : []),
    "Instructor",
    "Type",
    "Duration",
    "Status",
    "Notes",
  ];

  const table = rows.length
    ? `<table style="margin-top:20px"><thead><tr>${headers
        .map((h) => `<th>${escapeHtml(h)}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map(
          (r) => `<tr>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.time)}</td>
            ${showStudentColumn ? `<td>${escapeHtml(r.student)}</td>` : ""}
            <td>${escapeHtml(r.instructor)}</td>
            <td style="text-transform:capitalize">${escapeHtml(r.type)}</td>
            <td>${escapeHtml(r.duration)}</td>
            <td>${statusPill(r.status)}</td>
            <td>${escapeHtml(r.notes || "—")}</td>
          </tr>`,
        )
        .join("")}</tbody></table>`
    : `<p style="color:#667;font-size:13px;margin-top:16px">No lessons match this view yet.</p>`;

  printLetterheadDocument(
    scope.title,
    `<h1>${escapeHtml(scope.title)}</h1><div class="meta">${escapeHtml(scope.subtitle)}</div>${stats}${table}`,
    { phone: settings.phone, address: settings.address, hours: settings.hours },
  );
}