import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account available. Set ADMIN_PRIVATE_KEY in .env");
  }

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
  const escrowEnvKeyByChainId: Record<number, string> = {
    84532: "ONCHAIN_BASE_SEPOLIA_ESCROW_ADDRESS",
    97: "ONCHAIN_BSC_TESTNET_ESCROW_ADDRESS",
    421614: "ONCHAIN_ARBITRUM_SEPOLIA_ESCROW_ADDRESS",
    44787: "ONCHAIN_CELO_ALFAJORES_ESCROW_ADDRESS",
    11142220: "ONCHAIN_CELO_SEPOLIA_ESCROW_ADDRESS",
    1301: "ONCHAIN_UNICHAIN_SEPOLIA_ESCROW_ADDRESS",
  };
  const escrowEnvKey =
    escrowEnvKeyByChainId[chainId] || `ONCHAIN_${chainName.toUpperCase()}_ESCROW_ADDRESS`;

  console.log(`Deploying BantahEscrow on ${chainName} (chainId=${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${owner}`);

  const EscrowFactory = await ethers.getContractFactory("BantahEscrow");
  const escrow = await EscrowFactory.deploy(owner);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  const txHash = escrow.deploymentTransaction()?.hash;

  console.log("===============================================");
  console.log(`Escrow deployed: ${escrowAddress}`);
  console.log(`Deploy tx hash: ${txHash || "unknown"}`);
  console.log("Set this env for the corresponding chain:");
  console.log(`${escrowEnvKey}=${escrowAddress}`);
  console.log("===============================================");
}

main().catch((error) => {
  console.error("Escrow deployment failed:", error);
  process.exitCode = 1;
});
