import { network } from "hardhat";
import { parseUnits } from "ethers";

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof fallback === "string") return fallback;
  throw new Error(`Missing required env var: ${name}`);
}

function envKeyForToken(chainId: number, symbol: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  if (chainId === 84532) return `ONCHAIN_BASE_SEPOLIA_${normalizedSymbol}_ADDRESS`;
  if (chainId === 421614) return `ONCHAIN_ARBITRUM_SEPOLIA_${normalizedSymbol}_ADDRESS`;
  if (chainId === 97) return `ONCHAIN_BSC_TESTNET_${normalizedSymbol}_ADDRESS`;
  if (chainId === 11142220) return `ONCHAIN_CELO_SEPOLIA_${normalizedSymbol}_ADDRESS`;
  if (chainId === 1301) return `ONCHAIN_UNICHAIN_SEPOLIA_${normalizedSymbol}_ADDRESS`;
  return `ONCHAIN_${chainId}_${normalizedSymbol}_ADDRESS`;
}

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account found. Set ADMIN_PRIVATE_KEY in .env");
  }

  const chain = await deployer.provider.getNetwork();
  const chainId = Number(chain.chainId);
  const chainName = chain.name || `chain-${chainId}`;

  const tokenName = readEnv("TOKEN_NAME", "Bantah USD Coin");
  const tokenSymbol = readEnv("TOKEN_SYMBOL", "USDC").toUpperCase();
  const tokenDecimals = Number(readEnv("TOKEN_DECIMALS", "6"));
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) {
    throw new Error(`Invalid TOKEN_DECIMALS: ${tokenDecimals}`);
  }

  const initialSupplyHuman = readEnv("TOKEN_INITIAL_SUPPLY", "100000000");
  const initialOwner = readEnv("TOKEN_INITIAL_OWNER", deployer.address);
  const initialSupplyAtomic = parseUnits(initialSupplyHuman, tokenDecimals);

  console.log(`Deploying BantahTestToken on ${chainName} (chainId=${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Token: ${tokenName} (${tokenSymbol})`);
  console.log(`Decimals: ${tokenDecimals}`);
  console.log(`Initial owner: ${initialOwner}`);
  console.log(`Initial supply (human): ${initialSupplyHuman}`);
  console.log(`Initial supply (atomic): ${initialSupplyAtomic.toString()}`);

  const factory = await ethers.getContractFactory("BantahTestToken");
  const token = await factory.deploy(
    tokenName,
    tokenSymbol,
    tokenDecimals,
    initialOwner,
    initialSupplyAtomic,
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const txHash = token.deploymentTransaction()?.hash || "unknown";

  console.log(`Token deployed: ${tokenAddress}`);
  console.log(`Deploy tx hash: ${txHash}`);
  console.log(`${envKeyForToken(chainId, tokenSymbol)}=${tokenAddress}`);
}

main().catch((error) => {
  console.error("Token deployment failed:", error);
  process.exit(1);
});
