import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Send, ExternalLink, Check } from "lucide-react";
import { SiTelegram, SiWhatsapp, SiX } from "react-icons/si";
import {
  copyToClipboard,
  getTelegramShareUrl,
  getTwitterShareUrl,
  getWhatsAppShareUrl,
  shareChallenge,
  shareNative,
} from "@/utils/sharing";

interface SocialMediaShareProps {
  challenge: {
    id: number;
    title: string;
    amount: string | number;
    tokenSymbol?: string | null;
    status: string;
    dueDate?: string | null;
    challengerSide?: string | null;
    challengedSide?: string | null;
    challengerUser?: {
      username?: string | null;
      firstName?: string | null;
    } | null;
    challengedUser?: {
      username?: string | null;
      firstName?: string | null;
    } | null;
    challengerAgent?: {
      name?: string | null;
      agentName?: string | null;
    } | null;
    challengedAgent?: {
      name?: string | null;
      agentName?: string | null;
    } | null;
    coverImageUrl?: string | null;
    participantCount?: number | null;
    participantPreviewUsers?: Array<{
      id?: string | null;
      username?: string | null;
      firstName?: string | null;
      side?: string | null;
      profileImageUrl?: string | null;
    }> | null;
    updatedAt?: string | null;
    chainId?: number | null;
  };
  trigger?: ReactNode;
}

function formatDeadlineLabel(value?: string | null) {
  if (!value) return "No deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatChainLabel(chainId?: number | null) {
  switch (Number(chainId || 0)) {
    case 8453:
      return "Base";
    case 42161:
      return "Arbitrum";
    case 56:
      return "BSC";
    case 130:
      return "Unichain";
    case 1:
      return "Ethereum";
    default:
      return "Onchain";
  }
}

function formatPayoutLabel(amount: string | number, tokenSymbol?: string | null) {
  const numericAmount = Number(amount || 0);
  const payout = Number.isFinite(numericAmount) ? numericAmount * 1.991 : 0;
  const symbol = String(tokenSymbol || "ETH").toUpperCase();
  const formatted = Number.isInteger(payout)
    ? payout.toString()
    : payout.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  return `${formatted} ${symbol}`;
}

function formatParticipant(
  side: string | null | undefined,
  user?: { username?: string | null; firstName?: string | null } | null,
  agent?: { name?: string | null; agentName?: string | null } | null,
) {
  const label = agent?.agentName || agent?.name || user?.username || user?.firstName || "Open";
  const cleanSide = side?.toUpperCase() === "YES" || side?.toUpperCase() === "NO" ? side.toUpperCase() : null;
  return cleanSide ? `${cleanSide} ${label}` : label;
}

function SharePreviewSkeleton() {
  return (
    <div className="absolute inset-0 flex aspect-[1.91/1] w-full flex-col justify-between bg-slate-100 p-3 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20 rounded-full bg-slate-200/90 dark:bg-slate-800" />
          <Skeleton className="h-7 w-36 rounded-xl bg-slate-200/90 dark:bg-slate-800" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-12 rounded-full bg-slate-200/90 dark:bg-slate-800" />
            <Skeleton className="h-5 w-16 rounded-full bg-slate-200/90 dark:bg-slate-800" />
          </div>
        </div>
        <Skeleton className="h-16 w-16 rounded-2xl bg-slate-200/90 dark:bg-slate-800" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-10 rounded-2xl bg-slate-200/90 dark:bg-slate-800" />
        <Skeleton className="h-10 rounded-2xl bg-slate-200/90 dark:bg-slate-800" />
        <Skeleton className="h-10 rounded-2xl bg-slate-200/90 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function SocialMediaShare({ challenge, trigger }: SocialMediaShareProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [previewErrored, setPreviewErrored] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const challengerLine = formatParticipant(challenge.challengerSide, challenge.challengerUser, challenge.challengerAgent);
  const opponentLine = formatParticipant(challenge.challengedSide, challenge.challengedUser, challenge.challengedAgent);
  const chainLabel = formatChainLabel(challenge.chainId);
  const deadlineLabel = formatDeadlineLabel(challenge.dueDate);
  const payoutLabel = formatPayoutLabel(challenge.amount, challenge.tokenSymbol);
  const stakeLabel = `${challenge.amount} ${challenge.tokenSymbol || "ETH"}`;
  const statusLabel = String(challenge.status || "open")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const share = useMemo(() => {
    return shareChallenge(String(challenge.id), challenge.title, stakeLabel, {
      challengerLabel: challengerLine,
      opponentLabel: opponentLine,
      payoutLabel,
      status: statusLabel,
      dueDate: deadlineLabel,
      chainLabel,
    });
  }, [
    challenge.id,
    challenge.title,
    stakeLabel,
    challengerLine,
    opponentLine,
    payoutLabel,
    statusLabel,
    deadlineLabel,
    chainLabel,
  ]);

  const origin = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "https://bantah.fun";

  const openChallengeUrl = `${origin}/challenges/${challenge.id}`;
  const previewVersion = encodeURIComponent(
    [
      challenge.updatedAt,
      challenge.status,
      challenge.challengerSide,
      challenge.challengedSide,
      challenge.dueDate,
      challenge.amount,
      challenge.coverImageUrl,
      challenge.participantCount,
      ...(challenge.participantPreviewUsers || []).map((participant) =>
        [
          participant?.id,
          participant?.username,
          participant?.firstName,
          participant?.side,
          participant?.profileImageUrl,
        ]
          .filter(Boolean)
          .join(":"),
      ),
    ]
      .filter(Boolean)
      .join("|") || String(challenge.id),
  );
  const previewImageUrl = `${origin}/api/og/challenges/${challenge.id}.png?v=${previewVersion}`;

  useEffect(() => {
    setPreviewLoaded(false);
    setPreviewErrored(false);
  }, [previewImageUrl, isOpen]);

  const shareOptions = [
    {
      name: "X",
      key: "twitter",
      icon: SiX,
      url: getTwitterShareUrl(share.shareData),
      className: "bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white",
    },
    {
      name: "WhatsApp",
      key: "whatsapp",
      icon: SiWhatsapp,
      url: getWhatsAppShareUrl(share.shareData),
      className: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-200",
    },
    {
      name: "Telegram",
      key: "telegram",
      icon: SiTelegram,
      url: getTelegramShareUrl(share.shareData),
      className: "bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-950/40 dark:hover:bg-sky-950/60 dark:text-sky-200",
    },
  ];

  const handleCopyLink = async () => {
    const success = await copyToClipboard(share.shareUrl);
    if (!success) {
      toast({
        title: "Copy failed",
        description: "We couldn't copy the share link. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setCopied(true);
    toast({
      title: "Share link copied",
      description: "The public challenge share link is ready to paste anywhere.",
    });
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handlePlatformShare = async (platform: "native" | "copy" | "twitter" | "whatsapp" | "telegram", url?: string) => {
    if (platform === "native") {
      const shared = await shareNative(share.shareData);
      if (!shared) {
        await handleCopyLink();
      }
      return;
    }

    if (platform === "copy") {
      await handleCopyLink();
      return;
    }

    if (url) {
      window.open(url, "_blank", "width=700,height=520");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2 rounded-full border-0 bg-slate-900 text-white hover:bg-slate-800">
            <Share2 className="w-4 h-4" />
            Share Challenge
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[320px] overflow-hidden rounded-[22px] border-0 bg-white p-0 shadow-2xl dark:bg-slate-950">
        <div className="space-y-2.5 px-3.5 pb-3.5 pt-3.5">
          <div className="relative aspect-[1.91/1] overflow-hidden rounded-[18px] bg-slate-100 dark:bg-slate-900">
            {!previewErrored ? (
              <img
                src={previewImageUrl}
                alt={`Share preview for ${challenge.title}`}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                  previewLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setPreviewLoaded(true)}
                onError={() => {
                  setPreviewErrored(true);
                  setPreviewLoaded(false);
                }}
              />
            ) : null}

            {!previewLoaded || previewErrored ? <SharePreviewSkeleton /> : null}
          </div>

          <div className="rounded-[18px] bg-slate-50 p-2.5 dark:bg-slate-900">
            <div className="mt-2 rounded-[14px] bg-white px-2.5 py-2 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                <span>Stake</span>
                <span>To win</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
                <span className="truncate">{stakeLabel}</span>
                <span className="truncate text-right">{payoutLabel}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="truncate">{statusLabel} | {chainLabel}</span>
              <span className="truncate text-right">{deadlineLabel}</span>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {shareOptions.map((option) => (
                <Button
                  key={option.key}
                  className={`h-10 rounded-2xl border-0 px-2 shadow-none ${option.className}`}
                  aria-label={`Share on ${option.name}`}
                  title={option.name}
                  onClick={() => handlePlatformShare(option.key as "twitter" | "whatsapp" | "telegram", option.url)}
                >
                  <option.icon className="h-4 w-4" />
                </Button>
              ))}

              <Button
                className="h-10 rounded-2xl border-0 bg-slate-200 px-2 text-slate-900 shadow-none hover:bg-slate-300 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                onClick={() => handlePlatformShare("copy")}
              >
                <div className="flex flex-col items-center gap-1">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="text-[10px] font-semibold leading-none">{copied ? "Copied" : "Copy"}</span>
                </div>
              </Button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              {typeof navigator !== "undefined" && navigator.share ? (
                <Button
                  className="h-9 rounded-full border-0 bg-white px-3 text-xs text-slate-900 shadow-none hover:bg-slate-200 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                  onClick={() => handlePlatformShare("native")}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  More
                </Button>
              ) : (
                <div />
              )}

              <Button
                className="h-9 rounded-full border-0 bg-white px-3 text-xs text-slate-900 shadow-none hover:bg-slate-200 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                onClick={() => window.open(openChallengeUrl, "_blank")}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
