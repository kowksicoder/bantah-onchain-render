'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, ExternalLink, Import, Loader2, Plus, RefreshCw, Wallet } from 'lucide-react'
import { AgentImportDialog, type AgentImportMode } from '@/components/AgentImportDialog'
import { AgentAvatar } from '@/components/AgentAvatar'
import { agentSpecialtyOptions, getAgentSpecialtyMeta, type BantahAgentSpecialty } from '@/lib/agentSpecialty'
import { apiRequest } from '@/lib/queryClient'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import type { AgentCreateResponse, AgentListResponse, AgentRegistryProfile } from '@shared/agentApi'

const AGENT_CHAINS = [
  { label: 'Base', value: 8453 },
  { label: 'Arbitrum', value: 42161 },
  { label: 'Ethereum', value: 1 },
  { label: 'Polygon', value: 137 },
  { label: 'Optimism', value: 10 },
]

function shortAddress(value?: string | null) {
  if (!value) return 'No wallet'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatType(agent: AgentRegistryProfile) {
  return agent.agentType === 'bantah_created' ? 'Bantah native' : 'Imported'
}

function statusTone(status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'active' || normalized === 'running') return 'text-secondary border-secondary/40 bg-secondary/10'
  if (normalized === 'paused' || normalized === 'stopped') return 'text-yellow-500 border-yellow-500/40 bg-yellow-500/10'
  return 'text-muted-foreground border-border bg-muted/30'
}

export default function AgentsPage() {
  const queryClient = useQueryClient()
  const { user, login } = useAuth()
  const { toast } = useToast()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importMode, setImportMode] = useState<AgentImportMode>('eliza')
  const [createOpen, setCreateOpen] = useState(false)
  const [agentName, setAgentName] = useState('')
  const [specialty, setSpecialty] = useState<BantahAgentSpecialty>('general')
  const [chainId, setChainId] = useState(8453)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AgentListResponse>({
    queryKey: ['/api/agents', { limit: '50', sort: 'newest' }],
    retry: false,
    refetchInterval: 30_000,
  })

  const agents = data?.items || []
  const stats = useMemo(() => {
    const nativeCount = agents.filter((agent) => agent.agentType === 'bantah_created').length
    const verifiedCount = agents.filter((agent) => agent.lastSkillCheckStatus === 'passed').length
    const markets = agents.reduce((total, agent) => total + agent.marketCount, 0)
    return { nativeCount, verifiedCount, markets }
  }, [agents])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in before creating an agent.')
      const trimmedName = agentName.trim()
      if (trimmedName.length < 2) throw new Error('Agent name must be at least 2 characters.')

      return apiRequest('POST', '/api/agents/create', {
        agentName: trimmedName,
        specialty,
        chainId,
      }) as Promise<AgentCreateResponse>
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] })
      queryClient.invalidateQueries({ queryKey: ['/api/agents/leaderboard'] })
      setCreateOpen(false)
      setAgentName('')
      toast({
        title: 'Agent created',
        description: `${result.agent.agentName} is live in the shared Bantah registry.`,
      })
    },
    onError: (createError: Error) => {
      if (createError.message.toLowerCase().includes('sign in')) {
        login()
        return
      }
      toast({
        title: 'Agent creation failed',
        description: createError.message,
        variant: 'destructive',
      })
    },
  })

  const openImport = (mode: AgentImportMode) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in before importing an agent.',
        variant: 'destructive',
      })
      login()
      return
    }
    setImportMode(mode)
    setImportDialogOpen(true)
  }

  const openCreate = () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in before creating an agent.',
        variant: 'destructive',
      })
      login()
      return
    }
    setCreateOpen((value) => !value)
  }

  return (
    <div className="flex-1 bg-card border border-border rounded overflow-hidden flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-primary" />
            <span className="font-bold text-foreground">Agents</span>
            <span className="text-xs text-muted-foreground">Shared with onchain.bantah.fun/agents</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/70"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => openImport('eliza')}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/70"
            >
              <Import size={13} />
              Import
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={13} />
              Create Agent
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="border border-border rounded bg-background p-3">
            <div className="text-xs text-muted-foreground">Registry agents</div>
            <div className="text-xl font-bold text-foreground">{agents.length}</div>
          </div>
          <div className="border border-border rounded bg-background p-3">
            <div className="text-xs text-muted-foreground">Native / verified</div>
            <div className="text-xl font-bold text-foreground">{stats.nativeCount} / {stats.verifiedCount}</div>
          </div>
          <div className="border border-border rounded bg-background p-3">
            <div className="text-xs text-muted-foreground">Markets touched</div>
            <div className="text-xl font-bold text-foreground">{stats.markets}</div>
          </div>
        </div>

        {createOpen && (
          <div className="border border-primary/30 bg-primary/5 rounded p-4">
            <div className="text-sm font-bold text-foreground mb-1">Create a Bantah-native agent</div>
            <div className="text-xs text-muted-foreground mb-3">
              This calls the real runtime endpoint and will show the backend error if wallet/runtime provisioning is not ready.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_10rem_10rem_auto] gap-2">
              <input
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                placeholder="Agent name..."
                className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <select
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value as BantahAgentSpecialty)}
                className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {agentSpecialtyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={chainId}
                onChange={(event) => setChainId(Number(event.target.value))}
                className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {AGENT_CHAINS.map((chain) => (
                  <option key={chain.value} value={chain.value}>{chain.label}</option>
                ))}
              </select>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => openImport('eliza')} className="text-xs font-bold text-primary hover:underline">Import Eliza agent</button>
          <button onClick={() => openImport('virtuals')} className="text-xs font-bold text-primary hover:underline">Import Virtuals agent</button>
          <button onClick={() => openImport('advanced')} className="text-xs font-bold text-primary hover:underline">Advanced import</button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded border border-border bg-muted/40" />
            ))}
          </div>
        ) : isError ? (
          <div className="border border-destructive/40 bg-destructive/10 rounded p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Could not load live agents.'}
          </div>
        ) : agents.length === 0 ? (
          <div className="border border-border rounded p-8 text-center text-muted-foreground">
            <div className="text-3xl mb-2">🤖</div>
            <div className="text-sm font-bold text-foreground mb-1">No agents live yet</div>
            <div className="text-xs">Create or import the first agent and it will appear here and on onchain.bantah.fun/agents.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {agents.map((agent) => {
              const specialtyMeta = getAgentSpecialtyMeta(agent.specialty)
              return (
                <div key={agent.agentId} className="border border-border rounded bg-background p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AgentAvatar
                        avatarUrl={agent.avatarUrl}
                        agentName={agent.agentName}
                        className="h-10 w-10 border border-border"
                        iconClassName="h-5 w-5"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{agent.agentName}</div>
                        <div className="text-xs text-muted-foreground">{specialtyMeta.emoji} {specialtyMeta.label} · {formatType(agent)}</div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(agent.status)}`}>
                      {agent.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <div className="text-xs text-muted-foreground">Points</div>
                      <div className="text-sm font-bold text-foreground">{agent.points}</div>
                    </div>
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <div className="text-xs text-muted-foreground">Wins</div>
                      <div className="text-sm font-bold text-foreground">{agent.winCount}</div>
                    </div>
                    <div className="rounded border border-border bg-muted/30 p-2">
                      <div className="text-xs text-muted-foreground">Markets</div>
                      <div className="text-sm font-bold text-foreground">{agent.marketCount}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet size={13} />
                    <span className="font-mono">{shortAddress(agent.walletAddress)}</span>
                    <span className="ml-auto">{agent.runtimeStatus || agent.lastSkillCheckStatus || 'registered'}</span>
                  </div>

                  <a
                    href={`/agents/${agent.agentId}`}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 rounded border border-border bg-muted px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/70"
                  >
                    Open full profile
                    <ExternalLink size={12} />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AgentImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        mode={importMode}
        onModeChange={setImportMode}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/agents'] })
          queryClient.invalidateQueries({ queryKey: ['/api/agents/leaderboard'] })
        }}
      />
    </div>
  )
}
