import type { ExternalMarket } from "@shared/externalMarkets";

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((entry) => String(entry));
    } catch {
      return [];
    }
  }
  return [];
};

const parseNumberArray = (value: unknown): number[] => {
  if (Array.isArray(value)) return value.map((entry) => Number(entry) || 0);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((entry) => Number(entry) || 0);
    } catch {
      return [];
    }
  }
  return [];
};

const pickFirstValidImage = (candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  }
  return undefined;
};

export const normalizePolymarketMarket = (market: any): ExternalMarket => {
  const outcomes = parseStringArray(market?.outcomes);
  const prices = parseNumberArray(market?.outcomePrices);
  const normalizedPrices = outcomes.length
    ? outcomes.map((_, index) => Number(prices[index] || 0))
    : prices;
  const id = String(
    market?.id || market?.conditionId || market?.condition_id || market?.slug || `market_${Date.now()}`,
  );
  const slug = market?.slug ? String(market.slug) : undefined;
  const question =
    market?.question ||
    market?.title ||
    (slug ? slug.replace(/-/g, " ") : "Unknown Question");
  const image = pickFirstValidImage([
    market?.image,
    market?.icon,
    market?.events?.[0]?.image,
    market?.events?.[0]?.icon,
  ]);
  const icon = pickFirstValidImage([
    market?.icon,
    market?.image,
    market?.events?.[0]?.icon,
    market?.events?.[0]?.image,
  ]);

  return {
    source: "polymarket",
    id,
    slug,
    question,
    description: market?.description || "",
    outcomes: outcomes.length ? outcomes : ["Yes", "No"],
    prices: normalizedPrices.length ? normalizedPrices : [0, 0],
    volume: Number(market?.volumeNum ?? market?.volume ?? 0),
    active: Boolean(market?.active ?? market?.is_active ?? false),
    closed: Boolean(market?.closed ?? market?.is_closed ?? false),
    endDate:
      market?.endDate ||
      market?.end_date_iso ||
      market?.endDateIso ||
      market?.end_date ||
      null,
    category: market?.groupItemTitle || market?.events?.[0]?.title || market?.category || "Polymarket",
    image,
    icon,
    sourceUrl: slug
      ? `https://polymarket.com/market/${slug}`
      : `https://polymarket.com/market/${id}`,
    resolutionSource: market?.resolutionSource || market?.resolution_source || "",
  };
};

export const normalizePolymarketMarkets = (markets: unknown[]): ExternalMarket[] => {
  if (!Array.isArray(markets)) return [];
  return markets.map((market) => normalizePolymarketMarket(market));
};
