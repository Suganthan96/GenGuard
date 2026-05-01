import { NextResponse } from "next/server"

import { galileoTxExplorerUrl } from "@/lib/chain-0g"
import { assertToolAuthorized } from "@/lib/guardmesh-tool-auth"
import { fetchRegistryPolicyAsKvRecord } from "@/lib/guardmesh-kv-sync-from-chain"
import { writeGuardmeshPolicyToKv } from "@/lib/guardmesh-kv-write-policy"

export const runtime = "nodejs"

/**
 * POST `{ "agent_id": "..." }` — reads **current** `getPolicy` from `GuardMeshRegistry` and writes the same JSON to 0G KV.
 * Use after every successful on-chain policy change so guardians (KV-only mode) never drift from chain.
 *
 * When `GUARDMESH_TOOL_SECRET` is set, requires `Authorization: Bearer <secret>`.
 */
export async function POST(req: Request) {
  const auth = assertToolAuthorized(req)
  if (auth) return auth

  let body: { agent_id?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const agentId = String(body.agent_id ?? "").trim()
  if (!agentId) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 })
  }

  try {
    const record = await fetchRegistryPolicyAsKvRecord(agentId)
    const result = await writeGuardmeshPolicyToKv(record)
    console.info("[kv-sync POST] ok", {
      agent_id: agentId,
      txHash: result.txHash,
      rootHash: result.rootHash,
      galileoTx: galileoTxExplorerUrl(result.txHash),
    })
    return NextResponse.json({
      ok: true,
      agent_id: agentId,
      source: "chain-sync",
      galileo_tx_explorer: galileoTxExplorerUrl(result.txHash),
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[kv-sync POST]", { agentId, error: message }, e instanceof Error ? e.stack : e)
    const status = message.includes("not registered")
      ? 404
      : message.includes("blocked by network policy") || message.includes("HTTP 403")
        ? 503
        : 502
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
