import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentBattle } from '@/types/agentBattle';
import { deriveArenaGuiCue, mapBattleToArenaGuiState, type ArenaGuiCue } from '@/lib/bantahbro/arenaGuiMapper';

type RetroBattleArenaProps = {
  battle: AgentBattle;
  compact?: boolean;
  flush?: boolean;
};

const RETRO_ARENA_STYLES = `
@keyframes bantah-attack-left {
  0% { transform: translateX(0) scale(1); }
  42% { transform: translateX(18px) scale(1.08); }
  100% { transform: translateX(0) scale(1); }
}
@keyframes bantah-attack-right {
  0% { transform: translateX(0) scale(1); }
  42% { transform: translateX(-18px) scale(1.08); }
  100% { transform: translateX(0) scale(1); }
}
@keyframes bantah-take-hit-left {
  0% { transform: translateX(0); filter: brightness(1); }
  18% { transform: translateX(-10px); filter: brightness(1.75) saturate(1.4); }
  42% { transform: translateX(5px); }
  100% { transform: translateX(0); filter: brightness(1); }
}
@keyframes bantah-take-hit-right {
  0% { transform: translateX(0); filter: brightness(1); }
  18% { transform: translateX(10px); filter: brightness(1.75) saturate(1.4); }
  42% { transform: translateX(-5px); }
  100% { transform: translateX(0); filter: brightness(1); }
}
@keyframes bantah-hit-pop {
  0% { transform: translate(-50%, 4px) scale(.35) rotate(-12deg); opacity: 0; }
  22% { opacity: 1; }
  55% { transform: translate(-50%, -10px) scale(1.16) rotate(7deg); opacity: 1; }
  100% { transform: translate(-50%, -34px) scale(.84) rotate(3deg); opacity: 0; }
}
@keyframes bantah-combo-flash {
  0% { transform: translate(-50%, -50%) scale(1.55); opacity: 0; }
  25% { opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(.95); opacity: 0; }
}
@keyframes bantah-impact-shake {
  0%, 100% { transform: translate(0, 0); }
  18% { transform: translate(-4px, 2px); }
  36% { transform: translate(4px, -2px); }
  58% { transform: translate(-2px, 1px); }
  78% { transform: translate(2px, -1px); }
}
@keyframes bantah-scan {
  0% { transform: translateY(-100%); opacity: .18; }
  100% { transform: translateY(100%); opacity: .05; }
}
`;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatUsd(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'n/a';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPrice(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'n/a';
  if (value >= 1) return `$${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function formatPercent(value: number) {
  const precision = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${value > 0 ? '+' : ''}${value.toFixed(precision)}%`;
}

function tokenName(label: string) {
  return label.replace(/^\$/, '').trim() || label;
}

function cueClass(cue: ArenaGuiCue | null, sideId: string, side: 'left' | 'right') {
  if (!cue) return '';
  if (cue.attackerSideId === sideId) {
    return side === 'left'
      ? 'scale-[1.04] -translate-y-1 drop-shadow-[0_0_30px_rgba(34,197,94,.55)]'
      : 'scale-[1.04] -translate-y-1 drop-shadow-[0_0_30px_rgba(249,115,22,.55)]';
  }
  if (cue.defenderSideId === sideId) return 'scale-[0.98] opacity-90';
  return '';
}

function healthSegments(percent: number, colorClass: string) {
  const activeSegments = clamp(Math.ceil(percent / 12.5), 0, 8);
  return [0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
    <span
      key={item}
      className={`h-full flex-1 border-r border-black/35 last:border-r-0 ${
        item < activeSegments ? colorClass : 'bg-black/60'
      }`}
    />
  ));
}

function cueDamage(cue: ArenaGuiCue | null) {
  if (!cue) return null;
  const base = Math.max(4, Math.min(28, Math.round(Math.abs(cue.delta) * 2.4)));
  if (cue.source === 'battle-event') return cue.severity === 'danger' ? 12 : 9;
  return base;
}

function cueComboLabel(cue: ArenaGuiCue | null) {
  if (!cue) return null;
  if (cue.kind === 'volume') return 'VOLUME!';
  if (cue.kind === 'pressure') return 'PRESSURE!';
  if (cue.kind === 'trade-flow') return 'HIT!';
  if (cue.kind === 'momentum') return 'COMBO!';
  if (cue.kind === 'confidence') return 'POWER UP!';
  if (cue.kind === 'liquidity') return 'SHIELD!';
  return cue.severity === 'danger' ? 'SELL WALL!' : 'LIVE HIT!';
}

function cueMarketLabel(cue: ArenaGuiCue | null) {
  if (!cue) return null;
  if (cue.kind === 'volume') return 'VOLUME SPIKE';
  if (cue.kind === 'pressure') return 'BUY PRESSURE';
  if (cue.kind === 'trade-flow') return 'ACTIVE TRADES';
  if (cue.kind === 'momentum') return 'MOMENTUM HIT';
  if (cue.kind === 'confidence') return 'CONFIDENCE SHIFT';
  if (cue.kind === 'liquidity') return 'LIQUIDITY MOVE';
  return cue.severity === 'danger' ? 'SELL WALL DETECTED' : 'LIVE MARKET HIT';
}

function sideAnimationClass(cue: ArenaGuiCue | null, sideId: string, side: 'left' | 'right') {
  if (!cue) return '';
  if (cue.attackerSideId === sideId) {
    return side === 'left' ? '[animation:bantah-attack-left_.44s_ease-out]' : '[animation:bantah-attack-right_.44s_ease-out]';
  }
  if (cue.defenderSideId === sideId) {
    return side === 'left' ? '[animation:bantah-take-hit-left_.46s_ease-out]' : '[animation:bantah-take-hit-right_.46s_ease-out]';
  }
  return '';
}

function ArcadeHpBar({
  percent,
  side,
  compact,
}: {
  percent: number;
  side: 'left' | 'right';
  compact: boolean;
}) {
  const isLeft = side === 'left';
  const color = isLeft ? 'from-emerald-500 via-green-300 to-emerald-300' : 'from-orange-500 via-orange-300 to-orange-400';
  const border = isLeft ? 'border-green-400 shadow-[0_0_14px_rgba(34,197,94,.38)]' : 'border-orange-400 shadow-[0_0_14px_rgba(249,115,22,.38)]';

  return (
    <div
      className={`relative overflow-hidden rounded-md bg-black/85 ${border} ${
        compact ? 'h-3.5 border-2' : 'h-4 border-2'
      }`}
    >
      <div
        className={`absolute inset-y-0 ${isLeft ? 'left-0' : 'right-0'} bg-gradient-to-r ${color} transition-all duration-500`}
        style={{ width: `${percent}%` }}
      >
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/24" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.2)_0,transparent_28%,rgba(0,0,0,.16)_58%,transparent_100%)]" />
      </div>
      <div className="absolute inset-0 flex">
        {healthSegments(percent, 'bg-transparent')}
      </div>
      <div className={`absolute inset-y-0 ${isLeft ? 'right-1' : 'left-1'} flex items-center font-mono text-[6px] font-black text-white/70`}>
        {percent} HP
      </div>
    </div>
  );
}

function RetroTokenAvatar({
  logoUrl,
  label,
  colorClass,
  compact,
  role = 'fighter',
}: {
  logoUrl: string | null;
  label: string;
  colorClass: string;
  compact: boolean;
  role?: 'hud' | 'fighter';
}) {
  const sizeClass =
    role === 'hud'
      ? compact
        ? 'h-7 w-7 border-2'
        : 'h-8 w-8 border-2'
      : compact
        ? 'h-11 w-11 border-2'
        : 'h-16 w-16 xl:h-20 xl:w-20 border-[3px]';

  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-full bg-black/60 shadow-[0_0_28px_rgba(0,0,0,.5)] ${colorClass} ${sizeClass}`}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent_0,rgba(255,255,255,.16)_50%,transparent_100%)] [animation:bantah-scan_1.8s_linear_infinite]" />
      {logoUrl ? (
        <div className="grid h-full w-full place-items-center rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.14),rgba(0,0,0,.76))]">
          <img src={logoUrl} alt={`${label} logo`} className="h-[92%] w-[92%] rounded-full object-contain" loading="lazy" />
        </div>
      ) : (
        <span className={`${role === 'hud' ? 'text-[8px]' : compact ? 'text-xs' : 'text-base'} px-1.5 text-center font-black uppercase tracking-tight text-foreground`}>
          {tokenName(label).slice(0, 5)}
        </span>
      )}
    </div>
  );
}

export function RetroBattleArena({ battle, compact = false, flush = false }: RetroBattleArenaProps) {
  const arena = useMemo(() => mapBattleToArenaGuiState(battle), [battle]);
  const previousBattleRef = useRef<AgentBattle | null>(null);
  const [cue, setCue] = useState<ArenaGuiCue | null>(null);

  useEffect(() => {
    const nextCue = deriveArenaGuiCue(previousBattleRef.current, battle);
    previousBattleRef.current = battle;
    setCue(nextCue);
    if (!nextCue) return;
    const timeout = window.setTimeout(() => setCue(null), 900);
    return () => window.clearTimeout(timeout);
  }, [battle]);

  const left = arena.left;
  const right = arena.right;
  const leftLabel = tokenName(left.label);
  const rightLabel = tokenName(right.label);
  const leading = left.isLeading ? left : right;
  const leftBuyHigh = left.buyPressureShareM5 >= 55 || left.confidence >= right.confidence;
  const rightSellWall = right.sellsM5 > right.buysM5 || right.sellPressureM5Usd > right.buyPressureM5Usd;
  const damage = cueDamage(cue);
  const comboLabel = cueComboLabel(cue);
  const marketLabel = cueMarketLabel(cue);
  const impactSide = cue?.defenderSideId === left.id ? 'left' : cue?.defenderSideId === right.id ? 'right' : null;

  return (
    <section
      className={`relative overflow-hidden border border-border bg-card text-card-foreground shadow-sm ${
        flush ? 'rounded-none border-x-0 border-t-0' : compact ? 'mx-1 mt-1 rounded-xl' : 'rounded-2xl'
      }`}
    >
      <style>{RETRO_ARENA_STYLES}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,197,94,.18),transparent_32%),radial-gradient(circle_at_82%_38%,rgba(249,115,22,.16),transparent_34%),linear-gradient(180deg,rgba(12,14,28,.96),rgba(0,0,0,.98))]" />
      <div className="absolute inset-0 opacity-[.09] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative">
        <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 border-b border-border/70 bg-muted/25 font-mono font-black uppercase ${compact ? 'px-2 py-0.5 text-[7px]' : 'px-3 py-0.5 text-[8px]'}`}>
          <div className={leftBuyHigh ? 'text-green-300' : 'text-muted-foreground'}>
            Buy Pressure: {leftBuyHigh ? 'High' : 'Live'}
          </div>
          <div className={leading.id === left.id ? 'text-green-300' : 'text-orange-300'}>
            {tokenName(leading.label)} {formatPercent(leading.priceChangeM5 || leading.priceChangeH24)}
          </div>
          <div className={`text-right ${rightSellWall ? 'text-red-300' : 'text-muted-foreground'}`}>
            {marketLabel || (rightSellWall ? 'Sell Wall Detected' : 'Market Wall Live')}
          </div>
        </div>

        <div className={`grid grid-cols-[auto_auto_auto_auto_auto] items-center border-b border-border/70 ${compact ? 'gap-1 px-2 py-1' : 'gap-1.5 px-3 py-1'}`}>
          <div className="text-center">
            <RetroTokenAvatar logoUrl={left.logoUrl} label={left.label} colorClass="border-green-400 shadow-[0_0_18px_rgba(34,197,94,.35)]" compact={compact} role="hud" />
            <div className="mt-px font-mono text-[7px] font-black uppercase text-green-300">{leftLabel}</div>
          </div>
          <div className={compact ? 'w-[5.75rem]' : 'w-[7.25rem]'}>
            <ArcadeHpBar percent={left.health} side="left" compact={compact} />
          </div>
          <div className="grid min-w-[2.75rem] place-items-center rounded-md border border-primary/30 bg-background/70 px-1 py-0.5 text-center font-mono leading-none shadow-[0_0_12px_rgba(124,58,237,.18)]">
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-black text-foreground`}>
              {formatDuration(arena.timeRemainingSeconds)}
            </span>
            <span className="mt-px text-[6px] font-black uppercase text-muted-foreground/55">VS</span>
          </div>
          <div className={compact ? 'w-[5.75rem]' : 'w-[7.25rem]'}>
            <ArcadeHpBar percent={right.health} side="right" compact={compact} />
          </div>
          <div className="text-center">
            <RetroTokenAvatar logoUrl={right.logoUrl} label={right.label} colorClass="border-orange-400 shadow-[0_0_18px_rgba(249,115,22,.35)]" compact={compact} role="hud" />
            <div className="mt-px font-mono text-[7px] font-black uppercase text-orange-300">{rightLabel}</div>
          </div>
        </div>

        <div
          className={`relative overflow-hidden ${
            compact ? 'min-h-[4.25rem] px-3 py-1' : 'min-h-[5.75rem] px-5 py-2'
          } ${cue ? '[animation:bantah-impact-shake_.28s_ease-out]' : ''}`}
        >
          <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-green-500/60 via-border to-orange-500/60" />
          <div className={`${compact ? 'text-lg' : 'text-2xl'} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono font-black text-muted-foreground/15`}>
            VS
          </div>
          {cue && comboLabel && (
            <div
              className={`absolute left-1/2 top-[42%] z-20 rounded-md border px-2 py-0.5 text-center font-mono text-[8px] font-black uppercase shadow-2xl [animation:bantah-combo-flash_.72s_ease-out_forwards] ${
                cue.severity === 'danger'
                  ? 'border-red-400/50 bg-red-950/80 text-red-200'
                  : 'border-orange-400/50 bg-orange-950/80 text-orange-200'
              }`}
            >
              {comboLabel}
            </div>
          )}
          {cue && damage && impactSide && (
            <div
              className={`absolute top-[32%] z-30 font-mono text-xs font-black text-white [animation:bantah-hit-pop_.72s_ease-out_forwards] ${
                impactSide === 'left' ? 'left-[29%]' : 'left-[71%]'
              }`}
            >
              -{damage}
            </div>
          )}

          <div className={`relative z-10 grid grid-cols-2 items-center ${compact ? 'gap-3' : 'gap-5'}`}>
            <div className={`flex flex-col items-center transition duration-500 ${cueClass(cue, left.id, 'left')} ${sideAnimationClass(cue, left.id, 'left')}`}>
              <RetroTokenAvatar logoUrl={left.logoUrl} label={left.label} colorClass="border-green-400 shadow-[0_0_55px_rgba(34,197,94,.42)]" compact={compact} />
              <div className={`${compact ? 'mt-0.5 text-[8px]' : 'mt-1 text-xs'} font-mono font-black uppercase text-green-300`}>
                {leftLabel}
              </div>
              <div className={`${compact ? 'text-[10px]' : 'text-sm'} font-mono font-black text-green-300`}>
                {formatPrice(left.priceUsd)}
              </div>
            </div>

            <div className={`flex flex-col items-center transition duration-500 ${cueClass(cue, right.id, 'right')} ${sideAnimationClass(cue, right.id, 'right')}`}>
              <RetroTokenAvatar logoUrl={right.logoUrl} label={right.label} colorClass="border-orange-400 shadow-[0_0_55px_rgba(249,115,22,.38)]" compact={compact} />
              <div className={`${compact ? 'mt-0.5 text-[8px]' : 'mt-1 text-xs'} font-mono font-black uppercase text-orange-300`}>
                {rightLabel}
              </div>
              <div className={`${compact ? 'text-[10px]' : 'text-sm'} font-mono font-black text-orange-300`}>
                {formatPrice(right.priceUsd)}
              </div>
            </div>
          </div>
        </div>

        <div className={`${compact ? 'px-2 pb-1.5' : 'px-4 pb-1.5'}`}>
          <div className={`${compact ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full border border-border/70 bg-black shadow-[0_0_12px_rgba(34,197,94,.12)]`}>
            <div className="flex h-full text-[0px]">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-300 transition-all duration-700"
                style={{ width: `${arena.scoreBar.leftPercent}%` }}
              />
              <div
                className="bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-700"
                style={{ width: `${arena.scoreBar.rightPercent}%` }}
              />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
