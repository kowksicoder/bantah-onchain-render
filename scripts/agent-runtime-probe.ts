import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Client } from "pg";
import { buildBantahAgentEndpointUrl, DEFAULT_BANTAH_AGENT_SKILLS } from "../server/agentProvisioning";
import { buildBantahElizaCharacter, buildBantahElizaRuntimeConfig } from "../server/elizaAgentBuilder";

function loadEnv(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnv(path.resolve(process.cwd(), ".env"));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const ownerResult = await client.query<{ id: string }>(
    `select id from users order by created_at asc nulls last limit 1`,
  );
  const ownerId = ownerResult.rows[0]?.id;
  if (!ownerId) {
    throw new Error("No user found to attach the disposable agent to.");
  }

  const agentId = crypto.randomUUID();
  const walletAddress = `0x${crypto.randomBytes(20).toString("hex")}`;
  const ownerWalletAddress = `0x${crypto.randomBytes(20).toString("hex")}`;
  const agentName = `Runtime Probe ${Date.now()}`;
  const specialty = "general" as const;
  const chainId = 8453;
  const chainName = "Base";
  const walletNetworkId = "base-mainnet";
  const endpointUrl = buildBantahAgentEndpointUrl(agentId);

  const character = buildBantahElizaCharacter({
    agentId,
    agentName,
    specialty,
    walletAddress,
    chainId,
    chainName,
    walletNetworkId,
    skillActions: [...DEFAULT_BANTAH_AGENT_SKILLS],
    endpointUrl,
  });

  const runtimeConfig = buildBantahElizaRuntimeConfig({
    agentId,
    endpointUrl,
    chainId,
    chainName,
    walletAddress,
    walletNetworkId,
    walletProvider: "cdp_smart_wallet",
    skillActions: [...DEFAULT_BANTAH_AGENT_SKILLS],
    character,
  });

  let challengeId: number | null = null;

  try {
    await client.query(
      `insert into agents (
        agent_id,
        owner_id,
        agent_name,
        agent_type,
        wallet_address,
        endpoint_url,
        bantah_skill_version,
        specialty,
        status,
        skill_actions,
        wallet_network_id,
        wallet_provider,
        owner_wallet_address,
        wallet_data,
        runtime_engine,
        runtime_status,
        runtime_config,
        is_tokenized,
        last_skill_check_status,
        created_at,
        updated_at
      ) values (
        $1,$2,$3,'bantah_created',$4,$5,'1.0.0',$6,'active',$7::jsonb,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb,false,'passed',now(),now()
      )`,
      [
        agentId,
        ownerId,
        agentName,
        walletAddress,
        endpointUrl,
        specialty,
        JSON.stringify(DEFAULT_BANTAH_AGENT_SKILLS),
        walletNetworkId,
        "cdp_smart_wallet",
        ownerWalletAddress,
        JSON.stringify({
          address: walletAddress,
          ownerAddress: ownerWalletAddress,
          name: "probe-wallet",
        }),
        runtimeConfig.engine,
        "active",
        JSON.stringify(runtimeConfig),
      ],
    );

    const response = await fetch(`http://localhost:5100/api/agents/runtime/${agentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_market",
        requestId: `req_${Date.now()}`,
        payload: {
          question: `Will runtime probe ${Date.now()} succeed?`,
          options: ["YES", "NO"],
          stakeAmount: "15",
          currency: "USDC",
          chainId: 8453,
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
    });

    const text = await response.text();
    console.log(`status=${response.status}`);
    console.log(text);

    try {
      const data = JSON.parse(text);
      challengeId = data?.result?.challengeId ?? null;
    } catch {
      challengeId = null;
    }
  } finally {
    if (challengeId) {
      await client.query(`delete from challenges where id = $1`, [challengeId]);
    }
    await client.query(`delete from agents where agent_id = $1`, [agentId]);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
