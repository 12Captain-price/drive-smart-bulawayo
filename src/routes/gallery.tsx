import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CtaBand, Lightbox, Section, SectionHeading } from "@/components/site/blocks";
import { fetchGalleryData, publishedPhotos, usePhotos } from "@/lib/data";
import { placeholderGallery } from "@/lib/placeholders";

const PAGE_SIZE = 12;

export const Route = createFileRoute("/gallery")({
  component: Gallery,
  loader: () => fetchGalleryData(),
  head: () => ({
    meta: [
      { title: "Photo Gallery | Auto Driving School Bulawayo" },
      {
        name: "description",
        content:
          "Photos of Auto Driving School in Bulawayo: our vehicles, the practice yard, instructors and learners in training.",
      },
      { property: "og:title", content: "Photo Gallery | Auto Driving School Bulawayo" },
      { property: "og:description", content: "See our cars, yard and learners in training." },
      { property: "og:url", content: "/gallery" },
    ],
    links: [{ rel: "canonical", href: "/gallery" }],
  }),
});

function Gallery() {
  const { items } = usePhotos();
  const uploaded = publishedPhotos(items, "gallery");
  const photos = uploaded.length
    ? uploaded.map((p) => ({ src: p.src, caption: p.caption }))
    : placeholderGallery;

  const [visible, setVisible] = useState(PAGE_SIZE);
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <>
      <Section>
        <SectionHeading eyebrow="Gallery" title="Auto Driving School in pictures" />
        <div className="mt-10 columns-2 gap-3 sm:columns-3 lg:columns-4">
          {photos.slice(0, visible).map((p, i) => (
            <button
              key={i}
              onClick={() => setLightbox(i)}
              className="group relative mb-3 block w-full overflow-hidden rounded-lg"
            >
              <img
                src={p.src}
                alt={p.caption || "Auto Driving School photo"}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {p.caption && (
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/75 to-transparent px-3 pt-8 pb-2.5 text-left text-xs text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  {p.caption}
                </span>
              )}
            </button>
          ))}
        </div>
        {visible < photos.length && (
          <div className="mt-8 text-center">
            <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Load more photos
            </Button>
          </div>
        )}
      </Section>

      {lightbox !== null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}

      <CtaBand />
    </>
  );
}