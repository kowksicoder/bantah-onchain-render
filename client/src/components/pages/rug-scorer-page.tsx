'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Flag,
  RefreshCw,
  Search,
  Shield,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type RiskLevel = 'low' | 'medium' | 'high' | string

type RugToken = {
  id: string
  chainId: string
  chainLabel: string
  tokenAddress: string
  tokenSymbol: string | null
  tokenName: string | null
  logoUrl: string | null
  pairUrl: string | null
  priceUsd: number | null
  liquidityUsd: number
  marketCap: number | null
  volumeH24: number
  txnsH24: {
    buys: number
    sells: number
  }
  priceChangeH24: number
  rug: {
    score: number
    riskLevel: RiskLevel
    verdict?: string | null
    reasons: Array<{
      code?: string
      label: string
      impact?: number
    }>
    missingSignals?: string[]
  }
  holders: {
    status: string
    topHolderPercent: number | null
    top10HolderPercent: number | null
  }
  liquidityLock: {
    status: string
    label: string
    lockedPercent?: number | null
    source?: string
    detail?: string
  }
  contractRisk?: {
    status: string
    label: string
    source?: string
    detail?: string
  }
  security?: {
    provider: string
    providerStatus: string
    holderSource: string
    holderStatus: string
    notes: string[]
    signals: Array<{
      key: string
      label: string
      tone: string
      value: string | null
      source: string
    }>
  }
  source: 'dexscreener'
  updatedAt: string
  sparkline: number[]
}

type RugDashboard = {
  generatedAt: string
  source: 'dexscreener'
  sourceStatus: 'live'
  pinned: RugToken[]
  trending: RugToken[]
  popular: RugToken[]
  overview: {
    analyzed: number
    low: number
    medium: number
    high: number
    lowPct: number
    mediumPct: number
    highPct: number
  }
}

type SearchPayload = {
  generatedAt: string
  query: string
  resolvedQuery: string
  pairCount: number
  token: RugToken
  analysis?: {
    aggregate?: {
      pairCount: number
      totalLiquidityUsd: number
      totalVolumeH24: number
      totalBuysH1: number
      totalSellsH1: number
    }
    posts?: {
      rug?: string | null
    }
  }
}

type RugReportEntry = {
  id: string
  chainId: string
  tokenAddress: string
  tokenSymbol: string | null
  tokenName: string | null
  severity: 'low' | 'medium' | 'high'
  reason: string
  notes: string | null
  status: 'open' | 'reviewed' | 'dismissed'
  createdAt: string
}

type RugScanHistoryEntry = {
  id: string
  tokenKey: string
  chainId: string
  tokenAddress: string
  tokenSymbol: string | null
  tokenName: string | null
  score: number
  riskLevel: string
  priceUsd: number | null
  liquidityUsd: number | null
  volumeH24: number | null
  createdAt: string
}

const RUG_USER_KEY_STORAGE_KEY = 'bantahbro:rug-user-key'
const RUG_SEARCH_HISTORY_STORAGE_KEY = 'bantahbro:rug-search-history'
const MAX_RUG_SEARCH_HISTORY = 60

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function makeTokenKey(input: { chainId: string; tokenAddress: string }) {
  return `${input.chainId.toLowerCase()}:${input.tokenAddress.toLowerCase()}`
}

function normalizeRisk(level?: RiskLevel) {
  const value = String(level || '').toLowerCase()
  if (value.includes('high') || value.includes('critical')) return 'high'
  if (value.includes('medium') || value.includes('caution') || value.includes('elevated')) return 'medium'
  return 'low'
}

function riskLabel(level?: RiskLevel) {
  const risk = normalizeRisk(level)
  if (risk === 'high') return 'High Risk'
  if (risk === 'medium') return 'Medium Risk'
  return 'Low Risk'
}

function riskClasses(level?: RiskLevel) {
  const risk = normalizeRisk(level)
  if (risk === 'high') return 'text-rose-400 border-rose-500/25 bg-rose-500/10'
  if (risk === 'medium') return 'text-amber-300 border-amber-500/25 bg-amber-500/10'
  return 'text-lime-300 border-lime-500/25 bg-lime-500/10'
}

function signalClasses(tone?: string) {
  const value = String(tone || '').toLowerCase()
  if (value === 'danger') return 'border-rose-500/25 bg-rose-500/10 text-rose-300'
  if (value === 'warning') return 'border-amber-500/25 bg-amber-500/10 text-amber-200'
  if (value === 'safe') return 'border-lime-500/25 bg-lime-500/10 text-lime-300'
  return 'border-border bg-background text-muted-foreground'
}

function signalTextClasses(tone?: string) {
  const value = String(tone || '').toLowerCase()
  if (value === 'danger') return 'text-rose-300'
  if (value === 'warning') return 'text-amber-200'
  if (value === 'safe') return 'text-lime-300'
  return 'text-foreground'
}

function riskAccent(level?: RiskLevel) {
  const risk = normalizeRisk(level)
  if (risk === 'high') return '#fb3b66'
  if (risk === 'medium') return '#f59e0b'
  return '#7ee03d'
}

function formatCompact(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatUsd(value?: number | null) {
  if (!value || !Number.isFinite(value)) return 'n/a'
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
  if (value >= 0.0001) return `$${value.toFixed(6)}`
  return `$${value.toPrecision(4)}`
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function timeAgo(value?: string | null) {
  if (!value) return 'just now'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function TokenLogo({ token, size = 'md' }: { token: RugToken; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  return (
    <div className={cx('shrink-0 overflow-hidden rounded-full border border-border bg-muted', sizeClass)}>
      {token.logoUrl ? (
        <img
          src={token.logoUrl}
          alt={`${token.tokenSymbol || token.tokenName || 'token'} logo`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-black text-muted-foreground">
          {(token.tokenSymbol || token.tokenName || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function Sparkline({ values, tone = 'risk' }: { values: number[]; tone?: 'risk' | 'low' | 'medium' }) {
  const points = useMemo(() => {
    const list = values.length ? values : [50, 48, 52, 47, 53, 50]
    const step = 100 / Math.max(1, list.length - 1)
    return list
      .map((value, index) => `${index * step},${Math.max(4, Math.min(46, value / 2))}`)
      .join(' ')
  }, [values])
  const color = tone === 'low' ? '#7ee03d' : tone === 'medium' ? '#f59e0b' : '#fb3b66'

  return (
    <svg viewBox="0 0 100 50" className="h-9 w-full overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
        points={points}
      />
    </svg>
  )
}

function ScoreRing({ score, level }: { score: number; level?: RiskLevel }) {
  const color = riskAccent(level)
  return (
    <div
      className="grid h-16 w-16 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, rgb(var(--color-line) / 0.65) 0deg)`,
      }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-background text-center">
        <div className="text-lg font-black leading-none text-foreground">{score}</div>
        <div className="text-[10px] leading-none text-muted-foreground">/100</div>
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="text-primary">{icon}</div>
      <div>
        <div className="text-sm font-black uppercase tracking-wide text-foreground">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="ml-auto">{action}</div>
    </div>
  )
}

function PinnedCard({ token, onSelect }: { token: RugToken; onSelect: (token: RugToken) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className="min-w-[136px] rounded border border-border bg-card p-2.5 text-left transition hover:border-primary/40 hover:bg-muted/30 md:min-w-0"
    >
      <div className="mb-2 flex items-center gap-2">
        <TokenLogo token={token} />
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-foreground">{token.tokenName || token.tokenSymbol || 'Token'}</div>
          <div className="truncate text-[11px] font-bold text-muted-foreground">{token.tokenSymbol || token.chainLabel}</div>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <ScoreRing score={token.rug.score} level={token.rug.riskLevel} />
        <div className="pb-2 text-right">
          <div className={cx('text-[11px] font-black', riskClasses(token.rug.riskLevel))}>
            {riskLabel(token.rug.riskLevel)}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">{token.chainLabel}</div>
        </div>
      </div>
    </button>
  )
}

function TrendingRow({ token, index, onSelect }: { token: RugToken; index: number; onSelect: (token: RugToken) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_2.8rem_4.8rem] items-center gap-2 border-b border-border/70 px-2 py-2 text-left last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_3.5rem_6rem_3.5rem]"
    >
      <TokenLogo token={token} size="sm" />
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-foreground">{token.tokenName || token.tokenSymbol}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          #{index + 1} / {token.chainLabel} / {token.tokenSymbol || 'LIVE'}
        </div>
      </div>
      <div className="text-right text-lg font-black text-rose-400">{token.rug.score}</div>
      <Sparkline values={token.sparkline} tone="risk" />
      <div className="hidden text-right text-[10px] text-muted-foreground sm:block">{timeAgo(token.updatedAt)}</div>
    </button>
  )
}

function OverviewCard({
  title,
  range,
  pct,
  tone,
}: {
  title: string
  range: string
  pct: number
  tone: 'low' | 'medium' | 'risk'
}) {
  const dot = tone === 'low' ? 'bg-lime-400' : tone === 'medium' ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-black text-foreground">
        <span className={cx('h-2 w-2 rounded-full', dot)} />
        {title}
      </div>
      <div className="text-[11px] text-muted-foreground">{range}</div>
      <Sparkline values={[44, 40, 46, 35, 43, 32, 39, 31].map((value) => value + pct * 0.2)} tone={tone} />
      <div className="mt-1 text-sm font-black text-foreground">{pct}%</div>
    </div>
  )
}

function PopularTable({ tokens, onSelect }: { tokens: RugToken[]; onSelect: (token: RugToken) => void }) {
  return (
    <div className="overflow-x-auto rounded border border-border bg-card">
      <div className="min-w-[34rem]">
        <div className="grid grid-cols-[2rem_minmax(10rem,1.2fr)_5.5rem_5.5rem_6rem_5rem] border-b border-border px-3 py-2 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          <div>#</div>
          <div>Token</div>
          <div>Score</div>
          <div>Risk</div>
          <div>Liquidity</div>
          <div className="text-right">24H</div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {tokens.map((token, index) => (
            <button
              type="button"
              key={`${token.id}-${index}`}
              onClick={() => onSelect(token)}
              className="grid w-full grid-cols-[2rem_minmax(10rem,1.2fr)_5.5rem_5.5rem_6rem_5rem] items-center border-b border-border/60 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/20"
            >
              <div className="font-bold text-muted-foreground">{index + 1}</div>
              <div className="flex min-w-0 items-center gap-2">
                <TokenLogo token={token} size="sm" />
                <div className="min-w-0">
                  <div className="truncate font-black text-foreground">{token.tokenName || token.tokenSymbol}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{token.tokenSymbol || token.chainLabel}</div>
                </div>
              </div>
              <div className={cx('font-black', riskClasses(token.rug.riskLevel))}>{token.rug.score} <span className="text-[10px] text-muted-foreground">/100</span></div>
              <div className={cx('text-[11px] font-black', riskClasses(token.rug.riskLevel))}>{riskLabel(token.rug.riskLevel).replace(' Risk', '')}</div>
              <div className="font-bold text-foreground">${formatCompact(token.liquidityUsd)}</div>
              <div className={cx('text-right font-black', token.priceChangeH24 >= 0 ? 'text-lime-400' : 'text-rose-400')}>
                {formatPercent(token.priceChangeH24)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SearchResult({
  payload,
  onClear,
  onReport,
  onCopyBlink,
  onOpenFullReport,
  reportCount,
  history,
}: {
  payload: SearchPayload
  onClear: () => void
  onReport: (token: RugToken) => void
  onCopyBlink: (token: RugToken) => void
  onOpenFullReport: () => void
  reportCount: number
  history: RugScanHistoryEntry[]
}) {
  const token = payload.token
  const totalTxns = token.txnsH24.buys + token.txnsH24.sells
  const buyPressure = totalTxns > 0 ? Math.round((token.txnsH24.buys / totalTxns) * 100) : null
  const latestPreviousSearch = history[0] || null
  const scoreDelta = latestPreviousSearch ? token.rug.score - latestPreviousSearch.score : null
  const historyScores = history.length
    ? [...history.slice().reverse().map((entry) => entry.score), token.rug.score]
    : []

  return (
    <div className="rounded border border-primary/25 bg-background p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="mb-3 flex items-start gap-3">
            <TokenLogo token={token} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-lg font-black text-foreground">{token.tokenName || token.tokenSymbol}</div>
                <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', riskClasses(token.rug.riskLevel))}>
                  {riskLabel(token.rug.riskLevel)}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {token.chainLabel} / {token.tokenSymbol || 'TOKEN'} / {token.tokenAddress}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded border border-border bg-card p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Price</div>
              <div className="text-sm font-black text-foreground">{formatUsd(token.priceUsd)}</div>
            </div>
            <div className="rounded border border-border bg-card p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Liquidity</div>
              <div className="text-sm font-black text-foreground">${formatCompact(token.liquidityUsd)}</div>
            </div>
            <div className="rounded border border-border bg-card p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Buy Pressure</div>
              <div className="text-sm font-black text-foreground">{buyPressure === null ? 'n/a' : `${buyPressure}%`}</div>
            </div>
            <div className="rounded border border-border bg-card p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Reports</div>
              <div className="text-sm font-black text-foreground">{reportCount}</div>
            </div>
          </div>

          <div className="mt-2 rounded border border-border bg-card p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase text-muted-foreground">Risk Drivers</div>
              <div className="text-[10px] text-muted-foreground">Updated {timeAgo(token.updatedAt)}</div>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {(token.rug.reasons.length ? token.rug.reasons : [{ label: 'No high-confidence risk reasons returned.' }])
                .slice(0, 4)
                .map((reason, index) => (
                  <div key={reason.code || `${reason.label}-${index}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-primary" />
                    <span>{reason.label}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className={cx('rounded border p-2', signalClasses(token.contractRisk?.status))}>
              <div className="text-[9px] font-black uppercase opacity-70">Contract</div>
              <div className="truncate text-[11px] font-black">{token.contractRisk?.label || 'Not verified'}</div>
            </div>
            <div className={cx('rounded border p-2', signalClasses(token.liquidityLock.status))}>
              <div className="text-[9px] font-black uppercase opacity-70">LP Lock</div>
              <div className="truncate text-[11px] font-black">{token.liquidityLock.label}</div>
            </div>
            <div className={cx('rounded border p-2', token.holders.status === 'available' ? signalClasses('safe') : signalClasses('unknown'))}>
              <div className="text-[9px] font-black uppercase opacity-70">Holders</div>
              <div className="truncate text-[11px] font-black">{token.holders.status.replaceAll('_', ' ')}</div>
            </div>
          </div>
        </div>

        <div className="rounded border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <ScoreRing score={token.rug.score} level={token.rug.riskLevel} />
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Score change</div>
              <div className={cx('text-lg font-black', (scoreDelta || 0) <= 0 ? 'text-lime-400' : 'text-rose-400')}>
                {scoreDelta === null ? 'New' : `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {history.length ? `${history.length} past search${history.length === 1 ? '' : 'es'}` : 'First search'}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">24H Move</div>
              <div className={cx('font-black', token.priceChangeH24 >= 0 ? 'text-lime-400' : 'text-rose-400')}>
                {formatPercent(token.priceChangeH24)}
              </div>
            </div>
            <div className="rounded border border-border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">24H Volume</div>
              <div className="font-black text-foreground">${formatCompact(token.volumeH24)}</div>
            </div>
            <div className="rounded border border-border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Top Holder</div>
              <div className="font-black text-foreground">
                {token.holders.topHolderPercent === null ? 'n/a' : `${token.holders.topHolderPercent.toFixed(1)}%`}
              </div>
            </div>
            <div className="rounded border border-border bg-background p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Liq Lock</div>
              <div className="truncate font-black text-foreground">{token.liquidityLock.label}</div>
            </div>
          </div>

          {history.length > 0 && historyScores.length > 1 && (
            <div className="mt-2 rounded border border-border bg-background p-2">
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Search Trail</div>
              <Sparkline values={historyScores} tone={normalizeRisk(token.rug.riskLevel) === 'low' ? 'low' : normalizeRisk(token.rug.riskLevel) === 'medium' ? 'medium' : 'risk'} />
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onReport(token)}
              className="inline-flex items-center justify-center gap-1 rounded bg-rose-500 px-3 py-2 text-xs font-black text-white hover:bg-rose-400"
            >
              <Flag size={13} /> Report
            </button>
            <button
              type="button"
              onClick={onOpenFullReport}
              className="inline-flex items-center justify-center gap-1 rounded border border-border px-3 py-2 text-xs font-black text-foreground hover:border-primary/50"
            >
              <FileText size={13} /> Full Report
            </button>
            <button
              type="button"
              onClick={() => onCopyBlink(token)}
              className="inline-flex items-center justify-center gap-1 rounded border border-primary/35 px-3 py-2 text-xs font-black text-primary"
            >
              <Copy size={13} /> Blink
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            {token.pairUrl && (
              <a
                href={token.pairUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-border bg-background px-3 py-2 text-xs font-black text-foreground hover:text-primary"
              >
                Open chart <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center justify-center rounded border border-border px-3 py-2 text-xs font-black text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FullReportModal({
  payload,
  history,
  reports,
  onClose,
  onReport,
  onCopyBlink,
}: {
  payload: SearchPayload
  history: RugScanHistoryEntry[]
  reports: RugReportEntry[]
  onClose: () => void
  onReport: (token: RugToken) => void
  onCopyBlink: (token: RugToken) => void
}) {
  const token = payload.token
  const totalTxns = token.txnsH24.buys + token.txnsH24.sells
  const buyPressure = totalTxns > 0 ? Math.round((token.txnsH24.buys / totalTxns) * 100) : null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded border border-border bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-start gap-3">
          <TokenLogo token={token} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-xl font-black text-foreground">{token.tokenName || token.tokenSymbol}</div>
              <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', riskClasses(token.rug.riskLevel))}>
                {riskLabel(token.rug.riskLevel)}
              </span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {token.chainLabel} / {token.tokenSymbol || 'TOKEN'} / {token.tokenAddress}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded bg-background text-muted-foreground hover:text-foreground"
            aria-label="Close full report"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="rounded border border-border bg-background p-3">
            <div className="grid place-items-center">
              <ScoreRing score={token.rug.score} level={token.rug.riskLevel} />
            </div>
            <div className="mt-3 text-center text-xs text-muted-foreground">
              Live DexScreener scan. Unknown safety signals stay visible.
            </div>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => onReport(token)}
                className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-black text-white hover:bg-rose-400"
              >
                Report Scam
              </button>
              <button
                type="button"
                onClick={() => onCopyBlink(token)}
                className="rounded-lg bg-background px-3 py-2 text-xs font-black text-primary ring-1 ring-primary/25"
              >
                Copy Blink Action
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Price</div>
                <div className="text-sm font-black text-foreground">{formatUsd(token.priceUsd)}</div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Liquidity</div>
                <div className="text-sm font-black text-foreground">${formatCompact(token.liquidityUsd)}</div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Volume 24H</div>
                <div className="text-sm font-black text-foreground">${formatCompact(token.volumeH24)}</div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Buy Pressure</div>
                <div className="text-sm font-black text-foreground">{buyPressure === null ? 'n/a' : `${buyPressure}%`}</div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Buys / Sells</div>
                <div className="text-sm font-black text-foreground">
                  {formatCompact(token.txnsH24.buys)} / {formatCompact(token.txnsH24.sells)}
                </div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Top Holder</div>
                <div className="text-sm font-black text-foreground">
                  {token.holders.topHolderPercent === null ? 'n/a' : `${token.holders.topHolderPercent.toFixed(1)}%`}
                </div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Lock Signal</div>
                <div className={cx('truncate text-sm font-black', signalTextClasses(token.liquidityLock.status))}>{token.liquidityLock.label}</div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Contract</div>
                <div className={cx('truncate text-sm font-black', signalTextClasses(token.contractRisk?.status))}>
                  {token.contractRisk?.label || 'Not verified'}
                </div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Reports</div>
                <div className="text-sm font-black text-foreground">{reports.length}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border border-border bg-background p-3">
                <div className="mb-2 text-xs font-black uppercase text-foreground">Risk reasons</div>
                <div className="space-y-1.5">
                  {(token.rug.reasons.length ? token.rug.reasons : [{ label: 'No high-confidence risk reasons returned.' }]).map((reason, index) => (
                    <div key={reason.code || `${reason.label}-${index}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-primary" />
                      <span>{reason.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="mb-2 text-xs font-black uppercase text-foreground">Live security adapters</div>
                <div className="space-y-1.5">
                  {(token.security?.signals?.length
                    ? token.security.signals.slice(0, 5)
                    : [
                        {
                          key: 'security-note',
                          label: token.security?.notes?.[0] || 'No live contract flags returned.',
                          tone: 'unknown',
                          value: null,
                          source: token.security?.provider || 'adapter',
                        },
                      ]).map((signal) => (
                    <div key={signal.key} className={cx('rounded-lg border px-2 py-1.5 text-xs', signalClasses(signal.tone))}>
                      <span className="font-black">{signal.label}</span>
                      {signal.value && <span className="ml-1 opacity-80">({signal.value})</span>}
                    </div>
                  ))}
                  {token.rug.missingSignals?.length ? (
                    <div className="pt-1 text-[11px] text-muted-foreground">
                      Still missing: {token.rug.missingSignals.join(', ')}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={cx('grid gap-3', history.length ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
              {history.length > 0 && (
                <div className="rounded border border-border bg-background p-3">
                  <div className="mb-2 text-xs font-black uppercase text-foreground">Search history</div>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                        <span className={cx('font-black', riskClasses(entry.riskLevel))}>{entry.score}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded border border-border bg-background p-3">
                <div className="mb-2 text-xs font-black uppercase text-foreground">Community reports</div>
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {reports.length ? reports.map((report) => (
                    <div key={report.id} className="rounded-lg bg-card p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cx('font-black capitalize', riskClasses(report.severity))}>{report.severity}</span>
                        <span className="text-muted-foreground">{timeAgo(report.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground">{report.reason}</div>
                    </div>
                  )) : (
                    <div className="text-xs text-muted-foreground">No community reports for this token yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RugScorerPage() {
  const { toast } = useToast()
  const [dashboard, setDashboard] = useState<RugDashboard | null>(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchPayload | null>(null)
  const [resultSource, setResultSource] = useState<'search' | 'browse' | null>(null)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<RugScanHistoryEntry[]>([])
  const [userKey, setUserKey] = useState('')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [reportToken, setReportToken] = useState<RugToken | null>(null)
  const [reportSeverity, setReportSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [reportReason, setReportReason] = useState('Suspicious token behavior')
  const [reportNotes, setReportNotes] = useState('')
  const [tokenReports, setTokenReports] = useState<RugReportEntry[]>([])
  const [isLoadingTokenIntel, setIsLoadingTokenIntel] = useState(false)
  const [isFullReportOpen, setIsFullReportOpen] = useState(false)

  const visibleHistory = useMemo(() => {
    if (!result?.token) return []

    const matches = searchHistory.filter((entry) => makeTokenKey(entry) === makeTokenKey(result.token))
    return resultSource === 'search' ? matches.slice(1) : matches
  }, [result, resultSource, searchHistory])

  const persistSearchHistory = (token: RugToken, createdAt?: string) => {
    const entry: RugScanHistoryEntry = {
      id: `${makeTokenKey(token)}:${createdAt || new Date().toISOString()}`,
      tokenKey: makeTokenKey(token),
      chainId: token.chainId,
      tokenAddress: token.tokenAddress,
      tokenSymbol: token.tokenSymbol,
      tokenName: token.tokenName,
      score: token.rug.score,
      riskLevel: String(token.rug.riskLevel || 'low'),
      priceUsd: token.priceUsd,
      liquidityUsd: token.liquidityUsd,
      volumeH24: token.volumeH24,
      createdAt: createdAt || new Date().toISOString(),
    }

    setSearchHistory((current) => {
      const next = [entry, ...current].slice(0, MAX_RUG_SEARCH_HISTORY)
      window.localStorage.setItem(RUG_SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const loadDashboard = async (force = false) => {
    setIsLoadingDashboard(true)
    setError(null)
    try {
      const response = await fetch(`/api/bantahbro/rug-v2/dashboard?scanLimit=28${force ? '&force=true' : ''}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || `Rug dashboard failed (${response.status})`)
      }
      setDashboard((await response.json()) as RugDashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Rug dashboard failed')
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  useEffect(() => {
    loadDashboard(false)
  }, [])

  useEffect(() => {
    const storedHistory = window.localStorage.getItem(RUG_SEARCH_HISTORY_STORAGE_KEY)
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory)
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed as RugScanHistoryEntry[])
        }
      } catch {
        window.localStorage.removeItem(RUG_SEARCH_HISTORY_STORAGE_KEY)
      }
    }

    const existing = window.localStorage.getItem(RUG_USER_KEY_STORAGE_KEY)
    const next = existing || `web-${crypto.randomUUID()}`
    window.localStorage.setItem(RUG_USER_KEY_STORAGE_KEY, next)
    setUserKey(next)

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const chainId = params.get('chainId')
    if (token) {
      setQuery(token)
      void runSearchFor(token, chainId || undefined)
    }
  }, [])

  useEffect(() => {
    if (!result?.token) {
      setTokenReports([])
      setIsFullReportOpen(false)
      return
    }

    const token = result.token
    let cancelled = false
    setIsLoadingTokenIntel(true)
    fetch(
      `/api/bantahbro/rug-v2/reports?chainId=${encodeURIComponent(token.chainId)}&tokenAddress=${encodeURIComponent(token.tokenAddress)}&limit=20`,
      { headers: { Accept: 'application/json' } },
    )
      .then((response) => (response.ok ? response.json() : { reports: [] }))
      .catch(() => ({ reports: [] }))
      .then((reportsPayload) => {
        if (cancelled) return
        setTokenReports(Array.isArray(reportsPayload?.reports) ? reportsPayload.reports : [])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTokenIntel(false)
      })

    return () => {
      cancelled = true
    }
  }, [result?.token.chainId, result?.token.tokenAddress])

  const runSearchFor = async (rawQuery: string, chainId?: string) => {
    const nextQuery = rawQuery.trim()
    if (!nextQuery) {
      setError('Search a ticker, token name, contract, or pair address first.')
      return
    }

    setIsSearching(true)
    setError(null)
    try {
      const chainParam = chainId ? `&chainId=${encodeURIComponent(chainId)}` : ''
      const response = await fetch(
        `/api/bantahbro/rug-v2/search?q=${encodeURIComponent(nextQuery)}${chainParam}`,
        { headers: { Accept: 'application/json' } },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || `Rug scan failed (${response.status})`)
      }
      const payload = (await response.json()) as SearchPayload
      setResult(payload)
      setResultSource('search')
      persistSearchHistory(payload.token, payload.generatedAt)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Rug scan failed')
    } finally {
      setIsSearching(false)
    }
  }

  const runSearch = async () => runSearchFor(query)

  const selectToken = (token: RugToken) => {
    setResult({
      generatedAt: new Date().toISOString(),
      query: token.tokenSymbol || token.tokenAddress,
      resolvedQuery: token.tokenSymbol || token.tokenAddress,
      pairCount: 1,
      token,
    })
    setResultSource('browse')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  const blinkActionUrl = (token: RugToken) => {
    return `${window.location.origin}/api/actions/bantahbro/rug/${encodeURIComponent(token.chainId)}/${encodeURIComponent(token.tokenAddress)}`
  }

  const copyBlinkUrl = async (token: RugToken) => {
    try {
      await navigator.clipboard?.writeText(blinkActionUrl(token))
      setNotice('Real Blink Action URL copied for this token.')
      toast({
        title: 'Blink copied',
        description: 'Use it anywhere Blinks are supported.',
      })
      window.setTimeout(() => setNotice(null), 2200)
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      })
    }
  }

  const submitReport = async () => {
    if (!reportToken || !userKey) return
    setActionBusy('report')
    setError(null)
    try {
      const response = await fetch('/api/bantahbro/rug-v2/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          reporterKey: userKey,
          chainId: reportToken.chainId,
          tokenAddress: reportToken.tokenAddress,
          severity: reportSeverity,
          reason: reportReason,
          notes: reportNotes,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || `Report failed (${response.status})`)
      }
      const payload = await response.json().catch(() => null)
      if (payload?.report) {
        setTokenReports((current) => [payload.report as RugReportEntry, ...current])
      }
      setNotice(`Community report submitted for ${reportToken.tokenSymbol || reportToken.tokenName || 'token'}.`)
      toast({
        title: 'Report submitted',
        description: 'Community signal saved for review.',
      })
      setReportToken(null)
      setReportNotes('')
      window.setTimeout(() => setNotice(null), 2600)
    } catch (reportError) {
      const message = reportError instanceof Error ? reportError.message : 'Report failed'
      setError(message)
      toast({
        title: 'Report failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <div className="flex-1 overflow-hidden rounded border border-border bg-card text-foreground">
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border bg-background px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              <div>
                <h1 className="text-base font-black uppercase tracking-wide text-foreground">
                  <span className="text-primary">Rug</span> Scorer
                </h1>
                <p className="text-[11px] text-muted-foreground">Live token risk scanner</p>
              </div>
            </div>
            <div className="grid w-full grid-cols-[1fr_auto] overflow-hidden rounded border border-border bg-card lg:max-w-xl">
              <div className="flex items-center gap-2 px-3">
                <Search size={15} className="text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runSearch()
                  }}
                  placeholder="Search token name or paste address"
                  className="h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="button"
                onClick={runSearch}
                disabled={isSearching}
                className="m-1 rounded bg-primary px-4 text-xs font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 md:px-5"
              >
                {isSearching ? 'Analyzing' : 'Analyze'}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {error && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="rounded border border-primary/30 bg-primary/10 p-2.5 text-sm font-bold text-primary">
            {notice}
          </div>
        )}

        {result && (
          <SearchResult
            payload={result}
            onClear={() => {
              setResult(null)
              setResultSource(null)
            }}
            onReport={(token) => setReportToken(token)}
            onCopyBlink={copyBlinkUrl}
            onOpenFullReport={() => setIsFullReportOpen(true)}
            reportCount={tokenReports.length}
            history={visibleHistory}
          />
        )}
        {result && isLoadingTokenIntel && (
          <div className="-mt-2 text-right text-[11px] font-bold text-muted-foreground">Loading community reports...</div>
        )}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-wide text-foreground">Live Token Risk</div>
                <div className="text-[11px] text-muted-foreground">{dashboard?.overview.analyzed || 0} live tokens scanned from DexScreener</div>
              </div>
              <button
                type="button"
                onClick={() => loadDashboard(true)}
                disabled={isLoadingDashboard}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-black text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw size={12} className={isLoadingDashboard ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            {dashboard?.popular?.length ? (
              <PopularTable tokens={dashboard.popular.slice(0, 10)} onSelect={selectToken} />
            ) : (
              <div className="rounded border border-border bg-card p-5 text-center text-xs text-muted-foreground">
                No live Rug Scorer tokens loaded. No fallback rows are shown.
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <section className="rounded border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-black uppercase tracking-wide text-foreground">Risk Pulse</div>
                <div className="text-[11px] text-muted-foreground">{timeAgo(dashboard?.generatedAt)}</div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded border border-border bg-card px-2 py-1.5 text-center">
                  <div className="text-base font-black text-lime-300">{dashboard?.overview.lowPct || 0}%</div>
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">Low</div>
                </div>
                <div className="rounded border border-border bg-card px-2 py-1.5 text-center">
                  <div className="text-base font-black text-amber-300">{dashboard?.overview.mediumPct || 0}%</div>
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">Med</div>
                </div>
                <div className="rounded border border-border bg-card px-2 py-1.5 text-center">
                  <div className="text-base font-black text-rose-400">{dashboard?.overview.highPct || 0}%</div>
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">High</div>
                </div>
              </div>
            </section>

            <section className="rounded border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-2">
                <Flame size={15} className="text-primary" />
                <div className="text-sm font-black uppercase tracking-wide text-foreground">Highest Risk</div>
              </div>
              <div className="overflow-hidden rounded border border-border bg-card">
                {(dashboard?.trending || []).slice(0, 4).map((token, index) => (
                  <TrendingRow key={token.id} token={token} index={index} onSelect={selectToken} />
                ))}
                {!dashboard?.trending?.length && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No live risk spikes loaded.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded border border-border bg-background p-3">
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-foreground">Actions</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => result?.token && copyBlinkUrl(result.token)}
                  disabled={!result}
                  className="rounded border border-primary/35 bg-card px-3 py-2 text-xs font-black text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy Blink
                </button>
                <button
                  type="button"
                  onClick={() => result?.token && setReportToken(result.token)}
                  disabled={!result}
                  className="rounded bg-primary px-3 py-2 text-xs font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Report
                </button>
              </div>
              {!result && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Scan a token to unlock Blink and report actions.
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
      </div>

      {reportToken && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3">
          <div className="w-full max-w-md rounded border border-border bg-card p-3 shadow-2xl md:p-4">
            <div className="mb-3 flex items-start gap-3">
              <TokenLogo token={reportToken} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="text-base font-black text-foreground md:text-lg">Report {reportToken.tokenSymbol || reportToken.tokenName}</div>
                <div className="truncate text-xs text-muted-foreground">{reportToken.chainLabel} / {reportToken.tokenAddress}</div>
              </div>
              <button
                type="button"
                onClick={() => setReportToken(null)}
                className="rounded bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((severity) => (
                <button
                  key={severity}
                  type="button"
                  onClick={() => setReportSeverity(severity)}
                  className={cx(
                    'rounded border px-3 py-2 text-xs font-black capitalize',
                    reportSeverity === severity
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {severity}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs font-black uppercase text-muted-foreground">Reason</label>
            <input
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="mt-1 h-10 w-full rounded bg-input px-3 text-sm text-foreground outline-none"
              maxLength={180}
            />
            <label className="mt-3 block text-xs font-black uppercase text-muted-foreground">Notes</label>
            <textarea
              value={reportNotes}
              onChange={(event) => setReportNotes(event.target.value)}
              className="mt-1 min-h-20 w-full rounded bg-input px-3 py-2 text-sm text-foreground outline-none"
              placeholder="What did the community spot?"
              maxLength={1000}
            />
            <button
              type="button"
              onClick={submitReport}
              disabled={actionBusy === 'report'}
              className="mt-3 w-full rounded bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground disabled:opacity-50"
            >
              {actionBusy === 'report' ? 'Submitting' : 'Submit community report'}
            </button>
          </div>
        </div>
      )}

      {result && isFullReportOpen && (
        <FullReportModal
          payload={result}
          history={visibleHistory}
          reports={tokenReports}
          onClose={() => setIsFullReportOpen(false)}
          onReport={(token) => setReportToken(token)}
          onCopyBlink={copyBlinkUrl}
        />
      )}
    </div>
  )
}
