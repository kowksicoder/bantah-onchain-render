import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { ethers } from 'ethers';

const rootDir = path.resolve(process.cwd(), '..');
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const REQUIRED = [
  'DATABASE_URL',
  'ADMIN_PRIVATE_KEY',
  'ONCHAIN_BASE_SEPOLIA_RPC_URL',
  'ONCHAIN_ARBITRUM_SEPOLIA_RPC_URL',
  'ONCHAIN_BASE_SEPOLIA_ESCROW_ADDRESS',
  'ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_ADDRESS',
  'ONCHAIN_BASE_SEPOLIA_USDC_ADDRESS',
  'ONCHAIN_BASE_SEPOLIA_USDT_ADDRESS',
  'ONCHAIN_ARBITRUM_SEPOLIA_USDC_ADDRESS',
  'ONCHAIN_ARBITRUM_SEPOLIA_USDT_ADDRESS',
];

for (const key of REQUIRED) {
  if (!String(process.env[key] || '').trim()) {
    throw new Error(`Missing env var: ${key}`);
  }
}

const erc20Abi = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const escrowAbi = [
  'function lockStakeNative() payable returns (bool)',
  'function lockStakeToken(address token, uint256 amount) returns (bool)',
];

const categories = [
  'sports',
  'crypto',
  'gaming',
  'trading',
  'music',
  'entertainment',
  'politics',
];

const titlesByCategory = {
  sports: [
    'Arsenal win on Saturday',
    'Chelsea score first tonight',
    'Over 2.5 goals in El Clasico',
    'Lakers cover the spread tonight',
    'Djokovic wins in straight sets',
    'Nadal reaches quarterfinal',
    'Barcelona keep a clean sheet',
    'Inter win by two goals',
  ],
  crypto: [
    'BTC closes above 95k Friday',
    'ETH breaks 3200 this week',
    'SOL ends day in green',
    'BNB closes above 700',
    'ARB outperforms ETH today',
    'BTC dominance rises today',
    'ETH gas stays under 30 gwei',
    'USDT market cap hits new high',
  ],
  gaming: [
    'EA FC BO3 winner tonight',
    'Warzone squad gets top 5',
    'Valorant map one goes overtime',
    'Dota match ends under 35 mins',
    'CS2 pistol round sweep',
    'Fortnite duo gets Victory Royale',
    'League team secures first dragon',
    'Mortal Kombat set goes to final',
  ],
  trading: [
    'Nasdaq closes green today',
    'Gold trades above 2050',
    'DXY ends lower this session',
    'SPX holds 5200 support',
    'Tesla closes above open',
    'Oil closes above 80',
    'NFP beats forecast this month',
    'US10Y yields move lower today',
  ],
  music: [
    'Album enters top 10 this week',
    'Single hits one million streams',
    'Artist drops EP before Friday',
    'Track charts in two countries',
    'Collab enters top 50 global',
    'Music video hits 500k in 24h',
    'Remix outperforms original',
    'Song trends on TikTok today',
  ],
  entertainment: [
    'Movie opens above forecast',
    'Series tops weekly watchlist',
    'Trailer hits five million views',
    'Show gets renewed this month',
    'Premiere trends within one hour',
    'Box office beats projections',
    'Documentary enters top 5',
    'Lead actor wins fan vote',
  ],
  politics: [
    'Bill passes first reading',
    'Debate draws over ten million',
    'Candidate leads next poll',
    'Voter turnout exceeds forecast',
    'Policy vote passes this week',
    'Governor wins court appeal',
    'Party secures key endorsement',
    'Cabinet reshuffle announced today',
  ],
};

function parseWalletAddressesFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const matches = raw.match(/0x[a-fA-F0-9]{40}/g) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const addr = ethers.getAddress(m);
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickCategory() {
  return pickRandom(categories);
}

function pickTitle(category, usedTitles) {
  const pool = [...(titlesByCategory[category] || [])];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let candidate = pool.find((t) => !usedTitles.has(t));
  if (!candidate) {
    const fallback = pickRandom(pool);
    const suffix = Math.floor(100 + Math.random() * 900);
    candidate = `${fallback.split(' ').slice(0, 4).join(' ')} ${suffix}`;
  }
  usedTitles.add(candidate);
  return candidate;
}

function pickToken(chainName) {
  const r = Math.random();
  // Keep ETH lower frequency to preserve native gas and avoid overfunding requirement
  if (chainName === 'Arbitrum Sepolia') {
    if (r < 0.08) return 'ETH';
    return r < 0.54 ? 'USDC' : 'USDT';
  }
  if (r < 0.15) return 'ETH';
  return r < 0.58 ? 'USDC' : 'USDT';
}

function pickStake(chainName, tokenSymbol) {
  if (tokenSymbol === 'ETH') {
    const baseOptions = ['0.000015', '0.00002', '0.00003', '0.00004', '0.00005'];
    const arbOptions = ['0.00001', '0.000012', '0.000015', '0.00002', '0.000025'];
    return chainName === 'Arbitrum Sepolia' ? pickRandom(arbOptions) : pickRandom(baseOptions);
  }
  // USDC/USDT integer units
  const min = 3;
  const max = 35;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function randomDueDateIso() {
  const hours = Math.floor(Math.random() * 72) + 12; // 12h - 84h
  const ms = Date.now() + hours * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

async function submitTxWithNonce({ wallet, nonceState, sendFn }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nonce = nonceState.nextNonce;
    try {
      const tx = await sendFn(nonce);
      nonceState.nextNonce = nonce + 1;
      return tx;
    } catch (error) {
      const message = String(error?.shortMessage || error?.message || '');
      const isRetryable =
        /replacement transaction underpriced|replacement fee too low|nonce too low|already known/i.test(
          message,
        );
      if (!isRetryable || attempt >= 2) {
        throw error;
      }
      nonceState.nextNonce = await wallet.provider.getTransactionCount(
        wallet.address,
        'pending',
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw new Error('Failed to submit transaction after retries');
}

async function ensureTokenApproval({
  wallet,
  tokenAddress,
  escrowAddress,
  minAllowance,
  nonceState,
}) {
  const token = new ethers.Contract(tokenAddress, erc20Abi, wallet);
  const allowance = await token.allowance(wallet.address, escrowAddress);
  if (allowance >= minAllowance) {
    return { approved: false, txHash: null };
  }
  const tx = await submitTxWithNonce({
    wallet,
    nonceState,
    sendFn: async (nonce) =>
      token.approve(escrowAddress, ethers.MaxUint256, { nonce }),
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Approval failed for token ${tokenAddress}`);
  }
  return { approved: true, txHash: tx.hash };
}

async function sendEscrowTx({ wallet, chain, tokenSymbol, stakeAtomic, nonceState }) {
  if (tokenSymbol === 'ETH') {
    const escrow = new ethers.Contract(chain.escrowAddress, escrowAbi, wallet);
    const tx = await submitTxWithNonce({
      wallet,
      nonceState,
      sendFn: async (nonce) => escrow.lockStakeNative({ value: BigInt(stakeAtomic), nonce }),
    });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error('ETH escrow tx failed');
    return { escrowTxHash: tx.hash, approveTxHash: null };
  }

  const tokenAddress = chain.tokens[tokenSymbol].address;
  if (!tokenAddress) throw new Error(`Missing ${tokenSymbol} token address for ${chain.name}`);
  const escrow = new ethers.Contract(chain.escrowAddress, escrowAbi, wallet);
  const tx = await submitTxWithNonce({
    wallet,
    nonceState,
    sendFn: async (nonce) =>
      escrow.lockStakeToken(tokenAddress, BigInt(stakeAtomic), { nonce }),
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${tokenSymbol} lockStakeToken tx failed`);
  return { escrowTxHash: tx.hash, approveTxHash: null };
}

async function run() {
  const adminWallet = new ethers.Wallet(String(process.env.ADMIN_PRIVATE_KEY).trim());

  const chains = [
    {
      code: 'base',
      name: 'Base Sepolia',
      chainId: 84532,
      rpcUrl: String(process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL).trim(),
      escrowAddress: ethers.getAddress(String(process.env.ONCHAIN_BASE_SEPOLIA_ESCROW_ADDRESS).trim()),
      walletFile: path.join(rootDir, 'base-wallets.txt'),
      limit: 20,
      tokens: {
        ETH: { symbol: 'ETH', decimals: 18, address: null },
        USDC: { symbol: 'USDC', decimals: 6, address: ethers.getAddress(String(process.env.ONCHAIN_BASE_SEPOLIA_USDC_ADDRESS).trim()) },
        USDT: { symbol: 'USDT', decimals: 6, address: ethers.getAddress(String(process.env.ONCHAIN_BASE_SEPOLIA_USDT_ADDRESS).trim()) },
      },
    },
    {
      code: 'arb',
      name: 'Arbitrum Sepolia',
      chainId: 421614,
      rpcUrl: String(process.env.ONCHAIN_ARBITRUM_SEPOLIA_RPC_URL).trim(),
      escrowAddress: ethers.getAddress(String(process.env.ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_ADDRESS).trim()),
      walletFile: path.join(rootDir, 'arbitrum-wallets.txt'),
      limit: 20,
      tokens: {
        ETH: { symbol: 'ETH', decimals: 18, address: null },
        USDC: { symbol: 'USDC', decimals: 6, address: ethers.getAddress(String(process.env.ONCHAIN_ARBITRUM_SEPOLIA_USDC_ADDRESS).trim()) },
        USDT: { symbol: 'USDT', decimals: 6, address: ethers.getAddress(String(process.env.ONCHAIN_ARBITRUM_SEPOLIA_USDT_ADDRESS).trim()) },
      },
    },
  ];

  const pool = new Pool({
    connectionString: String(process.env.DATABASE_URL),
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const adminAddress = adminWallet.address.toLowerCase();
    const adminRes = await pool.query(
      `select id, username, email, is_admin, primary_wallet_address
       from users
       where lower(coalesce(primary_wallet_address, '')) = $1
          or exists (
            select 1 from jsonb_array_elements_text(coalesce(wallet_addresses, '[]'::jsonb)) wa
            where lower(wa) = $1
          )
       order by is_admin desc, created_at asc
       limit 1`,
      [adminAddress],
    );

    let adminUser = adminRes.rows[0];
    if (!adminUser) {
      const fallback = await pool.query(
        `select id, username, email, is_admin, primary_wallet_address
         from users
         where is_admin = true
         order by created_at asc
         limit 1`,
      );
      adminUser = fallback.rows[0];
    }

    if (!adminUser) {
      throw new Error('No admin user found in database for challenge creation');
    }

    const usedTitles = new Set();
    const created = [];

    for (const chain of chains) {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId, { staticNetwork: true });
      const signer = adminWallet.connect(provider);
      const nonceState = {
        nextNonce: await provider.getTransactionCount(signer.address, 'pending'),
      };

      // Ensure approvals for stable tokens once per chain
      for (const symbol of ['USDC', 'USDT']) {
        const tokenCfg = chain.tokens[symbol];
        const minAllowance = ethers.parseUnits('1000000', tokenCfg.decimals);
        await ensureTokenApproval({
          wallet: signer,
          tokenAddress: tokenCfg.address,
          escrowAddress: chain.escrowAddress,
          minAllowance,
          nonceState,
        });
      }

      const allWallets = parseWalletAddressesFromFile(chain.walletFile)
        .filter((w) => w.toLowerCase() !== adminWallet.address.toLowerCase());
      const targets = allWallets.slice(0, chain.limit);

      if (targets.length < chain.limit) {
        throw new Error(`${chain.name}: needed ${chain.limit} wallets, found ${targets.length}`);
      }

      for (let idx = 0; idx < targets.length; idx += 1) {
        const challengedWallet = targets[idx];
        const category = pickCategory();
        const title = pickTitle(category, usedTitles);
        const tokenSymbol = pickToken(chain.name);
        const stakeHuman = pickStake(chain.name, tokenSymbol);
        const tokenCfg = chain.tokens[tokenSymbol];
        const stakeAtomic = ethers.parseUnits(stakeHuman, tokenCfg.decimals).toString();
        const amountInt = tokenSymbol === 'ETH' ? 1 : parseInt(stakeHuman, 10);
        const challengerSide = Math.random() < 0.5 ? 'YES' : 'NO';

        const { escrowTxHash } = await sendEscrowTx({
          wallet: signer,
          chain,
          tokenSymbol,
          stakeAtomic,
          nonceState,
        });

        const description = `${title}.`;

        const insertChallenge = await pool.query(
          `insert into challenges (
             challenger,
             challenged,
             challenged_wallet_address,
             title,
             description,
             category,
             amount,
             challenger_side,
             status,
             due_date,
             admin_created,
             settlement_rail,
             chain_id,
             token_symbol,
             token_address,
             decimals,
             stake_atomic,
             escrow_tx_hash,
             created_at
           )
           values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now()
           )
           returning id`,
          [
            adminUser.id,
            null,
            challengedWallet.toLowerCase(),
            title,
            description,
            category,
            amountInt,
            challengerSide,
            'pending',
            randomDueDateIso(),
            false,
            'onchain',
            chain.chainId,
            tokenSymbol,
            tokenCfg.address,
            tokenCfg.decimals,
            stakeAtomic,
            escrowTxHash.toLowerCase(),
          ],
        );

        const challengeId = insertChallenge.rows[0]?.id;
        await pool.query(
          `insert into escrow (challenge_id, amount, status, created_at)
           values ($1, $2, 'holding', now())`,
          [challengeId, amountInt],
        );

        created.push({
          chain: chain.name,
          challengeId,
          challengedWallet: challengedWallet.toLowerCase(),
          title,
          category,
          tokenSymbol,
          stakeHuman,
          stakeAtomic,
          escrowTxHash,
        });

        console.log(
          `[${chain.name}] ${idx + 1}/${targets.length} created | challengeId=${challengeId} | ${tokenSymbol} ${stakeHuman} | wallet=${challengedWallet}`,
        );
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(process.cwd(), `batch-challenge-results-${stamp}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          adminUser: {
            id: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            isAdmin: adminUser.is_admin,
          },
          total: created.length,
          created,
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`DONE: ${created.length} challenges created`);
    console.log(`Results file: ${outPath}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('BATCH_CREATE_FAILED', error);
  process.exit(1);
});
