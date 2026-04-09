import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Send, ExternalLink, Check, Loader2 } from "lucide-react";
import { SiX, SiWhatsapp, SiTelegram } from "react-icons/si";
import {
  getTelegramShareUrl,
  getTwitterShareUrl,
  getWhatsAppShareUrl,
  shareChallenge,
  shareNative,
  copyToClipboard,
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
    } | null;
    challengedAgent?: {
      name?: string | null;
    } | null;
    updatedAt?: string | null;
  };
  trigger?: React.ReactNode;
}

function formatParticipant(
  side: string | null | undefined,
  user?: { username?: string | null; firstName?: string | null } | null,
  agent?: { name?: string | null } | null,
) {
  const label = agent?.name || user?.username || user?.firstName || "Open";
  const cleanSide = side?.toUpperCase() === "YES" || side?.toUpperCase() === "NO" ? side.toUpperCase() : null;
  return cleanSide ? `${cleanSide} ${label}` : label;
}

export function SocialMediaShare({ challenge, trigger }: SocialMediaShareProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [previewErrored, setPreviewErrored] = useState(false);

  const share = useMemo(() => {
    const stakeLabel = `${challenge.amount} ${challenge.tokenSymbol || "ETH"}`;
    return shareChallenge(String(challenge.id), challenge.title, stakeLabel);
  }, [challenge.amount, challenge.id, challenge.title, challenge.tokenSymbol]);

  const origin = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "https://bantah.fun";

  const openChallengeUrl = `${origin}/challenges/${challenge.id}`;
  const previewImageUrl = `${origin}/api/og/challenges/${challenge.id}.png?v=${encodeURIComponent(challenge.updatedAt || String(challenge.id))}`;
  const challengerLine = formatParticipant(challenge.challengerSide, challenge.challengerUser, challenge.challengerAgent);
  const opponentLine = formatParticipant(challenge.challengedSide, challenge.challengedUser, challenge.challengedAgent);

  const shareOptions = [
    {
      name: "X",
      key: "twitter",
      icon: SiX,
      url: getTwitterShareUrl(share.shareData),
      className: "border-slate-200 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
    },
    {
      name: "WhatsApp",
      key: "whatsapp",
      icon: SiWhatsapp,
      url: getWhatsAppShareUrl(share.shareData),
      className: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/30",
    },
    {
      name: "Telegram",
      key: "telegram",
      icon: SiTelegram,
      url: getTelegramShareUrl(share.shareData),
      className: "border-sky-200 hover:border-sky-400 hover:bg-sky-50 dark:border-sky-900 dark:hover:bg-sky-950/30",
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
          <Button size="sm" variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share Challenge
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Challenge
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            {!previewErrored ? (
              <img
                src={previewImageUrl}
                alt={`Share preview for ${challenge.title}`}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 object-cover dark:border-slate-800 dark:bg-slate-900"
                onError={() => setPreviewErrored(true)}
              />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-900">
                <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Preview image is still warming up.</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  The share URL is already live. If the preview doesn't appear here yet, social apps will still fetch it from the server.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{challenge.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {challengerLine} vs {opponentLine}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1 text-[11px] uppercase tracking-wide">
                {challenge.status}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {shareOptions.map((option) => (
                <Button
                  key={option.key}
                  variant="outline"
                  className={`justify-start gap-3 rounded-2xl h-12 ${option.className}`}
                  onClick={() => handlePlatformShare(option.key as "twitter" | "whatsapp" | "telegram", option.url)}
                >
                  <option.icon className="h-4 w-4" />
                  <span>{option.name}</span>
                </Button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {typeof navigator !== "undefined" && navigator.share && (
                <Button variant="outline" className="rounded-full" onClick={() => handlePlatformShare("native")}>
                  <Send className="mr-2 h-4 w-4" />
                  More options
                </Button>
              )}

              <Button variant="outline" className="rounded-full" onClick={() => handlePlatformShare("copy")}>
                {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy share link"}
              </Button>

              <Button variant="outline" className="rounded-full" onClick={() => window.open(openChallengeUrl, "_blank")}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open challenge
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">Public share URL:</span>{" "}
              <span className="break-all">{share.shareUrl}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
