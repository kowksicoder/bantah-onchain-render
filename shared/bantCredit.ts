export const BANTCREDIT_CHALLENGE_CREATION_BASE_RATE = 1;
export const BANTCREDIT_DAILY_CHECKIN_REWARD = 5;
export const BANTCREDIT_AGENT_WIN_REWARD = 50;
export const BANTCREDIT_REFERRAL_SHARE_RATE = 0.1;
export const BANTCREDIT_REFERRAL_SHARE_PERCENT = 10;
export const BANTCREDIT_SIGNUP_REWARD = 5;
export const BANTCREDIT_REFERRED_REWARD = 30;
export const BANTCREDIT_REFERRER_REWARD = 100;

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
