import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/data";

/**
 * Site logo mark + wordmark. Points at the static /public/logo.png (served
 * directly by Vite) rather than the Lovable-hosted asset URL that used to
 * live in logo.png.asset.json — that URL only resolves when the app is
 * actually running inside Lovable's own environment; on a plain local dev
 * server or LAN IP it 404s. Swap /public/logo.png to change the mark
 * everywhere (header, footer, admin) — the favicon in __root.tsx already
 * points at the same file.
 */
export function Logo({
  className,
  showName = true,
  size = 40,
}: {
  className?: string;
  showName?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/logo.png"
        alt={`${SITE_NAME} logo`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
      />
      {showName && (
        <span className="font-display text-base leading-none font-bold tracking-tight whitespace-nowrap uppercase">
          <span className="text-primary">Auto</span>{" "}
          <span className="text-accent">Driving School</span>
        </span>
      )}
    </span>
  );
}