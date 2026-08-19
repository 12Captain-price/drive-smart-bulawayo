import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Download, ExternalLink, Loader2, MessageCircle, Search, Smartphone, XCircle } from "lucide-react";
import { detailHtml, printDocument } from "@/lib/docs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/site/blocks";
import {
  errorMessage,
  renderTemplate,
  useEnquiries,
  usePackages,
  usePayments,
  useSettings,
  useStudents,
  waLink,
} from "@/lib/data";
import { checkEcoCashPaymentStatus, initiatePayment, CARD_PAYMENTS_ENABLED, type PaymentMethod } from "@/lib/paynow-server";
import { cn } from "@/lib/utils";

/** How often we poll Paynow for a status change. */
const POLL_INTERVAL_MS = 4000;
/** Give up waiting after this long — the learner can retry from here. */
const POLL_TIMEOUT_MS = 120_000;

type PayStage = "form" | "waiting" | "timed-out" | "failed";

export const Route = createFileRoute("/pay")({
  component: Pay,
  head: () => ({
    meta: [
      { title: "Pay for Your Lessons with EcoCash — Auto Driving School" },
      {
        name: "description",
        content:
          "Pay for your driving lessons at Auto Driving School in Bulawayo instantly with EcoCash — no reference numbers, confirmed automatically.",
      },
      { property: "og:title", content: "Pay for Your Lessons — Auto Driving School" },
      {
        property: "og:description",
        content: "Pay with EcoCash right from your phone — confirmed automatically, no reference to send.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/pay" }],
  }),
});

interface Person {
  key: string;
  studentId?: string;
  name: string;
  phone: string;
  packageId: string;
}

function methodLabel(method: PaymentMethod): string {
  if (method === "ecocash") return "EcoCash";
  if (method === "onemoney") return "OneMoney";
  return "Visa/Mastercard";
}

function Pay() {
  const { settings } = useSettings();
  const { items: packages } = usePackages();
  const { items: students } = useStudents();
  const { items: enquiries } = useEnquiries();
  const { add } = usePayments();

  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("ecocash");
  const [mobileNumber, setMobileNumber] = useState("");
  const [packageId, setPackageId] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [waMessage, setWaMessage] = useState("");

  const [stage, setStage] = useState<PayStage>("form");
  const [stageError, setStageError] = useState("");
  const [paynowReference, setPaynowReference] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  // Card payments leave the site entirely (Paynow's hosted page) and come
  // back via `returnurl=/pay?reference=...`. On mount, pick that up, restore
  // the form details we stashed before redirecting away (the page reloaded
  // fresh, so component state is gone), and resume polling instead of
  // showing a blank form — the payment attempt already happened, we're just
  // waiting to hear the outcome.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedRef = params.get("reference");
    if (!returnedRef) return;
    window.history.replaceState({}, "", window.location.pathname);

    const stashedRaw = sessionStorage.getItem(`paynow-pending:${returnedRef}`);
    if (stashedRaw) {
      try {
        const stashed = JSON.parse(stashedRaw) as {
          name: string;
          phone: string;
          packageId: string;
          person: Person | null;
          method: PaymentMethod;
        };
        setName(stashed.name);
        setPhone(stashed.phone);
        setPackageId(stashed.packageId);
        setPerson(stashed.person);
        if (stashed.method) setMethod(stashed.method);
      } catch {
        // Stash corrupted/missing (e.g. different browser/tab) — the receipt
        // details will just be sparser, but confirmation still works.
      }
      sessionStorage.removeItem(`paynow-pending:${returnedRef}`);
    }

    setPaynowReference(returnedRef);
    setStage("waiting");
    startPolling(returnedRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  const people = useMemo<Person[]>(() => {
    const fromStudents: Person[] = students.map((s) => ({
      key: "s" + s.id,
      studentId: s.id,
      name: s.name,
      phone: s.phone,
      packageId: s.packageId,
    }));
    const fromEnquiries: Person[] = enquiries
      .filter((e) => !students.some((s) => s.phone.replace(/\D/g, "") === e.phone.replace(/\D/g, "")))
      .map((e) => ({ key: "e" + e.id, name: e.name, phone: e.phone, packageId: e.packageId }));
    return [...fromStudents, ...fromEnquiries];
  }, [students, enquiries]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => p.name.toLowerCase().includes(q) || p.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
      .slice(0, 6);
  }, [people, query]);

  const pkg = packages.find((p) => p.id === packageId);
  const amount = pkg?.price ?? 0;

  function choose(p: Person) {
    setPerson(p);
    setName(p.name);
    setPhone(p.phone);
    setPackageId(p.packageId || packageId);
    setQuery("");
  }

  function finalizeConfirmedPayment(finalReference: string) {
    add({
      studentId: person?.studentId,
      name: name.trim(),
      phone: phone.trim(),
      packageId,
      amount,
      reference: finalReference,
      status: "confirmed",
      note: `Confirmed automatically via Paynow (${methodLabel(method)}).`,
      createdAt: new Date().toISOString(),
    });
    const message = renderTemplate(settings.waPaymentTemplate, {
      name: name.trim(),
      phone: phone.trim(),
      package: pkg ? pkg.name : "—",
      amount: String(amount),
      reference: finalReference,
    });
    setWaMessage(message);
    setDone(true);
    toast.success("Payment confirmed!");
    window.open(waLink(settings.whatsapp, message), "_blank", "noopener");
  }

  function startPolling(reference: string) {
    stopPolling();
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    pollTimer.current = setInterval(async () => {
      if (Date.now() > pollDeadline.current) {
        stopPolling();
        setStage("timed-out");
        return;
      }
      try {
        const result = await checkEcoCashPaymentStatus({ data: { reference } });
        if (result.status === "paid") {
          stopPolling();
          setPaynowReference(reference);
          finalizeConfirmedPayment(reference);
        } else if (result.status === "cancelled") {
          stopPolling();
          setStageError("The payment was cancelled or declined on your phone.");
          setStage("failed");
        } else if (result.status === "error" && result.error) {
          // Transient — keep polling, but let the person know what's happening.
          setStageError(result.error);
        }
      } catch (err) {
        // Network hiccup — keep polling until the timeout.
        setStageError(errorMessage(err, "Checking payment status…"));
      }
    }, POLL_INTERVAL_MS);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("Please add your name and phone number");
      return;
    }
    if (!packageId) {
      toast.error("Choose the package you are paying for");
      return;
    }
    if (method !== "card") {
      const pattern = method === "ecocash" ? /^0?7[7-8]\d{7}$/ : /^0?71\d{7}$/;
      const hint =
        method === "ecocash"
          ? "Enter a valid EcoCash number, e.g. 077 123 4567"
          : "Enter a valid OneMoney number, e.g. 071 234 5678";
      if (!pattern.test(mobileNumber.trim())) {
        toast.error(hint);
        return;
      }
    }
    setSubmitting(true);
    setStageError("");
    try {
      const result = await initiatePayment({
        data: {
          name: name.trim(),
          phone: phone.trim(),
          method,
          mobileNumber: method === "card" ? undefined : mobileNumber.trim(),
          packageId,
          packageName: pkg?.name ?? "Driving lessons",
          amount,
        },
      });
      if (!result.ok) {
        toast.error(result.error, { duration: Infinity });
        setSubmitting(false);
        return;
      }

      if (result.browserUrl) {
        // Real card flow — stash form details so we can restore them after
        // Paynow bounces the browser back to /pay?reference=..., then leave
        // the site entirely for Paynow's hosted card-entry page.
        sessionStorage.setItem(
          `paynow-pending:${result.reference}`,
          JSON.stringify({ name: name.trim(), phone: phone.trim(), packageId, person, method }),
        );
        window.location.href = result.browserUrl;
        return;
      }

      setPaynowReference(result.reference);
      setStage("waiting");
      startPolling(result.reference);
      if (result.mock) {
        toast.info("Test mode — no live Paynow keys yet, so this simulates a successful payment.");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Could not start the payment"), { duration: Infinity });
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    stopPolling();
    setStage("form");
    setStageError("");
  }

  return (
    <Section className="max-w-3xl">
      <div className="text-center">
        <p className="label-mono text-accent">Pay Online</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Pay for Your Lessons</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
          Two quick steps, then pay with EcoCash, OneMoney, or your Visa/Mastercard — confirmed
          automatically, no reference numbers to copy.
        </p>
      </div>

      {done ? (
        <Card className="mt-8 shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="text-success size-16" />
            <h2 className="text-xl font-semibold">Payment confirmed!</h2>
            <p className="text-muted-foreground max-w-sm text-sm">
              Your EcoCash payment went through. We've sent the details to WhatsApp for your records.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-success text-success-foreground hover:bg-success/90">
                <a href={waLink(settings.whatsapp, waMessage)} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> Send us the details on WhatsApp
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  try {
                    printDocument(
                      "Payment receipt",
                      detailHtml("Payment receipt", new Date().toLocaleDateString(), [
                        ["Name", name.trim()],
                        ["Phone", phone.trim()],
                        ["Package", pkg?.name ?? "—"],
                        ["Amount", `$${amount}`],
                        [`${methodLabel(method)} reference`, paynowReference],
                        ["Status", "Confirmed"],
                      ]),
                    );
                  } catch (err) {
                    toast.error(errorMessage(err, "Could not open the receipt"));
                  }
                }}
              >
                <Download className="size-4" /> Download receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-6">
          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="space-y-4 pt-6">
              <h2 className="label-mono text-accent">Step 1 — who is this payment for?</h2>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 size-4" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your name or phone number"
                  className="pl-9"
                />
              </div>
              {matches.length > 0 && (
                <div className="grid gap-2">
                  {matches.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => choose(m)}
                      className="hover:border-primary/50 hover:bg-secondary/60 rounded-lg border px-4 py-3 text-left text-sm transition-all hover:shadow-sm active:scale-[0.99]"
                    >
                      <span className="font-medium">{m.name}</span>{" "}
                      <span className="text-muted-foreground font-mono text-xs">{m.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pay-name">Your name</Label>
                  <Input id="pay-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pay-phone">Phone / WhatsApp</Label>
                  <Input
                    id="pay-phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={25}
                    placeholder="078 000 0000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-lg">
            <CardContent className="space-y-4 pt-6">
              <h2 className="label-mono text-accent">Step 2 — what are you paying for?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {packages.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPackageId(p.id)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-all duration-200 active:scale-[0.99]",
                      packageId === p.id
                        ? "border-primary ring-primary/30 shadow-md ring-2"
                        : "hover:border-primary/50 hover:bg-secondary/50 hover:shadow-sm",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-primary font-mono font-bold">${p.price}</span>
                    </div>
                    <span className="label-mono text-muted-foreground mt-1 block">{p.lessons} lessons</span>
                  </button>
                ))}
              </div>
              {pkg && (
                <p className="bg-secondary/60 rounded-lg border px-4 py-3 text-sm">
                  Amount due: <span className="text-primary font-mono font-bold">${amount}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30 shadow-md transition-shadow hover:shadow-lg">
            <CardContent className="space-y-4 pt-6">
              <h2 className="label-mono text-accent">Step 3 — choose how to pay</h2>

              {stage === "form" && (
                <>
                  <div className={cn("grid gap-2", CARD_PAYMENTS_ENABLED ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                    {(
                      [
                        { id: "ecocash", label: "EcoCash", icon: Smartphone },
                        { id: "onemoney", label: "OneMoney", icon: Smartphone },
                        ...(CARD_PAYMENTS_ENABLED
                          ? [{ id: "card" as const, label: "Visa/Mastercard", icon: CreditCard }]
                          : []),
                      ] as { id: PaymentMethod; label: string; icon: typeof Smartphone }[]
                    ).map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all active:scale-[0.99]",
                          method === m.id
                            ? "border-primary ring-primary/30 shadow-md ring-2"
                            : "hover:border-primary/50 hover:bg-secondary/50 hover:shadow-sm",
                          // EcoCash is the default/most-used rail — give it a
                          // touch more visual weight when nothing's selected yet.
                          m.id === "ecocash" && method === "ecocash" && "bg-primary/5",
                        )}
                      >
                        <m.icon className="size-4" /> {m.label}
                      </button>
                    ))}
                  </div>

                  {method !== "card" ? (
                    <>
                      <div className="bg-secondary/60 flex items-start gap-3 rounded-lg border p-4">
                        <Smartphone className="text-primary mt-0.5 size-5 shrink-0" />
                        <p className="text-sm">
                          We'll send a {methodLabel(method)} prompt for{" "}
                          <span className="font-mono font-bold">${amount || "—"}</span> straight to your
                          phone. Enter your PIN there to confirm — no reference numbers to copy.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="pay-mobile">{methodLabel(method)} number to charge</Label>
                        <Input
                          id="pay-mobile"
                          inputMode="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          maxLength={13}
                          placeholder={method === "ecocash" ? "077 123 4567" : "071 234 5678"}
                          className="font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="bg-secondary/60 flex items-start gap-3 rounded-lg border p-4">
                      <CreditCard className="text-primary mt-0.5 size-5 shrink-0" />
                      <p className="text-sm">
                        You'll be taken to Paynow's secure page to enter your card details for{" "}
                        <span className="font-mono font-bold">${amount || "—"}</span>, then brought back
                        here automatically once it's done.
                      </p>
                    </div>
                  )}

                  {/* honeypot — hidden from real users */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute left-[-9999px] h-0 w-0 opacity-0"
                  />

                  <Button type="submit" size="lg" disabled={submitting} className="w-full shadow-md">
                    {submitting ? (
                      "Starting…"
                    ) : method === "card" ? (
                      <>
                        Continue to secure card payment <ExternalLink className="size-4" />
                      </>
                    ) : (
                      `Pay $${amount || "—"} with ${methodLabel(method)}`
                    )}
                  </Button>
                  <p className="text-muted-foreground text-xs">
                    {method === "card"
                      ? "Card payments are handled entirely on Paynow's secure page — we never see your card details."
                      : "Confirmed automatically the moment you approve it on your phone."}
                  </p>
                </>
              )}

              {stage === "waiting" && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="text-primary size-10 animate-spin" />
                  <p className="font-medium">
                    {method === "card" ? "Confirming your card payment…" : `Check your phone for the ${methodLabel(method)} prompt`}
                  </p>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    {method === "card"
                      ? `We're checking with Paynow now that you're back. This should only take a moment.`
                      : `Enter your PIN to approve the $${amount} payment. This page will update itself the moment it's confirmed.`}
                  </p>
                  {stageError && <p className="text-muted-foreground text-xs">{stageError}</p>}
                  <Button type="button" variant="ghost" size="sm" onClick={retry}>
                    Cancel and start over
                  </Button>
                </div>
              )}

              {stage === "timed-out" && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Smartphone className="text-muted-foreground size-10" />
                  <p className="font-medium">Still waiting on that one?</p>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    We haven't heard back yet. If you already approved it on your phone, give it a moment
                    and try checking again — otherwise start a fresh payment.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setStage("waiting");
                        startPolling(paynowReference);
                      }}
                    >
                      Check again
                    </Button>
                    <Button type="button" onClick={retry}>
                      Start over
                    </Button>
                  </div>
                </div>
              )}

              {stage === "failed" && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <XCircle className="text-destructive size-10" />
                  <p className="font-medium">That payment didn't go through</p>
                  <p className="text-muted-foreground max-w-sm text-sm">{stageError}</p>
                  <Button type="button" onClick={retry}>
                    Try again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}
    </Section>
  );
}