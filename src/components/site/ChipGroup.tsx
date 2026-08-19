import { cn } from "@/lib/utils";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Clickable pill group used everywhere in place of a dropdown/<select>.
 * Single-choice by default; keeps the whole site free of select elements.
 */
export function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
  ariaLabel,
}: {
  value: T | undefined;
  options: ChipOption<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border font-medium transition-all duration-200 active:scale-95",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "hover:border-primary/50 hover:bg-secondary hover:shadow-sm",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
