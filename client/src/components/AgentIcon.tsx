import { cn } from "@/lib/utils";

type AgentIconProps = {
  className?: string;
  imageClassName?: string;
  alt?: string;
};

export function AgentIcon({
  className,
  imageClassName,
  alt = "Agents",
}: AgentIconProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      <img
        src="/assets/bantzzlogo.svg"
        alt={alt}
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </span>
  );
}
