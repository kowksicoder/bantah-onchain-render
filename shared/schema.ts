import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  decimal,
  primaryKey,
  unique,
  json,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  BANTAH_SKILL_VERSION,
  bantahAgentSpecialtyValues,
  bantahAgentStatusValues,
  bantahSkillActionValues,
  bantahAgentTypeValues,
  type BantahAgentSpecialty,
  type BantahAgentStatus,
  type BantahSkillAction,
  type BantahAgentType,
} from "./agentSkill";
import {
  bantahElizaRuntimeEngineValues,
  bantahElizaRuntimeStatusValues,
  type BantahElizaRuntimeConfig,
  type BantahElizaRuntimeEngine,
  type BantahElizaRuntimeStatus,
} from "./elizaAgent";
import {
  type AgentOrderStatus,
  type AgentPositionStatus,
  type AgentRiskProfile,
  type AgentStrategyType,
  type AgentTradingVisibility,
  type ProbabilityThresholdStrategyConfig,
} from "./agentTrading";

// Session storage table - Required for auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Core user table - Updated for email/password auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  username: varchar("username").unique(),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  points: integer("points").default(5),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  streak: integer("streak").default(0),
  status: varchar("status").default("active"), // active, banned, suspended, inactive
  isAdmin: boolean("is_admin").default(false),
  // Admin wallet system (for bonuses and payouts)
  adminWalletBalance: decimal("admin_wallet_balance", { precision: 15, scale: 2 }).default("0.00"),
  adminTotalCommission: decimal("admin_total_commission", { precision: 15, scale: 2 }).default("0.00"),
  adminTotalBonusesGiven: decimal("admin_total_bonuses_given", { precision: 15, scale: 2 }).default("0.00"),
  isTelegramUser: boolean("is_telegram_user").default(false),
  telegramId: varchar("telegram_id"),
  telegramUsername: varchar("telegram_username"),
  primaryWalletAddress: varchar("primary_wallet_address"),
  walletAddresses: jsonb("wallet_addresses").$type<string[]>().default(sql`'[]'::jsonb`),
  coins: integer("coins").default(0), // For Telegram users
  fcmToken: varchar("fcm_token"), // Firebase Cloud Messaging token
  // Treasury Shadow Persona flags
  isShadowPersona: boolean("is_shadow_persona").default(false), // True if this is a platform-managed Treasury bot
  isAdminGenerated: boolean("is_admin_generated").default(false), // True if this user was created by admin for testing
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agents = pgTable(
  "agents",
  {
    agentId: uuid("agent_id").defaultRandom().primaryKey().notNull(),
    ownerId: varchar("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentName: varchar("agent_name").notNull(),
    avatarUrl: varchar("avatar_url"),
    agentType: varchar("agent_type", { length: 32 }).$type<BantahAgentType>().notNull(),
    walletAddress: varchar("wallet_address").notNull().unique(),
    endpointUrl: varchar("endpoint_url", { length: 512 }).notNull().unique(),
    bantahSkillVersion: varchar("bantah_skill_version", { length: 24 })
      .notNull()
      .default(BANTAH_SKILL_VERSION),
    specialty: varchar("specialty", { length: 32 })
      .$type<BantahAgentSpecialty>()
      .notNull()
      .default("general"),
    status: varchar("status", { length: 32 })
      .$type<BantahAgentStatus>()
      .notNull()
      .default("active"),
    canTrade: boolean("can_trade").notNull().default(true),
    strategyType: varchar("strategy_type", { length: 48 })
      .$type<AgentStrategyType>()
      .notNull()
      .default("probability_threshold"),
    strategyConfig: jsonb("strategy_config").$type<ProbabilityThresholdStrategyConfig>(),
    riskProfile: jsonb("risk_profile").$type<AgentRiskProfile>(),
    visibility: varchar("visibility", { length: 24 })
      .$type<AgentTradingVisibility>()
      .notNull()
      .default("public"),
    maxPositionSize: decimal("max_position_size", { precision: 12, scale: 2 })
      .notNull()
      .default("25.00"),
    dailyTradeLimit: integer("daily_trade_limit").notNull().default(5),
    maxOpenPositions: integer("max_open_positions").notNull().default(3),
    skillActions: jsonb("skill_actions")
      .$type<BantahSkillAction[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    walletNetworkId: varchar("wallet_network_id", { length: 64 }),
    walletProvider: varchar("wallet_provider", { length: 64 }),
    ownerWalletAddress: varchar("owner_wallet_address"),
    walletData: jsonb("wallet_data"),
    runtimeEngine: varchar("runtime_engine", { length: 32 }).$type<BantahElizaRuntimeEngine>(),
    runtimeStatus: varchar("runtime_status", { length: 32 }).$type<BantahElizaRuntimeStatus>(),
    runtimeConfig: jsonb("runtime_config").$type<BantahElizaRuntimeConfig>(),
    points: integer("points").notNull().default(0),
    winCount: integer("win_count").notNull().default(0),
    lossCount: integer("loss_count").notNull().default(0),
    marketCount: integer("market_count").notNull().default(0),
    isTokenized: boolean("is_tokenized").notNull().default(false),
    lastSkillCheckAt: timestamp("last_skill_check_at"),
    lastSkillCheckScore: integer("last_skill_check_score"),
    lastSkillCheckStatus: varchar("last_skill_check_status", { length: 16 }).$type<
      "passed" | "failed"
    >(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_agents_owner_id").on(table.ownerId),
    typeIdx: index("idx_agents_agent_type").on(table.agentType),
    endpointIdx: index("idx_agents_endpoint_url").on(table.endpointUrl),
    statusIdx: index("idx_agents_status").on(table.status),
    specialtyIdx: index("idx_agents_specialty").on(table.specialty),
    pointsIdx: index("idx_agents_points").on(table.points),
    canTradeIdx: index("idx_agents_can_trade").on(table.canTrade),
  }),
);

export const agentFollows = pgTable(
  "agent_follows",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.agentId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_agent_follows_user_id").on(table.userId),
    agentIdx: index("idx_agent_follows_agent_id").on(table.agentId),
    uniqueFollow: unique("agent_follows_user_agent_unique").on(table.userId, table.agentId),
  }),
);

export const tokenLaunches = pgTable(
  "token_launches",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agents.agentId, { onDelete: "set null" }),
    chainId: integer("chain_id").notNull(),
    networkId: varchar("network_id", { length: 64 }).notNull(),
    factoryAddress: varchar("factory_address", { length: 64 }),
    tokenAddress: varchar("token_address", { length: 64 }),
    ownerAddress: varchar("owner_address", { length: 64 }).notNull(),
    tokenName: varchar("token_name", { length: 80 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 16 }).notNull(),
    decimals: integer("decimals").notNull().default(18),
    initialSupply: varchar("initial_supply", { length: 80 }).notNull(),
    initialSupplyAtomic: varchar("initial_supply_atomic", { length: 96 }).notNull(),
    deployTxHash: varchar("deploy_tx_hash", { length: 80 }),
    status: varchar("status", { length: 24 })
      .$type<"pending" | "deployed" | "failed">()
      .notNull()
      .default("pending"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_token_launches_user_id").on(table.userId),
    chainIdx: index("idx_token_launches_chain_id").on(table.chainId),
    tokenIdx: index("idx_token_launches_token_address").on(table.tokenAddress),
    statusIdx: index("idx_token_launches_status").on(table.status),
    createdIdx: index("idx_token_launches_created_at").on(table.createdAt),
  }),
);

export const bantahBroListedBattles = pgTable(
  "bantahbro_listed_battles",
  {
    id: varchar("id", { length: 255 }).primaryKey().notNull(),
    engineBattleId: varchar("engine_battle_id", { length: 255 }).notNull().unique(),
    status: varchar("status", { length: 24 })
      .$type<"listed">()
      .notNull()
      .default("listed"),
    source: varchar("source", { length: 24 })
      .$type<"engine" | "manual" | "sponsored">()
      .notNull()
      .default("engine"),
    listedBy: varchar("listed_by", { length: 255 }),
    battle: jsonb("battle")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    listedAt: timestamp("listed_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    engineBattleIdx: index("idx_bantahbro_listed_battles_engine_id").on(table.engineBattleId),
    listedAtIdx: index("idx_bantahbro_listed_battles_listed_at").on(table.listedAt),
    sourceIdx: index("idx_bantahbro_listed_battles_source").on(table.source),
  }),
);

export const predictionVisualizationPositions = pgTable(
  "prediction_visualization_positions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    battleId: varchar("battle_id", { length: 255 }).notNull(),
    sourcePlatform: varchar("source_platform", { length: 64 }).notNull(),
    sourceMarketId: varchar("source_market_id", { length: 255 }).notNull(),
    sourceMarketUrl: text("source_market_url").notNull(),
    marketTitle: text("market_title").notNull(),
    side: varchar("side", { length: 8 }).$type<"yes" | "no">().notNull(),
    outcome: varchar("outcome", { length: 8 }).$type<"YES" | "NO">().notNull(),
    factionName: varchar("faction_name", { length: 160 }).notNull(),
    sourceTokenId: text("source_token_id"),
    walletAddress: varchar("wallet_address", { length: 96 }),
    amountUsd: decimal("amount_usd", { precision: 12, scale: 2 }).notNull(),
    maxPrice: decimal("max_price", { precision: 8, scale: 4 }).notNull(),
    estimatedShares: decimal("estimated_shares", { precision: 18, scale: 6 }).notNull(),
    status: varchar("status", { length: 24 })
      .$type<"intent_saved" | "execution_checked" | "source_opened" | "submitted" | "filled" | "cancelled" | "failed">()
      .notNull()
      .default("intent_saved"),
    executionStatus: varchar("execution_status", { length: 32 })
      .$type<"read-only" | "external-action-ready" | "clob-planned">()
      .notNull()
      .default("clob-planned"),
    externalOrderId: varchar("external_order_id", { length: 255 }),
    externalStatus: varchar("external_status", { length: 64 }),
    lastError: text("last_error"),
    sourceOpenedAt: timestamp("source_opened_at"),
    fillSyncedAt: timestamp("fill_synced_at"),
    snapshot: jsonb("snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_prediction_visualization_positions_user_id").on(table.userId),
    battleIdx: index("idx_prediction_visualization_positions_battle_id").on(table.battleId),
    marketIdx: index("idx_prediction_visualization_positions_source_market_id").on(
      table.sourceMarketId,
    ),
    statusIdx: index("idx_prediction_visualization_positions_status").on(table.status),
    updatedIdx: index("idx_prediction_visualization_positions_updated_at").on(table.updatedAt),
    uniqueUserBattle: unique("prediction_visualization_positions_user_battle_unique").on(
      table.userId,
      table.battleId,
    ),
  }),
);

export const agentBattleP2PPositions = pgTable(
  "agent_battle_p2p_positions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    battleId: varchar("battle_id", { length: 255 }).notNull(),
    roundId: varchar("round_id", { length: 320 }).notNull(),
    roundStartsAt: timestamp("round_starts_at").notNull(),
    roundEndsAt: timestamp("round_ends_at").notNull(),
    sideId: text("side_id").notNull(),
    sideLabel: varchar("side_label", { length: 160 }).notNull(),
    sideSymbol: varchar("side_symbol", { length: 64 }),
    sideLogoUrl: text("side_logo_url"),
    opponentSideId: text("opponent_side_id"),
      stakeAmount: decimal("stake_amount", { precision: 18, scale: 6 }).notNull(),
      stakeCurrency: varchar("stake_currency", { length: 16 }).notNull().default("BXBT"),
      escrowChallengeId: integer("escrow_challenge_id"),
      escrowChainId: integer("escrow_chain_id"),
      escrowTokenSymbol: varchar("escrow_token_symbol", { length: 16 }),
      walletAddress: varchar("wallet_address", { length: 128 }),
    escrowStatus: varchar("escrow_status", { length: 32 })
      .$type<
        | "intent_saved"
        | "escrow_required"
        | "escrow_locked"
        | "settled"
        | "cancelled"
        | "failed"
      >()
      .notNull()
      .default("intent_saved"),
      escrowTxHash: varchar("escrow_tx_hash", { length: 80 }),
      winnerSideId: text("winner_side_id"),
      payoutAmount: decimal("payout_amount", { precision: 18, scale: 6 }),
      payoutTxHash: varchar("payout_tx_hash", { length: 80 }),
      snapshot: jsonb("snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_agent_battle_p2p_positions_user_id").on(table.userId),
    battleIdx: index("idx_agent_battle_p2p_positions_battle_id").on(table.battleId),
    roundIdx: index("idx_agent_battle_p2p_positions_round_id").on(table.roundId),
    escrowStatusIdx: index("idx_agent_battle_p2p_positions_escrow_status").on(
      table.escrowStatus,
    ),
    updatedIdx: index("idx_agent_battle_p2p_positions_updated_at").on(table.updatedAt),
    uniqueUserRound: unique("agent_battle_p2p_positions_user_round_unique").on(
      table.userId,
      table.roundId,
    ),
  }),
  );

export const agentBattleP2PRounds = pgTable(
  "agent_battle_p2p_rounds",
  {
    id: serial("id").primaryKey(),
    battleId: varchar("battle_id", { length: 255 }).notNull(),
    roundId: varchar("round_id", { length: 320 }).notNull().unique(),
    roundStartsAt: timestamp("round_starts_at").notNull(),
    roundEndsAt: timestamp("round_ends_at").notNull(),
    escrowChallengeId: integer("escrow_challenge_id").unique(),
    escrowChainId: integer("escrow_chain_id").notNull(),
    escrowTokenSymbol: varchar("escrow_token_symbol", { length: 16 }).notNull(),
    settlementStatus: varchar("settlement_status", { length: 32 }).notNull().default("open"),
    winnerSideId: text("winner_side_id"),
    settlementTxHashes: jsonb("settlement_tx_hashes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    settlementError: text("settlement_error"),
    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    battleIdx: index("idx_agent_battle_p2p_rounds_battle_id").on(table.battleId),
    roundIdx: index("idx_agent_battle_p2p_rounds_round_id").on(table.roundId),
    escrowChallengeIdx: index("idx_agent_battle_p2p_rounds_escrow_challenge_id").on(
      table.escrowChallengeId,
    ),
  }),
);

export const agentOrders = pgTable(
  "agent_orders",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.agentId, { onDelete: "cascade" }),
    marketId: varchar("market_id", { length: 128 }).notNull(),
    externalMarketId: varchar("external_market_id", { length: 128 }).notNull(),
    marketQuestion: text("market_question"),
    side: varchar("side", { length: 8 }).$type<"yes" | "no">().notNull(),
    action: varchar("action", { length: 16 }).notNull().default("buy"),
    intendedStakeUsd: decimal("intended_stake_usd", { precision: 12, scale: 2 }).notNull(),
    intendedPrice: decimal("intended_price", { precision: 8, scale: 4 }).notNull(),
    externalOrderId: varchar("external_order_id", { length: 255 }),
    status: varchar("status", { length: 32 }).$type<AgentOrderStatus>().notNull().default("pending"),
    failureReason: text("failure_reason"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    agentIdx: index("idx_agent_orders_agent_id").on(table.agentId),
    marketIdx: index("idx_agent_orders_market_id").on(table.marketId),
    externalMarketIdx: index("idx_agent_orders_external_market_id").on(table.externalMarketId),
    statusIdx: index("idx_agent_orders_status").on(table.status),
    createdIdx: index("idx_agent_orders_created_at").on(table.createdAt),
  }),
);

export const agentPositions = pgTable(
  "agent_positions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.agentId, { onDelete: "cascade" }),
    marketId: varchar("market_id", { length: 128 }).notNull(),
    externalMarketId: varchar("external_market_id", { length: 128 }).notNull(),
    marketQuestion: text("market_question"),
    side: varchar("side", { length: 8 }).$type<"yes" | "no">().notNull(),
    totalShares: decimal("total_shares", { precision: 18, scale: 6 }).notNull().default("0"),
    avgEntryPrice: decimal("avg_entry_price", { precision: 8, scale: 4 }).notNull().default("0"),
    currentMarkPrice: decimal("current_mark_price", { precision: 8, scale: 4 }),
    realizedPnl: decimal("realized_pnl", { precision: 14, scale: 4 }).notNull().default("0"),
    unrealizedPnl: decimal("unrealized_pnl", { precision: 14, scale: 4 }).notNull().default("0"),
    status: varchar("status", { length: 16 }).$type<AgentPositionStatus>().notNull().default("open"),
    openedAt: timestamp("opened_at").defaultNow(),
    closedAt: timestamp("closed_at"),
    lastSyncedAt: timestamp("last_synced_at"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    agentIdx: index("idx_agent_positions_agent_id").on(table.agentId),
    marketIdx: index("idx_agent_positions_market_id").on(table.marketId),
    externalMarketIdx: index("idx_agent_positions_external_market_id").on(table.externalMarketId),
    statusIdx: index("idx_agent_positions_status").on(table.status),
    updatedIdx: index("idx_agent_positions_updated_at").on(table.updatedAt),
  }),
);

export const decisionLogs = pgTable(
  "decision_logs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.agentId, { onDelete: "cascade" }),
    marketId: varchar("market_id", { length: 128 }).notNull(),
    externalMarketId: varchar("external_market_id", { length: 128 }).notNull(),
    marketQuestion: text("market_question"),
    strategyType: varchar("strategy_type", { length: 48 }).$type<AgentStrategyType>().notNull(),
    action: varchar("action", { length: 16 }).notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull().default("0"),
    intendedPrice: decimal("intended_price", { precision: 8, scale: 4 }),
    intendedStakeUsd: decimal("intended_stake_usd", { precision: 12, scale: 2 }),
    reason: text("reason").notNull(),
    riskAllowed: boolean("risk_allowed").notNull().default(false),
    riskReasons: jsonb("risk_reasons").notNull().default(sql`'[]'::jsonb`),
    linkedOrderId: uuid("linked_order_id").references(() => agentOrders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    agentIdx: index("idx_decision_logs_agent_id").on(table.agentId),
    marketIdx: index("idx_decision_logs_market_id").on(table.marketId),
    externalMarketIdx: index("idx_decision_logs_external_market_id").on(table.externalMarketId),
    createdIdx: index("idx_decision_logs_created_at").on(table.createdAt),
  }),
);

// Events for prediction betting
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // crypto, sports, gaming, music, politics
  status: varchar("status").default("active"), // active, completed, cancelled, pending_admin
  creatorId: varchar("creator_id").notNull(),
  eventPool: integer("event_pool").default(0), // Single unified pool in coins
  yesPool: integer("yes_pool").default(0), // For display purposes in coins
  noPool: integer("no_pool").default(0), // For display purposes in coins
  entryFee: integer("entry_fee").notNull(), // Changed to coins
  endDate: timestamp("end_date").notNull(),
  result: boolean("result"), // true for yes, false for no, null for pending
  adminResult: boolean("admin_result"), // Admin's final decision on event outcome
  creatorFee: integer("creator_fee").default(0), // 3% creator fee in coins
  isPrivate: boolean("is_private").default(false), // Private events need approval
  maxParticipants: integer("max_participants").default(100), // FCFS limit
  imageUrl: varchar("image_url"),
  chatEnabled: boolean("chat_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event participation tracking
export const eventParticipants = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  prediction: boolean("prediction").notNull(), // true for yes, false for no
  amount: integer("amount").notNull(), // Changed to coins
  status: varchar("status").default("active"), // active, matched, won, lost
  matchedWith: varchar("matched_with"), // User ID of opponent (for FCFS matching)
  payout: integer("payout").default(0), // Winner payout amount in coins
  joinedAt: timestamp("joined_at").defaultNow(),
  payoutAt: timestamp("payout_at"),
});

// Event pool betting amounts
export const eventPools = pgTable("event_pools", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  yesAmount: integer("yes_amount").default(0), // In coins
  noAmount: integer("no_amount").default(0), // In coins
  totalPool: integer("total_pool").default(0), // In coins
  creatorFeeCollected: boolean("creator_fee_collected").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event join requests for private events
export const eventJoinRequests = pgTable("event_join_requests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  prediction: boolean("prediction").notNull(), // true for yes, false for no
  amount: integer("amount").notNull(), // In coins
  status: varchar("status").default("pending"), // pending, approved, rejected
  requestedAt: timestamp("requested_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Real-time chat messages in events
export const eventMessages: any = pgTable("event_messages", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  replyToId: integer("reply_to_id").references((): any => eventMessages.id, { onDelete: "set null" }),
  mentions: json("mentions").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => eventMessages.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserMessageEmoji: unique().on(table.messageId, table.userId, table.emoji),
}));

// Live typing indicators
export const eventTyping = pgTable("event_typing", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  isTyping: boolean("is_typing").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Join/leave activity logs
export const eventActivity = pgTable("event_activity", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  action: varchar("action").notNull(), // joined, left, bet_placed
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// P2P betting matches between users
export const eventMatches = pgTable("event_matches", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  challenger: varchar("challenger").notNull(),
  challenged: varchar("challenged").notNull(),
  amount: integer("amount").notNull(), // In coins
  status: varchar("status").default("pending"), // pending, accepted, completed, cancelled
  result: varchar("result"), // challenger_won, challenged_won, draw
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Peer-to-peer challenges with escrow
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  challenger: varchar("challenger"),
  challenged: varchar("challenged"),
  challengedWalletAddress: varchar("challenged_wallet_address"),
  creatorType: varchar("creator_type", { length: 16 }).default("human"),
  challengerType: varchar("challenger_type", { length: 16 }).default("human"),
  challengedType: varchar("challenged_type", { length: 16 }).default("human"),
  creatorAgentId: uuid("creator_agent_id").references(() => agents.agentId, {
    onDelete: "set null",
  }),
  challengerAgentId: uuid("challenger_agent_id").references(() => agents.agentId, {
    onDelete: "set null",
  }),
  challengedAgentId: uuid("challenged_agent_id").references(() => agents.agentId, {
    onDelete: "set null",
  }),
  createdByAgent: boolean("created_by_agent").default(false),
  agentInvolved: boolean("agent_involved").default(false),
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  amount: integer("amount").notNull(), // Changed to coins
  challengerSide: varchar("challenger_side"), // "YES" or "NO" - P2P and Open challenge positions
  challengedSide: varchar("challenged_side"), // "YES" or "NO" - Opposite of challengerSide once accepted
  status: varchar("status").default("pending"), // pending, active, completed, disputed, cancelled, open
  evidence: jsonb("evidence"),
  settlementRail: varchar("settlement_rail").default("offchain"), // offchain, onchain
  chainId: integer("chain_id"),
  tokenSymbol: varchar("token_symbol"), // USDC, USDT, ETH
  tokenAddress: varchar("token_address"), // ERC20 contract address; null for native ETH
  stakeAtomic: varchar("stake_atomic"), // Amount in smallest token units
  decimals: integer("decimals"),
  escrowTxHash: varchar("escrow_tx_hash"),
  settleTxHash: varchar("settle_tx_hash"),
  result: varchar("result"), // challenger_won, challenged_won, draw
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  // Admin challenge fields
  adminCreated: boolean("admin_created").default(false),
  bonusSide: varchar("bonus_side"), // "YES", "NO", or null
  bonusMultiplier: decimal("bonus_multiplier", { precision: 3, scale: 2 }).default("1.00"),
  bonusAmount: integer("bonus_amount").default(0), // Custom bonus amount in naira
  bonusEndsAt: timestamp("bonus_ends_at"),
  yesStakeTotal: integer("yes_stake_total").default(0),
  noStakeTotal: integer("no_stake_total").default(0),
  coverImageUrl: varchar("cover_image_url"), // Cover art/image uploaded during challenge creation
  // Behavioral Bonus Configuration (Synced to DB)
  earlyBirdSlots: integer("early_bird_slots").default(0),
  earlyBirdBonus: integer("early_bird_bonus").default(0), // Fixed coin bonus
  streakBonusEnabled: boolean("streak_bonus_enabled").default(false),
  convictionBonusEnabled: boolean("conviction_bonus_enabled").default(false),
  firstTimeBonusEnabled: boolean("first_time_bonus_enabled").default(false),
  socialTagBonus: integer("social_tag_bonus").default(0), // Bonus for tagging friends
  isPinned: boolean("is_pinned").default(false), // Admin-only: pin challenge to top of feed
});

// Pairing queue for challenge matching (FCFS with stake tolerance)
export const pairQueue = pgTable("pair_queue", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  userId: varchar("user_id").notNull(),
  participantType: varchar("participant_type", { length: 16 }).default("human"),
  agentId: uuid("agent_id").references(() => agents.agentId, { onDelete: "set null" }),
  side: varchar("side").notNull(), // "YES" or "NO"
  stakeAmount: integer("stake_amount").notNull(), // In coins
  status: varchar("status").default("waiting"), // waiting, matched, cancelled
  matchedWith: varchar("matched_with"), // User ID of matched opponent
  isTreasuryMatch: boolean("is_treasury_match").default(false), // True if this match is Treasury-funded
  treasuryFunded: boolean("treasury_funded").default(false), // True if Treasury allocated funds
  createdAt: timestamp("created_at").defaultNow(),
  matchedAt: timestamp("matched_at"),
});

// Shadow personas library - Pre-populated with Nigerian usernames for Treasury matches
export const shadowPersonas = pgTable("shadow_personas", {
  id: serial("id").primaryKey(),
  username: varchar("username").notNull().unique(), // e.g., "Odogwu_Bets", "Sharp_Guy_99"
  avatarIndex: integer("avatar_index").default(0), // Index into avatar library array
  category: varchar("category").notNull(), // big_stepper, street_smart, fanatic, casual
  usedInChallengeIds: text("used_in_challenge_ids").array().default([]), // Track challenges where this persona was used
  isActive: boolean("is_active").default(true), // Can be disabled if needed
  createdAt: timestamp("created_at").defaultNow(),
});

// Treasury-funded matches tracking and auditing
export const treasuryMatches = pgTable("treasury_matches", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  shadowPersonaId: integer("shadow_persona_id").notNull(), // Reference to shadow_personas table
  shadowPersonaUserId: varchar("shadow_persona_user_id").notNull(), // User ID of the created shadow persona
  realUserId: varchar("real_user_id").notNull(), // The actual user matched
  realUserSide: varchar("real_user_side").notNull(), // "YES" or "NO" - which side the real user took
  treasuryStaked: integer("treasury_staked").notNull(), // Amount of coins Treasury allocated
  status: varchar("status").default("active"), // active, settled, refunded, cancelled
  result: varchar("result"), // treasury_won, treasury_lost, null if pending
  treasuryPayout: integer("treasury_payout").default(0), // Amount Treasury received/lost
  createdAt: timestamp("created_at").defaultNow(),
  settledAt: timestamp("settled_at"),
});

// Per-challenge Treasury configuration (admin's manual decisions)
export const treasuryChallenges = pgTable("treasury_challenges", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().unique(), // One config per challenge
  maxTreasuryRisk: integer("max_treasury_risk").notNull(), // Max coins admin will risk on this challenge
  totalTreasuryAllocated: integer("total_treasury_allocated").default(0), // Running total spent
  filledSide: varchar("filled_side"), // "YES" or "NO" - which side was filled with Treasury
  filledCount: integer("filled_count").default(0), // How many Treasury matches were created
  status: varchar("status").default("pending"), // pending, active, completed
  adminNotes: text("admin_notes"), // Notes from admin about why they set this limit
  createdAt: timestamp("created_at").defaultNow(),
  filledAt: timestamp("filled_at"),
});

// Treasury wallet per admin - separate from admin wallet
export const treasuryWallets = pgTable("treasury_wallets", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").notNull().unique(), // One wallet per admin
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00"), // Funds available for Treasury
  totalDeposited: decimal("total_deposited", { precision: 15, scale: 2 }).default("0.00"),
  totalUsed: decimal("total_used", { precision: 15, scale: 2 }).default("0.00"),
  totalEarned: decimal("total_earned", { precision: 15, scale: 2 }).default("0.00"), // From wins
  status: varchar("status").default("active"), // active, frozen
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treasury wallet transaction history
export const treasuryWalletTransactions = pgTable("treasury_wallet_transactions", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").notNull(),
  type: varchar("type").notNull(), // deposit, debit, credit, settlement
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  relatedMatchId: integer("related_match_id"), // treasuryMatches.id if settlement
  relatedChallengeId: integer("related_challenge_id"), // challenges.id
  reference: varchar("reference"), // Paystack ref, settlement ref
  status: varchar("status").default("completed"), // pending, completed, failed
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Telegram groups where the bot is added
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 64 }).unique().notNull(),
  title: varchar("title", { length: 255 }),
  type: varchar("type", { length: 50 }),
  addedBy: varchar("added_by", { length: 64 }),
  addedAt: timestamp("added_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Group members tracked when they interact with the bot
export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  telegramId: varchar("telegram_id", { length: 64 }).notNull(),
  username: varchar("username", { length: 100 }),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
});

// Real-time chat in challenges
export const challengeMessages = pgTable("challenge_messages", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Track participants who join challenges
export const challengeParticipants = pgTable("challenge_participants", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  userId: varchar("user_id").notNull(),
  side: varchar("side").notNull(), // "YES" or "NO"
  amount: integer("amount").notNull(), // stake in coins
  payoutAmount: integer("payout_amount").default(0),
  status: varchar("status").default("active"), // active, settled, refunded
  joinedAt: timestamp("joined_at").defaultNow(),
  payoutAt: timestamp("payout_at"),
});

// Secure fund holding for challenges
export const escrow = pgTable("escrow", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  amount: integer("amount").notNull(), // In coins
  status: varchar("status").default("holding"), // holding, released, refunded
  createdAt: timestamp("created_at").defaultNow(),
  releasedAt: timestamp("released_at"),
});

// Friend connections and requests
export const friends = pgTable("friends", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id").notNull(),
  addresseeId: varchar("addressee_id").notNull(),
  status: varchar("status").default("pending"), // pending, accepted, blocked
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

// Achievement definitions
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  icon: varchar("icon"),
  category: varchar("category"),
  xpReward: integer("xp_reward").default(0),
  pointsReward: integer("points_reward").default(0),
  requirement: jsonb("requirement"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User achievement unlocks
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  achievementId: integer("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// System notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(), // FOMO notification types
  title: text("title").notNull(),
  message: text("message"),
  icon: varchar("icon"), // emoji icon
  data: jsonb("data"),
  channels: text("channels").array(), // in_app_feed, push_notification, telegram_bot
  fomoLevel: varchar("fomo_level").default('low'), // low, medium, high, urgent
  priority: integer("priority").default(1), // 1=low, 2=medium, 3=high, 4=urgent
  read: boolean("read").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User notification preferences
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  enablePush: boolean("enable_push").default(true),
  enableTelegram: boolean("enable_telegram").default(false),
  enableInApp: boolean("enable_in_app").default(true),
  notificationFrequency: varchar("notification_frequency").default("immediate"), // immediate, batched, digest
  mutedChallenges: text("muted_challenges").array().default([]),
  mutedUsers: text("muted_users").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// All financial transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(), // deposit, withdrawal, bet, win, challenge, referral
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  relatedId: integer("related_id"), // eventId, challengeId, etc.
  status: varchar("status").default("completed"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin wallet transactions (for bonuses, payouts, commissions)
export const adminWalletTransactions = pgTable("admin_wallet_transactions", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").notNull(),
  type: varchar("type").notNull(), // fund_load, bonus_sent, commission_earned, withdrawal
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  relatedId: integer("related_id"), // challengeId, eventId, transactionId
  relatedType: varchar("related_type"), // challenge, event, commission
  reference: varchar("reference"), // Paystack ref, withdrawal ref, etc.
  status: varchar("status").default("completed"), // pending, completed, failed
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily login streaks and rewards
export const dailyLogins = pgTable("daily_logins", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").notNull(),
  streak: integer("streak").default(1),
  pointsEarned: integer("points_earned").default(50),
  claimed: boolean("claimed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral system with rewards
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").notNull(),
  referredId: varchar("referred_id").notNull(),
  code: varchar("code").notNull(),
  status: varchar("status").default("active"), // active, completed, expired
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin stories/status updates
export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url"),
  backgroundColor: varchar("background_color").default("#6366f1"),
  textColor: varchar("text_color").default("#ffffff"),
  duration: integer("duration").default(15), // seconds
  viewCount: integer("view_count").default(0),
  category: varchar("category").default("general"), // announcement, update, tip, celebration, general
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Story views tracking
export const storyViews = pgTable("story_views", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull(),
  userId: varchar("user_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

// Referral reward tracking
export const referralRewards = pgTable("referral_rewards", {
  id: serial("id").primaryKey(),
  referralId: integer("referral_id").notNull(),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(), // signup_bonus, activity_bonus
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI recommendation preferences and user settings
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  eventCategories: jsonb("event_categories"), // preferred categories
  riskLevel: varchar("risk_level").default("medium"), // low, medium, high
  notifications: jsonb("notifications"), // notification preferences
  privacy: jsonb("privacy"), // privacy settings
  appearance: jsonb("appearance"), // theme, compact view, language
  performance: jsonb("performance"), // auto refresh, sound effects, data usage
  regional: jsonb("regional"), // currency, timezone, locale
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User behavior tracking for AI
export const userInteractions = pgTable("user_interactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(), // view, click, bet, share
  entityType: varchar("entity_type").notNull(), // event, challenge, user
  entityId: varchar("entity_id").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  events: many(events, { relationName: "creator" }),
  ownedAgents: many(agents),
  followedAgents: many(agentFollows),
  eventParticipants: many(eventParticipants),
  eventMessages: many(eventMessages),
  challengesCreated: many(challenges, { relationName: "challenger" }),
  challengesReceived: many(challenges, { relationName: "challenged" }),
  friendRequestsSent: many(friends, { relationName: "requester" }),
  friendRequestsReceived: many(friends, { relationName: "addressee" }),
  achievements: many(userAchievements),
  notifications: many(notifications),
  transactions: many(transactions),
  dailyLogins: many(dailyLogins),
  referralsMade: many(referrals, { relationName: "referrer" }),
  referredBy: one(referrals, {
    fields: [users.referredBy],
    references: [referrals.referrerId],
    relationName: "referred"
  }),
  preferences: one(userPreferences),
  interactions: many(userInteractions),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(users, {
    fields: [agents.ownerId],
    references: [users.id],
  }),
  followers: many(agentFollows),
}));

export const agentFollowsRelations = relations(agentFollows, ({ one }) => ({
  user: one(users, {
    fields: [agentFollows.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [agentFollows.agentId],
    references: [agents.agentId],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
    relationName: "creator"
  }),
  participants: many(eventParticipants),
  messages: many(eventMessages),
  pools: many(eventPools),
  activity: many(eventActivity),
  matches: many(eventMatches),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  challengerUser: one(users, {
    fields: [challenges.challenger],
    references: [users.id],
    relationName: "challenger"
  }),
  challengedUser: one(users, {
    fields: [challenges.challenged],
    references: [users.id],
    relationName: "challenged"
  }),
  messages: many(challengeMessages),
  escrow: one(escrow),
  treasuryMatches: many(treasuryMatches),
}));

// Shadow personas relations
export const shadowPersonasRelations = relations(shadowPersonas, ({ many }) => ({
  treasuryMatches: many(treasuryMatches),
}));

// Treasury matches relations
export const treasuryMatchesRelations = relations(treasuryMatches, ({ one }) => ({
  challenge: one(challenges, {
    fields: [treasuryMatches.challengeId],
    references: [challenges.id],
  }),
  shadowPersona: one(shadowPersonas, {
    fields: [treasuryMatches.shadowPersonaId],
    references: [shadowPersonas.id],
  }),
  shadowPersonaUser: one(users, {
    fields: [treasuryMatches.shadowPersonaUserId],
    references: [users.id],
  }),
  realUser: one(users, {
    fields: [treasuryMatches.realUserId],
    references: [users.id],
  }),
}));

// Treasury challenges relations
export const treasuryChallengesRelations = relations(treasuryChallenges, ({ one }) => ({
  challenge: one(challenges, {
    fields: [treasuryChallenges.challengeId],
    references: [challenges.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    username: z.string().min(3, "Username must be at least 3 characters").optional(),
  });

export const insertAgentSchema = createInsertSchema(agents)
  .omit({
    agentId: true,
    createdAt: true,
    updatedAt: true,
    walletData: true,
    points: true,
    winCount: true,
    lossCount: true,
    marketCount: true,
  })
  .extend({
    agentName: z.string().min(2, "Agent name must be at least 2 characters").max(80),
    agentType: z.enum(bantahAgentTypeValues),
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Wallet address must be a valid EVM address"),
    endpointUrl: z
      .string()
      .url("Endpoint URL must be a valid URL")
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
        message: "Endpoint URL must use http or https",
      }),
    bantahSkillVersion: z.string().min(1).max(24).default(BANTAH_SKILL_VERSION),
    specialty: z.enum(bantahAgentSpecialtyValues),
    status: z.enum(bantahAgentStatusValues).optional(),
    skillActions: z.array(z.enum(bantahSkillActionValues)).optional(),
    walletNetworkId: z.string().min(1).max(64).optional(),
    walletProvider: z.string().min(1).max(64).optional(),
    ownerWalletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Owner wallet address must be a valid EVM address")
      .optional(),
    runtimeEngine: z.enum(bantahElizaRuntimeEngineValues).optional(),
    runtimeStatus: z.enum(bantahElizaRuntimeStatusValues).optional(),
  });

export const insertTokenLaunchSchema = createInsertSchema(tokenLaunches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Auth specific schemas
export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, "Please enter your email or username"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  referralCode: z.string().optional(),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertEventJoinRequestSchema = createInsertSchema(eventJoinRequests).omit({
  id: true,
  requestedAt: true,
  respondedAt: true,
});

// Treasury-related insert schemas
export const insertShadowPersonaSchema = createInsertSchema(shadowPersonas).omit({
  id: true,
  createdAt: true,
});

export const insertTreasuryMatchSchema = createInsertSchema(treasuryMatches).omit({
  id: true,
  createdAt: true,
  settledAt: true,
});

export const insertTreasuryChallengeSchema = createInsertSchema(treasuryChallenges).omit({
  id: true,
  createdAt: true,
  filledAt: true,
});

export const insertTreasuryWalletSchema = createInsertSchema(treasuryWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreasuryWalletTransactionSchema = createInsertSchema(treasuryWalletTransactions).omit({
  id: true,
  createdAt: true,
});

// Platform settings table
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  maintenanceMode: boolean("maintenance_mode").default(false),
  registrationEnabled: boolean("registration_enabled").default(true),
  minBetAmount: decimal("min_bet_amount", { precision: 10, scale: 2 }).default("100.00"),
  maxBetAmount: decimal("max_bet_amount", { precision: 10, scale: 2 }).default("100000.00"),
  platformFeePercentage: decimal("platform_fee_percentage", { precision: 3, scale: 1 }).default("5.0"),
  creatorFeePercentage: decimal("creator_fee_percentage", { precision: 3, scale: 1 }).default("3.0"),
  withdrawalEnabled: boolean("withdrawal_enabled").default(true),
  depositEnabled: boolean("deposit_enabled").default(true),
  maxWithdrawalDaily: decimal("max_withdrawal_daily", { precision: 10, scale: 2 }).default("50000.00"),
  maxDepositDaily: decimal("max_deposit_daily", { precision: 10, scale: 2 }).default("100000.00"),
  challengeCooldown: integer("challenge_cooldown").default(300), // seconds
  eventCreationEnabled: boolean("event_creation_enabled").default(true),
  chatEnabled: boolean("chat_enabled").default(true),
  maxChatLength: integer("max_chat_length").default(500),
  autoModeration: boolean("auto_moderation").default(true),
  welcomeMessage: text("welcome_message").default("Welcome to Bantah! Start creating events and challenges."),
  supportEmail: varchar("support_email").default("support@bantah.fun"),
  termsUrl: varchar("terms_url").default("/terms"),
  privacyUrl: varchar("privacy_url").default("/privacy"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Push subscriptions table for web push notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

// User recommendation profiles for personalized event suggestions  
export const userRecommendationProfiles = pgTable("user_recommendation_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  favoriteCategories: json("favorite_categories"), // ['crypto', 'sports', 'gaming']
  averageBetAmount: integer("average_bet_amount").default(0), // In coins
  preferredBetRange: json("preferred_bet_range"), // {min: 50, max: 500}
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0.00"), // Percentage
  totalEventsJoined: integer("total_events_joined").default(0),
  totalEventsWon: integer("total_events_won").default(0),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100
  preferredEventTypes: json("preferred_event_types"), // ['prediction', 'poll', 'challenge']
  timePreferences: json("time_preferences"), // Activity patterns
  socialInteractions: integer("social_interactions").default(0), // Chat messages, reactions count
  riskProfile: varchar("risk_profile", { length: 50 }).default("moderate"), // conservative, moderate, aggressive
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event recommendations for users
export const eventRecommendations = pgTable("event_recommendations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  eventId: integer("event_id").notNull(),
  recommendationScore: decimal("recommendation_score", { precision: 5, scale: 2 }).notNull(), // 0-100
  recommendationReason: varchar("recommendation_reason", { length: 255 }).notNull(), // category_match, amount_match, creator_history, etc
  matchFactors: json("match_factors"),
  isViewed: boolean("is_viewed").default(false),
  isInteracted: boolean("is_interacted").default(false), // Clicked, joined, or shared
  viewedAt: timestamp("viewed_at"),
  interactedAt: timestamp("interacted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User interaction tracking for recommendation learning
export const userEventInteractions = pgTable("user_event_interactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  eventId: integer("event_id").notNull(),
  interactionType: varchar("interaction_type", { length: 50 }).notNull(), // view, like, share, join, comment, skip
  interactionValue: integer("interaction_value").default(1), // Weight of interaction (1-10)
  sessionId: varchar("session_id", { length: 255 }), // Track interaction sessions
  deviceType: varchar("device_type", { length: 50 }), // mobile, desktop, tablet
  referralSource: varchar("referral_source", { length: 100 }), // recommendation, search, trending, friend
  timeSpent: integer("time_spent").default(0), // Seconds spent viewing
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserRecommendationProfileSchema = createInsertSchema(userRecommendationProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventRecommendationSchema = createInsertSchema(eventRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertUserEventInteractionSchema = createInsertSchema(userEventInteractions).omit({
  id: true,
  createdAt: true,
});

// Push subscriptions relations
export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// Recommendation relations
export const userRecommendationProfilesRelations = relations(userRecommendationProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userRecommendationProfiles.userId],
    references: [users.id],
  }),
}));

export const eventRecommendationsRelations = relations(eventRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [eventRecommendations.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [eventRecommendations.eventId],
    references: [events.id],
  }),
}));

export const userEventInteractionsRelations = relations(userEventInteractions, ({ one }) => ({
  user: one(users, {
    fields: [userEventInteractions.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [userEventInteractions.eventId],
    references: [events.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type AgentFollow = typeof agentFollows.$inferSelect;
export type TokenLaunch = typeof tokenLaunches.$inferSelect;
export type AgentOrderRecord = typeof agentOrders.$inferSelect;
export type AgentPositionRecord = typeof agentPositions.$inferSelect;
export type DecisionLogRecord = typeof decisionLogs.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type InsertTokenLaunch = z.infer<typeof insertTokenLaunchSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type Friend = typeof friends.$inferSelect;
export type EventParticipant = typeof eventParticipants.$inferSelect;
export type EventMessage = typeof eventMessages.$inferSelect;
export type ChallengeMessage = typeof challengeMessages.$inferSelect;
export type EventJoinRequest = typeof eventJoinRequests.$inferSelect;
export type UserRecommendationProfile = typeof userRecommendationProfiles.$inferSelect;
export type EventRecommendation = typeof eventRecommendations.$inferSelect;
export type UserEventInteraction = typeof userEventInteractions.$inferSelect;
export type InsertUserRecommendationProfile = z.infer<typeof insertUserRecommendationProfileSchema>;
export type TreasuryWallet = typeof treasuryWallets.$inferSelect;
export type InsertTreasuryWallet = z.infer<typeof insertTreasuryWalletSchema>;
export type TreasuryWalletTransaction = typeof treasuryWalletTransactions.$inferSelect;
export type InsertTreasuryWalletTransaction = z.infer<typeof insertTreasuryWalletTransactionSchema>;

// Payout job queue for batched processing
export const payoutJobs = pgTable("payout_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: integer("challenge_id").notNull(),
  totalWinners: integer("total_winners").notNull(),
  processedWinners: integer("processed_winners").default(0),
  totalPool: bigint("total_pool", { mode: "number" }).notNull(),
  platformFee: bigint("platform_fee", { mode: "number" }).notNull(),
  status: varchar("status").default("queued"), // queued, running, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
});

// Individual payout entries for batched processing
export const payoutEntries = pgTable("payout_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => payoutJobs.id),
  userId: varchar("user_id").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: varchar("status").default("pending"), // pending, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type PayoutJob = typeof payoutJobs.$inferSelect;
export type InsertPayoutJob = typeof payoutJobs.$inferInsert;
export type PayoutEntry = typeof payoutEntries.$inferSelect;
export type InsertPayoutEntry = typeof payoutEntries.$inferInsert;

export type InsertEventRecommendation = z.infer<typeof insertEventRecommendationSchema>;
export type InsertUserEventInteraction = z.infer<typeof insertUserEventInteractionSchema>;
export type InsertEventJoinRequest = typeof eventJoinRequests.$inferInsert;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = typeof messageReactions.$inferInsert;
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

// Treasury and Shadow Persona types
export type ShadowPersona = typeof shadowPersonas.$inferSelect;
export type InsertShadowPersona = z.infer<typeof insertShadowPersonaSchema>;
export type TreasuryMatch = typeof treasuryMatches.$inferSelect;
export type InsertTreasuryMatch = z.infer<typeof insertTreasuryMatchSchema>;
export type TreasuryChallenge = typeof treasuryChallenges.$inferSelect;
export type InsertTreasuryChallenge = z.infer<typeof insertTreasuryChallengeSchema>;

// User preferences insert schema
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  updatedAt: true,
});
