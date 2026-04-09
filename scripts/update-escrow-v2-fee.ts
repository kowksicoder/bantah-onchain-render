import { config as loadEnv } from "dotenv";
import { network } from "hardhat";
import { ethers } from "ethers";

loadEnv();

const DEFAULT_TARGET_FEE_PPM = 9000; // 0.9%

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

  const signer = new ethers.Wallet(adminPrivateKey, provider);
  const chainInfo = await signer.provider.getNetwork();
  const chainId = Number(chainInfo.chainId);
  const argNetworkIndex = process.argv.findIndex((arg) => arg === "--network");
  const networkFromArgs =
    argNetworkIndex >= 0 && process.argv[argNetworkIndex + 1]
      ? String(process.argv[argNetworkIndex + 1]).trim()
      : "";
  const networkFromEnv = String(process.env.HARDHAT_NETWORK || "").trim();
  const chainName = networkFromArgs || networkFromEnv || `chain-${chainId}`;

  const escrowEnvKey = envKeyForChain(chainId, chainName, "ESCROW_ADDRESS");
  const feeEnvKey = envKeyForChain(chainId, chainName, "ESCROW_FEE_PPM");

  const escrowAddress = String(process.env[escrowEnvKey] || "").trim();
  if (!ethers.isAddress(escrowAddress)) {
    throw new Error(`Invalid escrow address. Set ${escrowEnvKey} in .env`);
  }

  const targetFeeRaw =
    String(process.env[feeEnvKey] || "").trim() ||
    String(process.env.ONCHAIN_ESCROW_FEE_PPM || "").trim() ||
    String(DEFAULT_TARGET_FEE_PPM);
  const targetFeePpm = Number.parseInt(targetFeeRaw, 10);
  if (!Number.isInteger(targetFeePpm) || targetFeePpm < 0) {
    throw new Error(
      `Invalid fee ppm. Set ${feeEnvKey} or ONCHAIN_ESCROW_FEE_PPM to an integer value`,
    );
  }

  const escrow = await hardhatEthers.getContractAt("BantahEscrowV2", escrowAddress, signer);
  const currentOwner = await escrow.owner();
  const currentFeePpm = Number(await escrow.feePpm());

  console.log(`Updating BantahEscrowV2 fee on ${chainName} (chainId=${chainId})`);
  console.log(`Escrow: ${escrowAddress}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`Owner: ${currentOwner}`);
  console.log(`Current fee ppm: ${currentFeePpm}`);
  console.log(`Target fee ppm: ${targetFeePpm}`);

  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Configured signer is not the escrow owner. Refusing to continue.");
  }

  if (currentFeePpm === targetFeePpm) {
    console.log("Fee is already set to the target value. No transaction needed.");
    return;
  }

  const tx = await escrow.setFeePpm(targetFeePpm);
  console.log(`Submitted tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt?.blockNumber || "unknown"}`);
  console.log("Fee updated successfully.");
}

main().catch((error) => {
  console.error("Escrow V2 fee update failed:", error);
  process.exitCode = 1;
});
