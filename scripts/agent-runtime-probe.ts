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

async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
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

    const runtimeAction = await readJson(`http://localhost:5100/api/agents/runtime/${agentId}`, {
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

    console.log(`[probe] runtime action status=${runtimeAction.status}`);
    console.log(JSON.stringify(runtimeAction.data, null, 2));

    if (!runtimeAction.ok || runtimeAction.data?.ok !== true) {
      throw new Error("Runtime action probe failed.");
    }

    challengeId =
      Number(runtimeAction?.data?.result?.marketId || runtimeAction?.data?.result?.challengeId) || null;

    const runtimeState = await readJson(
      `http://localhost:5100/api/agents/${agentId}/runtime-state`,
    );
    console.log(`[probe] runtime-state status=${runtimeState.status}`);
    console.log(JSON.stringify(runtimeState.data, null, 2));

    if (!runtimeState.ok || runtimeState.data?.health !== "healthy" || runtimeState.data?.isManagedRuntimeLive !== true) {
      throw new Error("Runtime state probe failed.");
    }

    const walletStatus = runtimeState.data?.wallet?.status;
    const walletMessage = String(runtimeState.data?.wallet?.message || "");
    if (walletStatus === "error" && /account with given address not found/i.test(walletMessage)) {
      console.warn(
        "[probe] wallet warning: disposable probe uses synthetic wallet data, so balance lookup can fail without indicating a managed-runtime regression.",
      );
    }

    const managedHealth = await readJson(
      `http://localhost:5100/api/agents/health/managed-runtimes`,
    );
    console.log(`[probe] managed-runtime-health status=${managedHealth.status}`);
    console.log(
      JSON.stringify(
        {
          summary: managedHealth.data?.summary || null,
          probeAgent: Array.isArray(managedHealth.data?.items)
            ? managedHealth.data.items.find((item: any) => item.agentId === agentId) || null
            : null,
        },
        null,
        2,
      ),
    );

    const probeSummary = managedHealth.data?.summary;
    const probeAgent =
      Array.isArray(managedHealth.data?.items)
        ? managedHealth.data.items.find((item: any) => item.agentId === agentId) || null
        : null;

    if (
      !managedHealth.ok ||
      !probeSummary ||
      probeSummary.healthy < 1 ||
      !probeAgent ||
      probeAgent.health !== "healthy"
    ) {
      throw new Error("Managed runtime health probe failed.");
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
