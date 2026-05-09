'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import {
  Activity,
  BarChart3,
  Bell,
  Compass,
  MessageSquare,
  Rocket,
  Search,
  Send,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { BantahTool } from '@/app/page'
import { apiRequest } from '@/lib/queryClient'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import { executeBantahBroPreparedWalletAction } from '@/lib/walletActions'
import type { BantahBroPreparedWalletAction, BantahBroWalletAction } from '@shared/bantahBroWallet'
import type { OnchainPublicConfig } from '@shared/onchainConfig'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  launcher?: ChatLauncherPayload
  walletAction?: BantahBroWalletAction
}

interface ChatPageProps {
  activeTool?: BantahTool
  onToolChange?: (tool: BantahTool) => void
  pendingWalletAction?: BantahBroWalletAction | null
}

type ChatLauncherPayload = {
  validation?: {
    ok: boolean
    draft: {
      tokenName: string
      tokenSymbol: string
      chainId: number
      chainName: string
      decimals: number
      ownerAddress: string | null
      initialSupply: string
      fixedSupply: boolean
      factoryAddress: string | null
    }
    warnings: string[]
  }
  deployPayload?: {
    tokenName: string
    tokenSymbol: string
    chainId: number
    decimals?: number
    initialSupply: string
    ownerAddress: string
    confirm: true
  }
  missingFields?: string[]
}

interface ToolConfig {
  label: string
  title: string
  subtitle: string
  placeholder: string
  helperText: string
  intro: string
  prompts: string[]
  icon: LucideIcon
}

const TOOL_ORDER: BantahTool[] = [
  'assistant',
  'wallet',
  'discover',
  'battle',
  'analyze',
  'rug',
  'runner',
  'alerts',
  'markets',
  'bxbt',
  'launcher',
]

const TOOL_CONFIG: Record<BantahTool, ToolConfig> = {
  assistant: {
    label: 'Chat Agent',
    title: 'Trading Agent',
    subtitle: 'Ask anything across tokens, markets, narratives, and BantahBro activity.',
    placeholder: 'Ask about markets, agents, strategies...',
    helperText: 'Try asking about: PEPEFUN, Bitcoin, market setups, or who looks strongest today.',
    intro: 'I am your BantahBro trading agent. Ask me about market setups, token flows, prediction opportunities, or where the attention is shifting.',
    prompts: ['Summarize PEPEFUN right now', 'What is the best setup today?', 'Which agent looks strongest?'],
    icon: MessageSquare,
  },
  wallet: {
    label: 'Wallet Ops',
    title: 'Wallet Ops',
    subtitle: 'Check wallet state, then execute sends, approvals, swaps, buys, sells, and bridges from chat.',
    placeholder: 'Ask about wallet balance, send, approve, swap, buy, sell, or bridge...',
    helperText: 'Try: what is my wallet balance, send 5 USDC to @name, swap 0.1 ETH to USDC, or bridge 0.1 ETH from Arbitrum to Base.',
    intro: 'Use this tab for wallet-aware requests. I can read linked wallet state and turn supported onchain prompts into executable actions you can sign with Privy.',
    prompts: ['What is my wallet balance?', 'Send 5 USDC to @username', 'Swap 0.1 ETH to USDC'],
    icon: Wallet,
  },
  discover: {
    label: 'Discover',
    title: 'Meme Discovery',
    subtitle: 'Surface trending meme coins, hot tickers, and live DexScreener-style discovery from the same agent flow.',
    placeholder: 'Ask for trending meme coins, hot Base runners, or live discovery...',
    helperText: 'Try: show me trending meme coins on Base, what is hot on Solana, or find today’s loudest movers.',
    intro: 'This tab is for discovery. Ask for trending meme coins, chain-specific heat, and live tokens getting real attention right now.',
    prompts: ['Show me trending meme coins on Base', 'What is hot on Solana?', 'Find loud meme coins right now'],
    icon: Compass,
  },
  battle: {
    label: 'Battle Desk',
    title: 'Battle Desk',
    subtitle: 'Join live battles, inspect what is active, or create a new token-vs-token arena from chat.',
    placeholder: 'Ask to join a battle, show live arenas, or create $TOKEN vs $TOKEN...',
    helperText: 'Try: show live battles, join a battle, or create $PEPE vs $BONK.',
    intro: 'Use this tab for BantahBro battle flows. I can show live arenas and spin up new token-vs-token battles from chat when the market data resolves cleanly.',
    prompts: ['Show live battles', 'Join a battle', 'Create $PEPE vs $BONK'],
    icon: Zap,
  },
  analyze: {
    label: 'Analyze Token',
    title: 'Analyze Token',
    subtitle: 'Break down ticker, contract, narrative, and onchain behavior inside one workspace.',
    placeholder: 'Drop a ticker, contract, or token theme to analyze...',
    helperText: 'Good prompts: analyze PEPEFUN, review a contract, compare a runner versus its sector.',
    intro: 'Send a ticker, contract, or token theme and I will break down the key market, holder, and narrative signals that matter first.',
    prompts: ['Analyze PEPEFUN', 'Review a Base meme coin', 'What changed in volume today?'],
    icon: Search,
  },
  rug: {
    label: 'Rug Score',
    title: 'Rug Score',
    subtitle: 'Run the same live Rug Scorer engine from chat with contract, LP, holder, and market signals.',
    placeholder: 'Drop a ticker or contract to score rug risk...',
    helperText: 'Try PEPE, ALIEN BOY, or a full contract address on Solana, Base, Arbitrum, or BSC.',
    intro: 'Send a ticker or contract and I will run the same live Rug Scorer path used by the dedicated scanner page.',
    prompts: ['Rug score PEPEFUN', 'Check ALIEN BOY rug risk', 'Score Base WETH'],
    icon: Shield,
  },
  runner: {
    label: 'Runner Score',
    title: 'Runner Score',
    subtitle: 'Track breakout quality, attention velocity, and the odds a coin can keep moving.',
    placeholder: 'Ask for a runner score on a coin or narrative...',
    helperText: 'Try a ticker, sector, or “find the strongest runner on Base today”.',
    intro: 'Runner Score ranks momentum, participation, and follow-through potential so you can spot coins that still have room to move.',
    prompts: ['Give BONK a runner score', 'Find strongest Base runners', 'Who still has breakout room?'],
    icon: TrendingUp,
  },
  alerts: {
    label: 'Live Alerts',
    title: 'Live Alerts',
    subtitle: 'Use the same workspace for whale flow, smart-money movement, and unusual activity.',
    placeholder: 'Ask for live alerts, whales, or unusual activity...',
    helperText: 'Useful prompts: recent whale alerts, unusual volume, or smart-money buys on Base or Solana.',
    intro: 'This tab is for live alert style queries: whale movement, smart-money buys, sudden volume spikes, and attention shifts.',
    prompts: ['Show latest whale alerts', 'Any unusual volume on Solana?', 'Who just rotated into Base?'],
    icon: Bell,
  },
  markets: {
    label: 'Live Markets',
    title: 'Live Markets',
    subtitle: 'Surface active Bantah markets, pool depth, sentiment balance, and where edge may exist.',
    placeholder: 'Ask for the best live markets or open setups...',
    helperText: 'Try “best live markets now” or ask which pools look crowded, thin, or mispriced.',
    intro: 'Ask for open Bantah markets and I will focus on current pools, participation, yes or no imbalance, and where the crowd may be leaning too hard.',
    prompts: ['Best live markets now', 'Which pools look crowded?', 'Show me contrarian setups'],
    icon: BarChart3,
  },
  bxbt: {
    label: 'BXBT Status',
    title: 'BXBT Status',
    subtitle: 'Keep an eye on system health, settlement status, and feed reliability from the same page.',
    placeholder: 'Ask about BXBT status, settlement health, or feed reliability...',
    helperText: 'Good prompts: any stale feeds, settlement lag, or general BXBT system status.',
    intro: 'Use this tab to check BXBT-related status signals like feed freshness, settlement health, and operational reliability.',
    prompts: ['Is BXBT healthy right now?', 'Any stale feed issues?', 'Show settlement status'],
    icon: Activity,
  },
  launcher: {
    label: 'Launch Token',
    title: 'Token Launcher',
    subtitle: 'Draft and confirm fixed-supply token launches through the BantahBro AgentKit factory.',
    placeholder: 'Launch token name Bantah Demo symbol BDEMO supply 1000000 owner 0x... on Base',
    helperText: 'Deployments require an owner wallet, configured factory, auth, and an explicit confirm click.',
    intro: 'Tell me the token name, symbol, initial supply, owner wallet, and chain. I will validate the launch first, then ask for explicit confirmation before any deploy.',
    prompts: [
      'Launch token name Bantah Demo symbol BDEMO supply 1000000 owner 0xYourWallet on Base',
      'What details do you need to launch on Base?',
      'Is the Base launcher factory configured?',
    ],
    icon: Rocket,
  },
}

type MessageStore = Record<BantahTool, Message[]>

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createIntroMessage = (tool: BantahTool): Message => ({
  id: `${tool}-intro`,
  role: 'agent',
  content: TOOL_CONFIG[tool].intro,
  timestamp: new Date(),
})

const createInitialMessages = (): MessageStore => ({
  assistant: [createIntroMessage('assistant')],
  wallet: [createIntroMessage('wallet')],
  discover: [createIntroMessage('discover')],
  battle: [createIntroMessage('battle')],
  analyze: [createIntroMessage('analyze')],
  rug: [createIntroMessage('rug')],
  runner: [createIntroMessage('runner')],
  alerts: [createIntroMessage('alerts')],
  markets: [createIntroMessage('markets')],
  bxbt: [createIntroMessage('bxbt')],
  launcher: [createIntroMessage('launcher')],
})

interface ChatResponse {
  reply?: string
  message?: string
  launcher?: ChatLauncherPayload
  walletAction?: BantahBroWalletAction
}

export default function ChatPage({ activeTool = 'assistant', onToolChange, pendingWalletAction = null }: ChatPageProps) {
  const { wallets, ready: walletsReady } = useWallets()
  const { connectOrCreateWallet } = usePrivy()
  const { isAuthenticated, isLoading: authLoading, login } = useAuth()
  const { toast } = useToast()
  const [messagesByTool, setMessagesByTool] = useState<MessageStore>(() => createInitialMessages())
  const [input, setInput] = useState('')
  const [loadingTool, setLoadingTool] = useState<BantahTool | null>(null)
  const [deployingMessageId, setDeployingMessageId] = useState<string | null>(null)
  const [executingMessageId, setExecutingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef(createMessageId())
  const consumedPendingWalletActionRef = useRef<string | null>(null)
  const promptedLoginRef = useRef<string | null>(null)
  const promptedWalletSetupRef = useRef<string | null>(null)

  const activeConfig = TOOL_CONFIG[activeTool]
  const activeMessages = messagesByTool[activeTool]
  const ActiveIcon = activeConfig.icon

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, activeTool, loadingTool])

  useEffect(() => {
    setInput('')
  }, [activeTool])

  useEffect(() => {
    if (!pendingWalletAction) return

    const signature = JSON.stringify(pendingWalletAction)
    if (consumedPendingWalletActionRef.current === signature) {
      return
    }
    consumedPendingWalletActionRef.current = signature

    appendMessage('wallet', {
      id: createMessageId(),
      role: 'agent',
      content:
        'Telegram handed off a wallet action. Review the details below, then sign it with Privy when you are ready.',
      timestamp: new Date(),
      walletAction: pendingWalletAction,
    })
  }, [pendingWalletAction])

  useEffect(() => {
    if (!pendingWalletAction || authLoading || isAuthenticated) {
      return
    }

    const signature = JSON.stringify(pendingWalletAction)
    if (promptedLoginRef.current === signature) {
      return
    }
    promptedLoginRef.current = signature

    login()
    toast({
      title: 'Sign in to continue',
      description: 'Finish sign in so BantahBro can load this action and set up your wallet.',
    })
  }, [pendingWalletAction, authLoading, isAuthenticated, login, toast])

  useEffect(() => {
    if (!pendingWalletAction || !isAuthenticated || !walletsReady || wallets.length > 0) {
      return
    }

    const signature = JSON.stringify(pendingWalletAction)
    if (promptedWalletSetupRef.current === signature) {
      return
    }
    promptedWalletSetupRef.current = signature

    connectOrCreateWallet()
    toast({
      title: 'Set up your wallet',
      description: 'Finish the Privy wallet setup to sign this Telegram handoff action.',
    })
  }, [pendingWalletAction, isAuthenticated, walletsReady, wallets.length, connectOrCreateWallet, toast])

  const appendMessage = (tool: BantahTool, message: Message) => {
    setMessagesByTool((prev) => ({
      ...prev,
      [tool]: [...prev[tool], message],
    }))
  }

  const handleSend = async (preset?: string) => {
    const messageText = (preset ?? input).trim()
    if (!messageText || loadingTool) return

    const toolAtSend = activeTool
    const userMessage: Message = {
      id: createMessageId(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }

    appendMessage(toolAtSend, userMessage)
    setInput('')
    setLoadingTool(toolAtSend)

    try {
      const data = (await apiRequest('POST', '/api/bantahbro/chat', {
        message: messageText,
        tool: toolAtSend,
        sessionId: `${sessionIdRef.current}-${toolAtSend}`,
      })) as ChatResponse

      const agentMessage: Message = {
        id: createMessageId(),
        role: 'agent',
        content: data.reply || 'BantahBro answered, but no reply text came back.',
        timestamp: new Date(),
        launcher: data.launcher,
        walletAction: data.walletAction,
      }

      appendMessage(toolAtSend, agentMessage)
    } catch (error) {
      const agentMessage: Message = {
        id: createMessageId(),
        role: 'agent',
        content:
          error instanceof Error
            ? `I could not reach the live BantahBro agent runtime: ${error.message}`
            : 'I could not reach the live BantahBro agent runtime right now.',
        timestamp: new Date(),
      }
      appendMessage(toolAtSend, agentMessage)
    } finally {
      setLoadingTool((current) => (current === toolAtSend ? null : current))
    }
  }

  const handleConfirmLaunch = async (message: Message) => {
    if (!message.launcher?.deployPayload || deployingMessageId) return

    setDeployingMessageId(message.id)
    try {
      const result = await apiRequest('POST', '/api/bantahbro/launcher/deploy', message.launcher.deployPayload)
      const tokenAddress = result?.tokenAddress || result?.launch?.tokenAddress || 'pending'
      const explorerTokenUrl = result?.explorerTokenUrl
      appendMessage(activeTool, {
        id: createMessageId(),
        role: 'agent',
        content:
          `Token deployment submitted successfully.\n\nToken: ${tokenAddress}` +
          (explorerTokenUrl ? `\nExplorer: ${explorerTokenUrl}` : ''),
        timestamp: new Date(),
      })
    } catch (error) {
      appendMessage(activeTool, {
        id: createMessageId(),
        role: 'agent',
        content:
          error instanceof Error
            ? `Token deployment failed: ${error.message}`
            : 'Token deployment failed.',
        timestamp: new Date(),
      })
    } finally {
      setDeployingMessageId(null)
    }
  }

  const handleExecuteWalletAction = async (message: Message) => {
    if (!message.walletAction || executingMessageId) return

    if (!isAuthenticated) {
      login()
      return
    }

    if (!wallets.length) {
      connectOrCreateWallet()
      toast({
        title: 'Connect your wallet',
        description: 'Finish the Privy wallet setup, then you can sign this action.',
      })
      return
    }

    const toolAtExecute = activeTool
    setExecutingMessageId(message.id)

    try {
      const onchainConfig = (await apiRequest('GET', '/api/onchain/config')) as OnchainPublicConfig
      const preparedResponse = (await apiRequest('POST', '/api/bantahbro/wallet-actions/prepare', {
        action: message.walletAction,
        walletAddress: wallets[0]?.address || null,
      })) as { action: BantahBroPreparedWalletAction }

      const result = await executeBantahBroPreparedWalletAction({
        wallets: wallets as any,
        preferredWalletAddress: wallets[0]?.address || null,
        onchainConfig,
        action: preparedResponse.action,
      })

      appendMessage(toolAtExecute, {
        id: createMessageId(),
        role: 'agent',
        content:
          `Execution submitted successfully.\n\nTransaction: ${result.txHash}` +
          (result.explorerUrl ? `\nExplorer: ${result.explorerUrl}` : '') +
          (result.approvalTxHash ? `\nApproval: ${result.approvalTxHash}` : '') +
          (result.approvalExplorerUrl ? `\nApproval explorer: ${result.approvalExplorerUrl}` : ''),
        timestamp: new Date(),
      })

      toast({
        title: 'Transaction submitted',
        description: 'Your wallet action was signed and sent successfully.',
      })
    } catch (error) {
      const messageText =
        error instanceof Error
          ? `Wallet execution failed: ${error.message}`
          : 'Wallet execution failed.'

      appendMessage(toolAtExecute, {
        id: createMessageId(),
        role: 'agent',
        content: messageText,
        timestamp: new Date(),
      })

      toast({
        title: 'Execution failed',
        description: error instanceof Error ? error.message : 'The wallet action could not be completed.',
        variant: 'destructive',
      })
    } finally {
      setExecutingMessageId(null)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <ActiveIcon size={14} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-foreground leading-tight">{activeConfig.title}</h1>
            <p className="hidden sm:block text-xs text-muted-foreground leading-tight">{activeConfig.subtitle}</p>
          </div>
        </div>

        <div className="mt-1.5 sm:mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TOOL_ORDER.map((tool) => {
            const config = TOOL_CONFIG[tool]
            const ToolIcon = config.icon
            const isActive = activeTool === tool

            return (
              <button
                key={tool}
                onClick={() => onToolChange?.(tool)}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] sm:gap-1.5 sm:px-2.5 sm:text-xs transition ${
                  isActive
                    ? 'border-primary bg-primary/15 text-primary font-bold'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                <ToolIcon size={12} />
                <span className={isActive ? 'inline' : 'hidden sm:inline'}>{config.label}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 hidden sm:flex flex-wrap gap-1.5">
          {activeConfig.prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-[11px] sm:text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted/50 transition text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-4">
        {activeMessages.map((message) => (
          <div
            key={message.id}
            className={`${message.id.endsWith('-intro') ? 'hidden sm:flex' : 'flex'} ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[86%] sm:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base ${
                message.role === 'user'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted border border-border text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.role === 'agent' && message.walletAction && (
                <div className="mt-3 rounded border border-border bg-background/70 p-3 text-xs space-y-2">
                  <div className="font-bold text-foreground">Ready to execute</div>
                  <div className="text-muted-foreground whitespace-pre-wrap">{message.walletAction.summary}</div>
                  <button
                    type="button"
                    onClick={() => handleExecuteWalletAction(message)}
                    disabled={executingMessageId === message.id}
                    className="w-full rounded bg-primary px-3 py-2 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {!isAuthenticated
                      ? 'Sign in to execute'
                      : !wallets.length
                        ? 'Create/connect wallet'
                      : executingMessageId === message.id
                        ? 'Executing...'
                        : 'Execute with Privy'}
                  </button>
                </div>
              )}
              {message.role === 'agent' && message.launcher?.validation && (
                <div className="mt-3 rounded border border-border bg-background/70 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-foreground">
                        {message.launcher.validation.draft.tokenName} ({message.launcher.validation.draft.tokenSymbol})
                      </div>
                      <div className="text-muted-foreground">
                        {message.launcher.validation.draft.chainName} · {message.launcher.validation.draft.initialSupply} fixed supply
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${
                        message.launcher.validation.ok ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}
                    >
                      {message.launcher.validation.ok ? 'Ready' : 'Needs setup'}
                    </span>
                  </div>
                  {message.launcher.validation.warnings.length > 0 && (
                    <div className="text-yellow-300">
                      {message.launcher.validation.warnings.join(' ')}
                    </div>
                  )}
                  {message.launcher.deployPayload && (
                    <button
                      type="button"
                      onClick={() => handleConfirmLaunch(message)}
                      disabled={deployingMessageId === message.id}
                      className="w-full rounded bg-primary px-3 py-2 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {deployingMessageId === message.id ? 'Deploying...' : 'Confirm deploy token'}
                    </button>
                  )}
                </div>
              )}
              <span
                className={`text-xs mt-1 block ${
                  message.role === 'user' ? 'text-accent-foreground/70' : 'text-muted-foreground'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loadingTool === activeTool && (
          <div className="flex justify-start">
            <div className="bg-muted border border-border text-foreground px-4 py-3 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:120ms]" />
                <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-card p-2 sm:p-4 sm:space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={activeConfig.placeholder}
            className="flex-1 bg-input border border-border rounded px-3 sm:px-4 py-2 text-sm sm:text-base text-foreground placeholder-muted-foreground focus:outline-none focus:border-accent"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loadingTool !== null}
            className="bg-accent text-accent-foreground px-3 sm:px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5 font-bold text-sm sm:text-base"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="hidden sm:block text-xs text-muted-foreground">{activeConfig.helperText}</p>
      </div>
    </div>
  )
}
