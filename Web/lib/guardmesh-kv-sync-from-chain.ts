/**
 * Read canonical policy from GuardMeshRegistry and shape it for 0G KV writes.
 * Keeps KV aligned with chain (single source of truth).
 */

import { getRegistryContract, getReadonlyProvider } from "@/lib/guardmesh-contracts"
import type { KvPolicyRecord } from "@/lib/guardmesh-kv-write-policy"

export async function fetchRegistryPolicyAsKvRecord(agentId: string): Promise<KvPolicyRecord> {
  const id = agentId.trim()
  if (!id) throw new Error("agent_id is empty")

  const reg = getRegistryContract(getReadonlyProvider())
  const registered = await reg.isRegistered(id)
  if (!registered) {
    throw new Error(`Agent "${id}" is not registered on GuardMeshRegistry`)
  }

  const p = await reg.getPolicy(id)
  return {
    agentId: String(p.agentId),
    roleScope: String(p.roleScope ?? ""),
    allowedActions: [...p.allowedActions],
    deniedActions: [...p.deniedActions],
    allowedDataSources: [...p.allowedDataSources],
    consensusThreshold: Number(p.consensusThreshold),
    active: Boolean(p.active),
    source: "chain-sync",
  }
}
