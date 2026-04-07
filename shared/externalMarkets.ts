export type ExternalMarketSource = "polymarket";

export type ExternalMarketStatus = "open" | "closed" | "resolved" | "inactive";

export type ExternalMarket = {
  source: ExternalMarketSource;
  id: string;
  polymarketMarketId: string;
  clobTokenIds?: string[];
  yesTokenId?: string | null;
  noTokenId?: string | null;
  slug?: string;
  question: string;
  description?: string;
  outcomes: string[];
  prices: number[];
  yesPrice: number;
  noPrice: number;
  liquidity: number;
  volume: number;
  active: boolean;
  closed: boolean;
  status: ExternalMarketStatus;
  endDate: string | null;
  category?: string;
  tags?: string[];
  image?: string;
  icon?: string;
  marketUrl?: string;
  sourceUrl?: string;
  resolutionSource?: string;
  orderPriceMinTickSize?: number | null;
  negRisk?: boolean | null;
  isTradable: boolean;
  lastSyncedAt: string;
};

export function getExternalMarketSidePrice(
  market: Pick<ExternalMarket, "yesPrice" | "noPrice">,
  side: "yes" | "no",
): number {
  return side === "yes" ? market.yesPrice : market.noPrice;
}
