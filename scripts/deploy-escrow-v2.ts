import { network } from "hardhat";
import { ethers } from "ethers";

const DEFAULT_FEE_PPM = 180; // 0.018%

function envKeyForChain(
  chainId: number,
  chainName: string,
  suffix: string,
): string {
  const keyByChainId: Record<number, string> = {
    84532: `ONCHAIN_BASE_SEPOLIA_${suffix}`,
    97: `ONCHAIN_BSC_TESTNET_${suffix}`,
    421614: `ONCHAIN_ARBITRUM_SEPOLIA_${suffix}`,
    56: `ONCHAIN_BSC_${suffix}`,
    44787: `ONCHAIN_CELO_ALFAJORES_${suffix}`,
    42220: `ONCHAIN_CELO_${suffix}`,
    11142220: `ONCHAIN_CELO_SEPOLIA_${suffix}`,
    1301: `ONCHAIN_UNICHAIN_SEPOLIA_${suffix}`,
    130: `ONCHAIN_UNICHAIN_${suffix}`,
    8453: `ONCHAIN_BASE_${suffix}`,
    42161: `ONCHAIN_ARBITRUM_${suffix}`,
  };

  return keyByChainId[chainId] || `ONCHAIN_${chainName.toUpperCase()}_${suffix}`;
}

async function main() {
  const { ethers: hardhatEthers } = await network.connect();
  const provider = hardhatEthers.provider;
  const adminPrivateKey = String(process.env.ADMIN_PRIVATE_KEY || "").trim();
  if (!adminPrivateKey) {
    throw new Error("No deployer account available. Set ADMIN_PRIVATE_KEY in .env");
  }

  const deployer = new ethers.Wallet(adminPrivateKey, provider);
  const ownerFromEnv = String(process.env.ADMIN_ADDRESS || "").trim();
  const owner = ownerFromEnv || deployer.address;

  const chainInfo = await deployer.provider.getNetwork();
  const chainId = Number(chainInfo.chainId);
  const argNetworkIndex = process.argv.findIndex((arg) => arg === "--network");
  const networkFromArgs =
    argNetworkIndex >= 0 && process.argv[argNetworkIndex + 1]
      ? String(process.argv[argNetworkIndex + 1]).trim()
      : "";
  const networkFromEnv = String(process.env.HARDHAT_NETWORK || "").trim();
  const chainName = networkFromArgs || networkFromEnv || `chain-${chainId}`;

  const escrowEnvKey = envKeyForChain(chainId, chainName, "ESCROW_ADDRESS");
  const treasuryEnvKey = envKeyForChain(chainId, chainName, "TREASURY_ADDRESS");
  const feeEnvKey = envKeyForChain(chainId, chainName, "ESCROW_FEE_PPM");

  const treasury =
    String(process.env[treasuryEnvKey] || "").trim() ||
    String(process.env.ONCHAIN_TREASURY_ADDRESS || "").trim() ||
    owner;
  if (!ethers.isAddress(treasury)) {
    throw new Error(
      `Invalid treasury address. Set ${treasuryEnvKey} or ONCHAIN_TREASURY_ADDRESS in .env`,
    );
  }

  const feePpmRaw =
    String(process.env[feeEnvKey] || "").trim() ||
    String(process.env.ONCHAIN_ESCROW_FEE_PPM || "").trim() ||
    String(DEFAULT_FEE_PPM);
  const feePpm = Number.parseInt(feePpmRaw, 10);
  if (!Number.isInteger(feePpm) || feePpm < 0) {
    throw new Error(
      `Invalid fee ppm. Set ${feeEnvKey} or ONCHAIN_ESCROW_FEE_PPM to an integer value`,
    );
  }

  console.log(`Deploying BantahEscrowV2 on ${chainName} (chainId=${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Fee (ppm): ${feePpm}`);

  const EscrowFactory = await hardhatEthers.getContractFactory("BantahEscrowV2", deployer);
  const escrow = await EscrowFactory.deploy(owner, treasury, feePpm);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  const txHash = escrow.deploymentTransaction()?.hash;

  console.log("===============================================");
  console.log(`Escrow V2 deployed: ${escrowAddress}`);
  console.log(`Deploy tx hash: ${txHash || "unknown"}`);
  console.log("Set these envs for the corresponding chain:");
  console.log(`${escrowEnvKey}=${escrowAddress}`);
  console.log(`${treasuryEnvKey}=${treasury}`);
  console.log(`${feeEnvKey}=${feePpm}`);
  console.log("===============================================");
}

main().catch((error) => {
  console.error("Escrow V2 deployment failed:", error);
  process.exitCode = 1;
});
