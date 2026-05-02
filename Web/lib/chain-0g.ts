/** 0G Galileo testnet — same as GuardMesh / guardian stack (Hardhat + deployed contracts). */
export const OG_GALILEO = {
  chainId: 16602n,
  chainIdHex: "0x40da" as const,
  name: "0G Galileo Testnet",
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  explorer: "https://chainscan-galileo.0g.ai",
  nativeCurrency: {
    name: "0G",
    symbol: "0G",
    decimals: 18,
  },
} as const

/** Galileo chain explorer URL for an EVM transaction (e.g. 0G Storage / flow KV batch tx). */
export function galileoTxExplorerUrl(txHash: string): string {
  const h = String(txHash || "").trim()
  return `${OG_GALILEO.explorer}/tx/${h}`
}

/**
 * MetaMask / community lists sometimes used chain id **16601 (0x40d9)** with the same RPC.
 * GuardMesh contracts live on **16602 (0x40da)** — MetaMask refuses `wallet_addEthereumChain`
 * for 0x40da if another entry already uses this RPC (duplicate endpoint error).
 */
export const LEGACY_GALILEO_WRONG_CHAIN_ID = 16601n

export function is0gGalileo(chainId: bigint | number | undefined): boolean {
  if (chainId === undefined) return false
  const n = typeof chainId === "bigint" ? chainId : BigInt(chainId)
  return n === OG_GALILEO.chainId
}

export function isLegacyWrongGalileoChain(chainId: bigint | number | undefined): boolean {
  if (chainId === undefined) return false
  const n = typeof chainId === "bigint" ? chainId : BigInt(chainId)
  return n === LEGACY_GALILEO_WRONG_CHAIN_ID
}

export const DUPLICATE_GALILEO_NETWORK_HELP =
  "MetaMask has an old 0G testnet with the wrong chain ID (16601 / 0x40d9) using the same RPC as Galileo. " +
  "Open MetaMask → ⋮ → Settings → Networks, delete that \"0G-Galileo-Testnet\" (or any 0G entry on evmrpc-testnet.0g.ai that is NOT chain 16602), then click Connect again so Galileo (16602) can be added."
