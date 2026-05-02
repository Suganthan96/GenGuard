import type { ContractRunner, Provider, Signer } from "ethers"
import { Contract, JsonRpcProvider } from "ethers"
import registryAbi from "@/lib/abis/registry.json"
import auditAbi from "@/lib/abis/audit.json"
import {
  GUARDMESH_AUDIT_ADDRESS,
  GUARDMESH_REGISTRY_ADDRESS,
  PUBLIC_RPC_URL,
  CHAIN_ID,
} from "@/lib/contracts-config"

let _readonly: JsonRpcProvider | null = null

export function getReadonlyProvider(): JsonRpcProvider {
  if (!_readonly) {
    _readonly = new JsonRpcProvider(PUBLIC_RPC_URL, CHAIN_ID, { staticNetwork: true })
  }
  return _readonly
}

export function getRegistryContract(runner: ContractRunner) {
  return new Contract(GUARDMESH_REGISTRY_ADDRESS, registryAbi, runner)
}

export function getAuditContract(runner: ContractRunner) {
  return new Contract(GUARDMESH_AUDIT_ADDRESS, auditAbi, runner)
}

export type RegistryPolicy = {
  agentId: string
  roleScope: string
  allowedActions: string[]
  deniedActions: string[]
  allowedDataSources: string[]
  consensusThreshold: number
  owner: string
  registeredAt: bigint
  updatedAt: bigint
  active: boolean
}

export type AuditDecision = {
  agentId: string
  merkleRoot: string
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
