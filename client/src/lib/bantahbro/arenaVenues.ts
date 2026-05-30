export type ArenaVenue = {
  label: string;
};

const ARENA_VENUES: ArenaVenue[] = [
  { label: 'Neon Ring' },
  { label: 'Signal Dome' },
  { label: 'Circuit Pit' },
  { label: 'Oracle Yard' },
  { label: 'Velocity Deck' },
  { label: 'Apex Vault' },
  { label: 'Pulse Arena' },
  { label: 'Quantum Court' },
  { label: 'Launch Bay' },
  { label: 'Base Chamber' },
  { label: 'Vector Hall' },
  { label: 'Skyline Stage' },
];

function hashArenaSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function arenaVenueForBattle(seed?: string | null, fallbackIndex = 0): ArenaVenue {
  const normalizedSeed = seed?.trim() || `arena:${fallbackIndex}`;
  return ARENA_VENUES[hashArenaSeed(normalizedSeed) % ARENA_VENUES.length];
}

export function arenaLabelForBattle(seed?: string | null, fallbackIndex = 0) {
  return arenaVenueForBattle(seed, fallbackIndex).label;
}
