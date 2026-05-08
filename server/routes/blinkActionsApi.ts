import { Router, type Express, type Request, type Response } from "express";
import {
  getLiveBantahBroAgentBattles,
  type BantahBroAgentBattle,
  type BantahBroAgentBattleSide,
} from "../bantahBro/agentBattleService";
import {
  getLivePredictionVisualizationBattles,
} from "../bantahBro/predictionVisualizationService";
import type {
  PredictionVisualizationBattle,
  PredictionVisualizationSide,
} from "@shared/predictionVisualization";
import { BLINK_ACTION_HEADERS } from "../blinkActionHeaders";

const DEFAULT_BATTLE_ID = "current";

type BlinkActionType = "transaction" | "message" | "external-link";

type BlinkLinkedAction = {
  type: BlinkActionType;
  label: string;
  href: string;
  parameters?: Array<{
    name: string;
    label: string;
    type?: "text" | "textarea" | "number";
    required?: boolean;
  }>;
};

type BlinkGetResponse = {
  type: "action";
  icon: string;
  title: string;
  description: string;
  label: string;
  links?: {
    actions: BlinkLinkedAction[];
  };
};

type BlinkMessageResponse = {
  type: "message";
  message: string;
  links?: {
    next?: {
      type: "post";
      href: string;
    };
  };
};

type BlinkPostRequest = {
  account?: unknown;
};

function withBlinkHeaders(res: Response) {
  res.set(BLINK_ACTION_HEADERS);
  return res;
}

function getPublicBaseUrl(req: Request) {
  const configured = String(
    process.env.PUBLIC_APP_URL ||
      process.env.VITE_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "",
  ).trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

function actionUrl(req: Request, path: string) {
  return new URL(path, `${getPublicBaseUrl(req)}/`).toString();
}

function siteBattleUrl(req: Request, battleId: string) {
  const url = new URL("/bantahbro/", `${getPublicBaseUrl(req)}/`);
  url.searchParams.set("section", "battles");
  if (battleId && battleId !== DEFAULT_BATTLE_ID) {
    url.searchParams.set("battle", battleId);
  }
  return url.toString();
}

function sitePredictionBattleUrl(req: Request, battleId: string) {
  const normalizedBattleId = battleId && battleId !== DEFAULT_BATTLE_ID ? battleId : "";
  if (normalizedBattleId) {
    return new URL(`/bantahbro/polymarket/${encodeURIComponent(normalizedBattleId)}`, `${getPublicBaseUrl(req)}/`).toString();
  }
  return new URL("/bantahbro/polymarket", `${getPublicBaseUrl(req)}/`).toString();
}

function formatToken(side: BantahBroAgentBattleSide) {
  const symbol = side.tokenSymbol || side.label.replace(/^\$/, "") || "TOKEN";
  return symbol.replace(/^\$/, "");
}

function formatMarketCap(side: BantahBroAgentBattleSide) {
  const value = typeof side.marketCap === "number" && Number.isFinite(side.marketCap) ? side.marketCap : null;
  if (!value || value <= 0) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function shortenAccount(account: string) {
  if (account.length <= 12) return account;
  return `${account.slice(0, 4)}...${account.slice(-4)}`;
}

function sideByKey(battle: BantahBroAgentBattle, sideKey: string) {
  if (sideKey === "right" || sideKey === "1") return battle.sides[1];
  return battle.sides[0];
}

function parseAmount(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 1_000_000);
}

function formatUsd(value: number | null | undefined) {
  const resolved = typeof value === "number" && Number.isFinite(value) ? value : 0;
  if (resolved <= 0) return "n/a";
  if (resolved >= 1_000_000_000) return `$${(resolved / 1_000_000_000).toFixed(2)}B`;
  if (resolved >= 1_000_000) return `$${(resolved / 1_000_000).toFixed(2)}M`;
  if (resolved >= 1_000) return `$${(resolved / 1_000).toFixed(1)}K`;
  return `$${resolved.toFixed(2)}`;
}

async function resolveBattle(battleId: string) {
  const feed = await getLiveBantahBroAgentBattles(5);
  const battles = feed.battles || [];
  if (!battles.length) {
    const error = new Error("No live BantahBro agent battles are available from live market data right now.");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  if (!battleId || battleId === DEFAULT_BATTLE_ID || battleId === "latest") {
    return battles[0];
  }

  const battle = battles.find((item) => item.id === battleId);
  if (!battle) {
    const error = new Error("Battle not found. Try the current BantahBro battle Blink.");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  return battle;
}

async function resolvePredictionBattle(battleId: string) {
  const feed = await getLivePredictionVisualizationBattles(12);
  const battles = feed.battles || [];
  if (!battles.length) {
    const error = new Error("No live Polymarket BTC 5-minute battles are available right now.");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  if (!battleId || battleId === DEFAULT_BATTLE_ID || battleId === "latest") {
    return battles[0];
  }

  const battle = battles.find((item) => item.id === battleId);
  if (!battle) {
    const error = new Error("Polymarket BTC 5-minute battle not found. Try the current BantahBro Polymarket Blink.");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  return battle;
}

function buildBattleBlink(req: Request, battle: BantahBroAgentBattle): BlinkGetResponse {
  const left = battle.sides[0];
  const right = battle.sides[1];
  const leftSymbol = formatToken(left);
  const rightSymbol = formatToken(right);
  const leftMarketCap = formatMarketCap(left);
  const rightMarketCap = formatMarketCap(right);
  const mcLine = leftMarketCap || rightMarketCap ? ` MC ${leftMarketCap || "n/a"} vs ${rightMarketCap || "n/a"}.` : "";

  return {
    type: "action",
    icon: actionUrl(req, "/bantahbrologo.png"),
    title: `${leftSymbol} VS ${rightSymbol}`,
    description:
      `Live BantahBro Agent Battle. ${leftSymbol} confidence ${left.confidence}% vs ${rightSymbol} ${right.confidence}%.` +
      `${mcLine} Winner rule: ${battle.winnerLogic}`,
    label: "Open Battle",
    links: {
      actions: [
        {
          type: "message",
          label: `Join ${leftSymbol} Army`,
          href: `/api/actions/bantahbro/battle/${encodeURIComponent(battle.id)}/join?side=left&amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "BXBT amount",
              type: "number",
              required: true,
            },
          ],
        },
        {
          type: "message",
          label: `Join ${rightSymbol} Army`,
          href: `/api/actions/bantahbro/battle/${encodeURIComponent(battle.id)}/join?side=right&amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "BXBT amount",
              type: "number",
              required: true,
            },
          ],
        },
        {
          type: "external-link",
          label: "Watch Live",
          href: siteBattleUrl(req, battle.id),
        },
      ],
    },
  };
}

function predictionSideByKey(battle: PredictionVisualizationBattle, sideKey: string) {
  if (sideKey === "no" || sideKey === "right" || sideKey === "1") return battle.sides[1];
  return battle.sides[0];
}

function buildPredictionBlink(req: Request, battle: PredictionVisualizationBattle): BlinkGetResponse {
  const yes = battle.sides[0];
  const no = battle.sides[1];
  const timer =
    typeof battle.timeRemainingSeconds === "number"
      ? `${Math.max(0, Math.floor(battle.timeRemainingSeconds / 60))}:${String(
          Math.max(0, battle.timeRemainingSeconds % 60),
        ).padStart(2, "0")}`
      : "live";

  return {
    type: "action",
    icon: actionUrl(req, "/bantahbrologo.png"),
    title: `BTC 5M: ${yes.outcome} VS ${no.outcome}`,
    description:
      `${battle.marketTitle}. YES ${yes.priceDisplay} (${yes.confidence}%) vs NO ${no.priceDisplay} (${no.confidence}%). ` +
      `Ends in ${timer}. Volume ${formatUsd(battle.volume)}. Liquidity and settlement stay on Polymarket.`,
    label: "Open BTC 5M Battle",
    links: {
      actions: [
        {
          type: "message",
          label: `YES ${yes.priceDisplay}`,
          href: `/api/actions/bantahbro/polymarket/${encodeURIComponent(battle.id)}/join?side=yes&amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "USD amount",
              type: "number",
              required: true,
            },
          ],
        },
        {
          type: "message",
          label: `NO ${no.priceDisplay}`,
          href: `/api/actions/bantahbro/polymarket/${encodeURIComponent(battle.id)}/join?side=no&amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "USD amount",
              type: "number",
              required: true,
            },
          ],
        },
        {
          type: "external-link",
          label: "Watch Arena",
          href: sitePredictionBattleUrl(req, battle.id),
        },
        {
          type: "external-link",
          label: "Open Polymarket",
          href: battle.sourceMarketUrl,
        },
      ],
    },
  };
}

function buildPredictionIntentMessage(params: {
  account: string;
  battle: PredictionVisualizationBattle;
  selectedSide: PredictionVisualizationSide;
  amount: number;
}): BlinkMessageResponse {
  const { account, battle, selectedSide, amount } = params;
  const side = selectedSide.outcome.toLowerCase();

  return {
    type: "message",
    message:
      `BantahBro BTC 5M intent received for ${shortenAccount(account)}: ` +
      `$${amount.toLocaleString("en-US")} on ${selectedSide.outcome} at ${selectedSide.priceDisplay}. ` +
      "Phase 1 opens the source market; direct Polymarket CLOB signing comes later.",
    links: {
      next: {
        type: "post",
        href: `/api/actions/bantahbro/polymarket/${encodeURIComponent(battle.id)}/complete?side=${encodeURIComponent(
          side,
        )}&amount=${encodeURIComponent(String(amount))}`,
      },
    },
  };
}

function sendBlinkError(res: Response, error: unknown) {
  const status =
    typeof error === "object" && error && typeof (error as { status?: unknown }).status === "number"
      ? Number((error as { status: number }).status)
      : 500;
  const message = error instanceof Error ? error.message : "Blink action failed";
  return withBlinkHeaders(res).status(status).json({ error: message });
}

const router = Router();

router.options("*", (_req, res) => {
  withBlinkHeaders(res).status(204).send();
});

router.get("/battle/:battleId", async (req, res) => {
  try {
    const battle = await resolveBattle(String(req.params.battleId || DEFAULT_BATTLE_ID));
    return withBlinkHeaders(res).json(buildBattleBlink(req, battle));
  } catch (error) {
    return sendBlinkError(res, error);
  }
});

router.post("/battle/:battleId/join", async (req, res) => {
  try {
    const battle = await resolveBattle(String(req.params.battleId || DEFAULT_BATTLE_ID));
    const request = (req.body || {}) as BlinkPostRequest;
    const account = typeof request.account === "string" ? request.account.trim() : "";
    if (!account) {
      return withBlinkHeaders(res).status(400).json({ error: "Wallet account is required." });
    }

    const selectedSide = sideByKey(battle, String(req.query.side || "left"));
    const symbol = formatToken(selectedSide);
    const amount = parseAmount(req.query.amount);
    const payload: BlinkMessageResponse = {
      type: "message",
      message:
        `BantahBro battle intent received for ${shortenAccount(account)}: ` +
        `${amount.toLocaleString("en-US")} BXBT on ${symbol} Army. ` +
        "This Phase 1 Blink records intent only. Real escrow staking will be enabled when the battle contract/API is connected.",
      links: {
        next: {
          type: "post",
          href: `/api/actions/bantahbro/battle/${encodeURIComponent(battle.id)}/complete?side=${encodeURIComponent(
            symbol,
          )}&amount=${encodeURIComponent(String(amount))}`,
        },
      },
    };

    return withBlinkHeaders(res).json(payload);
  } catch (error) {
    return sendBlinkError(res, error);
  }
});

router.post("/battle/:battleId/complete", async (req, res) => {
  try {
    const battle = await resolveBattle(String(req.params.battleId || DEFAULT_BATTLE_ID));
    const side = String(req.query.side || "selected");
    const amount = parseAmount(req.query.amount);
    const payload: BlinkGetResponse = {
      type: "action",
      icon: actionUrl(req, "/bantahbrologo.png"),
      title: "Battle Ticket Prepared",
      description:
        `${amount.toLocaleString("en-US")} BXBT intent for ${side} Army is ready. ` +
        "Open BantahBro to watch the arena and finalize once escrow staking is live.",
      label: "Done",
      links: {
        actions: [
          {
            type: "external-link",
            label: "Open BantahBro",
            href: siteBattleUrl(req, battle.id),
          },
        ],
      },
    };
    return withBlinkHeaders(res).json(payload);
  } catch (error) {
    return sendBlinkError(res, error);
  }
});

router.get("/polymarket/:battleId", async (req, res) => {
  try {
    const battle = await resolvePredictionBattle(String(req.params.battleId || DEFAULT_BATTLE_ID));
    return withBlinkHeaders(res).json(buildPredictionBlink(req, battle));
  } catch (error) {
    return sendBlinkError(res, error);
  }
});

router.post("/polymarket/:battleId/join", async (req, res) => {
  try {
    const battle = await resolvePredictionBattle(String(req.params.battleId || DEFAULT_BATTLE_ID));
    const request = (req.body || {}) as BlinkPostRequest;
    const account = typeof request.account === "string" ? request.account.trim() : "";
    if (!account) {
      return withBlinkHeaders(res).status(400).json({ error: "Wallet account is required." });
    }

    const selectedSide = predictionSideByKey(battle, String(req.query.side || "yes"));
    const amount = parseAmount(req.query.amount);
    return withBlinkHeaders(res).json(buildPredictionIntentMessage({ account, battle, selectedSide, amount }));
  } catch (error) {
    return sendBlinkError(res, error);
  }
});

router.post("/polymarket/:battleId/complete", async (req, res) => {
  try {
    const battle = await resolvePredictionBattle(String(req.params.battleId || DEFAULT_BATTLE_ID));
    const selectedSide = predictionSideByKey(battle, String(req.query.side || "yes"));
    const amount = parseAmount(req.query.amount);
    const payload: BlinkGetResponse = {
      type: "action",
      icon: actionUrl(req, "/bantahbrologo.png"),
      title: "BTC 5M Ticket Prepared",
      description:
        `$${amount.toLocaleString("en-US")} ${selectedSide.outcome} intent is ready for ${battle.marketTitle}. ` +
        "Open the arena or source market to continue.",
      label: "Done",
      links: {
        actions: [
          {
            type: "external-link",
            label: "Open BantahBro Arena",
            href: sitePredictionBattleUrl(req, battle.id),
          },
          {
            type: "external-link",
            label: "Open Polymarket",
            href: battle.sourceMarketUrl,
          },
        ],
      },
    };
    return withBlinkHeaders(res).json(payload);
  } catch (error) {
    return sendBlinkError(res, error);
  }
});

export function registerBlinkActionRoutes(app: Express) {
  app.options("/actions.json", (_req, res) => {
    withBlinkHeaders(res).status(204).send();
  });

  app.get("/actions.json", (_req, res) => {
    withBlinkHeaders(res).json({
      rules: [
        {
          pathPattern: "/api/actions/bantahbro/battle/**",
          apiPath: "/api/actions/bantahbro/battle/**",
        },
        {
          pathPattern: "/api/actions/bantahbro/polymarket/**",
          apiPath: "/api/actions/bantahbro/polymarket/**",
        },
        {
          pathPattern: "/bantahbro/polymarket/**",
          apiPath: "/api/actions/bantahbro/polymarket/current",
        },
        {
          pathPattern: "/bantahbro/**",
          apiPath: "/api/actions/bantahbro/battle/current",
        },
      ],
    });
  });

  app.use("/api/actions/bantahbro", router);
}
