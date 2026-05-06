'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Loader2, Rocket, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiRequest, queryClient } from '@/lib/queryClient'

type LauncherChain = {
  chainId: number
  name: string
  networkId: string
  explorerBaseUrl: string
  factoryAddress: string | null
  configured: boolean
  envKey: string
}

type LauncherStatus = {
  mode: string
  deployRequiresAuth: boolean
  explicitConfirmationRequired: boolean
  chains: LauncherChain[]
}

type LaunchDraftResponse = {
  ok: boolean
  draft: {
    tokenName: string
    tokenSymbol: string
    chainId: number
    chainName: string
    networkId: string
    decimals: number
    ownerAddress: string | null
    initialSupply: string
    initialSupplyAtomic: string
    fixedSupply: boolean
    mintable: boolean
    factoryAddress: string | null
  }
  warnings: string[]
}

type TokenLaunch = {
  id: string
  chainId: number
  networkId: string
  tokenName: string
  tokenSymbol: string
  tokenAddress: string | null
  ownerAddress: string
  initialSupply: string
  deployTxHash: string | null
  status: 'pending' | 'deployed' | 'failed'
  errorMessage: string | null
  createdAt: string | null
  explorerTxUrl?: string | null
  explorerTokenUrl?: string | null
}

const DEFAULT_FORM = {
  tokenName: 'Bantah Launch Token',
  tokenSymbol: 'BLT',
  chainId: '84532',
  decimals: '18',
  initialSupply: '1000000000',
  ownerAddress: '',
}

function extractPrivyWallet(user: unknown) {
  const record = user && typeof user === 'object' ? (user as Record<string, any>) : {}
  const direct = record.wallet?.address || record.walletAddress || record.address
  if (typeof direct === 'string' && /^0x[a-fA-F0-9]{40}$/.test(direct)) return direct

  const linkedAccounts = Array.isArray(record.linkedAccounts) ? record.linkedAccounts : []
  const walletAccount = linkedAccounts.find((account) => {
    const type = String(account?.type || '').toLowerCase()
    return type.includes('wallet') && typeof account?.address === 'string'
  })
  return walletAccount?.address || ''
}

function compactAddress(value?: string | null) {
  if (!value) return '-'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function parseError(error: unknown) {
  if (!(error instanceof Error)) return 'Something went wrong.'
  const match = error.message.match(/\{"message":"([^"]+)"/)
  return match?.[1] || error.message
}

export default function LauncherPage() {
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [confirm, setConfirm] = useState(false)
  const [draft, setDraft] = useState<LaunchDraftResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const statusQuery = useQuery<LauncherStatus>({
    queryKey: ['/api/bantahbro/launcher/status'],
  })
  const launchesQuery = useQuery<{ launches: TokenLaunch[] }>({
    queryKey: ['/api/bantahbro/launcher/launches', { limit: '10' }],
    refetchInterval: 30000,
  })

  const selectedChain = useMemo(
    () => statusQuery.data?.chains.find((chain) => String(chain.chainId) === form.chainId),
    [form.chainId, statusQuery.data?.chains],
  )

  useEffect(() => {
    const wallet = extractPrivyWallet(user)
    if (wallet && !form.ownerAddress) {
      setForm((current) => ({ ...current, ownerAddress: wallet }))
    }
  }, [form.ownerAddress, user])

  const validateMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/bantahbro/launcher/validate', {
        ...form,
        chainId: Number(form.chainId),
        decimals: Number(form.decimals),
      }) as Promise<LaunchDraftResponse>,
    onSuccess: (data) => {
      setDraft(data)
      setError(null)
    },
    onError: (err) => {
      setDraft(null)
      setError(parseError(err))
    },
  })

  const deployMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/bantahbro/launcher/deploy', {
        ...form,
        chainId: Number(form.chainId),
        decimals: Number(form.decimals),
        confirm,
      }),
    onSuccess: (data: any) => {
      setDraft(null)
      setError(null)
      setConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['/api/bantahbro/launcher/launches'] })
      if (data?.tokenAddress) {
        setForm((current) => ({
          ...current,
          tokenName: '',
          tokenSymbol: '',
          initialSupply: current.initialSupply,
        }))
      }
    },
    onError: (err) => {
      setError(parseError(err))
    },
  })

  const canDeploy = Boolean(
    form.tokenName &&
      form.tokenSymbol &&
      form.ownerAddress &&
      form.initialSupply &&
      selectedChain?.configured &&
      confirm &&
      !deployMutation.isPending,
  )

  const updateField = (field: keyof typeof DEFAULT_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  return (
    <div className="flex-1 bg-card border border-border rounded overflow-hidden flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-primary" />
          <span className="font-bold text-foreground">Launcher</span>
          <span className="ml-auto text-xs text-muted-foreground">AgentKit token deployment</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
          <div className="border border-border rounded bg-background p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Rocket size={20} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">Launch a fixed-supply token</div>
                <div className="text-sm text-muted-foreground max-w-2xl">
                  BantahBro uses the system AgentKit wallet to call the launcher factory. The full supply mints to
                  the owner wallet you enter here.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Token name</span>
                <input
                  value={form.tokenName}
                  onChange={(event) => updateField('tokenName', event.target.value)}
                  placeholder="Bantah Meme"
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Symbol</span>
                <input
                  value={form.tokenSymbol}
                  onChange={(event) => updateField('tokenSymbol', event.target.value.toUpperCase())}
                  placeholder="BANT"
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Chain</span>
                <select
                  value={form.chainId}
                  onChange={(event) => updateField('chainId', event.target.value)}
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {(statusQuery.data?.chains || []).map((chain) => (
                    <option key={chain.chainId} value={chain.chainId}>
                      {chain.name} {chain.configured ? '' : '(factory needed)'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Decimals</span>
                <input
                  type="number"
                  min="0"
                  max="18"
                  value={form.decimals}
                  onChange={(event) => updateField('decimals', event.target.value)}
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-bold text-muted-foreground">Initial supply</span>
                <input
                  value={form.initialSupply}
                  onChange={(event) => updateField('initialSupply', event.target.value)}
                  placeholder="1000000000"
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-bold text-muted-foreground">Owner wallet</span>
                <input
                  value={form.ownerAddress}
                  onChange={(event) => updateField('ownerAddress', event.target.value)}
                  placeholder="0x..."
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => validateMutation.mutate()}
                disabled={validateMutation.isPending}
                className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm font-bold hover:border-primary disabled:opacity-50"
              >
                {validateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Validate draft
              </button>

              {!isAuthenticated && !authLoading ? (
                <button
                  onClick={() => login()}
                  className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                >
                  <Wallet size={15} />
                  Log in to deploy
                </button>
              ) : (
                <button
                  onClick={() => deployMutation.mutate()}
                  disabled={!canDeploy}
                  className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
                >
                  {deployMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                  Deploy token
                </button>
              )}
            </div>

            <label className="mt-4 flex items-start gap-2 rounded border border-border bg-card p-3 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm this will deploy a real token contract on {selectedChain?.name || 'the selected chain'} and
                mint the full supply to the owner wallet above.
              </span>
            </label>

            {error ? (
              <div className="mt-3 flex gap-2 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {draft ? (
              <div className="mt-3 rounded border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  {draft.ok ? <CheckCircle2 size={15} className="text-green-500" /> : <TriangleAlert size={15} className="text-yellow-500" />}
                  Draft summary
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Name: <span className="text-foreground">{draft.draft.tokenName}</span></div>
                  <div>Symbol: <span className="text-foreground">{draft.draft.tokenSymbol}</span></div>
                  <div>Chain: <span className="text-foreground">{draft.draft.chainName}</span></div>
                  <div>Supply: <span className="text-foreground">{draft.draft.initialSupply}</span></div>
                  <div>Owner: <span className="text-foreground">{compactAddress(draft.draft.ownerAddress)}</span></div>
                  <div>Factory: <span className="text-foreground">{compactAddress(draft.draft.factoryAddress)}</span></div>
                </div>
                {draft.warnings.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-yellow-500">
                    {draft.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="border border-border rounded bg-background p-4">
              <div className="text-sm font-bold text-foreground mb-2">Launch rails</div>
              <div className="space-y-2">
                {(statusQuery.data?.chains || []).map((chain) => (
                  <div key={chain.chainId} className="rounded border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-foreground">{chain.name}</div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          chain.configured ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                        }`}
                      >
                        {chain.configured ? 'READY' : 'NEEDS FACTORY'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{chain.networkId}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground break-all">
                      {chain.factoryAddress || chain.envKey}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border rounded bg-background p-4">
              <div className="text-sm font-bold text-foreground mb-2">Safety defaults</div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  Fixed supply, no hidden mint function.
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  Supply goes directly to the owner wallet.
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  Explicit confirmation required before deploy.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border rounded bg-background p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-bold text-foreground">Recent launches</div>
            {launchesQuery.isFetching ? <Loader2 size={14} className="animate-spin text-muted-foreground" /> : null}
          </div>

          <div className="space-y-2">
            {(launchesQuery.data?.launches || []).length === 0 ? (
              <div className="rounded border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                No BantahBro token launches recorded yet.
              </div>
            ) : (
              launchesQuery.data?.launches.map((launch) => (
                <div key={launch.id} className="rounded border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-foreground">{launch.tokenName}</div>
                    <div className="text-xs text-muted-foreground">${launch.tokenSymbol}</div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        launch.status === 'deployed'
                          ? 'bg-green-500/10 text-green-500'
                          : launch.status === 'failed'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-yellow-500/10 text-yellow-500'
                      }`}
                    >
                      {launch.status.toUpperCase()}
                    </span>
                    <div className="ml-auto flex items-center gap-2 text-xs">
                      {launch.explorerTokenUrl ? (
                        <a className="inline-flex items-center gap-1 text-primary" href={launch.explorerTokenUrl} target="_blank" rel="noreferrer">
                          Token <ExternalLink size={12} />
                        </a>
                      ) : null}
                      {launch.explorerTxUrl ? (
                        <a className="inline-flex items-center gap-1 text-primary" href={launch.explorerTxUrl} target="_blank" rel="noreferrer">
                          Tx <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Supply {launch.initialSupply} · Owner {compactAddress(launch.ownerAddress)} · {launch.networkId}
                  </div>
                  {launch.errorMessage ? (
                    <div className="mt-1 text-xs text-red-400">{launch.errorMessage}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
