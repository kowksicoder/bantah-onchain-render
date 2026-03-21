import { PrivyClient } from '@privy-io/server-auth';
import { normalizeEvmAddress, parseWalletAddresses } from '@shared/onchainConfig';
import { getDelegatedAgentAuth, isAgentToken } from './agentAuth';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID || 'cmc9a12oh01lnky0m1agzgdoc';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || 'HkeiV3uHt5F9uJhJGFjUSbsAFujpjTQFQGzhbMVa9X2aMFaeU3xuSBycAxogfLYM39jjeZVDyUTGv6zSMZ42YbR';

if (!process.env.PRIVY_APP_ID) {
  console.warn('⚠️ PRIVY_APP_ID not set in environment variables, using default');
}

if (!process.env.PRIVY_APP_SECRET) {
  console.warn('⚠️ PRIVY_APP_SECRET not set in environment variables, using default (ROTATE THIS SECRET!)');
}

export const privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

export async function verifyPrivyToken(token: string) {
  try {
    const verifiedClaims = await privyClient.verifyAuthToken(token);
    return verifiedClaims;
  } catch (error) {
    console.error('Privy token verification failed:', error);
    return null;
  }
}

function getInitialsFromEmail(email?: string) {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0] || '';
  // split on non-alphanumeric characters
  const parts = local.split(/[^a-z0-9]+/i).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    const p = parts[0];
    return p.slice(0, 2).toUpperCase();
  }
  return '';
}

import { storage } from './storage';

function extractWalletAddressesFromClaims(verifiedClaims: any): string[] {
  const found = new Set<string>();

  const add = (candidate: unknown) => {
    const normalized = normalizeEvmAddress(candidate);
    if (normalized) found.add(normalized);
  };

  add(verifiedClaims?.walletAddress);
  add(verifiedClaims?.wallet?.address);
  add(verifiedClaims?.address);

  const linkedAccounts = Array.isArray(verifiedClaims?.linkedAccounts)
    ? verifiedClaims.linkedAccounts
    : Array.isArray(verifiedClaims?.linked_accounts)
      ? verifiedClaims.linked_accounts
      : [];

  for (const account of linkedAccounts) {
    if (!account || typeof account !== 'object') continue;
    const accountType = String((account as any).type || '').toLowerCase();
    if (accountType.includes('wallet') || (account as any).address || (account as any).walletAddress) {
      add((account as any).address);
      add((account as any).walletAddress);
    }
  }

  return Array.from(found);
}

async function getUserFromDb(userId: string) {
  try {
    // Fetch user from actual database
    const user = await storage.getUser(userId);
    return user;
  } catch (error) {
    console.error('Error fetching user from database:', error);
    return null;
  }
}

async function upsertPrivyUser(verifiedClaims: any) {
  try {
    const userId = verifiedClaims.userId || verifiedClaims.sub;
    let dbUser = await getUserFromDb(userId);
    
    if (!dbUser) {
      const email = verifiedClaims.email || `${userId}@privy.user`;

      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        return existingByEmail;
      }

      const username = verifiedClaims.email?.split('@')[0] || `user_${userId.slice(-8)}`;

      const fallbackFirstName = getInitialsFromEmail(verifiedClaims.email) || 'User';

      dbUser = await storage.upsertUser({
        id: userId,
        email: email,
        password: 'PRIVY_AUTH_USER',
        firstName: verifiedClaims.given_name || verifiedClaims.name || fallbackFirstName,
        lastName: verifiedClaims.family_name || 'User',
        username: username,
        profileImageUrl: verifiedClaims.picture,
      });
    }
    
    // Extract Telegram data from Privy linkedAccounts if user signed in with Telegram
    if (verifiedClaims.linkedAccounts) {
      const telegramAccount = verifiedClaims.linkedAccounts.find((account: any) => account.type === 'telegram');
      if (telegramAccount && telegramAccount.telegramUserId) {
        console.log(`🔗 Telegram account detected in Privy claims: ${telegramAccount.telegramUserId}`);
        
        // Update user with Telegram ID if not already set
        if (!dbUser.telegramId) {
          await storage.updateUserTelegramInfo(userId, {
            telegramId: telegramAccount.telegramUserId.toString(),
            telegramUsername: telegramAccount.telegramUsername || `tg_${telegramAccount.telegramUserId}`,
            isTelegramUser: true,
          });
          const refreshedUser = await storage.getUser(userId);
          if (refreshedUser) {
            dbUser = refreshedUser;
          }
          console.log(`✅ User ${userId} linked with Telegram ID ${telegramAccount.telegramUserId}`);
        }
      }
    }

    // Persist linked EVM wallets from Privy claims
    const walletsFromClaims = extractWalletAddressesFromClaims(verifiedClaims);
    if (walletsFromClaims.length > 0) {
      const currentPrimary = normalizeEvmAddress((dbUser as any)?.primaryWalletAddress);
      const existingWallets = parseWalletAddresses((dbUser as any)?.walletAddresses);
      const mergedWallets = Array.from(new Set([...existingWallets, ...walletsFromClaims]));
      const nextPrimary = walletsFromClaims[0] || currentPrimary;

      if (
        nextPrimary !== currentPrimary ||
        mergedWallets.length !== existingWallets.length
      ) {
        dbUser = await storage.updateUserProfile(dbUser.id, {
          primaryWalletAddress: nextPrimary,
          walletAddresses: mergedWallets,
        } as any);
      }
    }
    
    return dbUser;
  } catch (error) {
    console.error('Error upserting Privy user:', error);
    throw error;
  }
}

function toAuthenticatedUser(dbUser: any) {
  return {
    id: dbUser.id,
    email: dbUser.email || '',
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    username: dbUser.username,
    walletAddress:
      normalizeEvmAddress((dbUser as any)?.primaryWalletAddress) ||
      parseWalletAddresses((dbUser as any)?.walletAddresses)[0] ||
      undefined,
    isAdmin: dbUser.isAdmin || false,
    claims: {
      sub: dbUser.id,
      email: dbUser.email,
      first_name: dbUser.firstName,
      last_name: dbUser.lastName,
    }
  };
}

export async function PrivyAuthMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  // Allow Passport session as fallback if no Privy token provided
  if (!authHeader && req.isAuthenticated && req.isAuthenticated()) {
    // If a session is active, attach the user cartaints (existing user object) and proceed
    try {
      const sessionUser = req.user;
      if (sessionUser) {
        req.user = sessionUser;
        return next();
      }
    } catch (err) {
      console.error('Error using session-based auth fallback:', err);
      // fallthrough to token-based verification
    }
  }

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const delegatedAgentAuth = await getDelegatedAgentAuth(token);
    if (delegatedAgentAuth) {
      req.user = toAuthenticatedUser(delegatedAgentAuth.user);
      req.agentAuth = {
        serviceId: delegatedAgentAuth.agentAuth.serviceId,
        scopes: delegatedAgentAuth.agentAuth.scopes,
        actingAsUserId: delegatedAgentAuth.agentAuth.actingAsUserId,
        audience: delegatedAgentAuth.agentAuth.audience,
      };
      return next();
    }

    if (isAgentToken(token)) {
      return res.status(401).json({ message: 'Invalid or expired agent token' });
    }

    const verifiedClaims = await verifyPrivyToken(token);

    const userId = verifiedClaims?.userId || verifiedClaims?.sub;
    if (!verifiedClaims || !userId) {
      return res.status(401).json({ message: 'Invalid token or user ID not found' });
    }

    const dbUser = await upsertPrivyUser(verifiedClaims);

    if (!dbUser) {
      return res.status(500).json({ message: 'Failed to create or retrieve user' });
    }

    // Attach user to request with proper structure for routes
    // Privy auth structure - set both id and claims for compatibility
    req.user = toAuthenticatedUser(dbUser);

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error during authentication' });
  }
}
