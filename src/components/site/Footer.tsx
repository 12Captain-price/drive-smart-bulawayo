import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Phone } from "lucide-react";
import { Logo } from "./Logo";
import { useSettings, waLink, SITE_NAME } from "@/lib/data";

export function Footer() {
  const { settings } = useSettings();
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;

  return (
    <footer className="bg-secondary/50 mt-20 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo size={44} />
          <p className="text-muted-foreground mt-4 text-sm">
            TSCZ-registered driving school in the heart of Bulawayo. Dual-control vehicles, patient
            instructors, flexible times.
          </p>
        </div>

        <div>
          <h3 className="label-mono text-muted-foreground">Visit us</h3>
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary mt-3 flex gap-2 text-sm transition-colors"
          >
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>{settings.address}</span>
          </a>
          <p className="text-muted-foreground mt-3 flex gap-2 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0" />
            {settings.hours}
          </p>
        </div>

        <div>
          <h3 className="label-mono text-muted-foreground">Talk to us</h3>
          <a
            href={`tel:${settings.phone.replace(/\s/g, "")}`}
            className="hover:text-primary mt-3 flex items-center gap-2 text-sm transition-colors"
          >
            <Phone className="size-4" /> {settings.phone}
          </a>
          <a
            href={waLink(settings.whatsapp, settings.waGeneralTemplate)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-success mt-3 inline-block text-sm font-medium hover:underline"
          >
            Chat on WhatsApp
          </a>
        </div>

        <div>
          <h3 className="label-mono text-muted-foreground">Pages</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { to: "/about", label: "About" },
              { to: "/packages", label: "Packages & Pricing" },
              { to: "/gallery", label: "Gallery" },
              { to: "/tips", label: "Driving Tips" },
              { to: "/faq", label: "FAQ" },
              { to: "/contact", label: "Book a Lesson" },
            ].map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-primary transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="text-muted-foreground border-t px-4 py-5 text-center text-xs">
        © {new Date().getFullYear()} {SITE_NAME}, Bulawayo ·{" "}
        <Link to="/my-lessons" className="hover:text-foreground transition-colors">
          My Lessons
        </Link>{" "}
        ·{" "}
        <Link to="/admin" className="hover:text-foreground transition-colors">
          Admin
        </Link>
      </div>
    </footer>
  );
}