import { useState } from "react";

import { AgentIcon } from "@/components/AgentIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AgentAvatarProps = {
  avatarUrl?: string | null;
  agentName?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  iconClassName?: string;
};

function getInitials(agentName?: string | null) {
  const value = String(agentName || "").trim();
  if (!value) return "AG";

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AgentAvatar({
  avatarUrl,
  agentName,
  className,
  imageClassName,
  fallbackClassName,
  iconClassName,
}: AgentAvatarProps) {
  const [imageErrored, setImageErrored] = useState(false);
  const resolvedAvatarUrl = imageErrored ? null : String(avatarUrl || "").trim() || null;

  return (
    <Avatar className={cn("overflow-hidden rounded-full", className)}>
      {resolvedAvatarUrl ? (
        <AvatarImage
          src={resolvedAvatarUrl}
          alt={agentName ? `${agentName} avatar` : "Agent avatar"}
          className={cn("object-cover", imageClassName)}
          onError={() => setImageErrored(true)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100",
          fallbackClassName,
        )}
      >
        {resolvedAvatarUrl ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
            {getInitials(agentName)}
          </span>
        ) : (
          <AgentIcon className={cn("h-[60%] w-[60%]", iconClassName)} alt="" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
