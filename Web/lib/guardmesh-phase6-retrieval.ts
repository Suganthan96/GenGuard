/**
 * Phase 6 Retrieval — Download and decrypt decision bundles from 0G Storage
 *
 * Fetches the full decision bundle (intent + verdicts + consensus) from 0G Storage
 * using the merkle root, verifies it against on-chain data, and decrypts if needed.
 */

import { Contract, JsonRpcProvider } from "ethers"
import { Indexer } from "@0gfoundation/0g-ts-sdk"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { GuardmeshPhase6Bundle } from "@/lib/guardmesh-phase6-anchor"
import { GUARDMESH_AUDIT_ADDRESS, PUBLIC_RPC_URL } from "@/lib/contracts-config"

const AUDIT_ABI = [
  "function getDecision(bytes32 merkleRoot) external view returns (tuple(string agentId, bytes32 merkleRoot, bool approved, uint8 outcome, string actionType, string target, uint8 approveCount, uint8 blockCount, string blockedReason, uint256 intentTimestamp, uint256 recordedAt, address recorder))",
  "function decisionExists(bytes32 merkleRoot) external view returns (bool)",
] as const

/** Default: Turbo testnet (same as upload) */
const DEFAULT_INDEXER_TURBO = "https://indexer-storage-testnet-turbo.0g.ai"
const DEFAULT_INDEXER_STANDARD = "https://indexer-storage-testnet-standard.0g.ai"

export type RetrievalResult =
  | {
      ok: false
      stage: "config" | "on_chain" | "download" | "decrypt" | "parse" | "verify"
      message: string
    }
  | {
      ok: true
      merkleRoot: string
      bundle: GuardmeshPhase6Bundle
      onChainData: {
        agentId: string
        approved: boolean
        outcome: number
        actionType: string
        target: string
        approveCount: number
        blockCount: number
        blockedReason: string
        intentTimestamp: bigint
        recordedAt: bigint
        recorder: string
      }
      verified: boolean
      verificationNotes: string[]
    }

function parseSymmetricKey32(raw: string | undefined): Uint8Array | null {
  const t = raw?.trim()
  if (!t) return null
  const hex = t.startsWith("0x") ? t.slice(2) : t
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null
  return new Uint8Array(Buffer.from(hex, "hex"))
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

type RuntimePolicyUsed = {
  agentId: string
  roleScope: string
  allowedActions: string[]
  deniedActions: string[]
  allowedDataSources: string[]
  consensusThreshold: number
  active: boolean
  policySource: string
}

function normalizePolicyUsed(raw: unknown): RuntimePolicyUsed | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const agentId = String(r.agentId ?? "").trim()
  if (!agentId) return null
  return {
    agentId,
    roleScope: String(r.roleScope ?? "").trim(),
    allowedActions: Array.isArray(r.allowedActions) ? r.allowedActions.map((v) => String(v)) : [],
    deniedActions: Array.isArray(r.deniedActions) ? r.deniedActions.map((v) => String(v)) : [],
    allowedDataSources: Array.isArray(r.allowedDataSources) ? r.allowedDataSources.map((v) => String(v)) : [],
    consensusThreshold: Number(r.consensusThreshold ?? 0),
    active: Boolean(r.active),
    policySource: String(r.policy_source ?? "").trim(),
  }
}

function policyFingerprint(p: RuntimePolicyUsed): string {
  const payload = {
    agentId: p.agentId,
    roleScope: p.roleScope,
    allowedActions: [...p.allowedActions].sort(),
    deniedActions: [...p.deniedActions].sort(),
    allowedDataSources: [...p.allowedDataSources].sort(),
    consensusThreshold: p.consensusThreshold,
    active: p.active,
    policySource: p.policySource,
  }
  return JSON.stringify(payload)
}

/**
 * Retrieve and decrypt a decision bundle from 0G Storage
 * @param merkleRoot - The merkle root from GuardMeshAudit.recordDecision
 * @returns The full decision bundle with verification status
 */
export async function retrieveDecisionBundle(merkleRoot: string): Promise<RetrievalResult> {
  console.log("═══════════════════════════════════════════════════════")
  console.log("🔄 STARTING 0G STORAGE RETRIEVAL")
  console.log("═══════════════════════════════════════════════════════")
  console.log("📋 Merkle Root:", merkleRoot)
  
  // Validate merkle root format
  if (!/^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) {
    console.error("❌ Invalid merkle root format")
    return {
      ok: false,
      stage: "config",
      message: `Invalid merkle root format: ${merkleRoot}. Expected 0x + 64 hex characters.`,
    }
  }

  const rpcUrl = process.env.GUARDMESH_0G_EVM_RPC_URL?.trim() || PUBLIC_RPC_URL
  const auditAddr =
    process.env.GUARDMESH_AUDIT_CONTRACT_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_AUDIT_ADDRESS?.trim() ||
    GUARDMESH_AUDIT_ADDRESS

  console.log("🔧 Configuration:")
  console.log("   RPC URL:", rpcUrl)
  console.log("   Audit Contract:", auditAddr)

  // Step 1: Verify the merkle root exists on-chain
  console.log("\n📍 Step 1: Verifying on-chain record...")
  let onChainData: RetrievalResult["onChainData"] | null = null
  try {
    const provider = new JsonRpcProvider(rpcUrl)
    const contract = new Contract(auditAddr, AUDIT_ABI, provider)

    const exists = await contract.decisionExists(merkleRoot)
    console.log("   Decision exists:", exists)
    
    if (!exists) {
      console.error("❌ No on-chain record found")
      return {
        ok: false,
        stage: "on_chain",
        message: `No decision found on-chain for merkle root: ${merkleRoot}`,
      }
    }

    const decision = await contract.getDecision(merkleRoot)
    onChainData = {
      agentId: decision.agentId,
      approved: decision.approved,
      outcome: Number(decision.outcome),
      actionType: decision.actionType,
      target: decision.target,
      approveCount: Number(decision.approveCount),
      blockCount: Number(decision.blockCount),
      blockedReason: decision.blockedReason,
      intentTimestamp: decision.intentTimestamp,
      recordedAt: decision.recordedAt,
      recorder: decision.recorder,
    }
    console.log("✅ On-chain data retrieved")
    console.log("   Agent:", onChainData.agentId)
    console.log("   Action:", onChainData.actionType, "→", onChainData.target)
    console.log("   Approved:", onChainData.approved)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("❌ On-chain verification failed:", message)
    return {
      ok: false,
      stage: "on_chain",
      message: `Failed to read on-chain data: ${message}`,
    }
  }

  // Step 2: Download from 0G Storage
  const { url: indexerUrl } = indexerUrlAndMode()
  console.log("\n📥 Step 2: Downloading from 0G Storage...")
  console.log("   Indexer URL:", indexerUrl)
  
  let downloadedBytes: Uint8Array
  try {
    const indexer = new Indexer(indexerUrl)
    const tmpFile = path.join(
      os.tmpdir(),
      `guardmesh-bundle-${merkleRoot.slice(2, 10)}-${Date.now()}.bin`
    )
    const err = await indexer.download(merkleRoot, tmpFile, false)
    if (err) {
      console.error("❌ Download failed:", err)
      return {
        ok: false,
        stage: "download",
        message: `0G Storage download failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    const data = await fs.readFile(tmpFile)
    await fs.unlink(tmpFile).catch(() => undefined)
    downloadedBytes = new Uint8Array(data)
    console.log("✅ Downloaded:", downloadedBytes.length, "bytes")
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("❌ Download error:", message)
    return {
      ok: false,
      stage: "download",
      message: `Download error: ${message}`,
    }
  }

  // Step 3: Decrypt if needed
  console.log("\n🔐 Step 3: Checking encryption...")
  let jsonBytes: Uint8Array = downloadedBytes
  let wasEncrypted = false

  // Check if data looks encrypted (not valid JSON)
  const textDecoder = new TextDecoder()
  const rawText = textDecoder.decode(downloadedBytes.slice(0, 100))
  if (!rawText.trim().startsWith("{")) {
    console.log("   Data appears encrypted, attempting decryption...")
    // Likely encrypted, try to decrypt
    const symKey = parseSymmetricKey32(process.env.GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX)
    if (!symKey) {
      console.error("❌ No decryption key available")
      return {
        ok: false,
        stage: "decrypt",
        message:
          "Data appears encrypted but GUARDMESH_STORAGE_SYMMETRIC_KEY_HEX is not set. Cannot decrypt.",
      }
    }

    try {
      // For symmetric AES-256-CTR decryption
      const crypto = await import("crypto")
      const iv = downloadedBytes.slice(0, 16) // First 16 bytes are IV
      const encrypted = downloadedBytes.slice(16)

      const decipher = crypto.createDecipheriv("aes-256-ctr", Buffer.from(symKey), Buffer.from(iv))
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()])

      jsonBytes = new Uint8Array(decrypted)
      wasEncrypted = true
      console.log("✅ Decrypted successfully")
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("❌ Decryption failed:", message)
      return {
        ok: false,
        stage: "decrypt",
        message: `Decryption failed: ${message}`,
      }
    }
  } else {
    console.log("   Data is not encrypted")
  }

  // Step 4: Parse JSON
  console.log("\n📄 Step 4: Parsing JSON...")
  let bundle: GuardmeshPhase6Bundle
  try {
    const jsonText = textDecoder.decode(jsonBytes)
    bundle = JSON.parse(jsonText) as GuardmeshPhase6Bundle
    console.log("✅ JSON parsed successfully")
    console.log("   Schema Version:", bundle.schemaVersion)
    console.log("   Decided At:", bundle.decidedAtIso)
    console.log("   Verdicts:", bundle.verdicts?.length || 0)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("❌ JSON parse failed:", message)
    return {
      ok: false,
      stage: "parse",
      message: `JSON parse failed: ${message}`,
    }
  }

  // Step 5: Verify bundle against on-chain data
  console.log("\n✓ Step 5: Verifying bundle integrity...")
  const verificationNotes: string[] = []
  let verified = true

  if (bundle.intent.agent_id !== onChainData.agentId) {
    verified = false
    verificationNotes.push(
      `Agent ID mismatch: bundle=${bundle.intent.agent_id}, chain=${onChainData.agentId}`
    )
  }

  if (bundle.intent.action_type !== onChainData.actionType) {
    verified = false
    verificationNotes.push(
      `Action type mismatch: bundle=${bundle.intent.action_type}, chain=${onChainData.actionType}`
    )
  }

  if (bundle.intent.target !== onChainData.target) {
    verified = false
    verificationNotes.push(`Target mismatch: bundle=${bundle.intent.target}, chain=${onChainData.target}`)
  }

  if (bundle.consensus.approveCount !== onChainData.approveCount) {
    verified = false
    verificationNotes.push(
      `Approve count mismatch: bundle=${bundle.consensus.approveCount}, chain=${onChainData.approveCount}`
    )
  }

  if (bundle.consensus.blockCount !== onChainData.blockCount) {
    verified = false
    verificationNotes.push(
      `Block count mismatch: bundle=${bundle.consensus.blockCount}, chain=${onChainData.blockCount}`
    )
  }

  if (bundle.consensus.execute !== onChainData.approved) {
    verified = false
    verificationNotes.push(
      `Execution decision mismatch: bundle=${bundle.consensus.execute}, chain=${onChainData.approved}`
    )
  }

  // Strict consistency check:
  // bundle.policySnapshot must match the exact runtime policy artifact used by guardians.
  const runtimePolicies = new Map<string, RuntimePolicyUsed>()
  for (const v of bundle.verdicts || []) {
    const raw = (v.raw ?? null) as Record<string, unknown> | null
    const normalized = normalizePolicyUsed(raw?.policy_used)
    if (!normalized) continue
    runtimePolicies.set(policyFingerprint(normalized), normalized)
  }
  if (!bundle.policySnapshot) {
    verified = false
    verificationNotes.push("Missing bundle.policySnapshot for runtime-policy consistency check")
  } else if (runtimePolicies.size === 0) {
    verified = false
    verificationNotes.push(
      "No verdict includes policy_used runtime artifact; cannot prove policySnapshot consistency"
    )
  } else {
    const snap: RuntimePolicyUsed = {
      agentId: String(bundle.policySnapshot.agentId ?? "").trim(),
      roleScope: String(bundle.policySnapshot.roleScope ?? "").trim(),
      allowedActions: Array.isArray(bundle.policySnapshot.allowedActions)
        ? bundle.policySnapshot.allowedActions.map((v) => String(v))
        : [],
      deniedActions: Array.isArray(bundle.policySnapshot.deniedActions)
        ? bundle.policySnapshot.deniedActions.map((v) => String(v))
        : [],
      allowedDataSources: Array.isArray(bundle.policySnapshot.allowedDataSources)
        ? bundle.policySnapshot.allowedDataSources.map((v) => String(v))
        : [],
      consensusThreshold: Number(bundle.policySnapshot.consensusThreshold ?? 0),
      active: Boolean(bundle.policySnapshot.active),
      policySource: String(bundle.policySnapshot.source ?? "").trim(),
    }
    const snapFp = policyFingerprint(snap)
    if (!runtimePolicies.has(snapFp)) {
      verified = false
      verificationNotes.push(
        `policySnapshot mismatch: snapshot(source=${snap.policySource}) does not match runtime policy_used from guardian verdicts`
      )
    } else {
      verificationNotes.push(
        `policySnapshot matches runtime policy_used (source=${snap.policySource})`
      )
    }
  }

  if (verified) {
    verificationNotes.push("All fields match on-chain data")
    if (wasEncrypted) {
      verificationNotes.push("Successfully decrypted with symmetric key")
    }
  }

  console.log(verified ? "✅ Verification PASSED" : "⚠️ Verification FAILED")
  verificationNotes.forEach(note => console.log("   •", note))
  console.log("═══════════════════════════════════════════════════════\n")

  return {
    ok: true,
    merkleRoot,
    bundle,
    onChainData,
    verified,
    verificationNotes,
  }
}
