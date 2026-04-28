require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    // ── 0G Testnet (Galileo) ───────────────────────────────────────────────
    testnet: {
      url:      "https://evmrpc-testnet.0g.ai",
      chainId:  16602,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },

    // ── 0G Mainnet ────────────────────────────────────────────────────────
    mainnet: {
      url:      "https://evmrpc.0g.ai",
      chainId:  16661,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },

    // ── Local Hardhat node (for testing) ──────────────────────────────────
    hardhat: {
      chainId: 31337,
    },
  },

  // ── Contract Verification (0G Chain Scan) ────────────────────────────────
  etherscan: {
    apiKey: {
      testnet: process.env.ETHERSCAN_API_KEY || "placeholder",
      mainnet: process.env.ETHERSCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network:  "testnet",
        chainId:  16602,
        urls: {
          apiURL:     "https://chainscan-galileo.0g.ai/open/api",
          browserURL: "https://chainscan-galileo.0g.ai",
        },
      },
      {
        network:  "mainnet",
        chainId:  16661,
        urls: {
          apiURL:     "https://chainscan.0g.ai/open/api",
          browserURL: "https://chainscan.0g.ai",
        },
      },
    ],
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
