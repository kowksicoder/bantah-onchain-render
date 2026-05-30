'use client'

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Coins,
  Eye,
  Radio,
  Rocket,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react'

type BxbtStatusResponse = {
  configured: boolean
  marketCreationCost: string
  boostUnitCost: string
  rewardAmount: string
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
  const [battleForm, setBattleForm] = useState(DEFAULT_BATTLE_FORM)
  const [battleDraftCreated, setBattleDraftCreated] = useState(false)

  const bxbtStatusQuery = useQuery<BxbtStatusResponse>({
    queryKey: ['/api/bantahbro/bxbt/status'],
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

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
          <span className="ml-auto text-xs text-muted-foreground">Battle hosting</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <CompactBattleHostingForm
          form={battleForm}
          onChange={updateBattleField}
          draftCreated={battleDraftCreated}
          onCreateDraft={() => setBattleDraftCreated(true)}
          bxbtStatus={bxbtStatusQuery.data}
        />
      </div>
    </div>
  )
}