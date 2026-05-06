'use client'

import {
  ArrowUpRight,
  BadgeDollarSign,
  Handshake,
  Megaphone,
  MessageSquare,
  Monitor,
  PanelRight,
  Send,
  TrendingUp,
  Twitter,
} from 'lucide-react'

const stats = [
  { label: 'Starter slots', value: 'From $99' },
  { label: 'Ad surfaces', value: '5 live areas' },
  { label: 'Audience', value: 'Crypto degens' },
  { label: 'Contact', value: '@bantahfun' },
]

const placements = [
  {
    icon: TrendingUp,
    title: 'Hot ticker slot',
    body: 'Top bar visibility while traders scan live prices.',
    tag: 'Ticker',
    highlight: 'top',
  },
  {
    icon: PanelRight,
    title: 'Sidebar feature',
    body: 'Persistent coin placement in the BantahBro terminal rail.',
    tag: 'Sidebar',
    highlight: 'side',
  },
  {
    icon: Monitor,
    title: 'Market spotlight',
    body: 'Featured promo inside markets and prediction flows.',
    tag: 'Markets',
    highlight: 'market',
  },
  {
    icon: MessageSquare,
    title: 'Feed boost',
    body: 'Sponsored post placement in the activity feed.',
    tag: 'Feed',
    highlight: 'feed',
  },
]

const partnerships = [
  { title: 'Launch partners', body: 'Co-market new tokens, agents, prediction markets, and community campaigns.' },
  { title: 'Media partners', body: 'Bring BantahBro placements into newsletters, Telegram rooms, X Spaces, and trading communities.' },
  { title: 'Ecosystem partners', body: 'Collaborate across chains, launchpads, DEX tools, market data, and creator networks.' },
]

function TerminalPreview({ highlight }: { highlight: string }) {
  return (
    <div className="rounded border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-2">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-yellow-500/70" />
        <span className="size-2 rounded-full bg-secondary/70" />
        <span className="ml-auto text-[10px] font-bold text-muted-foreground uppercase">BantahBro terminal</span>
      </div>

      <div className="p-3 space-y-2">
        <div className={`h-6 rounded border ${highlight === 'top' ? 'border-primary bg-primary/20' : 'border-border bg-muted/30'}`} />
        <div className="grid grid-cols-[3.25rem_1fr_4.5rem] gap-2 min-h-36">
          <div className={`rounded border ${highlight === 'side' ? 'border-primary bg-primary/20' : 'border-border bg-muted/20'} p-1.5 space-y-1`}>
            <div className="h-2 rounded bg-foreground/15" />
            <div className="h-2 rounded bg-foreground/10" />
            <div className="h-2 rounded bg-foreground/10" />
            <div className={`mt-5 h-12 rounded ${highlight === 'side' ? 'bg-primary/40' : 'bg-foreground/10'}`} />
          </div>
          <div className={`rounded border ${highlight === 'market' || highlight === 'feed' ? 'border-primary bg-primary/15' : 'border-border bg-background'} p-2 space-y-2`}>
            <div className="h-3 w-2/3 rounded bg-foreground/20" />
            <div className="grid grid-cols-3 gap-1">
              <div className="h-10 rounded bg-muted/50" />
              <div className="h-10 rounded bg-muted/50" />
              <div className="h-10 rounded bg-muted/50" />
            </div>
            <div className={`h-14 rounded ${highlight === 'feed' ? 'bg-primary/30' : 'bg-muted/40'}`} />
            <div className={`h-8 rounded ${highlight === 'market' ? 'bg-primary/30' : 'bg-muted/40'}`} />
          </div>
          <div className="rounded border border-border bg-muted/20 p-1.5 space-y-1">
            <div className="h-8 rounded bg-foreground/10" />
            <div className="h-8 rounded bg-foreground/10" />
            <div className="h-8 rounded bg-foreground/10" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdsPage() {
  return (
    <div className="flex-1 bg-card border border-border rounded overflow-hidden flex flex-col">
      <div className="border-b border-border bg-background px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Megaphone size={18} className="text-primary" />
          <span className="font-bold text-foreground">Ads Placement</span>
          <span className="ml-auto text-xs text-muted-foreground">Promote your coin on BantahBro</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="border border-border rounded bg-background overflow-hidden">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_26rem] gap-0">
            <div className="p-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-4">
                <BadgeDollarSign size={14} />
                Self-serve ads from $99
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight max-w-2xl">
                Reach real crypto degens with BantahBro Ads
              </h1>
              <p className="mt-3 text-sm text-muted-foreground max-w-xl leading-relaxed">
                Put your coin in front of active traders, market watchers, and agent users inside the BantahBro terminal.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="https://t.me/bantahfun"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                >
                  <Send size={15} />
                  Telegram @bantahfun
                </a>
                <a
                  href="https://x.com/bantahfun"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-sidebar-accent"
                >
                  <Twitter size={15} />
                  X @bantahfun
                </a>
              </div>
            </div>
            <div className="border-t xl:border-l xl:border-t-0 border-border bg-muted/20 p-4">
              <TerminalPreview highlight="side" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {stats.map((item) => (
            <div key={item.label} className="border border-border rounded bg-background p-3">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-lg font-black text-foreground">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {placements.map((placement) => (
            <div key={placement.title} className="border border-border rounded bg-background overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <placement.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-foreground">{placement.title}</h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {placement.tag}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{placement.body}</p>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <TerminalPreview highlight={placement.highlight} />
              </div>
            </div>
          ))}
        </section>

        <section className="border border-border rounded bg-background overflow-hidden">
          <div className="border-b border-border p-4 flex items-center gap-3">
            <div className="size-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Handshake size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-foreground">Partnerships</div>
              <div className="text-sm text-muted-foreground">For teams that want more than a paid ad slot.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-4">
            {partnerships.map((partner) => (
              <div key={partner.title} className="rounded border border-border bg-card p-3">
                <div className="text-sm font-black text-foreground">{partner.title}</div>
                <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{partner.body}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="text-sm text-muted-foreground">Pitch partnerships via Telegram or X.</div>
            <div className="sm:ml-auto flex flex-wrap gap-2">
              <a
                href="https://t.me/bantahfun"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
              >
                Telegram @bantahfun
                <ArrowUpRight size={13} />
              </a>
              <a
                href="https://x.com/bantahfun"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-sidebar-accent"
              >
                X @bantahfun
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        </section>

        <section className="border border-border rounded bg-background p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="min-w-0">
            <div className="text-lg font-black text-foreground">Want a slot?</div>
            <div className="text-sm text-muted-foreground">Message BantahFun and we will confirm placement, timing, and creative specs.</div>
          </div>
          <div className="md:ml-auto flex flex-wrap gap-2">
            <a
              href="https://t.me/bantahfun"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Telegram
              <ArrowUpRight size={14} />
            </a>
            <a
              href="https://x.com/bantahfun"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-sidebar-accent"
            >
              Twitter / X
              <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
