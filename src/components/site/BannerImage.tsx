import { cn } from "@/lib/utils";

/**
 * Banner image display for full-bleed slots (home hero, about banner, contact
 * banner). Shows the whole image uncropped (object-contain) at its original
 * resolution, and fills the surrounding space with a blurred, scaled-up copy
 * so the section still reads as full-bleed. Never crops, never downscales
 * beyond what the browser needs to fit the frame.
 */
export function BannerImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-75"
        loading={priority ? "eager" : "lazy"}
      />
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
        loading={priority ? "eager" : "lazy"}
      />
    </div>
  );
}
