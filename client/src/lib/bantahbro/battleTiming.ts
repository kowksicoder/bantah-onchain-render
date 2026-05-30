import { useEffect, useMemo, useState } from 'react';

const DEFAULT_BATTLE_DURATION_SECONDS = 5 * 60;

function parseTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getBattleDurationSeconds(
  startsAt?: string | null,
  endsAt?: string | null,
  fallbackSeconds = DEFAULT_BATTLE_DURATION_SECONDS,
) {
  const startsAtMs = parseTimestamp(startsAt);
  const endsAtMs = parseTimestamp(endsAt);
  if (startsAtMs !== null && endsAtMs !== null && endsAtMs > startsAtMs) {
    return Math.max(1, Math.round((endsAtMs - startsAtMs) / 1000));
  }
  return Math.max(1, Math.round(fallbackSeconds || DEFAULT_BATTLE_DURATION_SECONDS));
}

export function getBattleTimeRemainingSeconds(
  endsAt?: string | null,
  fallbackSeconds = DEFAULT_BATTLE_DURATION_SECONDS,
  nowMs = Date.now(),
) {
  const endsAtMs = parseTimestamp(endsAt);
  if (endsAtMs === null) {
    return Math.max(0, Math.round(fallbackSeconds || 0));
  }
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

export function formatBattleWindowLabel(durationSeconds: number) {
  const safeSeconds = Math.max(1, Math.round(durationSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  if (hours <= 0) {
    return `${Math.max(1, Math.round(safeSeconds / 60))} min`;
  }

  if (minutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function useBattleClock(input: {
  startsAt?: string | null;
  endsAt?: string | null;
  fallbackSeconds?: number;
}) {
  const { startsAt, endsAt, fallbackSeconds = DEFAULT_BATTLE_DURATION_SECONDS } = input;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const durationSeconds = useMemo(
    () => getBattleDurationSeconds(startsAt, endsAt, fallbackSeconds),
    [startsAt, endsAt, fallbackSeconds],
  );
  const timeRemainingSeconds = useMemo(
    () => getBattleTimeRemainingSeconds(endsAt, fallbackSeconds, nowMs),
    [endsAt, fallbackSeconds, nowMs],
  );

  return {
    durationSeconds,
    timeRemainingSeconds,
    isExpired: timeRemainingSeconds <= 0,
    durationLabel: formatBattleWindowLabel(durationSeconds),
  };
}
