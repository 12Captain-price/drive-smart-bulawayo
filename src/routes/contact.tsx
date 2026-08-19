import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, MapPin, MessageCircle, Phone, Smartphone } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { BannerImage } from "@/components/site/BannerImage";
import { Section } from "@/components/site/blocks";
import {
  TIME_SLOTS,
  bookedSlotKeys,
  bookingRef,
  errorMessage,
  fetchContactData,
  findClashes,
  publishedPhotos,
  renderTemplate,
  slotKey,
  useEnquiries,
  usePackages,
  usePhotos,
  useSettings,
  waLink,
} from "@/lib/data";
import { placeholderContact } from "@/lib/placeholders";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/contact")({
  component: Contact,
  loader: () => fetchContactData(),
  head: () => ({
    meta: [
      { title: "Book a Driving Lesson in Bulawayo — Auto Driving School" },
      {
        name: "description",
        content:
          "Book driving lessons in Bulawayo. Pick a package, choose your days and times, and we'll WhatsApp you within a few hours.",
      },
      { property: "og:title", content: "Book a Driving Lesson in Bulawayo" },
      { property: "og:description", content: "Call, WhatsApp or send a booking request online." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["Morning", "Afternoon", "Evening"];

function Chip({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors active:scale-95",
        disabled
          ? "text-muted-foreground cursor-not-allowed line-through opacity-50"
          : active
            ? "border-primary bg-primary text-primary-foreground"
            : "hover:bg-secondary hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function Contact() {
  const { settings } = useSettings();
  const { items: packages } = usePackages();
  const { items: photos } = usePhotos();
  const { items: enquiries, add } = useEnquiries();

  const banner = publishedPhotos(photos, "contact")[0];

  const [packageId, setPackageId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [waMessage, setWaMessage] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  const taken = useMemo(() => bookedSlotKeys(enquiries), [enquiries]);
  /** A slot is unavailable when every selected day already has it booked. */
  const slotUnavailable = (s: string) =>
    days.length > 0 && days.every((d) => taken.has(slotKey(d, s)));
  const clashes = findClashes(days, slots, taken);


  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const mapQuery = encodeURIComponent(settings.address);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return; // bot
    if (!name.trim() || !phone.trim()) {
      toast.error("Please add your name and phone number");
      return;
    }
    if (!packageId) {
      toast.error("Choose a package to continue");
      return;
    }
    if (clashes.length) {
      toast.error(`Already booked: ${clashes.join(", ")}. Please pick another time.`);
      return;
    }
    setSubmitting(true);
    try {
      const ref = bookingRef();
      const created = new Date();
      add({
        ref,
        name: name.trim(),
        phone: phone.trim(),
        packageId,
        days,
        times,
        slots,
        status: "new",
        createdAt: created.toISOString(),
      });
      const pkg = packages.find((p) => p.id === packageId);
      const vars = {
        ref,
        name: name.trim(),
        phone: phone.trim(),
        package: pkg ? `${pkg.name} ($${pkg.price})` : "—",
        days: days.join(", ") || "any day",
        times: times.join(", ") || "any time",
        slots: slots.join(", ") || "flexible",
      };
      setWaMessage(renderTemplate(settings.waBookingTemplate, vars));
      setReference(ref);
      setReceipt(
        [
          "AUTO DRIVING SCHOOL — BOOKING RECEIPT",
          "======================================",
          `Reference:      ${ref}`,
          `Issued:         ${created.toLocaleString()}`,
          "",
          `Name:           ${vars.name}`,
          `Phone:          ${vars.phone}`,
          `Package:        ${vars.package}`,
          `Preferred days: ${vars.days}`,
          `Time of day:    ${vars.times}`,
          `Lesson slots:   ${vars.slots}`,
          "",
          "Status:         Request received (not yet confirmed)",
          `Contact:        ${settings.phone} · ${settings.address}`,
        ].join("\n"),
      );
      toast.success("Enquiry saved — we'll be in touch");
      setDone(name.trim());
    } catch (err) {
      toast.error(errorMessage(err, "Could not save your enquiry"), {
        duration: Infinity,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function downloadReceipt() {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([receipt], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-driving-school-${reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }



  return (
    <>
      <div className="bg-secondary relative h-[38vh] min-h-[260px] w-full overflow-hidden">
        <BannerImage src={banner?.src ?? placeholderContact} alt="Auto Driving School office" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/25" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Book a Lesson</h1>
          <p className="mt-2 max-w-lg text-sm text-white/85">
            Tell us what suits you and we'll confirm your first lesson on WhatsApp.
          </p>
        </div>
      </div>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            {done ? (
              <Card>
                <CardContent className="space-y-5 py-10">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <CheckCircle2 className="text-success size-14" />
                    <h2 className="text-xl font-semibold">Thanks {done}!</h2>
                    <p className="text-muted-foreground max-w-sm text-sm">
                      We'll WhatsApp you within a few hours to confirm your lesson time.
                    </p>
                    <p className="label-mono text-accent">Reference {reference}</p>
                  </div>

                  <div>
                    <Label htmlFor="wa-review">Review your WhatsApp message</Label>
                    <Textarea
                      id="wa-review"
                      rows={9}
                      value={waMessage}
                      onChange={(ev) => setWaMessage(ev.target.value)}
                      className="mt-2 font-mono text-xs"
                    />
                    <p className="text-muted-foreground mt-2 text-xs">
                      Edit anything before you send it.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <Button asChild>
                      <a href={waLink(settings.whatsapp, waMessage)} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" /> Send on WhatsApp
                      </a>
                    </Button>
                    <Button variant="outline" onClick={downloadReceipt}>
                      <Download className="size-4" /> Download receipt
                    </Button>
                  </div>

                  <pre className="bg-secondary/60 overflow-x-auto rounded-lg border p-4 text-xs">
                    {receipt}
                  </pre>
                </CardContent>
              </Card>

            ) : (
              <form onSubmit={submit} className="space-y-8">
                <div>
                  <h2 className="label-mono text-accent">Step 1 — choose a package</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {packages.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPackageId(p.id)}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-all active:scale-[0.99]",
                          packageId === p.id
                            ? "border-primary ring-primary/30 ring-2"
                            : "hover:border-primary/50 hover:bg-secondary/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-primary font-mono font-bold">${p.price}</span>
                        </div>
                        <span className="label-mono text-muted-foreground mt-1 block">
                          {p.lessons} lessons
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone / WhatsApp</Label>
                    <Input
                      id="phone"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={25}
                      placeholder="078 000 0000"
                    />
                  </div>
                </div>

                <div>
                  <h2 className="label-mono text-accent">Step 2 — preferred days</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <Chip key={d} active={days.includes(d)} onClick={() => toggle(days, setDays, d)}>
                        {d}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {TIMES.map((t) => (
                      <Chip key={t} active={times.includes(t)} onClick={() => toggle(times, setTimes, t)}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="label-mono text-accent">Step 3 — preferred time slots</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Pick one or more lesson start times that suit you. Slots already booked on all
                    your chosen days are crossed out.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {TIME_SLOTS.map((s) => {
                      const unavailable = slotUnavailable(s);
                      return (
                        <Chip
                          key={s}
                          active={slots.includes(s)}
                          disabled={unavailable}
                          title={unavailable ? "Already booked" : undefined}
                          onClick={() => toggle(slots, setSlots, s)}
                        >
                          {s}
                        </Chip>
                      );
                    })}
                  </div>
                  {clashes.length > 0 && (
                    <p className="text-destructive mt-3 text-xs">
                      Already booked: {clashes.join(", ")} — please choose another time.
                    </p>
                  )}
                </div>



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

                <div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || clashes.length > 0}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? "Sending…" : "Send booking request"}
                  </Button>

                  <p className="text-muted-foreground mt-3 text-xs">
                    We reply within a few hours — no spam, ever.
                  </p>
                </div>
              </form>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h2 className="label-mono text-muted-foreground">Find us</h2>
                  <p className="mt-2 flex gap-2 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0" /> {settings.address}
                  </p>
                </div>
                <iframe
                  title="Auto Driving School location"
                  src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                  loading="lazy"
                  className="h-52 w-full rounded-lg border"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <a
                  href={`tel:${settings.phone.replace(/\s/g, "")}`}
                  className="hover:text-primary flex items-center gap-2 text-sm transition-colors"
                >
                  <Phone className="size-4" /> {settings.phone}
                </a>
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Clock className="size-4" /> {settings.hours}
                </p>
                <Button asChild className="bg-success text-success-foreground hover:bg-success/90 w-full shadow-sm transition-all hover:shadow-md">
                  <a
                    href={settings.waGeneralTemplate ? waLink(settings.whatsapp, settings.waGeneralTemplate) : waLink(settings.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-4" /> WhatsApp us
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full transition-all hover:shadow-md">
                  <Link to="/pay">
                    <Smartphone className="size-4" /> Pay for your lessons
                  </Link>
                </Button>

              </CardContent>
            </Card>
          </aside>
        </div>
      </Section>
    </>
  );
}