import { OG_GALILEO } from "@/lib/chain-0g"

export const GUARDMESH_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined) ??
  "0x0925e20438AF659048643Ce747aEe38A7b916E54"

export const GUARDMESH_AUDIT_ADDRESS =
  (process.env.NEXT_PUBLIC_AUDIT_ADDRESS as `0x${string}` | undefined) ??
  "0x522748669646A1a099474cd7f98060968A80E812"

export const PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_0G_RPC_URL ?? OG_GALILEO.rpcUrl

export const CHAIN_ID = Number(OG_GALILEO.chainId)

/**
 * Ordered list for read/receipt polling when the primary RPC errors (500, etc.).
 * Sending still uses whatever RPC MetaMask has configured for Galileo.
 */
export function getGalileoReadRpcCandidates(): string[] {
  const primary = process.env.NEXT_PUBLIC_0G_RPC_URL?.trim() || OG_GALILEO.rpcUrl
  return [
    ...new Set([
      primary,
      OG_GALILEO.rpcUrl,
      "https://0g-galileo-testnet.drpc.org",
      "https://rpc.ankr.com/0g_galileo_testnet_evm",
    ]),
  ]
}

/** GuardMeshAudit.sol outcome codes */
export const OUTCOME = {
  APPROVED: 1,
  BLOCKED: 2,
  CONTESTED: 3,
  PENDING: 4,
} as const

/** GuardMeshRegistry.sol threshold codes */
export const THRESHOLD = {
  ANY: 1,
  MAJORITY: 2,
  UNANIMOUS: 3,
} as const

export function outcomeLabel(code: number): string {
  switch (code) {
    case OUTCOME.APPROVED:
      return "approved"
    case OUTCOME.BLOCKED:
      return "blocked"
    case OUTCOME.CONTESTED:
      return "contested"
    case OUTCOME.PENDING:
      return "pending"
    default:
      return `unknown(${code})`
  }
}

export function thresholdLabel(t: number): string {
  switch (t) {
    case THRESHOLD.ANY:
      return "Any 1"
    case THRESHOLD.MAJORITY:
      return "Majority (2/3)"
    case THRESHOLD.UNANIMOUS:
      return "Unanimous (3/3)"
    default:
      return String(t)
  }
}
