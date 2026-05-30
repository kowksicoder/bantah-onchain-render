'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import MainContent from '@/components/layout/main-content';
import type { MainContentTopTab } from '@/components/layout/main-content';
import { ChallengeRightSidebar } from '@/components/pages/challenge-page';
import RightPanel from '@/components/layout/right-panel';
import MobileBottomNav from '@/components/layout/mobile-bottom-nav';
import ChatPage from '@/components/pages/chat-page';
import FeedPage from '@/components/pages/feed-page';
import LeaderboardPage from '@/components/pages/leaderboard-page';
import ProfilePage from '@/components/pages/profile-page';
import NotificationsPage from '@/components/pages/notifications-page';
import BattlesPage from '@/components/pages/battles-page';
import RugScorerPage from '@/components/pages/rug-scorer-page';
import LauncherPage from '@/components/pages/launcher-page';
import AgentsPage from '@/components/pages/agents-page';
import AdsPage from '@/components/pages/ads-page';
import PolymarketBattlePage from '@/components/pages/polymarket-battle-page';
import type { BantahBroWalletAction } from '@shared/bantahBroWallet';
import { decodeBantahBroWalletActionParam } from '@shared/bantahBroWalletDeepLink';

export type AppSection =
  | 'challenge'
  | 'dashboard'
  | 'feed'
  | 'chat'
  | 'battles'
  | 'leaderboard'
  | 'agents'
  | 'ads'
  | 'notifications'
  | 'rug-scorer'
  | 'launcher'
  | 'profile'
  | 'prediction'
  | 'prediction-battle';

export type BantahTool =
  | 'assistant'
  | 'wallet'
  | 'discover'
  | 'battle'
  | 'analyze'
  | 'rug'
  | 'runner'
  | 'alerts'
  | 'markets'
  | 'bxbt'
  | 'launcher';

export default function Home({
  initialSection = 'challenge',
  initialDashboardTab = 'battles',
  initialPredictionBattleId = '',
}: {
  initialSection?: AppSection;
  initialDashboardTab?: MainContentTopTab;
  initialPredictionBattleId?: string;
}) {
  const [selectedToken, setSelectedToken] = useState('BOTA');
  const [isMounted, setIsMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>(initialSection);
  const [predictionBattleId] = useState(initialPredictionBattleId);
  const [activeTool, setActiveTool] = useState<BantahTool>('assistant');
  const [pendingWalletAction, setPendingWalletAction] = useState<BantahBroWalletAction | null>(null);

  const normalizeSection = (section: AppSection): AppSection =>
    section === 'dashboard' ? 'challenge' : section;

  const syncSectionUrl = (section: AppSection, battleId?: string | null) => {
    if (typeof window === 'undefined') return;

    const normalizedSection = normalizeSection(section);
    const params = new URLSearchParams(window.location.search);
    params.set('section', normalizedSection);

    if (normalizedSection === 'battles' && battleId?.trim()) {
      params.set('battle', battleId.trim());
      params.set('battleLayer', 'arena');
      params.delete('arenaState');
      params.delete('arenaStartsAt');
      params.delete('arenaMatchup');
      params.delete('arenaLabel');
      params.delete('arenaPreviewId');
    } else {
      params.delete('battle');
      if (normalizedSection !== 'battles') {
        params.delete('battleLayer');
        params.delete('arenaState');
        params.delete('arenaStartsAt');
        params.delete('arenaMatchup');
        params.delete('arenaLabel');
        params.delete('arenaPreviewId');
      }
    }

    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  };

  const handleNavigate = (section: AppSection) => {
    const normalizedSection = normalizeSection(section);
    setActiveSection(normalizedSection);
    syncSectionUrl(section);
  };

  const handleOpenBattle = (battleId: string) => {
    syncSectionUrl('battles', battleId);
    setActiveSection('battles');
  };

  useEffect(() => {
    setIsMounted(true);

    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('section');
    const toolParam = params.get('tool');
    const walletActionParam = params.get('walletAction');

    if (
      sectionParam === 'chat' ||
      sectionParam === 'challenge' ||
      sectionParam === 'dashboard' ||
      sectionParam === 'feed' ||
      sectionParam === 'battles' ||
      sectionParam === 'leaderboard' ||
      sectionParam === 'agents' ||
      sectionParam === 'ads' ||
      sectionParam === 'notifications' ||
      sectionParam === 'rug-scorer' ||
      sectionParam === 'launcher' ||
      sectionParam === 'profile' ||
      sectionParam === 'prediction' ||
      sectionParam === 'prediction-battle'
    ) {
      setActiveSection(normalizeSection(sectionParam));
    }

    if (
      toolParam === 'assistant' ||
      toolParam === 'wallet' ||
      toolParam === 'discover' ||
      toolParam === 'battle' ||
      toolParam === 'analyze' ||
      toolParam === 'rug' ||
      toolParam === 'runner' ||
      toolParam === 'alerts' ||
      toolParam === 'markets' ||
      toolParam === 'bxbt' ||
      toolParam === 'launcher'
    ) {
      setActiveTool(toolParam);
    }

    const decodedWalletAction = decodeBantahBroWalletActionParam(walletActionParam);
    if (decodedWalletAction) {
      setActiveSection('chat');
      setActiveTool('wallet');
      setPendingWalletAction(decodedWalletAction);
    }
  }, []);

  if (!isMounted) return null;

  const renderWithPanel = (content: ReactNode, panel: ReactNode, rightPanelClassName = 'hidden lg:flex') => (
    <div className={`flex-1 flex gap-0.5 overflow-hidden p-0.5 ${activeSection === 'launcher' ? 'pb-0.5' : 'pb-20 md:pb-0.5'} flex-col md:flex-row`}>
      <div className="flex-1 min-w-0 flex overflow-hidden">
        {content}
      </div>
      <div className={rightPanelClassName}>
        {panel}
      </div>
    </div>
  );

  const renderWithRightPanel = (content: ReactNode, rightPanelClassName = 'hidden lg:flex') =>
    renderWithPanel(
      content,
      <RightPanel
        selectedToken={selectedToken}
        onNavigate={handleNavigate}
        onOpenBattle={handleOpenBattle}
      />,
      rightPanelClassName,
    );

  const renderPage = () => {
    switch (activeSection) {
      case 'feed':
        return renderWithRightPanel(<FeedPage />);
      case 'chat':
        return renderWithRightPanel(
          <ChatPage
            activeTool={activeTool}
            onToolChange={setActiveTool}
            pendingWalletAction={pendingWalletAction}
          />,
        );
      case 'battles':
        return (
          <div className="flex-1 flex overflow-hidden p-0">
            <BattlesPage onNavigate={handleNavigate} />
          </div>
        );
      case 'leaderboard':
        return renderWithRightPanel(<LeaderboardPage />);
      case 'agents':
        return renderWithRightPanel(<AgentsPage />);
      case 'ads':
        return renderWithRightPanel(<AdsPage />);
      case 'notifications':
        return renderWithRightPanel(<NotificationsPage />);
      case 'rug-scorer':
        return renderWithRightPanel(<RugScorerPage />);
      case 'launcher':
        return renderWithRightPanel(<LauncherPage />);
      case 'profile':
        return renderWithRightPanel(<ProfilePage />);
      case 'prediction-battle':
        return (
          <div className="flex-1 flex overflow-hidden p-0">
            <PolymarketBattlePage battleId={predictionBattleId} />
          </div>
        );
      default:
        {
          const content = (
            <MainContent
              selectedToken={selectedToken}
              setSelectedToken={setSelectedToken}
              activeSection={activeSection}
              onNavigate={handleNavigate}
              onOpenBattle={handleOpenBattle}
              initialTab={initialDashboardTab}
            />
          );

          if (activeSection === 'challenge') {
            return renderWithPanel(content, <ChallengeRightSidebar />, 'hidden lg:flex');
          }

          return renderWithRightPanel(
            content,
            activeSection === 'prediction' ? 'w-full md:w-auto' : 'hidden lg:flex'
          );
        }
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar
          activeSection={activeSection}
          activeTool={activeTool}
          onNavigate={handleNavigate}
          onToolSelect={setActiveTool}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={activeSection === 'battles' ? 'hidden md:block' : 'block'}>
          <TopBar
            onNavigate={handleNavigate}
            onOpenBattle={handleOpenBattle}
            activeSection={activeSection}
            activeTool={activeTool}
            onToolSelect={setActiveTool}
          />
        </div>
        {renderPage()}
      </div>

      {activeSection !== 'battles' && activeSection !== 'launcher' && <MobileBottomNav activeSection={activeSection} onNavigate={handleNavigate} />}
    </div>
  );
}
