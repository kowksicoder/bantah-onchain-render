export const BANTCREDIT_CHALLENGE_CREATION_BASE_RATE = 1;
export const BANTCREDIT_DAILY_CHECKIN_REWARD = 5;
export const BANTCREDIT_AGENT_WIN_REWARD = 50;
export const BANTCREDIT_REFERRAL_SHARE_RATE = 0.1;
export const BANTCREDIT_REFERRAL_SHARE_PERCENT = 10;
export const BANTCREDIT_SIGNUP_REWARD = 5;
export const BANTCREDIT_REFERRED_REWARD = 30;
export const BANTCREDIT_REFERRER_REWARD = 100;
export const BANTCREDIT_BATTLE_WATCH_TRANSACTION_TYPE = "battle_watch_reward";

export const BANTCREDIT_BATTLE_WATCH_REWARD_TIERS = [
  { minSeconds: 120, totalPoints: 40, label: "Full battle focus" },
  { minSeconds: 60, totalPoints: 15, label: "One-minute watch" },
  { minSeconds: 30, totalPoints: 5, label: "First watch" },
] as const;

export const BANTCREDIT_BATTLE_WATCH_ACTIVE_RATIO = 0.75;

export const BANTCREDIT_ACTIVITY_MULTIPLIER_TIERS = [
  { minActions: 100, multiplier: 1.5 },
  { minActions: 50, multiplier: 1.35 },
  { minActions: 10, multiplier: 1.2 },
  { minActions: 0, multiplier: 1.0 },
] as const;

export const BANTCREDIT_ACTIVITY_EXCLUDED_TRANSACTION_TYPES = [
  "signup_bonus",
  "referral_bonus",
  "referral_reward",
  "daily_signin",
  "admin_points",
  "admin_fund",
  "challenge_creation_reward",
  BANTCREDIT_BATTLE_WATCH_TRANSACTION_TYPE,
  "referral_share_reward",
] as const;

export type BantCreditChallengeRewardResult = {
  awarded: boolean;
  pointsAwarded: number;
  marketSize: number;
  activityCount: number;
  activityMultiplier: number;
  baseRate: number;
};

export type BantCreditBattleWatchTier =
  (typeof BANTCREDIT_BATTLE_WATCH_REWARD_TIERS)[number];

export type BantCreditBattleWatchRewardResult = {
  eligible: boolean;
  awarded: boolean;
  pointsAwarded: number;
  totalEligiblePoints: number;
  previousPointsAwarded: number;
  watchedSeconds: number;
  activeSeconds: number;
  requiredActiveSeconds: number;
  tier: BantCreditBattleWatchTier | null;
  reason: "eligible" | "minimum_watch_time" | "inactive_watch_time" | "already_awarded";
};

export function resolveBantCreditActivityMultiplier(actionCount: number): number {
  const normalizedCount = Math.max(0, Math.floor(Number.isFinite(actionCount) ? actionCount : 0));
  const matchedTier = BANTCREDIT_ACTIVITY_MULTIPLIER_TIERS.find(
    (tier) => normalizedCount >= tier.minActions,
  );
  return matchedTier?.multiplier ?? 1.0;
}

export function calculateChallengeCreationBantCredit(params: {
  marketSize: number;
  activityCount: number;
  baseRate?: number;
}): BantCreditChallengeRewardResult {
  const marketSize = Math.max(0, Number.isFinite(params.marketSize) ? params.marketSize : 0);
  const activityCount = Math.max(
    0,
    Math.floor(Number.isFinite(params.activityCount) ? params.activityCount : 0),
  );
  const baseRate = Number.isFinite(params.baseRate ?? BANTCREDIT_CHALLENGE_CREATION_BASE_RATE)
    ? Number(params.baseRate ?? BANTCREDIT_CHALLENGE_CREATION_BASE_RATE)
    : BANTCREDIT_CHALLENGE_CREATION_BASE_RATE;
  const activityMultiplier = resolveBantCreditActivityMultiplier(activityCount);
  const pointsAwarded = Math.max(0, Math.round(marketSize * baseRate * activityMultiplier));

  return {
    awarded: pointsAwarded > 0,
    pointsAwarded,
    marketSize,
    activityCount,
    activityMultiplier,
    baseRate,
  };
}

export function resolveBattleWatchRewardTier(watchedSeconds: number) {
  const normalizedSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(watchedSeconds) ? watchedSeconds : 0),
  );
  return (
    BANTCREDIT_BATTLE_WATCH_REWARD_TIERS.find(
      (tier) => normalizedSeconds >= tier.minSeconds,
    ) ?? null
  );
}

export function getNextBattleWatchRewardTier(watchedSeconds: number) {
  const normalizedSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(watchedSeconds) ? watchedSeconds : 0),
  );

  return (
    [...BANTCREDIT_BATTLE_WATCH_REWARD_TIERS]
      .reverse()
      .find((tier) => normalizedSeconds < tier.minSeconds) ?? null
  );
}

export function calculateBattleWatchBantCredit(params: {
  watchedSeconds: number;
  activeSeconds: number;
  previousPointsAwarded?: number;
}): BantCreditBattleWatchRewardResult {
  const watchedSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(params.watchedSeconds) ? params.watchedSeconds : 0),
  );
  const activeSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(params.activeSeconds) ? params.activeSeconds : 0),
  );
  const previousPointsAwarded = Math.max(
    0,
    Math.round(
      Number.isFinite(params.previousPointsAwarded ?? 0)
        ? Number(params.previousPointsAwarded ?? 0)
        : 0,
    ),
  );
  const tier = resolveBattleWatchRewardTier(watchedSeconds);

  if (!tier) {
    return {
      eligible: false,
      awarded: false,
      pointsAwarded: 0,
      totalEligiblePoints: 0,
      previousPointsAwarded,
      watchedSeconds,
      activeSeconds,
      requiredActiveSeconds: Math.ceil(
        BANTCREDIT_BATTLE_WATCH_REWARD_TIERS[
          BANTCREDIT_BATTLE_WATCH_REWARD_TIERS.length - 1
        ].minSeconds * BANTCREDIT_BATTLE_WATCH_ACTIVE_RATIO,
      ),
      tier: null,
      reason: "minimum_watch_time",
    };
  }

  const requiredActiveSeconds = Math.ceil(
    tier.minSeconds * BANTCREDIT_BATTLE_WATCH_ACTIVE_RATIO,
  );

  if (activeSeconds < requiredActiveSeconds) {
    return {
      eligible: false,
      awarded: false,
      pointsAwarded: 0,
      totalEligiblePoints: tier.totalPoints,
      previousPointsAwarded,
      watchedSeconds,
      activeSeconds,
      requiredActiveSeconds,
      tier,
      reason: "inactive_watch_time",
    };
  }

  const pointsAwarded = Math.max(0, tier.totalPoints - previousPointsAwarded);

  return {
    eligible: true,
    awarded: pointsAwarded > 0,
    pointsAwarded,
    totalEligiblePoints: tier.totalPoints,
    previousPointsAwarded,
    watchedSeconds,
    activeSeconds,
    requiredActiveSeconds,
    tier,
    reason: pointsAwarded > 0 ? "eligible" : "already_awarded",
  };
}
