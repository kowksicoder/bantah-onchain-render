export type ExternalMarketSource = "polymarket";

export type ExternalMarket = {
  source: ExternalMarketSource;
  id: string;
  slug?: string;
  question: string;
  description?: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  category?: string;
  image?: string;
  icon?: string;
  sourceUrl?: string;
  resolutionSource?: string;
};
