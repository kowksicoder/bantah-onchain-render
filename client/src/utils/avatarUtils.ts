function hashString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(label?: string | null): string {
  if (!label) return "BU";
  const clean = label.trim().replace(/[^a-z0-9 ]/gi, " ");
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BU";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function buildInitialsAvatar(seed: string, label: string, size: number): string {
  const hash = hashString(seed || label);
  const hue = hash % 360;
  const bg = `hsl(${hue}, 70%, 55%)`;
  const fg = `hsl(${hue}, 85%, 95%)`;
  const initials = getInitials(label);
  const fontSize = Math.round(size * 0.44);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="hsl(${(hue + 18) % 360}, 70%, 45%)" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.5)}" fill="url(#bg)" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">
        ${initials}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function looksLikeImageUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:image/")) return true;
  if (v.startsWith("/attached_assets/") || v.startsWith("/uploads/") || v.startsWith("/assets/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(v);
}

// Backward-compatible signature:
// - getAvatarUrl(userId, username)
// - getAvatarUrl(userId, username, size)
// - getAvatarUrl(userId, profileImageUrl, username)
// - getAvatarUrl(userId, profileImageUrl, username, size)
export function getAvatarUrl(
  userId: string,
  profileImageOrUsername?: string | null,
  usernameOrSize?: string | number,
  size: number = 128
): string {
  if (profileImageOrUsername && looksLikeImageUrl(profileImageOrUsername)) {
    return profileImageOrUsername;
  }

  const username =
    typeof usernameOrSize === "string"
      ? usernameOrSize
      : profileImageOrUsername || undefined;

  const resolvedSize =
    typeof usernameOrSize === "number"
      ? usernameOrSize
      : size;

  const seed = userId || username || "bantah";
  const label = username || profileImageOrUsername || "Bantah";
  return buildInitialsAvatar(seed, label, resolvedSize);
}
