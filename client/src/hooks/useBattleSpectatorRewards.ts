import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BANTCREDIT_BATTLE_WATCH_REWARD_TIERS,
  type BantCreditBattleWatchTier,
} from '@shared/bantCredit';
import { apiRequest } from '@/lib/queryClient';
import type {
  BattleArenaStatus,
  BattleExperienceMode,
} from '@/components/bantahbro/FightingGameArenaEmbed';

type BattleWatchRewardResponse = {
  awarded: boolean;
  eligible: boolean;
  pointsAwarded: number;
  earnedForBattle: number;
  watchedSeconds: number;
  activeSeconds: number;
  tier: BantCreditBattleWatchTier | null;
  nextTier: BantCreditBattleWatchTier | null;
  reason: string;
};

type BattleSpectatorRewardsInput = {
  battleId?: string | null;
  enabled: boolean;
  isAuthenticated: boolean;
  battleMode: BattleExperienceMode;
  battleStatus: BattleArenaStatus;
  onAward?: (points: number) => void;
};

export type BattleSpectatorRewardHudState = {
  enabled: boolean;
  isAuthenticated: boolean;
  watchedSeconds: number;
  activeSeconds: number;
  earnedForBattle: number;
  lastAwardedPoints: number;
  isAwarding: boolean;
  nextTier: BantCreditBattleWatchTier | null;
  interactionCount: number;
};

function getNextTierForEarnedPoints(earnedForBattle: number) {
  const earned = Math.max(0, Math.round(earnedForBattle || 0));
  return (
    [...BANTCREDIT_BATTLE_WATCH_REWARD_TIERS]
      .reverse()
      .find((tier) => tier.totalPoints > earned) ?? null
  );
}

function isPageVisible() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

export function useBattleSpectatorRewards({
  battleId,
  enabled,
  isAuthenticated,
  battleMode,
  battleStatus,
  onAward,
}: BattleSpectatorRewardsInput): BattleSpectatorRewardHudState {
  const canTrack = Boolean(enabled && battleId && battleMode === 'arena' && battleStatus === 'live');
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [earnedForBattle, setEarnedForBattle] = useState(0);
  const [lastAwardedPoints, setLastAwardedPoints] = useState(0);
  const [isAwarding, setIsAwarding] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const completedTierSecondsRef = useRef<Set<number>>(new Set());
  const claimingTierSecondsRef = useRef<number | null>(null);
  const interactionCountRef = useRef(0);

  useEffect(() => {
    setWatchedSeconds(0);
    setActiveSeconds(0);
    setEarnedForBattle(0);
    setLastAwardedPoints(0);
    setIsAwarding(false);
    setInteractionCount(0);
    completedTierSecondsRef.current = new Set();
    claimingTierSecondsRef.current = null;
    interactionCountRef.current = 0;
  }, [battleId, battleMode, battleStatus, enabled]);

  useEffect(() => {
    if (!canTrack) return undefined;

    const intervalId = window.setInterval(() => {
      if (!isPageVisible()) return;

      setWatchedSeconds((current) => current + 1);
      setActiveSeconds((current) => current + 1);
      setInteractionCount(interactionCountRef.current);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [canTrack]);

  useEffect(() => {
    if (!canTrack) return undefined;

    const recordInteraction = () => {
      interactionCountRef.current += 1;
      setInteractionCount(interactionCountRef.current);
    };

    window.addEventListener('pointerdown', recordInteraction);
    window.addEventListener('keydown', recordInteraction);
    window.addEventListener('wheel', recordInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', recordInteraction);
      window.removeEventListener('keydown', recordInteraction);
      window.removeEventListener('wheel', recordInteraction);
    };
  }, [canTrack]);

  useEffect(() => {
    if (!canTrack || !battleId || !isAuthenticated || isAwarding) return;

    const eligibleTier = BANTCREDIT_BATTLE_WATCH_REWARD_TIERS.find(
      (tier) =>
        watchedSeconds >= tier.minSeconds &&
        !completedTierSecondsRef.current.has(tier.minSeconds),
    );
    if (!eligibleTier || claimingTierSecondsRef.current === eligibleTier.minSeconds) return;

    claimingTierSecondsRef.current = eligibleTier.minSeconds;
    setIsAwarding(true);

    apiRequest('POST', `/api/bantahbro/agent-battles/${encodeURIComponent(battleId)}/watch-reward`, {
      battleMode,
      battleStatus,
      watchedSeconds,
      activeSeconds,
      interactionCount: interactionCountRef.current,
    })
      .then((response: BattleWatchRewardResponse) => {
        if (response.tier) {
          completedTierSecondsRef.current.add(response.tier.minSeconds);
        }
        setEarnedForBattle(Math.max(0, Math.round(response.earnedForBattle || 0)));
        setLastAwardedPoints(Math.max(0, Math.round(response.pointsAwarded || 0)));

        if (response.awarded && response.pointsAwarded > 0) {
          onAward?.(response.pointsAwarded);
        }
      })
      .catch((error) => {
        console.error('Battle watch reward failed:', error);
      })
      .finally(() => {
        claimingTierSecondsRef.current = null;
        setIsAwarding(false);
      });
  }, [
    activeSeconds,
    battleId,
    battleMode,
    battleStatus,
    canTrack,
    interactionCount,
    isAuthenticated,
    isAwarding,
    onAward,
    watchedSeconds,
  ]);

  const nextTier = useMemo(
    () => getNextTierForEarnedPoints(earnedForBattle),
    [earnedForBattle],
  );

  return {
    enabled: canTrack,
    isAuthenticated,
    watchedSeconds,
    activeSeconds,
    earnedForBattle,
    lastAwardedPoints,
    isAwarding,
    nextTier,
    interactionCount,
  };
}
