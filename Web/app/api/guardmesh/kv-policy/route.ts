import { NextResponse } from "next/server"
import { KvClient } from "@0gfoundation/0g-ts-sdk"

import { assertToolAuthorized } from "@/lib/guardmesh-tool-auth"
import { normalizeGuardmeshKvStreamId } from "@/lib/guardmesh-kv-stream-id"
import type { KvPolicyRecord } from "@/lib/guardmesh-kv-write-policy"
import { writeGuardmeshPolicyToKv } from "@/lib/guardmesh-kv-write-policy"

export const runtime = "nodejs"

function parseKvPolicyRecord(o: unknown): KvPolicyRecord | null {
  if (!o || typeof o !== "object") return null
  const r = o as Record<string, unknown>
  const agentId = String(r.agentId ?? "").trim()
  if (!agentId) return null
  if (!Array.isArray(r.allowedActions)) return null
  return {
    agentId,
    roleScope: String(r.roleScope ?? ""),
    allowedActions: r.allowedActions.map((x) => String(x)),
    deniedActions: Array.isArray(r.deniedActions) ? r.deniedActions.map((x) => String(x)) : [],
    allowedDataSources: Array.isArray(r.allowedDataSources) ? r.allowedDataSources.map((x) => String(x)) : [],
    consensusThreshold: Number(r.consensusThreshold) || 2,
    active: r.active !== false,
    source: typeof r.source === "string" ? r.source : "web-api",
  }
}

/** Read policy for one agent from 0G KV (KV node RPC, not the storage indexer). */
async function readKvPolicy(agentId: string): Promise<KvPolicyRecord | null> {
  const nodeUrl = process.env.GUARDMESH_KV_NODE_URL?.trim()
  const streamId = normalizeGuardmeshKvStreamId(process.env.GUARDMESH_KV_STREAM_ID)
  if (!nodeUrl) return null

  const client = new KvClient(nodeUrl)
  const key = new TextEncoder().encode(agentId.trim())
  const val = await client.getValue(streamId, key).catch(() => null)
  if (!val?.data) return null
  const json = Buffer.from(val.data, "base64").toString("utf8")
  try {
    const parsed = JSON.parse(json) as unknown
    return parseKvPolicyRecord(parsed)
  } catch {
    return null
  }
}

/**
 * POST — mirror policy JSON to 0G KV (requires `GUARDMESH_KV_WRITER_PRIVATE_KEY` on server).
 * GET — read back from KV node (debug / verify CLI writes).
 * When `GUARDMESH_TOOL_SECRET` is set, require `Authorization: Bearer <secret>`.
 */
export async function POST(req: Request) {
  const auth = assertToolAuthorized(req)
  if (auth) return auth

  let body: { agent_id?: string; policy?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const agentId = String(body.agent_id ?? "").trim()
  const merged =
    body.policy && typeof body.policy === "object"
      ? parseKvPolicyRecord({ ...(body.policy as object), agentId: agentId || (body.policy as { agentId?: string }).agentId })
      : null

  if (!merged?.agentId) {
    return NextResponse.json({ error: "agent_id and policy object (Registry-shaped) are required" }, { status: 400 })
  }

  try {
    const result = await writeGuardmeshPolicyToKv(merged)
    return NextResponse.json({ ok: true, agent_id: merged.agentId, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[kv-policy POST]", message, e instanceof Error ? e.stack : "")
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}

export async function GET(req: Request) {
  const auth = assertToolAuthorized(req)
  if (auth) return auth

  const url = new URL(req.url)
  const agentId = url.searchParams.get("agent_id")?.trim()
  if (!agentId) {
    return NextResponse.json({ error: "agent_id query required" }, { status: 400 })
  }

  const policy = await readKvPolicy(agentId)
  if (!policy) {
    return NextResponse.json({ ok: true, agent_id: agentId, policy: null, note: "No value in KV or GUARDMESH_KV_NODE_URL unset" })
  }
  return NextResponse.json({ ok: true, agent_id: agentId, policy })
}
