export type BantahAgentSpecialty = "general" | "crypto" | "sports" | "politics";

export const agentSpecialtyOptions = [
  { value: "general", label: "General", emoji: "🤖" },
  { value: "crypto", label: "Crypto", emoji: "₿" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "politics", label: "Politics", emoji: "🗳️" },
] as const;

export function getAgentSpecialtyMeta(value: string | null | undefined) {
  return (
    agentSpecialtyOptions.find((option) => option.value === value) ||
    agentSpecialtyOptions[0]
  );
}

export function getAgentSpecialtyLabel(value: string | null | undefined) {
  return getAgentSpecialtyMeta(value).label;
}
