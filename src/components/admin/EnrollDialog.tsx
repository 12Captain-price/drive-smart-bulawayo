import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  FileDown,
  Loader2,
  MessageCircle,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { printEnrolmentConfirmation } from "@/lib/receipts";
import {
  bookingRef,
  createStudent,
  errorMessage,
  renderTemplate,
  useEnquiries,
  usePackages,
  usePayments,
  useSettings,
  waLink,
  type Enquiry,
  type Student,
} from "@/lib/data";

interface EnrollDialogProps {
  /** The button (or element) that opens the dialog. */
  trigger: ReactNode;
  initialName?: string;
  initialPhone?: string;
  initialPackageId?: string;
  /** Present when enrolling from (or matched to) an enquiry — marks it
   *  enrolled on success and carries its preferred days/times onto both the
   *  welcome message and the PDF. */
  enquiry?: Enquiry;
  /** Present when enrolling from a confirmed payment — links the payment to
   *  the new student once it's created. */
  paymentId?: string;
  /** Called after a successful enrolment, with the new student — used to
   *  jump straight into scheduling a lesson for them. */
  onScheduleNow?: (student: Student) => void;
}

export function EnrollDialog({
  trigger,
  initialName = "",
  initialPhone = "",
  initialPackageId = "",
  enquiry,
  paymentId,
  onScheduleNow,
}: EnrollDialogProps) {
  const { items: packages } = usePackages();
  const { update: updateEnquiry } = useEnquiries();
  const { update: updatePayment } = usePayments();
  const { settings } = useSettings();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [packageId, setPackageId] = useState(initialPackageId);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ student: Student; ref: string; message: string } | null>(
    null,
  );

  function reset() {
    setName(initialName);
    setPhone(initialPhone);
    setPackageId(initialPackageId);
    setResult(null);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      setName(initialName);
      setPhone(initialPhone);
      setPackageId(initialPackageId);
      setResult(null);
    } else {
      reset();
    }
  }

  const pkg = packages.find((p) => p.id === packageId);

  async function submit() {
    if (!name.trim()) return toast.error("Enter the student's name");
    if (!phone.trim()) return toast.error("Enter a phone number");
    if (!packageId) return toast.error("Choose a package");

    setSubmitting(true);
    try {
      const ref = bookingRef();
      const student = await createStudent({
        name: name.trim(),
        phone: phone.trim(),
        packageId,
        enrolledAt: new Date().toISOString().slice(0, 10),
        status: "active",
        enquiryId: enquiry?.id,
      });

      if (enquiry) updateEnquiry(enquiry.id, { status: "enrolled" });
      if (paymentId) updatePayment(paymentId, { studentId: student.id });

      const message = renderTemplate(settings.waWelcomeTemplate, {
        name: student.name,
        phone: student.phone,
        package: pkg ? `${pkg.name} ($${pkg.price})` : "-",
        days: enquiry?.days.join(", ") || "-",
        times: enquiry?.times.join(", ") || "-",
        ref,
      });

      setResult({ student, ref, message });
      toast.success("Student enrolled");
    } catch (err) {
      toast.error(errorMessage(err, "Could not enrol this student"), { duration: Infinity });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Enrol student</DialogTitle>
              <DialogDescription>
                Confirm their details, this creates the student record and generates a branded
                enrolment confirmation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="078 000 0000"
                />
              </div>
              <div className="grid gap-2">
                <Label>Package</Label>
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                >
                  <option value="">Select a package…</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.price})
                    </option>
                  ))}
                </select>
              </div>
              {enquiry && (enquiry.days.length > 0 || enquiry.times.length > 0) && (
                <p className="text-muted-foreground text-xs">
                  Preferred days/times carried over from their enquiry:{" "}
                  {enquiry.days.join(", ") || "any day"} · {enquiry.times.join(", ") || "any time"}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {submitting ? "Enrolling…" : "Enrol student"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-5" /> {result.student.name} is enrolled
              </DialogTitle>
              <DialogDescription>
                Reference {result.ref}. Send their welcome message and save the PDF.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-secondary/60 rounded-lg border p-3">
                <p className="label-mono text-muted-foreground mb-2">Welcome message</p>
                <pre className="text-xs whitespace-pre-wrap">{result.message}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  asChild
                >
                  <a
                    href={waLink(result.student.phone, result.message)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-4" /> Send welcome on WhatsApp
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    printEnrolmentConfirmation(result.student, pkg, settings, {
                      ref: result.ref,
                      days: enquiry?.days,
                      times: enquiry?.times,
                    })
                  }
                >
                  <FileDown className="size-4" /> Download enrolment PDF
                </Button>
                {onScheduleNow && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      reset();
                      onScheduleNow(result.student);
                    }}
                  >
                    <CalendarClock className="size-4" /> Schedule a lesson now
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}