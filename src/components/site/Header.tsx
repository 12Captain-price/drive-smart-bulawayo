import { Link } from "@tanstack/react-router";
import { ChevronDown, CreditCard, ListChecks, Menu, Phone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useSettings } from "@/lib/data";
import { PAYMENTS_PAGE_LIVE } from "@/lib/paynow-server";

/** Always visible on the desktop bar — the core marketing/browse path.
 *  Self-service utility pages (Pay, My Lessons) live in their own small
 *  area to the right instead, so first-time visitors researching the
 *  school aren't shown "Pay" with the same weight as "Packages". */
const primaryNav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/packages", label: "Packages" },
  { to: "/gallery", label: "Gallery" },
  { to: "/contact", label: "Contact" },
];

/** Self-service pages for people who already have a relationship with the
 *  school — kept visually distinct from marketing nav above. */
const utilityNav = [
  ...(PAYMENTS_PAGE_LIVE ? [{ to: "/pay", label: "Pay", icon: CreditCard }] : []),
  { to: "/my-lessons", label: "My Lessons", icon: ListChecks },
];

/** Lower-traffic pages, tucked under a "Resources" menu on desktop so the
 *  main bar doesn't outgrow its own width and wrap. Still listed flat in
 *  the mobile sheet below, where vertical space isn't a constraint. */
const resourcesNav = [
  { to: "/tips", label: "Driving Tips" },
  { to: "/faq", label: "FAQ" },
  { to: "/guide", label: "Help" },
];

/** Mobile sheet groups the same way as desktop: marketing pages first,
 *  then a divider, then the self-service utility pages, then resources. */
const mobileNav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/packages", label: "Packages" },
  { to: "/gallery", label: "Gallery" },
  { to: "/tips", label: "Driving Tips" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/guide", label: "Help" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { settings } = useSettings();

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="transition-opacity hover:opacity-80"
          aria-label="Auto Driving School home"
        >
          <Logo size={36} />
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-primary bg-secondary" }}
              className="hover:bg-secondary rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors"
            >
              {item.label}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hover:bg-secondary flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors"
              >
                Resources
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {resourcesNav.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to} activeProps={{ className: "text-primary" }}>
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-1">
          <div className="mr-1 hidden items-center gap-0.5 border-r pr-1 xl:flex">
            {utilityNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "text-primary bg-secondary" }}
                className="text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors"
              >
                <item.icon className="size-3.5" /> {item.label}
              </Link>
            ))}
          </div>
          <ThemeToggle />
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/contact">Book a Lesson</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="mt-8 flex flex-col gap-1 px-4">
                {mobileNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    activeOptions={{ exact: item.to === "/" }}
                    activeProps={{ className: "text-primary bg-secondary" }}
                    className="hover:bg-secondary rounded-md px-3 py-3 text-base font-medium transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="text-muted-foreground mt-4 border-t px-3 pt-4 text-xs font-semibold tracking-wide uppercase">
                  Your account
                </div>
                {utilityNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    activeProps={{ className: "text-primary bg-secondary" }}
                    className="hover:bg-secondary flex items-center gap-2 rounded-md px-3 py-3 text-base font-medium transition-colors"
                  >
                    <item.icon className="size-4" /> {item.label}
                  </Link>
                ))}

                <Button asChild className="mt-4">
                  <Link to="/contact" onClick={() => setOpen(false)}>
                    Book a Lesson
                  </Link>
                </Button>
                <a
                  href={`tel:${settings.phone.replace(/\s/g, "")}`}
                  className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-2 px-3 text-sm transition-colors"
                >
                  <Phone className="size-4" /> {settings.phone}
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}