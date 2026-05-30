export const ARENA_AGENT_AVATARS = [
  '/arena-agents/agent-1.jpg',
  '/arena-agents/agent-2.jpg',
  '/arena-agents/agent-3.jpg',
  '/arena-agents/agent-4.jpg',
] as const;

function stableIndex(seed: string, length: number) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % length;
}

export function arenaAgentAvatar(seed?: string | null) {
  const safeSeed = String(seed || 'bota-agent');
  return ARENA_AGENT_AVATARS[stableIndex(safeSeed, ARENA_AGENT_AVATARS.length)];
}
