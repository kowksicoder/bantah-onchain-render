'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Bot,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  Eye,
  Loader2,
  Radio,
  Rocket,
  ShieldCheck,
  Swords,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiRequest, queryClient } from '@/lib/queryClient'

type LauncherTab = 'token' | 'battle'

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

type BxbtStatusResponse = {
  configured: boolean
  marketCreationCost: string
  boostUnitCost: string
  rewardAmount: string
}

const DEFAULT_FORM = {
  tokenName: 'Bantah Launch Token',
  tokenSymbol: 'BLT',
  chainId: '84532',
  decimals: '18',
  initialSupply: '1000000000',
  ownerAddress: '',
}

const DEFAULT_BATTLE_FORM = {
  battleType: 'Meme Coin Battle',
  tokenA: 'PEPE',
  tokenB: 'WOJAK',
  tokenAChain: 'Solana',
  tokenBChain: 'Solana',
  duration: '5 Minutes',
  winnerRule: 'Highest % Price Gain',
  stakeCurrency: 'BXBT',
  minStake: '10',
  maxStake: '500',
  bettingCutoff: '60',
  hostingPackage: 'Standard',
  paymentCurrency: 'BXBT',
  notes: '',
}

const battleTypes = ['Meme Coin Battle', 'Agent Token Battle', 'Prediction Battle', 'Sponsored Battle']
const battleChains = ['Solana', 'Base', 'Ethereum later']
const battleDurations = ['5 Minutes', '15 Minutes', '30 Minutes', '1 Hour', '24 Hours']
const winnerRules = ['Highest % Price Gain', 'Highest Buy Pressure', 'Highest Volume Growth', 'Best Composite Score']
const stakeCurrencies = ['BXBT', 'SOL', 'USDC']
const hostingPackages = [
  { name: 'Free', fee: '0 BXBT', detail: 'Basic visibility' },
  { name: 'Standard', fee: '10 BXBT', detail: 'Normal public battle' },
  { name: 'Premium', fee: '50 BXBT', detail: 'Featured + alerts' },
  { name: 'Sponsored', fee: 'Custom', detail: 'Homepage campaign + custom arena' },
]
const battleFlowStages = [
  'Host creates battle',
  'Battle published',
  'Betting phase',
  'Live battle phase',
  'Battle ends',
  'Settlement & payout',
  'After battle',
]

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

function cleanSymbol(value: string) {
  return value.trim().replace(/^\$/, '').toUpperCase() || 'TOKEN'
}

function getHostingFee(packageName: string, bxbtStatus?: BxbtStatusResponse) {
  if (packageName === 'Sponsored') return 'Custom'
  if (packageName === 'Free') return '0 BXBT'

  const boostUnit = Number.parseFloat(bxbtStatus?.boostUnitCost || '')
  if (Number.isFinite(boostUnit) && boostUnit > 0) {
    const units = packageName === 'Premium' ? 50 : 10
    return `${(boostUnit * units).toLocaleString(undefined, { maximumFractionDigits: 2 })} BXBT`
  }

  return hostingPackages.find((item) => item.name === packageName)?.fee || 'Confirm with team'
}

function BattleHostingForm({
  form,
  onChange,
  draftCreated,
  onCreateDraft,
  bxbtStatus,
}: {
  form: typeof DEFAULT_BATTLE_FORM
  onChange: (field: keyof typeof DEFAULT_BATTLE_FORM, value: string) => void
  draftCreated: boolean
  onCreateDraft: () => void
  bxbtStatus?: BxbtStatusResponse
}) {
  const tokenA = cleanSymbol(form.tokenA)
  const tokenB = cleanSymbol(form.tokenB)
  const hostingFee = getHostingFee(form.hostingPackage, bxbtStatus)
  const cutoffLabel = `${form.bettingCutoff}% of battle duration`

  return (
    <div className="space-y-4">
      <section className="border border-border rounded bg-background overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_24rem]">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Swords size={21} />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black text-foreground">Create Battle Hosting Draft</div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground leading-relaxed">
                  Hosts configure the arena and rules. Outcome is driven by real market data plus P2P betting, not by the host.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: 'Host', icon: Users, body: 'Creates battle' },
                { label: 'Bettor', icon: Coins, body: 'Places bet' },
                { label: 'Spectator', icon: Eye, body: 'Watches + chats' },
                { label: 'Trader', icon: Radio, body: 'Moves market' },
              ].map((role) => (
                <div key={role.label} className="rounded border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-xs font-black text-primary">
                    <role.icon size={14} />
                    {role.label}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{role.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t xl:border-l xl:border-t-0 border-border bg-muted/20 p-4">
            <div className="rounded border border-border bg-card p-4 h-full">
              <div className="text-xs font-black uppercase tracking-wide text-muted-foreground">Battle Preview</div>
              <div className="mt-3 rounded border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-black text-secondary truncate">{tokenA} Army</div>
                    <div className="text-xs text-muted-foreground">{form.tokenAChain}</div>
                  </div>
                  <div className="text-2xl font-black text-primary">VS</div>
                  <div className="min-w-0 text-right">
                    <div className="text-lg font-black text-destructive truncate">{tokenB} Army</div>
                    <div className="text-xs text-muted-foreground">{form.tokenBChain}</div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full overflow-hidden bg-muted flex">
                  <div className="h-full w-1/2 bg-secondary" />
                  <div className="h-full w-1/2 bg-destructive" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted/40 p-2">
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-bold text-foreground">{form.duration}</div>
                  </div>
                  <div className="rounded bg-muted/40 p-2">
                    <div className="text-muted-foreground">Stake</div>
                    <div className="font-bold text-foreground">{form.minStake}-{form.maxStake} {form.stakeCurrency}</div>
                  </div>
                  <div className="rounded bg-muted/40 p-2 col-span-2">
                    <div className="text-muted-foreground">Winner rule</div>
                    <div className="font-bold text-foreground">{form.winnerRule}</div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCreateDraft}
                className="mt-3 w-full rounded bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
              >
                Create Battle Draft
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="border border-border rounded bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
                Choose Battle Type
              </div>
              <div className="grid gap-2">
                {battleTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onChange('battleType', type)}
                    className={`rounded border px-3 py-2 text-left text-sm font-bold transition ${
                      form.battleType === type ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border rounded bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                Add Token A
              </div>
              <div className="space-y-3">
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-muted-foreground">Search or paste token / pair</span>
                  <input
                    value={form.tokenA}
                    onChange={(event) => onChange('tokenA', event.target.value)}
                    placeholder="PEPE"
                    className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-muted-foreground">Chain</span>
                  <select
                    value={form.tokenAChain}
                    onChange={(event) => onChange('tokenAChain', event.target.value)}
                    className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {battleChains.map((chain) => <option key={chain}>{chain}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="border border-border rounded bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
                Add Token B
              </div>
              <div className="space-y-3">
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-muted-foreground">Search or paste token / pair</span>
                  <input
                    value={form.tokenB}
                    onChange={(event) => onChange('tokenB', event.target.value)}
                    placeholder="WOJAK"
                    className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-muted-foreground">Chain</span>
                  <select
                    value={form.tokenBChain}
                    onChange={(event) => onChange('tokenBChain', event.target.value)}
                    className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {battleChains.map((chain) => <option key={chain}>{chain}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="border border-border rounded bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">4</span>
              Set Battle Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Duration</span>
                <select value={form.duration} onChange={(event) => onChange('duration', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary">
                  {battleDurations.map((duration) => <option key={duration}>{duration}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Winner rule</span>
                <select value={form.winnerRule} onChange={(event) => onChange('winnerRule', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary">
                  {winnerRules.map((rule) => <option key={rule}>{rule}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Stake currency</span>
                <select value={form.stakeCurrency} onChange={(event) => onChange('stakeCurrency', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary">
                  {stakeCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Minimum stake</span>
                <input value={form.minStake} onChange={(event) => onChange('minStake', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Maximum stake</span>
                <input value={form.maxStake} onChange={(event) => onChange('maxStake', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Betting cutoff (%)</span>
                <input value={form.bettingCutoff} onChange={(event) => onChange('bettingCutoff', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-border rounded bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">5</span>
                Battle Preview Checklist
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                {[
                  `${tokenA} vs ${tokenB} battle cards`,
                  `${form.duration} arena timer`,
                  `${form.winnerRule} winner rule`,
                  `${form.stakeCurrency} stake rails, ${cutoffLabel} cutoff`,
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded border border-border bg-card p-2">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border rounded bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">6</span>
                Pay Hosting Fee
              </div>
              <div className="grid grid-cols-2 gap-2">
                {hostingPackages.map((pack) => {
                  const active = form.hostingPackage === pack.name
                  return (
                    <button
                      key={pack.name}
                      type="button"
                      onClick={() => onChange('hostingPackage', pack.name)}
                      className={`rounded border p-2 text-left transition ${active ? 'border-primary bg-primary/15' : 'border-border bg-card hover:border-primary/50'}`}
                    >
                      <div className="text-xs font-black text-foreground">{pack.name}</div>
                      <div className="text-[11px] text-muted-foreground">{pack.detail}</div>
                      <div className="mt-1 text-xs font-black text-primary">{getHostingFee(pack.name, bxbtStatus)}</div>
                    </button>
                  )
                })}
              </div>
              <label className="mt-3 block space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Payment currency</span>
                <select value={form.paymentCurrency} onChange={(event) => onChange('paymentCurrency', event.target.value)} className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary">
                  {stakeCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="border border-border rounded bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-black text-foreground mb-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">7</span>
              Battle Created Output
            </div>
            <div className="rounded border border-border bg-card p-3">
              <div className="text-xs font-bold text-muted-foreground">Draft battle ID</div>
              <div className="mt-1 text-lg font-black text-primary">{draftCreated ? '#BB-DRAFT' : 'Create draft first'}</div>
              <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Publishing later generates the live battle page, Telegram card, X card, Blink action, and escrow setup.
              </div>
            </div>
          </div>

          <div className="border border-border rounded bg-background p-4">
            <div className="text-sm font-black text-foreground mb-3">End-to-end flow</div>
            <div className="space-y-2">
              {battleFlowStages.map((stage, index) => (
                <div key={stage} className="flex items-center gap-2 text-xs">
                  <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">{String.fromCharCode(65 + index)}</span>
                  <span className="text-muted-foreground">{stage}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded bg-background p-4">
            <div className="text-sm font-black text-foreground mb-3">Key principles</div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2"><ShieldCheck size={14} className="text-green-500 shrink-0" /> Users bet P2P, not against Bantah.</div>
              <div className="flex gap-2"><Radio size={14} className="text-primary shrink-0" /> Real market data drives the arena.</div>
              <div className="flex gap-2"><Bot size={14} className="text-primary shrink-0" /> AI commentary and TrollBox make it social.</div>
              <div className="flex gap-2"><Clock3 size={14} className="text-primary shrink-0" /> Cutoff prevents last-second sniping.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function CompactBattleHostingForm({
  form,
  onChange,
  draftCreated,
  onCreateDraft,
  bxbtStatus,
}: {
  form: typeof DEFAULT_BATTLE_FORM
  onChange: (field: keyof typeof DEFAULT_BATTLE_FORM, value: string) => void
  draftCreated: boolean
  onCreateDraft: () => void
  bxbtStatus?: BxbtStatusResponse
}) {
  const tokenA = cleanSymbol(form.tokenA)
  const tokenB = cleanSymbol(form.tokenB)
  const hostingFee = getHostingFee(form.hostingPackage, bxbtStatus)

  const Field = ({
    label,
    children,
  }: {
    label: string
    children: ReactNode
  }) => (
    <label className="block space-y-1">
      <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  )

  const inputClass = 'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'

  return (
    <div className="bb-pop-in grid grid-cols-1 gap-3 xl:grid-cols-[1fr_19rem]">
      <section className="rounded-2xl border border-border bg-background p-3 md:p-4">
        <div className="flex items-start gap-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Swords size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-foreground md:text-xl">Battle Hosting Draft</div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Set the pair, duration, stakes, and package. Advanced rules stay tucked away.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Token A">
            <input value={form.tokenA} onChange={(event) => onChange('tokenA', event.target.value)} placeholder="PEPE" className={inputClass} />
          </Field>
          <Field label="Token B">
            <input value={form.tokenB} onChange={(event) => onChange('tokenB', event.target.value)} placeholder="WOJAK" className={inputClass} />
          </Field>
          <Field label="Battle Type">
            <select value={form.battleType} onChange={(event) => onChange('battleType', event.target.value)} className={inputClass}>
              {battleTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Duration">
            <select value={form.duration} onChange={(event) => onChange('duration', event.target.value)} className={inputClass}>
              {battleDurations.map((duration) => <option key={duration}>{duration}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">Hosting Package</div>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {hostingPackages.map((pack) => {
              const active = form.hostingPackage === pack.name
              return (
                <button
                  key={pack.name}
                  type="button"
                  onClick={() => onChange('hostingPackage', pack.name)}
                  className={`bb-lift rounded-xl border px-2 py-2 text-left ${
                    active ? 'border-primary bg-primary/15 shadow-[0_0_18px_rgba(124,58,237,.12)]' : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div className="text-xs font-black text-foreground">{pack.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{pack.detail}</div>
                  <div className="mt-1 text-[11px] font-black text-primary">{getHostingFee(pack.name, bxbtStatus)}</div>
                </button>
              )
            })}
          </div>
        </div>

        <details className="group mt-3 rounded-xl border border-border bg-card">
          <summary className="bb-tap flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-black uppercase text-foreground">
            Advanced Rules
            <ChevronDown size={14} className="transition group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-2 gap-2 border-t border-border p-3 md:grid-cols-3">
            <Field label="Token A Chain">
              <select value={form.tokenAChain} onChange={(event) => onChange('tokenAChain', event.target.value)} className={inputClass}>
                {battleChains.map((chain) => <option key={chain}>{chain}</option>)}
              </select>
            </Field>
            <Field label="Token B Chain">
              <select value={form.tokenBChain} onChange={(event) => onChange('tokenBChain', event.target.value)} className={inputClass}>
                {battleChains.map((chain) => <option key={chain}>{chain}</option>)}
              </select>
            </Field>
            <Field label="Winner Rule">
              <select value={form.winnerRule} onChange={(event) => onChange('winnerRule', event.target.value)} className={inputClass}>
                {winnerRules.map((rule) => <option key={rule}>{rule}</option>)}
              </select>
            </Field>
            <Field label="Stake">
              <select value={form.stakeCurrency} onChange={(event) => onChange('stakeCurrency', event.target.value)} className={inputClass}>
                {stakeCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
              </select>
            </Field>
            <Field label="Min / Max">
              <div className="grid grid-cols-2 gap-1">
                <input value={form.minStake} onChange={(event) => onChange('minStake', event.target.value)} className={inputClass} />
                <input value={form.maxStake} onChange={(event) => onChange('maxStake', event.target.value)} className={inputClass} />
              </div>
            </Field>
            <Field label="Cutoff %">
              <input value={form.bettingCutoff} onChange={(event) => onChange('bettingCutoff', event.target.value)} className={inputClass} />
            </Field>
          </div>
        </details>

        <button
          type="button"
          onClick={onCreateDraft}
          className="bb-tap mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-black text-primary-foreground shadow-sm"
        >
          <Swords size={15} />
          Create Battle Draft
        </button>
      </section>

      <aside className="space-y-3">
        <div className="bb-pop-in rounded-2xl border border-border bg-background p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Preview</div>
          <div className="mt-2 rounded-xl bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-green-500">{tokenA} Army</div>
                <div className="text-[11px] text-muted-foreground">{form.tokenAChain}</div>
              </div>
              <div className="rounded-full bg-primary/15 px-2 py-1 text-xs font-black text-primary">VS</div>
              <div className="min-w-0 text-right">
                <div className="truncate text-sm font-black text-red-500">{tokenB} Army</div>
                <div className="text-[11px] text-muted-foreground">{form.tokenBChain}</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 bg-green-500" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded-xl bg-card p-2">
              <div className="text-muted-foreground">Duration</div>
              <div className="font-black text-foreground">{form.duration}</div>
            </div>
            <div className="rounded-xl bg-card p-2">
              <div className="text-muted-foreground">Stake</div>
              <div className="font-black text-foreground">{form.minStake}-{form.maxStake} {form.stakeCurrency}</div>
            </div>
            <div className="col-span-2 rounded-xl bg-card p-2">
              <div className="text-muted-foreground">Hosting fee</div>
              <div className="font-black text-primary">{hostingFee}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Draft Output</div>
          <div className="mt-2 text-lg font-black text-primary">{draftCreated ? '#BB-DRAFT' : 'Not created yet'}</div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Publishing later wires the public page, socials, Blink action, and escrow setup.
          </p>
        </div>
      </aside>
    </div>
  )
}

export default function LauncherPage() {
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth()
  const [activeTab, setActiveTab] = useState<LauncherTab>('token')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [battleForm, setBattleForm] = useState(DEFAULT_BATTLE_FORM)
  const [battleDraftCreated, setBattleDraftCreated] = useState(false)
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
  const bxbtStatusQuery = useQuery<BxbtStatusResponse>({
    queryKey: ['/api/bantahbro/bxbt/status'],
    staleTime: 60_000,
    refetchInterval: 60_000,
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

  const updateBattleField = (field: keyof typeof DEFAULT_BATTLE_FORM, value: string) => {
    setBattleForm((current) => ({ ...current, [field]: value }))
    setBattleDraftCreated(false)
  }

  return (
    <div className="flex-1 bg-card border border-border rounded overflow-hidden flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-primary" />
          <span className="font-bold text-foreground">Launcher</span>
          <span className="ml-auto text-xs text-muted-foreground">Token launch + battle hosting</span>
        </div>
      </div>
      <div className="border-b border-border bg-card px-3 py-2 shrink-0">
        <div className="grid grid-cols-2 gap-1 rounded border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setActiveTab('token')}
            className={`bb-tap rounded px-3 py-2 text-sm font-black transition ${
              activeTab === 'token' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            Launch Token
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('battle')}
            className={`bb-tap rounded px-3 py-2 text-sm font-black transition ${
              activeTab === 'battle' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            Battle Hosting
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'token' ? (
          <>
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
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Symbol</span>
                <input
                  value={form.tokenSymbol}
                  onChange={(event) => updateField('tokenSymbol', event.target.value.toUpperCase())}
                  placeholder="BANT"
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Chain</span>
                <select
                  value={form.chainId}
                  onChange={(event) => updateField('chainId', event.target.value)}
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
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
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-bold text-muted-foreground">Initial supply</span>
                <input
                  value={form.initialSupply}
                  onChange={(event) => updateField('initialSupply', event.target.value)}
                  placeholder="1000000000"
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-bold text-muted-foreground">Owner wallet</span>
                <input
                  value={form.ownerAddress}
                  onChange={(event) => updateField('ownerAddress', event.target.value)}
                  placeholder="0x..."
                  className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
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
          </>
        ) : (
          <CompactBattleHostingForm
            form={battleForm}
            onChange={updateBattleField}
            draftCreated={battleDraftCreated}
            onCreateDraft={() => setBattleDraftCreated(true)}
            bxbtStatus={bxbtStatusQuery.data}
          />
        )}
      </div>
    </div>
  )
}
