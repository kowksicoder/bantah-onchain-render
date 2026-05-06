import BantahBroFront from "@/app/page";
import type { AppSection } from "@/app/page";
import { ThemeProvider } from "@/lib/theme-provider";
import "@/styles/bantahbro-import.css";

export default function BantahBro({ initialSection }: { initialSection?: AppSection }) {
  return (
    <div className="bantahbro-next-ui font-mono">
      <ThemeProvider>
        <BantahBroFront initialSection={initialSection} />
      </ThemeProvider>
    </div>
  );
}
