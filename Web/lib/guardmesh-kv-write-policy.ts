/**
 * Write GuardMesh policy JSON to 0G KV (same flow as TS SDK / CLI kv-write via indexer).
 * Key = UTF-8 bytes of `agent_id`, value = UTF-8 JSON string.
 */

import { Batcher, Indexer, getFlowContract } from "@0gfoundation/0g-ts-sdk"
import { JsonRpcProvider, Wallet } from "ethers"

import { galileoTxExplorerUrl } from "@/lib/chain-0g"
import { PUBLIC_RPC_URL } from "@/lib/contracts-config"
import { normalizeGuardmeshKvStreamId } from "@/lib/guardmesh-kv-stream-id"

const DEFAULT_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai"

export type KvPolicyRecord = {
  agentId: string
  roleScope: string
  allowedActions: string[]
  deniedActions: string[]
  allowedDataSources: string[]
  consensusThreshold: number
  active: boolean
  /** Optional provenance */
  source?: string
}

function kvWriterPrivateKey(): string {
  const writer = process.env.GUARDMESH_KV_WRITER_PRIVATE_KEY?.trim()
  if (writer) return writer.startsWith("0x") ? writer : `0x${writer}`
  const audit = process.env.GUARDMESH_AUDIT_RECORDER_PRIVATE_KEY?.trim()
  if (audit) return audit.startsWith("0x") ? audit : `0x${audit}`
  return ""
}

export async function writeGuardmeshPolicyToKv(record: KvPolicyRecord): Promise<{ txHash: string; rootHash: string }> {
  const pk = kvWriterPrivateKey()
  if (!pk) {
    throw new Error(
      "No KV signing key: set GUARDMESH_KV_WRITER_PRIVATE_KEY on the Web server, or for local dev set GUARDMESH_AUDIT_RECORDER_PRIVATE_KEY (used as fallback when writer is unset)."
    )
  }

  const indexerUrl = process.env.GUARDMESH_0G_STORAGE_INDEXER_URL?.trim() || DEFAULT_INDEXER
  const rpcUrl = process.env.GUARDMESH_0G_EVM_RPC_URL?.trim() || PUBLIC_RPC_URL
  const streamIdRaw = process.env.GUARDMESH_KV_STREAM_ID?.trim() || "1"
  const streamId = normalizeGuardmeshKvStreamId(streamIdRaw)

  let rpcHost = rpcUrl
  try {
    rpcHost = new URL(rpcUrl).host
  } catch {
    /* keep raw */
  }
  console.info("[guardmesh-kv-write] start", {
    agentId: record.agentId.trim(),
    streamIdRaw,
    streamId,
    indexerUrl,
    rpcHost,
  })

  const indexer = new Indexer(indexerUrl)
  const [nodes, selErr] = await indexer.selectNodes(1, "min")
  if (selErr || !nodes?.length) {
    console.error("[guardmesh-kv-write] selectNodes", selErr)
    throw new Error(selErr?.message || "Indexer selectNodes returned no storage nodes")
  }

  const status = await nodes[0].getStatus()
  if (!status?.networkIdentity?.flowAddress) {
    console.error("[guardmesh-kv-write] getStatus", status)
    throw new Error("Storage node status missing flowAddress — check indexer/network.")
  }

  const provider = new JsonRpcProvider(rpcUrl)
  const signer = new Wallet(pk, provider)
  const flow = getFlowContract(status.networkIdentity.flowAddress, signer)

  const batcher = new Batcher(1, nodes, flow, rpcUrl)
  const key = new TextEncoder().encode(record.agentId.trim())
  const value = new TextEncoder().encode(JSON.stringify(record))

  batcher.streamDataBuilder.set(streamId, key, value)

  const [res, execErr] = await batcher.exec()
  if (execErr) {
    console.error("[guardmesh-kv-write] batcher.exec failed", execErr)
    throw new Error(String((execErr as Error).message ?? execErr))
  }
  if (!res?.txHash || !res?.rootHash) {
    console.error("[guardmesh-kv-write] empty result", res)
    throw new Error("KV batch exec returned empty txHash/rootHash")
  }
  const explorer = galileoTxExplorerUrl(res.txHash)
  console.info("[guardmesh-kv-write] ok", { txHash: res.txHash, rootHash: res.rootHash, explorer })
  console.info(
    [
      "[guardmesh-kv-write] 0G Storage KV batch committed",
      `  KV key (UTF-8): ${record.agentId.trim()}`,
      `  streamId:       ${streamId}`,
      `  rootHash:       ${res.rootHash}`,
      `  flow tx:        ${res.txHash}`,
      `  explorer:       ${explorer}`,
      "  (Data lives on the 0G Storage stream; a KV node replays stream ops for kv-read.)",
    ].join("\n")
  )
  return { txHash: res.txHash, rootHash: res.rootHash }
}
