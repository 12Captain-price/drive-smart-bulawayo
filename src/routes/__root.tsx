import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WhatsAppFab } from "@/components/site/WhatsAppFab";
import { useIsMobile } from "@/hooks/use-mobile";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="label-mono text-accent">Error 404</p>
        <h1 className="mt-3 text-4xl font-bold">Wrong turn</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          That page doesn't exist. Let's get you back on the road.
        </p>
        <Link
          to="/"
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="border-input hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Auto Driving School | Driving Lessons in Bulawayo" },
      {
        name: "description",
        content:
          "Learn to drive in Bulawayo with Auto Driving School: TSCZ-registered instructors, dual-control cars, beginner, full course and refresher packages.",
      },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "Auto Driving School" },
      { property: "og:site_name", content: "Auto Driving School" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#12256b" },
      { property: "og:title", content: "Auto Driving School | Driving Lessons in Bulawayo" },
      { name: "twitter:title", content: "Auto Driving School | Driving Lessons in Bulawayo" },
      { property: "og:description", content: "Learn to drive in Bulawayo with Auto Driving School: TSCZ-registered instructors, dual-control cars, beginner, full course and refresher packages." },
      { name: "twitter:description", content: "Learn to drive in Bulawayo with Auto Driving School: TSCZ-registered instructors, dual-control cars, beginner, full course and refresher packages." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7cc5ea2d-972a-40b7-9535-916a99bea3f2/id-preview-5c4a5017--c52d3735-1de2-48c6-8736-887b32e47e4b.lovable.app-1785139368715.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7cc5ea2d-972a-40b7-9535-916a99bea3f2/id-preview-5c4a5017--c52d3735-1de2-48c6-8736-887b32e47e4b.lovable.app-1785139368715.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isMobile = useIsMobile();

  useEffect(() => {
    const stored = localStorage.getItem("ads.theme");
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          {/* Required: nested routes render here. */}
          <Outlet />
        </main>
        <Footer />
      </div>
      <WhatsAppFab />
      <Toaster
        position={isMobile ? "top-center" : "top-right"}
        richColors
        closeButton
        toastOptions={{ style: { borderRadius: "var(--radius)" } }}
      />
    </QueryClientProvider>
  );
}