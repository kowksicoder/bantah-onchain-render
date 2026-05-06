import { network } from "hardhat";

function envKeyForFactory(chainId: number): string {
  if (chainId === 8453) return "BANTAH_LAUNCH_FACTORY_BASE_ADDRESS";
  if (chainId === 84532) return "BANTAH_LAUNCH_FACTORY_BASE_SEPOLIA_ADDRESS";
  if (chainId === 42161) return "BANTAH_LAUNCH_FACTORY_ARBITRUM_ADDRESS";
  if (chainId === 421614) return "BANTAH_LAUNCH_FACTORY_ARBITRUM_SEPOLIA_ADDRESS";
  if (chainId === 1) return "BANTAH_LAUNCH_FACTORY_ETHEREUM_ADDRESS";
  if (chainId === 11155111) return "BANTAH_LAUNCH_FACTORY_ETHEREUM_SEPOLIA_ADDRESS";
  if (chainId === 137) return "BANTAH_LAUNCH_FACTORY_POLYGON_ADDRESS";
  if (chainId === 80002) return "BANTAH_LAUNCH_FACTORY_POLYGON_AMOY_ADDRESS";
  if (chainId === 10) return "BANTAH_LAUNCH_FACTORY_OPTIMISM_ADDRESS";
  if (chainId === 11155420) return "BANTAH_LAUNCH_FACTORY_OPTIMISM_SEPOLIA_ADDRESS";
  return `BANTAH_LAUNCH_FACTORY_${chainId}_ADDRESS`;
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

  console.log(`Deploying BantahTokenFactory on ${chainName} (chainId=${chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const factory = await ethers.getContractFactory("BantahTokenFactory");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const factoryAddress = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash || "unknown";

  console.log(`Factory deployed: ${factoryAddress}`);
  console.log(`Deploy tx hash: ${txHash}`);
  console.log(`${envKeyForFactory(chainId)}=${factoryAddress}`);
}

main().catch((error) => {
  console.error("Token factory deployment failed:", error);
  process.exit(1);
});
