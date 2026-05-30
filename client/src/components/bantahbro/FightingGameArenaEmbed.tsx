import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BattleSpectatorRewardHudState } from '@/hooks/useBattleSpectatorRewards';
import { getBattleTimeRemainingSeconds } from '@/lib/bantahbro/battleTiming';
import { arenaAgentAvatar } from '@/lib/arenaAgentAvatars';
import {
  deriveArenaGuiCue,
  mapBattleToArenaGuiState,
  type ArenaGuiCue,
  type ArenaGuiState,
} from '@/lib/bantahbro/arenaGuiMapper';
import type { AgentBattle } from '@/types/agentBattle';

export type BattleArenaStatus = 'live' | 'queued' | 'cancelled' | 'rematch';
export type BattleExperienceMode = 'arena' | 'challenge';

type FightingGameArenaEmbedProps = {
  compact?: boolean;
  flush?: boolean;
  battleMode?: BattleExperienceMode;
  battleStatus?: BattleArenaStatus;
  startsAtMs?: number | null;
  matchupLabel?: string;
  arenaLabel?: string;
  watchReward?: BattleSpectatorRewardHudState;
  battle?: AgentBattle | null;
};

type FightingGameEngine = {
  start: () => Promise<void>;
  applyArenaPayload: (payload: {
    type: 'bantahbro:arena-state';
    state: ArenaGuiState;
    cue: ArenaGuiCue | null;
    generatedAt: string;
  }) => void;
  destroy?: () => void;
};

type FightingGameEngineConstructor = new (options: {
  canvas: HTMLCanvasElement;
  timerElement: HTMLElement;
  dialogElement: HTMLElement;
  rootElement: HTMLElement;
  stagePath: string;
  fighterPaths: string[];
  autonomous: boolean;
  arenaSeed?: string;
  assetBasePath: string;
}) => FightingGameEngine;

declare global {
  interface Window {
    GameEngine?: FightingGameEngineConstructor;
    gameEngine?: FightingGameEngine | null;
  }
}

const FIGHTING_GAME_ASSET_VERSION = 'engine-20260530-03';
const FIGHTING_GAME_SCRIPT_PATHS = [
  'js/classes.js',
  'engine/AssetLoader.js',
  'engine/InputManager.js',
  'engine/CollisionSystem.js',
  'engine/MoveResolver.js',
  'engine/RoundManager.js',
  'engine/GameEngine.js',
] as const;

let fightingGameRuntimePromise: Promise<void> | null = null;

function ensureFightingGameStyles() {
  const href = `/2dgame/index.css?v=${FIGHTING_GAME_ASSET_VERSION}`;
  const existing = document.getElementById('bantah-fighting-game-styles') as HTMLLinkElement | null;
  if (existing) {
    if (!existing.href.endsWith(href)) existing.href = href;
    return;
  }

  const link = document.createElement('link');
  link.id = 'bantah-fighting-game-styles';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadFightingGameScript(path: string) {
  const id = `bantah-fighting-game-${path.replace(/[^a-z0-9]/gi, '-')}`;
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === 'true') return Promise.resolve();
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Unable to load ${path}`)), {
        once: true,
      });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = `/2dgame/${path}?v=${FIGHTING_GAME_ASSET_VERSION}`;
    script.async = false;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Unable to load ${path}`));
    document.body.appendChild(script);
  });
}

function loadFightingGameRuntime() {
  if (!fightingGameRuntimePromise) {
    fightingGameRuntimePromise = (async () => {
      ensureFightingGameStyles();
      if (!window.GameEngine) {
        for (const path of FIGHTING_GAME_SCRIPT_PATHS) {
          await loadFightingGameScript(path);
        }
      }
      if (!window.GameEngine) {
        throw new Error('Fighting game engine did not initialize');
      }
    })();
  }

  return fightingGameRuntimePromise;
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getOverlayCopy(status: BattleArenaStatus) {
  switch (status) {
    case 'queued':
      return {
        eyebrow: 'Queued Battle',
        title: 'Battle begins in',
        detail: 'Fighters are warming up. Arena preview is open.',
        tone: 'border-sky-300/50 bg-sky-500/15 text-sky-100',
      };
    case 'cancelled':
      return {
        eyebrow: 'Cancelled',
        title: 'Battle cancelled',
        detail: 'This matchup was pulled from the queue.',
        tone: 'border-rose-300/50 bg-rose-500/15 text-rose-100',
      };
    case 'rematch':
      return {
        eyebrow: 'Rematch',
        title: 'Rematch pending',
        detail: 'Waiting for both fighters to accept the runback.',
        tone: 'border-amber-300/50 bg-amber-500/15 text-amber-100',
      };
    default:
      return {
        eyebrow: 'Live',
        title: 'Battle live',
        detail: 'The match is underway.',
        tone: 'border-emerald-300/50 bg-emerald-500/15 text-emerald-100',
      };
  }
}

function formatWatchTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function FightingGameArenaEmbed({
  compact = false,
  flush = false,
  battleMode = 'arena',
  battleStatus = 'live',
  startsAtMs = null,
  matchupLabel = 'BOTA Agent Alpha VS BOTA Agent Beta',
  arenaLabel = 'BOTA Arena',
  watchReward,
  battle = null,
}: FightingGameArenaEmbedProps) {
  const [now, setNow] = useState(() => Date.now());
  const [arenaLoadError, setArenaLoadError] = useState<string | null>(null);
  const arenaRootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<FightingGameEngine | null>(null);
  const previousBattleRef = useRef<AgentBattle | null>(null);
  const latestArenaPayloadRef = useRef<{
    state: ArenaGuiState;
    cue: ArenaGuiCue | null;
  } | null>(null);
  const showOverlay = battleStatus !== 'live';
  const overlayCopy = getOverlayCopy(battleStatus);
  const remainingSeconds = startsAtMs ? Math.max(0, (startsAtMs - now) / 1000) : 0;
  const syncedBattle = useMemo(() => {
    if (!battle) return null;
    const timeRemainingSeconds = getBattleTimeRemainingSeconds(
      battle.endsAt,
      battle.timeRemainingSeconds,
      now,
    );

    return {
      ...battle,
      status: timeRemainingSeconds > 0 ? 'live' : 'expired',
      timeRemainingSeconds,
    } satisfies AgentBattle;
  }, [battle, now]);
  const arenaState = useMemo(
    () => (syncedBattle ? mapBattleToArenaGuiState(syncedBattle) : null),
    [syncedBattle],
  );
  const [fallbackLeftName, fallbackRightName] = matchupLabel.split(/\s+vs\s+/i);
  const leftSide = arenaState?.left;
  const rightSide = arenaState?.right;
  const leftName = leftSide?.agentName || fallbackLeftName || 'BOTA Agent Alpha';
  const rightName = rightSide?.agentName || fallbackRightName || 'BOTA Agent Beta';
  const leftTeam = leftSide?.label || leftSide?.chainLabel || 'BOTA ARENA';
  const rightTeam = rightSide?.label || rightSide?.chainLabel || 'BOTA ARENA';
  const leftAvatar = leftSide?.avatarUrl || arenaAgentAvatar(leftName);
  const rightAvatar = rightSide?.avatarUrl || arenaAgentAvatar(rightName);
  const arenaSeed = syncedBattle?.id || arenaLabel || matchupLabel;

  const applyArenaPayload = useCallback(
    (payload: { state: ArenaGuiState; cue: ArenaGuiCue | null } | null) => {
      if (!payload || !engineRef.current) return;
      engineRef.current.applyArenaPayload({
        type: 'bantahbro:arena-state',
        state: payload.state,
        cue: payload.cue,
        generatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let localEngine: FightingGameEngine | null = null;

    async function startArena() {
      try {
        await loadFightingGameRuntime();
        if (cancelled) return;

        const rootElement = arenaRootRef.current;
        const canvas = canvasRef.current;
        const timerElement = timerRef.current;
        const dialogElement = dialogRef.current;
        const Engine = window.GameEngine;

        if (!rootElement || !canvas || !timerElement || !dialogElement || !Engine) {
          throw new Error('Fighting game mount point is missing');
        }

        localEngine = new Engine({
          canvas,
          timerElement,
          dialogElement,
          rootElement,
          stagePath: `/2dgame/data/stages/hills.json?v=${FIGHTING_GAME_ASSET_VERSION}`,
          fighterPaths: [
            `/2dgame/data/fighters/player1.json?v=${FIGHTING_GAME_ASSET_VERSION}`,
            `/2dgame/data/fighters/player2.json?v=${FIGHTING_GAME_ASSET_VERSION}`,
          ],
          autonomous: true,
          arenaSeed,
          assetBasePath: '/2dgame/',
        });
        engineRef.current = localEngine;
        window.gameEngine = localEngine;

        await localEngine.start();
        if (cancelled) {
          localEngine.destroy?.();
          return;
        }

        setArenaLoadError(null);
        applyArenaPayload(latestArenaPayloadRef.current);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setArenaLoadError('Arena failed to load');
          if (dialogRef.current) {
            dialogRef.current.style.display = 'flex';
            dialogRef.current.textContent = 'Arena failed to load';
          }
        }
      }
    }

    void startArena();

    return () => {
      cancelled = true;
      if (engineRef.current === localEngine) {
        engineRef.current = null;
      }
      localEngine?.destroy?.();
    };
  }, [applyArenaPayload, arenaSeed]);

  useEffect(() => {
    if (!arenaState || !syncedBattle) return;

    const cue = deriveArenaGuiCue(previousBattleRef.current, syncedBattle);
    previousBattleRef.current = syncedBattle;
    latestArenaPayloadRef.current = { state: arenaState, cue };
    applyArenaPayload(latestArenaPayloadRef.current);
  }, [arenaState, applyArenaPayload, syncedBattle]);

  return (
    <section
      className={`relative overflow-hidden border border-border bg-black shadow-sm ${
        flush ? 'rounded-none border-x-0 border-t-0' : compact ? 'mx-1 mt-1 rounded-xl' : 'rounded-2xl'
      }`}
    >
      <div className="aspect-[16/9] w-full bg-black">
        <div
          ref={arenaRootRef}
          className="bantah-fighting-game container"
          aria-label="Bantah Battle Fighting Game"
        >
          <div className="top-indicator">
            <div className="player-card player1">
              <div className="avatar-ring">
                <img src={leftAvatar} alt={`${leftName} avatar`} />
              </div>
              <div className="player-card-body">
                <div className="player-heading">
                  <div>
                    <div className="player-name">{leftName}</div>
                    <div className="player-team">{leftTeam}</div>
                  </div>
                  <div className="hp-readout">
                    <span className="hp-current">100</span> / 100
                  </div>
                </div>
                <div className="health-frame">
                  <div className="max-health" />
                  <div className="health" />
                </div>
                <div className="hud-abilities">
                  <span>ICE</span>
                  <span>SHD</span>
                  <span>DASH</span>
                </div>
              </div>
            </div>
            <div className="timer-panel">
              <div className="round-label">ROUND 1</div>
              <div ref={timerRef} className="timer">
                --
              </div>
              <div className="match-format">BEST OF 3</div>
              <div className="round-dots" aria-hidden="true">
                <span className="is-active" />
                <span className="is-active" />
                <span />
                <i />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="player-card player2">
              <div className="player-card-body">
                <div className="player-heading">
                  <div>
                    <div className="player-name">{rightName}</div>
                    <div className="player-team">{rightTeam}</div>
                  </div>
                  <div className="hp-readout">
                    <span className="hp-current">100</span> / 100
                  </div>
                </div>
                <div className="health-frame">
                  <div className="max-health" />
                  <div className="health" />
                </div>
                <div className="hud-abilities">
                  <span>STRK</span>
                  <span>GRD</span>
                  <span>HEAL</span>
                </div>
              </div>
              <div className="avatar-ring">
                <img src={rightAvatar} alt={`${rightName} avatar`} />
              </div>
            </div>
          </div>
          <div ref={dialogRef} className="dialog" />
          <canvas ref={canvasRef} />
        </div>
      </div>
      {arenaLoadError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4 text-center text-sm font-black uppercase tracking-wide text-white">
          {arenaLoadError}
        </div>
      )}
      <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 hidden rounded-md border border-sky-200/50 bg-black/55 px-2 py-1 text-white shadow-lg backdrop-blur-sm sm:left-3 sm:top-3 sm:block sm:px-2.5 sm:py-1.5">
        <div className="text-[10px] font-black uppercase tracking-wide text-sky-100">
          {battleMode === 'arena' ? 'Arena Mode' : 'Challenge Mode'}
        </div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65">
          {battleMode === 'arena' ? 'Simulated agent battle' : 'YES/NO challenge layer'}
        </div>
      </div>
      {battleMode === 'arena' && watchReward?.enabled && (
        <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 max-w-[150px] rounded-md border border-amber-200/40 bg-black/55 px-2 py-1 text-white shadow-lg backdrop-blur-sm sm:bottom-3 sm:left-3 sm:max-w-[220px] sm:px-2.5 sm:py-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[8px] font-black uppercase tracking-wide text-amber-200 sm:text-[10px]">
              BantCredit
            </span>
            <span className="font-mono text-[9px] font-black text-white sm:text-[11px]">
              {formatWatchTime(watchReward.watchedSeconds)}
            </span>
          </div>
          <div className="mt-0.5 text-[9px] font-black leading-tight text-white sm:text-[11px]">
            {watchReward.isAuthenticated
              ? `+${watchReward.earnedForBattle} earned`
              : 'Sign in to earn'}
          </div>
          <div className="mt-0.5 text-[8px] font-bold leading-tight text-white/65 sm:text-[10px]">
            {watchReward.nextTier
              ? `Next ${watchReward.nextTier.totalPoints - watchReward.earnedForBattle} at ${formatWatchTime(watchReward.nextTier.minSeconds)}`
              : 'All watch rewards unlocked'}
          </div>
        </div>
      )}
      {showOverlay && (
        <div
          data-arena-state-overlay={battleStatus}
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[1px]"
        >
          <div className={`w-full max-w-sm rounded-lg border px-4 py-3 text-center shadow-2xl ${overlayCopy.tone}`}>
            <div className="text-[10px] font-black uppercase tracking-wide opacity-85">{overlayCopy.eyebrow}</div>
            <div className="mt-1 text-sm font-black uppercase tracking-wide text-white">{matchupLabel}</div>
            <div className="mt-2 text-xs font-bold uppercase opacity-80">{overlayCopy.title}</div>
            {battleStatus === 'queued' ? (
              <div className="mt-1 font-mono text-4xl font-black leading-none text-white">
                {formatCountdown(remainingSeconds)}
              </div>
            ) : (
              <div className="mt-1 text-3xl font-black leading-none text-white">{battleStatus.toUpperCase()}</div>
            )}
            <div className="mt-2 text-xs font-bold text-white/80">{arenaLabel}</div>
            <div className="mt-1 text-[11px] leading-snug text-white/65">{overlayCopy.detail}</div>
          </div>
        </div>
      )}
    </section>
  );
}
