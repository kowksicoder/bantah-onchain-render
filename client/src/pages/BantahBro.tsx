import BantahBroFront from "@/app/page";
import type { AppSection } from "@/app/page";
import type { MainContentTopTab } from "@/components/layout/main-content";
import { ThemeProvider } from "@/lib/theme-provider";
import "@/styles/bantahbro-import.css";

export default function BantahBro({
  initialSection,
  initialDashboardTab,
  initialPredictionBattleId,
}: {
  initialSection?: AppSection;
  initialDashboardTab?: MainContentTopTab;
  initialPredictionBattleId?: string;
}) {
  return (
    <div className="bantahbro-next-ui font-mono">
      <ThemeProvider>
        <BantahBroFront
          initialSection={initialSection}
          initialDashboardTab={initialDashboardTab}
          initialPredictionBattleId={initialPredictionBattleId}
        />
      </ThemeProvider>
    </div>
  );
}
