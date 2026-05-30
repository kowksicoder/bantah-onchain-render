'use client';

import ChallengePage from '@/components/pages/challenge-page';
import type { AppSection } from '@/app/page';

interface MainContentProps {
  selectedToken: string;
  setSelectedToken: (token: string) => void;
  activeSection?: AppSection;
  onNavigate?: (section: AppSection) => void;
  onOpenBattle?: (battleId: string) => void;
}

export type MainContentTopTab = 'battles';

export default function MainContent({
  onNavigate,
  onOpenBattle,
}: MainContentProps & { initialTab?: MainContentTopTab }) {
  return <ChallengePage onNavigate={onNavigate} onOpenBattle={onOpenBattle} />;
}
