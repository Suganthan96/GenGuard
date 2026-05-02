/**
 * Phase 6 — 0G Storage (TypeScript SDK) + GuardMeshAudit.recordDecision.
 *
 * Follows 0G docs: Turbo indexer + `MemData` / `newSymmetricEncryptedFile`,
 * `merkleTree()` before `indexer.upload`, then anchor the same root on-chain.
 *
 * @see https://docs.0g.ai — Storage SDK (TypeScript)
 */

import { Contract, JsonRpcProvider, Wallet, type Signer } from "ethers"
import { EncryptedFile, Indexer, MemData, newSymmetricEncryptedFile } from "@0gfoundation/0g-ts-sdk"

import type { VerdictRow } from "@/lib/axl-types"
import type { GuardmeshIntent } from "@/lib/guardmesh-intent"
import type { GuardmeshConsensus } from "@/lib/guardmesh-consensus"
import { GUARDMESH_AUDIT_ADDRESS, PUBLIC_RPC_URL } from "@/lib/contracts-config"
import { OG_GALILEO } from "@/lib/chain-0g"
import { fetchRegistryPolicyAsKvRecord } from "@/lib/guardmesh-kv-sync-from-chain"

const AUDIT_ABI = [
  "function recordDecision(string agentId, bytes32 merkleRoot, bool approved, uint8 outcome, string actionType, string target, uint8 approveCount, uint8 blockCount, string blockedReason, uint256 intentTimestamp) external",
] as const

/** Default: Turbo testnet (recommended in 0G docs). */
const DEFAULT_INDEXER_TURBO = "https://indexer-storage-testnet-turbo.0g.ai"
const DEFAULT_INDEXER_STANDARD = "https://indexer-storage-testnet-standard.0g.ai"

export type GuardmeshPhase6Bundle = {
  schemaVersion: 1
  decidedAtIso: string
  decidedAtUnix: number
  encryption: "none" | "symmetric_aes256_ctr_v1"
  intent: GuardmeshIntent
  /** Policy snapshot at decision time (source of scope/action limits shown to users). */
  policySnapshot?: {
    agentId: string
    roleScope: string
    allowedActions: string[]
    deniedActions: string[]
    allowedDataSources: string[]
    consensusThreshold: number
    active: boolean
    source: string
  }
  verdicts: VerdictRow[]
  teeVerification: { peer_id: string; tee_verified: boolean | null }[]
  consensus: GuardmeshConsensus
  sendResults: unknown
}

function normalizeRuntimePolicyFromVerdictRaw(raw: unknown): GuardmeshPhase6Bundle["policySnapshot"] | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const agentId = String(r.agentId ?? "").trim()
  if (!agentId) return null
  return {
    agentId,
    roleScope: String(r.roleScope ?? "").trim(),
    allowedActions: Array.isArray(r.allowedActions) ? r.allowedActions.map((v) => String(v)) : [],
    deniedActions: Array.isArray(r.deniedActions) ? r.deniedActions.map((v) => String(v)) : [],
    allowedDataSources: Array.isArray(r.allowedDataSources)
      ? r.allowedDataSources.map((v) => String(v))
      : [],
    consensusThreshold: Number(r.consensusThreshold ?? 0),
    active: Boolean(r.active),
    source: String(r.policy_source ?? "").trim() || "runtime",
  }
}

function snapshotFingerprint(p: NonNullable<GuardmeshPhase6Bundle["policySnapshot"]>): string {
  return JSON.stringify({
    agentId: p.agentId,
    roleScope: p.roleScope,
    allowedActions: [...p.allowedActions].sort(),
    deniedActions: [...p.deniedActions].sort(),
    allowedDataSources: [...p.allowedDataSources].sort(),
    consensusThreshold: p.consensusThreshold,
    active: p.active,
    source: p.source,
  })
}

export type GuardmeshPhase6Result =
  | { enabled: false }
  | {
      enabled: true
      ok: false
      stage: "config" | "bundle" | "merkle" | "upload" | "record" | "unexpected"
      message: string
    }
  | {
      enabled: true
      ok: true
      merkleRoot: string
      encryption: GuardmeshPhase6Bundle["encryption"]
      storage: {
        indexerUrl: string
        mode: "turbo" | "standard"
        txHash: string
        txSeq: number
        explorerUrl: string
      }
      chain: {
        recordTxHash: string
        explorerUrl: string
        auditContract: string
      }
    }

function truthyEnv(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase()
  return s === "1" || s === "true" || s === "yes"
}

function parseSymmetricKey32(raw: string | undefined): Uint8Array | null {
  const t = raw?.trim()
  if (!t) return null
  const hex = t.startsWith("0x") ? t.slice(2) : t
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null
  return new Uint8Array(Buffer.from(hex, "hex"))
}

function buildBundle(args: {
  intent: GuardmeshIntent
  policySnapshot?: GuardmeshPhase6Bundle["policySnapshot"]
  verdicts: VerdictRow[]
  consensus: GuardmeshConsensus
  sendResults: unknown
  encryption: GuardmeshPhase6Bundle["encryption"]
}): GuardmeshPhase6Bundle {
  const decidedAtUnix = Math.floor(Date.now() / 1000)
  return {
    schemaVersion: 1,
    decidedAtIso: new Date(decidedAtUnix * 1000).toISOString(),
    decidedAtUnix,
    encryption: args.encryption,
    intent: args.intent,
    policySnapshot: args.policySnapshot,
    verdicts: args.verdicts,
    teeVerification: args.verdicts.map((v) => ({
      peer_id: v.peerId,
      tee_verified: typeof v.tee_verified === "boolean" ? v.tee_verified : null,
    })),
    consensus: args.consensus,
    sendResults: args.sendResults,
  }
}

function aggregateBlockedReason(verdicts: VerdictRow[], consensus: GuardmeshConsensus): string {
  const parts = verdicts
    .filter((v) => (v.verdict || "").trim().toUpperCase() === "BLOCK")
    .map((v) => v.reason?.trim())
    .filter((s): s is string => Boolean(s))
  const joined = parts.length ? parts.join(" | ") : consensus.rationale
  return joined.slice(0, 3500)
}

function indexerUrlAndMode(): { url: string; mode: "turbo" | "standard" } {
  const explicit = process.env.GUARDMESH_0G_STORAGE_INDEXER_URL?.trim()
  if (explicit) {
    const mode = explicit.includes("standard") ? "standard" : "turbo"
    return { url: explicit, mode }
  }
  const mode = (process.env.GUARDMESH_0G_STORAGE_MODE ?? "turbo").trim().toLowerCase()
  if (mode === "standard") {
    return { url: DEFAULT_INDEXER_STANDARD, mode: "standard" }
  }
  return { url: DEFAULT_INDEXER_TURBO, mode: "turbo" }
}

/**
 * When `GUARDMESH_PHASE6_ANCHOR=1` and `GUARDMESH_AUDIT_RECORDER_PRIVATE_KEY` are set,
 * uploads the decision bundle to 0G Storage and calls `GuardMeshAudit.recordDecision`.
 * Failures are returned in `GuardmeshPhase6Result` — the intent HTTP handler should not fail.
 */
export async function runGuardmeshPhase6Anchor(args: {
  intent: GuardmeshIntent
  verdicts: VerdictRow[]
  consensus: GuardmeshConsensus
  sendResults: unknown
}): Promise<GuardmeshPhase6Result> {
  if (!truthyEnv(process.env.GUARDMESH_PHASE6_ANCHOR)) {
    return { enabled: false }
  }

  const pk = process.env.GUARDMESH_AUDIT_RECORDER_PRIVATE_KEY?.trim()
  if (!pk) {
    return {
      enabled: true,
      ok: false,
      stage: "config",
      message:
        "GUARDMESH_PHASE6_ANCHOR is set but GUARDMESH_AUDIT_RECORDER_PRIVATE_KEY is missing. Set the same hot wallet you authorized on GuardMeshAudit (pays storage gas + submits recordDecision).",
    }
  }

  try {
    const symKey = parseSymmetricKey32(process.env.GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX)
    const encryption: GuardmeshPhase6Bundle["encryption"] = symKey ? "symmetric_aes256_ctr_v1" : "none"
    let policySnapshot: GuardmeshPhase6Bundle["policySnapshot"] | undefined
    const runtimeSnapshots = new Map<string, NonNullable<GuardmeshPhase6Bundle["policySnapshot"]>>()
    for (const v of args.verdicts || []) {
      const raw = (v.raw as { policy_used?: unknown } | undefined)?.policy_used
      const normalized = normalizeRuntimePolicyFromVerdictRaw(raw)
      if (!normalized) continue
      runtimeSnapshots.set(snapshotFingerprint(normalized), normalized)
    }
    if (runtimeSnapshots.size === 1) {
      policySnapshot = [...runtimeSnapshots.values()][0]
    } else {
      try {
        const p = await fetchRegistryPolicyAsKvRecord(args.intent.agent_id)
        policySnapshot = {
          agentId: p.agentId,
          roleScope: p.roleScope,
          allowedActions: p.allowedActions,
          deniedActions: p.deniedActions,
          allowedDataSources: p.allowedDataSources,
          consensusThreshold: p.consensusThreshold,
          active: p.active,
          source: p.source || "chain-sync",
        }
      } catch {
        // Keep anchoring resilient even when policy fetch is temporarily unavailable.
        policySnapshot = undefined
      }
    }

    let bundle: GuardmeshPhase6Bundle
    try {
      bundle = buildBundle({
        ...args,
        policySnapshot,
        encryption,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { enabled: true, ok: false, stage: "bundle", message }
    }

    const json = JSON.stringify(bundle)
    const jsonBytes = new TextEncoder().encode(json)
    const inner = new MemData(Array.from(jsonBytes))

    let file: MemData | EncryptedFile
    try {
      file = symKey ? newSymmetricEncryptedFile(inner, symKey) : inner
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { enabled: true, ok: false, stage: "bundle", message: `encrypt: ${message}` }
    }

    const [tree, treeErr] = await file.merkleTree()
    if (treeErr || !tree) {
      return {
        enabled: true,
        ok: false,
        stage: "merkle",
        message: treeErr ? String(treeErr.message ?? treeErr) : "merkleTree() returned null",
      }
    }

    const rh = tree.rootHash()
    if (!rh) {
      return { enabled: true, ok: false, stage: "merkle", message: "merkleTree.rootHash() returned null" }
    }
    const merkleRoot = String(rh)
    if (!/^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) {
      return {
        enabled: true,
        ok: false,
        stage: "merkle",
        message: `Invalid merkle root from SDK: ${merkleRoot}`,
      }
    }

    const { url: indexerUrl, mode } = indexerUrlAndMode()
    const rpcUrl = process.env.GUARDMESH_0G_EVM_RPC_URL?.trim() || PUBLIC_RPC_URL

    let signer: Signer
    try {
      const provider = new JsonRpcProvider(rpcUrl)
      signer = new Wallet(pk.startsWith("0x") ? pk : `0x${pk}`, provider)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { enabled: true, ok: false, stage: "config", message: `wallet/rpc: ${message}` }
    }

    const indexer = new Indexer(indexerUrl)
    type SingleUpload = { txHash: string; rootHash: string; txSeq: number }
    let txResult: SingleUpload | { txHashes: string[]; rootHashes: string[]; txSeqs: number[] } | null = null
    let uploadErr: Error | null = null
    try {
      const [tx, err] = await indexer.upload(file, rpcUrl, signer)
      txResult = tx
      uploadErr = err ? (err instanceof Error ? err : new Error(String(err))) : null
    } catch (e) {
      uploadErr = e instanceof Error ? e : new Error(String(e))
    }
    if (uploadErr) {
      return {
        enabled: true,
        ok: false,
        stage: "upload",
        message: String(uploadErr.message ?? uploadErr),
      }
    }

    if (!txResult || !("rootHash" in txResult)) {
      return {
        enabled: true,
        ok: false,
        stage: "upload",
        message: "Unexpected upload response (fragmented roots) — implement multi-root anchoring if needed.",
      }
    }

    const storageTxHash = txResult.txHash
    const txSeq = txResult.txSeq
    if (String(txResult.rootHash).toLowerCase() !== merkleRoot.toLowerCase()) {
      return {
        enabled: true,
        ok: false,
        stage: "upload",
        message: `SDK root mismatch: tree=${merkleRoot} upload=${txResult.rootHash}`,
      }
    }

    const auditAddr =
      process.env.GUARDMESH_AUDIT_CONTRACT_ADDRESS?.trim() ||
      process.env.NEXT_PUBLIC_AUDIT_ADDRESS?.trim() ||
      GUARDMESH_AUDIT_ADDRESS

    const contract = new Contract(auditAddr, AUDIT_ABI, signer)
    const approved = args.consensus.execute
    const outcome = args.consensus.outcomeCode
    const blockedReason = aggregateBlockedReason(args.verdicts, args.consensus)

    try {
      const recTx = await contract.recordDecision(
        args.intent.agent_id,
        merkleRoot,
        approved,
        outcome,
        args.intent.action_type,
        args.intent.target,
        args.consensus.approveCount,
        args.consensus.blockCount,
        blockedReason,
        BigInt(bundle.decidedAtUnix)
      )
      const waited = await recTx.wait()
      const recordTxHash = waited?.hash ?? recTx.hash

      return {
        enabled: true,
        ok: true,
        merkleRoot,
        encryption,
        storage: {
          indexerUrl,
          mode,
          txHash: storageTxHash,
          txSeq,
          explorerUrl: `${OG_GALILEO.explorer}/tx/${storageTxHash}`,
        },
        chain: {
          recordTxHash,
          explorerUrl: `${OG_GALILEO.explorer}/tx/${recordTxHash}`,
          auditContract: auditAddr,
        },
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        enabled: true,
        ok: false,
        stage: "record",
        message: `0G Storage upload succeeded (root ${merkleRoot}) but recordDecision failed: ${message}`,
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      enabled: true,
      ok: false,
      stage: "unexpected",
      message: `Phase 6 failed before returning a structured error: ${message}`,
    }
  }
}
