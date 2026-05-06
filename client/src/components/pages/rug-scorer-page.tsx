'use client'

import { useState } from 'react'
import { AlertTriangle, Search, Shield, TrendingUp } from 'lucide-react'

type RugScoreResponse = {
  chainId: string
  tokenAddress: string
  tokenSymbol: string | null
  primaryPair: {
    priceUsd?: number | null
    liquidityUsd?: number | null
    url?: string | null
  } | null
  holders: {
    status?: string | null
    topHolderPercent?: number | null
    top10HolderPercent?: number | null
  }
  rug: {
    score: number
    riskLevel: string
    verdict?: string | null
    reasons: Array<{
      code?: string
      label: string
      impact?: number
    }>
  }
  suggestedActions: string[]
  post: string | null
}

const CHAINS = [
  { label: 'Solana', value: 'solana' },
  { label: 'Base', value: '8453' },
  { label: 'Arbitrum', value: '42161' },
  { label: 'BSC', value: '56' },
]

function riskTone(level?: string) {
  const normalized = String(level || '').toLowerCase()
  if (normalized.includes('high') || normalized.includes('critical')) return 'text-destructive border-destructive/40 bg-destructive/10'
  if (normalized.includes('medium') || normalized.includes('watch')) return 'text-yellow-500 border-yellow-500/40 bg-yellow-500/10'
  return 'text-secondary border-secondary/40 bg-secondary/10'
}

function formatUsd(value?: number | null) {
  if (!value || !Number.isFinite(value)) return 'n/a'
  return value >= 1 ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : `$${value.toPrecision(4)}`
}

export default function RugScorerPage() {
  const [chainId, setChainId] = useState('solana')
  const [tokenAddress, setTokenAddress] = useState('')
  const [result, setResult] = useState<RugScoreResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runScan = async () => {
    const token = tokenAddress.trim()
    if (!token) {
      setError('Paste a token contract or address first.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/bantahbro/rug-score/${encodeURIComponent(chainId)}/${encodeURIComponent(token)}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || `Rug scan failed (${response.status})`)
      }
      setResult((await response.json()) as RugScoreResponse)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Rug scan failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 bg-card border border-border rounded overflow-hidden flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <span className="font-bold text-foreground">Rug Scorer</span>
          <span className="ml-auto text-xs text-muted-foreground">Standalone token safety scan</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="border border-border rounded bg-background p-4">
          <div className="text-sm font-bold text-foreground mb-1">Scan a token</div>
          <div className="text-xs text-muted-foreground mb-3">
            This page uses BantahBro's live rug-score API directly, separate from Chat Agent.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[11rem_1fr_auto] gap-2">
            <select
              value={chainId}
              onChange={(event) => setChainId(event.target.value)}
              className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
            >
              {CHAINS.map((chain) => (
                <option key={chain.value} value={chain.value}>{chain.label}</option>
              ))}
            </select>
            <input
              value={tokenAddress}
              onChange={(event) => setTokenAddress(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runScan()
              }}
              placeholder="Paste token address or contract..."
              className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              onClick={runScan}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              <Search size={15} />
              {isLoading ? 'Scanning...' : 'Run Score'}
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 rounded p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!result && !error && (
          <div className="border border-border rounded p-6 text-center text-muted-foreground">
            <div className="text-3xl mb-2">🛡️</div>
            <div className="text-sm font-bold text-foreground mb-1">Ready to score</div>
            <div className="text-xs">Paste a live token address to see rug risk, holder signals, liquidity, and suggested actions.</div>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
            <div className="border border-border rounded bg-background p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-bold">Token</div>
                  <div className="text-xl font-bold text-foreground">{result.tokenSymbol || result.tokenAddress.slice(0, 12)}</div>
                  <div className="text-xs text-muted-foreground break-all">{result.tokenAddress}</div>
                </div>
                <div className={`border rounded px-3 py-2 text-center ${riskTone(result.rug.riskLevel)}`}>
                  <div className="text-2xl font-bold">{result.rug.score}</div>
                  <div className="text-xs font-bold uppercase">{result.rug.riskLevel || 'Risk'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <div className="border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="text-sm font-bold text-foreground">{formatUsd(result.primaryPair?.priceUsd)}</div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground">Liquidity</div>
                  <div className="text-sm font-bold text-foreground">{formatUsd(result.primaryPair?.liquidityUsd)}</div>
                </div>
                <div className="border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground">Holder status</div>
                  <div className="text-sm font-bold text-foreground capitalize">{result.holders.status || 'n/a'}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-bold text-foreground">Risk reasons</div>
                {(result.rug.reasons || []).length > 0 ? (
                  result.rug.reasons.map((reason, index) => (
                    <div key={reason.code || `${reason.label}-${index}`} className="text-sm text-muted-foreground border border-border rounded p-2">
                      <div>{reason.label}</div>
                      {typeof reason.impact === 'number' && (
                        <div className="text-xs text-muted-foreground/80 mt-1">Impact: {reason.impact > 0 ? '+' : ''}{reason.impact}</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground border border-border rounded p-2">No risk reasons returned.</div>
                )}
              </div>
            </div>

            <div className="border border-border rounded bg-background p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-2">
                  <TrendingUp size={15} className="text-primary" />
                  Suggested actions
                </div>
                <div className="space-y-2">
                  {(result.suggestedActions || []).map((action) => (
                    <div key={action} className="text-xs text-muted-foreground border border-border rounded p-2">
                      {action}
                    </div>
                  ))}
                </div>
              </div>

              {result.post && (
                <div>
                  <div className="text-sm font-bold text-foreground mb-2">Generated alert copy</div>
                  <div className="text-xs text-muted-foreground whitespace-pre-line border border-border rounded p-3">
                    {result.post}
                  </div>
                </div>
              )}

              {result.primaryPair?.url && (
                <a
                  href={result.primaryPair.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs font-bold bg-muted text-foreground rounded px-3 py-2 hover:bg-muted/70"
                >
                  Open chart
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
