import { MessageCircle } from "lucide-react";
import { useSettings, waLink } from "@/lib/data";

export function WhatsAppFab() {
  const { settings } = useSettings();
  return (
    <a
      href={waLink(settings.whatsapp, settings.waGeneralTemplate)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="bg-success text-success-foreground fixed right-4 bottom-4 z-50 inline-flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <MessageCircle className="size-7" />
    </a>
  );
}
