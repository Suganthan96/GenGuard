import { NextResponse } from "next/server"
import { getReadonlyProvider, getRegistryContract } from "@/lib/guardmesh-contracts"

export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ agentId: string }> }

/** Read-only policy for OpenClaw / bridge scripts to embed in intents. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { agentId: raw } = await ctx.params
  const agentId = decodeURIComponent(raw || "").trim()
  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 })
  }

  try {
    const reg = getRegistryContract(getReadonlyProvider())
    const exists = await reg.isRegistered(agentId)
    if (!exists) {
      return NextResponse.json({ error: "Agent not registered", agentId }, { status: 404 })
    }
    const active = await reg.isActive(agentId)
    const p = await reg.getPolicy(agentId)
    return NextResponse.json({
      agentId: p.agentId,
      roleScope: p.roleScope,
      allowedActions: p.allowedActions,
      deniedActions: p.deniedActions,
      allowedDataSources: p.allowedDataSources,
      consensusThreshold: Number(p.consensusThreshold),
      active,
      owner: p.owner,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
