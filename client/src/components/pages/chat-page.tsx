'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  MessageSquare,
  Rocket,
  Search,
  Send,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { BantahTool } from '@/app/page'
import { apiRequest } from '@/lib/queryClient'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
  launcher?: ChatLauncherPayload
}

interface ChatPageProps {
  activeTool?: BantahTool
  onToolChange?: (tool: BantahTool) => void
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

const TOOL_ORDER: BantahTool[] = ['assistant', 'analyze', 'runner', 'alerts', 'markets', 'bxbt', 'launcher']

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
  analyze: [createIntroMessage('analyze')],
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
}

export default function ChatPage({ activeTool = 'assistant', onToolChange }: ChatPageProps) {
  const [messagesByTool, setMessagesByTool] = useState<MessageStore>(() => createInitialMessages())
  const [input, setInput] = useState('')
  const [loadingTool, setLoadingTool] = useState<BantahTool | null>(null)
  const [deployingMessageId, setDeployingMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef(createMessageId())

  const activeConfig = TOOL_CONFIG[activeTool]
  const activeMessages = messagesByTool[activeTool]
  const ActiveIcon = activeConfig.icon

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, activeTool, loadingTool])

  useEffect(() => {
    setInput('')
  }, [activeTool])

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
      const response = await fetch('/api/bantahbro/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          tool: toolAtSend,
          sessionId: `${sessionIdRef.current}-${toolAtSend}`,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as ChatResponse

      if (!response.ok) {
        throw new Error(data.message || `BantahBro chat failed (${response.status})`)
      }

      const agentMessage: Message = {
        id: createMessageId(),
        role: 'agent',
        content: data.reply || 'BantahBro answered, but no reply text came back.',
        timestamp: new Date(),
        launcher: data.launcher,
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

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-2.5 sm:px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <ActiveIcon size={15} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">{activeConfig.title}</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{activeConfig.subtitle}</p>
          </div>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TOOL_ORDER.map((tool) => {
            const config = TOOL_CONFIG[tool]
            const ToolIcon = config.icon
            const isActive = activeTool === tool

            return (
              <button
                key={tool}
                onClick={() => onToolChange?.(tool)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  isActive
                    ? 'border-primary bg-primary/15 text-primary font-bold'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                <ToolIcon size={12} />
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
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

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {activeMessages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs sm:max-w-md px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base ${
                message.role === 'user'
                  ? 'bg-accent text-background'
                  : 'bg-muted border border-border text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
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
                  message.role === 'user' ? 'text-background/70' : 'text-muted-foreground'
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

      <div className="border-t border-border bg-card p-3 sm:p-4 space-y-2">
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
            className="bg-accent text-background px-3 sm:px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5 font-bold text-sm sm:text-base"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{activeConfig.helperText}</p>
      </div>
    </div>
  )
}
