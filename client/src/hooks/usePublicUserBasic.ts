import { useEffect, useMemo, useState } from "react";

export type PublicUserBasic = {
  id?: string;
  username?: string | null;
  firstName?: string | null;
  profileImageUrl?: string | null;
};

type CacheEntry = {
  data: PublicUserBasic | null;
  fetchedAt: number;
};

const userCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<PublicUserBasic | null>>();
const USER_CACHE_TTL_MS = 10 * 1000;

function normalize(value: PublicUserBasic | null | undefined, fallbackId?: string): PublicUserBasic | null {
  if (!value && !fallbackId) return null;
  return {
    id: value?.id || fallbackId,
    username: value?.username ?? null,
    firstName: value?.firstName ?? null,
    profileImageUrl: value?.profileImageUrl ?? null,
  };
}

function mergeUsers(primary: PublicUserBasic | null, secondary: PublicUserBasic | null): PublicUserBasic | null {
  if (!primary && !secondary) return null;
  return {
    id: primary?.id || secondary?.id,
    username: primary?.username ?? secondary?.username ?? null,
    firstName: primary?.firstName ?? secondary?.firstName ?? null,
    profileImageUrl: primary?.profileImageUrl ?? secondary?.profileImageUrl ?? null,
  };
}

async function fetchPublicUserBasic(userId: string): Promise<PublicUserBasic | null> {
  const existing = inflightRequests.get(userId);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const res = await fetch(`/api/public/users/${userId}/basic`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const normalized = normalize({
        id: data?.id || userId,
        username: data?.username || null,
        firstName: data?.firstName || null,
        profileImageUrl: data?.profileImageUrl || null,
      }, userId);
      userCache.set(userId, { data: normalized, fetchedAt: Date.now() });
      return normalized;
    } catch {
      userCache.set(userId, { data: null, fetchedAt: Date.now() });
      return null;
    } finally {
      inflightRequests.delete(userId);
    }
  })();

  inflightRequests.set(userId, request);
  return request;
}

export function getUserDisplayName(
  user: PublicUserBasic | null | undefined,
  fallback = "unknown"
): string {
  const walletFromId = (() => {
    if (typeof user?.id !== "string") return "";
    const id = user.id.trim();
    if (!id.toLowerCase().startsWith("wallet_")) return "";
    const raw = id.slice("wallet_".length).trim();
    if (/^0x[a-f0-9]{40}$/i.test(raw)) return raw.toLowerCase();
    if (/^[a-f0-9]{40}$/i.test(raw)) return `0x${raw.toLowerCase()}`;
    return "";
  })();

  const truncateWallet = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const isPlaceholderLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "user" ||
      normalized === "wallet" ||
      normalized === "unknown user" ||
      normalized === "wallet target" ||
      normalized === "challenged" ||
      normalized === "opponent" ||
      normalized === "waiting"
    );
  };

  const isGeneratedWalletUsername = (value: string) => /^user-[a-z0-9]{4}$/i.test(value.trim());

  const firstName = typeof user?.firstName === "string" ? user.firstName.trim() : "";
  if (firstName && !isPlaceholderLabel(firstName)) return firstName;

  const username = typeof user?.username === "string" ? user.username.trim() : "";
  if (username && !isPlaceholderLabel(username) && !isGeneratedWalletUsername(username)) return username;

  if (walletFromId) return truncateWallet(walletFromId);

  if (user?.id) return `user_${String(user.id).slice(-6)}`;
  return fallback;
}

export function getUserHandle(user: PublicUserBasic | null | undefined, fallback = "unknown"): string {
  const username = typeof user?.username === "string" ? user.username.trim() : "";
  if (username && username.toLowerCase() !== "user") return `@${username}`;
  return getUserDisplayName(user, fallback);
}

export function usePublicUserBasic(
  userId?: string,
  seed?: PublicUserBasic | null
): PublicUserBasic | null {
  const normalizedSeed = useMemo(
    () => normalize(seed, userId),
    [userId, seed?.id, seed?.username, seed?.firstName, seed?.profileImageUrl]
  );

  const [resolved, setResolved] = useState<PublicUserBasic | null>(normalizedSeed);

  useEffect(() => {
    setResolved((prev) => mergeUsers(prev, normalizedSeed));
  }, [normalizedSeed]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;

    const now = Date.now();
    const cached = userCache.get(userId);
    if (cached && (now - cached.fetchedAt) < USER_CACHE_TTL_MS) {
      if (!cancelled) {
        setResolved((prev) => mergeUsers(cached.data, mergeUsers(prev, normalizedSeed)));
      }
      return;
    }

    fetchPublicUserBasic(userId).then((fetched) => {
      if (cancelled) return;
      setResolved((prev) => mergeUsers(fetched, mergeUsers(prev, normalizedSeed)));
    });

    return () => {
      cancelled = true;
    };
  }, [userId, normalizedSeed]);

  return resolved;
}
