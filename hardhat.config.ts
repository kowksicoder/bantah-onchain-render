import { config as loadEnv } from "dotenv";
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

loadEnv();

const adminPrivateKey = String(process.env.ADMIN_PRIVATE_KEY || "").trim();
const deployerAccounts = adminPrivateKey ? [adminPrivateKey] : [];

export default defineConfig({
  plugins: [hardhatEthers, hardhatVerify],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.ONCHAIN_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: deployerAccounts,
    },
    bscTestnet: {
      type: "http",
      chainType: "l1",
      url:
        process.env.ONCHAIN_BSC_TESTNET_RPC_URL ||
        "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: deployerAccounts,
    },
    arbitrumSepolia: {
      type: "http",
      chainType: "l1",
      url:
        process.env.ONCHAIN_ARBITRUM_SEPOLIA_RPC_URL ||
        "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: deployerAccounts,
    },
    celoAlfajores: {
      type: "http",
      chainType: "l1",
      url:
        process.env.ONCHAIN_CELO_ALFAJORES_RPC_URL ||
        "https://alfajores-forno.celo-testnet.org",
      accounts: deployerAccounts,
    },
    celoSepolia: {
      type: "http",
      chainType: "l1",
      url:
        process.env.ONCHAIN_CELO_SEPOLIA_RPC_URL ||
        "https://forno.celo-sepolia.celo-testnet.org",
      accounts: deployerAccounts,
    },
    unichainSepolia: {
      type: "http",
      chainType: "l1",
      url:
        process.env.ONCHAIN_UNICHAIN_SEPOLIA_RPC_URL ||
        "https://sepolia.unichain.org",
      accounts: deployerAccounts,
    },
  },
  chainDescriptors: {
    11142220: {
      name: "Celo Sepolia",
      chainType: "generic",
      blockExplorers: {
        blockscout: {
          name: "Celo Sepolia Blockscout",
          url: "https://celo-sepolia.blockscout.com",
          apiUrl: "https://celo-sepolia.blockscout.com/api",
        },
      },
    },
    1301: {
      name: "Unichain Sepolia",
      chainType: "generic",
      blockExplorers: {
        blockscout: {
          name: "Unichain Sepolia Blockscout",
          url: "https://unichain-sepolia.blockscout.com",
          apiUrl: "https://unichain-sepolia.blockscout.com/api",
        },
      },
    },
  },
  verify: {
    etherscan: {
      enabled: true,
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
    blockscout: {
      enabled: true,
    },
    sourcify: {
      enabled: true,
    },
  },
});
