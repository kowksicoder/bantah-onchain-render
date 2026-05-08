export type AgentBattleSide = {
  id: string;
  label: string;
  agentName: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  emoji: string;
  logoUrl: string | null;
  chainId: string | null;
  chainLabel: string | null;
  tokenAddress: string | null;
  pairAddress: string | null;
  pairUrl: string | null;
  dexId: string | null;
  priceUsd: number | null;
  priceDisplay: string;
  priceChangeM5: number;
  priceChangeH1: number;
  priceChangeH24: number;
  change: string;
  direction: 'up' | 'down' | 'flat';
  volumeM5: number;
  volumeH1: number;
  volumeH24: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  buysM5: number;
  sellsM5: number;
  buysH1: number;
  sellsH1: number;
  buysH24: number;
  sellsH24: number;
  pairAgeMinutes: number | null;
  dataSource: 'dexscreener' | 'polymarket';
  dataUpdatedAt: string;
  score: number;
  confidence: number;
  status: 'attacking' | 'defending' | 'staggered' | 'holding';
};

export type AgentBattleEvent = {
  id: string;
  time: string;
  type: 'momentum' | 'volume' | 'liquidity' | 'system';
  severity: 'info' | 'hot' | 'danger';
  sideId: string | null;
  agentName: string;
  message: string;
  metricLabel: string | null;
  metricValue: string | null;
};

export type AgentBattle = {
  id: string;
  title: string;
  battleType: 'agent-battle';
  status: 'live';
  winnerLogic: string;
  startsAt: string;
  endsAt: string;
  timeRemainingSeconds: number;
  spectators: number;
  sides: [AgentBattleSide, AgentBattleSide];
  leadingSideId: string;
  confidenceSpread: number;
  events: AgentBattleEvent[];
  updatedAt: string;
};

export type AgentBattleFeed = {
  battles: AgentBattle[];
  updatedAt: string;
  sources: {
    marketData: 'dexscreener' | 'polymarket';
    note: string;
  };
};
