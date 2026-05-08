'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Sidebar from '@/components/layout/sidebar';
import TopBar from '@/components/layout/topbar';
import MainContent from '@/components/layout/main-content';
import type { MainContentTopTab } from '@/components/layout/main-content';
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

export type AppSection =
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
  | 'analyze'
  | 'runner'
  | 'alerts'
  | 'markets'
  | 'bxbt'
  | 'launcher';

export default function Home({
  initialSection = 'dashboard',
  initialDashboardTab = 'markets',
  initialPredictionBattleId = '',
}: {
  initialSection?: AppSection;
  initialDashboardTab?: MainContentTopTab;
  initialPredictionBattleId?: string;
}) {
  const [selectedToken, setSelectedToken] = useState('PEPEFUN');
  const [isMounted, setIsMounted] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>(initialSection);
  const [predictionBattleId] = useState(initialPredictionBattleId);
  const [activeTool, setActiveTool] = useState<BantahTool>('assistant');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const renderRightPanel = (className = 'hidden lg:flex') => (
    <div className={className}>
      <RightPanel
        selectedToken={selectedToken}
        onNavigate={setActiveSection}
      />
    </div>
  );

  const renderWithRightPanel = (content: ReactNode, rightPanelClassName = 'hidden lg:flex') => (
    <div className={`flex-1 flex gap-0.5 overflow-hidden p-0.5 ${activeSection === 'launcher' ? 'pb-0.5' : 'pb-20 md:pb-0.5'} flex-col md:flex-row`}>
      <div className="flex-1 min-w-0 flex overflow-hidden">
        {content}
      </div>
      {renderRightPanel(rightPanelClassName)}
    </div>
  );

  const renderPage = () => {
    switch (activeSection) {
      case 'feed':
        return renderWithRightPanel(<FeedPage />);
      case 'chat':
        return renderWithRightPanel(<ChatPage activeTool={activeTool} onToolChange={setActiveTool} />);
      case 'battles':
        return (
          <div className="flex-1 flex overflow-hidden p-0">
            <BattlesPage onNavigate={setActiveSection} />
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
        return renderWithRightPanel(
          <MainContent
            selectedToken={selectedToken}
            setSelectedToken={setSelectedToken}
            activeSection={activeSection}
            onNavigate={setActiveSection}
            initialTab={initialDashboardTab}
          />,
          activeSection === 'prediction' ? 'w-full md:w-auto' : 'hidden lg:flex'
        );
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar
          activeSection={activeSection}
          activeTool={activeTool}
          onNavigate={setActiveSection}
          onToolSelect={setActiveTool}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={activeSection === 'battles' ? 'hidden md:block' : 'block'}>
          <TopBar
            onNavigate={setActiveSection}
            activeSection={activeSection}
            activeTool={activeTool}
            onToolSelect={setActiveTool}
          />
        </div>
        {renderPage()}
      </div>

      {activeSection !== 'battles' && activeSection !== 'launcher' && <MobileBottomNav activeSection={activeSection} onNavigate={setActiveSection} />}
    </div>
  );
}
